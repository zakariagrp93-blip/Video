import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import type { PropAsset, Theme } from '../shared/constants';
import type { Language } from '../shared/constants';
import type { PlannedScene, SceneProp } from '../shared/schemas';
import { cameraTransform, characterMotion, propTransform, toCss, transitionStyle } from './anim';
import { BackgroundLayer } from './Backgrounds';
import { ChartView } from './Chart';
import { EffectLayer } from './Effects';
import { FONT_FAMILY } from './fonts';
import { TALL, type StageLayout } from './layout';
import { Mascot, MASCOT_FEET_Y } from './Mascot';
import { TextOverlayView } from './Overlay';
import { PropIcon } from './props/icons';

/** Kept for backwards compatibility with code that imports the tall-layout constants. */
export const BASELINE_Y = TALL.baselineY;
export const CHAR_X = TALL.charX;

/** Objects that emit light get a soft accent glow (screens, metal, trophies). */
const GLOWING: Partial<Record<PropAsset, boolean>> = { phone: true, laptop: true, clock: true, trophy: true, hourglass: true, lock: true, 'money-bag': true, coin: true, 'credit-card': true };

interface Placed {
  key: string;
  x: number;
  y: number;
  size: number;
  delayFrames: number;
  seed: number;
  prop: SceneProp;
}

function layoutProps(scene: PlannedScene, charX: number, facing: 1 | -1, fps: number, L: StageLayout): Placed[] {
  const out: Placed[] = [];
  scene.props.forEach((p, pi) => {
    const baseDelay = Math.round(p.delay * scene.durationInFrames);
    const n = p.count;
    if (p.placement === 'around') {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + ((i - (n - 1) / 2) / Math.max(1, n)) * Math.PI * 1.6;
        out.push({ key: `${pi}-${i}`, x: charX + Math.cos(a) * L.around.rx, y: L.around.cy + Math.sin(a) * L.around.ry, size: L.around.size, delayFrames: baseDelay + i * 3, seed: pi * 10 + i, prop: p });
      }
      return;
    }
    // "bottom" objects stand on the floor beside the mascot (never in front of its legs).
    const mid = L.width / 2;
    const floorX = charX < mid - 100 ? charX + L.floor.offset : charX > mid + 100 ? charX - L.floor.offset : charX + L.floor.offset * 0.95;
    const slot =
      p.placement === 'hand'
        ? { x: charX + facing * L.hand.dx, y: L.hand.y, size: L.hand.size }
        : p.placement === 'bottom'
          ? { x: floorX, y: L.baselineY - L.floor.size / 2, size: L.floor.size }
          : L.slots[p.placement];
    const size = n > 1 ? slot.size * Math.max(0.55, 1 - n * 0.08) : slot.size;
    for (let i = 0; i < n; i++) {
      const dx = (i - (n - 1) / 2) * size * 0.5;
      const dy = (i % 2) * -size * 0.22;
      out.push({ key: `${pi}-${i}`, x: slot.x + dx, y: slot.y + dy, size, delayFrames: baseDelay + i * Math.round(fps * 0.1), seed: pi * 10 + i, prop: p });
    }
  });
  return out;
}

export interface SceneViewProps {
  scene: PlannedScene;
  nextTransition: PlannedScene['transition'] | null;
  frame: number;
  fps: number;
  theme: Theme;
  lang: Language;
  images: Record<string, string>;
  talking: (absoluteFrame: number) => boolean;
  layout?: StageLayout;
  iconTone?: 'color' | 'muted' | 'mono';
}

/** In "mono", money and signals keep their colour (as in cinematic finance stories); objects go white/grey. */
const KEEP_COLOR: Partial<Record<PropAsset, boolean>> = { 'chart-up': true, 'chart-down': true, coin: true, 'coin-stack': true, 'money-bag': true, banknote: true, 'money-stack': true, 'percent-badge': true, exclamation: true, 'question-mark': true, trophy: true };

/** CSS treatment per icon tone: "muted" approaches the white/grey look of cinematic finance stories. */
const TONE_FILTER: Record<'color' | 'muted' | 'mono', string> = {
  color: '',
  muted: 'saturate(0.45) brightness(1.06) contrast(1.04)',
  mono: 'grayscale(1) brightness(1.18) contrast(1.06)',
};

