import React from 'react';
import type { PropAsset } from '../../shared/constants';

/**
 * Vector illustration library. Every object shares one visual language:
 * white shapes, thick near-black outlines, one accent colour, flat 2D.
 * viewBox 0 0 200 200.
 */
const W = '#F7F7F9';
const K = '#0B0B0D';
const G = '#2FBF58';
const GD = '#1E8F40';
const R = '#FF453A';
const D = '#2C2C30';
const GR = '#C7C7CC';
const SW = 6;

type IconProps = { accent: string };
const s = { stroke: K, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const Banknote = () => (
  <g {...s}>
    <rect x={20} y={62} width={160} height={80} rx={10} fill={G} />
    <rect x={34} y={74} width={132} height={56} rx={6} fill="none" stroke={GD} strokeWidth={4} />
    <circle cx={100} cy={102} r={17} fill={GD} stroke="none" />
    <circle cx={46} cy={102} r={5} fill={GD} stroke="none" />
    <circle cx={154} cy={102} r={5} fill={GD} stroke="none" />
  </g>
);

const MoneyStack = () => (
  <g {...s}>
    {[0, 1, 2, 3].map((i) => (
      <g key={i} transform={`translate(0 ${-i * 18})`}>
        <rect x={26} y={120} width={148} height={40} rx={7} fill={G} />
        <rect x={84} y={120} width={32} height={40} fill={W} strokeWidth={4} />
      </g>
    ))}
  </g>
);

const Coin = ({ accent }: IconProps) => (
  <g {...s}>
    <circle cx={100} cy={100} r={62} fill={accent} />
    <circle cx={100} cy={100} r={44} fill="none" stroke="#B8900A" strokeWidth={5} />
    <path d="M 100 72 L 100 128 M 84 84 Q 100 72 114 84 Q 120 96 100 100 Q 80 104 86 116 Q 100 128 116 116" fill="none" stroke="#8A6A00" strokeWidth={7} />
  </g>
);

const CoinStack = ({ accent }: IconProps) => (
  <g {...s}>
    {[0, 1, 2, 3, 4].map((i) => (
      <ellipse key={i} cx={100} cy={160 - i * 22} rx={58} ry={18} fill={accent} />
    ))}
    <ellipse cx={100} cy={72} rx={58} ry={18} fill={accent} />
    <ellipse cx={100} cy={72} rx={34} ry={9} fill="none" stroke="#B8900A" strokeWidth={4} />
  </g>
);

const MoneyBag = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 70 62 L 130 62 L 116 42 L 84 42 Z" fill={W} />
    <path d="M 74 66 C 24 96 22 176 100 176 C 178 176 176 96 126 66 Z" fill={W} />
    <path d="M 70 64 L 130 64" stroke={K} strokeWidth={10} />
    <circle cx={100} cy={124} r={26} fill={accent} />
    <path d="M 100 108 L 100 140 M 92 116 Q 100 110 108 116 Q 110 122 100 124 Q 90 126 92 132 Q 100 138 108 132" fill="none" stroke="#8A6A00" strokeWidth={5} />
  </g>
);

const Bank = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 22 76 L 100 30 L 178 76 Z" fill={W} />
    <circle cx={100} cy={60} r={9} fill={accent} />
    <rect x={26} y={76} width={148} height={14} fill={W} />
    {[40, 74, 108, 142].map((x) => (
      <rect key={x} x={x} y={92} width={18} height={60} fill={W} />
    ))}
    <rect x={18} y={152} width={164} height={18} rx={3} fill={W} />
  </g>
);

const House = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 30 96 L 100 36 L 170 96" fill="none" strokeWidth={10} />
    <rect x={44} y={92} width={112} height={78} fill={W} />
    <rect x={88} y={122} width={26} height={48} fill={accent} />
    <rect x={56} y={106} width={22} height={22} fill="#9AD7FF" />
    <rect x={122} y={106} width={22} height={22} fill="#9AD7FF" />
    <rect x={130} y={46} width={16} height={34} fill={W} />
  </g>
);

