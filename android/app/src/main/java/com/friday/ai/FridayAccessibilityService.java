package com.friday.ai;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.List;

/**
 * FridayAccessibilityService
 * Provides deep automation capabilities for Friday AI:
 * - Global system actions (BACK, HOME, RECENTS, NOTIFICATIONS, LOCK)
 * - Screen element inspection and click automation
 */
public class FridayAccessibilityService extends AccessibilityService {

    private static final String TAG = "FridayAccessibility";
    private static FridayAccessibilityService instance = null;

    public static FridayAccessibilityService getInstance() {
        return instance;
    }

    public static boolean isServiceRunning() {
        return instance != null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Log.d(TAG, "FridayAccessibilityService created");
    }

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        Log.d(TAG, "FridayAccessibilityService connected and ready for AI automation");

        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED |
                          AccessibilityEvent.TYPE_VIEW_CLICKED |
                          AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS |
                     AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS |
                     AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        info.notificationTimeout = 100;
        setServiceInfo(info);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;
        // Logs active application package for AI awareness
        CharSequence pkg = event.getPackageName();
        if (pkg != null) {
            Log.v(TAG, "Active App: " + pkg);
        }
    }

    @Override
    public void onInterrupt() {
        Log.w(TAG, "FridayAccessibilityService interrupted");
    }

    @Override
    public boolean onUnbind(Intent intent) {
        instance = null;
        Log.d(TAG, "FridayAccessibilityService unbind");
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        instance = null;
        super.onDestroy();
        Log.d(TAG, "FridayAccessibilityService destroyed");
    }

    /**
     * Executes Android system global actions
     */
    public boolean performAction(String action) {
        if (action == null) return false;
        switch (action.toLowerCase()) {
            case "back":
                return performGlobalAction(GLOBAL_ACTION_BACK);
            case "home":
                return performGlobalAction(GLOBAL_ACTION_HOME);
            case "recents":
                return performGlobalAction(GLOBAL_ACTION_RECENTS);
            case "notifications":
                return performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS);
            case "quick_settings":
                return performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS);
            case "lock_screen":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    return performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN);
                } else {
                    return performGlobalAction(GLOBAL_ACTION_HOME);
                }
            default:
                Log.w(TAG, "Unknown accessibility action: " + action);
                return false;
        }
    }

    /**
     * Finds and clicks a button/node with matching text
     */
    public boolean clickNodeWithText(String text) {
        AccessibilityNodeInfo rootNode = getRootInActiveWindow();
        if (rootNode == null) return false;

        List<AccessibilityNodeInfo> nodes = rootNode.findAccessibilityNodeInfosByText(text);
        if (nodes != null && !nodes.isEmpty()) {
            for (AccessibilityNodeInfo node : nodes) {
                if (node.isClickable()) {
                    boolean success = node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                    node.recycle();
                    rootNode.recycle();
                    return success;
                }
                // Try parent if clickable
                AccessibilityNodeInfo parent = node.getParent();
                if (parent != null && parent.isClickable()) {
                    boolean success = parent.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                    parent.recycle();
                    node.recycle();
                    rootNode.recycle();
                    return success;
                }
                node.recycle();
            }
        }
        rootNode.recycle();
        return false;
    }
}