export const SceneView: React.FC<SceneViewProps> = ({ scene, nextTransition, frame, fps, theme, lang, images, talking, layout = TALL, iconTone = 'color' }) => {
  const L = layout;
  const dur = scene.durationInFrames;
  const ch = scene.character;
  const motion = characterMotion(ch.motion, frame, dur);
  const facingName = motion.facingOverride ?? ch.facing;
  const facing: 1 | -1 = facingName === 'left' ? -1 : 1;
  // In the wide panel a chart needs the space beside the mascot.
  const position = L.name === 'cinema' && scene.chart && ch.position === 'center' ? 'left' : ch.position;
  const charX = L.charX[position];
  const cam = cameraTransform(scene.camera, frame, dur);
  const tr = transitionStyle(scene.transition, frame, dur, nextTransition, L.width, L.height);
  const props = layoutProps(scene, charX, facing, fps, L);
  const talk = talking(scene.startFrame + frame) ? 0.45 + 0.55 * Math.abs(Math.sin(frame * 0.9)) : 0;

  const chartBox = scene.chart ? (!ch.visible ? L.chart.hidden : L.chart[position]) : null;
  const overlayTop = chartBox && chartBox.y < 500 ? L.overlay.topWithChart : L.overlay.top;

  const s = L.charScale * motion.scale;
  const mascotW = 400 * s;
  const mascotH = 620 * s;
  const mascotLeft = charX + motion.dx - mascotW / 2;
  const mascotTop = L.baselineY - MASCOT_FEET_Y * s + motion.dy;
  const pivotY = L.baselineY - 300 * L.charScale;

  return (
    <AbsoluteFill style={{ opacity: tr.opacity, transform: tr.transform, clipPath: tr.clipPath, overflow: 'hidden', backgroundColor: theme.background }}>
      <BackgroundLayer kind={scene.background} frame={frame} anchorX={charX} width={L.width} height={L.height} baselineY={L.baselineY} scale={L.charScale / TALL.charScale} />
      <AbsoluteFill style={{ transform: toCss(cam), transformOrigin: `${charX}px ${pivotY}px` }}>
        {chartBox && scene.chart && (
          <ChartView chart={scene.chart} frame={frame} fps={fps} x={chartBox.x} y={chartBox.y} width={chartBox.w} height={chartBox.h} positive={theme.positive} danger={theme.danger} accent={theme.accent} />
        )}
        {props
          .filter((p) => p.prop.placement !== 'bottom' && p.prop.placement !== 'hand')
          .map((p) => (
            <PropView key={p.key} placed={p} frame={frame} fps={fps} theme={theme} images={images} tone={TONE_FILTER[iconTone === 'mono' && KEEP_COLOR[p.prop.asset] ? 'muted' : iconTone]} />
          ))}
        {ch.visible && (
          <div style={{ position: 'absolute', left: mascotLeft, top: mascotTop, width: mascotW, height: mascotH, transform: `scaleX(${facing})` }}>
            <Mascot pose={ch.pose} expression={ch.expression} frame={frame + scene.index * 41} fps={fps} walking={motion.walking} talk={talk} accent={theme.accent} sprout={theme.positive} seed={scene.index} />
          </div>
        )}
        {props
          .filter((p) => p.prop.placement === 'bottom' || p.prop.placement === 'hand')
          .map((p) => (
            <PropView key={p.key} placed={p} frame={frame} fps={fps} theme={theme} images={images} tone={TONE_FILTER[iconTone === 'mono' && KEEP_COLOR[p.prop.asset] ? 'muted' : iconTone]} />
          ))}
      </AbsoluteFill>
      <EffectLayer effect={scene.effect} frame={frame} accent={theme.accent} cx={charX} cy={pivotY} width={L.width} height={L.height} />
      {scene.textOverlay && <TextOverlayView overlay={scene.textOverlay} frame={frame} fps={fps} lang={lang} accent={theme.accent} danger={theme.danger} top={overlayTop} />}
    </AbsoluteFill>
  );
};

const PropView: React.FC<{ placed: Placed; frame: number; fps: number; theme: Theme; images: Record<string, string>; tone: string }> = ({ placed, frame, fps, theme, images, tone }) => {
  const t = propTransform(placed.prop.animation, frame, fps, placed.delayFrames, placed.seed);
  // Priority: AI illustration for this prop → the user's own icon for this asset → built-in artwork.
  const userIcon = images[`asset:${placed.prop.asset}`];
  const img = (placed.prop.imageKey ? images[placed.prop.imageKey] : undefined) ?? userIcon;
  const glow = GLOWING[placed.prop.asset] ? `drop-shadow(0 0 ${Math.round(placed.size * 0.09)}px ${theme.accent}66)` : '';
  const filter = [userIcon && img === userIcon ? '' : tone, glow].filter(Boolean).join(' ') || undefined;
  return (
    <div style={{ position: 'absolute', left: placed.x - placed.size / 2, top: placed.y - placed.size / 2, width: placed.size, height: placed.size, transform: toCss(t), opacity: t.opacity, filter }}>
      {img ? <Img src={img} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <PropIcon asset={placed.prop.asset} size={placed.size} accent={theme.accent} />}
      {placed.prop.label && (
        <div style={{ position: 'absolute', left: -60, right: -60, top: placed.size + 6, textAlign: 'center', fontFamily: FONT_FAMILY, fontWeight: 800, fontSize: 42, color: '#fff', textShadow: '0 4px 0 #000' }}>
          {placed.prop.label}
        </div>
      )}
    </div>
  );
};
