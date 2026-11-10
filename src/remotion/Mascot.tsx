import React from 'react';
import type { Expression, Pose } from '../shared/constants';

/**
 * "Nummo" — the original Finance Video Studio mascot. A white egg-shaped
 * character with simple black eyes and a small green sprout ("money that
 * grows"). Drawn entirely in SVG from joint angles, so every pose keeps the
 * exact same proportions — the character is identical in every scene.
 *
 * Coordinate system: viewBox 0 0 400 620, feet on y≈600.
 */

export const MASCOT_VIEWBOX = { width: 400, height: 620 };
export const MASCOT_FEET_Y = 600;

const WHITE = '#F7F7F9';
const SHADE = '#E3E3EA';
const INK = '#0B0B0D';
const OUTLINE = 6;

/** Angles in degrees from straight down; positive rotates away from the body (outward). */
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
  heldHand?: 'L' | 'R';
  lookX: number;
  lookY: number;
  sitting?: boolean;
  armsFront?: boolean;
}

const POSES: Record<Pose, PoseDef> = {
  idle: { armL: { a1: 12, a2: 6 }, armR: { a1: 12, a2: 6 }, legL: { a1: 4, a2: 0 }, legR: { a1: 4, a2: 0 }, tilt: 0, bodyY: 0, lookX: 0, lookY: 0 },
  walking: { armL: { a1: 20, a2: 10 }, armR: { a1: 20, a2: 10 }, legL: { a1: 0, a2: 0 }, legR: { a1: 0, a2: 0 }, tilt: 2, bodyY: 0, lookX: 4, lookY: 0 },
  running: { armL: { a1: 30, a2: 60 }, armR: { a1: 30, a2: 60 }, legL: { a1: 0, a2: 0 }, legR: { a1: 0, a2: 0 }, tilt: 8, bodyY: 0, lookX: 6, lookY: 0 },
  sitting: { armL: { a1: 20, a2: 30 }, armR: { a1: 20, a2: 30 }, legL: { a1: -70, a2: 70 }, legR: { a1: -70, a2: 70 }, tilt: 0, bodyY: 70, lookX: 0, lookY: 0, sitting: true },
  thinking: { armL: { a1: 10, a2: 4 }, armR: { a1: 35, a2: 125 }, legL: { a1: 4, a2: 0 }, legR: { a1: 4, a2: 0 }, tilt: -3, bodyY: 0, lookX: 8, lookY: -10, armsFront: true },
  surprised: { armL: { a1: 55, a2: 35 }, armR: { a1: 55, a2: 35 }, legL: { a1: 8, a2: 0 }, legR: { a1: 8, a2: 0 }, tilt: 0, bodyY: -6, lookX: 0, lookY: -2 },
  happy: { armL: { a1: 35, a2: 20 }, armR: { a1: 35, a2: 20 }, legL: { a1: 6, a2: 0 }, legR: { a1: 6, a2: 0 }, tilt: 0, bodyY: 0, lookX: 0, lookY: 0 },
  sad: { armL: { a1: 4, a2: 0 }, armR: { a1: 4, a2: 0 }, legL: { a1: 2, a2: 0 }, legR: { a1: 2, a2: 0 }, tilt: 4, bodyY: 8, lookX: 0, lookY: 8 },
  shocked: { armL: { a1: 150, a2: 15 }, armR: { a1: 150, a2: 15 }, legL: { a1: 12, a2: 0 }, legR: { a1: 12, a2: 0 }, tilt: 0, bodyY: -10, lookX: 0, lookY: -2 },
  pointing: { armL: { a1: 12, a2: 6 }, armR: { a1: 92, a2: 0 }, legL: { a1: 5, a2: 0 }, legR: { a1: 5, a2: 0 }, tilt: 2, bodyY: 0, lookX: 10, lookY: 0 },
  'holding-money': { armL: { a1: 12, a2: 6 }, armR: { a1: 50, a2: 55 }, legL: { a1: 4, a2: 0 }, legR: { a1: 4, a2: 0 }, tilt: 0, bodyY: 0, lookX: 8, lookY: 2, held: 'banknote', heldHand: 'R' },
  'holding-phone': { armL: { a1: 18, a2: 95 }, armR: { a1: 18, a2: 95 }, legL: { a1: 4, a2: 0 }, legR: { a1: 4, a2: 0 }, tilt: 0, bodyY: 0, lookX: 0, lookY: 12, held: 'phone', heldHand: 'R', armsFront: true },
  explaining: { armL: { a1: 30, a2: 70 }, armR: { a1: 30, a2: 70 }, legL: { a1: 5, a2: 0 }, legR: { a1: 5, a2: 0 }, tilt: 0, bodyY: 0, lookX: 0, lookY: 0 },
  celebrating: { armL: { a1: 160, a2: -10 }, armR: { a1: 160, a2: -10 }, legL: { a1: 14, a2: 0 }, legR: { a1: 14, a2: 0 }, tilt: 0, bodyY: -8, lookX: 0, lookY: -4 },
};

