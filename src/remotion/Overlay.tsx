import React from 'react';
import { interpolate, spring } from 'remotion';
import type { Language } from '../shared/constants';
import type { TextOverlay } from '../shared/schemas';
import { EASE_OUT, POP_SPRING } from './anim';
import { FONT_FAMILY } from './fonts';

export function formatCounter(v: number, lang: Language, decimals: number): string {
  const fixed = Math.abs(v).toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const sep = lang === 'en' ? ',' : lang === 'de' ? '.' : ' ';
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const decSep = lang === 'en' ? '.' : ',';
  return `${v < 0 ? '-' : ''}${grouped}${dec ? decSep + dec : ''}`;
}

export const TextOverlayView: React.FC<{ overlay: TextOverlay; frame: number; fps: number; lang: Language; accent: string; danger: string; top: number }> = ({ overlay, frame, fps, lang, accent, danger, top }) => {
  const s = spring({ frame: frame - 3, fps, config: POP_SPRING });
  const color = overlay.style === 'warning' ? danger : overlay.style === 'number' ? accent : overlay.style === 'label' ? '#FFFFFF' : '#FFFFFF';
  const size = overlay.style === 'number' ? 128 : overlay.style === 'headline' ? 104 : overlay.style === 'warning' ? 92 : 70;
  let text = overlay.text;
  if (overlay.counter) {
    const c = overlay.counter;
    const p = interpolate(frame, [4, 4 + Math.round(fps * 1.3)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT });
    text = `${c.prefix}${formatCounter(c.from + (c.to - c.from) * p, lang, c.decimals)}${c.suffix}`;
  }
  const isPill = overlay.style === 'label' || overlay.style === 'warning';
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top, display: 'flex', justifyContent: 'center', transform: `scale(${0.6 + 0.4 * s}) translateY(${(1 - s) * 40}px)`, opacity: Math.min(1, s * 1.6) }}>
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1.05,
          color: isPill ? (overlay.style === 'warning' ? '#fff' : '#000') : color,
          background: isPill ? (overlay.style === 'warning' ? danger : '#FFFFFF') : 'transparent',
          padding: isPill ? '14px 34px' : 0,
          borderRadius: isPill ? 22 : 0,
          letterSpacing: overlay.style === 'number' ? -2 : 0,
          textAlign: 'center',
          textShadow: isPill ? 'none' : '0 6px 0 rgba(0,0,0,0.6), 0 0 40px rgba(0,0,0,0.6)',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </div>
    </div>
  );
};
