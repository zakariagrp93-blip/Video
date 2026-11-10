import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CaptionCue, VideoPlan } from '../shared/schemas';
import { EASE_OUT } from './anim';
import { Captions } from './Captions';
import { ensureFonts, FONT_FAMILY } from './fonts';
import { CINEMA, CINEMA_SCALE, CINEMA_TOP, layoutFor, type StageLayout } from './layout';
import { SceneView } from './SceneView';

export interface FinanceVideoProps {
  plan: VideoPlan;
  [key: string]: unknown;
}

ensureFonts();

export const FinanceVideo: React.FC<FinanceVideoProps> = ({ plan }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = layoutFor(plan.layout);
  const speaking = useMemo(() => {
    const ranges: Array<[number, number]> = [];
    for (const c of plan.captions) for (const w of c.words) ranges.push([w.startFrame, w.endFrame]);
    return (f: number) => ranges.some(([a, b]) => f >= a && f < b);
  }, [plan.captions]);

  const scenes = plan.scenes.map((sc, i) => (
    <Sequence key={sc.id} from={sc.startFrame} durationInFrames={sc.durationInFrames} name={`${sc.id}`}>
      <SceneFrame plan={plan} index={i} speaking={speaking} fps={fps} layout={layout} />
    </Sequence>
  ));

  if (layout.name === 'cinema') {
    const panelH = CINEMA.height * CINEMA_SCALE;
    return (
      <AbsoluteFill style={{ backgroundColor: plan.theme.background }}>
        {plan.banner && <TitleBanner text={plan.banner} color={plan.brandName ? plan.theme.danger : '#E63A3F'} frame={frame} fps={fps} />}
        <div style={{ position: 'absolute', left: 0, top: CINEMA_TOP, width: CINEMA.width, height: CINEMA.height, transform: `scale(${CINEMA_SCALE})`, transformOrigin: '0 0', overflow: 'hidden' }}>
          {scenes}
          {/* Soft fade of the band into the black page, like a cinematic panel. */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg, #000 0%, rgba(0,0,0,0) 7%, rgba(0,0,0,0) 93%, #000 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, #000 0%, rgba(0,0,0,0) 9%, rgba(0,0,0,0) 91%, #000 100%)' }} />
        </div>
        <SentenceCaption cues={plan.captions} frame={frame} top={CINEMA_TOP + panelH + 26} accent={plan.theme.accent} danger={plan.theme.danger} />
        {plan.brandName && <BrandTag name={plan.brandName} color={plan.theme.accent} top={CINEMA_TOP + panelH + 210} />}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: plan.theme.background }}>
      {scenes}
      <Captions cues={plan.captions} frame={frame} fps={fps} accent={plan.theme.accent} danger={plan.theme.danger} />
      {plan.brandName && <BrandTag name={plan.brandName} color={plan.theme.accent} top={190} left={70} />}
    </AbsoluteFill>
  );
};

const SceneFrame: React.FC<{ plan: VideoPlan; index: number; speaking: (f: number) => boolean; fps: number; layout: StageLayout }> = ({ plan, index, speaking, fps, layout }) => {
  const frame = useCurrentFrame();
  const scene = plan.scenes[index]!;
  const next = plan.scenes[index + 1];
  return <SceneView scene={scene} nextTransition={next ? next.transition : null} frame={frame} fps={fps} theme={plan.theme} lang={plan.language} images={plan.images} talking={speaking} layout={layout} iconTone={plan.iconTone} />;
};

/** Persistent hook question in a red rounded banner (top of the frame, TikTok-safe). */
const TitleBanner: React.FC<{ text: string; color: string; frame: number; fps: number }> = ({ text, color, frame, fps }) => {
  const p = interpolate(frame, [0, Math.round(fps * 0.5)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 70, right: 70, top: 405, display: 'flex', justifyContent: 'center', opacity: p, transform: `translateY(${(1 - p) * -16}px)` }}>
      <div
        style={{
          background: color,
          color: '#FFFFFF',
          fontFamily: FONT_FAMILY,
          fontWeight: 800,
          fontSize: 50,
          lineHeight: 1.18,
          textAlign: 'center',
          padding: '12px 26px 14px',
          borderRadius: 14,
          maxWidth: 900,
          boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** One short uppercase sentence under the illustration, as in cinematic finance stories. */
const SentenceCaption: React.FC<{ cues: CaptionCue[]; frame: number; top: number; accent: string; danger: string }> = ({ cues, frame, top, accent, danger }) => {
  const cue = cues.find((c) => frame >= c.startFrame && frame < c.endFrame);
  if (!cue) return null;
  const local = frame - cue.startFrame;
  const fade = interpolate(local, [0, 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  return (
    <div style={{ position: 'absolute', left: 80, right: 80, top, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 12px', opacity: fade, transform: `translateY(${(1 - fade) * 8}px)` }}>
      {cue.words.map((w, i) => (
        <span
          key={i}
          style={{
            fontFamily: FONT_FAMILY,
            fontWeight: 900,
            fontSize: 36,
            lineHeight: 1.3,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: w.tone === 'danger' ? danger : w.tone === 'accent' && /\d/.test(w.text) ? accent : '#FFFFFF',
            whiteSpace: 'nowrap',
          }}
        >
          {w.text}
        </span>
      ))}
    </div>
  );
};

const BrandTag: React.FC<{ name: string; color: string; top: number; left?: number }> = ({ name, color, top, left }) => (
  <div style={{ position: 'absolute', top, left: left ?? 0, right: left === undefined ? 0 : undefined, textAlign: left === undefined ? 'center' : 'left', fontFamily: FONT_FAMILY, fontWeight: 800, fontSize: 34, color, letterSpacing: 1, opacity: 0.9 }}>@{name}</div>
);
