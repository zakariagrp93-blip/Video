import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import type { CharacterPosition, PropPlacement, Theme } from '../shared/constants';
import type { Language } from '../shared/constants';
import type { PlannedScene, SceneProp } from '../shared/schemas';
import { cameraTransform, characterMotion, propTransform, toCss, transitionStyle } from './anim';
import { BackgroundLayer } from './Backgrounds';
import { ChartView } from './Chart';
import { EffectLayer } from './Effects';
import { FONT_FAMILY } from './fonts';
import { Mascot, MASCOT_FEET_Y } from './Mascot';
import { TextOverlayView } from './Overlay';
import { PropIcon } from './props/icons';

/* Stage layout (1080x1920). Top band: overlays. Middle: stage. y≥1420: captions. */
export const BASELINE_Y = 1330;
export const CHAR_X: Record<CharacterPosition, number> = { left: 290, center: 540, right: 790 };
const CHAR_SCALE = 1.12;

const SLOTS: Record<Exclude<PropPlacement, 'around' | 'hand'>, { x: number; y: number; size: number }> = {
  left: { x: 240, y: 1050, size: 330 },
  right: { x: 840, y: 1050, size: 330 },
  top: { x: 540, y: 585, size: 240 },
  'top-left': { x: 260, y: 640, size: 260 },
  'top-right': { x: 820, y: 640, size: 260 },
  bottom: { x: 540, y: 1250, size: 210 },
  center: { x: 540, y: 930, size: 300 },
};

interface Placed {
  key: string;
  x: number;
  y: number;
  size: number;
  delayFrames: number;
  seed: number;
  prop: SceneProp;
}

function layoutProps(scene: PlannedScene, charX: number, facing: 1 | -1, fps: number): Placed[] {
  const out: Placed[] = [];
  scene.props.forEach((p, pi) => {
    const baseDelay = Math.round(p.delay * scene.durationInFrames);
    const n = p.count;
    if (p.placement === 'around') {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + ((i - (n - 1) / 2) / Math.max(1, n)) * Math.PI * 1.6;
        out.push({ key: `${pi}-${i}`, x: charX + Math.cos(a) * 360, y: 980 + Math.sin(a) * 300, size: 150, delayFrames: baseDelay + i * 3, seed: pi * 10 + i, prop: p });
      }
      return;
    }
    const slot =
      p.placement === 'hand'
        ? { x: charX + facing * 165, y: 1010, size: 150 }
        : SLOTS[p.placement];
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
}

export const SceneView: React.FC<SceneViewProps> = ({ scene, nextTransition, frame, fps, theme, lang, images, talking }) => {
  const dur = scene.durationInFrames;
  const ch = scene.character;
  const motion = characterMotion(ch.motion, frame, dur);
  const facingName = motion.facingOverride ?? ch.facing;
  const facing: 1 | -1 = facingName === 'left' ? -1 : 1;
  const charX = CHAR_X[ch.position];
  const cam = cameraTransform(scene.camera, frame, dur);
  const tr = transitionStyle(scene.transition, frame, dur, nextTransition);
  const props = layoutProps(scene, charX, facing, fps);
  const talk = talking(scene.startFrame + frame) ? 0.45 + 0.55 * Math.abs(Math.sin(frame * 0.9)) : 0;

  // Chart & overlay placement depends on where the mascot stands.
  const chartBox = scene.chart
    ? !ch.visible
      ? { x: 120, y: 640, w: 840, h: 560 }
      : ch.position === 'left'
        ? { x: 540, y: 660, w: 480, h: 420 }
        : ch.position === 'right'
          ? { x: 60, y: 660, w: 480, h: 420 }
          : { x: 150, y: 330, w: 780, h: 380 }
    : null;
  const overlayTop = chartBox && chartBox.y < 500 ? 170 : 330;

  const mascotW = 400 * CHAR_SCALE * motion.scale;
  const mascotH = 620 * CHAR_SCALE * motion.scale;
  const mascotLeft = charX + motion.dx - mascotW / 2;
  const mascotTop = BASELINE_Y - MASCOT_FEET_Y * CHAR_SCALE * motion.scale + motion.dy;

  return (
    <AbsoluteFill style={{ opacity: tr.opacity, transform: tr.transform, clipPath: tr.clipPath, overflow: 'hidden', backgroundColor: theme.background }}>
      <BackgroundLayer kind={scene.background} frame={frame} anchorX={charX} />
      <AbsoluteFill style={{ transform: toCss(cam), transformOrigin: `${charX}px 1000px` }}>
        {chartBox && scene.chart && (
          <ChartView chart={scene.chart} frame={frame} fps={fps} x={chartBox.x} y={chartBox.y} width={chartBox.w} height={chartBox.h} positive={theme.positive} danger={theme.danger} accent={theme.accent} />
        )}
        {props
          .filter((p) => p.prop.placement !== 'bottom' && p.prop.placement !== 'hand')
          .map((p) => (
            <PropView key={p.key} placed={p} frame={frame} fps={fps} theme={theme} images={images} />
          ))}
        {ch.visible && (
          <div style={{ position: 'absolute', left: mascotLeft, top: mascotTop, width: mascotW, height: mascotH, transform: `scaleX(${facing})` }}>
            <Mascot pose={ch.pose} expression={ch.expression} frame={frame + scene.index * 41} fps={fps} walking={motion.walking} talk={talk} accent={theme.accent} sprout={theme.positive} seed={scene.index} />
          </div>
        )}
        {props
          .filter((p) => p.prop.placement === 'bottom' || p.prop.placement === 'hand')
          .map((p) => (
            <PropView key={p.key} placed={p} frame={frame} fps={fps} theme={theme} images={images} />
          ))}
      </AbsoluteFill>
      <EffectLayer effect={scene.effect} frame={frame} accent={theme.accent} cx={charX} cy={950} />
      {scene.textOverlay && <TextOverlayView overlay={scene.textOverlay} frame={frame} fps={fps} lang={lang} accent={theme.accent} danger={theme.danger} top={overlayTop} />}
    </AbsoluteFill>
  );
};

const PropView: React.FC<{ placed: Placed; frame: number; fps: number; theme: Theme; images: Record<string, string> }> = ({ placed, frame, fps, theme, images }) => {
  const t = propTransform(placed.prop.animation, frame, fps, placed.delayFrames, placed.seed);
  const img = placed.prop.imageKey ? images[placed.prop.imageKey] : undefined;
  return (
    <div style={{ position: 'absolute', left: placed.x - placed.size / 2, top: placed.y - placed.size / 2, width: placed.size, height: placed.size, transform: toCss(t), opacity: t.opacity }}>
      {img ? <Img src={img} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <PropIcon asset={placed.prop.asset} size={placed.size} accent={theme.accent} />}
      {placed.prop.label && (
        <div style={{ position: 'absolute', left: -60, right: -60, top: placed.size + 6, textAlign: 'center', fontFamily: FONT_FAMILY, fontWeight: 800, fontSize: 42, color: '#fff', textShadow: '0 4px 0 #000' }}>
          {placed.prop.label}
        </div>
      )}
    </div>
  );
};
