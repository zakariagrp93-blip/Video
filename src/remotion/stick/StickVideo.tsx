import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CaptionCue, VideoPlan } from '../../shared/schemas';
import { compileStickShots, type StickShot } from '../../shared/stick';
import { FONT_FAMILY } from '../fonts';

/**
 * Stick-figure explainer compositor — a port of the claude-animation-skills stick-figure
 * engine's main.js (MIT, Artem Novitckii): whip transitions with horizontal motion blur,
 * a soft vignette and film grain. The shots themselves are the code Claude wrote.
 */
const W = 1080;
const H = 1920;
const WT = 0.2; // half-length of a whip (6 frames)
const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

function grainTiles(): HTMLCanvasElement[] {
  const tiles: HTMLCanvasElement[] = [];
  for (let k = 0; k < 4; k++) {
    const g = document.createElement('canvas');
    g.width = g.height = 256;
    const gc = g.getContext('2d')!;
    const id = gc.createImageData(256, 256);
    let s = (k + 11) >>> 0;
    for (let i = 0; i < id.data.length; i += 4) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      const v = 128 + (((s >>> 0) % 100000) / 100000 - 0.5) * 120;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
    gc.putImageData(id, 0, 0);
    tiles.push(g);
  }
  return tiles;
}

export const StickVideo: React.FC<{ plan: VideoPlan }> = ({ plan }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const duration = plan.durationInFrames / fps;
  const strict = !!plan.stick?.strict;
  const compiled = useMemo<{ shots: StickShot[] | null; error: string | null }>(() => {
    try {
      return { shots: compileStickShots(plan.stick?.code ?? '', duration), error: null };
    } catch (err) {
      return { shots: null, error: (err as Error).message };
    }
  }, [plan.stick?.code, duration]);
  const buffer = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const b = document.createElement('canvas');
    b.width = W;
    b.height = H;
    return b;
  }, []);
  const grains = useMemo(() => (typeof document === 'undefined' ? [] : grainTiles()), []);

  if (strict && compiled.error) throw new Error(`Shot code failed to load: ${compiled.error}`);

  useLayoutEffect(() => {
    const out = canvas.current?.getContext('2d');
    const bctx = buffer?.getContext('2d');
    if (!out || !bctx || !buffer) return;
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.fillStyle = '#000';
    out.fillRect(0, 0, W, H);
    const shots = compiled.shots;
    if (!shots) return;
    const t = Math.min(frame / fps, duration - 1e-3);
    let i = shots.findIndex((s) => t >= s.start && t < s.end);
    if (i < 0) i = shots.length - 1;
    const s = shots[i]!;
    let dx = 0;
    let blur = 0;
    if (s.tr === 'whip' && i < shots.length - 1 && t > s.end - WT) {
      const p = easeIn((t - (s.end - WT)) / WT);
      dx = -p * 420;
      blur = p * 260;
    }
    const prev = shots[i - 1];
    if (prev && prev.tr === 'whip' && t < s.start + WT) {
      const p = 1 - easeOut((t - s.start) / WT);
      dx = p * 420;
      blur = p * 260;
    }
    // Draw the shot into the buffer.
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalAlpha = 1;
    bctx.globalCompositeOperation = 'source-over';
    bctx.filter = 'none';
    bctx.fillStyle = '#000';
    bctx.fillRect(0, 0, W, H);
    bctx.save();
    try {
      s.draw(bctx, t - s.start, t);
    } catch (err) {
      if (strict) throw new Error(`Shot ${i + 1} (${s.start.toFixed(2)}–${s.end.toFixed(2)} s) threw at t=${t.toFixed(2)} s: ${(err as Error).message}`);
      console.error('Stick shot error', err);
    }
    bctx.restore();
    // Blit with horizontal motion blur on whips.
    const n = blur > 2 ? 9 : 1;
    out.save();
    for (let k = 0; k < n; k++) {
      const off = n > 1 ? (k / (n - 1) - 0.5) * blur : 0;
      out.globalAlpha = 1 / (k + 1);
      const x = dx + off;
      out.drawImage(buffer, x, 0);
      if (x > 0) out.drawImage(buffer, x - W, 0);
      if (x < 0) out.drawImage(buffer, x + W, 0);
    }
    out.restore();
    // Grade: vignette + grain.
    out.save();
    const g = out.createRadialGradient(540, 900, 500, 540, 960, 1250);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,5,20,.32)');
    out.fillStyle = g;
    out.fillRect(0, 0, W, H);
    if (grains.length) {
      out.globalCompositeOperation = 'overlay';
      out.globalAlpha = 0.07;
      const pat = out.createPattern(grains[frame % 4]!, 'repeat');
      if (pat) {
        out.fillStyle = pat;
        out.translate((frame * 37) % 256, (frame * 91) % 256);
        out.fillRect(-256, -256, W + 512, H + 512);
      }
    }
    out.restore();
  }, [frame, fps, duration, compiled, buffer, grains, strict]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <canvas ref={canvas} width={W} height={H} style={{ width: W, height: H }} />
      {!compiled.shots && <div style={{ position: 'absolute', left: 80, right: 80, top: 860, color: '#fff', fontFamily: FONT_FAMILY, fontSize: 40, textAlign: 'center' }}>Animation unavailable</div>}
      <StickCaption cues={plan.captions} frame={frame} fps={fps} />
      {plan.brandName && <div style={{ position: 'absolute', left: 0, right: 0, top: 1560, textAlign: 'center', fontFamily: FONT_FAMILY, fontWeight: 800, fontSize: 30, color: '#fff', opacity: 0.85 }}>@{plan.brandName}</div>}
    </AbsoluteFill>
  );
};

/** Lowercase 1–3 word captions, no punctuation, white with a dark outline (y≈1345, the engine's caption band). */
const capText = (s: string) =>
  s
    .toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/[^\p{L}\p{N}%€$£ ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const StickCaption: React.FC<{ cues: CaptionCue[]; frame: number; fps: number }> = ({ cues, frame, fps }) => {
  const cue = cues.find((c) => frame >= c.startFrame && frame < c.endFrame);
  if (!cue) return null;
  const k = Math.min(1, (frame - cue.startFrame) / (fps * 0.1));
  const c1 = 1.9;
  const back = 1 + (c1 + 1) * (k - 1) ** 3 + c1 * (k - 1) ** 2;
  const text = capText(cue.words.map((w) => w.text).join(' '));
  if (!text) return null;
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: 1345, transform: `translateY(-50%) scale(${0.82 + 0.18 * back})`, textAlign: 'center' }}>
      <span style={{ fontFamily: FONT_FAMILY, fontWeight: 900, fontSize: 70, color: '#fff', WebkitTextStroke: '13px #111', paintOrder: 'stroke fill', textShadow: '0 5px 18px rgba(0,0,0,.55)', whiteSpace: 'nowrap' }}>{text}</span>
    </div>
  );
};
