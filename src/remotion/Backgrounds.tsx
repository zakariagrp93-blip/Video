import React from 'react';
import { AbsoluteFill, random } from 'remotion';
import type { Background } from '../shared/constants';

export const BackgroundLayer: React.FC<{ kind: Background; frame: number; anchorX: number; width?: number; height?: number; baselineY?: number; scale?: number }> = ({ kind, frame, anchorX, width = 1080, baselineY = 1330, scale = 1 }) => {
  const base: React.CSSProperties = { backgroundColor: '#000' };
  switch (kind) {
    case 'vignette':
      return <AbsoluteFill style={{ ...base, background: 'radial-gradient(ellipse at 50% 45%, #141418 0%, #050506 55%, #000 100%)' }} />;
    case 'spotlight':
      return (
        <AbsoluteFill style={base}>
          <AbsoluteFill style={{ background: `radial-gradient(ellipse ${Math.round(520 * scale)}px ${Math.round(760 * scale)}px at ${anchorX}px ${Math.round(baselineY - 350 * scale)}px, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 45%, rgba(0,0,0,0) 70%)` }} />
          <div style={{ position: 'absolute', left: anchorX - 300 * scale, top: baselineY - 40 * scale, width: 600 * scale, height: 70 * scale, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,255,255,0.10), rgba(0,0,0,0) 70%)' }} />
        </AbsoluteFill>
      );
    case 'grid': {
      const offset = (frame * 0.6) % 90;
      return (
        <AbsoluteFill style={base}>
          <AbsoluteFill
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.055) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.055) 2px, transparent 2px)',
              backgroundSize: '90px 90px',
              backgroundPosition: `0 ${offset}px`,
              maskImage: 'radial-gradient(ellipse at 50% 50%, black 30%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, black 30%, transparent 75%)',
            }}
          />
        </AbsoluteFill>
      );
    }
    case 'floor':
      return (
        <AbsoluteFill style={base}>
          <div style={{ position: 'absolute', left: 80, right: 80, top: baselineY + 8, height: 4, borderRadius: 2, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: baselineY + 12, height: 240, background: 'linear-gradient(rgba(255,255,255,0.05), transparent)' }} />
        </AbsoluteFill>
      );
    case 'city': {
      const buildings = Array.from({ length: Math.ceil(width / 80) + 1 }, (_, i) => ({ x: i * 80 - 20, w: 70 + random(`bw${i}`) * 30, h: (160 + random(`bh${i}`) * 260) * Math.min(1, scale * 1.2) }));
      return (
        <AbsoluteFill style={base}>
          {buildings.map((b, i) => (
            <div key={i} style={{ position: 'absolute', left: b.x, top: baselineY + 10 - b.h, width: b.w, height: b.h, background: '#121216', borderTop: '3px solid #1d1d22' }}>
              {Array.from({ length: Math.floor(b.h / 50) }, (_, r) => (
                <div key={r} style={{ position: 'absolute', left: 14, top: 18 + r * 50, width: 12, height: 16, background: random(`w${i}-${r}`) > 0.6 ? 'rgba(255,214,10,0.35)' : '#1b1b20' }} />
              ))}
            </div>
          ))}
          <div style={{ position: 'absolute', left: 0, right: 0, top: baselineY + 10, height: 4, background: 'rgba(255,255,255,0.18)' }} />
        </AbsoluteFill>
      );
    }
    case 'stars': {
      const stars = Array.from({ length: 70 }, (_, i) => ({ x: random(`sx${i}`) * width, y: random(`sy${i}`) * baselineY, r: 1 + random(`sr${i}`) * 2.5, p: random(`sp${i}`) * 6.28 }));
      return (
        <AbsoluteFill style={base}>
          {stars.map((s, i) => (
            <div key={i} style={{ position: 'absolute', left: s.x, top: s.y, width: s.r * 2, height: s.r * 2, borderRadius: '50%', background: '#fff', opacity: 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(frame / 14 + s.p)) }} />
          ))}
        </AbsoluteFill>
      );
    }
    case 'black':
    default:
      return <AbsoluteFill style={base} />;
  }
};
