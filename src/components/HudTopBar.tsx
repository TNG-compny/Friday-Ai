import React, { useState } from 'react';
import {
  Sparkles,
  Palette,
  Volume2,
  Activity,
  Sliders,
  X,
  Radio,
} from 'lucide-react';
import { SessionState, ThemeConfig, AtmosphereTheme, LiveTelemetry } from '../types';
import { ATMOSPHERE_THEMES } from '../lib/themes';

interface HudTopBarProps {
  state: SessionState;
  theme: ThemeConfig;
  telemetry: LiveTelemetry;
  selectedVoice: string;
  onSelectTheme: (themeId: AtmosphereTheme) => void;
  onSelectVoice: (voice: string) => void;
}

export function HudTopBar({
  state,
  theme,
  telemetry,
  selectedVoice,
  onSelectTheme,
  onSelectVoice,
}: HudTopBarProps) {
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const getStatusBadge = () => {
    switch (state) {
      case 'listening':
        return { text: 'VOICE LINK ACTIVE', color: 'bg-emerald-500', pulse: true };
      case 'speaking':
        return { text: 'TRANSMITTING VOICE', color: 'bg-cyan-400', pulse: true };
      case 'connecting':
        return { text: 'ESTABLISHING LINK', color: 'bg-amber-400', pulse: true };
      case 'error':
        return { text: 'LINK INTERRUPTED', color: 'bg-rose-500', pulse: false };
      default:
        return { text: 'STANDBY MODE', color: 'bg-slate-500', pulse: false };
    }
  };

  const status = getStatusBadge();

  return (
    <>
      <header className="relative z-30 w-full px-4 sm:px-6 py-3 flex items-center justify-between border-b border-white/5 backdrop-blur-md bg-black/20">
        {/* Left: Persona Identity & Live Status */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div
              className={`w-2.5 h-2.5 rounded-full ${status.color} ${
                status.pulse ? 'animate-ping opacity-75' : ''
              }`}
            />
            <div
              className={`absolute w-2.5 h-2.5 rounded-full ${status.color}`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-['Syne'] font-bold text-sm sm:text-base tracking-wider text-white">
                FRIDAY
              </span>
              <span
                className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border"
                style={{
                  borderColor: `${theme.primary}50`,
                  color: theme.primary,
                  backgroundColor: `${theme.primary}15`,
                }}
              >
                LIVE v3.1
              </span>
            </div>
            <div className="text-[10px] font-mono tracking-widest text-slate-400 flex items-center gap-1.5">
              <span>{status.text}</span>
              {telemetry.latencyMs > 0 && state !== 'disconnected' && (
                <span className="text-slate-500">
                  • {telemetry.latencyMs}ms
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Atmosphere & Settings Controls */}
        <div className="flex items-center gap-2">
          {/* Theme Switcher Button */}
          <button
            onClick={() => setShowThemeModal(true)}
            id="friday-theme-button"
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-mono"
            title="Switch Hologram Atmosphere"
          >
            <Palette className="w-3.5 h-3.5" style={{ color: theme.primary }} />
            <span className="hidden sm:inline">THEME</span>
          </button>

          {/* Settings / Config Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            id="friday-settings-button"
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-mono"
            title="Assistant Config"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CONFIG</span>
          </button>
        </div>
      </header>

      {/* Atmosphere Theme Selector Modal */}
      {showThemeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowThemeModal(false)}
        >
          <div
            className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" style={{ color: theme.primary }} />
                <h3 className="font-['Syne'] font-bold text-white text-base">
                  UI Atmosphere
                </h3>
              </div>
              <button
                onClick={() => setShowThemeModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Switch Friday&apos;s holographic lighting and core energy color:
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {Object.values(ATMOSPHERE_THEMES).map((t) => {
                const isSelected = t.id === theme.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      onSelectTheme(t.id);
                      setShowThemeModal(false);
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-start gap-1.5 transition-all text-left ${
                      isSelected
                        ? 'border-white/60 bg-white/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                        style={{ backgroundColor: t.primary }}
                      />
                      <span className="text-xs font-semibold text-white truncate">
                        {t.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Settings / Telemetry Modal */}
      {showSettingsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowSettingsModal(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4" style={{ color: theme.primary }} />
                <h3 className="font-['Syne'] font-bold text-white text-base">
                  Friday System Telemetry
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Voice Model Selector */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-300 mb-2 block flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5" style={{ color: theme.primary }} />
                Persona Voice Profile
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'Aoede', name: 'Aoede (Default)', desc: 'Young, playful, expressive' },
                  { id: 'Kore', name: 'Kore', desc: 'Calm, confident, warm' },
                ].map((v) => (
                  <button
                    key={v.id}
                    onClick={() => onSelectVoice(v.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedVoice === v.id
                        ? 'border-white/60 bg-white/10 text-white'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-semibold">{v.name}</div>
                    <div className="text-[10px] opacity-75">{v.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Telemetry Details */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-xs text-slate-400 space-y-1.5">
              <div className="flex justify-between">
                <span>Model:</span>
                <span className="text-white">{telemetry.model}</span>
              </div>
              <div className="flex justify-between">
                <span>Input Mic Spec:</span>
                <span className="text-white">PCM16 @ 16kHz (Raw Stream)</span>
              </div>
              <div className="flex justify-between">
                <span>Output Spec:</span>
                <span className="text-white">PCM16 @ 24kHz (Web Audio API)</span>
              </div>
              <div className="flex justify-between">
                <span>Duplex Latency:</span>
                <span className="text-emerald-400 font-bold">
                  {telemetry.latencyMs > 0 ? `${telemetry.latencyMs} ms` : 'Active'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Protocol:</span>
                <span className="text-cyan-400 font-bold">WebSocket Audio Bridge</span>
              </div>
            </div>

            {/* Persona Notes */}
            <div className="mt-4 p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-slate-300 leading-relaxed">
              <div className="flex items-center gap-1.5 text-cyan-300 font-semibold mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                Friday Persona Directives
              </div>
              Witty, sassy, playful close girlfriend persona with charismatic teasing, fast voice responses, and real browser tool execution.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
