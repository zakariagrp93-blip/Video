import React from 'react';
import { AbsoluteFill, Sequence, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CaptionCue, PlannedScene, VideoPlan } from '../../shared/schemas';
import { EASE_OUT } from '../anim';
import { FONT_FAMILY } from '../fonts';
import { GOLD, MOTIF_VIEWS } from './motifs';

/** Vertical centre of the kinetic text block (upper-middle: clear of the TikTok UI and of the shot's subject). */
export const KINETIC_CY = 760;
const RED = '#FF3B30';

const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="240" height="240" filter="url(#n)"/></svg>',
)}")`;

/** Beat pulse (0..1) after the drop, stronger on bar downbeats. */
export function beatPulse(t: number, beat: VideoPlan['beat']): number {
  if (!beat || t < beat.dropAt - 0.01) return 0;
  const period = 60 / beat.bpm;
  const n = Math.floor((t - beat.offset) / period + 1e-6);
  const since = t - (beat.offset + n * period);
  const down = ((n % 4) + 4) % 4 === 0 ? 1 : 0.55;
  return down * Math.exp(-since * 11);
}

export const EditVideo: React.FC<{ plan: VideoPlan }> = ({ plan }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pulse = beatPulse(t, plan.beat);
  const end = plan.durationInFrames;
  const fadeOut = interpolate(frame, [end - 14, end - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <AbsoluteFill style={{ transform: `scale(${1 + 0.022 * pulse})`, opacity: fadeOut }}>
        {plan.scenes.map((sc) => (
          <Sequence key={sc.id} from={sc.startFrame} durationInFrames={sc.durationInFrames} name={sc.id}>
            <EditShot scene={sc} images={plan.images} />
          </Sequence>
        ))}
      </AbsoluteFill>
      {/* Grade: vignette, grain, dark centre band behind the words. */}
      <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse 78% 62% at 50% 46%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.82) 100%)' }} />
      <AbsoluteFill style={{ pointerEvents: 'none', background: `linear-gradient(180deg, rgba(0,0,0,0) ${KINETIC_CY - 330}px, rgba(0,0,0,0.42) ${KINETIC_CY - 120}px, rgba(0,0,0,0.42) ${KINETIC_CY + 160}px, rgba(0,0,0,0) ${KINETIC_CY + 380}px)` }} />
      <AbsoluteFill style={{ pointerEvents: 'none', backgroundImage: GRAIN, backgroundPosition: `${Math.floor(random(`gx${frame}`) * 240)}px ${Math.floor(random(`gy${frame}`) * 240)}px`, opacity: 0.11, mixBlendMode: 'overlay' }} />
      <Flashes plan={plan} frame={frame} />
      <div style={{ opacity: fadeOut }}>
        <KineticCaption cues={plan.captions} frame={frame} fps={fps} pulse={pulse} />
      </div>
      {plan.brandName && <div style={{ position: 'absolute', left: 0, right: 0, top: 1500, textAlign: 'center', fontFamily: FONT_FAMILY, fontWeight: 800, fontSize: 32, letterSpacing: 3, color: GOLD, opacity: 0.85 * fadeOut }}>@{plan.brandName}</div>}
    </AbsoluteFill>
  );
};

/** One shot with its camera move, cut style and atmosphere. */
const EditShot: React.FC<{ scene: PlannedScene; images: Record<string, string> }> = ({ scene, images }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = scene.durationInFrames;
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp' });
  let scale = 1.04;
  let x = 0;
  let y = 0;
  let rot = 0;
  switch (scene.camera) {
    case 'push-in':
    case 'zoom-in':
      scale = 1.02 + 0.1 * p;
      break;
    case 'zoom-out':
      scale = 1.14 - 0.1 * p;
      break;
    case 'pan-left':
      scale = 1.1;
      x = 50 - 100 * p;
      break;
    case 'pan-right':
      scale = 1.1;
      x = -50 + 100 * p;
      break;
    case 'tilt':
      scale = 1.1;
      y = 40 - 80 * p;
      rot = -0.6 + 1.2 * p;
      break;
    default:
      scale = 1.04 + 0.03 * p;
  }
  // Cut styles: zoom-through punches in from blur, fade comes out of black.
  const intro = interpolate(frame, [0, 7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
  if (scene.transition === 'zoom-through') scale *= 1 + 0.3 * (1 - intro);
  const blur = scene.transition === 'zoom-through' ? 10 * (1 - intro) : 0;
  const opacity = scene.transition === 'fade' ? interpolate(frame, [0, 9], [0, 1], { extrapolateRight: 'clamp' }) : 1;
  const shakeAmt = scene.effect === 'impact' ? Math.max(0, 1 - frame / 12) * 16 : 0;
  const sx = shakeAmt * (random(`sx${scene.id}${frame}`) - 0.5) * 2;
  const sy = shakeAmt * (random(`sy${scene.id}${frame}`) - 0.5) * 2;
  const View = MOTIF_VIEWS[scene.motif ?? 'skyline'];
  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity, filter: `contrast(1.08) saturate(0.86)${blur ? ` blur(${blur.toFixed(1)}px)` : ''}` }}>
      <AbsoluteFill style={{ transform: `translate(${x + sx}px, ${y + sy}px) scale(${scale}) rotate(${rot}deg)`, transformOrigin: '50% 55%' }}>
        <View scene={scene} frame={frame} fps={fps} images={images} />
      </AbsoluteFill>
      {scene.effect === 'smoke' && <Fog frame={frame} />}
      {scene.effect === 'sparkles' && <GoldDust frame={frame} id={scene.id} />}
    </AbsoluteFill>
  );
};

