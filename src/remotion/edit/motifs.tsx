import React from 'react';
import { Img, interpolate, random } from 'remotion';
import type { Motif, PropAsset } from '../../shared/constants';
import type { PlannedScene } from '../../shared/schemas';
import { FONT_FAMILY } from '../fonts';
import { Mascot } from '../Mascot';
import { PropIcon } from '../props/icons';

/**
 * Original full-frame shots for motivation edits (1080×1920). Everything is
 * drawn here in SVG — night skylines, roads, peaks, stairs into the light —
 * with the mascot as a back-lit silhouette.
 */
export const GOLD = '#F2C14E';
const W = 1080;
const H = 1920;

export interface MotifProps {
  scene: PlannedScene;
  frame: number;
  fps: number;
  images: Record<string, string>;
}

const r = (k: string) => random(k);

/** The mascot as a black silhouette with a warm rim light. */
const Silhouette: React.FC<{ x: number; baseY: number; scale: number; scene: PlannedScene; frame: number; fps: number; lit?: boolean; rim?: string; walking?: boolean }> = ({ x, baseY, scale, scene, frame, fps, lit, rim = '255,206,140', walking }) => {
  const w = 400 * scale;
  const h = 620 * scale;
  const facing = scene.character.facing === 'left' ? -1 : 1;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: baseY - 600 * scale,
        width: w,
        height: h,
        transform: `scaleX(${facing})`,
        filter: lit ? `drop-shadow(0 0 ${18 * scale}px rgba(${rim},0.55))` : `brightness(0) drop-shadow(0 0 ${Math.max(1, 2 * scale)}px rgba(${rim},0.95)) drop-shadow(0 0 ${16 * scale}px rgba(${rim},0.45))`,
      }}
    >
      <Mascot pose={scene.character.pose} expression={scene.character.expression} frame={frame + scene.index * 37} fps={fps} walking={walking} accent={GOLD} seed={scene.index} />
    </div>
  );
};

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
    {children}
  </svg>
);

const Stars: React.FC<{ n: number; maxY: number; frame: number; seed: string; opacity?: number }> = ({ n, maxY, frame, seed, opacity = 1 }) => (
  <g>
    {Array.from({ length: n }, (_, i) => {
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(frame * 0.05 + i * 1.7));
      return <circle key={i} cx={r(`${seed}x${i}`) * W} cy={r(`${seed}y${i}`) * maxY} r={0.8 + r(`${seed}r${i}`) * 1.8} fill="#fff" opacity={tw * 0.75 * opacity} />;
    })}
  </g>
);

/* ------------------------------------------------------------------ */

const Skyline: React.FC<MotifProps> = ({ scene, frame, fps }) => {
  const layers = [
    { base: 1330, minH: 160, maxH: 430, color: '#121722', n: 16, speed: 0.08, windows: 0.1 },
    { base: 1420, minH: 260, maxH: 640, color: '#0b0f17', n: 11, speed: 0.18, windows: 0.22 },
    { base: 1560, minH: 380, maxH: 860, color: '#06080d', n: 7, speed: 0.32, windows: 0.3 },
  ];
  return (
    <>
      <Svg>
        <defs>
          <linearGradient id="sk-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#05070c" />
            <stop offset="0.55" stopColor="#111827" />
            <stop offset="0.8" stopColor="#2a2433" />
          </linearGradient>
          <radialGradient id="sk-moon">
            <stop offset="0" stopColor="#fff6dc" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sk-fog" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3346" stopOpacity="0" />
            <stop offset="1" stopColor="#3a3346" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#sk-sky)" />
        <Stars n={60} maxY={800} frame={frame} seed="sk" opacity={0.7} />
        <circle cx={800} cy={360} r={260} fill="url(#sk-moon)" />
        <circle cx={800} cy={360} r={64} fill="#f4eedf" />
        {layers.map((L, li) => {
          const dx = -frame * L.speed;
          let x = -120;
          const out: React.ReactNode[] = [];
          for (let i = 0; i < L.n * 2 && x < W + 200; i++) {
            const bw = 90 + r(`b${li}w${i}`) * (li === 2 ? 220 : 130);
            const bh = L.minH + r(`b${li}h${i}`) * (L.maxH - L.minH);
            const top = L.base - bh;
            out.push(<rect key={`b${i}`} x={x + dx} y={top} width={bw} height={H - top} fill={L.color} />);
            if (li > 0) {
              for (let wy = top + 26; wy < L.base - 20; wy += 34) {
                for (let wx = x + 14; wx < x + bw - 18; wx += 26) {
                  const k = `w${li}-${i}-${Math.round(wx)}-${Math.round(wy)}`;
                  if (r(k) > L.windows) continue;
                  const flick = r(`${k}f`) > 0.93 ? (Math.sin(frame * 0.4 + r(k) * 9) > 0 ? 1 : 0.2) : 1;
                  out.push(<rect key={k} x={wx + dx} y={wy} width={11} height={15} fill={r(`${k}c`) > 0.25 ? GOLD : '#cfd8ff'} opacity={(0.35 + r(`${k}o`) * 0.55) * flick} />);
                }
              }
            }
            x += bw + 6 + r(`b${li}g${i}`) * 18;
          }
          return <g key={li}>{out}</g>;
        })}
        <rect y={1100} width={W} height={500} fill="url(#sk-fog)" />
        <path d={`M0 1560 L${W} 1560 L${W} ${H} L0 ${H} Z`} fill="#020304" />
        <path d={`M0 1560 L${W} 1560`} stroke="#3b3326" strokeWidth={3} />
      </Svg>
      {scene.character.visible && <Silhouette x={560} baseY={1562} scale={0.62} scene={scene} frame={frame} fps={fps} />}
    </>
  );
};

