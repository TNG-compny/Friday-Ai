import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ExternalLink,
  Timer,
  CheckCircle,
  X,
  Sparkles,
  Zap,
  Globe,
} from 'lucide-react';
import { HudTimer, ToolActionNotification, ThemeConfig } from '../types';

interface HudNotificationsProps {
  notifications: ToolActionNotification[];
  timers: HudTimer[];
  theme: ThemeConfig;
  onDismissNotification: (id: string) => void;
  onCancelTimer: (id: string) => void;
}

export function HudNotifications({
  notifications,
  timers,
  theme,
  onDismissNotification,
  onCancelTimer,
}: HudNotificationsProps) {
  // Auto-dismiss notifications after 6 seconds so cards don't clutter the screen
  useEffect(() => {
    if (notifications.length === 0) return;
    const latestNotif = notifications[0];
    const timer = setTimeout(() => {
      onDismissNotification(latestNotif.id);
    }, 6000);
    return () => clearTimeout(timer);
  }, [notifications, onDismissNotification]);

  // Format seconds into mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Keep strictly 1 latest notification on screen
  const visibleNotifications = notifications.slice(0, 1);

  return (
    <div className="fixed top-16 right-4 sm:right-6 z-40 max-w-sm w-full pointer-events-none flex flex-col gap-2.5">
      {/* Active Timers */}
      <AnimatePresence>
        {timers.map((t) => {
          const progress = Math.max(
            0,
            Math.min(100, (t.remainingSeconds / t.totalSeconds) * 100)
          );
          const isDone = t.remainingSeconds <= 0;

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className="pointer-events-auto p-3.5 rounded-xl border backdrop-blur-xl shadow-2xl relative overflow-hidden bg-slate-900/90 border-slate-700"
              style={{
                boxShadow: isDone
                  ? `0 0 30px ${theme.glow}`
                  : '0 10px 25px rgba(0,0,0,0.5)',
              }}
            >
              {/* Top Bar: Label & Cancel */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Timer
                    className={`w-4 h-4 ${
                      isDone ? 'text-emerald-400 animate-bounce' : 'text-slate-400'
                    }`}
                  />
                  <span className="text-xs font-semibold text-white tracking-wide truncate max-w-[170px]">
                    {t.label || 'HUD Timer'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-sm font-bold ${
                      isDone ? 'text-emerald-400' : 'text-white'
                    }`}
                  >
                    {isDone ? 'TIME IS UP!' : formatTime(t.remainingSeconds)}
                  </span>
                  <button
                    onClick={() => onCancelTimer(t.id)}
                    className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Countdown Progress Bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: isDone ? '#10b981' : theme.primary,
                  }}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Tool Call & Action Notification Cards */}
      <AnimatePresence>
        {visibleNotifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.92 }}
            className="pointer-events-auto p-4 rounded-xl border backdrop-blur-xl shadow-2xl relative bg-slate-900/90 border-slate-700/80"
            style={{
              borderColor: `${theme.primary}60`,
              boxShadow: `0 8px 30px ${theme.glow}`,
            }}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="p-1.5 rounded-lg border flex items-center justify-center"
                  style={{
                    borderColor: `${theme.primary}40`,
                    backgroundColor: `${theme.primary}20`,
                    color: theme.primary,
                  }}
                >
                  {n.toolName === 'openWebsite' ? (
                    <Globe className="w-4 h-4" />
                  ) : n.toolName === 'changeAtmosphere' ? (
                    <Zap className="w-4 h-4" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">
                    {n.title}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">
                    CHROME LINK EXECUTED
                  </span>
                </div>
              </div>

              <button
                onClick={() => onDismissNotification(n.id)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {n.details && (
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {n.details}
              </p>
            )}

            {n.url && (
              <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 font-mono truncate max-w-[170px]">
                  {n.url}
                </span>
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all text-black hover:opacity-90 shadow-lg active:scale-95"
                  style={{ backgroundColor: theme.primary }}
                >
                  <span>Open in Chrome</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