const Fog: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: ((frame * (0.6 + i * 0.3) + i * 400) % 1600) - 500,
          top: 1050 + i * 220,
          width: 1100,
          height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(190,198,215,0.16) 0%, rgba(190,198,215,0) 70%)',
        }}
      />
    ))}
  </AbsoluteFill>
);

const GoldDust: React.FC<{ frame: number; id: string }> = ({ frame, id }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <svg width={1080} height={1920}>
      {Array.from({ length: 46 }, (_, i) => {
        const y = 1700 - ((random(`${id}g${i}`) * 1500 + frame * (1.2 + random(`${id}gs${i}`) * 1.6)) % 1600);
        const x = 160 + random(`${id}gx${i}`) * 760 + Math.sin(frame / 18 + i) * 16;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(frame / 9 + i));
        return <circle key={i} cx={x} cy={y} r={1.6 + random(`${id}gr${i}`) * 3} fill={GOLD} opacity={0.55 * tw} />;
      })}
    </svg>
  </AbsoluteFill>
);

/** White flash on hits, a short dip on hard cuts. */
const Flashes: React.FC<{ plan: VideoPlan; frame: number }> = ({ plan, frame }) => {
  let o = 0;
  for (const sc of plan.scenes) {
    const local = frame - sc.startFrame;
    if (local < 0 || local > 8) continue;
    if (sc.effect === 'impact') o = Math.max(o, interpolate(local, [0, 6], [0.85, 0], { extrapolateRight: 'clamp' }));
    else if (sc.index > 0 && sc.transition === 'cut') o = Math.max(o, interpolate(local, [0, 3], [0.28, 0], { extrapolateRight: 'clamp' }));
  }
  return o > 0 ? <AbsoluteFill style={{ backgroundColor: '#fff', opacity: o, pointerEvents: 'none' }} /> : null;
};

/** Big centred words that slam in one by one with the voice. */
export const KineticCaption: React.FC<{ cues: CaptionCue[]; frame: number; fps: number; pulse: number }> = ({ cues, frame, pulse }) => {
  const cue = cues.find((c) => frame >= c.startFrame && frame < c.endFrame);
  if (!cue) return null;
  const longest = Math.max(...cue.words.map((w) => w.text.length));
  const fontSize = Math.round(Math.min(132, 940 / Math.max(4, longest * 0.66), cue.words.length > 2 ? 118 : 132));
  const out = interpolate(frame, [cue.endFrame - 3, cue.endFrame], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top: KINETIC_CY,
        transform: `translateY(-50%) scale(${1 + 0.012 * pulse})`,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: `0 ${Math.round(fontSize * 0.26)}px`,
        opacity: out,
      }}
    >
      {cue.words.map((w, i) => {
        const local = frame - w.startFrame;
        if (local < 0) return null;
        const p = interpolate(local, [0, 5], [0, 1], { extrapolateRight: 'clamp', easing: EASE_OUT });
        const color = w.tone === 'accent' ? GOLD : w.tone === 'danger' ? RED : '#FFFFFF';
        const glow = w.tone === 'accent' ? `0 0 34px ${GOLD}88, 0 0 8px ${GOLD}aa` : w.tone === 'danger' ? `0 0 30px ${RED}77` : '0 0 24px rgba(255,255,255,0.25)';
        return (
          <span
            key={i}
            style={{
              fontFamily: FONT_FAMILY,
              fontWeight: 900,
              fontSize,
              lineHeight: 1.08,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color,
              display: 'inline-block',
              whiteSpace: 'nowrap',
              opacity: Math.min(1, p * 1.6),
              transform: `scale(${1.45 - 0.45 * p})`,
              filter: p < 1 ? `blur(${((1 - p) * 9).toFixed(1)}px)` : undefined,
              textShadow: `${glow}, 0 6px 18px rgba(0,0,0,0.85)`,
            }}
          >
            {w.text.replace(/[.,;:…]+$/u, '')}
          </span>
        );
      })}
    </div>
  );
};
