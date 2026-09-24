# 📱 FRIDAY AI - Android Native APK & Capacitor Setup Guide

This project is fully configured to run both as a ultra-low-latency Web application and as a real native Android Application packaged using **Capacitor**, complete with:
- **Direct App Launching** via Android `PackageManager` (WhatsApp, YouTube, Camera, ZArchiver, Files, Instagram, Settings, etc.)
- **Dedicated Google Chrome Link Opener** via explicit Android Intents (`com.android.chrome`)
- **Direct YouTube Video Actions** (in-app search and automated playback)
- **WhatsApp Direct Messaging** via deep links and Android Intents
- **Hardware Integration**: Device Camera, Phone Dialer (`ACTION_DIAL`), and Native Alarm Clock (`ACTION_SET_ALARM`)
- **Friday Accessibility Service**: Background Android Accessibility Service for hands-free system gestures (`BACK`, `HOME`, `RECENTS`, `NOTIFICATIONS`) and automated screen interactions

---

## 🏗️ Architecture Overview

```
├── capacitor.config.ts                      # Capacitor configuration (appId: com.friday.ai)
├── android/
│   ├── app/
│   │   ├── src/main/AndroidManifest.xml     # Permissions (QUERY_ALL_PACKAGES, BIND_ACCESSIBILITY, CAMERA, ALARM, CALL)
│   │   ├── src/main/java/com/friday/ai/
│   │   │   ├── MainActivity.java            # Capacitor Bridge Activity with plugin registration
│   │   │   ├── FridayNativeBridgePlugin.java # Native Java Plugin for Intents, App Manager, Alarms & Dialer
│   │   │   └── FridayAccessibilityService.java # Deep Automation Accessibility Service
│   │   └── src/main/res/xml/
│   │       ├── accessibility_service_config.xml # Accessibility config flags & capabilities
│   │       └── file_paths.xml
│   ├── build.gradle
│   ├── settings.gradle
│   └── variables.gradle
├── src/
│   ├── lib/friday-native-bridge.ts          # TypeScript Bridge with seamless Web Fallback & Package Resolver
│   └── components/AccessibilityBanner.tsx   # In-app Android Accessibility Service grant prompt
└── .github/workflows/build-apk.yml          # 1-Click GitHub Actions automated APK Builder
```

---

## 🚀 Option 1: Build the APK Locally via Android Studio

### Prerequisites
1. **Node.js** (v18 or v20+)
2. **Android Studio** (Hedgehog, Iguana, Koala, or Ladybug)
3. **Java JDK 17** (configured in Android Studio)

### Step 1: Install Dependencies & Build Web Assets
```bash
npm install
npm run build
```

### Step 2: Initialize & Sync Capacitor Android
Run the sync command to copy web assets and sync plugins into the `android/` directory:
```bash
npx cap sync android
```
*(Or run `npm run cap:build` which builds and syncs in one step).*

### Step 3: Open in Android Studio
```bash
npx cap open android
```
*(Or open Android Studio and choose "Open an Existing Project", then select the `android` folder).*

### Step 4: Build the Debug APK
1. Wait for Gradle sync to complete in Android Studio.
2. In the top menu, go to **Build** ➔ **Build Bundle(s) / APK(s)** ➔ **Build APK(s)**.
3. Once finished, click **locate** in the popup notification.
4. Your APK file will be located at:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Step 5: (Optional) Build via Command Line
From the project root:
```bash
cd android
./gradlew assembleDebug
```
The APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`. Transfer this APK to any Android phone and install it!

---

## ⚡ Option 2: Build the APK Online using GitHub Actions (No Android Studio Needed!)

1. Push this project to your GitHub repository.
2. Go to the **Actions** tab in your GitHub repository.
3. Select the **Build Android APK** workflow.
4. Click **Run workflow** (or simply push a commit).
5. The workflow will automatically compile the APK using Java 17 and Gradle in ~3 minutes.
6. When complete, download the artifact **`FRIDAY-AI-Debug-APK`** containing your ready-to-install `.apk` file!

---

## 🛡️ Setting Up Friday Accessibility Service on Your Phone

When you open FRIDAY AI on your Android device for the first time:
1. You will see a banner: **"ANDROID ACCESSIBILITY SERVICE: Enable for hands-free WhatsApp, YouTube, and system gestures"**.
2. Tap **"Grant"** (or say aloud *"एक्सेसिबिलिटी परमिशन दो"*).
3. The phone will open **Settings ➔ Accessibility**.
4. Tap **Downloaded Apps / Installed Services** ➔ Select **FRIDAY AI** ➔ Toggle **ON**.
5. Return to FRIDAY AI. All deep hands-free automation features (voice back, home, recents, app switching) are now active!

---

## 🎙️ Native Android Voice Commands to Test

| Command (Hindi / English) | Native Android Action |
|---|---|
| **"यूट्यूब खोलो"** | Directly launches YouTube Android App (`com.google.android.youtube`) |
| **"यूट्यूब पर अरिजीत सिंह के गाने चलाओ"** | Searches & plays directly inside the YouTube App |
| **"व्हाट्सएप खोलो"** | Launches native WhatsApp (`com.whatsapp`) |
| **"व्हाट्सएप पर मैसेज भेजो [संदेश]"** | Pre-fills message directly in native WhatsApp |
| **"कैमरा खोलो"** | Launches device camera hardware (`ACTION_IMAGE_CAPTURE`) |
| **"ZArchiver खोलो" / "फाइल मैनेजर खोलो"** | Opens native file management tools |
| **"क्रोम में सर्च करो [विषय]"** | Opens specifically in Google Chrome (`com.android.chrome`) |
| **"अलार्म लगाओ 7 बजे"** | Sets real Android Clock alarm (`AlarmClock.ACTION_SET_ALARM`) |
| **"कॉल करो [नंबर]"** | Opens phone dialer (`ACTION_DIAL`) |
| **"होम स्क्रीन पर जाओ"** | Executes Android system HOME gesture |
| **"वापस आ जाओ"** | Closes background apps, plays return sound, brings AI to front |
