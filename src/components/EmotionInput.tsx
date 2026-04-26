import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface EmotionInputProps {
  onAddSphere: (emotion: string) => void;
}

const EMOTION_PRESETS: Record<string, string> = {
  'Happy':      '#eab308',
  'Joyful':     '#ff0000',
  'Anger':      '#7f1d1d',
  'Calm':       '#3b82f6',
  'Anxiety':    '#f97316',
  'Jealous':    '#22c55e',
  'Love':       '#ec4899',
  'Melancholy': '#7e22ce',
  'Fear':       '#4338ca',
  'Awe':        '#06b6d4',
};

const CUSTOM_PALETTE = [
  '#f43f5e','#14b8a6','#a78bfa','#fb923c','#34d399',
  '#60a5fa','#e879f9','#fbbf24','#f87171','#4ade80',
];

const STORAGE_KEY = 'cloud-mind-custom-emotions';
type CustomEmotion = { name: string; color: string };

export function getCustomEmotionColor(name: string): string | undefined {
  try {
    const stored: CustomEmotion[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return stored.find(e => e.name === name)?.color;
  } catch { return undefined; }
}

const EmotionInput: React.FC<EmotionInputProps> = ({ onAddSphere }) => {
  const [customValue, setCustomValue] = useState('');
  const [customEmotions, setCustomEmotions] = useState<CustomEmotion[]>(() => {
    try {
      const stored: CustomEmotion[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const clean = stored.filter(e => e.name?.trim());
      if (clean.length !== stored.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      return clean;
    } catch { return []; }
  });

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = customValue.trim();
    if (!val) return;

    let updated = customEmotions;
    const exists = customEmotions.some(e => e.name === val) || val in EMOTION_PRESETS;
    if (!exists) {
      const color = CUSTOM_PALETTE[customEmotions.length % CUSTOM_PALETTE.length];
      updated = [...customEmotions, { name: val, color }];
      setCustomEmotions(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }

    onAddSphere(val);
    setCustomValue('');
  };

  const allEmotions: [string, string][] = [
    ...Object.entries(EMOTION_PRESETS),
    ...customEmotions.map(({ name, color }) => [name, color] as [string, string]),
  ];

  return (
    <div className="flex flex-col w-44 h-[calc(100vh-9rem)] max-h-[600px]">
      <span className="text-[9px] uppercase tracking-[0.3em] text-white/20 mb-3">
        Emotion Catalogue · {allEmotions.length}
      </span>

      <div
        className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}
      >
        {allEmotions.map(([name, color]) => (
          <button
            key={name}
            onClick={() => onAddSphere(name)}
            className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-full bg-white/5 hover:bg-white hover:text-black transition-all group backdrop-blur-md shadow-xl w-full"
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0 transition-transform group-hover:scale-125"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs font-serif italic text-[#e0e0e0] group-hover:text-black truncate">
              {name}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-white/10">
        <form onSubmit={handleCustomSubmit} className="flex gap-2">
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="New state..."
            className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-[10px] text-white placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
          />
          <button
            type="submit"
            className="p-1.5 border border-white/20 rounded bg-white/5 hover:bg-white text-white hover:text-black transition-all flex-shrink-0"
          >
            <Send className="w-3 h-3" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmotionInput;
export { EMOTION_PRESETS };
