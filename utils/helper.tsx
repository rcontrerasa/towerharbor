// tslint:disable
/* eslint-disable */
import React, {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';

/**  --- Overlay component ---
 * A full-screen UI overlay component used to display game states
 * such as Start Menus, Pause Screens, Game Over, and Victory screens.
 * It renders a semi-transparent background with a title, optional description,
 * and a primary action button.
 */

type OverlayTone = 'neutral' | 'danger' | 'victory';

interface OverlayProps {
  title: string;
  description?: string;
  actionLabel: string;
  onAction: () => void;
  icon?: React.ReactNode;
  tone?: OverlayTone;
  autoFocus?: boolean;
}

const TONE_CLASS: Record<OverlayTone, string> = {
  neutral: 'bg-black/70',
  danger: 'bg-red-900/80',
  victory: 'bg-emerald-900/80',
};

const BUTTON_CLASS: Record<OverlayTone, string> = {
  neutral: 'hover:bg-yellow-400',
  danger: 'hover:bg-red-400',
  victory: 'hover:bg-emerald-400',
};

/**
 * @param title - The main, large heading text to display (e.g., "GAME OVER").
 * @param description - Optional subtitle text to display below the title (e.g., "Final Score: 42").
 * @param actionLabel - The text to display inside the primary action button (e.g., "PLAY AGAIN").
 * @param onAction - Callback function executed when the user clicks the primary action button.
 * @param icon - Optional React node (like a Lucide icon) rendered inside the action button next to the label.
 * @param tone - The visual theme of the overlay which dictates background and hover colors. Defaults to 'neutral'. ('neutral' | 'danger' | 'victory')
 */
/** Focuses the referenced element on mount to ensure Enter works. */
export function useAutoFocus<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    // Only focus if enabled is true
    if (enabled && ref.current) {
      ref.current.focus();
    }
  }, [enabled]);
  return ref;
}

