import React, { useId } from 'react';
import type { Expression, Pose } from '../shared/constants';

/**
 * "Nummo" — the original Finance Video Studio mascot (v2, "clean" design).
 * A soft white egg-shaped character with glossy black eyes and a small green
 * sprout ("money that grows"). Short rounded limbs, mitten hands and rounded
 * shoes; soft radial shading and a highlight give volume without clutter.
 * Drawn entirely in SVG from joint angles, so every pose keeps identical proportions.
 *
 * Coordinate system: viewBox 0 0 400 620, shoe soles on y≈600.
 */

export const MASCOT_VIEWBOX = { width: 400, height: 620 };
export const MASCOT_FEET_Y = 600;

const LIMB = '#F1F1F5';
const LIMB_SHADE = '#D9D9E2';
const INK = '#111114';
const GAP = 5;

interface Limb {
  a1: number;
  a2: number;
}
interface PoseDef {
  armL: Limb;
  armR: Limb;
  legL: Limb;
  legR: Limb;
  tilt: number;
  bodyY: number;
  held?: 'phone' | 'banknote';
  lookX: number;
  lookY: number;
  sitting?: boolean;
  armsFront?: boolean;
}

/** Angles in degrees from straight down; positive rotates away from the body. */
const POSES: Record<Pose, PoseDef> = {
  idle: { armL: { a1: 14, a2: 8 }, armR: { a1: 14, a2: 8 }, legL: { a1: 3, a2: 0 }, legR: { a1: 3, a2: 0 }, tilt: 0, bodyY: 0, lookX: 0, lookY: 0 },
  walking: { armL: { a1: 18, a2: 12 }, armR: { a1: 18, a2: 12 }, legL: { a1: 0, a2: 0 }, legR: { a1: 0, a2: 0 }, tilt: 2, bodyY: 0, lookX: 6, lookY: 0 },
  running: { armL: { a1: 35, a2: 70 }, armR: { a1: 35, a2: 70 }, legL: { a1: 0, a2: 0 }, legR: { a1: 0, a2: 0 }, tilt: 8, bodyY: 0, lookX: 8, lookY: 0 },
  sitting: { armL: { a1: 22, a2: 35 }, armR: { a1: 22, a2: 35 }, legL: { a1: -75, a2: 75 }, legR: { a1: -75, a2: 75 }, tilt: 0, bodyY: 58, lookX: 0, lookY: 0, sitting: true },
  thinking: { armL: { a1: 12, a2: 6 }, armR: { a1: 26, a2: 172 }, legL: { a1: 3, a2: 0 }, legR: { a1: 3, a2: 0 }, tilt: -3, bodyY: 0, lookX: 10, lookY: -12, armsFront: true },
  surprised: { armL: { a1: 62, a2: 38 }, armR: { a1: 62, a2: 38 }, legL: { a1: 7, a2: 0 }, legR: { a1: 7, a2: 0 }, tilt: 0, bodyY: -6, lookX: 0, lookY: -3 },
  happy: { armL: { a1: 38, a2: 24 }, armR: { a1: 38, a2: 24 }, legL: { a1: 5, a2: 0 }, legR: { a1: 5, a2: 0 }, tilt: 0, bodyY: 0, lookX: 0, lookY: 0 },
  sad: { armL: { a1: 5, a2: 0 }, armR: { a1: 5, a2: 0 }, legL: { a1: 2, a2: 0 }, legR: { a1: 2, a2: 0 }, tilt: 4, bodyY: 8, lookX: 0, lookY: 10 },
  shocked: { armL: { a1: 148, a2: 18 }, armR: { a1: 148, a2: 18 }, legL: { a1: 10, a2: 0 }, legR: { a1: 10, a2: 0 }, tilt: 0, bodyY: -10, lookX: 0, lookY: -3 },
  pointing: { armL: { a1: 14, a2: 8 }, armR: { a1: 90, a2: -4 }, legL: { a1: 4, a2: 0 }, legR: { a1: 4, a2: 0 }, tilt: 2, bodyY: 0, lookX: 12, lookY: 0 },
  'holding-money': { armL: { a1: 14, a2: 8 }, armR: { a1: 55, a2: 50 }, legL: { a1: 3, a2: 0 }, legR: { a1: 3, a2: 0 }, tilt: 0, bodyY: 0, lookX: 10, lookY: 2, held: 'banknote' },
  'holding-phone': { armL: { a1: 16, a2: 104 }, armR: { a1: 16, a2: 104 }, legL: { a1: 3, a2: 0 }, legR: { a1: 3, a2: 0 }, tilt: 0, bodyY: 0, lookX: 0, lookY: 14, held: 'phone', armsFront: true },
  explaining: { armL: { a1: 32, a2: 72 }, armR: { a1: 32, a2: 72 }, legL: { a1: 4, a2: 0 }, legR: { a1: 4, a2: 0 }, tilt: 0, bodyY: 0, lookX: 0, lookY: 0 },
  celebrating: { armL: { a1: 158, a2: -8 }, armR: { a1: 158, a2: -8 }, legL: { a1: 12, a2: 0 }, legR: { a1: 12, a2: 0 }, tilt: 0, bodyY: -8, lookX: 0, lookY: -5 },
};

