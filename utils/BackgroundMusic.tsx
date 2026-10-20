// tslint:disable
/* eslint-disable */
import React, {useEffect, useRef, useState} from 'react';

export interface BackgroundMusicProps {
  /** Optional fallback URL (kept for interface compatibility) */
  readonly url?: string;
  /** Whether the background music is actively playing */
  readonly isPlaying: boolean;
  /** Whether music is muted */
  readonly isMuted?: boolean;
  /** Master volume between 0.0 and 1.0 */
  readonly volume?: number;
  /** Current container stack height or altitude score */
  readonly altitude?: number;
  /** Current consecutive perfect combo count */
  readonly combo?: number;
}

export interface AudioBoundaries {
  start: number;
  end: number;
}

export interface SeamlessLoopResult {
  buffer: AudioBuffer;
  duration: number;
}

export function scanAudioBoundaries(): AudioBoundaries {
  return {start: 0, end: 0};
}

export function createSeamlessLoopBuffer(): AudioBuffer | null {
  return null;
}

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// 124 BPM Grid Constants: 128 Bars (2048 16th-note steps ~ 247.7 seconds of evolving dynamic music)
const BPM = 124;
const SECONDS_PER_BEAT = 60 / BPM; // ~0.48387s
const STEP_TIME = SECONDS_PER_BEAT / 4; // 16th note = ~0.12097s
const TOTAL_STEPS = 2048; // 128 full bars of 4/4
const LOOKAHEAD_SEC = 0.14;
const SCHEDULER_INTERVAL_MS = 25;

// Musical Note Frequency Helpers in D minor / F Major tuning
const NOTES: Record<string, number> = {
  A0: 27.5,
  Bb0: 29.14,
  C1: 32.7,
  D1: 36.71,
  E1: 41.2,
  F1: 43.65,
  G1: 49.0,
  A1: 55.0,
  Bb1: 58.27,
  C2: 65.41,
  D2: 73.42,
  E2: 82.41,
  F2: 87.31,
  G2: 98.0,
  A2: 110.0,
  Bb2: 116.54,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  Bb3: 233.08,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  Bb4: 466.16,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.0,
  Bb5: 932.33,
  B5: 987.77,
  C6: 1046.5,
  D6: 1174.66,
  E6: 1318.51,
  F6: 1396.91,
  G6: 1567.98,
  A6: 1760.0,
  Bb6: 1864.66,
  C7: 2093.0,
};

