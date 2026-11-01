package com.teachermanager.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.util.Log;
import androidx.activity.result.ActivityResult;
import androidx.annotation.RequiresApi;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "ReportFileSaver")
public class ReportFileSaverPlugin extends Plugin {
    private static final String TAG = "ReportFileSaver";
    private static final String EXPORT_CACHE_SUBDIR = "exports";
    private static final long STALE_EXPORT_MAX_AGE_MS = 6L * 60L * 60L * 1000L; // 6 hours

    private final Map<String, String> pendingStagedFiles = new ConcurrentHashMap<>();

    @PluginMethod
    public void saveToDownloads(final PluginCall call) {
        final String rawFilename = call.getString("filename", "");
        final String rawBase64 = call.getString("base64Data", "");
        final String rawMimeType = call.getString("mimeType", "application/octet-stream");
        final String shareTitle = call.getString("title", "");
        final String shareText = call.getString("text", "");

        if (rawBase64 == null || rawBase64.trim().isEmpty()) {
            call.reject("EMPTY_REPORT_PAYLOAD");
            return;
        }

        final String safeMimeType = normalizeMimeType(rawMimeType, rawFilename);
        final String safeFilename = sanitizeFilename(rawFilename, safeMimeType);

        bridge.execute(() -> {
            byte[] fileBytes;
            try {
                fileBytes = decodeBase64Payload(rawBase64);
            } catch (IllegalArgumentException decodeErr) {
                Log.e(TAG, "Failed to decode base64 report data", decodeErr);
                call.reject("INVALID_BASE64_PAYLOAD", decodeErr);
                return;
            }

            if (fileBytes.length == 0) {
                call.reject("EMPTY_REPORT_PAYLOAD");
                return;
            }

            // Strip large base64 payload from PluginCall before any ActivityResult persistence
            if (call.getData() != null) {
                call.getData().remove("base64Data");
            }

            Context context = getContext();
            if (context == null) {
                call.reject("ANDROID_CONTEXT_UNAVAILABLE");
                return;
            }

            // Primary path on Android 10+ (API 29+): Direct atomic save into public Downloads via MediaStore
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    JSObject mediaStoreResult = saveViaMediaStoreDownloads(
                        context,
                        safeFilename,
                        safeMimeType,
                        fileBytes
                    );
                    call.resolve(mediaStoreResult);
                    return;
                } catch (Exception mediaStoreErr) {
                    Log.w(
                        TAG,
                        "MediaStore.Downloads direct save failed, falling back to system document picker",
                        mediaStoreErr
                    );
                }
            }

            // Fallback path (Android 6–9 or custom OEM ROM): Stage file in cache & open SAF "Save to device" picker
            try {
                File stagedFile = writeStagedExportFile(context, safeFilename, fileBytes);
                pendingStagedFiles.put(call.getCallbackId(), stagedFile.getAbsolutePath());
                if (call.getData() != null) {
                    call.getData().put("_stagedPath", stagedFile.getAbsolutePath());
                    call.getData().put("_safeFilename", safeFilename);
                    call.getData().put("_safeMimeType", safeMimeType);
                }

                bridge.executeOnMainThread(() -> {
                    try {
                        Intent createIntent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                        createIntent.addCategory(Intent.CATEGORY_OPENABLE);
                        createIntent.setType(safeMimeType);
                        createIntent.putExtra(Intent.EXTRA_TITLE, safeFilename);
                        startActivityForResult(call, createIntent, "handleSaveDocumentResult");
                    } catch (ActivityNotFoundException noPickerErr) {
                        Log.w(
                            TAG,
                            "ACTION_CREATE_DOCUMENT unavailable; falling back to FileProvider share sheet",
                            noPickerErr
                        );
                        launchShareChooserOnUiThread(
                            call,
                            stagedFile,
                            safeFilename,
                            safeMimeType,
                            shareTitle,
                            shareText
                        );
                    } catch (Exception launchErr) {
                        deleteQuietly(stagedFile);
                        call.reject("SAVE_INTENT_LAUNCH_FAILED", launchErr);
                    }
                });
            } catch (IOException stageErr) {
                Log.e(TAG, "Failed to stage report file in cache", stageErr);
                call.reject("STORAGE_WRITE_FAILED", stageErr);
            }
        });
    }

    @PluginMethod
    public void shareFile(final PluginCall call) {
        final String rawFilename = call.getString("filename", "");
        final String rawBase64 = call.getString("base64Data", "");
        final String rawMimeType = call.getString("mimeType", "application/octet-stream");
        final String shareTitle = call.getString("title", "");
        final String shareText = call.getString("text", "");

        if (rawBase64 == null || rawBase64.trim().isEmpty()) {
            call.reject("EMPTY_REPORT_PAYLOAD");
            return;
        }

        final String safeMimeType = normalizeMimeType(rawMimeType, rawFilename);
        final String safeFilename = sanitizeFilename(rawFilename, safeMimeType);

        bridge.execute(() -> {
            byte[] fileBytes;
            try {
                fileBytes = decodeBase64Payload(rawBase64);
            } catch (IllegalArgumentException decodeErr) {
                Log.e(TAG, "Failed to decode base64 report data for share", decodeErr);
                call.reject("INVALID_BASE64_PAYLOAD", decodeErr);
                return;
            }

            if (fileBytes.length == 0) {
                call.reject("EMPTY_REPORT_PAYLOAD");
                return;
            }

            if (call.getData() != null) {
                call.getData().remove("base64Data");
            }

            Context context = getContext();
            if (context == null) {
                call.reject("ANDROID_CONTEXT_UNAVAILABLE");
                return;
            }

            try {
                File stagedFile = writeStagedExportFile(context, safeFilename, fileBytes);
                if (call.getData() != null) {
                    call.getData().put("_safeFilename", safeFilename);
                }
                bridge.executeOnMainThread(() ->
                    launchShareChooserOnUiThread(
                        call,
                        stagedFile,
                        safeFilename,
                        safeMimeType,
                        shareTitle,
                        shareText
                    )
                );
            } catch (IOException stageErr) {
                Log.e(TAG, "Failed to stage report file for sharing", stageErr);
                call.reject("STORAGE_WRITE_FAILED", stageErr);
            }
        });
    }

    @ActivityCallback
    private void handleSaveDocumentResult(final PluginCall call, final ActivityResult result) {
        if (call == null) {
            return;
        }

        String stagedPath = pendingStagedFiles.remove(call.getCallbackId());
        if ((stagedPath == null || stagedPath.isEmpty()) && call.getData() != null) {
            stagedPath = call.getString("_stagedPath", "");
        }
        final String safeFilename = call.getString("_safeFilename", "Classy_Report.pdf");
        final File stagedFile = (stagedPath != null && !stagedPath.isEmpty())
            ? new File(stagedPath)
            : null;

        Intent resultData = result != null ? result.getData() : null;
        Uri targetUri = resultData != null ? resultData.getData() : null;

        if (result == null || result.getResultCode() != Activity.RESULT_OK || targetUri == null) {
            deleteQuietly(stagedFile);
            JSObject cancelledRet = new JSObject();
            cancelledRet.put("saved", false);
            cancelledRet.put("shared", false);
            cancelledRet.put("cancelled", true);
            cancelledRet.put("method", "saf_create_document");
            cancelledRet.put("filename", safeFilename);
            call.resolve(cancelledRet);
            return;
        }

        if (stagedFile == null || !stagedFile.exists() || stagedFile.length() == 0) {
            call.reject("STAGED_EXPORT_FILE_MISSING");
            return;
        }

        final Uri finalTargetUri = targetUri;
        bridge.execute(() -> {
            Context context = getContext();
            if (context == null) {
                deleteQuietly(stagedFile);
                call.reject("ANDROID_CONTEXT_UNAVAILABLE");
                return;
            }

            ContentResolver resolver = context.getContentResolver();
            long totalCopied = 0L;
            try (
                InputStream in = new FileInputStream(stagedFile);
                OutputStream out = resolver.openOutputStream(finalTargetUri, "wt")
            ) {
                if (out == null) {
                    throw new IOException("ContentResolver returned null OutputStream");
                }
                byte[] buffer = new byte[16 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    totalCopied += read;
                }
                out.flush();
            } catch (Exception writeErr) {
                Log.e(TAG, "Failed writing report to user-selected URI", writeErr);
                deleteQuietly(stagedFile);
                call.reject("STORAGE_WRITE_FAILED", writeErr);
                return;
            }

            deleteQuietly(stagedFile);

            if (totalCopied <= 0) {
                call.reject("STORAGE_WRITE_FAILED");
                return;
            }

            String resolvedName = queryDisplayName(resolver, finalTargetUri, safeFilename);
            JSObject ret = new JSObject();
            ret.put("saved", true);
            ret.put("shared", false);
            ret.put("cancelled", false);
            ret.put("method", "saf_create_document");
            ret.put("uri", finalTargetUri.toString());
            ret.put("filename", resolvedName);
            ret.put("bytesWritten", totalCopied);
            ret.put("locationLabel", "Device");
            call.resolve(ret);
        });
    }

    @ActivityCallback
    private void handleShareFileResult(final PluginCall call, final ActivityResult result) {
        if (call == null) {
            return;
        }
        String safeFilename = call.getString("_safeFilename", "Classy_Report.pdf");
        JSObject ret = new JSObject();
        ret.put("saved", false);
        ret.put("shared", true);
        ret.put("cancelled", false);
        ret.put("method", "android_sharesheet");
        ret.put("filename", safeFilename);
        call.resolve(ret);
    }

    @RequiresApi(api = Build.VERSION_CODES.Q)
    private JSObject saveViaMediaStoreDownloads(
        Context context,
        String safeFilename,
        String safeMimeType,
        byte[] fileBytes
    ) throws IOException {
        ContentResolver resolver = context.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeFilename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, safeMimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri itemUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (itemUri == null) {
            throw new IOException("MediaStore.Downloads.EXTERNAL_CONTENT_URI insert returned null");
        }

        try {
            try (OutputStream out = resolver.openOutputStream(itemUri)) {
                if (out == null) {
                    throw new IOException("MediaStore OutputStream is null");
                }
                out.write(fileBytes);
                out.flush();
            }

            ContentValues publishValues = new ContentValues();
            publishValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(itemUri, publishValues, null, null);

            String resolvedName = queryDisplayName(resolver, itemUri, safeFilename);
            long verifiedSize = querySize(resolver, itemUri, fileBytes.length);
            if (verifiedSize <= 0) {
                throw new IOException("Verified MediaStore file size was 0 bytes");
            }

            JSObject ret = new JSObject();
            ret.put("saved", true);
            ret.put("shared", false);
            ret.put("cancelled", false);
            ret.put("method", "mediastore_downloads");
            ret.put("uri", itemUri.toString());
            ret.put("filename", resolvedName);
            ret.put("bytesWritten", fileBytes.length);
            ret.put("locationLabel", "Downloads");
            return ret;
        } catch (Exception err) {
            try {
                resolver.delete(itemUri, null, null);
            } catch (Exception ignored) {
                // Ignore cleanup failure
            }
            if (err instanceof IOException) {
                throw (IOException) err;
            }
            throw new IOException("MediaStore write failed", err);
        }
    }

    private void launchShareChooserOnUiThread(
        PluginCall call,
        File stagedFile,
        String safeFilename,
        String safeMimeType,
        String shareTitle,
        String shareText
    ) {
        Context context = getContext();
        if (context == null) {
            call.reject("ANDROID_CONTEXT_UNAVAILABLE");
            return;
        }

        try {
            Uri contentUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                stagedFile
            );

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType(safeMimeType);
            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            if (shareTitle != null && !shareTitle.trim().isEmpty()) {
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, shareTitle.trim());
            }
            if (shareText != null && !shareText.trim().isEmpty()) {
                shareIntent.putExtra(Intent.EXTRA_TEXT, shareText.trim());
            }
            shareIntent.setClipData(ClipData.newRawUri(safeFilename, contentUri));
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            String chooserHeader = (shareTitle != null && !shareTitle.trim().isEmpty())
                ? shareTitle.trim()
                : safeFilename;
            Intent chooser = Intent.createChooser(shareIntent, chooserHeader);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            startActivityForResult(call, chooser, "handleShareFileResult");
        } catch (Exception shareErr) {
            Log.e(TAG, "Failed to open Android share chooser for exported report", shareErr);
            call.reject("SHARE_INTENT_FAILED", shareErr);
        }
    }

    private File writeStagedExportFile(Context context, String safeFilename, byte[] fileBytes)
        throws IOException {
        File exportDir = new File(context.getCacheDir(), EXPORT_CACHE_SUBDIR);
        if (!exportDir.exists() && !exportDir.mkdirs()) {
            throw new IOException("Unable to create export cache directory");
        }
        cleanExpiredStagedFiles(exportDir);

        File stagedFile = new File(exportDir, safeFilename);
        try (FileOutputStream fos = new FileOutputStream(stagedFile, false)) {
            fos.write(fileBytes);
            fos.flush();
            fos.getFD().sync();
        }
        return stagedFile;
    }

    private void cleanExpiredStagedFiles(File exportDir) {
        File[] existing = exportDir.listFiles();
        if (existing == null) return;
        long cutoff = System.currentTimeMillis() - STALE_EXPORT_MAX_AGE_MS;
        for (File f : existing) {
            if (f != null && f.isFile() && f.lastModified() < cutoff) {
                deleteQuietly(f);
            }
        }
    }

    private void deleteQuietly(File file) {
        if (file != null && file.exists()) {
            try {
                //noinspection ResultOfMethodCallIgnored
                file.delete();
            } catch (Exception ignored) {
                // Ignore cleanup failure
            }
        }
    }

    private static byte[] decodeBase64Payload(String rawBase64) {
        String trimmed = rawBase64.trim();
        int commaIdx = trimmed.indexOf(',');
        if (commaIdx >= 0 && trimmed.substring(0, commaIdx).contains("base64")) {
            trimmed = trimmed.substring(commaIdx + 1);
        }
        return Base64.decode(trimmed, Base64.DEFAULT);
    }

    private static String normalizeMimeType(String rawMime, String filename) {
        String lowerMime = rawMime == null ? "" : rawMime.trim().toLowerCase(Locale.ROOT);
        int semi = lowerMime.indexOf(';');
        if (semi >= 0) {
            lowerMime = lowerMime.substring(0, semi).trim();
        }
        if ("application/pdf".equals(lowerMime)) {
            return "application/pdf";
        }
        if ("text/csv".equals(lowerMime) || "application/csv".equals(lowerMime)) {
            return "text/csv";
        }
        String lowerName = filename == null ? "" : filename.trim().toLowerCase(Locale.ROOT);
        if (lowerName.endsWith(".pdf")) {
            return "application/pdf";
        }
        if (lowerName.endsWith(".csv")) {
            return "text/csv";
        }
        return lowerMime.isEmpty() ? "application/octet-stream" : lowerMime;
    }

    private static String sanitizeFilename(String rawFilename, String mimeType) {
        String ext = "text/csv".equals(mimeType) ? ".csv" : ".pdf";
        String candidate = rawFilename == null ? "" : rawFilename.trim();
        if (!candidate.isEmpty()) {
            candidate = Normalizer.normalize(candidate, Normalizer.Form.NFC);
        }
        // Remove illegal filesystem characters and control bytes while preserving Arabic & Latin UTF-8
        candidate = candidate
            .replaceAll("[\\u0000-\\u001F\\u007F\\\\/:*?\"<>|]+", "_")
            .replaceAll("\\s+", "_")
            .replaceAll("_+", "_")
            .replaceAll("^[-_.]+", "");

        if (candidate.isEmpty()) {
            candidate = "Classy_Report" + ext;
        } else {
            String lower = candidate.toLowerCase(Locale.ROOT);
            if (!lower.endsWith(".pdf") && !lower.endsWith(".csv")) {
                candidate = candidate + ext;
            }
        }
        return candidate;
    }

    private static String queryDisplayName(ContentResolver resolver, Uri uri, String fallback) {
        try (
            Cursor cursor = resolver.query(
                uri,
                new String[] { OpenableColumns.DISPLAY_NAME },
                null,
                null,
                null
            )
        ) {
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0 && !cursor.isNull(idx)) {
                    String name = cursor.getString(idx);
                    if (name != null && !name.trim().isEmpty()) {
                        return name;
                    }
                }
            }
        } catch (Exception ignored) {
            // Fall back to requested filename
        }
        return fallback;
    }

    private static long querySize(ContentResolver resolver, Uri uri, long fallback) {
        try (
            Cursor cursor = resolver.query(
                uri,
                new String[] { OpenableColumns.SIZE },
                null,
                null,
                null
            )
        ) {
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (idx >= 0 && !cursor.isNull(idx)) {
                    return cursor.getLong(idx);
                }
            }
        } catch (Exception ignored) {
            // Fall back to byte array length
        }
        return fallback;
    }
}
