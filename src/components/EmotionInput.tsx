import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles } from 'lucide-react';

interface EmotionInputProps {
  onAddSphere: (emotion: string) => void;
}

const EMOTION_PRESETS: Record<string, string> = {
  'Happy': '#dc2626', // red-600
  'Melancholy': '#7e22ce', // purple-700
  'Calm': '#3b82f6', // blue-500
  'Anxiety': '#fb923c', // orange-400
};

const EmotionInput: React.FC<EmotionInputProps> = ({ onAddSphere }) => {
  const [customValue, setCustomValue] = useState('');

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customValue.trim()) {
      onAddSphere(customValue.trim());
      setCustomValue('');
    }
  };

  return (
    <footer className="relative z-20 h-48 px-10 py-8 flex items-end justify-between">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-widest text-[#666]">Custom Emotional Input</span>
          <form onSubmit={handleCustomSubmit} className="flex gap-2">
            <input 
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="Define a new state..."
              className="bg-white/5 border border-white/10 rounded-full px-5 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-white/40 focus:bg-white/10 transition-all w-64"
            />
            <button 
              type="submit"
              className="p-2 border border-white/20 rounded-full bg-white/5 hover:bg-white text-white hover:text-black transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-widest text-[#666]">Emotional Spectrum Palette</span>
          <div className="flex gap-4">
            {Object.keys(EMOTION_PRESETS).map((emotion) => (
              <button
                key={emotion}
                onClick={() => onAddSphere(emotion)}
                className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-full bg-white/5 hover:bg-white hover:text-black transition-all group"
              >
                <div 
                  className="w-2 h-2 rounded-full transition-transform group-hover:scale-125" 
                  style={{ backgroundColor: EMOTION_PRESETS[emotion] }}
                />
                <span className="text-xs font-serif italic text-[#e0e0e0] group-hover:text-black">{emotion}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-64">
        <div className="flex justify-between mb-2">
          <span className="text-[9px] uppercase tracking-widest text-[#666]">Fluid Density</span>
          <span className="text-[9px] uppercase tracking-widest text-white">0.42 Kinetic</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex gap-[2px]">
            {Array.from({ length: 12 }).map((_, i) => (
              <div 
                key={i} 
                className="h-4 w-2 bg-white/10"
                style={{ opacity: 0.1 + (i < 8 ? i * 0.1 : 0) }}
              />
            ))}
          </div>
          <p className="text-[9px] text-[#444] leading-tight">Velocity reduces as sphere count increases to stabilize space-time coherence.</p>
        </div>
      </div>
    </footer>
  );
};

export default EmotionInput;
export { EMOTION_PRESETS };