export function Overlay({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  tone = 'neutral',
  autoFocus = true,
}: OverlayProps) {
  const buttonRef = useAutoFocus<HTMLButtonElement>(autoFocus);

  return (
    <div
      className={`absolute inset-0 ${TONE_CLASS[tone]} overflow-y-auto touch-auto`}>
      <div className="min-h-full flex flex-col items-center p-4">
        <div className="m-auto flex flex-col items-center w-full max-w-md">
          <h1 className="text-3xl md:text-5xl font-black mb-4 text-yellow-400 text-center">
            {title}
          </h1>
          {description && (
            <p className="text-lg md:text-2xl mb-8 text-center">
              {description}
            </p>
          )}
          <button
            ref={buttonRef}
            autoFocus={autoFocus}
            onClick={onAction}
            data-testid="start-button"
            className={`bg-white text-black px-6 md:px-8 py-2 md:py-3 rounded-full font-bold text-lg md:text-xl transition-colors flex items-center gap-2 ${BUTTON_CLASS[tone]}`}>
            {icon}
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface MenuOverlayProps {
  children: React.ReactNode;
  tone?: OverlayTone;
  zIndex?: number;
}

/**
 * A highly resilient menu wrapper that statically decouples scrolling from flexbox alignment.
 * It strictly avoids the clipping bug on mobile by preventing flex justify-center from being assigned
 * to the overflow-y-auto boundary. Plugs seamlessly into the AI's generation workflows.
 * The inner children should provide their own box styling (e.g., w-full max-w-md bg-slate-900 rounded).
 */
export function MenuOverlay({
  children,
  tone = 'neutral',
  zIndex = 40,
}: MenuOverlayProps) {
  return (
    <div
      className={`absolute inset-0 ${TONE_CLASS[tone]} overflow-y-auto touch-auto`}
      style={{zIndex}}>
      <div className="min-h-full flex flex-col items-center p-4">
        <div className="m-auto w-full max-w-md flex flex-col items-center">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Actions that can be triggered by the user. */
export type InputAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'confirm'
  | 'cancel'
  | 'tap';

/** Represents the state of the pointer (mouse or touch). */
export interface PointerState {
  /** The X coordinate of the pointer. */
  x: number;
  /** The Y coordinate of the pointer. */
  y: number;
  /** Whether the pointer is currently pressed down. */
  down: boolean;
}

/** A snapshot of the input state at a specific frame. */
export interface InputSnapshot {
  /** Map of actions to their active state. */
  actions: Record<InputAction, boolean>;
  /** The current state of the pointer. */
  pointer: PointerState;
}

interface LogicalSize {
  width: number;
  height: number;
}

const ACTION_KEYS: Record<string, InputAction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down',
  Enter: 'confirm',
  ' ': 'confirm',
  Escape: 'cancel',
};

/**
 * Initializes all input actions to a default 'false' state.
 */
const createEmptyActions = (): Record<InputAction, boolean> => ({
  left: false,
  right: false,
  up: false,
  down: false,
  confirm: false,
  cancel: false,
  tap: false,
});

/**
 * Calculates the pointer's logical X/Y coordinates on the canvas.
 */
const getPointerPosition = (
  event: PointerEvent,
  canvas: HTMLCanvasElement,
  logicalSize?: LogicalSize,
): {x: number; y: number} => {
  const rect = canvas.getBoundingClientRect();
  const width = logicalSize?.width ?? rect.width;
  const height = logicalSize?.height ?? rect.height;
  const x = (event.clientX - rect.left) * (width / rect.width);
  const y = (event.clientY - rect.top) * (height / rect.height);
  return {x, y};
};

/**
 * Hook to capture and manage user input (keyboard and pointer).
 * @param canvasRef Reference to the game canvas element.
 * @param enabled Whether input capture is enabled.
 * @param logicalSize Optional logical size of the canvas for coordinate scaling.
 * @returns A mutable ref containing the current input snapshot.
 */
export const useInput = (
  canvasRef: RefObject<HTMLCanvasElement>,
  enabled = true,
  logicalSize?: LogicalSize,
): MutableRefObject<InputSnapshot> => {
  const inputRef = useRef<InputSnapshot>({
    actions: createEmptyActions(),
    pointer: {x: 0, y: 0, down: false},
  });
  const logicalSizeRef = useRef(logicalSize);
  logicalSizeRef.current = logicalSize;

  useEffect(() => {
    if (!enabled) {
      inputRef.current.actions = createEmptyActions();
      inputRef.current.pointer = {x: 0, y: 0, down: false};
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const action = ACTION_KEYS[event.key];
      if (!action) return;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(
          event.key,
        )
      ) {
        event.preventDefault();
      }
      inputRef.current.actions[action] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const action = ACTION_KEYS[event.key];
      if (!action) return;
      inputRef.current.actions[action] = false;
    };

    const canvas = canvasRef.current;
    const handlePointerDown = (event: PointerEvent) => {
      if (!canvas) return;
      if (typeof canvas.setPointerCapture === 'function') {
        canvas.setPointerCapture(event.pointerId);
      }
      inputRef.current.pointer = {
        ...getPointerPosition(event, canvas, logicalSizeRef.current),
        down: true,
      };
      inputRef.current.actions.tap = true;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!canvas) return;
      inputRef.current.pointer = {
        ...getPointerPosition(event, canvas, logicalSizeRef.current),
        down: inputRef.current.pointer.down,
      };
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!canvas) return;
      if (
        typeof canvas.releasePointerCapture === 'function' &&
        canvas.hasPointerCapture(event.pointerId)
      ) {
        canvas.releasePointerCapture(event.pointerId);
      }
      inputRef.current.pointer = {
        ...getPointerPosition(event, canvas, logicalSizeRef.current),
        down: false,
      };
      inputRef.current.actions.tap = false;
    };

    const handleBlur = () => {
      inputRef.current.actions = createEmptyActions();
      if (inputRef.current.pointer) {
        inputRef.current.pointer.down = false;
      }
      inputRef.current.actions.tap = false;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBlur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (canvas) {
      canvas.addEventListener('pointerdown', handlePointerDown);
      canvas.addEventListener('pointermove', handlePointerMove);
      canvas.addEventListener('pointerup', handlePointerUp);
      canvas.addEventListener('pointercancel', handlePointerUp);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (canvas) {
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointermove', handlePointerMove);
        canvas.removeEventListener('pointerup', handlePointerUp);
        canvas.removeEventListener('pointercancel', handlePointerUp);
      }
    };
  }, [canvasRef, enabled]);

  return inputRef;
};

/**
 * audio.ts — procedural sound effects via the Web Audio API.
 */

interface Beat {
  ctx: AudioContext;
  out: GainNode;
  now: number;
}

class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxMaster: GainNode | null = null;
  private muted = false; // SFX muted
  private volume = 0.6; // master volume, 0..1

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('playground-mute', (e: Event) => {
        const customEvent = e as CustomEvent<{muted: boolean}>;
        this.setMuted(customEvent.detail.muted);
      });
    }
  }

  // --- Context lifecycle -----------------------------------------------------

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;

    const Ctor =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext?: typeof AudioContext})
        .webkitAudioContext;
    if (!Ctor) {
      console.warn('[audio] Web Audio API not supported');
      return null;
    }

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.sfxMaster = this.ctx.createGain();
    this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.sfxMaster.gain.setValueAtTime(
      this.muted ? 0 : 1,
      this.ctx.currentTime,
    );
    this.sfxMaster.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.attachUnlock();
    return this.ctx;
  }

  private attachUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      void this.ctx?.resume().catch(() => {});
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  resume() {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {});
  }

  private begin(): Beat | null {
    const ctx = this.ensure();
    const out = this.sfxMaster;
    if (!ctx || !out || this.muted) return null;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return {ctx, out, now: ctx.currentTime};
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx && !this.muted) {
      this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.sfxMaster && this.ctx) {
      this.sfxMaster.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
    }
  }

  getMuteState(): boolean {
    return this.muted;
  }

  private blip(
    b: Beat,
    at: number,
    o: {
      freq: number;
      freqTo?: number;
      dur: number;
      type?: OscillatorType;
      gain?: number;
      glide?: 'exp' | 'lin';
    },
  ) {
    const {ctx, out} = b;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.freq, at);
    if (o.freqTo !== undefined) {
      if ((o.glide ?? 'exp') === 'lin') {
        osc.frequency.linearRampToValueAtTime(o.freqTo, at + o.dur);
      } else {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(1, o.freqTo),
          at + o.dur,
        );
      }
    }

    const peak = o.gain ?? 0.15;
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);

    osc.connect(g);
    g.connect(out);
    osc.start(at);
    osc.stop(at + o.dur + 0.02);
  }

  private noiseBurst(
    b: Beat,
    at: number,
    o: {dur: number; gain?: number; from?: number; to?: number},
  ) {
    const {ctx, out} = b;
    const len = Math.max(1, Math.floor(ctx.sampleRate * o.dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(o.from ?? 1000, at);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(1, o.to ?? 80),
      at + o.dur,
    );

    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain ?? 0.18, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(out);
    src.start(at);
    src.stop(at + o.dur);
  }

  private vary(amount = 0.05): number {
    return 1 + (Math.random() * 2 - 1) * amount;
  }

  playTone(o: {
    type?: OscillatorType;
    freq: number;
    freqTo?: number;
    dur?: number;
    gain?: number;
  }) {
    const b = this.begin();
    if (!b) return;
    this.blip(b, b.now, {
      type: o.type,
      freq: o.freq,
      freqTo: o.freqTo,
      dur: o.dur ?? 0.15,
      gain: o.gain,
    });
  }

  playOceanWaveWash(variation?: number) {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.08);
    const chosen = variation !== undefined ? variation : Math.floor(Math.random() * 3);

    const dur = chosen === 0 ? 3.8 : chosen === 1 ? 2.8 : 2.0;
    const peakGain = chosen === 0 ? 0.12 : chosen === 1 ? 0.09 : 0.06;
    const startFreq = chosen === 0 ? 110 : chosen === 1 ? 160 : 220;
    const peakFreq = chosen === 0 ? 460 : chosen === 1 ? 620 : 780;

    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'lowpass';
    lowFilter.frequency.setValueAtTime(startFreq * v, now);
    lowFilter.frequency.exponentialRampToValueAtTime(peakFreq * v, now + dur * 0.4);
    lowFilter.frequency.exponentialRampToValueAtTime((startFreq * 0.8) * v, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + dur * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(lowFilter);
    lowFilter.connect(gain);
    gain.connect(out);
    src.start(now);
    src.stop(now + dur);
  }

  playTugboatEngine() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.06);

    const baseFreq = 58 + Math.random() * 14;
    [0, 0.12, 0.24].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime((baseFreq + idx * 3.5) * v, now + offset);
      osc.frequency.exponentialRampToValueAtTime((baseFreq * 0.6) * v, now + offset + 0.08);

      gain.gain.setValueAtTime(0.06, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.09);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);

      this.noiseBurst(b, now + offset, {
        dur: 0.05,
        gain: 0.04,
        from: 260 * v,
        to: 35 * v,
      });
    });
  }

  playBuoyBell() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.04);

    const bellPairs = [
      [1864.66, 3729.31, 2093.00, 4186.01],
      [1567.98, 3135.96, 1760.00, 3520.00],
      [2217.46, 4434.92, 2489.02, 4978.03],
    ];
    const pair = bellPairs[Math.floor(Math.random() * bellPairs.length)];
    const delay = 0.18 + Math.random() * 0.08;

    [pair[0], pair[1]].forEach((freq, fIdx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * v, now);
      
      const peak = fIdx === 0 ? 0.05 : 0.022;
      gain.gain.setValueAtTime(peak, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.6);
    });

    [pair[2], pair[3]].forEach((freq, fIdx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * v, now + delay);
      
      const peak = fIdx === 0 ? 0.045 : 0.018;
      gain.gain.setValueAtTime(peak, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.6);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now + delay);
      osc.stop(now + delay + 0.65);
    });
  }

  playWaterSplash() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.08);

    this.noiseBurst(b, now, {
      dur: 0.26,
      gain: 0.09,
      from: (1300 + Math.random() * 400) * v,
      to: 180 * v,
    });

    const drop = ctx.createOscillator();
    const dropGain = ctx.createGain();
    drop.type = 'sine';
    const startDropFreq = 500 + Math.random() * 250;
    drop.frequency.setValueAtTime(startDropFreq * v, now);
    drop.frequency.exponentialRampToValueAtTime((startDropFreq * 2.4) * v, now + 0.12);
    dropGain.gain.setValueAtTime(0.05, now);
    dropGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    drop.connect(dropGain);
    dropGain.connect(out);
    drop.start(now);
    drop.stop(now + 0.2);
  }

  playFoghorn() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.03);

    const isDeepBaritone = Math.random() < 0.5;
    const hornFrequencies = isDeepBaritone ? [65.41, 82.41] : [98.0, 123.47];
    const dur = isDeepBaritone ? 2.3 : 1.8;

    hornFrequencies.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * v, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isDeepBaritone ? 240 : 340, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.042, now + 0.35);
      gain.gain.setValueAtTime(0.042, now + dur * 0.65);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + dur + 0.1);
    });
  }

  playBalloonBurner() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.06);

    const style = Math.floor(Math.random() * 3);
    const dur = style === 0 ? 0.42 : style === 1 ? 0.85 : 0.6;

    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2.0, now);
    filter.frequency.setValueAtTime((400 + Math.random() * 100) * v, now);
    filter.frequency.linearRampToValueAtTime(750 * v, now + dur * 0.4);
    filter.frequency.exponentialRampToValueAtTime(180 * v, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    if (style === 2) {
      gain.gain.linearRampToValueAtTime(0.07, now + 0.1);
      gain.gain.linearRampToValueAtTime(0.02, now + 0.25);
      gain.gain.linearRampToValueAtTime(0.075, now + 0.38);
    } else {
      gain.gain.linearRampToValueAtTime(0.075, now + 0.15);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(now);
    src.stop(now + dur);
  }

  playSeagullCall() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.09);
    const variation = Math.floor(Math.random() * 4);

    if (variation === 0) {
      [0, 0.12].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const startF = (1800 + idx * 300) * v;
        osc.frequency.setValueAtTime(startF, now + offset);
        osc.frequency.linearRampToValueAtTime(startF + 500, now + offset + 0.04);
        osc.frequency.exponentialRampToValueAtTime(startF * 0.75, now + offset + 0.1);

        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(0.045, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.1);

        osc.connect(gain);
        gain.connect(out);
        osc.start(now + offset);
        osc.stop(now + offset + 0.12);
      });
    } else if (variation === 1) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(1550 * v, now);
      osc1.frequency.linearRampToValueAtTime(2250 * v, now + 0.14);
      osc1.frequency.exponentialRampToValueAtTime(1350 * v, now + 0.35);

      osc2.frequency.setValueAtTime(1950 * v, now);
      osc2.frequency.linearRampToValueAtTime(2650 * v, now + 0.14);
      osc2.frequency.exponentialRampToValueAtTime(1750 * v, now + 0.35);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.038, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(out);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.4);
      osc2.stop(now + 0.4);
    } else if (variation === 2) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';

      osc.frequency.setValueAtTime(1250 * v, now);
      osc.frequency.exponentialRampToValueAtTime(2450 * v, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(1100 * v, now + 0.5);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.042, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.55);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400 * v, now);
      osc.frequency.linearRampToValueAtTime(2300 * v, now + 0.11);
      osc.frequency.exponentialRampToValueAtTime(1200 * v, now + 0.32);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.048, now + 0.07);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.38);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      const delay = 0.26;
      osc2.frequency.setValueAtTime(1650 * v, now + delay);
      osc2.frequency.linearRampToValueAtTime(2550 * v, now + delay + 0.09);
      osc2.frequency.exponentialRampToValueAtTime(1350 * v, now + delay + 0.28);

      gain2.gain.setValueAtTime(0.001, now + delay);
      gain2.gain.linearRampToValueAtTime(0.03, now + delay + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.3);

      osc2.connect(gain2);
      gain2.connect(out);
      osc2.start(now + delay);
      osc2.stop(now + delay + 0.32);
    }
  }

  playFlockChirp() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.09);

    const notes = [1760, 2349, 1975, 2637];
    notes.forEach((freq, idx) => {
      const offset = idx * (0.05 + Math.random() * 0.03);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * v, now + offset);
      osc.frequency.linearRampToValueAtTime((freq + 350 + Math.random() * 150) * v, now + offset + 0.03);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.8 * v, now + offset + 0.08);

      gain.gain.setValueAtTime(0.024, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.09);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);
    });
  }

  playWindGust() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.06);

    const dur = 1.6 + Math.random() * 0.6;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160 * v, now);
    filter.frequency.linearRampToValueAtTime((320 + Math.random() * 120) * v, now + dur * 0.45);
    filter.frequency.exponentialRampToValueAtTime(100 * v, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + dur * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(now);
    src.stop(now + dur);
  }

  playJetFlyby() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.07);

    const profile = Math.floor(Math.random() * 3);
    const dur = profile === 0 ? 1.6 : profile === 1 ? 1.2 : 0.95;
    const startF = profile === 0 ? 280 : profile === 1 ? 420 : 540;
    const peakF = profile === 0 ? 620 : profile === 1 ? 920 : 1350;
    const endF = profile === 0 ? 140 : profile === 1 ? 180 : 220;

    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(profile === 2 ? 3.0 : 2.0, now);
    filter.frequency.setValueAtTime(startF * v, now);
    filter.frequency.exponentialRampToValueAtTime(peakF * v, now + dur * 0.45);
    filter.frequency.exponentialRampToValueAtTime(endF * v, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + dur * 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(now);
    src.stop(now + dur);
  }

  playWeatherBalloonTelemetry() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.05);

    const notePool = [
      [1480, 2220, 1110],
      [1760, 1320, 2640],
      [1975, 2960, 1480],
    ];
    const notes = notePool[Math.floor(Math.random() * notePool.length)];

    notes.forEach((freq, idx) => {
      const offset = idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * v, now + offset);

      gain.gain.setValueAtTime(0.035, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.055);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now + offset);
      osc.stop(now + offset + 0.06);
    });
  }

  playAuroraChime() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.03);

    const chords = [
      [587.33, 880.00, 1174.66, 1760.00],
      [659.25, 987.77, 1318.51, 1975.53],
      [523.25, 783.99, 1046.50, 1567.98],
    ];
    const freqs = chords[Math.floor(Math.random() * chords.length)];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * v, now + idx * 0.08);

      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.03 / (idx + 1), now + idx * 0.08 + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 1.2);

      osc.connect(gain);
      gain.connect(out);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.3);
    });
  }

  playUfoHum() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.04);

    const lfoRates = [9, 14, 21];
    const chosenRate = lfoRates[Math.floor(Math.random() * lfoRates.length)];
    const startCarrier = (280 + Math.random() * 80) * v;

    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startCarrier, now);
    osc.frequency.linearRampToValueAtTime(startCarrier * 1.75, now + 0.6);
    osc.frequency.linearRampToValueAtTime(startCarrier * 0.8, now + 1.2);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(chosenRate, now);
    lfoGain.gain.setValueAtTime(40 + chosenRate * 1.5, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.048, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 1.25);
    lfo.stop(now + 1.25);
  }

  playCometFizz() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.06);

    const dur = 0.85;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2200 * v, now);
    filter.frequency.linearRampToValueAtTime(4800 * v, now + 0.35);
    filter.frequency.exponentialRampToValueAtTime(1400 * v, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    src.start(now);
    src.stop(now + dur);

    [0.08, 0.22, 0.42].forEach((offset, idx) => {
      this.blip(b, now + offset, {
        type: 'sine',
        freq: (2400 + idx * 650) * v,
        dur: 0.12,
        gain: 0.025,
      });
    });
  }

  playSpaceBeaconPing() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.03);

    const baseFreq = (1567.98 + (Math.random() - 0.5) * 120) * v;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);

    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  playCosmicResonance() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.04);

    const subFreq = (34 + Math.random() * 18) * v;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(subFreq, now);
    osc.frequency.exponentialRampToValueAtTime(subFreq * 0.7, now + 1.8);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.065, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 2.1);
  }

  playAsteroidRumble() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.05);

    const rumbleFreq = (28 + Math.random() * 14) * v;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(rumbleFreq, now);
    osc.frequency.linearRampToValueAtTime(rumbleFreq * 1.3, now + 0.8);
    osc.frequency.exponentialRampToValueAtTime(rumbleFreq * 0.6, now + 1.6);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(110, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 1.7);
  }

  playCelestialShootingStarChime() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.04);

    const chordPool = [
      [1318.51, 1661.22, 1975.53, 2637.02, 3322.44],
      [880.00, 1108.73, 1318.51, 1661.22, 1975.53],
      [1174.66, 1479.98, 1760.00, 2217.46, 2637.02],
      [739.99, 932.33, 1108.73, 1479.98, 1661.22],
    ];
    const freqs = chordPool[Math.floor(Math.random() * chordPool.length)];

    const shimmerBus = ctx.createGain();
    shimmerBus.gain.setValueAtTime(0.075, now);
    shimmerBus.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(4.2, now);
    filter.frequency.setValueAtTime(2400 * v, now);
    filter.frequency.exponentialRampToValueAtTime(5600 * v, now + 0.4);
    filter.frequency.exponentialRampToValueAtTime(1800 * v, now + 1.2);

    shimmerBus.connect(filter);
    filter.connect(out);

    freqs.forEach((freq, idx) => {
      const offset = idx * 0.045;
      const osc = ctx.createOscillator();
      const oscHarmonic = ctx.createOscillator();
      const g = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * v, now + offset);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.012 * v, now + offset + 0.45);

      oscHarmonic.type = 'triangle';
      oscHarmonic.frequency.setValueAtTime(freq * 2.008 * v, now + offset);

      const noteGain = 0.04 / (idx * 0.3 + 1);
      g.gain.setValueAtTime(0.001, now + offset);
      g.gain.linearRampToValueAtTime(noteGain, now + offset + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.65);

      osc.connect(g);
      oscHarmonic.connect(g);
      g.connect(shimmerBus);

      osc.start(now + offset);
      oscHarmonic.start(now + offset);
      osc.stop(now + offset + 0.7);
      oscHarmonic.stop(now + offset + 0.7);
    });

    const len = Math.max(1, Math.floor(ctx.sampleRate * 0.55));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(4500 * v, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(8200 * v, now + 0.22);
    noiseFilter.frequency.exponentialRampToValueAtTime(3000 * v, now + 0.55);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.02, now + 0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(out);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.58);
  }

  private getDistortionCurve(amount = 25): Float32Array {
    const n_samples = 4096;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  private jetGain: GainNode | null = null;
  private jetRumbleOsc1: OscillatorNode | null = null;
  private jetRumbleOsc2: OscillatorNode | null = null;
  private jetRumbleFilter: BiquadFilterNode | null = null;
  private jetTurbineOsc: OscillatorNode | null = null;
  private jetNoiseNode: AudioBufferSourceNode | null = null;
  private jetNoiseFilter: BiquadFilterNode | null = null;
  private jetPanner: StereoPannerNode | null = null;

  updateJetEngine(active: boolean, pan = 0, targetVol = 0.09, dopplerFactor = 1.0) {
    if (this.muted) {
      this.stopJetEngine();
      return;
    }
    const ctx = this.ensure();
    if (!ctx) return;

    if (!active) {
      if (this.jetGain) {
        this.jetGain.gain.setTargetAtTime(0, ctx.currentTime, 0.18);
      }
      return;
    }

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    if (!this.jetGain) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);

      let panner: StereoPannerNode | null = null;
      if (typeof ctx.createStereoPanner === 'function') {
        panner = ctx.createStereoPanner();
        g.connect(panner);
        panner.connect(this.sfxMaster || this.master || ctx.destination);
      } else {
        g.connect(this.sfxMaster || this.master || ctx.destination);
      }
      this.jetPanner = panner;

      const rumble1 = ctx.createOscillator();
      const rumble2 = ctx.createOscillator();
      const rumbleFilter = ctx.createBiquadFilter();
      
      rumble1.type = 'sawtooth';
      rumble1.frequency.setValueAtTime(118, ctx.currentTime);
      rumble2.type = 'triangle';
      rumble2.frequency.setValueAtTime(156, ctx.currentTime);

      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.setValueAtTime(260, ctx.currentTime);

      const rumbleGain = ctx.createGain();
      rumbleGain.gain.setValueAtTime(0.28, ctx.currentTime);

      rumble1.connect(rumbleFilter);
      rumble2.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(g);

      rumble1.start();
      rumble2.start();
      this.jetRumbleOsc1 = rumble1;
      this.jetRumbleOsc2 = rumble2;
      this.jetRumbleFilter = rumbleFilter;

      const whine = ctx.createOscillator();
      whine.type = 'sine';
      whine.frequency.setValueAtTime(680, ctx.currentTime);
      const whineGain = ctx.createGain();
      whineGain.gain.setValueAtTime(0.08, ctx.currentTime);
      whine.connect(whineGain);
      whineGain.connect(g);
      whine.start();
      this.jetTurbineOsc = whine;

      const bufferLen = Math.floor(ctx.sampleRate * 2.5);
      const noiseBuffer = ctx.createBuffer(1, bufferLen, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferLen; i++) data[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(850, ctx.currentTime);
      noiseFilter.Q.setValueAtTime(2.6, ctx.currentTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.32, ctx.currentTime);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(g);
      noise.start();
      this.jetNoiseNode = noise;
      this.jetNoiseFilter = noiseFilter;

      this.jetGain = g;
    }

    const clampedPan = Math.max(-0.95, Math.min(0.95, pan));
    if (this.jetPanner && 'pan' in this.jetPanner) {
      this.jetPanner.pan.setTargetAtTime(clampedPan, ctx.currentTime, 0.05);
    }

    const clampedDoppler = Math.max(0.70, Math.min(1.28, dopplerFactor));
    if (this.jetRumbleOsc1) {
      this.jetRumbleOsc1.frequency.setTargetAtTime(118 * clampedDoppler, ctx.currentTime, 0.06);
    }
    if (this.jetRumbleOsc2) {
      this.jetRumbleOsc2.frequency.setTargetAtTime(156 * clampedDoppler, ctx.currentTime, 0.06);
    }
    if (this.jetRumbleFilter) {
      this.jetRumbleFilter.frequency.setTargetAtTime(260 * clampedDoppler, ctx.currentTime, 0.06);
    }
    if (this.jetTurbineOsc) {
      this.jetTurbineOsc.frequency.setTargetAtTime(680 * clampedDoppler, ctx.currentTime, 0.06);
    }
    if (this.jetNoiseFilter) {
      this.jetNoiseFilter.frequency.setTargetAtTime(850 * clampedDoppler, ctx.currentTime, 0.06);
    }

    this.jetGain.gain.setTargetAtTime(targetVol, ctx.currentTime, 0.08);
  }

  stopJetEngine() {
    if (this.jetGain && this.ctx) {
      this.jetGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  playHeavyContainerLatch(isPerfect = false, combo = 0) {
    if (isPerfect && combo >= 2) {
      this.playTieredPerfectLatch(combo);
      return;
    }

    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.04);

    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime((isPerfect ? 130 : 110) * v, now);
    subOsc.frequency.exponentialRampToValueAtTime(35 * v, now + (isPerfect ? 0.32 : 0.25));
    subGain.gain.setValueAtTime(isPerfect ? 0.24 : 0.18, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + (isPerfect ? 0.35 : 0.28));
    subOsc.connect(subGain);
    subGain.connect(out);
    subOsc.start(now);
    subOsc.stop(now + 0.38);

    this.noiseBurst(b, now, {
      dur: isPerfect ? 0.20 : 0.16,
      gain: isPerfect ? 0.15 : 0.11,
      from: 650 * v,
      to: 35 * v,
    });

    const metalRatios = [420, 860, 1280, 2100];
    const shaper = ctx.createWaveShaper();
    (shaper as any).curve = this.getDistortionCurve(18);
    shaper.oversample = '2x';
    const metalBus = ctx.createGain();
    metalBus.gain.setValueAtTime(isPerfect ? 0.09 : 0.06, now);
    metalBus.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    metalBus.connect(shaper);
    shaper.connect(out);

    metalRatios.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();

      osc.type = idx % 2 === 0 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(freq * v, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.94 * v, now + 0.2);

      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freq * v, now);
      bp.Q.setValueAtTime(8, now);

      g.gain.setValueAtTime(0.12 / (idx + 1), now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24 + idx * 0.04);

      osc.connect(bp);
      bp.connect(g);
      g.connect(metalBus);
      osc.start(now);
      osc.stop(now + 0.4);
    });

    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'sawtooth';
    snapOsc.frequency.setValueAtTime(3200 * v, now);
    snapOsc.frequency.exponentialRampToValueAtTime(160 * v, now + 0.035);
    snapGain.gain.setValueAtTime(0.13, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    snapOsc.connect(snapGain);
    snapGain.connect(out);
    snapOsc.start(now);
    snapOsc.stop(now + 0.05);
  }

  playTieredPerfectLatch(combo: number) {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.03);

    const isTier2 = combo >= 6 && combo <= 15;
    const isTier5 = combo >= 51 && combo <= 99;

    const sub = ctx.createOscillator();
    const subG = ctx.createGain();
    sub.type = 'sine';
    const startPitch = combo >= 150 ? 140 : combo >= 100 ? 130 : isTier5 ? 120 : combo >= 31 ? 120 : combo >= 16 ? 100 : 80;
    const endPitch = combo >= 150 ? 22 : combo >= 100 ? 24 : isTier5 ? 24 : combo >= 31 ? 25 : 35;
    sub.frequency.setValueAtTime(startPitch * v, now);
    sub.frequency.exponentialRampToValueAtTime(endPitch * v, now + 0.45);

    const subPeak = isTier2 ? 0.08 : isTier5 ? 0.09 : Math.min(0.25, 0.16 + combo * 0.001);
    subG.gain.setValueAtTime(subPeak, now);
    subG.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    sub.connect(subG);
    subG.connect(out);
    sub.start(now);
    sub.stop(now + 0.55);

    const anvilDist = ctx.createWaveShaper();
    (anvilDist as any).curve = this.getDistortionCurve(isTier2 ? 10 : isTier5 ? 16 : combo >= 31 ? 35 : combo >= 16 ? 25 : 16);
    anvilDist.oversample = '2x';
    const anvilBus = ctx.createGain();
    anvilBus.gain.setValueAtTime(isTier2 ? 0.045 : isTier5 ? 0.038 : 0.09, now);
    anvilBus.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    anvilBus.connect(anvilDist);
    anvilDist.connect(out);

    const metalFrequencies = [420, 860, 1280, 2100, 3200];
    metalFrequencies.forEach((freq, idx) => {
      const mOsc = ctx.createOscillator();
      const mFilt = ctx.createBiquadFilter();
      const mGain = ctx.createGain();

      mOsc.type = idx % 2 === 0 ? 'sawtooth' : 'square';
      mOsc.frequency.setValueAtTime(freq * v, now);
      mOsc.frequency.exponentialRampToValueAtTime(freq * 0.92 * v, now + 0.28);

      mFilt.type = 'bandpass';
      mFilt.frequency.setValueAtTime(freq * v, now);
      mFilt.Q.setValueAtTime(isTier2 || isTier5 ? 5 : 8, now);

      const baseGain = (isTier2 || isTier5 ? 0.04 : 0.07) / (idx + 1);
      mGain.gain.setValueAtTime(baseGain, now);
      mGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25 + idx * 0.03);

      mOsc.connect(mFilt);
      mFilt.connect(mGain);
      mGain.connect(anvilBus);
      mOsc.start(now);
      mOsc.stop(now + 0.38);
    });

    this.noiseBurst(b, now, {
      dur: isTier2 ? 0.14 : isTier5 ? 0.20 : 0.22,
      gain: isTier2 ? 0.048 : isTier5 ? 0.038 : 0.12,
      from: (isTier2 ? 800 : isTier5 ? 1600 : 1200) * v,
      to: 40 * v,
    });

    if (combo >= 2 && combo <= 5) {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * v, now + idx * 0.035);
        gain.gain.setValueAtTime(0.05 / (idx + 1), now + idx * 0.035);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.035 + 0.35);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now + idx * 0.035);
        osc.stop(now + idx * 0.035 + 0.38);
      });
    } else if (combo >= 6 && combo <= 15) {
      const shudderOsc = ctx.createOscillator();
      const shudderGain = ctx.createGain();
      shudderOsc.type = 'triangle';
      shudderOsc.frequency.setValueAtTime(140 * v, now);
      shudderOsc.frequency.exponentialRampToValueAtTime(55 * v, now + 0.25);
      shudderGain.gain.setValueAtTime(0.001, now);
      shudderGain.gain.linearRampToValueAtTime(0.022, now + 0.015);
      shudderGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      shudderOsc.connect(shudderGain);
      shudderGain.connect(out);
      shudderOsc.start(now);
      shudderOsc.stop(now + 0.3);

      const notes = [659.25, 830.61, 987.77, 1318.51];
      notes.forEach((freq, idx) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq * v, now + idx * 0.03);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime((freq * 2.002) * v, now + idx * 0.03);

        const bellGain = 0.018 / (idx * 0.6 + 1);
        gain.gain.setValueAtTime(0.001, now + idx * 0.03);
        gain.gain.linearRampToValueAtTime(bellGain, now + idx * 0.03 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.03 + 0.45);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(out);
        osc1.start(now + idx * 0.03);
        osc2.start(now + idx * 0.03);
        osc1.stop(now + idx * 0.03 + 0.5);
        osc2.stop(now + idx * 0.03 + 0.5);
      });
    } else if (combo >= 16 && combo <= 30) {
      const powerDist = ctx.createWaveShaper();
      (powerDist as any).curve = this.getDistortionCurve(25);
      powerDist.oversample = '2x';
      const powerBus = ctx.createGain();
      powerBus.gain.setValueAtTime(0.09, now);
      powerBus.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      powerBus.connect(powerDist);
      powerDist.connect(out);

      const chord = [196.00, 293.66, 392.00, 493.88, 587.33];
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * v, now);

        f.type = 'lowpass';
        f.frequency.setValueAtTime(700, now);
        f.frequency.exponentialRampToValueAtTime(3800 * v, now + 0.08);
        f.frequency.exponentialRampToValueAtTime(800 * v, now + 0.55);

        g.gain.setValueAtTime(0.045, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

        osc.connect(f);
        f.connect(g);
        g.connect(powerBus);
        osc.start(now);
        osc.stop(now + 0.65);
      });

      [783.99, 987.77, 1174.66, 1567.98].forEach((freq, idx) => {
        this.blip(b, now + 0.08 + idx * 0.04, {
          type: 'triangle',
          freq: freq * v,
          dur: 0.22,
          gain: 0.04,
        });
      });
    } else if (combo >= 31 && combo <= 50) {
      const heavyDist = ctx.createWaveShaper();
      (heavyDist as any).curve = this.getDistortionCurve(30);
      heavyDist.oversample = '2x';
      const heavyBus = ctx.createGain();
      heavyBus.gain.setValueAtTime(0.10, now);
      heavyBus.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      heavyBus.connect(heavyDist);
      heavyDist.connect(out);

      const chord = [246.94, 369.99, 493.88, 622.25, 739.99, 987.77];
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * v, now);

        f.type = 'lowpass';
        f.frequency.setValueAtTime(500, now);
        f.frequency.exponentialRampToValueAtTime(5000 * v, now + 0.09);
        f.frequency.exponentialRampToValueAtTime(1000 * v, now + 0.65);

        g.gain.setValueAtTime(0.05, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

        osc.connect(f);
        f.connect(g);
        g.connect(heavyBus);
        osc.start(now);
        osc.stop(now + 0.75);
      });

      const laser = ctx.createOscillator();
      const laserG = ctx.createGain();
      laser.type = 'sawtooth';
      laser.frequency.setValueAtTime(4200 * v, now);
      laser.frequency.exponentialRampToValueAtTime(240 * v, now + 0.24);
      laserG.gain.setValueAtTime(0.08, now);
      laserG.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      laser.connect(laserG);
      laserG.connect(out);
      laser.start(now);
      laser.stop(now + 0.3);

      this.noiseBurst(b, now, { dur: 0.35, gain: 0.10, from: 3200 * v, to: 40 * v });
    } else if (combo >= 51 && combo <= 99) {
      const hyperDist = ctx.createWaveShaper();
      (hyperDist as any).curve = this.getDistortionCurve(16);
      hyperDist.oversample = '2x';
      const hyperBus = ctx.createGain();
      hyperBus.gain.setValueAtTime(0.042, now);
      hyperBus.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      hyperBus.connect(hyperDist);
      hyperDist.connect(out);

      const chord = [164.81, 246.94, 329.63, 415.30, 493.88, 659.25, 830.61, 987.77, 1318.51];
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();

        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq * v, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.01 * v, now + 0.7);

        f.type = 'lowpass';
        f.frequency.setValueAtTime(350, now);
        f.frequency.exponentialRampToValueAtTime(3200 * v, now + 0.12);
        f.frequency.exponentialRampToValueAtTime(800 * v, now + 0.75);

        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.012 / (idx * 0.2 + 1), now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

        osc.connect(f);
        f.connect(g);
        g.connect(hyperBus);
        osc.start(now);
        osc.stop(now + 0.9);
      });

      const gliss = ctx.createOscillator();
      const glissG = ctx.createGain();
      gliss.type = 'sine';
      gliss.frequency.setValueAtTime(440 * v, now);
      gliss.frequency.exponentialRampToValueAtTime(2637 * v, now + 0.65);
      glissG.gain.setValueAtTime(0.001, now);
      glissG.gain.linearRampToValueAtTime(0.022, now + 0.25);
      glissG.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      gliss.connect(glissG);
      glissG.connect(out);
      gliss.start(now);
      gliss.stop(now + 0.8);

      this.noiseBurst(b, now, { dur: 0.35, gain: 0.035, from: 3200 * v, to: 30 * v });
    } else if (combo >= 100 && combo <= 149) {
      // Tier 6 (x100-x149): Hyper Electric Violet / Diamond Blue Cosmic Synth Choir & Crystal Chimes
      const t6Dist = ctx.createWaveShaper();
      (t6Dist as any).curve = this.getDistortionCurve(14);
      t6Dist.oversample = '2x';
      const t6Bus = ctx.createGain();
      t6Bus.gain.setValueAtTime(0.048, now);
      t6Bus.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      t6Bus.connect(t6Dist);
      t6Dist.connect(out);

      const choirChord = [220.0, 277.18, 329.63, 440.0, 554.37, 659.25, 880.0, 1108.73, 1760.0];
      choirChord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * v, now);
        osc.frequency.linearRampToValueAtTime(freq * 1.008 * v, now + 0.5);

        f.type = 'bandpass';
        f.frequency.setValueAtTime(freq * 1.5, now);
        f.Q.setValueAtTime(3.0, now);

        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.015 / (idx * 0.15 + 1), now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);

        osc.connect(f);
        f.connect(g);
        g.connect(t6Bus);
        osc.start(now);
        osc.stop(now + 1.05);
      });

      [1760.0, 2217.46, 2637.02, 3520.0].forEach((freq, idx) => {
        this.blip(b, now + idx * 0.04, {
          type: 'sine',
          freq: freq * v,
          dur: 0.28,
          gain: 0.025,
        });
      });
    } else if (combo >= 150 && combo <= 199) {
      // Tier 7 (x150-x199): Radiant Solar Gold Cyber-Prog Lead & Plasma Filter Sweep
      const t7Bus = ctx.createGain();
      t7Bus.gain.setValueAtTime(0.055, now);
      t7Bus.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      t7Bus.connect(out);

      const solarChord = [293.66, 369.99, 440.0, 587.33, 739.99, 880.0, 1174.66];
      solarChord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * v, now);

        f.type = 'lowpass';
        f.frequency.setValueAtTime(500, now);
        f.frequency.linearRampToValueAtTime(6000 * v, now + 0.2);
        f.frequency.exponentialRampToValueAtTime(1200 * v, now + 1.0);

        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.016 / (idx * 0.2 + 1), now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

        osc.connect(f);
        f.connect(g);
        g.connect(t7Bus);
        osc.start(now);
        osc.stop(now + 1.15);
      });

      this.noiseBurst(b, now, { dur: 0.45, gain: 0.04, from: 4800 * v, to: 50 * v });
    } else {
      // Tier 8 (x200+): Transcendent Prismatic Celestial Symphony Climax
      const t8Bus = ctx.createGain();
      t8Bus.gain.setValueAtTime(0.062, now);
      t8Bus.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      t8Bus.connect(out);

      const celestialSymphonyChord = [
        146.83, 220.0, 293.66, 369.99, 440.0, 587.33, 739.99, 880.0, 1174.66, 1760.0, 2349.32
      ];
      celestialSymphonyChord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();

        osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq * v, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.005 * v, now + 1.2);

        f.type = 'lowpass';
        f.frequency.setValueAtTime(800, now);
        f.frequency.linearRampToValueAtTime(5400 * v, now + 0.25);
        f.frequency.exponentialRampToValueAtTime(1400 * v, now + 1.3);

        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.014 / (idx * 0.15 + 1), now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

        osc.connect(f);
        f.connect(g);
        g.connect(t8Bus);
        osc.start(now);
        osc.stop(now + 1.45);
      });

      [2349.32, 2793.83, 3520.0, 4698.63].forEach((freq, idx) => {
        this.blip(b, now + 0.05 + idx * 0.05, {
          type: 'sine',
          freq: freq * v,
          dur: 0.35,
          gain: 0.03,
        });
      });
    }
  }

  playCrispClick() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'sine', freq: 1200 * v, dur: 0.015, gain: 0.1 });
  }

  playConfirmSelect() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'sine', freq: 523.25 * v, dur: 0.1, gain: 0.08 });
    this.blip(b, b.now + 0.08, { type: 'sine', freq: 783.99 * v, dur: 0.15, gain: 0.1 });
  }

  playPowerupChime() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.06, { type: 'sine', freq: freq * v, dur: 0.15, gain: 0.06 });
    });
  }

  playCoinPickup() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'square', freq: 987.77 * v, dur: 0.1, gain: 0.08 });
    this.blip(b, b.now + 0.08, { type: 'square', freq: 1318.51 * v, dur: 0.2, gain: 0.08 });
  }

  playChiptuneExplosion() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.noiseBurst(b, b.now, { dur: 0.4, gain: 0.2, from: 1000, to: 100 });
    this.blip(b, b.now, { type: 'triangle', freq: 160 * v, freqTo: 30 * v, dur: 0.35, gain: 0.25 });
  }

  playTowerCollapse() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.04);

    const screech1 = ctx.createOscillator();
    const screech2 = ctx.createOscillator();
    const screechFilter = ctx.createBiquadFilter();
    const screechGain = ctx.createGain();

    screech1.type = 'sawtooth';
    screech1.frequency.setValueAtTime(880 * v, now);
    screech1.frequency.exponentialRampToValueAtTime(3200 * v, now + 0.12);
    screech1.frequency.exponentialRampToValueAtTime(340 * v, now + 0.38);

    screech2.type = 'square';
    screech2.frequency.setValueAtTime(1180 * v, now);
    screech2.frequency.exponentialRampToValueAtTime(2750 * v, now + 0.14);
    screech2.frequency.exponentialRampToValueAtTime(180 * v, now + 0.42);

    screechFilter.type = 'bandpass';
    screechFilter.Q.setValueAtTime(6.5, now);
    screechFilter.frequency.setValueAtTime(1400 * v, now);
    screechFilter.frequency.exponentialRampToValueAtTime(3600 * v, now + 0.15);
    screechFilter.frequency.exponentialRampToValueAtTime(450 * v, now + 0.45);

    screechGain.gain.setValueAtTime(0.001, now);
    screechGain.gain.linearRampToValueAtTime(0.16, now + 0.04);
    screechGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);

    screech1.connect(screechFilter);
    screech2.connect(screechFilter);
    screechFilter.connect(screechGain);
    screechGain.connect(out);

    screech1.start(now);
    screech2.start(now);
    screech1.stop(now + 0.5);
    screech2.stop(now + 0.5);

    const groanCarrier = ctx.createOscillator();
    const groanMod = ctx.createOscillator();
    const groanModGain = ctx.createGain();
    const groanGain = ctx.createGain();

    groanCarrier.type = 'sawtooth';
    groanCarrier.frequency.setValueAtTime(145 * v, now);
    groanCarrier.frequency.exponentialRampToValueAtTime(65 * v, now + 0.45);

    groanMod.type = 'triangle';
    groanMod.frequency.setValueAtTime(35, now);
    groanModGain.gain.setValueAtTime(80, now);
    groanModGain.gain.exponentialRampToValueAtTime(5, now + 0.4);

    groanMod.connect(groanModGain);
    groanModGain.connect(groanCarrier.frequency);

    groanGain.gain.setValueAtTime(0.12, now);
    groanGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    groanCarrier.connect(groanGain);
    groanGain.connect(out);

    groanCarrier.start(now);
    groanMod.start(now);
    groanCarrier.stop(now + 0.48);
    groanMod.stop(now + 0.48);

    const crashTime = now + 0.12;
    
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(95 * v, crashTime);
    subOsc.frequency.exponentialRampToValueAtTime(22 * v, crashTime + 0.65);

    subGain.gain.setValueAtTime(0.28, crashTime);
    subGain.gain.exponentialRampToValueAtTime(0.0001, crashTime + 0.75);

    subOsc.connect(subGain);
    subGain.connect(out);
    subOsc.start(crashTime);
    subOsc.stop(crashTime + 0.8);

    this.noiseBurst(b, crashTime, {
      dur: 0.65,
      gain: 0.22,
      from: 1400 * v,
      to: 35 * v,
    });

    const dist = ctx.createWaveShaper();
    (dist as any).curve = this.getDistortionCurve(35);
    dist.oversample = '2x';
    const distBus = ctx.createGain();
    distBus.gain.setValueAtTime(0.15, crashTime);
    distBus.gain.exponentialRampToValueAtTime(0.0001, crashTime + 0.6);
    distBus.connect(dist);
    dist.connect(out);

    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(220 * v, crashTime);
    bodyOsc.frequency.exponentialRampToValueAtTime(45 * v, crashTime + 0.35);
    bodyGain.gain.setValueAtTime(0.18, crashTime);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, crashTime + 0.4);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(distBus);
    bodyOsc.start(crashTime);
    bodyOsc.stop(crashTime + 0.45);

    const clatterDelays = [0.24, 0.42, 0.65, 0.92, 1.25, 1.62, 2.05];
    const resonantFreqs = [
      [340, 680, 1150],
      [420, 890, 1420],
      [290, 580, 960],
      [480, 920, 1680],
      [360, 720, 1240],
      [520, 1040, 1850],
      [280, 560, 840],
    ];

    clatterDelays.forEach((delay, cIdx) => {
      const hitTime = now + delay;
      const decayRatio = Math.pow(0.72, cIdx);
      const hitV = this.vary(0.08);

      this.noiseBurst(b, hitTime, {
        dur: 0.12 * decayRatio + 0.04,
        gain: (0.12 * decayRatio),
        from: (800 + cIdx * 150) * hitV,
        to: (50 + cIdx * 10) * hitV,
      });

      const freqs = resonantFreqs[cIdx % resonantFreqs.length];
      freqs.forEach((freq, fIdx) => {
        const osc = ctx.createOscillator();
        const bp = ctx.createBiquadFilter();
        const g = ctx.createGain();

        osc.type = fIdx === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq * hitV, hitTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.94 * hitV, hitTime + 0.18);

        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(freq * hitV, hitTime);
        bp.Q.setValueAtTime(9.0, hitTime);

        const peakGain = (0.08 * decayRatio) / (fIdx + 1);
        g.gain.setValueAtTime(peakGain, hitTime);
        g.gain.exponentialRampToValueAtTime(0.0001, hitTime + 0.22 + fIdx * 0.05);

        osc.connect(bp);
        bp.connect(g);
        g.connect(out);

        osc.start(hitTime);
        osc.stop(hitTime + 0.35);
      });
    });
  }

  playMeleePunch() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'triangle', freq: 140 * v, freqTo: 30 * v, dur: 0.15, gain: 0.18 });
    this.noiseBurst(b, b.now, { dur: 0.08, gain: 0.1, from: 600, to: 80 });
  }

  playJumpLandingThud() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'sine', freq: 140 * v, freqTo: 35 * v, dur: 0.16, gain: 0.15 });
    this.noiseBurst(b, b.now, { dur: 0.12, gain: 0.08, from: 300, to: 60 });
  }

  playVictoryFanfare() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.1, { type: 'sawtooth', freq: freq * v, dur: 0.4, gain: 0.06 });
      this.blip(b, b.now + i * 0.1, { type: 'sine', freq: freq * v, dur: 0.4, gain: 0.04 });
    });
    const chordTime = notes.length * 0.1;
    notes.forEach((freq) => {
      this.blip(b, b.now + chordTime, { type: 'triangle', freq: freq * v, dur: 0.8, gain: 0.06 });
    });
  }

  playDefeatMotif() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    const notes = [311.13, 261.63, 246.94, 196.00];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.15, { type: 'sawtooth', freq: freq * v, dur: 0.3, gain: 0.08 });
      this.blip(b, b.now + i * 0.15, { type: 'sine', freq: freq * 0.5 * v, dur: 0.35, gain: 0.06 });
    });
  }

  playLevelUpStinger() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      this.blip(b, b.now + i * 0.07, { type: 'sine', freq: freq * v, dur: 0.25, gain: 0.06 });
    });
    const tailTime = notes.length * 0.07;
    this.noiseBurst(b, b.now + tailTime, { dur: 0.8, gain: 0.05, from: 3000, to: 6000 });
    for (let i = 0; i < 5; i++) {
      this.blip(b, b.now + tailTime + i * 0.1, {
        type: 'sine',
        freq: (2000 + i * 500) * this.vary(0.1),
        dur: 0.2,
        gain: 0.03
      });
    }
  }

  private singularityGain: GainNode | null = null;
  private singularityOsc1: OscillatorNode | null = null;
  private singularityOsc2: OscillatorNode | null = null;
  private singularityOsc3: OscillatorNode | null = null;
  private singularityFilter: BiquadFilterNode | null = null;
  private singularityStaticNode: AudioBufferSourceNode | null = null;
  private singularityStaticGain: GainNode | null = null;
  private singularityStaticFilter: BiquadFilterNode | null = null;
  private singularityVortexGain: GainNode | null = null;
  private singularityVortexFilter: BiquadFilterNode | null = null;
  private singularityCut = false;

  /** Segundo de la cinemática en que el sonido se corta en seco (inicio del destello). */
  private static readonly SINGULARITY_CUT_TIME = 18.8;

  /** Silencia de golpe el drone, el vórtice y el siseo (sin fundido audible). */
  private hardCutSingularity() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const gains = [
      this.singularityGain,
      this.singularityVortexGain,
      this.singularityStaticGain,
    ];
    for (const g of gains) {
      if (!g) continue;
      const current = g.gain.value;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(current, now);
      // 15 ms: imperceptible como fundido, pero evita el "clic" de un corte a 0 instantáneo
      g.gain.linearRampToValueAtTime(0, now + 0.015);
    }
    this.singularityCut = true;
  }

  updateSingularityAudio(time: number) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    if (this.singularityCut) return; // ya se cortó: silencio total hasta reiniciar

    // Phase 1 (0 - 4s): Deep sub-bass cosmic hum & growing micro-tear oscillation
    // Phase 2 (4 - 8s): Vortex acceleration & swirling wind
    // Phase 3 (8 - 15s): Massive matter compression & screaming gravitational vortex
    // Phase 4 (15 - 19s): Climax flare explosion -> sudden quiet
    // Phase 5 (19s+): Ethereal whisper-quiet cosmic static hiss (~0.025 volume)

    // 1. Sub-bass hum & drone
    if (!this.singularityGain) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.connect(this.sfxMaster || this.master || ctx.destination);

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(42, ctx.currentTime);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(84, ctx.currentTime);

      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(126, ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(160, ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      osc3.connect(filter);
      filter.connect(g);

      osc1.start();
      osc2.start();
      osc3.start();

      this.singularityOsc1 = osc1;
      this.singularityOsc2 = osc2;
      this.singularityOsc3 = osc3;
      this.singularityFilter = filter;
      this.singularityGain = g;
    }

    // 2. Gravitational Vortex Noise Stream
    if (!this.singularityVortexGain) {
      const bufferLen = Math.floor(ctx.sampleRate * 3.0);
      const noiseBuffer = ctx.createBuffer(1, bufferLen, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferLen; i++) data[i] = Math.random() * 2 - 1;

      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;
      noiseSrc.loop = true;

      const vFilter = ctx.createBiquadFilter();
      vFilter.type = 'bandpass';
      vFilter.frequency.setValueAtTime(300, ctx.currentTime);
      vFilter.Q.setValueAtTime(2.5, ctx.currentTime);

      const vGain = ctx.createGain();
      vGain.gain.setValueAtTime(0.0001, ctx.currentTime);

      noiseSrc.connect(vFilter);
      vFilter.connect(vGain);
      vGain.connect(this.sfxMaster || this.master || ctx.destination);

      noiseSrc.start();
      this.singularityVortexFilter = vFilter;
      this.singularityVortexGain = vGain;
    }

    // 3. Whisper Quiet Cosmic Static Hiss (Phase 5: 19s+)
    if (!this.singularityStaticGain) {
      const bufferLen = Math.floor(ctx.sampleRate * 4.0);
      const noiseBuffer = ctx.createBuffer(1, bufferLen, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferLen; i++) data[i] = (Math.random() * 2 - 1) * 0.5;

      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;
      noiseSrc.loop = true;

      const sFilter = ctx.createBiquadFilter();
      sFilter.type = 'bandpass';
      sFilter.frequency.setValueAtTime(1800, ctx.currentTime);
      sFilter.Q.setValueAtTime(0.7, ctx.currentTime);

      const sGain = ctx.createGain();
      sGain.gain.setValueAtTime(0.0001, ctx.currentTime);

      noiseSrc.connect(sFilter);
      sFilter.connect(sGain);
      sGain.connect(this.sfxMaster || this.master || ctx.destination);

      noiseSrc.start();
      this.singularityStaticNode = noiseSrc;
      this.singularityStaticFilter = sFilter;
      this.singularityStaticGain = sGain;
    }

    // CORTE SECO: al llegar al momento del destello todo se silencia de golpe
    if (time >= GameAudio.SINGULARITY_CUT_TIME) {
      this.hardCutSingularity();
      return;
    }

    // Dynamic parameter automation based on timeline (Scaled by 0.70x for comfortable cinematic sub-bass balance)
    const now = ctx.currentTime;
    const volScale = 0.70;
    if (time < 4.0) {
      // Phase 1: Sub bass build
      const t = time / 4.0;
      this.singularityGain.gain.setTargetAtTime(0.08 * volScale * t, now, 0.1);
      this.singularityFilter?.frequency.setTargetAtTime(120 + t * 180, now, 0.1);
      this.singularityVortexGain?.gain.setTargetAtTime(0.03 * volScale * t, now, 0.1);
      this.singularityVortexFilter?.frequency.setTargetAtTime(200 + t * 300, now, 0.1);
      this.singularityStaticGain?.gain.setTargetAtTime(0.0001, now, 0.1);
    } else if (time < 8.0) {
      // Phase 2: Accretion flare expansion
      const t = (time - 4.0) / 4.0;
      this.singularityGain.gain.setTargetAtTime((0.08 + t * 0.08) * volScale, now, 0.1);
      this.singularityFilter?.frequency.setTargetAtTime(300 + t * 400, now, 0.1);
      this.singularityVortexGain?.gain.setTargetAtTime((0.03 + t * 0.06) * volScale, now, 0.1);
      this.singularityVortexFilter?.frequency.setTargetAtTime(500 + t * 600, now, 0.1);
    } else if (time < 15.0) {
      // Phase 3: Spaghettification roar & swirling vortex
      const t = (time - 8.0) / 7.0;
      this.singularityGain.gain.setTargetAtTime((0.16 + t * 0.10) * volScale, now, 0.1);
      this.singularityFilter?.frequency.setTargetAtTime(700 + t * 1200, now, 0.1);
      this.singularityVortexGain?.gain.setTargetAtTime((0.09 + t * 0.08) * volScale, now, 0.1);
      this.singularityVortexFilter?.frequency.setTargetAtTime(1100 + t * 1400, now, 0.1);
    } else if (time < 19.0) {
      // Phase 4: Maximum compression & colossal flare
      // Sin fundido: el sonido sigue creciendo hasta SINGULARITY_CUT_TIME y ahí se corta en seco
      const t = Math.min((time - 15.0) / 4.0, 0.8);
      this.singularityGain.gain.setTargetAtTime((0.26 + t * 0.10) * volScale, now, 0.05);
      this.singularityFilter?.frequency.setTargetAtTime(2000 + t * 2000, now, 0.05);
      this.singularityVortexGain?.gain.setTargetAtTime((0.18 + t * 0.08) * volScale, now, 0.05);
    } else {
      // Phase 5 (19.0s+): Complete quiet, peaceful cosmic static hiss
      this.singularityGain.gain.setTargetAtTime(0.0001, now, 0.3);
      this.singularityVortexGain?.gain.setTargetAtTime(0.0001, now, 0.3);
      this.singularityStaticGain?.gain.setTargetAtTime(0.025 * volScale, now, 1.0);
    }
  }

  startSingularityDrone() {
    this.singularityCut = false;
    this.updateSingularityAudio(0);
  }

  stopSingularityDrone() {
    this.singularityCut = false;
    if (this.singularityGain && this.ctx) {
      this.singularityGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    }
    if (this.singularityVortexGain && this.ctx) {
      this.singularityVortexGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    }
    if (this.singularityStaticGain && this.ctx) {
      this.singularityStaticGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    }
    if (this.singularityStaticNode) {
      try {
        this.singularityStaticNode.stop(this.ctx?.currentTime ? this.ctx.currentTime + 0.3 : 0);
      } catch {}
      this.singularityStaticNode = null;
    }
    this.singularityGain = null;
    this.singularityVortexGain = null;
    this.singularityStaticGain = null;
  }

  playSingularityCollapse() {
    const b = this.begin();
    if (!b) return;
    const { ctx, out, now } = b;
    const v = this.vary(0.02);
    const volScale = 0.70;

    // Deep sub-bass implosion sweep
    const sub = ctx.createOscillator();
    const subG = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(220 * v, now);
    sub.frequency.exponentialRampToValueAtTime(16 * v, now + 3.5);

    subG.gain.setValueAtTime(0.001, now);
    subG.gain.linearRampToValueAtTime(0.40 * volScale, now + 0.5);
    subG.gain.exponentialRampToValueAtTime(0.0001, now + 4.0);

    sub.connect(subG);
    subG.connect(out);
    sub.start(now);
    sub.stop(now + 4.2);

    // Gravitational distortion whoosh noise with resonant lowpass filter sweep
    const len = Math.max(1, Math.floor(ctx.sampleRate * 3.8));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(2800 * v, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(45 * v, now + 3.2);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.linearRampToValueAtTime(0.32 * volScale, now + 0.6);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.6);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(out);
    noiseSrc.start(now);
    noiseSrc.stop(now + 3.8);

    // Inharmonic gravitational lensing sweeps
    [523.25, 659.25, 783.99, 1046.50, 1567.98].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq * v, now + idx * 0.08);
      osc.frequency.exponentialRampToValueAtTime(32 * v, now + 2.8);

      g.gain.setValueAtTime((0.08 * volScale) / (idx + 1), now + idx * 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      osc.connect(g);
      g.connect(out);
      osc.start(now + idx * 0.08);
      osc.stop(now + 3.2);
    });
  }

  playErrorBuzz() {
    const b = this.begin();
    if (!b) return;
    const v = this.vary();
    this.blip(b, b.now, { type: 'sawtooth', freq: 150 * v, dur: 0.2, gain: 0.08 });
    this.blip(b, b.now + 0.08, { type: 'sawtooth', freq: 159 * v, dur: 0.2, gain: 0.08 });
  }
}

