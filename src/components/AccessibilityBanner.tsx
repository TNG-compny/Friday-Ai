import React from 'react';
import { ShieldAlert, ChevronRight, X, Cpu } from 'lucide-react';
import { ThemeConfig } from '../types';

interface AccessibilityBannerProps {
  theme: ThemeConfig;
  onEnable: () => void;
  onDismiss: () => void;
}

export function AccessibilityBanner({ theme, onEnable, onDismiss }: AccessibilityBannerProps) {
  return (
    <div
      className="w-full max-w-xl mx-auto my-2 px-4 py-2.5 rounded-xl border backdrop-blur-md flex items-center justify-between gap-3 text-xs shadow-lg animate-fade-in"
      style={{
        borderColor: `${theme.primary}50`,
        backgroundColor: `${theme.primary}12`,
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="p-1.5 rounded-lg flex-shrink-0"
          style={{ backgroundColor: `${theme.primary}25` }}
        >
          <Cpu className="w-4 h-4" style={{ color: theme.primary }} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-white truncate flex items-center gap-1.5 font-mono">
            <span>ANDROID ACCESSIBILITY SERVICE</span>
            <span
              className="text-[9px] uppercase px-1 py-0.2 rounded"
              style={{ backgroundColor: `${theme.primary}30`, color: theme.primary }}
            >
              NATIVE
            </span>
          </div>
          <div className="text-[11px] text-slate-300 truncate">
            Enable for hands-free WhatsApp, YouTube, and system gestures
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onEnable}
          className="px-2.5 py-1 rounded-lg font-mono font-bold text-[11px] flex items-center gap-1 transition-all hover:scale-105 active:scale-95 text-black"
          style={{
            backgroundColor: theme.primary,
          }}
        >
          <span>Grant</span>
          <ChevronRight className="w-3 h-3" />
        </button>
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
