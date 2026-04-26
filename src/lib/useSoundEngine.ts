import { useRef, useCallback } from 'react';

function makeSaturator(ctx: AudioContext, amount: number): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  const samples = 256;
  const curve = new Float32Array(samples);
  const k = amount * 100;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  shaper.curve = curve;
  shaper.oversample = '4x';
  return shaper;
}

function makeOsc(ctx: AudioContext, freq: number, type: OscillatorType, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  return o;
}

function makeGain(ctx: AudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

// Major chord ratios: root, major 3rd, perfect 5th
const MAJ = [1, 1.2599, 1.4983];
// Minor chord
const MIN = [1, 1.1892, 1.4983];
// Tritone (dissonant)
const TRI = [1, 1.4142];

type SoundFn = (ctx: AudioContext, now: number, out: AudioNode, size: number) => void;

const SOUNDS: Record<string, SoundFn> = {

  Happy: (ctx, now, out, size) => {
    // Bright major triad — three sine oscs in harmony, upward shimmer
    const root = (440 + Math.random() * 40) * Math.pow(0.5 / size, 0.2);
    MAJ.forEach((ratio, i) => {
      const osc = makeOsc(ctx, root * ratio, 'sine', (Math.random() - 0.5) * 6);
      const g = makeGain(ctx, 0);
      osc.frequency.setValueAtTime(root * ratio, now);
      osc.frequency.linearRampToValueAtTime(root * ratio * 1.02, now + 0.4);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.08 - i * 0.01, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      const shelf = ctx.createBiquadFilter();
      shelf.type = 'highshelf'; shelf.frequency.value = 5000; shelf.gain.value = 6;
      osc.connect(shelf); shelf.connect(g); g.connect(out);
      osc.start(now + i * 0.03); osc.stop(now + 1.0);
    });
  },

  Joyful: (ctx, now, out, size) => {
    // Ascending major arpeggio — bright, playful, musical
    const root = (440 + Math.random() * 60) * Math.pow(0.5 / size, 0.2);
    const notes = [1, 1.2599, 1.4983, 2]; // root, maj3, P5, octave
    notes.forEach((ratio, i) => {
      const osc = makeOsc(ctx, root * ratio, 'triangle', (Math.random() - 0.5) * 5);
      const shelf = ctx.createBiquadFilter();
      shelf.type = 'highshelf'; shelf.frequency.value = 4000; shelf.gain.value = 5;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = 5500;
      const g = makeGain(ctx, 0);
      const onset = now + i * 0.08;
      g.gain.setValueAtTime(0, onset);
      g.gain.linearRampToValueAtTime(0.1, onset + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, onset + 0.5);
      osc.connect(lpf); lpf.connect(shelf); shelf.connect(g); g.connect(out);
      osc.start(onset); osc.stop(onset + 0.55);
    });
  },

  Anger: (ctx, now, out, size) => {
    // Harsh tritone + heavy distortion + low growl
    const root = (80 + Math.random() * 30) * Math.pow(0.5 / size, 0.25);
    TRI.forEach((ratio) => {
      const osc = makeOsc(ctx, root * ratio, 'sawtooth', (Math.random() - 0.5) * 30);
      const sat = makeSaturator(ctx, 0.95);
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass'; hpf.frequency.value = 60;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.setValueAtTime(1800, now);
      lpf.frequency.exponentialRampToValueAtTime(400, now + 0.5);
      const g = makeGain(ctx, 0);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.18, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(hpf); hpf.connect(sat); sat.connect(lpf); lpf.connect(g); g.connect(out);
      osc.start(now); osc.stop(now + 0.7);
    });
  },

  Calm: (ctx, now, out, size) => {
    // Soft sine pad — slow attack, long gentle fade
    const root = (280 + Math.random() * 40) * Math.pow(0.5 / size, 0.2);
    [1, 1.5].forEach((ratio, i) => {
      const osc = makeOsc(ctx, root * ratio, 'sine', (Math.random() - 0.5) * 4);
      const g = makeGain(ctx, 0);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.07, now + 0.12);
      g.gain.linearRampToValueAtTime(0.05, now + 0.5);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = 900;
      osc.connect(lpf); lpf.connect(g); g.connect(out);
      osc.start(now + i * 0.05); osc.stop(now + 1.5);
    });
  },

  Anxiety: (ctx, now, out, size) => {
    // Detuned beating pair + tremolo — unsettled, tense
    const root = (380 + Math.random() * 60) * Math.pow(0.5 / size, 0.2);
    [0, 12].forEach((detuneOffset) => {
      const osc = makeOsc(ctx, root, 'sawtooth', detuneOffset + (Math.random() - 0.5) * 8);
      const sat = makeSaturator(ctx, 0.5);
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = 3200;
      const g = makeGain(ctx, 0);
      // Tremolo via rapid gain oscillation
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 8 + Math.random() * 4;
      const lfoGain = makeGain(ctx, 0.06);
      lfo.connect(lfoGain); lfoGain.connect(g.gain);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.1, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(sat); sat.connect(lpf); lpf.connect(g); g.connect(out);
      osc.start(now); osc.stop(now + 0.9);
      lfo.start(now); lfo.stop(now + 0.9);
    });
  },

  Jealous: (ctx, now, out, size) => {
    // Minor interval — bittersweet, slightly dark
    const root = (330 + Math.random() * 40) * Math.pow(0.5 / size, 0.2);
    MIN.slice(0, 2).forEach((ratio, i) => {
      const osc = makeOsc(ctx, root * ratio, 'triangle', (Math.random() - 0.5) * 8);
      const sat = makeSaturator(ctx, 0.3);
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = 2400;
      const g = makeGain(ctx, 0);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.08, now + 0.015 + i * 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc.connect(sat); sat.connect(lpf); lpf.connect(g); g.connect(out);
      osc.start(now + i * 0.02); osc.stop(now + 1.0);
    });
  },

  Love: (ctx, now, out, size) => {
    // Warm octave pair — round, intimate, gentle bloom
    const root = (320 + Math.random() * 40) * Math.pow(0.5 / size, 0.2);
    [1, 2, 3].forEach((ratio, i) => {
      const osc = makeOsc(ctx, root * ratio, 'sine', (Math.random() - 0.5) * 5);
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = 2000 - i * 300;
      const g = makeGain(ctx, 0);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.07 / (i + 1), now + 0.05 + i * 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc.connect(lpf); lpf.connect(g); g.connect(out);
      osc.start(now + i * 0.04); osc.stop(now + 1.2);
    });
  },

  Melancholy: (ctx, now, out, size) => {
    // Descending pitch glide — slow, mournful
    const root = (240 + Math.random() * 30) * Math.pow(0.5 / size, 0.2);
    const osc = makeOsc(ctx, root, 'triangle');
    osc.frequency.setValueAtTime(root, now);
    osc.frequency.exponentialRampToValueAtTime(root * 0.65, now + 1.0);
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.value = 1200;
    const g = makeGain(ctx, 0);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.1, now + 0.08);
    g.gain.linearRampToValueAtTime(0.06, now + 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.connect(lpf); lpf.connect(g); g.connect(out);
    osc.start(now); osc.stop(now + 1.3);
  },

  Fear: (ctx, now, out, size) => {
    // Sub rumble + noise burst + trembling LFO
    const root = (55 + Math.random() * 25) * Math.pow(0.5 / size, 0.25);
    const osc = makeOsc(ctx, root, 'sawtooth');
    const sat = makeSaturator(ctx, 0.85);
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = 40;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass'; lpf.frequency.setValueAtTime(600, now);
    lpf.frequency.exponentialRampToValueAtTime(150, now + 0.6);
    const g = makeGain(ctx, 0);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 12;
    const lfoGain = makeGain(ctx, 0.08);
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.2, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(hpf); hpf.connect(sat); sat.connect(lpf); lpf.connect(g); g.connect(out);
    osc.start(now); osc.stop(now + 0.8);
    lfo.start(now); lfo.stop(now + 0.8);
  },

};