/** Shared singleton — import and use anywhere. */
export const gameAudio = new GameAudio();

// ============================================================================
// GENERAL UTILITIES & MATH HELPERS
// ============================================================================

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const shuffle = <T,>(items: T[]): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const formatTime = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(clamped / 60);
  const remaining = clamped % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

export const prepareCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void => {
  const scale = window.devicePixelRatio || 1;
  const displayWidth = Math.floor(width * scale);
  const displayHeight = Math.floor(height * scale);

  if (
    ctx.canvas.width !== displayWidth ||
    ctx.canvas.height !== displayHeight
  ) {
    ctx.canvas.width = displayWidth;
    ctx.canvas.height = displayHeight;
  }

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
};

export const createFixedStepper = (stepMs: number, maxSubSteps = 5) => {
  let lastTime = 0;
  let accumulator = 0;

  return (time: number, onStep: (deltaSeconds: number) => void): void => {
    if (lastTime === 0) {
      lastTime = time;
      return;
    }

    const frameMs = Math.min(time - lastTime, stepMs * maxSubSteps);
    lastTime = time;
    accumulator += frameMs;

    let steps = 0;
    while (accumulator >= stepMs && steps < maxSubSteps) {
      onStep(stepMs / 1000);
      accumulator -= stepMs;
      steps += 1;
    }
  };
};

