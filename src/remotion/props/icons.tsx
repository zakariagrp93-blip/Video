import React, { useId } from 'react';
import type { PropAsset } from '../../shared/constants';
import { FLUENT } from './fluent.generated';

/**
 * Vector illustration library (v2, "clean" style). Every object shares one
 * visual language: soft vertical gradients, a thin near-black outline, small
 * white highlights for volume, and restrained colour (gold for coins, green
 * for cash, red for losses, the theme accent for details). viewBox 0 0 200 200.
 */
const K = '#141418';
const SW = 4;

type U = (name: string) => string;
type IconProps = { accent: string; u: U };

const s = { stroke: K, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const thin = { stroke: K, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const, fill: 'none' };

function shade(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Shared gradient palette, emitted once per icon instance with unique ids. */
function Palette({ id, accent }: { id: string; accent: string }) {
  const lin = (name: string, a: string, b: string) => (
    <linearGradient key={name} id={`${id}-${name}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={a} />
      <stop offset="100%" stopColor={b} />
    </linearGradient>
  );
  return (
    <defs>
      {lin('white', '#FFFFFF', '#E2E2EA')}
      {lin('paper', '#FFFFFF', '#EDEDF2')}
      {lin('gold', '#FFE680', '#F2B200')}
      {lin('goldDark', '#E9B21A', '#B88300')}
      {lin('green', '#5BE38A', '#22A44F')}
      {lin('greenDark', '#2AB459', '#167A3A')}
      {lin('red', '#FF7A70', '#E0352B')}
      {lin('dark', '#43434F', '#1C1C23')}
      {lin('darker', '#2A2A33', '#111116')}
      {lin('glass', '#CDEBFF', '#7FC4F5')}
      {lin('brown', '#D49A5C', '#91592A')}
      {lin('pink', '#FFC9D8', '#FF8FB0')}
      {lin('gray', '#D9D9E2', '#A9A9B6')}
      {lin('accent', shade(accent, 0.25), shade(accent, -0.12))}
      {lin('blue', '#7FA2FF', '#3D5AE6')}
    </defs>
  );
}

const Shine = ({ x, y, w, h, r = 4, o = 0.7 }: { x: number; y: number; w: number; h: number; r?: number; o?: number }) => <rect x={x} y={y} width={w} height={h} rx={r} fill="#FFFFFF" opacity={o} />;

/* ------------------------------------------------------------------ money */

const Banknote = ({ u }: IconProps) => (
  <g>
    <rect x={18} y={58} width={164} height={86} rx={10} fill={u('green')} {...s} />
    <rect x={30} y={70} width={140} height={62} rx={6} fill="none" stroke="#8BF0AE" strokeWidth={2.5} opacity={0.8} />
    <circle cx={100} cy={101} r={22} fill={u('greenDark')} {...s} strokeWidth={3} />
    <text x={100} y={111} textAnchor="middle" fontSize={28} fontWeight={900} fill="#B6F7CB" fontFamily="Arial, sans-serif">
      €
    </text>
    <circle cx={46} cy={101} r={7} fill="#1E8F45" />
    <circle cx={154} cy={101} r={7} fill="#1E8F45" />
    <Shine x={28} y={64} w={60} h={6} o={0.45} />
  </g>
);

const MoneyStack = ({ u }: IconProps) => (
  <g>
    {[0, 1, 2, 3].map((i) => (
      <g key={i} transform={`translate(${(i % 2) * 4} ${-i * 19})`}>
        <rect x={24} y={124} width={148} height={42} rx={7} fill={u('green')} {...s} />
        <rect x={34} y={132} width={128} height={26} rx={4} fill="none" stroke="#8BF0AE" strokeWidth={2} opacity={0.6} />
        <rect x={82} y={124} width={34} height={42} fill={u('paper')} {...s} strokeWidth={3} />
      </g>
    ))}
    <Shine x={30} y={72} w={44} h={5} o={0.5} />
  </g>
);

const Coin = ({ u }: IconProps) => (
  <g>
    <ellipse cx={100} cy={108} rx={64} ry={64} fill={u('goldDark')} {...s} />
    <circle cx={100} cy={100} r={64} fill={u('gold')} {...s} />
    <circle cx={100} cy={100} r={48} fill="none" stroke="#C98F00" strokeWidth={4} />
    <text x={100} y={122} textAnchor="middle" fontSize={62} fontWeight={900} fill="#C98F00" fontFamily="Arial, sans-serif">
      €
    </text>
    <path d="M 62 66 A 52 52 0 0 1 104 44" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" fill="none" opacity={0.75} />
  </g>
);

const CoinStack = ({ u }: IconProps) => (
  <g>
    {[0, 1, 2, 3, 4].map((i) => (
      <g key={i}>
        <path d={`M 40 ${156 - i * 22} L 40 ${170 - i * 22} A 60 18 0 0 0 160 ${170 - i * 22} L 160 ${156 - i * 22}`} fill={u('goldDark')} {...s} />
        <ellipse cx={100} cy={156 - i * 22} rx={60} ry={18} fill={u('gold')} {...s} />
      </g>
    ))}
    <ellipse cx={100} cy={68} rx={36} ry={10} fill="none" stroke="#C98F00" strokeWidth={3} />
    <path d="M 62 62 Q 80 54 100 53" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.8} />
  </g>
);

const MoneyBag = ({ u }: IconProps) => (
  <g>
    <path d="M 74 66 C 20 98 22 180 100 180 C 178 180 180 98 126 66 Z" fill={u('white')} {...s} />
    <path d="M 70 62 L 82 38 L 100 48 L 118 38 L 130 62 Z" fill={u('white')} {...s} />
    <path d="M 70 64 Q 100 74 130 64" stroke="#B8860B" strokeWidth={9} fill="none" strokeLinecap="round" />
    <circle cx={100} cy={128} r={30} fill={u('gold')} {...s} strokeWidth={3} />
    <text x={100} y={140} textAnchor="middle" fontSize={34} fontWeight={900} fill="#B07C00" fontFamily="Arial, sans-serif">
      €
    </text>
    <path d="M 52 110 Q 54 88 72 80" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" fill="none" opacity={0.8} />
  </g>
);

const Bank = ({ u }: IconProps) => (
  <g>
    <path d="M 18 78 L 100 30 L 182 78 Z" fill={u('white')} {...s} />
    <circle cx={100} cy={60} r={10} fill={u('gold')} {...s} strokeWidth={3} />
    <rect x={24} y={78} width={152} height={14} rx={3} fill={u('gray')} {...s} />
    {[38, 72, 110, 144].map((x) => (
      <g key={x}>
        <rect x={x} y={94} width={18} height={58} rx={3} fill={u('white')} {...s} strokeWidth={3} />
        <rect x={x + 4} y={98} width={4} height={50} rx={2} fill="#FFFFFF" opacity={0.9} />
      </g>
    ))}
    <rect x={16} y={152} width={168} height={14} rx={3} fill={u('gray')} {...s} />
    <rect x={8} y={166} width={184} height={12} rx={3} fill={u('white')} {...s} />
  </g>
);

/* ------------------------------------------------------------------ property & vehicles */

const House = ({ u }: IconProps) => (
  <g>
    <rect x={132} y={40} width={18} height={40} fill={u('gray')} {...s} />
    <rect x={44} y={92} width={112} height={82} fill={u('white')} {...s} />
    <path d="M 26 100 L 100 36 L 174 100 Z" fill={u('red')} {...s} />
    <path d="M 40 94 L 100 44 L 160 94" stroke="#FF9B93" strokeWidth={3} fill="none" opacity={0.8} />
    <rect x={86} y={124} width={30} height={50} rx={3} fill={u('accent')} {...s} strokeWidth={3} />
    <circle cx={109} cy={150} r={2.8} fill={K} />
    {[56, 124].map((x) => (
      <g key={x}>
        <rect x={x} y={108} width={22} height={22} rx={2} fill={u('glass')} {...s} strokeWidth={3} />
        <path d={`M ${x + 11} 108 L ${x + 11} 130 M ${x} 119 L ${x + 22} 119`} {...thin} strokeWidth={2} />
      </g>
    ))}
    <rect x={36} y={172} width={128} height={6} rx={3} fill={u('gray')} {...s} strokeWidth={3} />
  </g>
);

const Mansion = ({ u }: IconProps) => (
  <g>
    <rect x={20} y={98} width={160} height={74} fill={u('white')} {...s} />
    <path d="M 12 100 L 60 66 L 108 100 Z" fill={u('dark')} {...s} />
    <path d="M 92 100 L 140 66 L 188 100 Z" fill={u('dark')} {...s} />
    <rect x={62} y={74} width={76} height={98} fill={u('white')} {...s} />
    <path d="M 52 78 L 100 34 L 148 78 Z" fill={u('dark')} {...s} />
    <circle cx={100} cy={60} r={8} fill={u('glass')} {...s} strokeWidth={3} />
    {[70, 82, 112, 124].map((x) => (
      <rect key={x} x={x} y={88} width={8} height={84} fill={u('paper')} stroke={K} strokeWidth={2} />
    ))}
    <rect x={90} y={128} width={20} height={44} rx={10} fill={u('accent')} {...s} strokeWidth={3} />
    {[30, 152].map((x) => (
      <rect key={x} x={x} y={112} width={18} height={24} rx={2} fill={u('glass')} {...s} strokeWidth={3} />
    ))}
    <rect x={10} y={170} width={180} height={8} rx={3} fill={u('gray')} {...s} strokeWidth={3} />
  </g>
);

const Car = ({ u }: IconProps) => (
  <g>
    <path d="M 18 132 L 24 106 C 26 100 30 98 36 97 L 62 94 L 82 70 C 85 67 88 66 92 66 L 130 66 C 135 66 139 68 142 72 L 160 96 L 172 100 C 178 102 182 106 182 112 L 182 132 Z" fill={u('blue')} {...s} />
    <path d="M 88 74 L 112 74 L 112 96 L 72 96 Z" fill={u('glass')} {...s} strokeWidth={3} />
    <path d="M 120 74 L 132 74 L 148 96 L 120 96 Z" fill={u('glass')} {...s} strokeWidth={3} />
    <path d="M 30 112 L 176 112" stroke="#A9BCFF" strokeWidth={3} opacity={0.8} />
    <rect x={168} y={104} width={12} height={8} rx={3} fill={u('accent')} stroke={K} strokeWidth={2.5} />
    {[58, 148].map((x) => (
      <g key={x}>
        <circle cx={x} cy={134} r={19} fill={u('darker')} {...s} />
        <circle cx={x} cy={134} r={8} fill={u('gray')} stroke={K} strokeWidth={2.5} />
      </g>
    ))}
    <Shine x={40} y={101} w={30} h={4} o={0.55} />
  </g>
);

const SportsCar = ({ accent, u }: IconProps) => (
  <g>
    <path d="M 10 134 L 14 116 C 15 111 19 108 24 107 L 64 100 L 96 80 C 100 78 104 77 108 77 L 140 79 C 146 79 150 81 154 85 L 170 100 L 186 106 C 191 108 194 112 194 118 L 194 134 Z" fill={u('red')} {...s} />
    <path d="M 102 86 L 138 87 L 156 102 L 84 102 Z" fill={u('darker')} {...s} strokeWidth={3} />
    <path d="M 22 120 L 188 120" stroke="#FFA49C" strokeWidth={3} opacity={0.8} />
    <path d="M 176 108 L 190 112" stroke={accent} strokeWidth={5} strokeLinecap="round" />
    {[52, 156].map((x) => (
      <g key={x}>
        <circle cx={x} cy={136} r={18} fill={u('darker')} {...s} />
        <circle cx={x} cy={136} r={8} fill={u('gold')} stroke={K} strokeWidth={2.5} />
      </g>
    ))}
    <Shine x={34} y={109} w={34} h={4} o={0.6} />
  </g>
);

const Plane = ({ u }: IconProps) => (
  <g>
    <path d="M 84 100 L 116 42 L 136 42 L 120 98 Z" fill={u('white')} {...s} />
    <path d="M 14 114 L 148 86 C 174 80 190 92 178 104 L 46 142 Z" fill={u('white')} {...s} />
    <path d="M 82 128 L 98 164 L 116 162 L 108 122 Z" fill={u('gray')} {...s} />
    <path d="M 22 112 L 12 84 L 32 84 L 46 106 Z" fill={u('accent')} {...s} />
    {[90, 106, 122].map((x, i) => (
      <circle key={x} cx={x} cy={106 - i * 3.4} r={4} fill={u('glass')} stroke={K} strokeWidth={2} />
    ))}
    <circle cx={160} cy={93} r={6} fill={u('glass')} stroke={K} strokeWidth={2.5} />
  </g>
);

const Yacht = ({ u }: IconProps) => (
  <g>
    <path d="M 100 76 L 100 40" {...s} />
    <path d="M 102 42 L 128 51 L 102 60 Z" fill={u('accent')} {...s} strokeWidth={3} />
    <path d="M 72 104 L 82 80 L 126 80 L 134 104 Z" fill={u('white')} {...s} />
    <path d="M 50 130 L 64 102 L 146 102 L 160 130 Z" fill={u('white')} {...s} />
    {[78, 98, 118].map((x) => (
      <rect key={x} x={x} y={108} width={14} height={10} rx={3} fill={u('glass')} stroke={K} strokeWidth={2.5} />
    ))}
    <path d="M 12 128 L 188 128 L 160 164 L 38 164 Z" fill={u('white')} {...s} />
    <path d="M 28 142 L 172 142" stroke="#3D5AE6" strokeWidth={5} />
    <path d="M 20 176 Q 40 168 60 176 T 100 176 T 140 176 T 180 176" stroke="#7FC4F5" strokeWidth={4} fill="none" strokeLinecap="round" />
  </g>
);

/* ------------------------------------------------------------------ devices & cards */

const Phone = ({ u }: IconProps) => (
  <g>
    <rect x={56} y={18} width={88} height={166} rx={18} fill={u('dark')} {...s} />
    <rect x={64} y={28} width={72} height={146} rx={12} fill="#0E0E13" />
    <rect x={88} y={33} width={24} height={6} rx={3} fill="#2A2A33" />
    <rect x={72} y={48} width={56} height={26} rx={7} fill={u('accent')} />
    <rect x={76} y={54} width={26} height={5} rx={2.5} fill="#000000" opacity={0.35} />
    <rect x={76} y={63} width={38} height={6} rx={3} fill="#000000" opacity={0.5} />
    <rect x={72} y={82} width={36} height={7} rx={3.5} fill="#4A4A55" />
    <rect x={72} y={95} width={48} height={7} rx={3.5} fill="#4A4A55" />
    <path d="M 74 156 L 90 140 L 104 148 L 126 122" stroke="#32D74B" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={126} cy={122} r={4} fill="#32D74B" />
    <path d="M 62 34 L 62 90" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.25} />
  </g>
);

const CreditCard = ({ u }: IconProps) => (
  <g>
    <rect x={14} y={46} width={172} height={110} rx={14} fill={u('dark')} {...s} />
    <path d="M 120 46 L 186 46 L 186 112 Z" fill="#FFFFFF" opacity={0.06} />
    <rect x={32} y={74} width={36} height={28} rx={6} fill={u('gold')} stroke={K} strokeWidth={2.5} />
    <path d="M 32 88 L 68 88 M 50 74 L 50 102" stroke="#B07C00" strokeWidth={2} />
    <path d="M 82 80 Q 88 88 82 96 M 90 76 Q 98 88 90 100" stroke="#C9C9D3" strokeWidth={3} fill="none" strokeLinecap="round" />
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={32 + i * 34} y={118} width={26} height={7} rx={3.5} fill="#C9C9D3" />
    ))}
    <rect x={32} y={134} width={56} height={6} rx={3} fill="#7A7A86" />
    <circle cx={152} cy={138} r={10} fill="#FF5F57" opacity={0.95} />
    <circle cx={166} cy={138} r={10} fill="#FFB800" opacity={0.85} />
  </g>
);

const Laptop = ({ accent, u }: IconProps) => (
  <g>
    <rect x={38} y={40} width={124} height={88} rx={9} fill={u('dark')} {...s} />
    <rect x={47} y={49} width={106} height={70} rx={4} fill="#0E0E13" />
    <path d="M 58 106 L 80 86 L 98 96 L 138 62" stroke={accent} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={138} cy={62} r={5} fill={accent} />
    <path d="M 18 134 L 182 134 L 170 156 C 168 159 165 160 162 160 L 38 160 C 35 160 32 159 30 156 Z" fill={u('gray')} {...s} />
    <rect x={84} y={136} width={32} height={5} rx={2.5} fill="#8A8A96" />
  </g>
);

/* ------------------------------------------------------------------ charts & time */

const ChartUp = ({ u }: IconProps) => (
  <g>
    <rect x={22} y={22} width={156} height={156} rx={20} fill={u('white')} {...s} />
    {[60, 96, 132].map((y) => (
      <path key={y} d={`M 40 ${y} L 160 ${y}`} stroke="#D9D9E2" strokeWidth={2} />
    ))}
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={44 + i * 30} y={146 - (i + 1) * 18} width={18} height={(i + 1) * 18} rx={4} fill="#BDF3CE" />
    ))}
    <path d="M 42 140 L 78 106 L 104 118 L 154 66" stroke="#22A44F" strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 128 62 L 156 62 L 156 90" stroke="#22A44F" strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

const ChartDown = ({ u }: IconProps) => (
  <g>
    <rect x={22} y={22} width={156} height={156} rx={20} fill={u('white')} {...s} />
    {[60, 96, 132].map((y) => (
      <path key={y} d={`M 40 ${y} L 160 ${y}`} stroke="#D9D9E2" strokeWidth={2} />
    ))}
    <path d="M 42 62 L 78 98 L 104 84 L 154 138" stroke="#E0352B" strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 126 140 L 156 140 L 156 110" stroke="#E0352B" strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

const Clock = ({ u }: IconProps) => (
  <g>
    <path d="M 56 36 L 40 52 M 144 36 L 160 52" stroke={K} strokeWidth={12} strokeLinecap="round" />
    <circle cx={100} cy={106} r={70} fill={u('dark')} {...s} />
    <circle cx={100} cy={106} r={58} fill={u('white')} {...s} strokeWidth={3} />
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const r1 = i % 3 === 0 ? 44 : 49;
      return <path key={i} d={`M ${100 + Math.sin(a) * r1} ${106 - Math.cos(a) * r1} L ${100 + Math.sin(a) * 53} ${106 - Math.cos(a) * 53}`} stroke={K} strokeWidth={i % 3 === 0 ? 4 : 2} strokeLinecap="round" />;
    })}
    <path d="M 100 106 L 100 70" stroke={K} strokeWidth={7} strokeLinecap="round" />
    <path d="M 100 106 L 128 120" stroke={K} strokeWidth={6} strokeLinecap="round" />
    <path d="M 100 106 L 82 146" stroke="#E0352B" strokeWidth={3} strokeLinecap="round" />
    <circle cx={100} cy={106} r={7} fill={u('accent')} stroke={K} strokeWidth={2.5} />
  </g>
);

const Hourglass = ({ accent, u }: IconProps) => (
  <g>
    <rect x={46} y={20} width={108} height={14} rx={5} fill={u('brown')} {...s} />
    <rect x={46} y={166} width={108} height={14} rx={5} fill={u('brown')} {...s} />
    <path d="M 62 34 C 62 76 94 88 94 100 C 94 112 62 124 62 166 L 138 166 C 138 124 106 112 106 100 C 106 88 138 76 138 34 Z" fill={u('glass')} {...s} opacity={0.95} />
    <path d="M 72 52 L 128 52 C 122 72 106 82 100 92 C 94 82 78 72 72 52 Z" fill={accent} />
    <path d="M 68 160 C 74 138 94 130 100 124 C 106 130 126 138 132 160 Z" fill={accent} />
    <path d="M 100 96 L 100 122" stroke={accent} strokeWidth={3} strokeDasharray="3 4" />
    <path d="M 70 42 L 70 64" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
  </g>
);

const Calendar = ({ accent, u }: IconProps) => (
  <g>
    <rect x={28} y={40} width={144} height={136} rx={16} fill={u('white')} {...s} />
    <path d="M 28 80 L 28 56 C 28 47 35 40 44 40 L 156 40 C 165 40 172 47 172 56 L 172 80 Z" fill={u('red')} {...s} />
    {[64, 136].map((x) => (
      <rect key={x} x={x - 6} y={24} width={12} height={30} rx={6} fill={u('gray')} {...s} strokeWidth={3} />
    ))}
    {[0, 1, 2].map((r) =>
      [0, 1, 2, 3].map((c) => (
        <rect key={`${r}-${c}`} x={44 + c * 30} y={94 + r * 26} width={20} height={16} rx={4} fill={r === 1 && c === 2 ? accent : '#E4E4EC'} stroke={r === 1 && c === 2 ? K : 'none'} strokeWidth={2} />
      )),
    )}
  </g>
);

/* ------------------------------------------------------------------ everyday objects */

const Building = ({ u }: IconProps) => (
  <g>
    <rect x={50} y={22} width={100} height={156} rx={4} fill={u('white')} {...s} />
    <rect x={50} y={22} width={100} height={14} fill={u('gray')} {...s} strokeWidth={3} />
    {[0, 1, 2, 3, 4].map((r) =>
      [0, 1, 2].map((c) => <rect key={`${r}-${c}`} x={62 + c * 27} y={46 + r * 22} width={18} height={14} rx={2} fill={r === 1 && c === 1 ? u('accent') : u('glass')} stroke={K} strokeWidth={2} />),
    )}
    <rect x={86} y={154} width={28} height={24} rx={2} fill={u('dark')} {...s} strokeWidth={3} />
  </g>
);

const Shop = ({ u }: IconProps) => (
  <g>
    <rect x={30} y={84} width={140} height={92} fill={u('white')} {...s} />
    <path d="M 22 86 L 36 44 L 164 44 L 178 86 Z" fill={u('red')} {...s} />
    {[52, 84, 116, 148].map((x, i) => (
      <path key={x} d={`M ${x} 44 L ${x - 6 + i * 4} 86`} stroke="#FFFFFF" strokeWidth={10} opacity={0.85} />
    ))}
    <path d="M 22 86 Q 39 102 56 86 Q 73 102 90 86 Q 107 102 124 86 Q 141 102 158 86 Q 168 98 178 86" fill={u('red')} {...s} strokeWidth={3} />
    <rect x={46} y={110} width={52} height={40} rx={3} fill={u('glass')} {...s} strokeWidth={3} />
    <rect x={112} y={106} width={42} height={70} rx={3} fill={u('accent')} {...s} strokeWidth={3} />
    <circle cx={146} cy={142} r={3} fill={K} />
  </g>
);

const PiggyBank = ({ u }: IconProps) => (
  <g>
    <rect x={66} y={150} width={20} height={28} rx={7} fill={u('pink')} {...s} />
    <rect x={116} y={150} width={20} height={28} rx={7} fill={u('pink')} {...s} />
    <ellipse cx={100} cy={116} rx={68} ry={52} fill={u('pink')} {...s} />
    <path d="M 64 76 L 58 48 L 88 68" fill={u('pink')} {...s} />
    <ellipse cx={166} cy={114} rx={15} ry={19} fill={u('pink')} {...s} />
    <ellipse cx={162} cy={108} rx={3} ry={4} fill={K} />
    <ellipse cx={170} cy={118} rx={3} ry={4} fill={K} />
    <circle cx={130} cy={98} r={6} fill={K} />
    <circle cx={132} cy={96} r={2} fill="#FFFFFF" />
    <path d="M 34 106 C 18 100 20 84 30 86" stroke={K} strokeWidth={4} fill="none" strokeLinecap="round" />
    <rect x={84} y={64} width={36} height={9} rx={4.5} fill={K} />
    <circle cx={102} cy={40} r={20} fill={u('gold')} {...s} strokeWidth={3} />
    <text x={102} y={48} textAnchor="middle" fontSize={22} fontWeight={900} fill="#B07C00" fontFamily="Arial, sans-serif">
      €
    </text>
    <path d="M 60 96 Q 64 80 80 74" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.7} />
  </g>
);

const Gift = ({ u }: IconProps) => (
  <g>
    <rect x={34} y={84} width={132} height={90} rx={6} fill={u('red')} {...s} />
    <rect x={26} y={62} width={148} height={28} rx={6} fill={u('red')} {...s} />
    <rect x={88} y={62} width={24} height={112} fill={u('accent')} {...s} strokeWidth={3} />
    <path d="M 100 62 C 76 30 48 42 64 60 C 72 66 88 64 100 62 Z" fill={u('accent')} {...s} strokeWidth={3} />
    <path d="M 100 62 C 124 30 152 42 136 60 C 128 66 112 64 100 62 Z" fill={u('accent')} {...s} strokeWidth={3} />
    <Shine x={40} y={68} w={36} h={5} o={0.5} />
  </g>
);

const Wallet = ({ u }: IconProps) => (
  <g>
    <rect x={42} y={38} width={108} height={46} rx={6} fill={u('green')} {...s} transform="rotate(-6 96 61)" />
    <rect x={22} y={58} width={156} height={112} rx={18} fill={u('brown')} {...s} />
    <path d="M 22 84 L 178 84" stroke="#6E431D" strokeWidth={3} />
    <path d="M 118 98 L 178 98 L 178 138 L 118 138 C 106 138 100 130 100 118 C 100 106 106 98 118 98 Z" fill="#B57A40" {...s} strokeWidth={3} />
    <circle cx={126} cy={118} r={8} fill={u('accent')} stroke={K} strokeWidth={2.5} />
    <path d="M 34 150 L 96 150" stroke="#E2B07A" strokeWidth={3} strokeDasharray="6 6" />
  </g>
);

const Briefcase = ({ u }: IconProps) => (
  <g>
    <path d="M 72 64 L 72 46 C 72 41 76 38 80 38 L 120 38 C 124 38 128 41 128 46 L 128 64" fill="none" stroke={K} strokeWidth={10} />
    <rect x={20} y={62} width={160} height={110} rx={14} fill={u('brown')} {...s} />
    <path d="M 20 106 L 180 106" stroke="#6E431D" strokeWidth={4} />
    <rect x={86} y={94} width={28} height={24} rx={5} fill={u('accent')} {...s} strokeWidth={3} />
    <Shine x={30} y={70} w={44} h={5} o={0.35} />
  </g>
);

const Receipt = ({ u }: IconProps) => (
  <g>
    <path d="M 50 22 L 150 22 L 150 178 L 133 166 L 117 178 L 100 166 L 83 178 L 67 166 L 50 178 Z" fill={u('paper')} {...s} />
    <rect x={68} y={38} width={64} height={10} rx={5} fill="#3A3A44" />
    {[64, 82, 100].map((y) => (
      <g key={y}>
        <rect x={68} y={y} width={40} height={7} rx={3.5} fill="#C9C9D3" />
        <rect x={116} y={y} width={16} height={7} rx={3.5} fill="#C9C9D3" />
      </g>
    ))}
    <path d="M 66 120 L 134 120" stroke="#C9C9D3" strokeWidth={2} strokeDasharray="4 4" />
    <rect x={68} y={132} width={30} height={9} rx={4.5} fill={K} />
    <rect x={108} y={130} width={26} height={12} rx={6} fill="#E0352B" />
  </g>
);

const Diploma = ({ u }: IconProps) => (
  <g>
    <rect x={24} y={52} width={152} height={100} rx={8} fill={u('paper')} {...s} />
    <rect x={34} y={62} width={132} height={80} rx={4} fill="none" stroke="#D9D9E2" strokeWidth={3} />
    <rect x={52} y={78} width={96} height={8} rx={4} fill="#3A3A44" />
    <rect x={52} y={96} width={70} height={6} rx={3} fill="#C9C9D3" />
    <path d="M 132 146 L 126 178 L 142 168 L 158 178 L 152 146" fill={u('red')} {...s} strokeWidth={3} />
    <circle cx={142} cy={136} r={18} fill={u('accent')} {...s} strokeWidth={3} />
  </g>
);

const ShoppingBag = ({ u }: IconProps) => (
  <g>
    <path d="M 72 78 L 72 54 C 72 24 128 24 128 54 L 128 78" fill="none" stroke={K} strokeWidth={9} strokeLinecap="round" />
    <path d="M 40 64 L 160 64 L 172 168 C 173 174 169 178 163 178 L 37 178 C 31 178 27 174 28 168 Z" fill={u('accent')} {...s} />
    <circle cx={72} cy={80} r={5} fill={K} />
    <circle cx={128} cy={80} r={5} fill={K} />
    <path d="M 50 100 L 50 160" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" opacity={0.5} />
  </g>
);

const PercentBadge = ({ u }: IconProps) => (
  <g>
    <path d="M 100 14 L 120 32 L 146 28 L 152 54 L 176 68 L 166 94 L 178 120 L 154 132 L 148 158 L 122 154 L 100 174 L 78 154 L 52 158 L 46 132 L 22 120 L 34 94 L 22 68 L 46 54 L 52 28 L 78 32 Z" fill={u('red')} {...s} />
    <path d="M 72 128 L 128 64" stroke="#FFFFFF" strokeWidth={11} strokeLinecap="round" />
    <circle cx={76} cy={72} r={13} fill="none" stroke="#FFFFFF" strokeWidth={8} />
    <circle cx={124} cy={120} r={13} fill="none" stroke="#FFFFFF" strokeWidth={8} />
  </g>
);

const Lock = ({ u }: IconProps) => (
  <g>
    <path d="M 64 92 L 64 66 C 64 22 136 22 136 66 L 136 92" fill="none" stroke={u('gray')} strokeWidth={16} strokeLinecap="round" />
    <rect x={38} y={88} width={124} height={92} rx={16} fill={u('gold')} {...s} />
    <circle cx={100} cy={124} r={12} fill={K} />
    <rect x={95} y={128} width={10} height={26} rx={4} fill={K} />
    <Shine x={48} y={96} w={10} h={60} r={5} o={0.55} />
  </g>
);

const Coffee = ({ u }: IconProps) => (
  <g>
    <path d="M 82 40 C 74 30 90 22 82 10 M 112 40 C 104 30 120 22 112 10" stroke="#C9C9D3" strokeWidth={5} fill="none" strokeLinecap="round" />
    <path d="M 46 70 L 154 70 L 142 178 C 141 182 138 184 134 184 L 66 184 C 62 184 59 182 58 178 Z" fill={u('paper')} {...s} />
    <rect x={38} y={54} width={124} height={20} rx={7} fill={u('dark')} {...s} />
    <path d="M 52 108 L 148 108 L 143 148 L 57 148 Z" fill={u('brown')} {...s} strokeWidth={3} />
    <circle cx={100} cy={128} r={11} fill={u('accent')} stroke={K} strokeWidth={2.5} />
  </g>
);

const QuestionMark = ({ accent }: IconProps) => (
  <g>
    <path d="M 64 70 C 64 26 140 22 140 70 C 140 100 104 104 104 132" fill="none" stroke={K} strokeWidth={34} strokeLinecap="round" />
    <path d="M 64 70 C 64 26 140 22 140 70 C 140 100 104 104 104 132" fill="none" stroke={accent} strokeWidth={22} strokeLinecap="round" />
    <circle cx={104} cy={172} r={17} fill={accent} stroke={K} strokeWidth={SW} />
  </g>
);

const Exclamation = () => (
  <g>
    <path d="M 100 30 L 100 120" stroke={K} strokeWidth={36} strokeLinecap="round" />
    <path d="M 100 30 L 100 120" stroke="#FF453A" strokeWidth={24} strokeLinecap="round" />
    <circle cx={100} cy={166} r={17} fill="#FF453A" stroke={K} strokeWidth={SW} />
  </g>
);

const Trophy = ({ u }: IconProps) => (
  <g>
    <path d="M 58 44 C 20 44 24 98 64 98 M 142 44 C 180 44 176 98 136 98" fill="none" stroke={K} strokeWidth={11} strokeLinecap="round" />
    <path d="M 58 44 C 20 44 24 98 64 98 M 142 44 C 180 44 176 98 136 98" fill="none" stroke="#F2B200" strokeWidth={5} strokeLinecap="round" />
    <path d="M 54 28 L 146 28 L 142 88 C 138 122 62 122 58 88 Z" fill={u('gold')} {...s} />
    <rect x={88} y={116} width={24} height={30} fill={u('goldDark')} {...s} strokeWidth={3} />
    <rect x={58} y={146} width={84} height={30} rx={6} fill={u('dark')} {...s} />
    <rect x={78} y={156} width={44} height={8} rx={4} fill={u('gold')} />
    <path d="M 72 40 L 72 86" stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" opacity={0.7} />
  </g>
);

const GraduationCap = ({ accent, u }: IconProps) => (
  <g>
    <path d="M 52 100 L 52 142 C 52 164 148 164 148 142 L 148 100" fill={u('dark')} {...s} />
    <path d="M 100 44 L 188 84 L 100 124 L 12 84 Z" fill={u('dark')} {...s} />
    <path d="M 100 84 L 166 98 L 166 144" stroke={accent} strokeWidth={5} fill="none" strokeLinecap="round" />
    <circle cx={166} cy={150} r={10} fill={accent} stroke={K} strokeWidth={2.5} />
    <circle cx={100} cy={84} r={6} fill={accent} />
  </g>
);

export const ICONS: Record<PropAsset, React.FC<IconProps>> = {
  banknote: Banknote,
  'money-stack': MoneyStack,
  coin: Coin,
  'coin-stack': CoinStack,
  'money-bag': MoneyBag,
  bank: Bank,
  house: House,
  mansion: Mansion,
  car: Car,
  'sports-car': SportsCar,
  phone: Phone,
  'credit-card': CreditCard,
  laptop: Laptop,
  'chart-up': ChartUp,
  'chart-down': ChartDown,
  clock: Clock,
  building: Building,
  shop: Shop,
  'piggy-bank': PiggyBank,
  calendar: Calendar,
  gift: Gift,
  wallet: Wallet,
  briefcase: Briefcase,
  receipt: Receipt,
  plane: Plane,
  diploma: Diploma,
  'shopping-bag': ShoppingBag,
  'percent-badge': PercentBadge,
  lock: Lock,
  hourglass: Hourglass,
  coffee: Coffee,
  yacht: Yacht,
  'question-mark': QuestionMark,
  exclamation: Exclamation,
  trophy: Trophy,
  'graduation-cap': GraduationCap,
};

/** Prefix every SVG id (and its references) so several illustrations can share one page. */
function scopeIds(body: string, prefix: string): string {
  return body.replace(/\bid="([^"]+)"/g, `id="${prefix}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${prefix}$1)`).replace(/href="#([^"]+)"/g, `href="#${prefix}$1"`);
}

/**
 * Inner SVG content of an illustration, in a 200×200 box — for embedding in another <svg>.
 * Uses the Fluent Emoji artwork (MIT, Microsoft) when available, otherwise the hand-drawn icon.
 */
export const IconContent: React.FC<{ asset: PropAsset; accent: string }> = ({ asset, accent }) => {
  const id = `i${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const fluent = FLUENT[asset];
  if (fluent) {
    return <svg x={8} y={8} width={184} height={184} viewBox={`0 0 ${fluent.width} ${fluent.height}`} overflow="visible" dangerouslySetInnerHTML={{ __html: scopeIds(fluent.body, `${id}-`) }} />;
  }
  const C = ICONS[asset];
  const u: U = (name) => `url(#${id}-${name})`;
  return (
    <>
      <Palette id={id} accent={accent} />
      <C accent={accent} u={u} />
    </>
  );
};

export const PropIcon: React.FC<{ asset: PropAsset; size: number; accent: string }> = ({ asset, size, accent }) => (
  <svg viewBox="0 0 200 200" width={size} height={size} style={{ overflow: 'visible' }}>
    <IconContent asset={asset} accent={accent} />
  </svg>
);
