import { Capacitor, registerPlugin } from '@capacitor/core';

export interface OpenAppOptions {
  packageName: string;
  appName?: string;
  action?: string;
  uri?: string;
}

export interface OpenChromeOptions {
  url: string;
}

export interface YouTubeActionOptions {
  action: 'search' | 'play' | 'channel' | 'open';
  query?: string;
  videoId?: string;
}

export interface WhatsAppOptions {
  phoneNumber?: string;
  message?: string;
}

export interface PhoneCallOptions {
  phoneNumber: string;
}

export interface SetAlarmOptions {
  hour: number;
  minutes: number;
  title?: string;
  skipUi?: boolean;
}

export interface AccessibilityActionOptions {
  action: 'back' | 'home' | 'recents' | 'notifications' | 'quick_settings' | 'lock_screen';
}

export interface FridayNativeBridgePlugin {
  openApp(options: OpenAppOptions): Promise<{ success: boolean; message: string }>;
  openInChrome(options: OpenChromeOptions): Promise<{ success: boolean; message: string }>;
  executeYouTubeAction(options: YouTubeActionOptions): Promise<{ success: boolean; message: string }>;
  sendWhatsAppMessage(options: WhatsAppOptions): Promise<{ success: boolean; message: string }>;
  triggerPhoneCall(options: PhoneCallOptions): Promise<{ success: boolean; message: string }>;
  setAlarm(options: SetAlarmOptions): Promise<{ success: boolean; message: string }>;
  openCamera(): Promise<{ success: boolean; message: string }>;
  checkAccessibilityPermission(): Promise<{ isEnabled: boolean }>;
  requestAccessibilityPermission(): Promise<{ success: boolean; message: string }>;
  executeAccessibilityAction(options: AccessibilityActionOptions): Promise<{ success: boolean; message: string }>;
}

// Common Android package names for quick resolution
export const COMMON_ANDROID_PACKAGES: Record<string, { packageName: string; label: string; deepLink?: string }> = {
  whatsapp: { packageName: 'com.whatsapp', label: 'WhatsApp', deepLink: 'whatsapp://' },
  youtube: { packageName: 'com.google.android.youtube', label: 'YouTube', deepLink: 'vnd.youtube://' },
  chrome: { packageName: 'com.android.chrome', label: 'Google Chrome', deepLink: 'googlechrome://' },
  browser: { packageName: 'com.android.chrome', label: 'Google Chrome' },
  camera: { packageName: 'com.android.camera', label: 'Camera' },
  zarchiver: { packageName: 'ru.zdevs.zarchiver', label: 'ZArchiver' },
  files: { packageName: 'com.google.android.documentsui', label: 'File Manager' },
  filemanager: { packageName: 'com.google.android.documentsui', label: 'File Manager' },
  instagram: { packageName: 'com.instagram.android', label: 'Instagram', deepLink: 'instagram://' },
  spotify: { packageName: 'com.spotify.music', label: 'Spotify', deepLink: 'spotify://' },
  settings: { packageName: 'com.android.settings', label: 'Android Settings' },
  phone: { packageName: 'com.android.dialer', label: 'Phone Dialer' },
  dialer: { packageName: 'com.android.dialer', label: 'Phone Dialer' },
  messages: { packageName: 'com.google.android.apps.messaging', label: 'Messages' },
  maps: { packageName: 'com.google.android.apps.maps', label: 'Google Maps' },
  calculator: { packageName: 'com.google.android.calculator', label: 'Calculator' },
  gallery: { packageName: 'com.google.android.apps.photos', label: 'Photos / Gallery' },
  telegram: { packageName: 'org.telegram.messenger', label: 'Telegram', deepLink: 'tg://' },
  facebook: { packageName: 'com.facebook.katana', label: 'Facebook', deepLink: 'fb://' },
};

/**
 * Resolve friendly app name to Android Package Name
 */
export function resolvePackageName(query: string): { packageName: string; label: string } {
  const q = query.trim().toLowerCase();
  for (const [key, info] of Object.entries(COMMON_ANDROID_PACKAGES)) {
    if (q === key || q.includes(key) || key.includes(q)) {
      return { packageName: info.packageName, label: info.label };
    }
  }
  // If already looks like a package name (contains dot)
  if (query.includes('.')) {
    return { packageName: query.trim(), label: query.trim() };
  }
  return { packageName: query.trim(), label: query.trim() };
}

// Register Capacitor plugin
const FridayNativeBridge = registerPlugin<FridayNativeBridgePlugin>('FridayNativeBridge', {
  web: {
    async openApp(options: OpenAppOptions) {
      console.log('[Web Fallback] Open app requested:', options);
      const pkgInfo = resolvePackageName(options.packageName || options.appName || '');
      const common = COMMON_ANDROID_PACKAGES[pkgInfo.label.toLowerCase()];
      if (common?.deepLink) {
        window.location.href = common.deepLink;
      }
      return { success: true, message: `[Web Preview] Simulated launch of ${pkgInfo.label} (${pkgInfo.packageName})` };
    },
    async openInChrome(options: OpenChromeOptions) {
      console.log('[Web Fallback] Open in Chrome:', options.url);
      window.open(options.url, '_blank', 'noopener,noreferrer');
      return { success: true, message: `Opened ${options.url} in browser window` };
    },
    async executeYouTubeAction(options: YouTubeActionOptions) {
      console.log('[Web Fallback] YouTube action:', options);
      let url = 'https://www.youtube.com';
      if (options.action === 'search' && options.query) {
        url = `https://www.youtube.com/results?search_query=${encodeURIComponent(options.query)}`;
      } else if (options.action === 'play' && options.videoId) {
        url = `https://www.youtube.com/watch?v=${options.videoId}`;
      } else if (options.query) {
        url = `https://www.youtube.com/results?search_query=${encodeURIComponent(options.query)}`;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      return { success: true, message: `Executed YouTube action: ${options.action}` };
    },
    async sendWhatsAppMessage(options: WhatsAppOptions) {
      console.log('[Web Fallback] WhatsApp message:', options);
      const phone = (options.phoneNumber || '').replace(/[^0-9]/g, '');
      const text = encodeURIComponent(options.message || '');
      const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://web.whatsapp.com/send?text=${text}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      return { success: true, message: `Launched WhatsApp intent` };
    },
    async triggerPhoneCall(options: PhoneCallOptions) {
      console.log('[Web Fallback] Phone call:', options.phoneNumber);
      window.location.href = `tel:${options.phoneNumber}`;
      return { success: true, message: `Opened dialer for ${options.phoneNumber}` };
    },
    async setAlarm(options: SetAlarmOptions) {
      console.log('[Web Fallback] Set alarm:', options);
      return { success: true, message: `Alarm set for ${options.hour}:${options.minutes.toString().padStart(2, '0')}` };
    },
    async openCamera() {
      console.log('[Web Fallback] Open camera');
      return { success: true, message: 'Camera intent triggered' };
    },
    async checkAccessibilityPermission() {
      // In web browser preview mode
      return { isEnabled: false };
    },
    async requestAccessibilityPermission() {
      console.log('[Web Fallback] Requesting accessibility permission (simulated)');
      return { success: true, message: 'Opening Android Accessibility Settings screen' };
    },
    async executeAccessibilityAction(options: AccessibilityActionOptions) {
      console.log('[Web Fallback] Accessibility action:', options.action);
      if (options.action === 'back') {
        window.history.back();
      }
      return { success: true, message: `Executed global action: ${options.action}` };
    },
  },
});

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

export default FridayNativeBridge;