export interface Position {
  x: number;
  y: number;
}

export interface Entity extends Position {
  id: string;
  type: string;
  width: number;
  height: number;
  vx: number;
  vy: number;
  [key: string]: any;
}

export type GamePhase =
  | 'START'
  | 'PLAYING'
  | 'PAUSED'
  | 'GAME_OVER'
  | 'VICTORY'
  | 'SINGULARITY'
  | 'LEVEL_COMPLETE';

export interface GameState {
  status: GamePhase;
  score: number;
  level: number;
  timer?: number;
  moves?: number;
  lives?: number;
  [key: string]: any;
}

export interface MusicTrack {
  name: string;
  url: string;
  description: string;
}

declare global {
  interface Window {
    PlaygroundSDK: any;
  }
}

export interface SpriteConfig {
  url: string;
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
}

export function useAssets(manifest: Record<string, string>) {
  const [assets, setAssets] = useState<Record<string, HTMLImageElement | null>>(
    {},
  );
  const [isReady, setIsReady] = useState(false);

  const manifestStr = JSON.stringify(manifest);

  useEffect(() => {
    const currentManifest = JSON.parse(manifestStr) as Record<string, string>;
    const urls = Object.entries(currentManifest);
    if (urls.length === 0) {
      setIsReady(true);
      return;
    }

    let loadedCount = 0;
    const loadedAssets: Record<string, HTMLImageElement | null> = {};

    urls.forEach(([id, url]) => {
      const img = new Image();
      let retriedWithoutCors = false;
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedAssets[id] = img;
        loadedCount++;
        if (loadedCount === urls.length) {
          setAssets(loadedAssets);
          setIsReady(true);
        }
      };
      img.onerror = () => {
        if (!retriedWithoutCors) {
          retriedWithoutCors = true;
          img.removeAttribute('crossorigin');
          img.src = url;
          return;
        }
        console.warn(`[AssetPreloader] Failed to load asset: ${id} at ${url}`);
        loadedAssets[id] = null;
        loadedCount++;
        if (loadedCount === urls.length) {
          setAssets(loadedAssets);
          setIsReady(true);
        }
      };
      img.src = url;
    });
  }, [manifestStr]);

  return {assets, isReady};
}

