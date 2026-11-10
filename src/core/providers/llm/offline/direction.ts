import type {
  Background,
  CameraMove,
  CharacterMotion,
  CharacterPosition,
  Effect,
  Expression,
  Pose,
  PropAnimation,
  PropAsset,
  PropPlacement,
  SfxTiming,
  SfxType,
  Transition,
} from '../../../../shared/constants';
import type { Chart, SceneProp, TextOverlay } from '../../../../shared/schemas';

export interface Direction {
  pose: Pose;
  expr: Expression;
  pos: CharacterPosition;
  motion: CharacterMotion;
  facing: 'left' | 'right';
  visible: boolean;
  bg: Background;
  props: SceneProp[];
  fx: Effect;
  cam: CameraMove;
  tr: Transition;
  overlay: TextOverlay | null;
  chart: Chart | null;
  sfx: Array<{ type: SfxType; at: SfxTiming }>;
}

export interface Beat {
  text: string;
  /** Condensed narration for short videos. */
  short?: string;
  emphasis: string[];
  negative: string[];
  dir: Direction;
}

export function d(p: Partial<Direction> & Pick<Direction, 'pose' | 'expr'>): Direction {
  return {
    pos: 'center',
    motion: 'none',
    facing: 'right',
    visible: true,
    bg: 'spotlight',
    props: [],
    fx: 'none',
    cam: 'static',
    tr: 'fade',
    overlay: null,
    chart: null,
    sfx: [],
    ...p,
  };
}

export function P(asset: PropAsset, animation: PropAnimation, placement: PropPlacement, extra: Partial<SceneProp> = {}): SceneProp {
  return { asset, animation, placement, count: 1, delay: 0, ...extra };
}

export function S(type: SfxType, at: SfxTiming = 'start'): { type: SfxType; at: SfxTiming } {
  return { type, at };
}

export function beat(text: string, dir: Direction, emphasis: string[] = [], negative: string[] = []): Beat {
  return { text, emphasis, negative, dir };
}

/* Human-readable descriptions of a direction (the script's visual fields). */
const POSE_TEXT: Record<Pose, string> = {
  idle: 'stands still',
  walking: 'walks',
  running: 'runs',
  sitting: 'sits down',
  thinking: 'thinks, hand on chin',
  surprised: 'is surprised',
  happy: 'smiles',
  sad: 'looks down sadly',
  shocked: 'is shocked, arms up',
  pointing: 'points at the object',
  'holding-money': 'holds a banknote',
  'holding-phone': 'looks at a phone',
  explaining: 'explains with open hands',
  celebrating: 'celebrates, arms raised',
};

export function describeVisual(dir: Direction): string {
  const props = dir.props.map((p) => `${p.count > 1 ? `${p.count}× ` : ''}${p.asset} (${p.animation}, ${p.placement})`).join(', ');
  const parts = [`Background: ${dir.bg}.`];
  if (props) parts.push(`Objects: ${props}.`);
  if (dir.chart) parts.push(`A ${dir.chart.kind} chart trending ${dir.chart.trend}.`);
  if (dir.overlay) parts.push(`On-screen text: "${dir.overlay.text}"${dir.overlay.counter ? ' (animated counter)' : ''}.`);
  if (dir.fx !== 'none') parts.push(`Effect: ${dir.fx}.`);
  return parts.join(' ');
}

export function describeAction(dir: Direction): string {
  if (!dir.visible) return 'The mascot is off screen.';
  const motion = dir.motion === 'none' ? '' : ` (${dir.motion})`;
  return `The mascot ${POSE_TEXT[dir.pose]}, ${dir.expr} expression, ${dir.pos} of frame${motion}.`;
}