const SHOULDER = { L: { x: 94, y: 350 }, R: { x: 306, y: 350 } };
const HIP = { L: { x: 166, y: 452 }, R: { x: 234, y: 452 } };
const ARM = [60, 54];
const LEG = [62, 56];
const ARM_W = 30;
const LEG_W = 36;

type Pt = { x: number; y: number };

function limbPoints(origin: Pt, side: 'L' | 'R', limb: Limb, lengths: number[]): Pt[] {
  const sgn = side === 'L' ? -1 : 1;
  const r1 = (limb.a1 * Math.PI) / 180;
  const r2 = ((limb.a1 + limb.a2) * Math.PI) / 180;
  const elbow = { x: origin.x + sgn * Math.sin(r1) * lengths[0]!, y: origin.y + Math.cos(r1) * lengths[0]! };
  const end = { x: elbow.x + sgn * Math.sin(r2) * lengths[1]!, y: elbow.y + Math.cos(r2) * lengths[1]! };
  return [origin, elbow, end];
}

function Limb({ pts, width, gap }: { pts: Pt[]; width: number; gap: boolean }) {
  const d = `M ${pts[0]!.x} ${pts[0]!.y} Q ${pts[1]!.x} ${pts[1]!.y} ${pts[2]!.x} ${pts[2]!.y}`;
  return (
    <>
      {gap && <path d={d} stroke={INK} strokeWidth={width + GAP * 2} fill="none" strokeLinecap="round" />}
      <path d={d} stroke={LIMB} strokeWidth={width} fill="none" strokeLinecap="round" />
      <path d={d} stroke={LIMB_SHADE} strokeWidth={width * 0.28} fill="none" strokeLinecap="round" transform={`translate(${width * 0.22} 0)`} opacity={0.55} />
    </>
  );
}