const Mansion = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 14 98 L 60 64 L 60 98 Z" fill={W} />
    <path d="M 140 98 L 140 64 L 186 98 Z" fill={W} />
    <path d="M 52 72 L 100 30 L 148 72 Z" fill={W} />
    <rect x={20} y={98} width={160} height={72} fill={W} />
    <rect x={56} y={72} width={88} height={26} fill={W} />
    <rect x={88} y={124} width={24} height={46} fill={accent} />
    {[30, 56, 128, 154].map((x) => (
      <rect key={x} x={x} y={110} width={16} height={20} fill="#9AD7FF" strokeWidth={4} />
    ))}
    <circle cx={100} cy={56} r={8} fill="#9AD7FF" strokeWidth={4} />
  </g>
);

const Car = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 22 130 L 30 100 L 62 96 L 82 70 L 134 70 L 156 98 L 178 104 L 180 130 Z" fill={W} />
    <path d="M 88 78 L 128 78 L 142 98 L 74 98 Z" fill="#9AD7FF" strokeWidth={4} />
    <circle cx={60} cy={134} r={18} fill={D} />
    <circle cx={146} cy={134} r={18} fill={D} />
    <circle cx={60} cy={134} r={6} fill={GR} stroke="none" />
    <circle cx={146} cy={134} r={6} fill={GR} stroke="none" />
    <rect x={164} y={106} width={12} height={8} rx={2} fill={accent} strokeWidth={3} />
  </g>
);

const SportsCar = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 12 132 L 18 112 L 64 100 L 96 80 L 140 82 L 168 102 L 190 110 L 190 132 Z" fill={R} />
    <path d="M 100 88 L 136 89 L 152 102 L 84 102 Z" fill="#202024" strokeWidth={4} />
    <path d="M 20 118 L 186 118" stroke={K} strokeWidth={3} />
    <circle cx={54} cy={136} r={17} fill={D} />
    <circle cx={152} cy={136} r={17} fill={D} />
    <circle cx={54} cy={136} r={6} fill={accent} stroke="none" />
    <circle cx={152} cy={136} r={6} fill={accent} stroke="none" />
  </g>
);

const Phone = ({ accent }: IconProps) => (
  <g {...s}>
    <rect x={58} y={22} width={84} height={156} rx={16} fill={D} />
    <rect x={67} y={36} width={66} height={124} rx={8} fill="#1C1C1F" strokeWidth={3} />
    <rect x={76} y={50} width={48} height={16} rx={5} fill={accent} stroke="none" />
    <rect x={76} y={76} width={34} height={8} rx={4} fill="#5A5A60" stroke="none" />
    <rect x={76} y={92} width={42} height={8} rx={4} fill="#5A5A60" stroke="none" />
    <path d="M 78 140 L 92 126 L 104 134 L 122 112" stroke={G} strokeWidth={5} fill="none" />
  </g>
);

const CreditCard = ({ accent }: IconProps) => (
  <g {...s}>
    <rect x={18} y={50} width={164} height={104} rx={14} fill="#3A3AF0" />
    <rect x={18} y={70} width={164} height={20} fill={K} stroke="none" />
    <rect x={36} y={104} width={34} height={24} rx={5} fill={accent} strokeWidth={4} />
    <rect x={92} y={132} width={70} height={8} rx={4} fill={W} stroke="none" />
  </g>
);

const Laptop = ({ accent }: IconProps) => (
  <g {...s}>
    <rect x={40} y={46} width={120} height={84} rx={8} fill={D} />
    <rect x={50} y={56} width={100} height={64} rx={4} fill="#1C1C1F" strokeWidth={3} />
    <path d="M 60 108 L 82 88 L 100 98 L 136 66" stroke={accent} strokeWidth={6} fill="none" />
    <path d="M 22 136 L 178 136 L 166 154 L 34 154 Z" fill={W} />
  </g>
);

