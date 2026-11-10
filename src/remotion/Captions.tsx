import React from 'react';
import { spring } from 'remotion';
import type { CaptionCue } from '../shared/schemas';
import { POP_SPRING } from './anim';
import { FONT_FAMILY } from './fonts';

/**
 * Animated subtitles. Placed in the TikTok-safe band (y≈1430–1620): below the
 * mascot's feet, above the platform's caption/UI area, away from the right-side buttons.
 */
export const CAPTION_TOP = 1420;
export const SAFE_LEFT = 70;
export const SAFE_RIGHT = 150;

export const Captions: React.FC<{ cues: CaptionCue[]; frame: number; fps: number; accent: string; danger: string }> = ({ cues, frame, fps, accent, danger }) => {
  const cue = cues.find((c) => frame >= c.startFrame && frame < c.endFrame);
  if (!cue) return null;
  const local = frame - cue.startFrame;
  const appear = spring({ frame: local, fps, config: POP_SPRING });
  return (
    <div style={{ position: 'absolute', left: SAFE_LEFT, right: SAFE_RIGHT, top: CAPTION_TOP, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'flex-start', gap: '0 22px', transform: `scale(${0.85 + 0.15 * appear})`, transformOrigin: '50% 0%' }}>
      {cue.words.map((w, i) => {
        const active = frame >= w.startFrame;
        const wp = spring({ frame: frame - w.startFrame, fps, config: POP_SPRING });
        const color = w.tone === 'accent' ? accent : w.tone === 'danger' ? danger : '#FFFFFF';
        return (
          <span
            key={i}
            style={{
              fontFamily: FONT_FAMILY,
              fontWeight: 900,
              fontSize: 84,
              lineHeight: 1.12,
              color,
              opacity: active ? 1 : 0.38,
              transform: `translateY(${active ? (1 - wp) * 14 : 14}px) scale(${active ? 0.92 + 0.08 * wp : 0.92})`,
              display: 'inline-block',
              WebkitTextStroke: '10px #000',
              paintOrder: 'stroke fill',
              textShadow: '0 8px 0 rgba(0,0,0,0.55)',
              whiteSpace: 'nowrap',
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