/** Mitten hand: rounded palm + small thumb, oriented along the forearm. */
function Hand({ at, from, gap }: { at: Pt; from: Pt; gap: boolean }) {
  const ang = (Math.atan2(at.y - from.y, at.x - from.x) * 180) / Math.PI;
  return (
    <g transform={`translate(${at.x} ${at.y}) rotate(${ang})`}>
      {gap && <circle cx={4} cy={0} r={22 + GAP} fill={INK} />}
      <circle cx={4} cy={0} r={22} fill={LIMB} />
      <ellipse cx={-4} cy={-15} rx={9} ry={11} fill={LIMB} />
      <path d="M 14 -10 A 18 18 0 0 1 14 12" stroke={LIMB_SHADE} strokeWidth={4} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Shoe({ at, side, gid }: { at: Pt; side: 'L' | 'R'; gid: string }) {
  const dx = side === 'L' ? -10 : 10;
  return (
    <g transform={`translate(${at.x + dx} ${at.y + 10})`}>
      <path d="M -36 6 C -36 -14 -16 -22 4 -22 C 26 -22 38 -10 38 6 C 38 13 32 16 24 16 L -28 16 C -33 16 -36 12 -36 6 Z" fill={`url(#${gid}-shoe)`} />
      <path d="M -36 9 L 38 9" stroke="#C9C9D3" strokeWidth={3} />
      <ellipse cx={-6} cy={-10} rx={14} ry={5} fill="#FFFFFF" opacity={0.75} />
    </g>
  );
}

function Eye({ cx, cy, expression, blink, lookX, lookY, side }: { cx: number; cy: number; expression: Expression; blink: number; lookX: number; lookY: number; side: 'L' | 'R' }) {
  const big = expression === 'shocked' ? 1.28 : expression === 'surprised' ? 1.15 : expression === 'excited' ? 1.06 : 1;
  const rx = 19 * big;
  const ry = 27 * big * (1 - blink * 0.94);
  const x = cx + lookX;
  const y = cy + lookY;
  if (expression === 'happy' || expression === 'excited') {
    return <path d={`M ${x - 19} ${y + 8} Q ${x} ${y - 22} ${x + 19} ${y + 8}`} stroke={INK} strokeWidth={10} fill="none" strokeLinecap="round" />;
  }
  const lidTop = y - ry - 14;
  const lidFor = (l: number, r: number) => `M ${x - rx - 5} ${y - ry * l} L ${x + rx + 5} ${y - ry * r} L ${x + rx + 5} ${lidTop} L ${x - rx - 5} ${lidTop} Z`;
  const lid =
    expression === 'sad' || expression === 'worried'
      ? side === 'L'
        ? lidFor(0.5, 1.05)
        : lidFor(1.05, 0.5)
      : expression === 'smug'
        ? lidFor(0.1, 0.1)
        : expression === 'determined'
          ? side === 'L'
            ? lidFor(1.0, 0.3)
            : lidFor(0.3, 1.0)
          : null;
  return (
    <g>
      <ellipse cx={x} cy={y} rx={rx} ry={Math.max(2.5, ry)} fill={INK} />
      {ry > 9 && (
        <>
          <ellipse cx={x + rx * 0.32} cy={y - ry * 0.42} rx={6.5 * big} ry={7.5 * big} fill="#FFFFFF" />
          <circle cx={x - rx * 0.34} cy={y + ry * 0.38} r={2.8 * big} fill="#FFFFFF" opacity={0.7} />
        </>
      )}
      {lid && <path d={lid} fill="var(--fvs-body, #F4F4F8)" />}
    </g>
  );
}

function Brows({ expression }: { expression: Expression }) {
  const p = { stroke: INK, strokeWidth: 8, strokeLinecap: 'round' as const, fill: 'none' };
  switch (expression) {
    case 'worried':
    case 'sad':
      return (
        <g {...p}>
          <path d="M 140 214 Q 158 204 178 206" />
          <path d="M 222 206 Q 242 204 260 214" />
        </g>
      );
    case 'determined':
      return (
        <g {...p}>
          <path d="M 140 208 L 180 222" />
          <path d="M 220 222 L 260 208" />
        </g>
      );
    case 'shocked':
    case 'surprised':
      return (
        <g {...p}>
          <path d="M 138 200 Q 160 184 182 194" />
          <path d="M 218 194 Q 240 184 262 200" />
        </g>
      );
    case 'thinking':
      return (
        <g {...p}>
          <path d="M 142 222 L 180 220" />
          <path d="M 220 208 Q 242 196 262 204" />
        </g>
      );
    case 'smug':
      return (
        <g {...p}>
          <path d="M 142 224 L 180 220" />
          <path d="M 220 216 Q 242 206 262 212" />
        </g>
      );
    default:
      return null;
  }
}

function Mouth({ expression, talk }: { expression: Expression; talk: number }) {
  const y = 322;
  const line = { stroke: INK, strokeWidth: 8, fill: 'none', strokeLinecap: 'round' as const };
  switch (expression) {
    case 'happy':
    case 'excited':
      return (
        <g>
          <path d={`M 166 ${y - 6} Q 200 ${y + 36 + talk * 6} 234 ${y - 6} Q 200 ${y + 4} 166 ${y - 6} Z`} fill={INK} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <path d={`M 186 ${y + 14 + talk * 3} Q 200 ${y + 6} 214 ${y + 14 + talk * 3} Q 200 ${y + 26 + talk * 5} 186 ${y + 14 + talk * 3} Z`} fill="#FF6B8A" />
        </g>
      );
    case 'sad':
      return <path d={`M 180 ${y + 14} Q 200 ${y - 2} 220 ${y + 14}`} {...line} />;
    case 'worried':
      return <path d={`M 178 ${y + 8} Q 189 ${y} 200 ${y + 8} Q 211 ${y + 16} 222 ${y + 8}`} {...line} strokeWidth={7} />;
    case 'shocked':
      return <ellipse cx={200} cy={y + 10} rx={16} ry={21 + talk * 3} fill={INK} />;
    case 'surprised':
      return <ellipse cx={200} cy={y + 6} rx={11} ry={13 + talk * 3} fill={INK} />;
    case 'thinking':
      return <path d={`M 186 ${y + 6} Q 200 ${y + 2} 214 ${y + 2}`} {...line} />;
    case 'smug':
      return <path d={`M 180 ${y + 4} Q 206 ${y + 18} 226 ${y - 6}`} {...line} />;
    case 'determined':
      return <path d={`M 182 ${y + 6} Q 200 ${y + 12} 218 ${y + 6}`} {...line} />;
    case 'neutral':
    default:
      return talk > 0.15 ? <ellipse cx={200} cy={y + 6} rx={14} ry={5 + talk * 10} fill={INK} /> : <path d={`M 182 ${y + 2} Q 200 ${y + 16} 218 ${y + 2}`} {...line} />;
  }
}

function Held({ kind, x, y, accent }: { kind: 'phone' | 'banknote'; x: number; y: number; accent: string }) {
  if (kind === 'phone') {
    return (
      <g transform={`translate(${x - 40} ${y - 92})`}>
        <rect x={0} y={0} width={80} height={140} rx={16} fill="#1B1B21" stroke="#3A3A44" strokeWidth={3} />
        <rect x={6} y={8} width={68} height={124} rx={11} fill="#0E0E12" />
        <rect x={30} y={13} width={20} height={5} rx={2.5} fill="#2A2A32" />
        <rect x={14} y={28} width={52} height={22} rx={6} fill={accent} />
        <rect x={14} y={58} width={34} height={7} rx={3.5} fill="#4A4A55" />
        <rect x={14} y={71} width={44} height={7} rx={3.5} fill="#4A4A55" />
        <path d="M 16 118 L 30 104 L 42 110 L 62 90" stroke="#32D74B" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x - 6} ${y - 58}) rotate(-14)`}>
      <rect x={0} y={0} width={128} height={64} rx={9} fill="#34C565" />
      <rect x={0} y={0} width={128} height={64} rx={9} fill="none" stroke="#1F8A45" strokeWidth={3} />
      <rect x={10} y={10} width={108} height={44} rx={6} fill="none" stroke="#5EE08A" strokeWidth={2.5} opacity={0.8} />
      <circle cx={64} cy={32} r={14} fill="#1F8A45" />
      <text x={64} y={39} textAnchor="middle" fontSize={20} fontWeight={900} fill="#9BF0B6" fontFamily="Arial, sans-serif">
        €
      </text>
    </g>
  );
}

export interface MascotProps {
  pose: Pose;
  expression: Expression;
  /** Frame relative to the character's appearance (drives idle, blink and gait). */
  frame: number;
  fps: number;
  walking?: boolean;
  walkSpeed?: number;
  /** 0..1 — mouth openness while narrating. */
  talk?: number;
  accent?: string;
  sprout?: string;
  seed?: number;
}

export const Mascot: React.FC<MascotProps> = ({ pose, expression, frame, fps, walking = false, walkSpeed = 1, talk = 0, accent = '#FFD60A', sprout = '#32D74B', seed = 0 }) => {
  const gid = `m${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const def = POSES[pose];
  const t = frame / fps;
  const isWalk = walking || pose === 'walking' || pose === 'running';
  const run = pose === 'running';
  const cycle = t * (run ? 2.6 : 1.7) * walkSpeed * Math.PI * 2;
  const breathe = Math.sin(t * 2.2 + seed) * (isWalk ? 0 : 1);
  const bob = isWalk ? Math.abs(Math.sin(cycle)) * -9 : 0;
  const hop = pose === 'celebrating' ? -Math.abs(Math.sin(t * 5)) * 20 : pose === 'happy' ? -Math.abs(Math.sin(t * 3.2)) * 5 : 0;
  const shiver = pose === 'shocked' ? Math.sin(frame * 1.9) * 2 : 0;

  const period = Math.round(fps * 3.4);
  const phase = (frame + Math.round(seed * 17)) % period;
  const blink = expression === 'shocked' ? 0 : phase < 2 ? phase / 2 : phase < 4 ? (4 - phase) / 2 : 0;

  const swing = isWalk ? Math.sin(cycle) * (run ? 36 : 24) : 0;
  const armL = { ...def.armL };
  const armR = { ...def.armR };
  const legL = { ...def.legL };
  const legR = { ...def.legR };
  if (isWalk && !def.sitting) {
    legL.a1 = def.legL.a1 + swing;
    legR.a1 = def.legR.a1 - swing;
    legL.a2 = Math.max(0, -Math.sin(cycle)) * (run ? 36 : 16);
    legR.a2 = Math.max(0, Math.sin(cycle)) * (run ? 36 : 16);
    if (pose === 'walking' || pose === 'running' || pose === 'idle') {
      armL.a1 = def.armL.a1 - swing * 0.6;
      armR.a1 = def.armR.a1 + swing * 0.6;
    }
  }
  if (pose === 'explaining') {
    armL.a2 = def.armL.a2 + Math.sin(t * 4) * 12;
    armR.a2 = def.armR.a2 + Math.sin(t * 4 + 1.4) * 12;
  }
  if (pose === 'celebrating') {
    armL.a1 = def.armL.a1 + Math.sin(t * 9) * 9;
    armR.a1 = def.armR.a1 - Math.sin(t * 9) * 9;
  }
  if (pose === 'pointing') armR.a1 = def.armR.a1 + Math.sin(t * 3) * 3;

  const bodyY = def.bodyY + bob + hop + breathe * 1.5;
  const legPts = { L: limbPoints(HIP.L, 'L', legL, LEG), R: limbPoints(HIP.R, 'R', legR, LEG) };
  const armPts = {
    L: limbPoints({ x: SHOULDER.L.x, y: SHOULDER.L.y + bodyY }, 'L', armL, ARM),
    R: limbPoints({ x: SHOULDER.R.x, y: SHOULDER.R.y + bodyY }, 'R', armR, ARM),
  };
  const sx = 1 + breathe * 0.006;
  const sy = 1 - breathe * 0.008;
  const front = !!def.armsFront;
  const heldAt = def.held === 'phone' ? { x: 200, y: Math.min(armPts.L[2]!.y, armPts.R[2]!.y) } : armPts.R[2]!;

  const arms = (
    <g>
      <Limb pts={armPts.L} width={ARM_W} gap={front} />
      <Limb pts={armPts.R} width={ARM_W} gap={front} />
    </g>
  );
  const hands = (
    <g>
      <Hand at={armPts.L[2]!} from={armPts.L[1]!} gap={front} />
      <Hand at={armPts.R[2]!} from={armPts.R[1]!} gap={front} />
    </g>
  );

  return (
    <svg viewBox={`0 0 ${MASCOT_VIEWBOX.width} ${MASCOT_VIEWBOX.height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`${gid}-body`} cx="38%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#F4F4F8" />
          <stop offset="100%" stopColor="#D6D6E0" />
        </radialGradient>
        <linearGradient id={`${gid}-shoe`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E2EA" />
        </linearGradient>
        <radialGradient id={`${gid}-floor`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.16} />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${gid}-leaf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7CF29A" />
          <stop offset="100%" stopColor={sprout} />
        </linearGradient>
      </defs>
      <ellipse cx={200} cy={MASCOT_FEET_Y + 2} rx={130 - Math.abs(hop) * 0.8} ry={18} fill={`url(#${gid}-floor)`} />
      {def.sitting && (
        <g>
          <rect x={112} y={486} width={176} height={100} rx={18} fill="#24242B" />
          <rect x={112} y={486} width={176} height={18} rx={9} fill="#34343D" />
        </g>
      )}
      <g transform={`translate(${shiver} 0)`}>
        {/* legs + shoes */}
        <Limb pts={legPts.L} width={LEG_W} gap={false} />
        <Limb pts={legPts.R} width={LEG_W} gap={false} />
        <Shoe at={legPts.L[2]!} side="L" gid={gid} />
        <Shoe at={legPts.R[2]!} side="R" gid={gid} />
        {!front && arms}
        {!front && hands}
        {/* body */}
        <g transform={`translate(200 ${330 + bodyY}) rotate(${def.tilt}) scale(${sx} ${sy}) translate(-200 -330)`} style={{ ['--fvs-body' as string]: '#F4F4F8' }}>
          {/* sprout */}
          <path d="M 200 156 C 197 138 203 124 200 108" stroke="#2BB24C" strokeWidth={7} fill="none" strokeLinecap="round" />
          <path d="M 200 120 C 186 96 158 96 150 108 C 164 124 186 128 200 120 Z" fill={`url(#${gid}-leaf)`} />
          <path d="M 198 119 C 184 110 168 108 156 108" stroke="#1E9A3E" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.7} />
          <path d="M 201 114 C 214 88 242 88 252 100 C 238 118 216 122 201 114 Z" fill={`url(#${gid}-leaf)`} />
          <path d="M 203 113 C 216 104 232 100 246 100" stroke="#1E9A3E" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.7} />
          {/* egg body */}
          <path d="M 200 152 C 110 152 66 246 68 332 C 70 422 128 474 200 474 C 272 474 330 422 332 332 C 334 246 290 152 200 152 Z" fill={`url(#${gid}-body)`} />
          <ellipse cx={150} cy={212} rx={42} ry={22} transform="rotate(-28 150 212)" fill="#FFFFFF" opacity={0.85} />
          <g transform={`translate(${def.lookX * 0.5} ${def.lookY * 0.3})`}>
            <Brows expression={expression} />
            <Eye cx={162} cy={262} side="L" expression={expression} blink={blink} lookX={def.lookX * 0.5} lookY={def.lookY * 0.4} />
            <Eye cx={238} cy={262} side="R" expression={expression} blink={blink} lookX={def.lookX * 0.5} lookY={def.lookY * 0.4} />
            <Mouth expression={expression} talk={talk} />
          </g>
          {(expression === 'happy' || expression === 'excited' || expression === 'smug') && (
            <g opacity={0.32}>
              <ellipse cx={126} cy={304} rx={18} ry={10} fill="#FF7A9A" />
              <ellipse cx={274} cy={304} rx={18} ry={10} fill="#FF7A9A" />
            </g>
          )}
        </g>
        {front && arms}
        {def.held && <Held kind={def.held} x={heldAt.x} y={heldAt.y} accent={accent} />}
        {front ? hands : def.held === 'banknote' ? <Hand at={armPts.R[2]!} from={armPts.R[1]!} gap={false} /> : null}
      </g>
    </svg>
  );
};