const Road: React.FC<MotifProps> = ({ scene, frame, fps }) => {
  const VX = 540;
  const VY = 900;
  const flow = frame * 0.011;
  const at = (t: number) => {
    const p = t * t;
    return { y: VY + (H - VY) * p, half: 14 + 760 * p };
  };
  const dashes: React.ReactNode[] = [];
  for (let k = 0; k < 14; k++) {
    const t0 = (k / 14 + flow) % 1;
    const t1 = Math.min(1, t0 + 0.028);
    const a = at(t0);
    const b = at(t1);
    const wa = 2 + 18 * t0 * t0;
    const wb = 2 + 18 * t1 * t1;
    dashes.push(<path key={k} d={`M${VX - wa} ${a.y} L${VX + wa} ${a.y} L${VX + wb} ${b.y} L${VX - wb} ${b.y} Z`} fill="#e9e2cf" opacity={0.85} />);
  }
  const lamps: React.ReactNode[] = [];
  for (let k = 0; k < 7; k++) {
    const t = (k / 7 + flow * 0.8) % 1;
    const p = at(t);
    for (const side of [-1, 1]) {
      const x = VX + side * (p.half + 30 + 140 * t * t);
      const hgt = 30 + 700 * t * t;
      lamps.push(
        <g key={`${k}${side}`} opacity={Math.min(1, t * 4)}>
          <line x1={x} y1={p.y} x2={x} y2={p.y - hgt} stroke="#0c0c0f" strokeWidth={2 + 10 * t} />
          <circle cx={x - side * 18 * t} cy={p.y - hgt} r={6 + 70 * t} fill="url(#rd-lamp)" />
        </g>,
      );
    }
  }
  return (
    <>
      <Svg>
        <defs>
          <linearGradient id="rd-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#04050a" />
            <stop offset="0.42" stopColor="#151326" />
            <stop offset="0.47" stopColor="#3b2a2a" />
          </linearGradient>
          <linearGradient id="rd-road" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#141419" />
            <stop offset="1" stopColor="#070709" />
          </linearGradient>
          <radialGradient id="rd-lamp">
            <stop offset="0" stopColor="#ffe2a8" stopOpacity="0.95" />
            <stop offset="0.25" stopColor="#ffb85c" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ffb85c" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="rd-glow" cx="0.5" cy="0.47" r="0.5">
            <stop offset="0" stopColor={GOLD} stopOpacity="0.35" />
            <stop offset="1" stopColor={GOLD} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#rd-sky)" />
        <Stars n={50} maxY={760} frame={frame} seed="rd" opacity={0.6} />
        <rect width={W} height={H} fill="url(#rd-glow)" />
        {Array.from({ length: 40 }, (_, i) => (
          <circle key={i} cx={r(`rc${i}`) * W} cy={VY - 4 - r(`rcy${i}`) * 18} r={1.4} fill={GOLD} opacity={0.5} />
        ))}
        <rect y={VY} width={W} height={H - VY} fill="#050506" />
        <path d={`M${VX - 14} ${VY} L${VX + 14} ${VY} L${W + 700} ${H} L${-700} ${H} Z`} fill="url(#rd-road)" />
        <path d={`M${VX - 14} ${VY} L${-700} ${H} M${VX + 14} ${VY} L${W + 700} ${H}`} stroke="#d9d0bb" strokeWidth={4} opacity={0.5} />
        {dashes}
        {lamps}
      </Svg>
      {scene.character.visible && <Silhouette x={540} baseY={1640} scale={0.78} scene={scene} frame={frame} fps={fps} walking />}
    </>
  );
};

function ridge(seed: string, base: number, amp: number, step: number): string {
  let d = `M-20 ${H} L-20 ${base}`;
  for (let x = -20; x <= W + 40; x += step) d += ` L${x} ${base - r(`${seed}${x}`) * amp}`;
  return `${d} L${W + 40} ${H} Z`;
}

