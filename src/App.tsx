import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Sparkles,
  Volume2,
  Mic,
  Activity,
  Zap,
} from 'lucide-react';
import {
  SessionState,
  AtmosphereTheme,
  HudTimer,
  ToolActionNotification,
  LiveTelemetry,
} from './types';
import { ATMOSPHERE_THEMES } from './lib/themes';
import { AudioStreamer } from './lib/audio-streamer';
import { LiveSession } from './lib/live-session';
import { FridayCore } from './components/FridayCore';
import { HudTopBar } from './components/HudTopBar';
import { HudNotifications } from './components/HudNotifications';
import { QuickVoicePrompts } from './components/QuickVoicePrompts';
import { LockScreenOverlay } from './components/LockScreenOverlay';
import { AccessibilityBanner } from './components/AccessibilityBanner';
import { playWarpReturnSound } from './lib/sound-effects';
import FridayNativeBridge, { isNativePlatform, resolvePackageName } from './lib/friday-native-bridge';

export default function App() {
  const [sessionState, setSessionState] = useState<SessionState>('disconnected');
  const [currentThemeId, setCurrentThemeId] = useState<AtmosphereTheme>('hologram-cyan');
  const [selectedVoice, setSelectedVoice] = useState<string>('Aoede');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isScreenLocked, setIsScreenLocked] = useState<boolean>(false);
  const [isScreenOff, setIsScreenOff] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAccessibilityBanner, setShowAccessibilityBanner] = useState<boolean>(false);

  // Check Android Accessibility Service on initial load
  useEffect(() => {
    FridayNativeBridge.checkAccessibilityPermission()
      .then((res) => {
        if (!res.isEnabled) {
          setShowAccessibilityBanner(true);
        }
      })
      .catch((err) => console.warn('[Friday] Accessibility check error:', err));
  }, []);

  // Reference to all child tabs/windows opened by Friday in Chrome
  const openedWindowsRef = useRef<Window[]>([]);
  const lastReturnTimeRef = useRef<number>(0);
  const lastOpenedUrlRef = useRef<{ url: string; time: number }>({ url: '', time: 0 });

  // Instant Return to AI page: closes opened tabs, plays return sound, no popup animation
  const triggerReturnToAiPage = useCallback((reason?: string) => {
    const now = Date.now();
    // Debounce to prevent multiple triggers within 1 second
    if (now - lastReturnTimeRef.current < 1000) {
      return;
    }
    lastReturnTimeRef.current = now;

    console.log('[Friday App] ⚡ Instant Return triggered. Reason:', reason);

    // 1. Play return sound ONLY (as requested: "सिर्फ और सिर्फ साउंड ही आए एनिमेशन ना दिखे")
    playWarpReturnSound();

    // 2. Close any child website tab/window opened by Friday immediately
    if (openedWindowsRef.current.length > 0) {
      openedWindowsRef.current.forEach((win) => {
        try {
          if (win && !win.closed) {
            win.close();
          }
        } catch (err) {
          console.warn('[Friday] Error closing opened window:', err);
        }
      });
      openedWindowsRef.current = [];
    }

    // 3. If native Android, perform Accessibility action BACK to return to Friday
    if (isNativePlatform()) {
      FridayNativeBridge.executeAccessibilityAction({ action: 'back' }).catch(() => {});
    }

    // 4. Bring window focus back to Friday tab
    try {
      window.focus();
    } catch {}

    // 5. Clear notifications so the AI screen is pristine
    setNotifications([]);

    // 6. Ensure screen is active and unlocked
    setIsScreenLocked(false);
    setIsScreenOff(false);
  }, []);

  // Instant Website Opener in Chrome
  const openWebsiteInChrome = useCallback((rawUrl: string, rawLabel?: string) => {
    let finalUrl = (rawUrl || '').trim();
    if (finalUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = `https://${finalUrl}`;
    }
    const displayLabel = rawLabel || finalUrl;

    const now = Date.now();
    // Debounce duplicate open calls within 2 seconds
    if (lastOpenedUrlRef.current.url === finalUrl && now - lastOpenedUrlRef.current.time < 2000) {
      return;
    }
    lastOpenedUrlRef.current = { url: finalUrl, time: now };

    console.log('[Friday App] ⚡ Instant Opening URL:', finalUrl);

    let opened = false;
    // If native Android app, use explicit Chrome Intent
    if (isNativePlatform()) {
      FridayNativeBridge.openInChrome({ url: finalUrl }).catch((err) => {
        console.warn('[Friday Native] openInChrome fallback:', err);
      });
      opened = true;
    } else {
      try {
        const win = window.open(finalUrl, '_blank');
        if (win) {
          openedWindowsRef.current.push(win);
          opened = true;
        }
      } catch (e) {
        console.warn('[Chrome] Window open restricted by browser:', e);
      }
    }

    const notifId = `notif-${Date.now()}`;
    setNotifications([
      {
        id: notifId,
        toolName: 'openWebsite',
        title: `Opened: ${displayLabel}`,
        details: opened
          ? 'Link opened in Google Chrome.'
          : 'Click below if popups are blocked in Chrome.',
        url: finalUrl,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  // Audio level monitoring states for UI visual feedback
  const [inputLevel, setInputLevel] = useState<number>(0);
  const [outputLevel, setOutputLevel] = useState<number>(0);

  // Telemetry & diagnostics
  const [telemetry, setTelemetry] = useState<LiveTelemetry>({
    latencyMs: 0,
    model: 'gemini-3.1-flash-live-preview',
    voice: 'Aoede',
    sampleRateIn: 16000,
    sampleRateOut: 24000,
    packetsSent: 0,
    packetsReceived: 0,
  });

  // Action notifications & active timers
  const [notifications, setNotifications] = useState<ToolActionNotification[]>([]);
  const [timers, setTimers] = useState<HudTimer[]>([]);

  const theme = ATMOSPHERE_THEMES[currentThemeId] || ATMOSPHERE_THEMES['hologram-cyan'];

  // References for singletons to avoid re-renders
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const levelAnimFrameRef = useRef<number | null>(null);

  // Sound effect generator for timer completion
  const playChime = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }, []);

  // Timer countdown ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) =>
        prev
          .map((t) => {
            if (t.remainingSeconds > 0) {
              const updated = t.remainingSeconds - 1;
              if (updated === 0) playChime();
              return { ...t, remainingSeconds: updated };
            }
            return t;
          })
          .filter((t) => t.remainingSeconds >= 0)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [playChime]);

  // Audio level monitoring loop
  const startLevelMonitoring = useCallback(() => {
    if (levelAnimFrameRef.current) cancelAnimationFrame(levelAnimFrameRef.current);

    const updateLevels = () => {
      if (audioStreamerRef.current) {
        const inLvl = audioStreamerRef.current.getInputLevel();
        const outLvl = audioStreamerRef.current.getOutputLevel();
        setInputLevel(inLvl);
        setOutputLevel(outLvl);
      }
      levelAnimFrameRef.current = requestAnimationFrame(updateLevels);
    };

    levelAnimFrameRef.current = requestAnimationFrame(updateLevels);
  }, []);

  const stopLevelMonitoring = useCallback(() => {
    if (levelAnimFrameRef.current) {
      cancelAnimationFrame(levelAnimFrameRef.current);
      levelAnimFrameRef.current = null;
    }
    setInputLevel(0);
    setOutputLevel(0);
  }, []);

  // Handle function/tool calls from Gemini
  const handleToolCall = useCallback(
    async (toolCall: any) => {
      console.log('[Friday App] Processing tool call:', toolCall);
      const functionCalls = toolCall?.functionCalls || [];
      const functionResponses: any[] = [];

      for (const call of functionCalls) {
        const { id, name, args } = call;

        if (name === 'returnToAiPage') {
          triggerReturnToAiPage(args?.reason || 'User voice command');

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'returned_to_ai_page',
                action: 'warp_return_executed',
                soundPlayed: true,
                message: 'Successfully returned to the main Friday AI screen with warp animation and sound.',
              },
            },
          });
        } else if (name === 'openWebsite') {
          const url = (args?.url || '').trim();
          const label = args?.label || url;

          openWebsiteInChrome(url, label);

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'success',
                message: `Opened ${label} at ${url} in Google Chrome.`,
                urlOpened: url,
              },
            },
          });
        } else if (name === 'openApp') {
          const pkgInput = (args?.packageName || args?.appName || '').trim();
          const resolved = resolvePackageName(pkgInput);
          const appLabel = args?.appName || resolved.label;

          FridayNativeBridge.openApp({ packageName: resolved.packageName, appName: appLabel })
            .then((res) => {
              console.log('[Friday Native] openApp result:', res);
            })
            .catch((err) => {
              console.warn('[Friday Native] openApp error:', err);
            });

          const notifId = `notif-app-${Date.now()}`;
          setNotifications([
            {
              id: notifId,
              toolName: 'openApp',
              title: `Native App: ${appLabel}`,
              details: `Launched ${resolved.packageName} directly on device.`,
              timestamp: Date.now(),
            },
          ]);

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'launched',
                packageName: resolved.packageName,
                appName: appLabel,
              },
            },
          });
        } else if (name === 'executeYouTubeAction') {
          const action = (args?.action || 'search') as 'search' | 'play';
          const query = (args?.query || '').trim();
          const videoId = (args?.videoId || '').trim();

          FridayNativeBridge.executeYouTubeAction({ action, query, videoId })
            .catch((err) => console.warn('[Friday Native] YouTube action error:', err));

          const notifId = `notif-yt-${Date.now()}`;
          setNotifications([
            {
              id: notifId,
              toolName: 'executeYouTubeAction',
              title: `YouTube: ${action.toUpperCase()}`,
              details: query ? `Searching: "${query}"` : `Playing video: ${videoId}`,
              timestamp: Date.now(),
            },
          ]);

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'executed',
                action,
                query: query || videoId,
              },
            },
          });
        } else if (name === 'sendWhatsAppMessage') {
          const phoneNumber = (args?.phoneNumber || '').trim();
          const message = (args?.message || '').trim();

          FridayNativeBridge.sendWhatsAppMessage({ phoneNumber, message })
            .catch((err) => console.warn('[Friday Native] WhatsApp error:', err));

          const notifId = `notif-wa-${Date.now()}`;
          setNotifications([
            {
              id: notifId,
              toolName: 'sendWhatsAppMessage',
              title: 'WhatsApp Message',
              details: phoneNumber ? `To: ${phoneNumber} - "${message}"` : `Message: "${message}"`,
              timestamp: Date.now(),
            },
          ]);

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'message_sent',
                phoneNumber,
                message,
              },
            },
          });
        } else if (name === 'triggerPhoneCall') {
          const phoneNumber = (args?.phoneNumber || '').trim();

          FridayNativeBridge.triggerPhoneCall({ phoneNumber })
            .catch((err) => console.warn('[Friday Native] Phone call error:', err));

          const notifId = `notif-call-${Date.now()}`;
          setNotifications([
            {
              id: notifId,
              toolName: 'triggerPhoneCall',
              title: 'Phone Call',
              details: `Dialing: ${phoneNumber}`,
              timestamp: Date.now(),
            },
          ]);

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'dialing',
                phoneNumber,
              },
            },
          });
        } else if (name === 'setAlarm') {
          const hour = Math.max(0, Math.min(23, Number(args?.hour) || 0));
          const minutes = Math.max(0, Math.min(59, Number(args?.minutes) || 0));
          const title = (args?.title || 'Friday AI Alarm').trim();

          FridayNativeBridge.setAlarm({ hour, minutes, title })
            .catch((err) => console.warn('[Friday Native] Alarm error:', err));

          const notifId = `notif-alarm-${Date.now()}`;
          setNotifications([
            {
              id: notifId,
              toolName: 'setAlarm',
              title: 'Device Alarm Set',
              details: `${title} set for ${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
              timestamp: Date.now(),
            },
          ]);

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'alarm_set',
                time: `${hour}:${minutes}`,
                title,
              },
            },
          });
        } else if (name === 'openCamera') {
          FridayNativeBridge.openCamera()
            .catch((err) => console.warn('[Friday Native] Camera error:', err));

          const notifId = `notif-cam-${Date.now()}`;
          setNotifications([
            {
              id: notifId,
              toolName: 'openCamera',
              title: 'Device Camera',
              details: 'Native camera hardware interface launched.',
              timestamp: Date.now(),
            },
          ]);

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'camera_opened',
              },
            },
          });
        } else if (name === 'requestAccessibilityPermission') {
          FridayNativeBridge.requestAccessibilityPermission()
            .catch((err) => console.warn('[Friday Native] Accessibility error:', err));

          const notifId = `notif-access-${Date.now()}`;
          setNotifications([
            {
              id: notifId,
              toolName: 'requestAccessibilityPermission',
              title: 'Accessibility Setup',
              details: 'Opening Android Accessibility Settings to grant FRIDAY AI permissions.',
              timestamp: Date.now(),
            },
          ]);

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'settings_opened',
              },
            },
          });
        } else if (name === 'executeSystemAction') {
          const action = (args?.action || 'back') as any;

          FridayNativeBridge.executeAccessibilityAction({ action })
            .catch((err) => console.warn('[Friday Native] System action error:', err));

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'executed',
                action,
              },
            },
          });
        } else if (name === 'changeAtmosphere') {
          const requestedTheme = (args?.theme || '') as AtmosphereTheme;
          if (ATMOSPHERE_THEMES[requestedTheme]) {
            setCurrentThemeId(requestedTheme);
            const notifId = `theme-${Date.now()}`;
            setNotifications((prev) => [
              {
                id: notifId,
                toolName: 'changeAtmosphere',
                title: 'Atmosphere Shifted',
                details: `Core visuals calibrated to ${ATMOSPHERE_THEMES[requestedTheme].name}.`,
                timestamp: Date.now(),
              },
              ...prev.slice(0, 4),
            ]);
            functionResponses.push({
              id,
              name,
              response: {
                output: {
                  status: 'success',
                  currentAtmosphere: requestedTheme,
                },
              },
            });
          } else {
            functionResponses.push({
              id,
              name,
              response: {
                output: {
                  status: 'fallback',
                  message: `Unknown theme. Keeping ${currentThemeId}`,
                },
              },
            });
          }
        } else if (name === 'setTimer') {
          const seconds = Math.max(5, Math.round(Number(args?.seconds) || 60));
          const label = (args?.label || 'HUD Timer').trim();
          const timerId = `timer-${Date.now()}`;

          setTimers((prev) => [
            ...prev,
            {
              id: timerId,
              label,
              totalSeconds: seconds,
              remainingSeconds: seconds,
              active: true,
            },
          ]);

          const notifId = `notif-timer-${Date.now()}`;
          setNotifications((prev) => [
            {
              id: notifId,
              toolName: 'setTimer',
              title: `Timer Set: ${label}`,
              details: `Countdown initialized for ${seconds} seconds.`,
              timestamp: Date.now(),
            },
            ...prev.slice(0, 4),
          ]);

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'timer_active',
                seconds,
                label,
              },
            },
          });
        } else if (name === 'getSystemStatus') {
          const now = new Date();
          functionResponses.push({
            id,
            name,
            response: {
              output: {
                localTime: now.toLocaleTimeString(),
                localDate: now.toLocaleDateString(),
                activeTheme: currentThemeId,
                status: 'all_systems_optimal',
              },
            },
          });
        } else if (name === 'turnOffScreen') {
          setIsScreenOff(true);
          setIsScreenLocked(true);
          const notifId = `off-${Date.now()}`;
          setNotifications((prev) => [
            {
              id: notifId,
              toolName: 'turnOffScreen',
              title: 'Screen Turned Off',
              details: 'OLED pitch-black sleep mode active. Voice listener running.',
              timestamp: Date.now(),
            },
            ...prev.slice(0, 4),
          ]);

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'screen_off',
                mode: 'oled_blackout',
                message: 'Screen is now completely turned off. Still listening in the background.',
              },
            },
          });
        } else if (name === 'turnOnScreen') {
          setIsScreenOff(false);
          setIsScreenLocked(true);
          const notifId = `on-${Date.now()}`;
          setNotifications((prev) => [
            {
              id: notifId,
              toolName: 'turnOnScreen',
              title: 'Screen Turned On',
              details: 'Device awake. Awaiting password / PIN entry.',
              timestamp: Date.now(),
            },
            ...prev.slice(0, 4),
          ]);

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'screen_on',
                message: 'Screen is turned back on. Displaying password/PIN entry pad for user.',
              },
            },
          });
        } else if (name === 'lockScreen') {
          setIsScreenLocked(true);
          setIsScreenOff(false);
          const notifId = `lock-${Date.now()}`;
          setNotifications((prev) => [
            {
              id: notifId,
              toolName: 'lockScreen',
              title: 'Screen Locked',
              details: 'Stealth password & biometric lock screen mode activated.',
              timestamp: Date.now(),
            },
            ...prev.slice(0, 4),
          ]);

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'screen_locked',
                mode: 'password_pin_pad',
                message: 'Screen is now locked. User can enter password/PIN or use biometric to unlock.',
              },
            },
          });
        } else if (name === 'unlockScreen') {
          setIsScreenLocked(false);
          setIsScreenOff(false);
          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'screen_unlocked',
                message: 'Welcome back, screen unlocked.',
              },
            },
          });
        } else if (name === 'showTeasingHUD') {
          const text = args?.text || 'Hey you!';
          const mood = args?.mood || 'witty';
          const notifId = `tease-${Date.now()}`;

          setNotifications((prev) => [
            {
              id: notifId,
              toolName: 'showTeasingHUD',
              title: 'Friday Note',
              details: text,
              mood,
              timestamp: Date.now(),
            },
            ...prev.slice(0, 4),
          ]);

          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'displayed_on_hud',
              },
            },
          });
        } else {
          // Generic handler for unanticipated tool
          functionResponses.push({
            id,
            name,
            response: {
              output: {
                status: 'executed',
              },
            },
          });
        }
      }

      // Send all tool responses instantly back to Gemini Live
      if (liveSessionRef.current && functionResponses.length > 0) {
        liveSessionRef.current.sendToolResponse(functionResponses);
      }
    },
    [currentThemeId, triggerReturnToAiPage, openWebsiteInChrome]
  );

  // ⚡ Parallel Instant Voice Command Reactor (runs locally on Chrome with 0ms network delay)
  useEffect(() => {
    if (sessionState === 'disconnected') return;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    let recognition: any = null;
    let isMounted = true;

    try {
      recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'hi-IN';

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = (event.results[i][0]?.transcript || '').trim().toLowerCase();
          if (!transcript) continue;

          // ⚡ Instant Return (<50ms)
          if (
            transcript.includes('वापस') ||
            transcript.includes('वापिस') ||
            transcript.includes('back') ||
            transcript.includes('return') ||
            transcript.includes('ai page') ||
            transcript.includes('एआई पेज') ||
            transcript.includes('स्क्रीन पर')
          ) {
            triggerReturnToAiPage('Instant local voice trigger: ' + transcript);
            break;
          }

          // ⚡ Instant Native App & Web Launchers (<60ms)
          if (transcript.includes('यूट्यूब') || transcript.includes('youtube')) {
            if (transcript.includes('क्रोम') || transcript.includes('chrome')) {
              openWebsiteInChrome('https://www.youtube.com', 'YouTube');
            } else {
              FridayNativeBridge.openApp({ packageName: 'com.google.android.youtube', appName: 'YouTube' });
            }
            break;
          } else if (transcript.includes('व्हाट्सएप') || transcript.includes('whatsapp')) {
            FridayNativeBridge.openApp({ packageName: 'com.whatsapp', appName: 'WhatsApp' });
            break;
          } else if (transcript.includes('कैमरा') || transcript.includes('camera')) {
            FridayNativeBridge.openCamera();
            break;
          } else if (transcript.includes('zarchiver')) {
            FridayNativeBridge.openApp({ packageName: 'ru.zdevs.zarchiver', appName: 'ZArchiver' });
            break;
          } else if (transcript.includes('फाइल') || transcript.includes('files')) {
            FridayNativeBridge.openApp({ packageName: 'com.google.android.documentsui', appName: 'File Manager' });
            break;
          } else if (transcript.includes('फेसबुक') || transcript.includes('facebook')) {
            FridayNativeBridge.openApp({ packageName: 'com.facebook.katana', appName: 'Facebook' });
            break;
          } else if (transcript.includes('इंस्टाग्राम') || transcript.includes('instagram')) {
            FridayNativeBridge.openApp({ packageName: 'com.instagram.android', appName: 'Instagram' });
            break;
          } else if (transcript.includes('क्रोम') || transcript.includes('chrome') || transcript.includes('uptodown')) {
            openWebsiteInChrome('https://en.uptodown.com', 'Uptodown');
            break;
          }
        }
      };

      recognition.onerror = (e: any) => {
        // Non-fatal, Gemini Live stream remains primary
        console.warn('[Friday LocalVoice] Note:', e?.error);
      };

      recognition.onend = () => {
        if (isMounted) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('[Friday LocalVoice] SpeechRecognition inactive:', err);
    }

    return () => {
      isMounted = false;
      if (recognition) {
        try {
          recognition.stop();
        } catch {}
      }
    };
  }, [sessionState, triggerReturnToAiPage, openWebsiteInChrome]);

  // Initialize and start voice conversation
  const connectSession = useCallback(async () => {
    setErrorMessage(null);
    try {
      // 1. Initialize audio capture and playback streamer
      if (!audioStreamerRef.current) {
        audioStreamerRef.current = new AudioStreamer({
          onAudioData: (base64Audio) => {
            if (liveSessionRef.current) {
              liveSessionRef.current.sendAudio(base64Audio);
            }
          },
          onPlaybackStateChange: (isPlaying) => {
            if (isPlaying) {
              setSessionState('speaking');
            } else {
              setSessionState('listening');
            }
          },
        });
      }

      await audioStreamerRef.current.start();
      startLevelMonitoring();

      // 2. Initialize Gemini Live session over WebSocket
      if (!liveSessionRef.current) {
        liveSessionRef.current = new LiveSession({
          onStateChange: (newState) => {
            setSessionState(newState);
          },
          onAudioChunk: (base64Audio) => {
            if (audioStreamerRef.current) {
              audioStreamerRef.current.playAudioChunk(base64Audio);
            }
          },
          onInterrupted: () => {
            console.log('[Friday App] Model interrupted by user speech');
            if (audioStreamerRef.current) {
              audioStreamerRef.current.interrupt();
            }
            setSessionState('listening');
          },
          onTurnComplete: () => {
            // Turn completed, ready for next user speech
          },
          onToolCall: (toolCall) => {
            handleToolCall(toolCall);
          },
          onError: (err) => {
            setErrorMessage(err);
            setSessionState('error');
          },
          onTelemetryUpdate: (newTelem) => {
            setTelemetry((prev) => ({ ...prev, ...newTelem }));
          },
        });
      }

      liveSessionRef.current.connect(selectedVoice);
    } catch (err: any) {
      console.error('[Friday App] Failed to connect:', err);
      setErrorMessage(
        err?.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access to talk to Friday.'
          : err?.message || 'Failed to initialize microphone or voice connection.'
      );
      setSessionState('error');
    }
  }, [handleToolCall, selectedVoice, startLevelMonitoring]);

  // Disconnect voice session
  const disconnectSession = useCallback(() => {
    stopLevelMonitoring();

    if (audioStreamerRef.current) {
      audioStreamerRef.current.stop();
      audioStreamerRef.current = null;
    }

    if (liveSessionRef.current) {
      liveSessionRef.current.disconnect();
      liveSessionRef.current = null;
    }

    setSessionState('disconnected');
    setIsMuted(false);
  }, [stopLevelMonitoring]);

  // Toggle central power / connection
  const handleTogglePower = useCallback(() => {
    if (sessionState === 'disconnected' || sessionState === 'error') {
      connectSession();
    } else if (sessionState === 'speaking') {
      // Tapping core while speaking acts as instant interruption
      if (audioStreamerRef.current) {
        audioStreamerRef.current.interrupt();
      }
      setSessionState('listening');
    } else {
      disconnectSession();
    }
  }, [sessionState, connectSession, disconnectSession]);

  // Toggle microphone mute
  const handleToggleMute = useCallback(() => {
    if (!audioStreamerRef.current) return;
    const nextMuted = !isMuted;
    audioStreamerRef.current.setMuted(nextMuted);
    setIsMuted(nextMuted);
  }, [isMuted]);

  // Change voice
  const handleSelectVoice = useCallback(
    (voiceName: string) => {
      setSelectedVoice(voiceName);
      if (liveSessionRef.current && sessionState !== 'disconnected') {
        liveSessionRef.current.changeVoice(voiceName);
      }
    },
    [sessionState]
  );

  return (
    <div
      className="relative w-screen h-screen overflow-hidden flex flex-col justify-between bg-[#07090e] font-['Plus_Jakarta_Sans'] text-slate-100 select-none"
      style={{
        backgroundImage: `radial-gradient(ellipse at 50% 50%, ${theme.glow.replace(
          '0.45',
          '0.14'
        )} 0%, rgba(7, 9, 14, 0.98) 75%)`,
      }}
    >
      {/* Subtle futuristic matrix grid background lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Lock Screen Overlay (triggered by voice 'screen off kar do', 'screen on kar do', etc.) */}
      <LockScreenOverlay
        isLocked={isScreenLocked}
        isScreenOff={isScreenOff}
        theme={theme}
        onUnlock={() => {
          setIsScreenLocked(false);
          setIsScreenOff(false);
        }}
        onTurnOffScreen={() => {
          setIsScreenOff(true);
          setIsScreenLocked(true);
        }}
        onTurnOnScreen={() => {
          setIsScreenOff(false);
          setIsScreenLocked(true);
        }}
      />

      {/* Top HUD Bar */}
      <HudTopBar
        state={sessionState}
        theme={theme}
        telemetry={telemetry}
        selectedVoice={selectedVoice}
        onSelectTheme={(tId) => setCurrentThemeId(tId)}
        onSelectVoice={handleSelectVoice}
      />

      {/* Android Accessibility Service Permission Banner */}
      {showAccessibilityBanner && (
        <div className="relative z-20 px-4">
          <AccessibilityBanner
            theme={theme}
            onEnable={() => {
              FridayNativeBridge.requestAccessibilityPermission();
            }}
            onDismiss={() => setShowAccessibilityBanner(false)}
          />
        </div>
      )}

      {/* Dynamic Notifications & Active Timers Overlay */}
      <HudNotifications
        notifications={notifications}
        timers={timers}
        theme={theme}
        onDismissNotification={(id) =>
          setNotifications((prev) => prev.filter((n) => n.id !== id))
        }
        onCancelTimer={(id) =>
          setTimers((prev) => prev.filter((t) => t.id !== id))
        }
      />

      {/* Main Center Stage: Friday Cyber Core & Waveform */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-2">
        {/* Error Notification Banner */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 z-40 max-w-md w-full mx-4 p-3.5 rounded-xl border border-rose-500/40 bg-rose-950/80 backdrop-blur-md shadow-2xl flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-semibold text-rose-200">Connection Error</p>
                <p className="text-rose-300/80 mt-0.5">{errorMessage}</p>
                <button
                  onClick={connectSession}
                  className="mt-2 px-3 py-1 bg-rose-500 hover:bg-rose-400 text-black font-semibold rounded-md text-[11px] transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Central Visual AI Core */}
        <FridayCore
          state={sessionState}
          theme={theme}
          inputLevel={inputLevel}
          outputLevel={outputLevel}
          isMuted={isMuted}
          onTogglePower={handleTogglePower}
          onToggleMute={handleToggleMute}
        />

        {/* Real-time Subtitle / Voice Status Indicator */}
        <div className="mt-14 flex flex-col items-center text-center">
          <div className="flex items-center gap-2">
            {sessionState === 'listening' && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-950/30 text-emerald-400 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>FRIDAY IS LISTENING...</span>
              </div>
            )}

            {sessionState === 'speaking' && (
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono shadow-sm"
                style={{
                  borderColor: `${theme.primary}60`,
                  backgroundColor: `${theme.primary}20`,
                  color: theme.primary,
                }}
              >
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                <span>FRIDAY IS SPEAKING</span>
              </div>
            )}

            {sessionState === 'connecting' && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-950/30 text-amber-400 text-xs font-mono">
                <Zap className="w-3.5 h-3.5 animate-spin" />
                <span>SYNCING NEURAL AUDIO LINK...</span>
              </div>
            )}

            {sessionState === 'disconnected' && (
              <span className="text-xs font-mono tracking-wider text-slate-400">
                TAP SPHERE TO TALK WITH FRIDAY
              </span>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Footer: Quick Voice Prompts & Live Audio Meter */}
      <footer className="relative z-20 pb-4 pt-2 flex flex-col items-center gap-2">
        {/* Voice Inspiration Starters */}
        <QuickVoicePrompts
          theme={theme}
          isConnected={sessionState !== 'disconnected'}
        />

        {/* Live Audio Activity Waveform Bar */}
        <div className="w-48 sm:w-64 h-1.5 bg-white/5 rounded-full overflow-hidden flex items-center justify-center p-0.5 border border-white/5">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${Math.max(
                4,
                (sessionState === 'speaking' ? outputLevel : inputLevel) * 100
              )}%`,
              backgroundColor:
                sessionState === 'speaking'
                  ? theme.primary
                  : sessionState === 'listening'
                  ? '#10b981'
                  : '#475569',
              boxShadow: `0 0 10px ${theme.glow}`,
            }}
          />
        </div>

        <div className="text-[10px] font-mono tracking-widest text-slate-500 flex items-center gap-2">
          <span>GEMINI LIVE AUDIO-TO-AUDIO</span>
          <span>•</span>
          <span>TOOL CALL READY</span>
        </div>
      </footer>
    </div>
  );
}