const ChartUp = () => (
  <g {...s}>
    <rect x={24} y={24} width={152} height={152} rx={16} fill={W} />
    <path d="M 46 140 L 82 108 L 108 122 L 152 66" stroke={G} strokeWidth={11} fill="none" />
    <path d="M 128 64 L 154 62 L 152 90" stroke={G} strokeWidth={11} fill="none" />
  </g>
);

const ChartDown = () => (
  <g {...s}>
    <rect x={24} y={24} width={152} height={152} rx={16} fill={W} />
    <path d="M 46 62 L 82 96 L 108 82 L 152 138" stroke={R} strokeWidth={11} fill="none" />
    <path d="M 126 140 L 154 140 L 152 112" stroke={R} strokeWidth={11} fill="none" />
  </g>
);

const Clock = ({ accent }: IconProps) => (
  <g {...s}>
    <circle cx={100} cy={104} r={68} fill={W} />
    <path d="M 100 104 L 100 62 M 100 104 L 130 118" strokeWidth={9} />
    <circle cx={100} cy={104} r={7} fill={accent} />
    <path d="M 58 34 L 40 52 M 142 34 L 160 52" strokeWidth={10} />
  </g>
);

const Building = ({ accent }: IconProps) => (
  <g {...s}>
    <rect x={52} y={26} width={96} height={150} fill={W} />
    {[0, 1, 2, 3, 4].map((r) =>
      [0, 1, 2].map((c) => <rect key={`${r}-${c}`} x={64 + c * 26} y={40 + r * 24} width={16} height={14} fill={r === 1 && c === 1 ? accent : '#9AD7FF'} strokeWidth={3} />),
    )}
    <rect x={88} y={150} width={24} height={26} fill={D} strokeWidth={4} />
  </g>
);

const Shop = ({ accent }: IconProps) => (
  <g {...s}>
    <rect x={34} y={84} width={132} height={88} fill={W} />
    <path d="M 26 84 L 40 46 L 160 46 L 174 84 Z" fill={R} />
    <path d="M 56 46 L 50 84 M 84 46 L 82 84 M 116 46 L 118 84 M 144 46 L 150 84" strokeWidth={4} />
    <rect x={50} y={104} width={48} height={36} fill="#9AD7FF" strokeWidth={4} />
    <rect x={112} y={104} width={36} height={68} fill={accent} strokeWidth={4} />
  </g>
);

const PiggyBank = ({ accent }: IconProps) => (
  <g {...s}>
    <ellipse cx={100} cy={112} rx={66} ry={50} fill="#FFB3C7" />
    <path d="M 62 74 L 56 50 L 82 66" fill="#FFB3C7" />
    <ellipse cx={164} cy={110} rx={14} ry={18} fill="#FFB3C7" />
    <circle cx={161} cy={106} r={3} fill={K} stroke="none" />
    <circle cx={168} cy={114} r={3} fill={K} stroke="none" />
    <circle cx={128} cy={96} r={6} fill={K} stroke="none" />
    <rect x={64} y={150} width={18} height={26} rx={5} fill="#FFB3C7" />
    <rect x={118} y={150} width={18} height={26} rx={5} fill="#FFB3C7" />
    <rect x={84} y={62} width={34} height={8} rx={4} fill={K} stroke="none" />
    <circle cx={101} cy={36} r={18} fill={accent} />
  </g>
);