const SHOULDER = { L: { x: 102, y: 318 }, R: { x: 298, y: 318 } };
const HIP = { L: { x: 162, y: 418 }, R: { x: 238, y: 418 } };
const ARM = [74, 66];
const LEG = [92, 86];

function limbPoints(origin: { x: number; y: number }, side: 'L' | 'R', limb: Limb, lengths: number[]): Array<{ x: number; y: number }> {
  const sgn = side === 'L' ? -1 : 1;
  const r1 = (limb.a1 * Math.PI) / 180;
  const r2 = ((limb.a1 + limb.a2) * Math.PI) / 180;
  const elbow = { x: origin.x + sgn * Math.sin(r1) * lengths[0]!, y: origin.y + Math.cos(r1) * lengths[0]! };
  const end = { x: elbow.x + sgn * Math.sin(r2) * lengths[1]!, y: elbow.y + Math.cos(r2) * lengths[1]! };
  return [origin, elbow, end];
}

function LimbPath({ pts, width }: { pts: Array<{ x: number; y: number }>; width: number }) {
  const d = `M ${pts[0]!.x} ${pts[0]!.y} Q ${pts[1]!.x} ${pts[1]!.y} ${pts[2]!.x} ${pts[2]!.y}`;
  return (
    <>
      <path d={d} stroke={INK} strokeWidth={width + OUTLINE * 2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke={WHITE} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

function Eye({ cx, cy, expression, blink, lookX, lookY, side }: { cx: number; cy: number; expression: Expression; blink: number; lookX: number; lookY: number; side: 'L' | 'R' }) {
  const big = expression === 'shocked' ? 1.32 : expression === 'surprised' ? 1.18 : expression === 'excited' ? 1.08 : 1;
  const rx = 17 * big;
  const ry = 25 * big * (1 - blink * 0.92);
  const x = cx + lookX;
  const y = cy + lookY;
  if (expression === 'happy') {
    // Closed smiling eyes: ^ ^
    return <path d={`M ${x - 17} ${y + 6} Q ${x} ${y - 20} ${x + 17} ${y + 6}`} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />;
  }
  const lid =
    expression === 'sad' || expression === 'worried'
      ? side === 'L'
        ? `M ${x - rx - 4} ${y - ry * 0.55} L ${x + rx + 4} ${y - ry * 1.05} L ${x + rx + 4} ${y - ry - 12} L ${x - rx - 4} ${y - ry - 12} Z`
        : `M ${x - rx - 4} ${y - ry * 1.05} L ${x + rx + 4} ${y - ry * 0.55} L ${x + rx + 4} ${y - ry - 12} L ${x - rx - 4} ${y - ry - 12} Z`
      : expression === 'smug'
        ? `M ${x - rx - 4} ${y - ry * 0.15} L ${x + rx + 4} ${y - ry * 0.15} L ${x + rx + 4} ${y - ry - 12} L ${x - rx - 4} ${y - ry - 12} Z`
        : expression === 'determined'
          ? side === 'L'
            ? `M ${x - rx - 4} ${y - ry * 0.95} L ${x + rx + 4} ${y - ry * 0.35} L ${x + rx + 4} ${y - ry - 12} L ${x - rx - 4} ${y - ry - 12} Z`
            : `M ${x - rx - 4} ${y - ry * 0.35} L ${x + rx + 4} ${y - ry * 0.95} L ${x + rx + 4} ${y - ry - 12} L ${x - rx - 4} ${y - ry - 12} Z`
          : null;
  return (
    <g>
      <ellipse cx={x} cy={y} rx={rx} ry={Math.max(2, ry)} fill={INK} />
      {ry > 8 && <circle cx={x + rx * 0.35} cy={y - ry * 0.4} r={5.5 * big} fill="#FFFFFF" />}
      {ry > 8 && <circle cx={x - rx * 0.3} cy={y + ry * 0.35} r={2.4 * big} fill="#FFFFFF" opacity={0.8} />}
      {lid && <path d={lid} fill={WHITE} />}
    </g>
  );
}

function Brows({ expression }: { expression: Expression }) {
  const common = { stroke: INK, strokeWidth: 7, strokeLinecap: 'round' as const, fill: 'none' };
  switch (expression) {
    case 'worried':
    case 'sad':
      return (
        <g {...common}>
          <path d="M 140 178 L 176 168" />
          <path d="M 224 168 L 260 178" />
        </g>
      );
    case 'determined':
      return (
        <g {...common}>
          <path d="M 140 172 L 178 184" />
          <path d="M 222 184 L 260 172" />
        </g>
      );
    case 'shocked':
    case 'surprised':
      return (
        <g {...common}>
          <path d="M 138 160 Q 158 146 180 156" />
          <path d="M 220 156 Q 242 146 262 160" />
        </g>
      );
    case 'thinking':
      return (
        <g {...common}>
          <path d="M 142 182 L 178 182" />
          <path d="M 222 170 Q 242 160 262 168" />
        </g>
      );
    case 'smug':
      return (
        <g {...common}>
          <path d="M 142 186 L 178 182" />
          <path d="M 222 178 Q 242 170 262 176" />
        </g>
      );
    default:
      return null;
  }
}

function Mouth({ expression, talk }: { expression: Expression; talk: number }) {
  const y = 282;
  const open = talk;
  switch (expression) {
    case 'happy':
    case 'excited':
      return <path d={`M 168 ${y - 4} Q 200 ${y + 34 + open * 6} 232 ${y - 4} Z`} fill={INK} stroke={INK} strokeWidth={4} strokeLinejoin="round" />;
    case 'sad':
      return <path d={`M 178 ${y + 14} Q 200 ${y - 2} 222 ${y + 14}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />;
    case 'worried':
      return <path d={`M 176 ${y + 8} Q 188 ${y} 200 ${y + 8} Q 212 ${y + 16} 224 ${y + 8}`} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />;
    case 'shocked':
      return <ellipse cx={200} cy={y + 10} rx={15} ry={20 + open * 3} fill={INK} />;
    case 'surprised':
      return <ellipse cx={200} cy={y + 6} rx={10} ry={12 + open * 3} fill={INK} />;
    case 'thinking':
      return <path d={`M 186 ${y + 6} L 214 ${y + 2}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />;
    case 'smug':
      return <path d={`M 180 ${y + 4} Q 206 ${y + 18} 226 ${y - 6}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />;
    case 'determined':
      return <path d={`M 182 ${y + 6} Q 200 ${y + 12} 218 ${y + 6}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />;
    case 'neutral':
    default:
      return open > 0.15 ? (
        <ellipse cx={200} cy={y + 6} rx={13} ry={4 + open * 9} fill={INK} />
      ) : (
        <path d={`M 182 ${y + 2} Q 200 ${y + 16} 218 ${y + 2}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />
      );
  }
}

function Held({ kind, x, y, accent }: { kind: 'phone' | 'banknote'; x: number; y: number; accent: string }) {
  if (kind === 'phone') {
    return (
      <g transform={`translate(${x - 34} ${y - 70})`}>
        <rect x={0} y={0} width={68} height={118} rx={12} fill={INK} stroke={INK} strokeWidth={4} />
        <rect x={6} y={10} width={56} height={92} rx={6} fill="#2C2C30" />
        <rect x={12} y={22} width={44} height={10} rx={4} fill={accent} />
        <rect x={12} y={40} width={30} height={7} rx={3} fill="#5A5A60" />
        <rect x={12} y={54} width={38} height={7} rx={3} fill="#5A5A60" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x - 10} ${y - 54}) rotate(-12)`}>
      <rect x={0} y={0} width={120} height={60} rx={8} fill="#2FBF58" stroke={INK} strokeWidth={5} />
      <rect x={10} y={10} width={100} height={40} rx={5} fill="none" stroke="#1E8F40" strokeWidth={3} />
      <circle cx={60} cy={30} r={12} fill="#1E8F40" />
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
  const def = POSES[pose];
  const t = frame / fps;
  const isWalk = walking || pose === 'walking' || pose === 'running';
  const run = pose === 'running';
  const cycle = t * (run ? 2.6 : 1.7) * walkSpeed * Math.PI * 2;
  const breathe = Math.sin(t * 2.2 + seed) * (isWalk ? 0 : 1);
  const bob = isWalk ? Math.abs(Math.sin(cycle)) * -10 : 0;
  const hop = pose === 'celebrating' ? -Math.abs(Math.sin(t * 5)) * 22 : pose === 'happy' ? -Math.abs(Math.sin(t * 3.2)) * 6 : 0;
  const shiver = pose === 'shocked' ? Math.sin(frame * 1.9) * 2.2 : 0;

  // Blink every ~3.4 s for 4 frames (never during shocked).
  const period = Math.round(fps * 3.4);
  const phase = (frame + Math.round(seed * 17)) % period;
  const blink = expression === 'shocked' ? 0 : phase < 2 ? phase / 2 : phase < 4 ? (4 - phase) / 2 : 0;

  const swing = isWalk ? Math.sin(cycle) * (run ? 38 : 26) : 0;
  const armL = { ...def.armL };
  const armR = { ...def.armR };
  const legL = { ...def.legL };
  const legR = { ...def.legR };
  if (isWalk && !def.sitting) {
    legL.a1 = def.legL.a1 + swing;
    legR.a1 = def.legR.a1 - swing;
    legL.a2 = Math.max(0, -Math.sin(cycle)) * (run ? 40 : 18);
    legR.a2 = Math.max(0, Math.sin(cycle)) * (run ? 40 : 18);
    if (pose === 'walking' || pose === 'running' || pose === 'idle') {
      armL.a1 = def.armL.a1 - swing * 0.6;
      armR.a1 = def.armR.a1 + swing * 0.6;
    }
  }
  if (pose === 'explaining') {
    armL.a2 = def.armL.a2 + Math.sin(t * 4) * 14;
    armR.a2 = def.armR.a2 + Math.sin(t * 4 + 1.4) * 14;
  }
  if (pose === 'celebrating') {
    armL.a1 = def.armL.a1 + Math.sin(t * 9) * 10;
    armR.a1 = def.armR.a1 - Math.sin(t * 9) * 10;
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
  const heldHand = def.heldHand === 'L' ? armPts.L[2]! : armPts.R[2]!;
  const phoneCenter = pose === 'holding-phone' ? { x: 200, y: armPts.R[2]!.y - 6 } : heldHand;

  const arms = (
    <g>
      <LimbPath pts={armPts.L} width={24} />
      <LimbPath pts={armPts.R} width={24} />
      <circle cx={armPts.L[2]!.x} cy={armPts.L[2]!.y} r={16} fill={WHITE} stroke={INK} strokeWidth={OUTLINE} />
      <circle cx={armPts.R[2]!.x} cy={armPts.R[2]!.y} r={16} fill={WHITE} stroke={INK} strokeWidth={OUTLINE} />
    </g>
  );

  return (
    <svg viewBox={`0 0 ${MASCOT_VIEWBOX.width} ${MASCOT_VIEWBOX.height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
      {/* ground shadow */}
      <ellipse cx={200} cy={MASCOT_FEET_Y + 4} rx={108 - Math.abs(hop) * 0.8} ry={14} fill="#FFFFFF" opacity={0.08} />
      {def.sitting && <rect x={120} y={470} width={160} height={110} rx={14} fill="#2A2A2E" stroke={INK} strokeWidth={OUTLINE} />}
      <g transform={`translate(${shiver} 0)`}>
        {/* legs */}
        <g>
          <LimbPath pts={legPts.L} width={26} />
          <LimbPath pts={legPts.R} width={26} />
          <ellipse cx={legPts.L[2]!.x - 8} cy={legPts.L[2]!.y + 2} rx={28} ry={15} fill={WHITE} stroke={INK} strokeWidth={OUTLINE} />
          <ellipse cx={legPts.R[2]!.x + 8} cy={legPts.R[2]!.y + 2} rx={28} ry={15} fill={WHITE} stroke={INK} strokeWidth={OUTLINE} />
        </g>
        {!def.armsFront && arms}
        {/* body */}
        <g transform={`translate(200 ${300 + bodyY}) rotate(${def.tilt}) scale(${sx} ${sy}) translate(-200 -300)`}>
          {/* sprout */}
          <path d="M 200 128 C 198 110 202 98 200 84" stroke={sprout} strokeWidth={7} fill="none" strokeLinecap="round" />
          <path d="M 200 96 C 186 74 160 76 154 86 C 168 100 188 102 200 96 Z" fill={sprout} stroke={INK} strokeWidth={4} />
          <path d="M 201 90 C 214 66 240 66 248 76 C 234 92 214 96 201 90 Z" fill={sprout} stroke={INK} strokeWidth={4} />
          <path d="M 200 126 C 112 126 70 214 72 300 C 74 392 128 440 200 440 C 272 440 326 392 328 300 C 330 214 288 126 200 126 Z" fill={WHITE} stroke={INK} strokeWidth={OUTLINE} />
          <path d="M 92 330 C 104 404 150 432 200 432 C 250 432 296 404 308 330 C 290 388 250 412 200 412 C 150 412 110 388 92 330 Z" fill={SHADE} />
          <g transform={`translate(${def.lookX * 0.5} ${def.lookY * 0.3})`}>
            <Brows expression={expression} />
            <Eye cx={160} cy={222} side="L" expression={expression} blink={blink} lookX={def.lookX * 0.5} lookY={def.lookY * 0.4} />
            <Eye cx={240} cy={222} side="R" expression={expression} blink={blink} lookX={def.lookX * 0.5} lookY={def.lookY * 0.4} />
            <Mouth expression={expression} talk={talk} />
          </g>
          {(expression === 'happy' || expression === 'excited') && (
            <g opacity={0.35}>
              <ellipse cx={128} cy={266} rx={16} ry={9} fill="#FF7A9A" />
              <ellipse cx={272} cy={266} rx={16} ry={9} fill="#FF7A9A" />
            </g>
          )}
        </g>
        {def.armsFront && arms}
        {def.held && <Held kind={def.held} x={phoneCenter.x} y={phoneCenter.y} accent={accent} />}
        {def.held === 'phone' && (
          <circle cx={armPts.R[2]!.x} cy={armPts.R[2]!.y} r={16} fill={WHITE} stroke={INK} strokeWidth={OUTLINE} />
        )}
      </g>
    </svg>
  );
};