// Gentle analog saturation curve generator
function createSaturationCurve(amount = 6): Float32Array {
  const n_samples = 4096;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

/**
 * Procedural Multi-Stem Adaptive 124 BPM Dynamic Soundtrack
 * 128-Bar Compositional Form:
 * - Movement 1: Verse (Bars 0-31) — Atmospheric, rhythmic groove in Dm7 / Bbmaj7 / Fmaj7 / C7.
 * - Movement 2: Chorus (Bars 32-63) — Driving melodic energy in Dm9 / C/E / Fmaj7 / Bbmaj7 / Gm7 / Am7.
 * - Movement 3: Bridge (Bars 64-95) — Harmonic transformation in Bbmaj7 / C / Am7 / Dm7 / Gm7 / F/A.
 * - Movement 4: Breakdown & Build-up (Bars 96-127) — Deep space ambient breakdown to epic snare build & climax.
 * Dynamic Drum Fills scheduled every 8 & 16 bars for seamless musical phrase transitions.
 */
export function BackgroundMusic({
  isPlaying,
  isMuted = false,
  volume = 0.45,
  altitude = 0,
  combo = 0,
}: BackgroundMusicProps): React.ReactElement | null {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const [platformMuted, setPlatformMuted] = useState(false);

  // Dedicated Stem Gain Nodes
  const stemGainsRef = useRef<{
    kick: GainNode | null;
    snare: GainNode | null;
    rollingBass: GainNode | null;
    stage1Epiano: GainNode | null;
    stage1Marimba: GainNode | null;
    stage2Acoustic: GainNode | null;
    stage2Pluck: GainNode | null;
    stage3Strings: GainNode | null;
    stage3GlideLead: GainNode | null;
    stage4Bells: GainNode | null;
    stage4Arp: GainNode | null;
    stage5LunarSub: GainNode | null;
    stage5Triumph: GainNode | null;
    tier1Perc: GainNode | null;
    tier2FunkBass: GainNode | null;
    tier3GuitarArp: GainNode | null;
    tier4CounterLead: GainNode | null;
    tier5BrassPad: GainNode | null;
    tier6CosmicChoir: GainNode | null;
    tier7CyberProgLead: GainNode | null;
    tier8CelestialSymphony: GainNode | null;
  }>({
    kick: null,
    snare: null,
    rollingBass: null,
    stage1Epiano: null,
    stage1Marimba: null,
    stage2Acoustic: null,
    stage2Pluck: null,
    stage3Strings: null,
    stage3GlideLead: null,
    stage4Bells: null,
    stage4Arp: null,
    stage5LunarSub: null,
    stage5Triumph: null,
    tier1Perc: null,
    tier2FunkBass: null,
    tier3GuitarArp: null,
    tier4CounterLead: null,
    tier5BrassPad: null,
    tier6CosmicChoir: null,
    tier7CyberProgLead: null,
    tier8CelestialSymphony: null,
  });

  const currentStepRef = useRef(0);
  const nextStepTimeRef = useRef(0);
  const schedulerTimerRef = useRef<number | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const altitudeRef = useRef(altitude);
  altitudeRef.current = altitude;

  const comboRef = useRef(combo);
  comboRef.current = combo;

  const effectiveMuted = isMuted || platformMuted;

  useEffect(() => {
    const handlePlatformMute = (e: Event) => {
      const customEvent = e as CustomEvent<{muted: boolean}>;
      if (typeof customEvent.detail?.muted === 'boolean') {
        setPlatformMuted(customEvent.detail.muted);
      }
    };
    window.addEventListener('playground-mute', handlePlatformMute);
    return () => {
      window.removeEventListener('playground-mute', handlePlatformMute);
    };
  }, []);

  const initAudio = () => {
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      return audioCtxRef.current;
    }
    if (typeof window === 'undefined') return null;

    const AudioContextClass =
      window.AudioContext ||
      (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioContextClass) return null;

    try {
      const ctx = new AudioContextClass();

      const master = ctx.createGain();
      const targetGain = effectiveMuted ? 0 : Math.max(0, Math.min(1, volume * 0.44));
      master.gain.setValueAtTime(targetGain, ctx.currentTime);

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-19, ctx.currentTime);
      compressor.knee.setValueAtTime(10, ctx.currentTime);
      compressor.ratio.setValueAtTime(4.5, ctx.currentTime);
      compressor.attack.setValueAtTime(0.004, ctx.currentTime);
      compressor.release.setValueAtTime(0.18, ctx.currentTime);

      compressor.connect(master);
      master.connect(ctx.destination);

      // 3-Band Equalization Buses
      const lowBus = ctx.createBiquadFilter();
      lowBus.type = 'lowshelf';
      lowBus.frequency.setValueAtTime(150, ctx.currentTime);
      lowBus.gain.setValueAtTime(2.0, ctx.currentTime);
      lowBus.connect(compressor);

      const midBus = ctx.createBiquadFilter();
      midBus.type = 'peaking';
      midBus.frequency.setValueAtTime(900, ctx.currentTime);
      midBus.Q.setValueAtTime(1.0, ctx.currentTime);
      midBus.gain.setValueAtTime(0.8, ctx.currentTime);
      midBus.connect(compressor);

      const highBus = ctx.createBiquadFilter();
      highBus.type = 'highshelf';
      highBus.frequency.setValueAtTime(3800, ctx.currentTime);
      highBus.gain.setValueAtTime(2.2, ctx.currentTime);
      highBus.connect(compressor);

      const saturation = ctx.createWaveShaper();
      (saturation as any).curve = createSaturationCurve(6);
      saturation.oversample = '2x';
      saturation.connect(midBus);

      // Create Gain nodes
      const kick = ctx.createGain();
      const snare = ctx.createGain();
      const rollingBass = ctx.createGain();
      const stage1Epiano = ctx.createGain();
      const stage1Marimba = ctx.createGain();
      const stage2Acoustic = ctx.createGain();
      const stage2Pluck = ctx.createGain();
      const stage3Strings = ctx.createGain();
      const stage3GlideLead = ctx.createGain();
      const stage4Bells = ctx.createGain();
      const stage4Arp = ctx.createGain();
      const stage5LunarSub = ctx.createGain();
      const stage5Triumph = ctx.createGain();
      const tier1Perc = ctx.createGain();
      const tier2FunkBass = ctx.createGain();
      const tier3GuitarArp = ctx.createGain();
      const tier4CounterLead = ctx.createGain();
      const tier5BrassPad = ctx.createGain();
      const tier6CosmicChoir = ctx.createGain();
      const tier7CyberProgLead = ctx.createGain();
      const tier8CelestialSymphony = ctx.createGain();

      // Bus Routing
      kick.connect(lowBus);
      snare.connect(highBus);
      rollingBass.connect(lowBus);

      stage1Epiano.connect(midBus);
      stage1Marimba.connect(highBus);

      stage2Acoustic.connect(midBus);
      stage2Pluck.connect(highBus);

      stage3Strings.connect(midBus);
      stage3GlideLead.connect(highBus);

      stage4Bells.connect(highBus);
      stage4Arp.connect(highBus);

      stage5LunarSub.connect(lowBus);
      stage5Triumph.connect(midBus);

      tier1Perc.connect(highBus);
      tier2FunkBass.connect(saturation);
      tier3GuitarArp.connect(highBus);
      tier4CounterLead.connect(highBus);
      tier5BrassPad.connect(midBus);
      tier6CosmicChoir.connect(midBus);
      tier7CyberProgLead.connect(highBus);
      tier8CelestialSymphony.connect(midBus);

      const now = ctx.currentTime;
      kick.gain.setValueAtTime(0.70, now);
      snare.gain.setValueAtTime(0.55, now);
      rollingBass.gain.setValueAtTime(0.62, now);
      stage1Epiano.gain.setValueAtTime(0.60, now);
      stage1Marimba.gain.setValueAtTime(0.55, now);
      stage2Acoustic.gain.setValueAtTime(0, now);
      stage2Pluck.gain.setValueAtTime(0, now);
      stage3Strings.gain.setValueAtTime(0, now);
      stage3GlideLead.gain.setValueAtTime(0, now);
      stage4Bells.gain.setValueAtTime(0, now);
      stage4Arp.gain.setValueAtTime(0, now);
      stage5LunarSub.gain.setValueAtTime(0, now);
      stage5Triumph.gain.setValueAtTime(0, now);
      tier1Perc.gain.setValueAtTime(0, now);
      tier2FunkBass.gain.setValueAtTime(0, now);
      tier3GuitarArp.gain.setValueAtTime(0, now);
      tier4CounterLead.gain.setValueAtTime(0, now);
      tier5BrassPad.gain.setValueAtTime(0, now);
      tier6CosmicChoir.gain.setValueAtTime(0, now);
      tier7CyberProgLead.gain.setValueAtTime(0, now);
      tier8CelestialSymphony.gain.setValueAtTime(0, now);

      stemGainsRef.current = {
        kick,
        snare,
        rollingBass,
        stage1Epiano,
        stage1Marimba,
        stage2Acoustic,
        stage2Pluck,
        stage3Strings,
        stage3GlideLead,
        stage4Bells,
        stage4Arp,
        stage5LunarSub,
        stage5Triumph,
        tier1Perc,
        tier2FunkBass,
        tier3GuitarArp,
        tier4CounterLead,
        tier5BrassPad,
        tier6CosmicChoir,
        tier7CyberProgLead,
        tier8CelestialSymphony,
      };

      audioCtxRef.current = ctx;
      masterGainRef.current = master;
      compressorRef.current = compressor;

      const unlock = () => {
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
      };
      window.addEventListener('pointerdown', unlock, {once: true, passive: true});
      window.addEventListener('keydown', unlock, {once: true, passive: true});
      window.addEventListener('touchstart', unlock, {once: true, passive: true});

      return ctx;
    } catch {
      return null;
    }
  };

  // Dynamic Multi-Stem Matrix Crossfader
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const stems = stemGainsRef.current;
    const master = masterGainRef.current;
    if (!ctx || !stems.kick || !master) return;

    const alt = altitude;
    const cmb = combo;
    const now = ctx.currentTime;
    const rampTime = 0.35;

    let activeComboCount = 0;
    if (cmb >= 2) activeComboCount += 1;
    if (cmb >= 6) activeComboCount += 1;
    if (cmb >= 16) activeComboCount += 1;
    if (cmb >= 31) activeComboCount += 1;
    if (cmb >= 51) activeComboCount += 1;
    if (cmb >= 100) activeComboCount += 1;
    if (cmb >= 150) activeComboCount += 1;
    if (cmb >= 200) activeComboCount += 1;

    const normFactor = 1.0 / Math.sqrt(1 + activeComboCount * 0.28);

    // Stage Weight Calculations (Seamless 5-stage progression)
    const stage1Weight = Math.max(0, 1 - alt / 20);
    const stage2Weight = Math.min(1, Math.max(0, (alt - 12) / 10)) * Math.max(0, 1 - (alt - 52) / 16);
    const stage3Weight = Math.min(1, Math.max(0, (alt - 48) / 14)) * Math.max(0, 1 - (alt - 105) / 18);
    const stage4Weight = Math.min(1, Math.max(0, (alt - 95) / 18)) * Math.max(0, 1 - (alt - 145) / 20);
    const stage5Weight = Math.min(1, Math.max(0, (alt - 135) / 18));

    // Base Stems
    stems.kick?.gain.setTargetAtTime((0.68 + (alt >= 140 ? 0.05 : 0)) * normFactor, now, rampTime);
    stems.snare?.gain.setTargetAtTime(0.56 * normFactor, now, rampTime);
    stems.rollingBass?.gain.setTargetAtTime(0.60 * normFactor, now, rampTime);

    // Stage 1 Stems (Harbor)
    stems.stage1Epiano?.gain.setTargetAtTime(stage1Weight * 0.62 * normFactor, now, rampTime);
    stems.stage1Marimba?.gain.setTargetAtTime(stage1Weight * 0.58 * normFactor, now, rampTime);

    // Stage 2 Stems (Sky)
    stems.stage2Acoustic?.gain.setTargetAtTime(stage2Weight * 0.65 * normFactor, now, rampTime);
    stems.stage2Pluck?.gain.setTargetAtTime(stage2Weight * 0.60 * normFactor, now, rampTime);

    // Stage 3 Stems (Stratosphere)
    stems.stage3Strings?.gain.setTargetAtTime(stage3Weight * 0.64 * normFactor, now, rampTime);
    stems.stage3GlideLead?.gain.setTargetAtTime(stage3Weight * 0.60 * normFactor, now, rampTime);

    // Stage 4 Stems (Cosmos)
    stems.stage4Bells?.gain.setTargetAtTime(stage4Weight * 0.62 * normFactor, now, rampTime);
    stems.stage4Arp?.gain.setTargetAtTime(stage4Weight * 0.58 * normFactor, now, rampTime);

    // Stage 5 Stems (Asteroid Belt / Lunar Orbit)
    stems.stage5LunarSub?.gain.setTargetAtTime(stage5Weight * 0.68 * normFactor, now, rampTime);
    stems.stage5Triumph?.gain.setTargetAtTime(stage5Weight * 0.65 * normFactor, now, rampTime);

    // Combo Tier Stems (Tiers 1 to 8)
    stems.tier1Perc?.gain.setTargetAtTime(cmb >= 2 ? 0.60 * normFactor : 0, now, rampTime);
    stems.tier2FunkBass?.gain.setTargetAtTime(cmb >= 6 ? 0.65 * normFactor : 0, now, rampTime);
    stems.tier3GuitarArp?.gain.setTargetAtTime(cmb >= 16 ? 0.70 * normFactor : 0, now, rampTime);
    stems.tier4CounterLead?.gain.setTargetAtTime(cmb >= 31 ? 0.65 * normFactor : 0, now, rampTime);
    stems.tier5BrassPad?.gain.setTargetAtTime(cmb >= 51 ? 0.72 * normFactor : 0, now, rampTime);
    stems.tier6CosmicChoir?.gain.setTargetAtTime(cmb >= 100 ? 0.75 * normFactor : 0, now, rampTime);
    stems.tier7CyberProgLead?.gain.setTargetAtTime(cmb >= 150 ? 0.78 * normFactor : 0, now, rampTime);
    stems.tier8CelestialSymphony?.gain.setTargetAtTime(cmb >= 200 ? 0.82 * normFactor : 0, now, rampTime);

    const comboMasterCompensation = 1.0 - Math.min(0.20, activeComboCount * 0.035);
    const targetMaster = effectiveMuted
      ? 0
      : Math.max(0, Math.min(0.44, volume * 0.45 * comboMasterCompensation));

    master.gain.setTargetAtTime(targetMaster, now, rampTime);
  }, [altitude, combo, effectiveMuted, volume]);

  useEffect(() => {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (ctx && master && ctx.state !== 'closed') {
      const target = effectiveMuted ? 0 : Math.max(0, Math.min(0.44, volume * 0.45));
      master.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
    }
  }, [effectiveMuted, volume]);

  // --------------------------------------------------------------------------
  // SYNTHESIZER VOICES & SCHEDULING (124 BPM)
  // --------------------------------------------------------------------------

  // 1. Kick Drum
  const scheduleKick = (ctx: AudioContext, time: number, out: GainNode, punch = 1.0) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135 * punch, time);
    osc.frequency.exponentialRampToValueAtTime(36, time + 0.11);

    gain.gain.setValueAtTime(0.35 * punch, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.19);

    osc.connect(gain);
    gain.connect(out);
    osc.start(time);
    osc.stop(time + 0.21);
  };

  // 2. Snare Drum
  const scheduleSnare = (ctx: AudioContext, time: number, out: GainNode, snap = 1.0, pitch = 190) => {
    const dur = 0.16;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(900, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.19 * snap, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(time);
    src.stop(time + dur);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, time);
    osc.frequency.exponentialRampToValueAtTime(85, time + 0.07);
    oscGain.gain.setValueAtTime(0.15 * snap, time);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
    osc.connect(oscGain);
    oscGain.connect(out);
    osc.start(time);
    osc.stop(time + 0.11);
  };

  // 3. Tom Drum (for drum fills)
  const scheduleTom = (ctx: AudioContext, time: number, out: GainNode, startFreq: number, dur = 0.18) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.45, time + dur * 0.8);

    gain.gain.setValueAtTime(0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(gain);
    gain.connect(out);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  };

  // 4. Hi-Hat / Percussion
  const scheduleHat = (
    ctx: AudioContext,
    time: number,
    out: GainNode,
    isOpen = false,
    gainVol = 0.08,
  ) => {
    const dur = isOpen ? 0.17 : 0.038;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isOpen ? 7200 : 9400, time);
    filter.Q.setValueAtTime(4.2, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(time);
    src.stop(time + dur);
  };

  // 5. Rolling Sidechained Synth Bass
  const scheduleRollingBass = (
    ctx: AudioContext,
    time: number,
    freq: number,
    out: GainNode,
    isGritty = false,
    duration = STEP_TIME,
  ) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = isGritty ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isGritty ? 700 : 320, time);
    filter.frequency.exponentialRampToValueAtTime(95, time + duration * 0.85);

    gain.gain.setValueAtTime(isGritty ? 0.19 : 0.23, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(time);
    osc.stop(time + duration);
  };

  // 6. Stage 1: Oceanic Electric Piano (warm Rhodes style chords)
  const scheduleEpiano = (
    ctx: AudioContext,
    time: number,
    freqs: number[],
    out: GainNode,
    duration: number,
  ) => {
    freqs.forEach((freq, idx) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, time);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2.001, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, time);
      filter.frequency.exponentialRampToValueAtTime(450, time + duration);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.06 / (idx * 0.35 + 1), time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration + 0.05);
      osc2.stop(time + duration + 0.05);
    });
  };

  // 7. Stage 1: Coastal Marimba
  const scheduleMarimba = (
    ctx: AudioContext,
    time: number,
    freq: number,
    out: GainNode,
  ) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.5, time);
    filter.Q.setValueAtTime(3.0, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.09, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(time);
    osc.stop(time + 0.3);
  };

  // 8. Stage 2: Acoustic Rhythm Guitar Strum
  const scheduleAcousticStrum = (
    ctx: AudioContext,
    time: number,
    freqs: number[],
    out: GainNode,
    duration: number,
  ) => {
    freqs.forEach((freq, idx) => {
      const offset = idx * 0.012;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time + offset);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, time + offset);
      filter.frequency.exponentialRampToValueAtTime(500, time + offset + duration);

      gain.gain.setValueAtTime(0.001, time + offset);
      gain.gain.linearRampToValueAtTime(0.045 / (idx * 0.2 + 1), time + offset + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + offset + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      osc.start(time + offset);
      osc.stop(time + offset + duration + 0.05);
    });
  };

  // 9. Stage 2: Breezy Synth Pluck Melody
  const scheduleSynthPluck = (
    ctx: AudioContext,
    time: number,
    freq: number,
    out: GainNode,
    duration = 0.35,
  ) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, time);
    filter.frequency.exponentialRampToValueAtTime(650, time + duration);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.11, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  };

  // 10. Stage 3: Twilight Strings
  const scheduleTwilightStrings = (
    ctx: AudioContext,
    time: number,
    freqs: number[],
    out: GainNode,
    duration: number,
  ) => {
    freqs.forEach((freq, idx) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq * 1.004, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, time);
      filter.Q.setValueAtTime(1.2, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.045 / (idx * 0.3 + 1), time + 0.22);
      gain.gain.linearRampToValueAtTime(0.035 / (idx * 0.3 + 1), time + duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration + 0.08);
      osc2.stop(time + duration + 0.08);
    });
  };

  // 11. Stage 3: Airy Glide Lead
  const scheduleAiryGlideLead = (
    ctx: AudioContext,
    time: number,
    freq: number,
    freqTo: number,
    out: GainNode,
    duration: number,
  ) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freqTo, time + duration * 0.85);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.095, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(time);
    osc.stop(time + duration + 0.06);
  };

  // 12. Stage 4: Crystalline Celestial Bells
  const scheduleCelestialBells = (
    ctx: AudioContext,
    time: number,
    freq: number,
    out: GainNode,
  ) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, time);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.76, time); // Inharmonic metallic chime

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.065, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.7);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(out);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + 0.75);
    osc2.stop(time + 0.75);
  };

  // 13. Stage 4: Cosmic Arpeggiator
  const scheduleCosmicArp = (
    ctx: AudioContext,
    time: number,
    freq: number,
    out: GainNode,
  ) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.8, time);
    filter.Q.setValueAtTime(3.8, time);

    gain.gain.setValueAtTime(0.075, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + STEP_TIME * 0.75);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(time);
    osc.stop(time + STEP_TIME * 0.85);
  };

  // 14. Stage 5: Lunar Sub-Bass & Space Reverb Pulses
  const scheduleLunarSubPulse = (
    ctx: AudioContext,
    time: number,
    freq: number,
    out: GainNode,
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.75, time + STEP_TIME * 3.5);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.24, time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + STEP_TIME * 4);

    osc.connect(gain);
    gain.connect(out);
    osc.start(time);
    osc.stop(time + STEP_TIME * 4.2);
  };

  // 15. Stage 5: Celebratory Triumph Chords
  const scheduleTriumphChords = (
    ctx: AudioContext,
    time: number,
    freqs: number[],
    out: GainNode,
    duration: number,
  ) => {
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, time);
      filter.frequency.linearRampToValueAtTime(2400, time + duration * 0.4);
      filter.frequency.exponentialRampToValueAtTime(800, time + duration);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.065 / (idx * 0.25 + 1), time + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      osc.start(time);
      osc.stop(time + duration + 0.08);
    });
  };

  // 16. Tier 2: Funk Bass Groove
  const scheduleFunkBass = (
    ctx: AudioContext,
    time: number,
    freq: number,
    out: GainNode,
  ) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, time);
    filter.frequency.exponentialRampToValueAtTime(140, time + STEP_TIME * 0.8);
    filter.Q.setValueAtTime(4.0, time);

    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + STEP_TIME * 0.85);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(time);
    osc.stop(time + STEP_TIME);
  };

  // 17. Tier 3: Rich Acoustic Guitar Arpeggio & Stabs
  const scheduleGuitarArp = (
    ctx: AudioContext,
    time: number,
    freq: number,
    out: GainNode,
    duration = 0.35,
  ) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, time);
    filter.frequency.exponentialRampToValueAtTime(400, time + duration);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.13, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  };

  // 18. Tier 4: Driving Synth Lead Counter-Melody
  const scheduleCounterLead = (
    ctx: AudioContext,
    time: number,
    freq: number,
    out: GainNode,
    duration = 0.4,
  ) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq * 1.003, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, time);
    filter.Q.setValueAtTime(2.0, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.11, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(out);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration + 0.05);
    osc2.stop(time + duration + 0.05);
  };

  // 19. Tier 5: Warm Analog Pad Swells & Brassy Harmony
  const scheduleBrassPad = (
    ctx: AudioContext,
    time: number,
    freq: number,
    out: GainNode,
    duration: number,
  ) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 0.997, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, time);
    filter.frequency.linearRampToValueAtTime(1800, time + duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(700, time + duration);
    filter.Q.setValueAtTime(1.6, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.12, time + 0.06);
    gain.gain.linearRampToValueAtTime(0.09, time + duration * 0.65);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(out);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration + 0.08);
    osc2.stop(time + duration + 0.08);
  };

  // 20. Tier 6 (x100 - x149): Cosmic Choir Chords & Prismatic Arpeggio
  const scheduleCosmicChoir = (
    ctx: AudioContext,
    time: number,
    freqs: number[],
    out: GainNode,
    duration: number,
  ) => {
    freqs.forEach((freq, idx) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq * 2, time);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2.006, time);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * 2.2, time);
      filter.Q.setValueAtTime(3.5, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.08 / (idx * 0.2 + 1), time + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration + 0.05);
      osc2.stop(time + duration + 0.05);
    });
  };

  // 21. Tier 7 (x150 - x199): Cyber-Prog Synth Lead with Octave Filter Sweep
  const scheduleCyberProgLead = (
    ctx: AudioContext,
    time: number,
    freq: number,
    out: GainNode,
    duration = STEP_TIME * 1.8,
  ) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq * 2.002, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, time);
    filter.frequency.exponentialRampToValueAtTime(5200, time + duration * 0.35);
    filter.frequency.exponentialRampToValueAtTime(900, time + duration);
    filter.Q.setValueAtTime(4.8, time);

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.12, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(out);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration + 0.05);
    osc2.stop(time + duration + 0.05);
  };

  // 22. Tier 8 (x200+): Majestic Celestial Symphony & Triumphant Brass Climax
  const scheduleCelestialSymphony = (
    ctx: AudioContext,
    time: number,
    freqs: number[],
    out: GainNode,
    duration: number,
  ) => {
    freqs.forEach((freq, idx) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const oscShimmer = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, time);
      oscShimmer.type = 'sine';
      oscShimmer.frequency.setValueAtTime(freq * 4.01, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, time);
      filter.frequency.linearRampToValueAtTime(4800, time + duration * 0.4);
      filter.frequency.exponentialRampToValueAtTime(1400, time + duration);
      filter.Q.setValueAtTime(2.0, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.09 / (idx * 0.2 + 1), time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      oscShimmer.connect(filter);
      filter.connect(gain);
      gain.connect(out);

      osc1.start(time);
      osc2.start(time);
      oscShimmer.start(time);
      osc1.stop(time + duration + 0.08);
      osc2.stop(time + duration + 0.08);
      oscShimmer.stop(time + duration + 0.08);
    });
  };

  // --------------------------------------------------------------------------
  // 128-MEASURE MULTI-MOVEMENT HARMONIC PROGRESSIONS (D Minor / F Major)
  // --------------------------------------------------------------------------

  // 1. Chords per Bar across 4 Movements (128 bars total)
  const getChordForBar = (bar: number): number[] => {
    const b = bar % 128;

    // Movement 1: Verse (Bars 0 - 31)
    // Dm7 -> Bbmaj7 -> Fmaj7 -> C7 (4-bar loops with 7th/9th extensions)
    if (b < 32) {
      const mod = b % 4;
      if (mod === 0) return [NOTES.D3, NOTES.F3, NOTES.A3, NOTES.C4]; // Dm7
      if (mod === 1) return [NOTES.Bb2, NOTES.D3, NOTES.F3, NOTES.A3]; // Bbmaj7
      if (mod === 2) return [NOTES.F2, NOTES.A2, NOTES.C3, NOTES.E3]; // Fmaj7
      return [NOTES.C3, NOTES.E3, NOTES.G3, NOTES.Bb3]; // C7
    }

    // Movement 2: Chorus (Bars 32 - 63)
    // 8-Bar Anthem: Dm9 -> C/E -> Fmaj7 -> Bbmaj7 -> Gm7 -> Am7 -> Bbmaj7 -> C7sus4
    if (b < 64) {
      const mod = b % 8;
      if (mod === 0) return [NOTES.D3, NOTES.F3, NOTES.A3, NOTES.E4]; // Dm9
      if (mod === 1) return [NOTES.E3, NOTES.G3, NOTES.C4, NOTES.E4]; // C/E
      if (mod === 2) return [NOTES.F3, NOTES.A3, NOTES.C4, NOTES.E4]; // Fmaj7
      if (mod === 3) return [NOTES.Bb2, NOTES.D3, NOTES.F3, NOTES.A3]; // Bbmaj7
      if (mod === 4) return [NOTES.G2, NOTES.Bb2, NOTES.D3, NOTES.F3]; // Gm7
      if (mod === 5) return [NOTES.A2, NOTES.C3, NOTES.E3, NOTES.G3]; // Am7
      if (mod === 6) return [NOTES.Bb2, NOTES.D3, NOTES.F3, NOTES.Bb3]; // Bbmaj
      return [NOTES.C3, NOTES.F3, NOTES.G3, NOTES.Bb3]; // C7sus4
    }

    // Movement 3: Bridge (Bars 64 - 95)
    // 8-Bar Jazz/Modal Transformation: Bbmaj7 -> C/Bb -> Am7 -> Dm7 -> Gm9 -> F/A -> Bbmaj7 -> C9
    if (b < 96) {
      const mod = b % 8;
      if (mod === 0) return [NOTES.Bb2, NOTES.D3, NOTES.F3, NOTES.A3]; // Bbmaj7
      if (mod === 1) return [NOTES.Bb2, NOTES.C3, NOTES.E3, NOTES.G3]; // C/Bb
      if (mod === 2) return [NOTES.A2, NOTES.C3, NOTES.E3, NOTES.G3]; // Am7
      if (mod === 3) return [NOTES.D3, NOTES.F3, NOTES.A3, NOTES.C4]; // Dm7
      if (mod === 4) return [NOTES.G2, NOTES.Bb2, NOTES.D3, NOTES.A3]; // Gm9
      if (mod === 5) return [NOTES.A2, NOTES.C3, NOTES.F3, NOTES.A3]; // F/A
      if (mod === 6) return [NOTES.Bb2, NOTES.D3, NOTES.F3, NOTES.A3]; // Bbmaj7
      return [NOTES.C3, NOTES.E3, NOTES.G3, NOTES.D4]; // C9
    }

    // Movement 4: Breakdown & Build-up / Climax (Bars 96 - 127)
    // Bars 96-111: Deep Space Ambient Breakdown (Dm -> Bb -> Gm -> A7alt)
    if (b < 112) {
      const mod = b % 4;
      if (mod === 0) return [NOTES.D3, NOTES.F3, NOTES.A3, NOTES.D4]; // Dm
      if (mod === 1) return [NOTES.Bb2, NOTES.D3, NOTES.F3, NOTES.Bb3]; // Bb
      if (mod === 2) return [NOTES.G2, NOTES.Bb2, NOTES.D3, NOTES.G3]; // Gm
      return [NOTES.A2, NOTES.C3, NOTES.E3, NOTES.G3]; // A7
    }

    // Bars 112-127: Dramatic Build-up (Ascending Tension: Dm -> Em7 -> Fmaj7 -> G7 -> A7alt -> Bbmaj7 -> C9 -> Dm Climax)
    const buildIdx = b - 112;
    const buildProgressions = [
      [NOTES.D3, NOTES.F3, NOTES.A3, NOTES.C4], // 112: Dm7
      [NOTES.D3, NOTES.F3, NOTES.A3, NOTES.D4], // 113: Dm
      [NOTES.E3, NOTES.G3, NOTES.B4, NOTES.D4], // 114: Em7
      [NOTES.E3, NOTES.G3, NOTES.B4, NOTES.E4], // 115: Em7
      [NOTES.F3, NOTES.A3, NOTES.C4, NOTES.E4], // 116: Fmaj7
      [NOTES.F3, NOTES.A3, NOTES.C4, NOTES.F4], // 117: Fmaj
      [NOTES.G3, NOTES.B4, NOTES.D4, NOTES.F4], // 118: G7
      [NOTES.G3, NOTES.B4, NOTES.D4, NOTES.G4], // 119: G
      [NOTES.A3, NOTES.C4, NOTES.E4, NOTES.G4], // 120: Am7
      [NOTES.A3, NOTES.C5, NOTES.E4, NOTES.G4], // 121: A7alt
      [NOTES.Bb3, NOTES.D4, NOTES.F4, NOTES.A4], // 122: Bbmaj7
      [NOTES.Bb3, NOTES.D4, NOTES.F4, NOTES.Bb4], // 123: Bbmaj
      [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.Bb4], // 124: C7
      [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.D5], // 125: C9
      [NOTES.A3, NOTES.C5, NOTES.E4, NOTES.A4], // 126: A7 intense
      [NOTES.D3, NOTES.F3, NOTES.A3, NOTES.D5], // 127: Climax turnaround
    ];
    return buildProgressions[buildIdx % buildProgressions.length];
  };

  // 2. Bassline Notes per Step across Movements
  const getBassNoteForStep = (step: number): number => {
    const bar = Math.floor(step / 16);
    const subStep = step % 16;
    const b = bar % 128;

    // Movement 1: Verse (Bars 0-31)
    if (b < 32) {
      let root = NOTES.D2;
      let fifth = NOTES.A2;
      let oct = NOTES.D3;
      if (b % 4 === 1) { root = NOTES.Bb1; fifth = NOTES.F2; oct = NOTES.Bb2; }
      else if (b % 4 === 2) { root = NOTES.F1; fifth = NOTES.C2; oct = NOTES.F2; }
      else if (b % 4 === 3) { root = NOTES.C2; fifth = NOTES.G2; oct = NOTES.C3; }

      const pat1 = [root, root, fifth, root, root, oct, fifth, root, root, root, fifth, root, fifth, oct, root, fifth];
      const pat2 = [root, fifth, root, oct, root, fifth, oct, root, fifth, root, fifth, oct, root, root, fifth, oct];
      return (bar % 2 === 0 ? pat1 : pat2)[subStep] || root;
    }

    // Movement 2: Chorus (Bars 32-63) — Driving 16th-note syncopated groove
    if (b < 64) {
      const roots = [NOTES.D2, NOTES.E2, NOTES.F2, NOTES.Bb1, NOTES.G1, NOTES.A1, NOTES.Bb1, NOTES.C2];
      const fifths = [NOTES.A2, NOTES.B2, NOTES.C3, NOTES.F2, NOTES.D2, NOTES.E2, NOTES.F2, NOTES.G2];
      const root = roots[b % 8];
      const fifth = fifths[b % 8];

      const chorusPat = [root, root, root, fifth, root, root, fifth, root, root, root, root, fifth, root, fifth, root, fifth];
      return chorusPat[subStep] || root;
    }

    // Movement 3: Bridge (Bars 64-95) — Walking Funk Bassline
    if (b < 96) {
      const roots = [NOTES.Bb1, NOTES.Bb1, NOTES.A1, NOTES.D2, NOTES.G1, NOTES.A1, NOTES.Bb1, NOTES.C2];
      const root = roots[b % 8];
      const oct = root * 2;
      const walkNotes = [root, root, oct, root, root, root * 1.5, oct, root, root, root * 1.25, root * 1.5, oct, root, root * 1.5, oct, root];
      return walkNotes[subStep] || root;
    }

    // Movement 4: Breakdown (Bars 96-111) & Build-up (Bars 112-127)
    if (b < 112) {
      // Breakdown: Long sustained sub roots
      const roots = [NOTES.D1, NOTES.Bb0, NOTES.G0 || NOTES.G1, NOTES.A0 || NOTES.A1];
      return roots[b % 4];
    } else {
      // Build-up: Rapid driving 16th bass climbing with each bar
      const buildRoots = [
        NOTES.D2, NOTES.D2, NOTES.E2, NOTES.E2,
        NOTES.F2, NOTES.F2, NOTES.G2, NOTES.G2,
        NOTES.A2, NOTES.A2, NOTES.Bb2, NOTES.Bb2,
        NOTES.C3, NOTES.C3, NOTES.A2, NOTES.D3,
      ];
      return buildRoots[(b - 112) % buildRoots.length];
    }
  };

  // 3. Arpeggiator note generator across movements
  const getArpNoteForStep = (step: number): number => {
    const bar = Math.floor(step / 16);
    const subStep = step % 16;
    const chord = getChordForBar(bar);

    const expanded = [chord[0] * 2, chord[1] * 2, chord[2] * 2, chord[3] * 2];
    const idx = subStep < 8 ? subStep % 4 : (7 - (subStep % 4)) % 4;
    return expanded[idx] || chord[0] * 2;
  };

  // 4. Dynamic Drum Fill Scheduler (Every 8 and 16 bars)
  const scheduleDrumFills = (
    ctx: AudioContext,
    time: number,
    bar: number,
    subStep: number,
    kick: GainNode,
    snare: GainNode,
  ) => {
    const is8BarFill = bar % 8 === 7 && subStep >= 12;
    const is16BarFill = bar % 16 === 15 && subStep >= 8;
    const isBuildUpClimax = bar === 127;

    if (isBuildUpClimax) {
      // Massive 128-bar loop turnaround fill
      if (subStep % 2 === 0) {
        scheduleKick(ctx, time, kick, 1.2);
        scheduleSnare(ctx, time, snare, 1.3, 240);
      } else {
        scheduleTom(ctx, time, kick, 220 - subStep * 8, 0.12);
      }
      return true;
    }

    if (is16BarFill) {
      // 16-bar turnaround fill (Triplet tom rolls & snare flams)
      if (subStep === 8 || subStep === 10 || subStep === 12 || subStep === 14) {
        scheduleSnare(ctx, time, snare, 1.1, 190 + (subStep - 8) * 12);
      }
      if (subStep === 9 || subStep === 11 || subStep === 13 || subStep === 15) {
        scheduleTom(ctx, time, kick, 180 - (subStep - 9) * 10, 0.14);
      }
      return true;
    }

    if (is8BarFill) {
      // 8-bar transition fill (4-step stutter kick + snare roll)
      if (subStep === 12 || subStep === 14) {
        scheduleKick(ctx, time, kick, 1.1);
      }
      if (subStep === 13 || subStep === 15) {
        scheduleSnare(ctx, time, snare, 1.15, 210);
      }
      return true;
    }

    return false;
  };

  // Step Sequencer Tick (2048 Steps ~ 128 Bars)
  const scheduleStep = (step: number, time: number) => {
    const ctx = audioCtxRef.current;
    const stems = stemGainsRef.current;
    const {
      kick,
      snare,
      rollingBass,
      stage1Epiano,
      stage1Marimba,
      stage2Acoustic,
      stage2Pluck,
      stage3Strings,
      stage3GlideLead,
      stage4Bells,
      stage4Arp,
      stage5LunarSub,
      stage5Triumph,
      tier1Perc,
      tier2FunkBass,
      tier3GuitarArp,
      tier4CounterLead,
      tier5BrassPad,
      tier6CosmicChoir,
      tier7CyberProgLead,
      tier8CelestialSymphony,
    } = stems;

    if (!ctx || !kick || !snare || !rollingBass) return;

    const subStep = step % 16;
    const bar = Math.floor(step / 16);
    const b = bar % 128;
    const chord = getChordForBar(bar);

    const isBreakdown = b >= 96 && b < 112;
    const isBuildUp = b >= 112 && b < 128;

    // --- 1. DRUMS & PERCUSSION ---
    const handledByFill = scheduleDrumFills(ctx, time, bar, subStep, kick, snare);

    if (!handledByFill) {
      if (isBreakdown) {
        // Breakdown: Gentle pulse on beat 1 only
        if (subStep === 0 && b % 2 === 0) {
          scheduleKick(ctx, time, kick, 0.65);
        }
        if (subStep % 4 === 2) {
          scheduleHat(ctx, time, snare, false, 0.04);
        }
      } else if (isBuildUp) {
        // Build-up: Accelerating snare roll & four-on-the-floor kick
        if (subStep % 4 === 0) {
          scheduleKick(ctx, time, kick, 1.05 + (b - 112) * 0.015);
        }
        const snareDensity = b >= 124 ? 1 : b >= 120 ? 2 : 4;
        if (subStep % snareDensity === 0) {
          scheduleSnare(ctx, time, snare, 0.6 + (b - 112) * 0.03, 170 + (b - 112) * 5);
        }
        if (subStep % 2 === 1) {
          scheduleHat(ctx, time, snare, true, 0.08);
        }
      } else {
        // Standard Grooves (Verse, Chorus, Bridge)
        const isChorus = b >= 32 && b < 64;
        // Four on the floor + syncopated ghost kicks
        if (subStep === 0 || subStep === 4 || subStep === 8 || subStep === 12 || (isChorus && subStep === 10) || (bar % 4 === 3 && (subStep === 14 || subStep === 15))) {
          scheduleKick(ctx, time, kick, subStep === 0 ? 1.0 : 0.85);
        }
        // Snare on 2 and 4 (subSteps 4 and 12) + ghost snare on 15
        if (subStep === 4 || subStep === 12) {
          scheduleSnare(ctx, time, snare, 1.0);
        } else if (subStep === 15 && bar % 2 === 1) {
          scheduleSnare(ctx, time, snare, 0.45, 230);
        }
        // Hi-Hats: 16th note pattern with open hat accents
        if (subStep % 2 === 1) {
          const isOpen = isChorus ? (subStep === 2 || subStep === 6 || subStep === 10 || subStep === 14) : subStep % 4 === 2;
          scheduleHat(ctx, time, snare, isOpen, isChorus ? 0.09 : 0.065);
        }
      }
    }

    // --- 2. BASE BASSLINE ---
    const bassNote = getBassNoteForStep(step);
    if (isBreakdown) {
      if (subStep === 0) {
        scheduleRollingBass(ctx, time, bassNote, rollingBass, false, STEP_TIME * 8);
      }
    } else {
      const isGritty = isBuildUp || (b >= 32 && b < 64 && subStep % 4 === 0);
      scheduleRollingBass(ctx, time, bassNote, rollingBass, isGritty, STEP_TIME * 0.95);
    }

    // --- 3. STAGE 1: HARBOR (Electric Piano Chords & Coastal Marimba) ---
    if (stage1Epiano && subStep === 0 && (bar % 2 === 0 || isBreakdown)) {
      scheduleEpiano(ctx, time, chord, stage1Epiano, STEP_TIME * 28);
    }
    if (stage1Marimba && (subStep === 2 || subStep === 6 || subStep === 10 || subStep === 14) && !isBreakdown) {
      const marimbaPool = [NOTES.A4, NOTES.C5, NOTES.D5, NOTES.F5, NOTES.G5, NOTES.A5];
      const mNote = marimbaPool[(step + bar) % marimbaPool.length];
      scheduleMarimba(ctx, time, mNote, stage1Marimba);
    }

    // --- 4. STAGE 2: SKY (Acoustic Rhythm Guitar & Breezy Synth Pluck) ---
    if (stage2Acoustic && (subStep === 0 || subStep === 6 || subStep === 10) && !isBreakdown) {
      scheduleAcousticStrum(ctx, time, chord, stage2Acoustic, STEP_TIME * 5);
    }
    if (stage2Pluck && !isBreakdown) {
      const melodyChorus = [NOTES.D5, NOTES.F5, NOTES.A5, NOTES.C6, NOTES.Bb5, NOTES.A5, NOTES.G5, NOTES.F5];
      const melodyVerse = [NOTES.D5, NOTES.F5, NOTES.A5, NOTES.G5, NOTES.F5, NOTES.E5, NOTES.D5, NOTES.C5];
      const chosenMelody = b >= 32 && b < 64 ? melodyChorus : melodyVerse;
      if (subStep % 2 === 0) {
        scheduleSynthPluck(ctx, time, chosenMelody[(subStep / 2 + bar) % chosenMelody.length], stage2Pluck, STEP_TIME * 1.8);
      }
    }

    // --- 5. STAGE 3: STRATOSPHERE (Twilight Strings & Airy Glide Lead) ---
    if (stage3Strings && subStep === 0 && bar % 2 === 0) {
      scheduleTwilightStrings(ctx, time, chord, stage3Strings, STEP_TIME * 30);
    }
    if (stage3GlideLead && (subStep === 0 || subStep === 8)) {
      const glidePairs = [
        [NOTES.D5, NOTES.F5],
        [NOTES.G5, NOTES.A5],
        [NOTES.F5, NOTES.E5],
        [NOTES.C5, NOTES.D5],
        [NOTES.A5, NOTES.C6],
        [NOTES.Bb5, NOTES.A5],
      ];
      const pair = glidePairs[bar % glidePairs.length];
      scheduleAiryGlideLead(ctx, time, pair[0], pair[1], stage3GlideLead, STEP_TIME * 7);
    }

    // --- 6. STAGE 4: COSMOS (Celestial Bells & Cosmic Arpeggiator) ---
    if (stage4Bells && (subStep === 0 || subStep === 6 || subStep === 12)) {
      const bellPool = [NOTES.D6, NOTES.F6, NOTES.A6, NOTES.C6, NOTES.E6, NOTES.G6];
      scheduleCelestialBells(ctx, time, bellPool[(subStep + bar) % bellPool.length], stage4Bells);
    }
    if (stage4Arp && !isBreakdown) {
      const arpFreq = getArpNoteForStep(step);
      scheduleCosmicArp(ctx, time, arpFreq * 1.5, stage4Arp);
    }

    // --- 7. STAGE 5: ASTEROID BELT & LUNAR ORBIT (Lunar Sub Pulse & Triumph Chords) ---
    if (stage5LunarSub && subStep === 0) {
      scheduleLunarSubPulse(ctx, time, bassNote * 0.5, stage5LunarSub);
    }
    if (stage5Triumph && subStep === 0 && bar % 2 === 0) {
      scheduleTriumphChords(ctx, time, [chord[0] * 2, chord[1] * 2, chord[2] * 2, chord[3] * 2], stage5Triumph, STEP_TIME * 30);
    }

    // --- 8. COMBO TIER STEMS (1 to 5) ---
    if (tier1Perc) {
      scheduleHat(ctx, time, tier1Perc, false, 0.07);
    }
    if (tier2FunkBass && !isBreakdown) {
      scheduleFunkBass(ctx, time, bassNote * 2, tier2FunkBass);
    }
    if (tier3GuitarArp && !isBreakdown) {
      const gArpFreq = getArpNoteForStep(step);
      scheduleGuitarArp(ctx, time, gArpFreq, tier3GuitarArp, STEP_TIME * 1.5);
    }
    if (tier4CounterLead && !isBreakdown) {
      const counterMap: Record<number, number> = {
        0: NOTES.A4,
        3: NOTES.C5,
        6: NOTES.D5,
        10: NOTES.F5,
        12: NOTES.E5,
        14: NOTES.D5,
      };
      if (counterMap[subStep]) {
        scheduleCounterLead(ctx, time, counterMap[subStep], tier4CounterLead, STEP_TIME * 2.5);
      }
    }
    if (tier5BrassPad && subStep === 0) {
      scheduleBrassPad(ctx, time, chord[0], tier5BrassPad, STEP_TIME * 14);
      scheduleBrassPad(ctx, time, chord[2], tier5BrassPad, STEP_TIME * 14);
    }
    if (tier6CosmicChoir && (subStep === 0 || subStep === 8)) {
      scheduleCosmicChoir(ctx, time, [chord[0] * 2, chord[1] * 2, chord[2] * 2, chord[3] * 2], tier6CosmicChoir, STEP_TIME * 7.5);
    }
    if (tier7CyberProgLead && !isBreakdown) {
      const progMelody = [NOTES.D5, NOTES.F5, NOTES.G5, NOTES.A5, NOTES.C6, NOTES.A5, NOTES.F5, NOTES.D5];
      const note = progMelody[(subStep + bar * 2) % progMelody.length];
      if (subStep % 2 === 0) {
        scheduleCyberProgLead(ctx, time, note, tier7CyberProgLead, STEP_TIME * 1.7);
      }
    }
    if (tier8CelestialSymphony && subStep === 0) {
      scheduleCelestialSymphony(ctx, time, [chord[0], chord[1], chord[2], chord[3], chord[0] * 2], tier8CelestialSymphony, STEP_TIME * 15.5);
    }
  };

  // Sequencer loop runner
  useEffect(() => {
    if (!isPlaying) {
      if (schedulerTimerRef.current) {
        clearInterval(schedulerTimerRef.current);
        schedulerTimerRef.current = null;
      }
      return;
    }

    const ctx = initAudio();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    if (nextStepTimeRef.current < ctx.currentTime) {
      nextStepTimeRef.current = ctx.currentTime + 0.05;
      currentStepRef.current = 0;
    }

    schedulerTimerRef.current = window.setInterval(() => {
      const audioCtx = audioCtxRef.current;
      if (!audioCtx || !isPlayingRef.current) return;

      while (nextStepTimeRef.current < audioCtx.currentTime + LOOKAHEAD_SEC) {
        scheduleStep(currentStepRef.current, nextStepTimeRef.current);
        nextStepTimeRef.current += STEP_TIME;
        currentStepRef.current = (currentStepRef.current + 1) % TOTAL_STEPS;
      }
    }, SCHEDULER_INTERVAL_MS);

    return () => {
      if (schedulerTimerRef.current) {
        clearInterval(schedulerTimerRef.current);
        schedulerTimerRef.current = null;
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    const handleVisibility = () => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (document.hidden) {
        if (ctx.state === 'running') {
          void ctx.suspend().catch(() => {});
        }
      } else if (isPlayingRef.current) {
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (schedulerTimerRef.current) {
        clearInterval(schedulerTimerRef.current);
        schedulerTimerRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, []);

  return null;
}

// tslint:disable-next-line:no-default-export
export default BackgroundMusic;
