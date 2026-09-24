import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  Unlock,
  Fingerprint,
  Delete,
  Moon,
  Sun,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ThemeConfig } from '../types';

interface LockScreenOverlayProps {
  isLocked: boolean;
  isScreenOff: boolean;
  theme: ThemeConfig;
  onUnlock: () => void;
  onTurnOffScreen: () => void;
  onTurnOnScreen: () => void;
}

export function LockScreenOverlay({
  isLocked,
  isScreenOff,
  theme,
  onUnlock,
  onTurnOffScreen,
  onTurnOnScreen,
}: LockScreenOverlayProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [unlockSuccess, setUnlockSuccess] = useState(false);
  const [wakeHint, setWakeHint] = useState(false);

  // Accepted PINs: default '1234' or '0000', or any 4+ digit sequence if entered with enter key
  const correctPins = ['1234', '0000', '1111', '2580', '9999'];

  useEffect(() => {
    if (!isLocked && !isScreenOff) return;
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [isLocked, isScreenOff]);

  // Handle number click on PIN pad
  const handleDigitClick = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setPinError(false);

      // Auto-unlock on 4-digit match
      if (nextPin.length === 4) {
        if (correctPins.includes(nextPin) || nextPin.length === 4) {
          triggerSuccessUnlock();
        }
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setPinError(false);
  };

  const handleClear = () => {
    setPin('');
    setPinError(false);
  };

  const triggerSuccessUnlock = () => {
    setUnlockSuccess(true);
    setTimeout(() => {
      setUnlockSuccess(false);
      setPin('');
      setCustomPassword('');
      onUnlock();
    }, 500);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customPassword.trim().length > 0) {
      triggerSuccessUnlock();
    }
  };

  // Clock formatters
  const hours = currentTime.getHours().toString().padStart(2, '0');
  const minutes = currentTime.getMinutes().toString().padStart(2, '0');
  const seconds = currentTime.getSeconds().toString().padStart(2, '0');
  const dateStr = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  // 1. SCREEN IS OFF: Complete pitch black OLED blackout
  if (isScreenOff) {
    return (
      <div
        onClick={() => {
          setWakeHint(true);
          onTurnOnScreen();
        }}
        id="friday-screen-off-blackout"
        className="fixed inset-0 z-50 bg-[#000000] cursor-pointer select-none flex flex-col items-center justify-between p-8"
        title="Screen is OFF. Tap or say 'Screen on karo' to turn on."
      >
        <div className="w-full flex justify-between items-center opacity-0 pointer-events-none">
          <span>OLED OFF</span>
        </div>

        {/* Faint ambient hint when user taps */}
        <div className="flex flex-col items-center justify-center text-center">
          <motion.div
            animate={{ opacity: [0.05, 0.15, 0.05] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="w-1.5 h-1.5 rounded-full bg-slate-500 mb-3"
          />
          <span className="text-[11px] font-mono text-zinc-700 tracking-widest uppercase">
            SCREEN OFF • SAY &ldquo;SCREEN ON KARO&rdquo; OR TAP TO WAKE
          </span>
        </div>

        <div className="text-[10px] font-mono text-zinc-800 tracking-wider">
          FRIDAY VOICE SENSORS ACTIVE
        </div>
      </div>
    );
  }

  // 2. SCREEN IS ON BUT LOCKED: Password / PIN lock screen
  if (!isLocked) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-50 bg-[#04060b] text-white flex flex-col justify-between items-center px-4 py-8 sm:py-10 select-none overflow-y-auto"
      id="friday-lock-screen"
    >
      {/* Background ambient lock glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background: `radial-gradient(circle at 50% 25%, ${theme.glow} 0%, transparent 65%)`,
        }}
      />

      {/* Top Security Status & Quick Controls */}
      <div className="relative z-10 w-full max-w-sm flex items-center justify-between pt-1 px-2">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-950/40 text-red-400 text-[11px] font-mono tracking-widest uppercase">
          {unlockSuccess ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300">AUTHENTICATED</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>SCREEN LOCKED</span>
            </>
          )}
        </div>

        {/* Turn Off Screen Button */}
        <button
          onClick={onTurnOffScreen}
          id="lockscreen-turn-off-btn"
          className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-mono"
          title="Turn Screen OFF (OLED Blackout)"
        >
          <Moon className="w-3.5 h-3.5 text-slate-300" />
          <span className="hidden sm:inline">SCREEN OFF</span>
        </button>
      </div>

      {/* Center Clock */}
      <div className="relative z-10 flex flex-col items-center my-3 sm:my-4">
        <div className="font-['Syne'] font-extrabold text-5xl sm:text-7xl tracking-tight text-slate-100 drop-shadow-2xl">
          {hours}:{minutes}
          <span className="text-xl sm:text-2xl font-mono text-slate-500 ml-1">
            :{seconds}
          </span>
        </div>
        <div className="mt-1 text-xs sm:text-sm font-medium tracking-wide text-slate-400">
          {dateStr}
        </div>
      </div>

      {/* Password / PIN Section */}
      <div className="relative z-10 w-full max-w-xs flex flex-col items-center">
        {/* Toggle between PIN keypad & custom Password input */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setShowPasswordInput(false)}
            className={`text-xs font-mono px-3 py-1 rounded-full border transition-all ${
              !showPasswordInput
                ? 'border-white/40 bg-white/15 text-white'
                : 'border-white/5 text-slate-500 hover:text-slate-300'
            }`}
          >
            PIN Keypad
          </button>
          <button
            onClick={() => setShowPasswordInput(true)}
            className={`text-xs font-mono px-3 py-1 rounded-full border transition-all ${
              showPasswordInput
                ? 'border-white/40 bg-white/15 text-white'
                : 'border-white/5 text-slate-500 hover:text-slate-300'
            }`}
          >
            Text Password
          </button>
        </div>

        {!showPasswordInput ? (
          /* Standard Mobile 4/6 PIN Keypad */
          <div className="w-full flex flex-col items-center">
            {/* PIN Dots Display */}
            <div className="flex items-center justify-center gap-3 my-3">
              {[0, 1, 2, 3].map((idx) => {
                const filled = pin.length > idx;
                return (
                  <motion.div
                    key={idx}
                    animate={{
                      scale: filled ? [1, 1.25, 1] : 1,
                      backgroundColor: unlockSuccess
                        ? '#10b981'
                        : filled
                        ? theme.primary
                        : 'transparent',
                    }}
                    className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                      unlockSuccess
                        ? 'border-emerald-400 shadow-[0_0_10px_#10b981]'
                        : filled
                        ? 'border-white shadow-[0_0_10px_rgba(255,255,255,0.5)]'
                        : 'border-slate-600 bg-slate-900/60'
                    }`}
                  />
                );
              })}
            </div>

            <p className="text-[11px] text-slate-400 font-mono mb-3">
              Enter your mobile PIN (e.g. 1234)
            </p>

            {/* Mobile 3x4 Number Keypad */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[260px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <motion.button
                  key={digit}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => handleDigitClick(digit)}
                  className="h-14 rounded-2xl border border-white/10 bg-slate-900/60 hover:bg-white/10 text-white font-['Syne'] font-bold text-xl flex flex-col items-center justify-center transition-colors shadow-sm active:border-white/40"
                >
                  <span>{digit}</span>
                </motion.button>
              ))}

              {/* Clear */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleClear}
                className="h-14 rounded-2xl border border-white/10 bg-slate-950/60 text-slate-400 hover:text-white text-xs font-mono flex items-center justify-center transition-colors"
              >
                CLEAR
              </motion.button>

              {/* Zero */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => handleDigitClick('0')}
                className="h-14 rounded-2xl border border-white/10 bg-slate-900/60 hover:bg-white/10 text-white font-['Syne'] font-bold text-xl flex items-center justify-center transition-colors shadow-sm active:border-white/40"
              >
                0
              </motion.button>

              {/* Backspace */}
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleDelete}
                className="h-14 rounded-2xl border border-white/10 bg-slate-950/60 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <Delete className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        ) : (
          /* Custom Alphanumeric Password Input */
          <form
            onSubmit={handlePasswordSubmit}
            className="w-full flex flex-col items-center gap-3 my-2"
          >
            <p className="text-[11px] text-slate-400 font-mono">
              Type your mobile password:
            </p>
            <div className="relative w-full">
              <input
                type={showPasswordText ? 'text' : 'password'}
                value={customPassword}
                onChange={(e) => setCustomPassword(e.target.value)}
                placeholder="Enter password..."
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-white/20 text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-cyan-400 transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPasswordText(!showPasswordText)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-white"
              >
                {showPasswordText ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wider text-black transition-all shadow-lg"
              style={{ backgroundColor: theme.primary }}
            >
              Unlock Device
            </button>
          </form>
        )}

        {/* Biometric Fingerprint Bypass */}
        <div className="mt-4 flex flex-col items-center">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={triggerSuccessUnlock}
            className="p-3 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all group"
            title="Biometric Fingerprint Bypass"
          >
            <Fingerprint
              className="w-6 h-6 transition-transform group-hover:scale-110"
              style={{ color: theme.primary }}
            />
          </motion.button>
          <span className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-wider">
            OR TAP FINGERPRINT TO UNLOCK
          </span>
        </div>
      </div>

      {/* Voice Instruction Helper */}
      <div className="relative z-10 text-center pt-2">
        <p className="text-[11px] font-mono text-slate-400">
          Voice Active: Say <span className="text-white">&ldquo;Screen off kar do&rdquo;</span> or <span className="text-white">&ldquo;Screen unlock karo&rdquo;</span>
        </p>
      </div>
    </motion.div>
  );
}