const Mountain: React.FC<MotifProps> = ({ scene, frame, fps }) => {
  const fog = (frame * 0.6) % W;
  return (
    <>
      <Svg>
        <defs>
          <linearGradient id="mt-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#060812" />
            <stop offset="0.38" stopColor="#1b1d33" />
            <stop offset="0.55" stopColor="#5a3a3a" />
            <stop offset="0.64" stopColor="#c9783c" />
          </linearGradient>
          <linearGradient id="mt-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={GOLD} stopOpacity="0.9" />
            <stop offset="1" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mt-fog" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#9aa3b5" stopOpacity="0" />
            <stop offset="0.5" stopColor="#9aa3b5" stopOpacity="0.16" />
            <stop offset="1" stopColor="#9aa3b5" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#mt-sky)" />
        <Stars n={70} maxY={700} frame={frame} seed="mt" />
        <path d={ridge('mf', 1300, 260, 70)} fill="#2a2230" />
        <path d={ridge('mm', 1420, 220, 55)} fill="#15131c" />
        <path d={`M-80 1640 L210 1270 L330 1330 L540 930 L700 1210 L790 1170 L1160 1640 Z`} fill="#07070a" />
        <path d={`M430 1140 L540 930 L640 1120`} stroke="url(#mt-rim)" strokeWidth={4} fill="none" />
        <path d={ridge('mn', 1700, 160, 45)} fill="#030304" />
        <rect x={fog - W} y={1180} width={W} height={180} fill="url(#mt-fog)" />
        <rect x={fog} y={1180} width={W} height={180} fill="url(#mt-fog)" />
        <rect x={-fog * 0.7} y={1460} width={W * 1.2} height={200} fill="url(#mt-fog)" />
      </Svg>
      {scene.character.visible && <Silhouette x={540} baseY={934} scale={0.24} scene={scene} frame={frame} fps={fps} />}
    </>
  );
};

