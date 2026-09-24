package com.friday.ai;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.AlarmClock;
import android.provider.MediaStore;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;
import android.widget.Toast;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.URLEncoder;

@CapacitorPlugin(name = "FridayNativeBridge")
public class FridayNativeBridgePlugin extends Plugin {

    private static final String TAG = "FridayNativeBridge";

    /**
     * Opens any installed Android application via its package name
     */
    @PluginMethod
    public void openApp(PluginCall call) {
        String packageName = call.getString("packageName");
        String appName = call.getString("appName", packageName);

        if (packageName == null || packageName.isEmpty()) {
            call.reject("packageName is required");
            return;
        }

        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            Intent launchIntent = pm.getLaunchIntentForPackage(packageName);

            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
                context.startActivity(launchIntent);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("message", "Launched " + appName + " (" + packageName + ")");
                call.resolve(ret);
            } else {
                // If direct launch intent not found, try fallback for standard apps
                boolean handled = handleSpecialPackageFallback(packageName, context);
                if (handled) {
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("message", "Launched " + appName + " via system intent fallback");
                    call.resolve(ret);
                } else {
                    call.reject("App with package " + packageName + " is not installed on this device");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error launching app: " + packageName, e);
            call.reject("Failed to open " + appName + ": " + e.getMessage());
        }
    }

