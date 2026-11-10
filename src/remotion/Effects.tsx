import React from 'react';
import { AbsoluteFill, interpolate, random } from 'remotion';
import type { Effect } from '../shared/constants';
import { IconContent } from './props/icons';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const MoneyRain: React.FC<{ frame: number; accent: string; width: number; height: number }> = ({ frame, accent, width, height }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: 22 }, (_, i) => {
        const delay = random(`md${i}`) * 40;
        const speed = (14 + random(`ms${i}`) * 10) * Math.max(0.5, height / 1920);
        const f = frame - delay;
        if (f < 0) return null;
        const y = -160 + f * speed;
        if (y > height + 100) return null;
        const x = random(`mx${i}`) * width + Math.sin(f / 9 + i) * 40;
        const rot = Math.sin(f / 7 + i) * 50;
        const size = 90 + random(`mz${i}`) * 60;
        const isCoin = i % 4 === 0;
        return (
          <svg key={i} viewBox="0 0 200 200" width={size} height={size} style={{ position: 'absolute', left: x - size / 2, top: y, transform: `rotate(${rot}deg) rotateX(${Math.sin(f / 5 + i) * 60}deg)`, opacity: 0.92 }}>
            <IconContent asset={isCoin ? 'coin' : 'banknote'} accent={accent} />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};

const CoinBurst: React.FC<{ frame: number; accent: string; cx: number; cy: number }> = ({ frame, accent, cx, cy }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: 16 }, (_, i) => {
        const f = frame - 6;
        if (f < 0) return null;
        const ang = (i / 16) * Math.PI * 2 + random(`ca${i}`) * 0.4;
        const v = 18 + random(`cv${i}`) * 14;
        const t = f;
        const x = cx + Math.cos(ang) * v * t;
        const y = cy + Math.sin(ang) * v * t * 0.8 + 0.9 * t * t;
        const op = interpolate(t, [0, 30, 45], [1, 1, 0], clamp);
        const size = 56 + random(`cs${i}`) * 30;
        return (
          <svg key={i} viewBox="0 0 200 200" width={size} height={size} style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, opacity: op, transform: `rotate(${t * 12}deg)` }}>
            <IconContent asset="coin" accent={accent} />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};

const Sparkles: React.FC<{ frame: number; accent: string; cx: number; cy: number }> = ({ frame, accent, cx, cy }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    {Array.from({ length: 12 }, (_, i) => {
      const x = cx + (random(`spx${i}`) - 0.5) * 760;
      const y = cy - 420 + random(`spy${i}`) * 700;
      const phase = random(`spp${i}`) * 40;
      const s = Math.max(0, Math.sin(((frame + phase) / 26) * Math.PI));
      const size = 30 + random(`sps${i}`) * 34;
      return (
        <svg key={i} viewBox="-10 -10 20 20" width={size} height={size} style={{ position: 'absolute', left: x, top: y, transform: `scale(${s}) rotate(${frame * 2}deg)`, opacity: s }}>
          <path d="M 0 -10 Q 1.5 -1.5 10 0 Q 1.5 1.5 0 10 Q -1.5 1.5 -10 0 Q -1.5 -1.5 0 -10 Z" fill={i % 3 === 0 ? '#fff' : accent} />
        </svg>
      );
    })}
  </AbsoluteFill>
);

const Impact: React.FC<{ frame: number; cx: number; cy: number; width: number; height: number }> = ({ frame, cx, cy, width, height }) => {
  const flash = interpolate(frame, [0, 2, 8], [0, 0.35, 0], clamp);
  const p = interpolate(frame, [0, 14], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill style={{ background: '#fff', opacity: flash }} />
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const r1 = 220 + p * 160;
          const r2 = r1 + 90 * (1 - p);
          return <line key={i} x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1} x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2} stroke="#fff" strokeWidth={10} strokeLinecap="round" opacity={1 - p} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

const Confetti: React.FC<{ frame: number; accent: string; cx: number; cy: number }> = ({ frame, accent, cx, cy }) => {
  const colors = [accent, '#FF453A', '#32D74B', '#0A84FF', '#FFFFFF'];
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: 60 }, (_, i) => {
        const delay = random(`cd${i}`) * 10;
        const f = frame - delay;
        if (f < 0) return null;
        const x = cx + (random(`cx${i}`) - 0.5) * 300 + (random(`cvx${i}`) - 0.5) * f * 26;
        const y = cy - f * (20 + random(`cvy${i}`) * 14) + 0.75 * f * f;
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: 18, height: 30, background: colors[i % colors.length], transform: `rotate(${f * 14 + i * 20}deg) scaleX(${Math.cos(f / 3 + i)})`, borderRadius: 3 }} />;
      })}
    </AbsoluteFill>
  );
};

const Smoke: React.FC<{ frame: number; cx: number; baseY: number }> = ({ frame, cx, baseY }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    {Array.from({ length: 10 }, (_, i) => {
      const f = (frame + i * 9) % 90;
      const x = cx + (random(`smx${i}`) - 0.5) * 300 + Math.sin(f / 15) * 30;
      const y = baseY - f * 6;
      const size = 80 + f * 2.5;
      return <div key={i} style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: '50%', background: 'rgba(160,160,170,0.18)', opacity: interpolate(f, [0, 15, 90], [0, 0.6, 0], clamp), filter: 'blur(6px)' }} />;
    })}
  </AbsoluteFill>
);

const SpeedLines: React.FC<{ frame: number; width: number; height: number }> = ({ frame, width, height }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    {Array.from({ length: 16 }, (_, i) => {
      const y = height * 0.25 + random(`sly${i}`) * height * 0.5;
      const len = 200 + random(`sll${i}`) * 300;
      const x = width + 120 - ((frame * 48 + random(`slx${i}`) * (width + 300)) % (width + 700));
      return <div key={i} style={{ position: 'absolute', left: x, top: y, width: len, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.35)' }} />;
    })}
  </AbsoluteFill>
);

export const EffectLayer: React.FC<{ effect: Effect; frame: number; accent: string; cx: number; cy: number; width?: number; height?: number }> = ({ effect, frame, accent, cx, cy, width = 1080, height = 1920 }) => {
  switch (effect) {
    case 'money-rain':
      return <MoneyRain frame={frame} accent={accent} width={width} height={height} />;
    case 'coin-burst':
      return <CoinBurst frame={frame} accent={accent} cx={cx} cy={cy} />;
    case 'sparkles':
      return <Sparkles frame={frame} accent={accent} cx={cx} cy={cy} />;
    case 'impact':
      return <Impact frame={frame} cx={cx} cy={cy} width={width} height={height} />;
    case 'confetti':
      return <Confetti frame={frame} accent={accent} cx={cx} cy={cy} />;
    case 'smoke':
      return <Smoke frame={frame} cx={cx} baseY={cy + 300} />;
    case 'speed-lines':
      return <SpeedLines frame={frame} width={width} height={height} />;
    default:
      return null;
  }
};