const Calendar = ({ accent }: IconProps) => (
  <g {...s}>
    <rect x={30} y={40} width={140} height={132} rx={14} fill={W} />
    <path d="M 30 78 L 170 78" />
    <rect x={30} y={40} width={140} height={38} rx={14} fill={R} />
    <path d="M 64 28 L 64 52 M 136 28 L 136 52" strokeWidth={9} />
    {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}-${c}`} x={46 + c * 30} y={92 + r * 24} width={18} height={14} rx={3} fill={r === 1 && c === 2 ? accent : GR} stroke="none" />))}
  </g>
);

const Gift = ({ accent }: IconProps) => (
  <g {...s}>
    <rect x={36} y={84} width={128} height={88} fill={R} />
    <rect x={28} y={64} width={144} height={26} fill={R} />
    <rect x={88} y={64} width={24} height={108} fill={accent} />
    <path d="M 100 64 C 70 30 50 50 70 64 M 100 64 C 130 30 150 50 130 64" fill="none" strokeWidth={8} stroke={accent} />
  </g>
);

const Wallet = ({ accent }: IconProps) => (
  <g {...s}>
    <rect x={24} y={58} width={152} height={108} rx={16} fill="#8B5A2B" />
    <rect x={40} y={44} width={110} height={30} rx={6} fill={G} />
    <path d="M 120 94 L 176 94 L 176 132 L 120 132 Q 104 113 120 94 Z" fill="#A86E37" />
    <circle cx={132} cy={113} r={7} fill={accent} />
  </g>
);

const Briefcase = ({ accent }: IconProps) => (
  <g {...s}>
    <rect x={24} y={62} width={152} height={106} rx={12} fill="#6E4A2A" />
    <path d="M 74 62 L 74 44 L 126 44 L 126 62" fill="none" strokeWidth={9} />
    <path d="M 24 104 L 176 104" />
    <rect x={88} y={94} width={24} height={22} rx={4} fill={accent} />
  </g>
);

const Receipt = () => (
  <g {...s}>
    <path d="M 52 24 L 148 24 L 148 176 L 132 164 L 116 176 L 100 164 L 84 176 L 68 164 L 52 176 Z" fill={W} />
    {[52, 74, 96].map((y) => (
      <path key={y} d={`M 70 ${y} L 130 ${y}`} stroke={GR} strokeWidth={7} />
    ))}
    <path d="M 70 128 L 104 128" stroke={K} strokeWidth={7} />
    <path d="M 116 128 L 130 128" stroke={R} strokeWidth={9} />
  </g>
);

const Plane = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 16 112 L 150 84 C 176 78 190 92 176 104 L 46 140 Z" fill={W} />
    <path d="M 84 100 L 118 46 L 136 46 L 120 94 Z" fill={W} />
    <path d="M 82 128 L 100 162 L 116 160 L 108 122 Z" fill={W} />
    <path d="M 24 112 L 14 84 L 32 84 L 46 106 Z" fill={accent} />
    <circle cx={152} cy={96} r={5} fill="#9AD7FF" />
  </g>
);

const Diploma = ({ accent }: IconProps) => (
  <g {...s}>
    <rect x={26} y={56} width={148} height={96} rx={8} fill={W} />
    <path d="M 48 84 L 152 84 M 48 104 L 120 104" stroke={GR} strokeWidth={7} />
    <circle cx={142} cy={132} r={18} fill={accent} />
    <path d="M 132 146 L 128 172 L 142 164 L 156 172 L 152 146" fill={R} />
  </g>
);

const ShoppingBag = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 44 66 L 156 66 L 168 174 L 32 174 Z" fill={accent} />
    <path d="M 74 80 L 74 54 C 74 22 126 22 126 54 L 126 80" fill="none" strokeWidth={8} />
  </g>
);

const PercentBadge = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 100 16 L 120 34 L 146 30 L 152 56 L 176 70 L 166 94 L 178 118 L 154 130 L 148 156 L 122 152 L 100 172 L 80 152 L 54 156 L 48 130 L 24 118 L 34 94 L 24 70 L 48 56 L 54 30 L 80 34 Z" fill={accent} />
    <path d="M 74 126 L 126 66" strokeWidth={9} />
    <circle cx={78} cy={74} r={11} fill={W} />
    <circle cx={122} cy={118} r={11} fill={W} />
  </g>
);

const Lock = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 64 90 L 64 66 C 64 20 136 20 136 66 L 136 90" fill="none" strokeWidth={12} />
    <rect x={40} y={88} width={120} height={88} rx={14} fill={accent} />
    <circle cx={100} cy={124} r={11} fill={K} stroke="none" />
    <rect x={95} y={128} width={10} height={24} fill={K} stroke="none" />
  </g>
);

const Hourglass = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 52 24 L 148 24 M 52 176 L 148 176" strokeWidth={10} />
    <path d="M 62 26 C 62 70 96 84 96 100 C 96 116 62 130 62 174 L 138 174 C 138 130 104 116 104 100 C 104 84 138 70 138 26 Z" fill={W} />
    <path d="M 74 52 L 126 52 C 120 72 104 82 100 92 C 96 82 80 72 74 52 Z" fill={accent} stroke="none" />
    <path d="M 70 168 C 76 146 96 138 100 132 C 104 138 124 146 130 168 Z" fill={accent} stroke="none" />
  </g>
);

const Coffee = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 46 70 L 154 70 L 142 176 L 58 176 Z" fill={W} />
    <rect x={40} y={56} width={120} height={18} rx={6} fill={D} />
    <path d="M 52 110 L 148 110 L 144 142 L 56 142 Z" fill="#8B5A2B" strokeWidth={4} />
    <path d="M 84 40 C 76 30 92 22 84 10 M 112 40 C 104 30 120 22 112 10" stroke={GR} strokeWidth={5} fill="none" />
    <circle cx={100} cy={126} r={8} fill={accent} stroke="none" />
  </g>
);

const Yacht = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 16 128 L 184 128 L 158 162 L 36 162 Z" fill={W} />
    <path d="M 52 128 L 64 100 L 140 100 L 156 128 Z" fill={W} />
    <path d="M 72 100 L 82 80 L 124 80 L 132 100 Z" fill={W} />
    {[78, 98, 118].map((x) => (
      <rect key={x} x={x} y={106} width={12} height={10} rx={2} fill="#9AD7FF" strokeWidth={3} />
    ))}
    <path d="M 100 80 L 100 50" />
    <path d="M 102 50 L 126 58 L 102 66 Z" fill={accent} />
  </g>
);

const QuestionMark = ({ accent }: IconProps) => (
  <g>
    <path d="M 64 70 C 64 26 140 22 140 70 C 140 100 104 104 104 132" fill="none" stroke={K} strokeWidth={36} strokeLinecap="round" />
    <path d="M 64 70 C 64 26 140 22 140 70 C 140 100 104 104 104 132" fill="none" stroke={accent} strokeWidth={22} strokeLinecap="round" />
    <circle cx={104} cy={172} r={16} fill={accent} stroke={K} strokeWidth={SW} />
  </g>
);

const Exclamation = () => (
  <g>
    <path d="M 100 30 L 100 120" stroke={K} strokeWidth={38} strokeLinecap="round" />
    <path d="M 100 30 L 100 120" stroke={R} strokeWidth={24} strokeLinecap="round" />
    <circle cx={100} cy={166} r={17} fill={R} stroke={K} strokeWidth={SW} />
  </g>
);

const Trophy = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 56 30 L 144 30 L 140 86 C 136 118 64 118 60 86 Z" fill={accent} />
    <path d="M 58 44 C 22 44 26 92 62 92 M 142 44 C 178 44 174 92 138 92" fill="none" strokeWidth={8} />
    <rect x={88} y={114} width={24} height={34} fill={accent} />
    <rect x={60} y={146} width={80} height={24} rx={4} fill={D} />
  </g>
);

const GraduationCap = ({ accent }: IconProps) => (
  <g {...s}>
    <path d="M 100 44 L 186 82 L 100 120 L 14 82 Z" fill={D} />
    <path d="M 52 98 L 52 140 C 52 160 148 160 148 140 L 148 98" fill={D} />
    <path d="M 168 90 L 168 140" stroke={accent} strokeWidth={6} />
    <circle cx={168} cy={146} r={9} fill={accent} />
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

export const PropIcon: React.FC<{ asset: PropAsset; size: number; accent: string }> = ({ asset, size, accent }) => {
  const C = ICONS[asset];
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ overflow: 'visible' }}>
      <C accent={accent} />
    </svg>
  );
};
