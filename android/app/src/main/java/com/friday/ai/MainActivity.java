package com.friday.ai;

import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "FridayMainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the custom native plugin with Capacitor
        registerPlugin(FridayNativeBridgePlugin.class);
        super.onCreate(savedInstanceState);

        Log.d(TAG, "Friday AI Native Android Container Initialized");
    }

    @Override
    public void onResume() {
        super.onResume();
        // Check if Accessibility Service is enabled for AI automation
        checkAndNotifyAccessibility();
    }

    private void checkAndNotifyAccessibility() {
        if (!FridayAccessibilityService.isServiceRunning()) {
            Log.i(TAG, "FridayAccessibilityService is not yet active");
        } else {
            Log.i(TAG, "FridayAccessibilityService is ACTIVE and ready for actions");
        }
    }
}