export function drawAsset(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  fallbackDraw: (ctx: CanvasRenderingContext2D) => void,
) {
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, w, h);
  } else {
    fallbackDraw(ctx);
  }
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bgImg: HTMLImageElement | null | undefined,
  canvasWidth: number,
  canvasHeight: number,
  fallbackColor = '#222222',
  camX = 0,
  camY = 0,
) {
  if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
    const parallaxFactor = 0.5;
    const bgX = (camX * parallaxFactor) % canvasWidth;
    const bgY = (camY * parallaxFactor) % canvasHeight;

    ctx.drawImage(bgImg, -bgX, -bgY, canvasWidth, canvasHeight);
    ctx.drawImage(bgImg, -bgX + canvasWidth, -bgY, canvasWidth, canvasHeight);
    ctx.drawImage(bgImg, -bgX, -bgY + canvasHeight, canvasWidth, canvasHeight);
    ctx.drawImage(
      bgImg,
      -bgX + canvasWidth,
      -bgY + canvasHeight,
      canvasWidth,
      canvasHeight,
    );
  } else {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    const ua =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
    const touch =
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;
    const small = window.innerWidth < 768;
    return ua || touch || small;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(
        window.innerWidth < 768 ||
          window.matchMedia('(pointer: coarse)').matches ||
          'ontouchstart' in window ||
          navigator.maxTouchPoints > 0,
      );
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}
