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

/* ------------------------------------------------------------------ */
/* Minimal graph — style adapted from "claude-animation-skills" /graph  */
/* (MIT, Artem Novitckii): one smooth hairline drawing itself, a tip     */
/* dot, a soft landing ring and a dotted drop; no box, no colour chips.  */
/* ------------------------------------------------------------------ */

/** Catmull-Rom through the points, sampled into a dense polyline with cumulative lengths. */
export function smoothPath(points: Array<[number, number]>, samplesPerSegment = 24): { pts: Array<[number, number]>; cum: number[] } {
  const pts: Array<[number, number]> = [points[0]!];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const k = 0.5 / 3;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    for (let s = 1; s <= samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const u = 1 - t;
      pts.push([
        u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
        u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1],
      ]);
    }
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  return { pts, cum };
}

function pointAt(path: { pts: Array<[number, number]>; cum: number[] }, len: number): [number, number] {
  const { pts, cum } = path;
  if (len <= 0) return pts[0]!;
  const total = cum[cum.length - 1]!;
  if (len >= total) return pts[pts.length - 1]!;
  let i = 1;
  while (cum[i]! < len) i++;
  const t = (len - cum[i - 1]!) / (cum[i]! - cum[i - 1]! || 1);
  return [pts[i - 1]![0] + (pts[i]![0] - pts[i - 1]![0]) * t, pts[i - 1]![1] + (pts[i]![1] - pts[i - 1]![1]) * t];
}

const easeInOutSine = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

export const MinimalGraphView: React.FC<{ chart: Chart; frame: number; fps: number; x: number; y: number; width: number; height: number; danger: string; scale?: number }> = ({ chart, frame, fps, x, y, width, height, danger, scale = 1 }) => {
  const vals = chart.values.map((v) => Math.max(0, v));
  const vmax = Math.max(...vals) || 1;
  const s = scale;
  const left = 10 * s;
  const right = width - 10 * s;
  const top = 30 * s;
  const base = height - 60 * s;
  const px = (i: number) => left + (i * (right - left)) / Math.max(1, vals.length - 1);
  const py = (v: number) => base - (v / vmax) * (base - top);
  const f = (t: number) => frame / fps - t;
  const grid = (delay: number) => interpolate(f(delay), [0, 0.45], [0, 1], { ...clamp, easing: EASE_OUT });
  const stroke = '#F4F4F4';
  const gridColor = 'rgba(255,255,255,0.16)';

  if (chart.kind === 'bar') {
    const n = vals.length;
    const bw = Math.min(110 * s, ((right - left) / n) * 0.62);
    return (
      <div style={{ position: 'absolute', left: x, top: y, width, height }}>
        <svg width={width} height={height} style={{ overflow: 'visible' }}>
          <line x1={left} y1={base} x2={left + (right - left) * grid(0)} y2={base} stroke={stroke} strokeWidth={2 * s} />
          {vals.map((v, i) => {
            const p = interpolate(f(0.3 + i * 0.12), [0, 0.3], [0, 1], { ...clamp, easing: EASE_OUT });
            const h = (base - py(v)) * p;
            const bx = left + (i + 0.5) * ((right - left) / n) - bw / 2;
            return <rect key={i} x={bx} y={base - h} width={bw} height={h} fill="none" stroke={stroke} strokeWidth={2.6 * s} opacity={0.45 + 0.55 * ((i + 1) / n)} />;
          })}
        </svg>
        {chart.label && <GraphLabel text={chart.label} s={s} />}
      </div>
    );
  }

  const path = smoothPath(vals.map((v, i) => [px(i), py(v)]));
  const total = path.cum[path.cum.length - 1]!;
  const T0 = 0.3;
  const TD = 2.2;
  const p = easeInOutSine(interpolate(f(T0), [0, TD], [0, 1], clamp));
  const drawn = p * total;
  const tip = pointAt(path, Math.max(0.01, drawn));
  const visible = path.pts.filter((_, i) => path.cum[i]! <= drawn);
  visible.push(tip);
  const landed = f(T0 + TD);
  const halo = interpolate(landed, [0, 0.7], [0, 1], { ...clamp, easing: EASE_OUT });
  const drop = interpolate(landed, [0.05, 0.5], [0, 1], { ...clamp, easing: EASE_IN_OUT });
  const tipColor = chart.trend === 'down' ? danger : stroke;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width, height }}>
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        {[base - (base - top) / 2, top].map((gy, i) => (
          <line key={i} x1={left} y1={gy} x2={left + (right - left) * grid(0.06 * (i + 1))} y2={gy} stroke={gridColor} strokeWidth={2 * s} />
        ))}
        <line x1={left} y1={base} x2={left + (right - left) * grid(0)} y2={base} stroke={stroke} strokeWidth={2 * s} />
        {landed > 0.05 && <line x1={tip[0]} y1={tip[1] + 22 * s} x2={tip[0]} y2={tip[1] + 22 * s + (base - tip[1] - 22 * s) * drop} stroke={stroke} strokeWidth={2 * s} strokeDasharray={`${3 * s} ${9 * s}`} />}
        {p > 0 && <polyline points={visible.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ')} fill="none" stroke={stroke} strokeWidth={6 * s} strokeLinecap="round" strokeLinejoin="round" />}
        {landed > 0 && halo < 1 && <circle cx={tip[0]} cy={tip[1]} r={(13 + 47 * halo) * s} fill={stroke} opacity={0.18 * (1 - halo)} />}
        {f(T0) > 0 && <circle cx={tip[0]} cy={tip[1]} r={13 * s} fill={tipColor} stroke="#000" strokeWidth={5 * s} />}
      </svg>
      {chart.label && <GraphLabel text={chart.label} s={s} />}
    </div>
  );
};

const GraphLabel: React.FC<{ text: string; s: number }> = ({ text, s }) => (
  <div style={{ position: 'absolute', left: 10 * s, top: -34 * s, fontFamily: FONT_FAMILY, fontWeight: 600, fontSize: 34 * s, color: '#8a8a8a', whiteSpace: 'nowrap' }}>{text}</div>
);
