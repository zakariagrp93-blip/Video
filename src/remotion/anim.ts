import { Easing, interpolate, random, spring } from 'remotion';
import type { CameraMove, CharacterMotion, PropAnimation, Transition } from '../shared/constants';

/**
 * The animation library. All motion in the video goes through these helpers so
 * easing is consistent everywhere: a soft "expo-out" for entrances, a symmetric
 * ease for camera moves, and one spring preset for pops.
 */
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);
export const POP_SPRING = { damping: 13, stiffness: 160, mass: 0.7 } as const;
export const SOFT_SPRING = { damping: 20, stiffness: 120, mass: 0.9 } as const;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export function progress(frame: number, start: number, duration: number, easing = EASE_OUT): number {
  return interpolate(frame, [start, start + Math.max(1, duration)], [0, 1], { ...clamp, easing });
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
}

export const IDENTITY: Transform = { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 };

export function toCss(t: Transform): string {
  return `translate(${t.x.toFixed(2)}px, ${t.y.toFixed(2)}px) rotate(${t.rotate.toFixed(2)}deg) scale(${t.scale.toFixed(4)})`;
}

/** Entrance + idle animation of a prop. `frame` is relative to the scene start. */
export function propTransform(anim: PropAnimation, frame: number, fps: number, delayFrames: number, seed: number): Transform {
  const f = frame - delayFrames;
  if (f < 0 && anim !== 'none') return { ...IDENTITY, opacity: 0, scale: anim === 'pop' || anim === 'grow' ? 0 : 1 };
  const p = progress(f, 0, 14);
  const idleFloat = Math.sin((frame + seed * 37) / 22) * 6;
  switch (anim) {
    case 'pop': {
      const s = spring({ frame: f, fps, config: POP_SPRING });
      return { x: 0, y: idleFloat * 0.5, scale: s, rotate: (1 - s) * -12, opacity: Math.min(1, s * 2) };
    }
    case 'grow': {
      const s = spring({ frame: f, fps, config: SOFT_SPRING, durationInFrames: 24 });
      return { x: 0, y: (1 - s) * 40, scale: 0.2 + 0.8 * s, rotate: 0, opacity: Math.min(1, s * 1.5) };
    }
    case 'fade':
      return { ...IDENTITY, y: idleFloat * 0.4, opacity: p };
    case 'float':
      return { x: Math.sin((frame + seed * 13) / 30) * 8, y: idleFloat * 1.6 + (1 - p) * 30, scale: 1, rotate: Math.sin((frame + seed * 7) / 40) * 4, opacity: p };
    case 'fall': {
      const fp = progress(f, 0, 22, EASE_IN);
      const bounce = f > 22 ? Math.sin(Math.min(Math.PI, ((f - 22) / 8) * Math.PI)) * 14 : 0;
      return { x: 0, y: -700 * (1 - fp) - bounce, scale: 1, rotate: (1 - fp) * (seed % 2 ? 40 : -40), opacity: Math.min(1, f / 3) };
    }
    case 'slide-left':
      return { x: 700 * (1 - p), y: idleFloat * 0.4, scale: 1, rotate: 0, opacity: Math.min(1, p * 2) };
    case 'slide-right':
      return { x: -700 * (1 - p), y: idleFloat * 0.4, scale: 1, rotate: 0, opacity: Math.min(1, p * 2) };
    case 'rise':
      return { x: 0, y: 260 * (1 - p), scale: 1, rotate: 0, opacity: p };
    case 'shake': {
      const sp = spring({ frame: f, fps, config: POP_SPRING });
      const decay = Math.max(0, 1 - f / 24);
      return { x: Math.sin(f * 2.3) * 14 * decay, y: 0, scale: sp, rotate: Math.sin(f * 1.7) * 9 * decay, opacity: Math.min(1, sp * 2) };
    }
    case 'spin': {
      const sp = spring({ frame: f, fps, config: SOFT_SPRING });
      return { x: 0, y: idleFloat * 0.5, scale: sp, rotate: (1 - sp) * 360, opacity: Math.min(1, sp * 2) };
    }
    case 'pulse': {
      const s = spring({ frame: f, fps, config: POP_SPRING });
      return { x: 0, y: 0, scale: s * (1 + Math.sin(frame / 6) * 0.05), rotate: 0, opacity: Math.min(1, s * 2) };
    }
    case 'none':
    default:
      return IDENTITY;
  }
}

