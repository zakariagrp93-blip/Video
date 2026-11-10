import React from 'react';
import { interpolate } from 'remotion';
import type { Chart } from '../shared/schemas';
import { EASE_IN_OUT, EASE_OUT } from './anim';
import { FONT_FAMILY } from './fonts';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const ChartView: React.FC<{ chart: Chart; frame: number; fps: number; x: number; y: number; width: number; height: number; positive: string; danger: string; accent: string }> = ({
  chart,
  frame,
  fps,
  x,
  y,
  width,
  height,
  positive,
  danger,
  accent,
}) => {
  const color = chart.trend === 'up' ? positive : chart.trend === 'down' ? danger : accent;
  const vals = chart.values;
  const min = Math.min(0, ...vals);
  const max = Math.max(...vals) || 1;
  const pad = 30;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const px = (i: number) => pad + (i / Math.max(1, vals.length - 1)) * w;
  const py = (v: number) => pad + h - ((v - min) / (max - min || 1)) * h;
  const appear = interpolate(frame, [0, 8], [0, 1], clamp);
  const draw = interpolate(frame, [6, 6 + fps * 1.6], [0, 1], { ...clamp, easing: EASE_IN_OUT });

  return (
    <div style={{ position: 'absolute', left: x, top: y, width, height, opacity: appear }}>
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <rect x={0} y={0} width={width} height={height} rx={28} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" strokeWidth={3} />
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={pad} x2={width - pad} y1={pad + h * g} y2={pad + h * g} stroke="rgba(255,255,255,0.08)" strokeWidth={2} />
        ))}
        <line x1={pad} x2={width - pad} y1={pad + h} y2={pad + h} stroke="rgba(255,255,255,0.4)" strokeWidth={4} strokeLinecap="round" />
        {chart.kind === 'bar'
          ? vals.map((v, i) => {
              const bw = (w / vals.length) * 0.62;
              const bx = pad + (i + 0.19) * (w / vals.length);
              const p = interpolate(frame, [6 + i * 4, 18 + i * 4], [0, 1], { ...clamp, easing: EASE_OUT });
              const bh = (pad + h - py(v)) * p;
              return <rect key={i} x={bx} y={pad + h - bh} width={bw} height={bh} rx={8} fill={color} opacity={0.55 + 0.45 * (i / vals.length)} />;
            })
          : (() => {
              const pts = vals.map((v, i) => `${px(i)},${py(v)}`).join(' ');
              let len = 0;
              for (let i = 1; i < vals.length; i++) len += Math.hypot(px(i) - px(i - 1), py(vals[i]!) - py(vals[i - 1]!));
              const lastIdx = Math.min(vals.length - 1, Math.floor(draw * (vals.length - 1)));
              const t = draw * (vals.length - 1) - lastIdx;
              const ex = lastIdx < vals.length - 1 ? px(lastIdx) + (px(lastIdx + 1) - px(lastIdx)) * t : px(lastIdx);
              const ey = lastIdx < vals.length - 1 ? py(vals[lastIdx]!) + (py(vals[lastIdx + 1]!) - py(vals[lastIdx]!)) * t : py(vals[lastIdx]!);
              return (
                <>
                  <polyline points={pts} fill="none" stroke={color} strokeWidth={12} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - draw)} />
                  <circle cx={ex} cy={ey} r={14 + Math.sin(frame / 5) * 2} fill={color} stroke="#000" strokeWidth={4} />
                </>
              );
            })()}
      </svg>
      {chart.label && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: -64, textAlign: 'center', fontFamily: FONT_FAMILY, fontWeight: 800, fontSize: 44, color: '#fff' }}>{chart.label}</div>
      )}
    </div>
  );
};
