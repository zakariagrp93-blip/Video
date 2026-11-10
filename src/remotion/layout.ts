import type { CharacterPosition, PropPlacement } from '../shared/constants';

/**
 * Stage layouts. Scenes are composed in a "stage" coordinate system:
 *  - tall:   the full 1080×1920 frame (big mascot, karaoke captions).
 *  - cinema: a wide 1920×820 panel shown as a cinematic band across the middle
 *            of the vertical video (title banner above, sentence caption below).
 */
export type LayoutName = 'tall' | 'cinema';

export interface StageLayout {
  name: LayoutName;
  width: number;
  height: number;
  /** Where the stage sits in the 1080×1920 frame. */
  frame: { top: number; scale: number };
  baselineY: number;
  charX: Record<CharacterPosition, number>;
  charScale: number;
  slots: Record<Exclude<PropPlacement, 'around' | 'hand' | 'bottom'>, { x: number; y: number; size: number }>;
  hand: { dx: number; y: number; size: number };
  floor: { offset: number; size: number };
  around: { cy: number; rx: number; ry: number; size: number };
  overlay: { top: number; topWithChart: number; scale: number };
  chart: Record<'hidden' | CharacterPosition, { x: number; y: number; w: number; h: number }>;
}

export const TALL: StageLayout = {
  name: 'tall',
  width: 1080,
  height: 1920,
  frame: { top: 0, scale: 1 },
  baselineY: 1330,
  charX: { left: 290, center: 540, right: 790 },
  charScale: 1.22,
  slots: {
    left: { x: 230, y: 1040, size: 360 },
    right: { x: 850, y: 1040, size: 360 },
    top: { x: 540, y: 560, size: 250 },
    'top-left': { x: 240, y: 620, size: 280 },
    'top-right': { x: 840, y: 620, size: 280 },
    center: { x: 540, y: 930, size: 300 },
  },
  hand: { dx: 175, y: 1000, size: 160 },
  floor: { offset: 330, size: 230 },
  around: { cy: 980, rx: 360, ry: 300, size: 150 },
  overlay: { top: 330, topWithChart: 170, scale: 1 },
  chart: {
    hidden: { x: 120, y: 640, w: 840, h: 560 },
    left: { x: 540, y: 660, w: 480, h: 420 },
    right: { x: 60, y: 660, w: 480, h: 420 },
    center: { x: 150, y: 330, w: 780, h: 380 },
  },
};

/** 1920×820 panel scaled to the 1080-px frame width (≈ 2.34:1, a cinemascope band). */
export const CINEMA_SCALE = 1080 / 1920;
export const CINEMA_TOP = 660;

export const CINEMA: StageLayout = {
  name: 'cinema',
  width: 1920,
  height: 820,
  frame: { top: CINEMA_TOP, scale: CINEMA_SCALE },
  baselineY: 770,
  charX: { left: 560, center: 960, right: 1360 },
  charScale: 1.08,
  slots: {
    left: { x: 330, y: 545, size: 360 },
    right: { x: 1590, y: 545, size: 360 },
    top: { x: 960, y: 118, size: 180 },
    'top-left': { x: 330, y: 170, size: 210 },
    'top-right': { x: 1590, y: 170, size: 210 },
    center: { x: 960, y: 430, size: 320 },
  },
  hand: { dx: 170, y: 470, size: 170 },
  floor: { offset: 380, size: 240 },
  around: { cy: 420, rx: 560, ry: 260, size: 150 },
  overlay: { top: 34, topWithChart: 34, scale: 0.9 },
  chart: {
    hidden: { x: 460, y: 110, w: 1000, h: 600 },
    left: { x: 930, y: 120, w: 820, h: 600 },
    right: { x: 170, y: 120, w: 820, h: 600 },
    center: { x: 1080, y: 130, w: 700, h: 580 },
  },
};

export function layoutFor(name: LayoutName | undefined): StageLayout {
  return name === 'cinema' ? CINEMA : TALL;
}