/** Camera move over the whole scene, `p` in 0..1. */
export function cameraTransform(move: CameraMove, frame: number, duration: number): Transform {
  const p = interpolate(frame, [0, Math.max(1, duration)], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  switch (move) {
    case 'zoom-in':
      return { ...IDENTITY, scale: 1 + 0.07 * p };
    case 'zoom-out':
      return { ...IDENTITY, scale: 1.08 - 0.08 * p };
    case 'push-in': {
      const q = progress(frame, 0, Math.min(duration, 45));
      return { ...IDENTITY, scale: 1.0 + 0.12 * q };
    }
    case 'pan-left':
      return { ...IDENTITY, x: 40 - 80 * p, scale: 1.06 };
    case 'pan-right':
      return { ...IDENTITY, x: -40 + 80 * p, scale: 1.06 };
    case 'tilt':
      return { ...IDENTITY, rotate: -1.4 + 2.8 * p, scale: 1.04 };
    case 'shake': {
      const decay = Math.max(0, 1 - frame / 18);
      return { x: (random(`sx${frame}`) - 0.5) * 30 * decay, y: (random(`sy${frame}`) - 0.5) * 22 * decay, scale: 1.02, rotate: (random(`sr${frame}`) - 0.5) * 1.6 * decay, opacity: 1 };
    }
    case 'static':
    default:
      return IDENTITY;
  }
}

export interface MotionState {
  dx: number;
  dy: number;
  walking: boolean;
  walkSpeed: number;
  scale: number;
  facingOverride?: 'left' | 'right';
}

/** Character locomotion. dx is relative to its layout position. */
export function characterMotion(motion: CharacterMotion, frame: number, duration: number): MotionState {
  const base: MotionState = { dx: 0, dy: 0, walking: false, walkSpeed: 1, scale: 1 };
  const enterLen = Math.min(30, duration * 0.35);
  switch (motion) {
    case 'enter-left': {
      const p = progress(frame, 0, enterLen, EASE_OUT);
      return { ...base, dx: -900 * (1 - p), walking: p < 0.98, facingOverride: 'right' };
    }
    case 'enter-right': {
      const p = progress(frame, 0, enterLen, EASE_OUT);
      return { ...base, dx: 900 * (1 - p), walking: p < 0.98, facingOverride: 'left' };
    }
    case 'exit-left': {
      const start = duration * 0.6;
      const p = progress(frame, start, duration - start, EASE_IN);
      return { ...base, dx: -900 * p, walking: frame >= start, facingOverride: frame >= start ? 'left' : undefined };
    }
    case 'exit-right': {
      const start = duration * 0.6;
      const p = progress(frame, start, duration - start, EASE_IN);
      return { ...base, dx: 900 * p, walking: frame >= start, facingOverride: frame >= start ? 'right' : undefined };
    }
    case 'walk-across': {
      const p = interpolate(frame, [0, duration], [0, 1], clamp);
      return { ...base, dx: -380 + 760 * p, walking: true, facingOverride: 'right' };
    }
    case 'jump': {
      const t = frame - 8;
      const len = 20;
      const h = t >= 0 && t <= len ? Math.sin((t / len) * Math.PI) * 180 : 0;
      const squash = t >= len && t < len + 6 ? 0.92 : 1;
      return { ...base, dy: -h, scale: squash };
    }
    case 'bounce': {
      const h = Math.abs(Math.sin(frame / 7)) * 40;
      return { ...base, dy: -h };
    }
    case 'shiver':
      return { ...base, dx: Math.sin(frame * 2.1) * 5 };
    case 'lean-in': {
      const p = progress(frame, 0, duration * 0.6, EASE_IN_OUT);
      return { ...base, scale: 1 + 0.12 * p, dy: 30 * p };
    }
    case 'none':
    default:
      return base;
  }
}

/** Entrance/exit styling for scene transitions (self-contained, so scenes can render independently). */
export function transitionStyle(kind: Transition, frame: number, duration: number, nextKind: Transition | null, width = 1080, height = 1920): { opacity: number; transform: string; clipPath?: string } {
  const IN = 9;
  const OUT = 7;
  let opacity = 1;
  let x = 0;
  let y = 0;
  let scale = 1;
  let clipPath: string | undefined;
  const pin = progress(frame, 0, IN);
  switch (kind) {
    case 'fade':
      opacity = pin;
      break;
    case 'slide-left':
      x = width * (1 - pin);
      break;
    case 'slide-up':
      y = height * (1 - pin) * 0.6;
      opacity = Math.min(1, pin * 1.5);
      break;
    case 'zoom-through':
      scale = 1.6 - 0.6 * pin;
      opacity = pin;
      break;
    case 'wipe':
      clipPath = `inset(0 ${(100 * (1 - pin)).toFixed(2)}% 0 0)`;
      break;
    case 'cut':
    default:
      break;
  }
  if (nextKind && nextKind !== 'cut') {
    const pout = interpolate(frame, [duration - OUT, duration], [0, 1], { ...clamp, easing: EASE_IN });
    switch (nextKind) {
      case 'fade':
        opacity *= 1 - pout;
        break;
      case 'slide-left':
        x -= width * pout;
        break;
      case 'slide-up':
        y -= height * 0.31 * pout;
        opacity *= 1 - pout;
        break;
      case 'zoom-through':
        scale *= 1 + 0.5 * pout;
        opacity *= 1 - pout;
        break;
      case 'wipe':
        opacity *= 1 - pout * 0.9;
        break;
      default:
        break;
    }
  }
  return { opacity, transform: `translate(${x}px, ${y}px) scale(${scale})`, clipPath };
}
