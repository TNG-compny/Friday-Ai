import React from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';
import { ThemeConfig } from '../types';

interface QuickVoicePromptsProps {
  theme: ThemeConfig;
  isConnected: boolean;
}

const VOICE_PROMPTS = [
  '“वापस आ जाओ” (Return to AI Page ⚡)',
  '“यूट्यूब खोलो” (Native App / Direct Play)',
  '“व्हाट्सएप पर मैसेज भेजो” (Direct Intent)',
  '“कैमरा खोलो” (Native Camera)',
  '“क्रोम में सर्च करो” (Chrome Web)',
  '“अलार्म लगाओ” (Android Clock)',
];

export function QuickVoicePrompts({ theme, isConnected }: QuickVoicePromptsProps) {
  return (
    <div className="w-full max-w-xl px-4 py-2 flex flex-col items-center select-none pointer-events-auto">
      <div className="flex items-center gap-1.5 text-[11px] font-mono tracking-wider text-slate-400 mb-2">
        <MessageSquare className="w-3 h-3" style={{ color: theme.primary }} />
        <span>SPEAK ALOUD TO FRIDAY</span>
      </div>

      {/* Horizontal pill list of witty voice inspiration */}
      <div className="flex items-center justify-center flex-wrap gap-2 text-center">
        {VOICE_PROMPTS.map((prompt, i) => (
          <div
            key={i}
            className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs text-slate-300 transition-all duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white"
            style={{
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {prompt}
          </div>
        ))}
      </div>
    </div>
  );
}
