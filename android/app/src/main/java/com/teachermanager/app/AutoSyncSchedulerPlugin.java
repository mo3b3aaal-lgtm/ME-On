package com.teachermanager.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "AutoSyncScheduler")
public class AutoSyncSchedulerPlugin extends Plugin {
    private static final String TAG = "AutoSyncScheduler";
    private static final String PREFS_NAME = "TeacherManagerSyncPrefs";
    private static final String WORK_NAME_PREFIX = "TeacherManager_AutoSync_";

    @PluginMethod
    public void scheduleSync(PluginCall call) {
        String frequency = call.getString("frequency", "daily");
        String userId = call.getString("userId", "default_user");
        String serverUrl = call.getString("serverUrl", "");

        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString("frequency_" + userId, frequency)
            .putString("activeUserId", userId)
            .putString("serverUrl", serverUrl)
            .apply();

        WorkManager workManager = WorkManager.getInstance(context);
        String uniqueWorkName = WORK_NAME_PREFIX + userId;

        if ("off".equalsIgnoreCase(frequency)) {
            workManager.cancelUniqueWork(uniqueWorkName);
            Log.d(TAG, "Cancelled scheduled WorkManager background sync for user: " + userId);
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("scheduled", false);
            ret.put("frequency", "off");
            ret.put("message", "تم إيقاف المزامنة المجدولة بنجاح في Android WorkManager");
            call.resolve(ret);
            return;
        }

        long repeatInterval;
        TimeUnit timeUnit;

        switch (frequency.toLowerCase()) {
            case "hourly":
                repeatInterval = 1;
                timeUnit = TimeUnit.HOURS;
                break;
            case "weekly":
                repeatInterval = 7;
                timeUnit = TimeUnit.DAYS;
                break;
            case "monthly":
                repeatInterval = 30;
                timeUnit = TimeUnit.DAYS;
                break;
            case "daily":
            default:
                repeatInterval = 24;
                timeUnit = TimeUnit.HOURS;
                break;
        }

        // Constraints: Requires connected network and healthy battery
        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build();

        Data inputData = new Data.Builder()
            .putString("userId", userId)
            .putString("frequency", frequency)
            .putString("serverUrl", serverUrl)
            .build();

        PeriodicWorkRequest syncRequest = new PeriodicWorkRequest.Builder(
                SyncWorker.class,
                repeatInterval,
                timeUnit
            )
            .setConstraints(constraints)
            .setInputData(inputData)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 15, TimeUnit.MINUTES)
            .build();

        workManager.enqueueUniquePeriodicWork(
            uniqueWorkName,
            ExistingPeriodicWorkPolicy.UPDATE,
            syncRequest
        );

        Log.d(TAG, "Enqueued periodic WorkManager sync for user " + userId + " with frequency: " + frequency);

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("scheduled", true);
        ret.put("frequency", frequency);
        ret.put("workName", uniqueWorkName);
        ret.put("message", "تم جدولة المزامنة بنجاح في نظام Android WorkManager");
        call.resolve(ret);
    }

    @PluginMethod
    public void triggerImmediateSync(PluginCall call) {
        String userId = call.getString("userId", "default_user");
        String serverUrl = call.getString("serverUrl", "");

        Context context = getContext();
        WorkManager workManager = WorkManager.getInstance(context);

        Constraints constraints = new Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build();

        Data inputData = new Data.Builder()
            .putString("userId", userId)
            .putString("frequency", "manual")
            .putString("serverUrl", serverUrl)
            .build();

        OneTimeWorkRequest oneTimeSync = new OneTimeWorkRequest.Builder(SyncWorker.class)
            .setConstraints(constraints)
            .setInputData(inputData)
            .build();

        workManager.enqueueUniqueWork(
            "TeacherManager_ImmediateSync_" + userId,
            ExistingWorkPolicy.REPLACE,
            oneTimeSync
        );

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("triggered", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void getSyncStatus(PluginCall call) {
        String userId = call.getString("userId", "default_user");
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        JSObject ret = new JSObject();
        ret.put("frequency", prefs.getString("frequency_" + userId, "daily"));
        ret.put("lastSyncTime", prefs.getString("lastSyncTime_" + userId, null));
        ret.put("lastSyncStatus", prefs.getString("lastSyncStatus_" + userId, "idle"));
        ret.put("lastSyncMessage", prefs.getString("lastSyncMessage_" + userId, ""));
        call.resolve(ret);
    }
}
