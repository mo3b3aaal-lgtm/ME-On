package com.teachermanager.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public class SyncWorker extends Worker {
    private static final String TAG = "TeacherManagerSync";
    private static final String PREFS_NAME = "TeacherManagerSyncPrefs";

    public SyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        String userId = getInputData().getString("userId");
        String frequency = getInputData().getString("frequency");
        String serverUrl = getInputData().getString("serverUrl");

        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        if (userId == null || userId.isEmpty()) {
            userId = prefs.getString("activeUserId", "default_user");
        }

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        String nowIso = sdf.format(new Date());

        Log.d(TAG, "Starting Android WorkManager scheduled sync for user: " + userId + " (interval: " + frequency + ")");

        try {
            int responseCode = 0;
            // If a serverUrl is available, perform background server reachability check
            if (serverUrl != null && !serverUrl.isEmpty()) {
                URL url = new URL(serverUrl.endsWith("/") ? serverUrl + "api/health" : serverUrl + "/api/health");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                responseCode = conn.getResponseCode();
                conn.disconnect();
                Log.d(TAG, "Sync server health check status: " + responseCode);
            }

            if (responseCode >= 500) {
                throw new IllegalStateException("Server health check returned HTTP " + responseCode);
            }

            // Record health-check telemetry separately without overwriting real JS cloud sync status
            prefs.edit()
                .putString("lastHealthCheckTime_" + userId, nowIso)
                .putString("lastHealthCheckStatus_" + userId, responseCode >= 200 && responseCode < 400 ? "ok" : "skipped")
                .apply();

            Log.d(TAG, "Android WorkManager reachability check completed at " + nowIso);
            return Result.success();
        } catch (Exception e) {
            Log.w(TAG, "SyncWorker encountered an issue, scheduling retry with backoff: " + e.getMessage());
            prefs.edit()
                .putString("lastHealthCheckTime_" + userId, nowIso)
                .putString("lastHealthCheckStatus_" + userId, "offline_deferred")
                .apply();
            return Result.retry();
        }
    }
}