const Stairs: React.FC<MotifProps> = ({ scene, frame, fps }) => {
  const steps = 13;
  const sx = (i: number) => 60 + i * 66;
  const sy = (i: number) => 1860 - i * 100;
  const dur = scene.durationInFrames;
  const climb = 3 + interpolate(frame, [0, dur], [0, 3], { extrapolateRight: 'clamp' });
  const ci = Math.floor(climb);
  const cf = climb - ci;
  const cx = sx(ci) + 140 + cf * 66;
  const cy = sy(ci) - cf * 100;
  return (
    <>
      <Svg>
        <defs>
          <radialGradient id="st-light" cx="0.8" cy="0.2" r="0.6">
            <stop offset="0" stopColor="#fff4d6" stopOpacity="0.95" />
            <stop offset="0.18" stopColor={GOLD} stopOpacity="0.45" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="st-step" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d1b18" />
            <stop offset="1" stopColor="#070707" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="#030303" />
        <rect width={W} height={H} fill="url(#st-light)" />
        <g opacity={0.12} transform={`rotate(${Math.sin(frame / 90) * 3} 870 380)`}>
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M870 380 L${-300 + i * 120} ${H} L${-250 + i * 120} ${H} Z`} fill="#fff1cc" />
          ))}
        </g>
        {Array.from({ length: steps }, (_, i) => (
          <g key={i} opacity={Math.min(1, 0.25 + (steps - i) / steps)}>
            <path d={`M${sx(i)} ${sy(i)} L${sx(i) + 380} ${sy(i)} L${sx(i) + 380} ${H} L${sx(i)} ${H} Z`} fill="url(#st-step)" />
            <path d={`M${sx(i)} ${sy(i)} L${sx(i) + 380} ${sy(i)}`} stroke={GOLD} strokeOpacity={0.55} strokeWidth={3} />
          </g>
        ))}
        <rect x={sx(steps) + 120} y={sy(steps) - 300} width={150} height={300} rx={8} fill="#fff6dd" opacity={0.9} />
      </Svg>
      {scene.character.visible && <Silhouette x={cx} baseY={cy} scale={0.42} scene={scene} frame={frame} fps={fps} walking />}
    </>
  );
};

const Rain: React.FC<MotifProps> = ({ scene, frame, fps }) => {
  const drops = (bright: boolean) =>
    Array.from({ length: 150 }, (_, i) => {
      const speed = 38 + r(`rs${i}`) * 22;
      const x = r(`rx${i}`) * (W + 200) - 100;
      const y = ((r(`ry${i}`) * 2200 + frame * speed) % 2200) - 140;
      const len = 40 + r(`rl${i}`) * 50;
      return <line key={i} x1={x} y1={y} x2={x - 8} y2={y + len} stroke={bright ? '#ffe9c4' : '#a8b4c8'} strokeOpacity={bright ? 0.75 : 0.22} strokeWidth={bright ? 2.4 : 1.6} />;
    });
  return (
    <>
      <Svg>
        <defs>
          <linearGradient id="rn-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#06080c" />
            <stop offset="1" stopColor="#0d1118" />
          </linearGradient>
          <linearGradient id="rn-cone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd598" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ffd598" stopOpacity="0.05" />
          </linearGradient>
          <radialGradient id="rn-pool">
            <stop offset="0" stopColor="#ffd598" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ffd598" stopOpacity="0" />
          </radialGradient>
          <clipPath id="rn-clip">
            <path d="M330 640 L430 640 L840 1720 L-60 1720 Z" />
          </clipPath>
        </defs>
        <rect width={W} height={H} fill="url(#rn-bg)" />
        {Array.from({ length: 22 }, (_, i) => (
          <circle key={i} cx={r(`bk${i}`) * W} cy={300 + r(`bky${i}`) * 700} r={20 + r(`bkr${i}`) * 50} fill={r(`bkc${i}`) > 0.5 ? GOLD : '#7f93c8'} opacity={0.06 + r(`bko${i}`) * 0.08} />
        ))}
        <rect x={360} y={600} width={16} height={1120} fill="#0b0b0d" />
        <path d="M330 640 L430 640 L840 1720 L-60 1720 Z" fill="url(#rn-cone)" />
        <rect x={322} y={600} width={116} height={42} rx={10} fill="#161616" />
        <ellipse cx={380} cy={646} rx={46} ry={10} fill="#fff1d2" />
        <g>{drops(false)}</g>
        <g clipPath="url(#rn-clip)">{drops(true)}</g>
        <rect y={1720} width={W} height={200} fill="#040506" />
        <ellipse cx={400} cy={1730} rx={420} ry={60} fill="url(#rn-pool)" />
      </Svg>
      {scene.character.visible && <Silhouette x={470} baseY={1724} scale={0.72} scene={scene} frame={frame} fps={fps} />}
    </>
  );
};

const Chess: React.FC<MotifProps> = ({ frame }) => {
  const rows = 8;
  const y0 = 1250;
  const y1 = H + 120;
  const rowY = (i: number) => y0 + (y1 - y0) * Math.pow(i / rows, 1.6);
  const halfW = (y: number) => 420 + ((y - y0) / (y1 - y0)) * 900;
  const squares: React.ReactNode[] = [];
  for (let i = 0; i < rows; i++) {
    const ya = rowY(i);
    const yb = rowY(i + 1);
    for (let j = 0; j < 8; j++) {
      const xa = (y: number, k: number) => 540 - halfW(y) + (2 * halfW(y) * k) / 8;
      squares.push(<path key={`${i}-${j}`} d={`M${xa(ya, j)} ${ya} L${xa(ya, j + 1)} ${ya} L${xa(yb, j + 1)} ${yb} L${xa(yb, j)} ${yb} Z`} fill={(i + j) % 2 ? '#1a1916' : '#090909'} />);
    }
  }
  const dust = Array.from({ length: 40 }, (_, i) => {
    const y = 1600 - ((r(`cd${i}`) * 1200 + frame * (0.6 + r(`cds${i}`))) % 1300);
    return <circle key={i} cx={360 + r(`cdx${i}`) * 360 + Math.sin(frame / 30 + i) * 12} cy={y} r={1.5 + r(`cdr${i}`) * 2} fill="#ffe7b0" opacity={0.35} />;
  });
  // Pieces are drawn around (540, 1585) — their base on the board — and scaled from there.
  const piece = (x: number, s: number, op: number, baseY = 1585) => (
    <g transform={`translate(${x} ${baseY}) scale(${s}) translate(-540 -1585)`} opacity={op}>
      <ellipse cx={540} cy={1585} rx={200} ry={34} fill="#000" opacity={0.8} />
      <rect x={350} y={1520} width={380} height={64} rx={20} fill="url(#ch-body)" stroke="url(#ch-rim)" strokeWidth={4} />
      <path d="M392 1522 C430 1430 470 1340 480 1260 L600 1260 C610 1340 650 1430 688 1522 Z" fill="url(#ch-body)" stroke="url(#ch-rim)" strokeWidth={4} />
      <ellipse cx={540} cy={1256} rx={112} ry={22} fill="url(#ch-body)" stroke="url(#ch-rim)" strokeWidth={4} />
      <path d="M484 1240 C490 1180 500 1140 470 1090 L610 1090 C580 1140 590 1180 596 1240 Z" fill="url(#ch-body)" stroke="url(#ch-rim)" strokeWidth={4} />
      <path d="M440 1090 L640 1090 L660 1030 L605 1050 L575 1000 L540 1040 L505 1000 L475 1050 L420 1030 Z" fill="url(#ch-body)" stroke="url(#ch-rim)" strokeWidth={4} />
      <rect x={526} y={880} width={28} height={130} rx={4} fill="url(#ch-body)" stroke="url(#ch-rim)" strokeWidth={4} />
      <rect x={490} y={914} width={100} height={28} rx={4} fill="url(#ch-body)" stroke="url(#ch-rim)" strokeWidth={4} />
    </g>
  );
  return (
    <Svg>
      <defs>
        <linearGradient id="ch-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2d0" stopOpacity="0.32" />
          <stop offset="1" stopColor="#fff2d0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ch-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#151412" />
          <stop offset="0.45" stopColor="#050505" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <linearGradient id="ch-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={GOLD} stopOpacity="0.95" />
          <stop offset="0.35" stopColor={GOLD} stopOpacity="0.15" />
          <stop offset="1" stopColor={GOLD} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#030303" />
      {squares}
      <rect y={y0 - 4} width={W} height={260} fill="#030303" opacity={0.55} />
      <path d="M470 0 L610 0 L960 1700 L120 1700 Z" fill="url(#ch-cone)" />
      {piece(190, 0.42, 0.5, 1330)}
      {piece(900, 0.48, 0.5, 1360)}
      {piece(540, 0.92, 1, 1640)}
      {dust}
    </Svg>
  );
};

const Alarm: React.FC<MotifProps> = ({ frame, fps }) => {
  const ring = frame < fps * 1.2 && Math.floor(frame / 2) % 2 === 0;
  const shake = ring ? Math.sin(frame * 2.3) * 6 : 0;
  const colon = Math.floor(frame / (fps / 2)) % 2 === 0;
  const text = (dy: number, flip: boolean, op: number) => (
    <g transform={flip ? `translate(0 ${2 * 1310}) scale(1 -1)` : undefined} opacity={op} key={String(flip)}>
      <text x={540 + shake} y={1310 + dy} textAnchor="middle" fontFamily={FONT_FAMILY} fontWeight={900} fontSize={250} fill="#ff4a3d" filter="url(#al-glow)" letterSpacing={6}>
        05{colon ? ':' : ' '}00
      </text>
    </g>
  );
  return (
    <Svg>
      <defs>
        <filter id="al-glow" x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="14" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="al-wash" cx="0.5" cy="0.62" r="0.55">
          <stop offset="0" stopColor="#ff4a3d" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ff4a3d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#040304" />
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={-200} y={200 + i * 70 + ((frame * 0.4) % 70)} width={1500} height={26} fill="#9fb3d9" opacity={0.035} transform="rotate(-14 540 500)" />
      ))}
      <rect width={W} height={H} fill="url(#al-wash)" />
      <rect x={150 + shake} y={1080} width={780} height={300} rx={60} fill="#0b0b0c" stroke="#262326" strokeWidth={4} />
      <rect y={1380} width={W} height={540} fill="#070607" />
      <path d={`M0 1380 L${W} 1380`} stroke="#2a1d1d" strokeWidth={3} />
      {text(0, false, 1)}
      <ellipse cx={540} cy={1400} rx={420} ry={40} fill="#ff4a3d" opacity={0.16} />
    </Svg>
  );
};

/** Objects that keep a strong gold/colour tone under the cinematic grade. */
const WARM: Partial<Record<PropAsset, boolean>> = { 'money-stack': true, 'coin-stack': true, coin: true, banknote: true, 'money-bag': true, trophy: true };

const Spotlight: React.FC<MotifProps> = ({ scene, frame, images }) => {
  const asset = scene.props[0]?.asset ?? 'money-stack';
  const size = 640;
  const float = Math.sin(frame / 22) * 14;
  const rot = Math.sin(frame / 40) * 3;
  const userIcon = images[`asset:${asset}`];
  const filter = WARM[asset] ? `saturate(0.9) contrast(1.08) drop-shadow(0 0 40px ${GOLD}55)` : `saturate(0.35) contrast(1.12) brightness(0.95) drop-shadow(0 0 34px rgba(255,236,200,0.28))`;
  const art = userIcon ? <Img src={userIcon} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <PropIcon asset={asset} size={size} accent={GOLD} />;
  return (
    <>
      <Svg>
        <defs>
          <linearGradient id="sp-cone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff3d6" stopOpacity="0.28" />
            <stop offset="1" stopColor="#fff3d6" stopOpacity="0.02" />
          </linearGradient>
          <radialGradient id="sp-floor">
            <stop offset="0" stopColor="#fff0cc" stopOpacity="0.32" />
            <stop offset="1" stopColor="#fff0cc" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="#020202" />
        <path d="M470 0 L610 0 L1000 1520 L80 1520 Z" fill="url(#sp-cone)" />
        <rect y={1500} width={W} height={420} fill="#060606" />
        <ellipse cx={540} cy={1510} rx={430} ry={70} fill="url(#sp-floor)" />
      </Svg>
      <div style={{ position: 'absolute', left: 540 - size / 2, top: 1170 - size / 2 + float, width: size, height: size, transform: `rotate(${rot}deg)`, filter }}>{art}</div>
      <div style={{ position: 'absolute', left: 540 - size / 2, top: 1500, width: size, height: size * 0.55, overflow: 'hidden', opacity: 0.22, filter: `${filter} blur(3px)`, WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 85%)' }}>
        <div style={{ width: size, height: size, transform: `scaleY(-1) translateY(${-float}px)`, transformOrigin: '50% 50%', marginTop: -size * 0.02 }}>{art}</div>
      </div>
    </>
  );
};

const Sunrise: React.FC<MotifProps> = ({ scene, frame, fps }) => {
  const dur = scene.durationInFrames;
  const sunY = interpolate(frame, [0, dur], [1370, 1250], { extrapolateRight: 'clamp' });
  return (
    <>
      <Svg>
        <defs>
          <linearGradient id="sr-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#080a14" />
            <stop offset="0.4" stopColor="#2b2238" />
            <stop offset="0.6" stopColor="#a4543a" />
            <stop offset="0.7" stopColor="#f2a65a" />
          </linearGradient>
          <radialGradient id="sr-glow">
            <stop offset="0" stopColor="#fff1c9" stopOpacity="0.9" />
            <stop offset="0.3" stopColor="#ffb562" stopOpacity="0.4" />
            <stop offset="1" stopColor="#ffb562" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sr-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a1c1f" />
            <stop offset="1" stopColor="#050506" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#sr-sky)" />
        <g opacity={0.14} transform={`rotate(${frame * 0.05} 540 ${sunY})`}>
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            return <path key={i} d={`M540 ${sunY} L${540 + Math.cos(a - 0.04) * 1600} ${sunY + Math.sin(a - 0.04) * 1600} L${540 + Math.cos(a + 0.04) * 1600} ${sunY + Math.sin(a + 0.04) * 1600} Z`} fill="#ffe7b8" />;
          })}
        </g>
        <circle cx={540} cy={sunY} r={520} fill="url(#sr-glow)" />
        <circle cx={540} cy={sunY} r={150} fill="#fff4d8" />
        <rect y={1330} width={W} height={H - 1330} fill="url(#sr-sea)" />
        {Array.from({ length: 16 }, (_, i) => {
          const y = 1345 + i * i * 2.4;
          const w = 120 + i * 26 + Math.sin(frame / 8 + i) * 20;
          return <rect key={i} x={540 - w / 2} y={y} width={w} height={3 + i * 0.4} fill="#ffd9a0" opacity={0.5 - i * 0.025} />;
        })}
        <path d={`M650 ${H} L700 1250 L780 1210 L1100 1180 L1100 ${H} Z`} fill="#050405" />
      </Svg>
      {scene.character.visible && <Silhouette x={850} baseY={1204} scale={0.4} scene={scene} frame={frame} fps={fps} />}
    </>
  );
};

const Gym: React.FC<MotifProps> = ({ scene, frame }) => {
  const hit = scene.effect === 'impact' ? Math.max(0, 1 - frame / 10) : 0;
  const by = 1180 + Math.sin(frame * 1.4) * 10 * hit;
  const plate = (x: number, h: number, w: number) => <rect x={x - w / 2} y={by - h / 2} width={w} height={h} rx={14} fill="url(#gy-plate)" stroke={GOLD} strokeOpacity={0.35} strokeWidth={3} />;
  const chalk = Array.from({ length: 50 }, (_, i) => {
    const y = 1500 - ((r(`gc${i}`) * 1100 + frame * (0.4 + r(`gcs${i}`) * 0.6)) % 1200);
    return <circle key={i} cx={250 + r(`gcx${i}`) * 580 + Math.sin(frame / 25 + i) * 10} cy={y} r={1.5 + r(`gcr${i}`) * 2.2} fill="#f4f1ea" opacity={0.28} />;
  });
  return (
    <Svg>
      <defs>
        <linearGradient id="gy-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f2e8" stopOpacity="0.3" />
          <stop offset="1" stopColor="#f6f2e8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gy-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f1f1" />
          <stop offset="0.5" stopColor="#7a7a7a" />
          <stop offset="1" stopColor="#2a2a2a" />
        </linearGradient>
        <linearGradient id="gy-plate" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1c1c1c" />
          <stop offset="0.5" stopColor="#0a0a0a" />
          <stop offset="1" stopColor="#151515" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#030303" />
      <path d="M460 220 L620 220 L1000 1560 L80 1560 Z" fill="url(#gy-cone)" />
      <rect x={430} y={180} width={220} height={44} rx={12} fill="#1a1a1a" />
      <rect x={150} y={980} width={26} height={600} fill="#0e0e0e" />
      <rect x={904} y={980} width={26} height={600} fill="#0e0e0e" />
      <rect x={40} y={by - 10} width={1000} height={20} rx={10} fill="url(#gy-bar)" />
      {plate(225, 430, 60)}
      {plate(290, 340, 48)}
      {plate(855, 430, 60)}
      {plate(790, 340, 48)}
      <rect y={1560} width={W} height={360} fill="#070707" />
      <ellipse cx={540} cy={1570} rx={480} ry={40} fill="#f6f2e8" opacity={0.08} />
      {chalk}
    </Svg>
  );
};

const Crowd: React.FC<MotifProps> = ({ scene, frame, fps }) => {
  const rows = [
    { n: 9, y: 1240, s: 0.3, b: 0.2 },
    { n: 7, y: 1420, s: 0.42, b: 0.26 },
    { n: 4, y: 1680, s: 0.6, b: 0.32 },
  ];
  return (
    <>
      <Svg>
        <defs>
          <linearGradient id="cr-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#050505" />
            <stop offset="1" stopColor="#14151a" />
          </linearGradient>
          <linearGradient id="cr-cone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff1cf" stopOpacity="0.34" />
            <stop offset="1" stopColor="#fff1cf" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#cr-bg)" />
        <path d="M480 0 L600 0 L800 1620 L280 1620 Z" fill="url(#cr-cone)" />
      </Svg>
      {rows.map((row, ri) =>
        Array.from({ length: row.n }, (_, i) => {
          const spacing = (W + 300) / row.n;
          const x = ((i * spacing - frame * (1.2 + ri * 0.5) + r(`cw${ri}${i}`) * 40) % (W + 300) + (W + 300)) % (W + 300) - 150;
          if (ri === 2 && Math.abs(x - 540) < 220) return null;
          const w = 400 * row.s;
          return (
            <div key={`${ri}-${i}`} style={{ position: 'absolute', left: x - w / 2, top: row.y - 600 * row.s, width: w, height: 620 * row.s, filter: `grayscale(1) brightness(${row.b})`, transform: 'scaleX(-1)' }}>
              <Mascot pose="walking" expression="neutral" frame={frame + i * 7 + ri * 13} fps={fps} walking accent="#777" seed={i + ri} />
            </div>
          );
        }),
      )}
      <Silhouette x={540} baseY={1560} scale={0.66} scene={scene} frame={frame} fps={fps} lit rim="242,193,78" />
    </>
  );
};

const Desk: React.FC<MotifProps> = ({ scene, frame, fps }) => {
  const lines = Array.from({ length: 9 }, (_, i) => {
    const w = 60 + r(`dl${i}`) * 220;
    const vis = Math.min(1, Math.max(0, (frame - i * 6) / 6));
    return <rect key={i} x={410 + (r(`dli${i}`) > 0.6 ? 30 : 0)} y={1040 + i * 22} width={w * vis} height={9} rx={4} fill={i % 3 === 0 ? GOLD : '#bcd2ff'} opacity={0.75} />;
  });
  const steam = Array.from({ length: 3 }, (_, i) => {
    const t = ((frame + i * 20) % 60) / 60;
    return <circle key={i} cx={880 + Math.sin(t * 6 + i) * 10} cy={1240 - t * 120} r={10 + t * 16} fill="#fff" opacity={0.12 * (1 - t)} />;
  });
  return (
    <>
      <Svg>
        <defs>
          <linearGradient id="dk-win" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a1020" />
            <stop offset="1" stopColor="#1e2034" />
          </linearGradient>
          <radialGradient id="dk-screen" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0" stopColor="#9fc2ff" stopOpacity="0.3" />
            <stop offset="1" stopColor="#9fc2ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="#050508" />
        <rect x={560} y={260} width={440} height={600} fill="url(#dk-win)" />
        <Stars n={30} maxY={560} frame={frame} seed="dk" opacity={0.8} />
        <rect x={0} y={0} width={560} height={H} fill="#050508" />
        <rect x={1000} y={0} width={80} height={H} fill="#050508" />
        <rect x={0} y={860} width={W} height={H} fill="#050508" />
        <circle cx={900} cy={360} r={34} fill="#f4eedf" />
        {Array.from({ length: 50 }, (_, i) => (
          <rect key={i} x={570 + r(`dc${i}`) * 420} y={700 + r(`dcy${i}`) * 150} width={4} height={6} fill={GOLD} opacity={0.5} />
        ))}
        <path d="M780 260 L780 860 M560 560 L1000 560" stroke="#0b0b10" strokeWidth={14} />
        <rect x={548} y={248} width={464} height={624} fill="none" stroke="#0e0e14" strokeWidth={20} />
        <ellipse cx={560} cy={1150} rx={560} ry={420} fill="url(#dk-screen)" />
        <path d={`M0 1330 L${W} 1330 L${W} ${H} L0 ${H} Z`} fill="#0b0b0e" />
        <path d={`M0 1330 L${W} 1330`} stroke="#2b3550" strokeWidth={3} />
        <rect x={380} y={1010} width={400} height={260} rx={14} fill="#0d1526" stroke="#1d2a45" strokeWidth={6} />
        <rect x={392} y={1022} width={376} height={236} rx={8} fill="#13223f" />
        {lines}
        <path d="M340 1330 L820 1330 L790 1272 L370 1272 Z" fill="#1a1d26" />
        <rect x={850} y={1250} width={60} height={80} rx={10} fill="#141414" stroke="#2a2a2a" strokeWidth={3} />
        {steam}
      </Svg>
      {scene.character.visible && <Silhouette x={250} baseY={1335} scale={0.55} scene={scene} frame={frame} fps={fps} rim="170,200,255" />}
    </>
  );
};

/**
 * Minimal steps — style adapted from "claude-animation-skills" /minimalistic-graphics
 * (MIT, Artem Novitckii): pure black, hairline outlined steps rising one by one, one
 * white dot hopping up them with squash and stretch, then an orbit, a ring and sparks.
 */
const Steps: React.FC<MotifProps> = ({ scene, frame, fps }) => {
  const N = 5;
  const LX = 150;
  const RX = 930;
  const BW = Math.min(116, ((RX - LX) / N) * 0.77);
  const pitch = (RX - LX - BW) / (N - 1);
  const BX = Array.from({ length: N }, (_, k) => LX + BW / 2 + k * pitch);
  const TOP = Array.from({ length: N }, (_, k) => 1560 - k * (560 / (N - 1)));
  const R = 31;
  const t = frame / fps;
  const span = Math.max(1.6, (scene.durationInFrames / fps) * 0.62);
  const STEP = Math.min(0.5, Math.max(0.24, (span - 0.6) / (N - 1)));
  const ease = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  const out3 = (x: number) => 1 - (1 - x) ** 3;
  // Which step is the dot on, and where in its hop?
  let bx = BX[0]!;
  let by = TOP[0]! - R;
  let sx = 1;
  let sy = 1;
  const arrive = ease(0, 0.16, t);
  let scale = t < 0.16 ? 2.1 * out3(arrive) : t < 0.42 ? 2.1 - 1.1 * ease(0.16, 0.42, t) : 1;
  for (let k = 1; k < N; k++) {
    const th = 0.42 + STEP * (k - 1) + 0.2;
    if (t < th - 0.05) break;
    const h = ease(th, th + 0.3, t);
    const y0 = TOP[k - 1]! - R;
    const y1 = TOP[k]! - R;
    const peak = Math.min(y0, y1) - 120;
    bx = BX[k - 1]! + (BX[k]! - BX[k - 1]!) * h;
    by = h < 0.5 ? y0 + (peak - y0) * (1 - (1 - h * 2) ** 2) : peak + (y1 - peak) * ((h - 0.5) * 2) ** 2;
    if (t < th) [sx, sy] = [1.18, 0.78];
    else if (h < 1) [sx, sy] = h < 0.33 ? [0.9, 1.12] : [1, 1];
    else if (t < th + 0.35) [sx, sy] = [1.22, 0.74];
  }
  const TP = 0.42 + STEP * (N - 2) + 0.58;
  const pay = t - TP;
  const OX = BX[N - 1]!;
  const OY = TOP[N - 1]! - R;
  const orbit = ease(0.05, 0.6, pay);
  const ring = ease(0.18, 0.78, pay);
  const burst = out3(ease(0.05, 0.55, pay));
  if (pay >= 0) scale = 1;
  return (
    <Svg>
      <rect width={W} height={H} fill="#000" />
      <g fill="none" stroke="#f4f4f4" strokeWidth={2.6} opacity={pay > 0.1 ? 1 - 0.68 * ease(0.1, 0.6, pay) : 1}>
        {BX.map((x, k) => {
          const rise = out3(ease(k === 0 ? 0.18 : 0.42 + STEP * (k - 1), (k === 0 ? 0.18 : 0.42 + STEP * (k - 1)) + 0.32, t));
          const top = H + 40 - (H + 40 - TOP[k]!) * rise;
          return <rect key={k} x={x - BW / 2} y={top} width={BW} height={H} />;
        })}
      </g>
      {pay > 0 && (
        <>
          <circle cx={OX} cy={OY} r={112} fill="none" stroke="#f4f4f4" strokeWidth={2} strokeDasharray="5 9" opacity={orbit} transform={`rotate(${-90 + 40 * Math.min(1, pay / 1.6)} ${OX} ${OY})`} />
          <ellipse cx={OX} cy={OY} rx={180} ry={38} fill="none" stroke="#bdbdbd" strokeWidth={2} strokeDasharray={`${1000 * ring} 1000`} />
          {Array.from({ length: 22 }, (_, i) => {
            const a = (i / 22) * Math.PI * 2 + (i % 2) * 0.12;
            const d = (150 + (i % 4) * 28) * burst;
            return <circle key={i} cx={OX + Math.cos(a) * d} cy={OY + Math.sin(a) * d} r={i % 3 ? 4 : 6} fill="#f4f4f4" opacity={burst * (pay > 0.55 ? (i % 3 ? 0.35 : 0.8) : 1)} />;
          })}
          <circle cx={OX} cy={OY} r={34 * (1 + 3.2 * ease(0, 0.6, pay))} fill="none" stroke="#f4f4f4" strokeWidth={3} opacity={0.9 * (1 - ease(0, 0.6, pay))} />
        </>
      )}
      <circle cx={bx} cy={by} r={R} fill="#f4f4f4" transform={`translate(${bx} ${by + R}) scale(${sx * scale} ${sy * scale}) translate(${-bx} ${-(by + R)})`} />
    </Svg>
  );
};

export const MOTIF_VIEWS: Record<Motif, React.FC<MotifProps>> = {
  steps: Steps,
  skyline: Skyline,
  road: Road,
  mountain: Mountain,
  stairs: Stairs,
  rain: Rain,
  chess: Chess,
  alarm: Alarm,
  spotlight: Spotlight,
  sunrise: Sunrise,
  gym: Gym,
  crowd: Crowd,
  desk: Desk,
};