    private boolean handleSpecialPackageFallback(String packageName, Context context) {
        try {
            if ("com.android.camera".equals(packageName) || "camera".equalsIgnoreCase(packageName)) {
                Intent cameraIntent = new Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA);
                cameraIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(cameraIntent);
                return true;
            } else if ("ru.zdevs.zarchiver".equals(packageName)) {
                // Try market or file manager
                Intent fileIntent = new Intent(Intent.ACTION_GET_CONTENT);
                fileIntent.setType("*/*");
                fileIntent.addCategory(Intent.CATEGORY_OPENABLE);
                fileIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(fileIntent);
                return true;
            } else if ("com.google.android.documentsui".equals(packageName)) {
                Intent fileIntent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                fileIntent.setType("*/*");
                fileIntent.addCategory(Intent.CATEGORY_OPENABLE);
                fileIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(fileIntent);
                return true;
            }
        } catch (Exception e) {
            Log.w(TAG, "Fallback intent failed for " + packageName, e);
        }
        return false;
    }

    /**
     * Explicitly opens any URL in Google Chrome app
     */
    @PluginMethod
    public void openInChrome(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("url is required");
            return;
        }

        try {
            if (!url.startsWith("http://") && !url.startsWith("https://")) {
                url = "https://" + url;
            }

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.setPackage("com.android.chrome");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Context context = getContext();
            try {
                context.startActivity(intent);
            } catch (Exception chromeNotFound) {
                // Fallback to default web browser if Chrome package is not present
                Intent fallback = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(fallback);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Opened " + url + " in Chrome");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open Chrome: " + e.getMessage());
        }
    }

    /**
     * Executes YouTube search or direct video playback
     */
    @PluginMethod
    public void executeYouTubeAction(PluginCall call) {
        String action = call.getString("action", "search");
        String query = call.getString("query", "");
        String videoId = call.getString("videoId", "");

        try {
            Context context = getContext();
            Intent intent = null;

            if ("play".equalsIgnoreCase(action) && !videoId.isEmpty()) {
                intent = new Intent(Intent.ACTION_VIEW, Uri.parse("vnd.youtube:" + videoId));
            } else if (!query.isEmpty()) {
                intent = new Intent(Intent.ACTION_SEARCH);
                intent.setPackage("com.google.android.youtube");
                intent.putExtra("query", query);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            } else {
                PackageManager pm = context.getPackageManager();
                intent = pm.getLaunchIntentForPackage("com.google.android.youtube");
            }

            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    context.startActivity(intent);
                } catch (Exception e) {
                    // Fallback to browser YouTube
                    String webUrl = query.isEmpty() ? "https://www.youtube.com" :
                            "https://www.youtube.com/results?search_query=" + URLEncoder.encode(query, "UTF-8");
                    Intent webIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(webUrl));
                    webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(webIntent);
                }
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Executed YouTube " + action + " for: " + (query.isEmpty() ? videoId : query));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("YouTube action failed: " + e.getMessage());
        }
    }

    /**
     * Direct WhatsApp messaging via deep link intent
     */
    @PluginMethod
    public void sendWhatsAppMessage(PluginCall call) {
        String phone = call.getString("phoneNumber", "");
        String message = call.getString("message", "");

        try {
            Context context = getContext();
            String cleanPhone = phone.replaceAll("[^0-9]", "");
            String encodedMessage = URLEncoder.encode(message, "UTF-8");

            Uri uri;
            if (!cleanPhone.isEmpty()) {
                uri = Uri.parse("https://api.whatsapp.com/send?phone=" + cleanPhone + "&text=" + encodedMessage);
            } else {
                uri = Uri.parse("https://api.whatsapp.com/send?text=" + encodedMessage);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.setPackage("com.whatsapp");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            try {
                context.startActivity(intent);
            } catch (Exception e) {
                // If package not found, open in browser / chooser
                Intent fallback = new Intent(Intent.ACTION_VIEW, uri);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(fallback);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Opened WhatsApp" + (cleanPhone.isEmpty() ? "" : " for " + cleanPhone));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("WhatsApp intent error: " + e.getMessage());
        }
    }

    /**
     * Triggers Phone Dialer
     */
    @PluginMethod
    public void triggerPhoneCall(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber", "");
        if (phoneNumber.isEmpty()) {
            call.reject("phoneNumber is required");
            return;
        }

        try {
            Context context = getContext();
            Intent intent = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phoneNumber));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Dialer opened for " + phoneNumber);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Dialer error: " + e.getMessage());
        }
    }

    /**
     * Sets a Native Android Alarm
     */
    @PluginMethod
    public void setAlarm(PluginCall call) {
        Integer hour = call.getInt("hour");
        Integer minutes = call.getInt("minutes");
        String title = call.getString("title", "Friday AI Alarm");
        Boolean skipUi = call.getBoolean("skipUi", false);

        if (hour == null || minutes == null) {
            call.reject("hour and minutes are required");
            return;
        }

        try {
            Context context = getContext();
            Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM);
            intent.putExtra(AlarmClock.EXTRA_HOUR, hour);
            intent.putExtra(AlarmClock.EXTRA_MINUTES, minutes);
            intent.putExtra(AlarmClock.EXTRA_MESSAGE, title);
            intent.putExtra(AlarmClock.EXTRA_SKIP_UI, skipUi != null && skipUi);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Alarm set for " + String.format("%02d:%02d", hour, minutes));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to set alarm: " + e.getMessage());
        }
    }

    /**
     * Opens Native Camera
     */
    @PluginMethod
    public void openCamera(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Camera opened");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open camera: " + e.getMessage());
        }
    }

    /**
     * Checks if Accessibility Service is enabled for Friday AI
     */
    @PluginMethod
    public void checkAccessibilityPermission(PluginCall call) {
        boolean isRunning = FridayAccessibilityService.isServiceRunning();
        if (!isRunning) {
            isRunning = isAccessibilitySettingsOn(getContext());
        }

        JSObject ret = new JSObject();
        ret.put("isEnabled", isRunning);
        call.resolve(ret);
    }

    /**
     * Directs user to Android Accessibility Settings screen
     */
    @PluginMethod
    public void requestAccessibilityPermission(PluginCall call) {
        try {
            Context context = getContext();
            Toast.makeText(context, "Please enable 'FRIDAY AI' in Accessibility Services", Toast.LENGTH_LONG).show();

            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Opened Accessibility Settings");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open Accessibility Settings: " + e.getMessage());
        }
    }

    /**
     * Performs global accessibility automation action (back, home, recents, notifications)
     */
    @PluginMethod
    public void executeAccessibilityAction(PluginCall call) {
        String action = call.getString("action", "back");
        FridayAccessibilityService service = FridayAccessibilityService.getInstance();

        if (service == null) {
            call.reject("Accessibility Service is not enabled. Please enable FRIDAY AI in Accessibility Settings.");
            return;
        }

        boolean result = service.performAction(action);
        JSObject ret = new JSObject();
        ret.put("success", result);
        ret.put("message", "Executed accessibility action: " + action);
        call.resolve(ret);
    }

    private boolean isAccessibilitySettingsOn(Context mContext) {
        int accessibilityEnabled = 0;
        final String service = mContext.getPackageName() + "/" + FridayAccessibilityService.class.getCanonicalName();
        try {
            accessibilityEnabled = Settings.Secure.getInt(
                    mContext.getApplicationContext().getContentResolver(),
                    android.provider.Settings.Secure.ACCESSIBILITY_ENABLED);
        } catch (Settings.SettingNotFoundException e) {
            Log.e(TAG, "Error finding setting: " + e.getMessage());
        }

        TextUtils.SimpleStringSplitter mStringColonSplitter = new TextUtils.SimpleStringSplitter(':');

        if (accessibilityEnabled == 1) {
            String settingValue = Settings.Secure.getString(
                    mContext.getApplicationContext().getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (settingValue != null) {
                mStringColonSplitter.setString(settingValue);
                while (mStringColonSplitter.hasNext()) {
                    String accessibilityService = mStringColonSplitter.next();
                    if (accessibilityService.equalsIgnoreCase(service)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
