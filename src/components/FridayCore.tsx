import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Power, Sparkles, Volume2 } from 'lucide-react';
import { SessionState, ThemeConfig } from '../types';

interface FridayCoreProps {
  state: SessionState;
  theme: ThemeConfig;
  inputLevel: number;
  outputLevel: number;
  isMuted: boolean;
  onTogglePower: () => void;
  onToggleMute: () => void;
}

export function FridayCore({
  state,
  theme,
  inputLevel,
  outputLevel,
  isMuted,
  onTogglePower,
  onToggleMute,
}: FridayCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Smooth visual level trackers
  const smoothedLevel = useRef(0);
  const rotationAngle = useRef(0);
  const particles = useRef<Array<{ x: number; y: number; vx: number; vy: number; radius: number; alpha: number; angle: number; dist: number }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Initialize decorative particles
    if (particles.current.length === 0) {
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 70 + Math.random() * 110;
        particles.current.push({
          x: 0,
          y: 0,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: 1 + Math.random() * 2,
          alpha: 0.2 + Math.random() * 0.6,
          angle,
          dist,
        });
      }
    }

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Determine active audio intensity
      const targetLevel = state === 'speaking' ? outputLevel : state === 'listening' ? inputLevel : 0.05;
      smoothedLevel.current += (targetLevel - smoothedLevel.current) * 0.18;
      const energy = smoothedLevel.current;

      // Rotate cybernetic rings
      const speed = state === 'speaking' ? 0.025 : state === 'connecting' ? 0.04 : 0.008;
      rotationAngle.current += speed;

      const baseRadius = Math.min(width, height) * 0.26;
      const currentRadius = baseRadius + energy * 36;

      // 1. Draw outer ambient holographic aura
      const radialGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.3,
        centerX,
        centerY,
        baseRadius * 2.1 + energy * 40
      );
      radialGlow.addColorStop(0, theme.glow);
      radialGlow.addColorStop(0.5, theme.glow.replace('0.45', '0.12'));
      radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radialGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 2.2 + energy * 40, 0, Math.PI * 2);
      ctx.fill();

      // 2. Outer segmented orbital ring (counter-clockwise)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-rotationAngle.current * 0.7);
      ctx.strokeStyle = state === 'speaking' ? theme.primary : 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([12, 18, 4, 18]);
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius + 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 3. Middle orbital ring with telemetry marks
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationAngle.current);
      ctx.strokeStyle = theme.primary;
      ctx.globalAlpha = state === 'disconnected' ? 0.25 : 0.8;
      ctx.lineWidth = 2;
      ctx.setLineDash([40, 20, 8, 20]);
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius + 14, 0, Math.PI * 2);
      ctx.stroke();

      // Draw cross-hair satellite points
      for (let i = 0; i < 4; i++) {
        const theta = (i * Math.PI) / 2;
        const px = Math.cos(theta) * (currentRadius + 14);
        const py = Math.sin(theta) * (currentRadius + 14);
        ctx.fillStyle = theme.primary;
        ctx.beginPath();
        ctx.arc(px, py, 2.5 + energy * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 4. Audio reactive waveform / waveform spikes
      if (state === 'speaking' || state === 'listening') {
        const segments = 64;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          // harmonic wave oscillation
          const wave =
            Math.sin(theta * 8 + rotationAngle.current * 6) * (energy * 24) +
            Math.cos(theta * 4 - rotationAngle.current * 4) * (energy * 14);
          const r = currentRadius + 4 + wave;
          const wx = Math.cos(theta) * r;
          const wy = Math.sin(theta) * r;
          if (i === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.closePath();
        ctx.strokeStyle = theme.primary;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = theme.primary;
        ctx.shadowBlur = 12 + energy * 16;
        ctx.stroke();
        ctx.restore();
      }

      // 5. Floating cyber particles
      particles.current.forEach((p) => {
        p.angle += 0.006 * (state === 'speaking' ? 2 : 1);
        const pDist = p.dist + Math.sin(p.angle * 3) * (10 + energy * 20);
        const px = centerX + Math.cos(p.angle) * pDist;
        const py = centerY + Math.sin(p.angle) * pDist;

        ctx.fillStyle = theme.primary;
        ctx.globalAlpha = p.alpha * (state === 'disconnected' ? 0.3 : 0.85);
        ctx.beginPath();
        ctx.arc(px, py, p.radius + energy * 1.5, 0, Math.PI * 2);
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [state, theme, inputLevel, outputLevel]);

  // Center button state styling
  const isConnected = state !== 'disconnected' && state !== 'error';

  return (
    <div className="relative w-full max-w-sm sm:max-w-md aspect-square flex items-center justify-center select-none">
      {/* Dynamic 60fps Canvas Arc Visualizer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Center Interactive Power / Mic Sphere */}
      <motion.div
        whileTap={{ scale: 0.94 }}
        className="relative z-10 flex flex-col items-center justify-center cursor-pointer group"
        onClick={onTogglePower}
        id="friday-center-core"
      >
        {/* Core Glass Sphere */}
        <div
          className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full flex flex-col items-center justify-center transition-all duration-500 shadow-2xl backdrop-blur-xl border"
          style={{
            borderColor: isConnected ? theme.primary : 'rgba(255, 255, 255, 0.15)',
            boxShadow: isConnected
              ? `0 0 50px ${theme.glow}, inset 0 0 30px ${theme.glow}`
              : '0 0 20px rgba(0, 0, 0, 0.5), inset 0 0 15px rgba(255, 255, 255, 0.05)',
            background: isConnected
              ? 'radial-gradient(circle, rgba(15, 23, 42, 0.85) 0%, rgba(3, 7, 18, 0.95) 100%)'
              : 'radial-gradient(circle, rgba(20, 24, 35, 0.9) 0%, rgba(7, 9, 14, 0.98) 100%)',
          }}
        >
          {/* Inner pulsating core rings */}
          <div
            className="absolute inset-2 rounded-full border border-dashed opacity-40 animate-[spin_18s_linear_infinite]"
            style={{ borderColor: isConnected ? theme.primary : '#475569' }}
          />
          <div
            className="absolute inset-5 rounded-full border border-dotted opacity-30 animate-[spin_12s_linear_infinite_reverse]"
            style={{ borderColor: isConnected ? theme.secondary : '#334155' }}
          />

          {/* Central Status Icon */}
          <div className="relative flex flex-col items-center justify-center">
            {state === 'disconnected' && (
              <Power className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 group-hover:text-white transition-colors duration-300 drop-shadow" />
            )}

            {state === 'connecting' && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles
                  className="w-10 h-10 sm:w-12 sm:h-12"
                  style={{ color: theme.primary }}
                />
              </motion.div>
            )}

            {state === 'listening' && (
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Mic
                  className="w-10 h-10 sm:w-12 sm:h-12"
                  style={{ color: theme.primary }}
                />
              </motion.div>
            )}

            {state === 'speaking' && (
              <motion.div
                animate={{ scale: [0.95, 1.12, 0.95] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Volume2
                  className="w-10 h-10 sm:w-12 sm:h-12"
                  style={{ color: theme.primary }}
                />
              </motion.div>
            )}

            {state === 'error' && (
              <Power className="w-10 h-10 sm:w-12 sm:h-12 text-rose-500" />
            )}

            {/* Core Label */}
            <span
              className="mt-2 text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase transition-colors"
              style={{
                color: isConnected ? theme.primary : '#94a3b8',
                textShadow: isConnected ? `0 0 10px ${theme.glow}` : 'none',
              }}
            >
              {state === 'disconnected' && 'INITIALIZE'}
              {state === 'connecting' && 'SYNCING...'}
              {state === 'listening' && (isMuted ? 'MUTED' : 'LISTENING')}
              {state === 'speaking' && 'SPEAKING'}
              {state === 'error' && 'RECONNECT'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Floating Micro-controls when connected */}
      {isConnected && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-8 flex items-center gap-3 z-20"
        >
          {/* Mute Mic Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            id="friday-mute-toggle"
            className={`px-4 py-2 rounded-full text-xs font-medium tracking-wide flex items-center gap-2 border backdrop-blur-md transition-all duration-200 ${
              isMuted
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                : 'bg-slate-900/80 border-slate-700/60 text-slate-300 hover:text-white hover:border-slate-500'
            }`}
          >
            {isMuted ? (
              <>
                <MicOff className="w-3.5 h-3.5 text-rose-400" />
                <span>MIC MUTED</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" style={{ color: theme.primary }} />
                <span>MIC LIVE</span>
              </>
            )}
          </button>

          {/* End Call Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePower();
            }}
            id="friday-end-call"
            className="px-4 py-2 rounded-full text-xs font-medium tracking-wide flex items-center gap-2 bg-red-950/40 border border-red-800/50 text-red-300 hover:bg-red-900/60 transition-all duration-200"
          >
            <Power className="w-3.5 h-3.5 text-red-400" />
            <span>DISCONNECT</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}
