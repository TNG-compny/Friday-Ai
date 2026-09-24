export type SessionState =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'error';

export type AtmosphereTheme =
  | 'hologram-cyan'
  | 'cyberpunk-magenta'
  | 'neon-crimson'
  | 'matrix-emerald'
  | 'electric-amber'
  | 'stealth-violet';

export interface ThemeConfig {
  id: AtmosphereTheme;
  name: string;
  primary: string; // e.g. '#00f2fe'
  secondary: string; // e.g. '#4facfe'
  glow: string; // rgba string
  accentBg: string; // tailwind class
  badgeColor: string;
  ringColor: string;
}

export interface HudTimer {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  active: boolean;
}

export interface ToolActionNotification {
  id: string;
  toolName: string;
  title: string;
  details?: string;
  url?: string;
  mood?: string;
  timestamp: number;
}

export interface LiveTelemetry {
  latencyMs: number;
  model: string;
  voice: string;
  sampleRateIn: number;
  sampleRateOut: number;
  packetsSent: number;
  packetsReceived: number;
}