export function useSoundEngine() {
  const ctxRef = useRef<AudioContext | null>(null);
  const reverbRef = useRef<ConvolverNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);

  const getCtx = useCallback((): AudioContext => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const getMaster = useCallback((ctx: AudioContext): GainNode => {
    if (reverbRef.current && compressorRef.current) {
      return reverbRef.current as unknown as GainNode;
    }

    // Reverb
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 2.0;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse;
    reverbRef.current = reverb;

    // Compressor (OTT-style: fast attack, moderate ratio)
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 8;
    comp.ratio.value = 5;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;
    compressorRef.current = comp;

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.38;
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.62;

    // Bus: sound → dryGain → comp → out
    //      sound → reverb → wetGain → comp → out
    reverb.connect(wetGain);
    wetGain.connect(comp);
    dryGain.connect(comp);
    comp.connect(ctx.destination);

    // Return dryGain as the main insert point — each sound connects here
    // Store wetGain ref via a hack: attach to reverb node
    (reverb as any).__dryGain = dryGain;

    return dryGain;
  }, []);

  const play = useCallback((emotion: string, size: number = 0.5) => {
    const ctx = getCtx();
    const now = ctx.currentTime;

    if (!reverbRef.current) {
      const sampleRate = ctx.sampleRate;
      const length = sampleRate * 2.0;
      const impulse = ctx.createBuffer(2, length, sampleRate);
      for (let c = 0; c < 2; c++) {
        const ch = impulse.getChannelData(c);
        for (let i = 0; i < length; i++) {
          ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
        }
      }
      reverbRef.current = ctx.createConvolver();
      reverbRef.current.buffer = impulse;
    }

    if (!compressorRef.current) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 8;
      comp.ratio.value = 5;
      comp.attack.value = 0.002;
      comp.release.value = 0.12;
      compressorRef.current = comp;
      comp.connect(ctx.destination);
    }

    // Size → volume: clamp so small spheres are quiet, large are full
    const volumeScale = Math.max(0.3, Math.min(1.8, size * 0.9));

    const sizeGain = ctx.createGain(); sizeGain.gain.value = volumeScale;
    const dryBus = ctx.createGain(); dryBus.gain.value = 0.65;
    const wetBus = ctx.createGain(); wetBus.gain.value = 0.35;
    const merge = ctx.createGain(); merge.gain.value = 1;

    sizeGain.connect(dryBus);
    sizeGain.connect(wetBus);
    dryBus.connect(merge);
    wetBus.connect(reverbRef.current);
    reverbRef.current.connect(merge);
    merge.connect(compressorRef.current);

    const fn = SOUNDS[emotion];
    if (fn) fn(ctx, now, sizeGain, size);
    else SOUNDS['Happy'](ctx, now, sizeGain, size);
  }, [getCtx]);

  return { play };
}
