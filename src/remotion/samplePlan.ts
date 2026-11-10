import { DEFAULT_THEME, POSES, PROP_ASSETS, VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH, type Expression } from '../shared/constants';
import type { PlannedScene, VideoPlan } from '../shared/schemas';

const EXPR: Record<string, Expression> = {
  idle: 'neutral',
  walking: 'happy',
  running: 'determined',
  sitting: 'smug',
  thinking: 'thinking',
  surprised: 'surprised',
  happy: 'happy',
  sad: 'sad',
  shocked: 'shocked',
  pointing: 'neutral',
  'holding-money': 'smug',
  'holding-phone': 'surprised',
  explaining: 'neutral',
  celebrating: 'excited',
};

/** Demo plan showing every pose with props — used as Remotion Studio default props and in render tests. */
export function samplePlan(scenesCount = POSES.length, sceneSeconds = 2): VideoPlan {
  const dur = Math.round(sceneSeconds * VIDEO_FPS);
  const scenes: PlannedScene[] = POSES.slice(0, scenesCount).map((pose, i) => ({
    id: `s${String(i + 1).padStart(2, '0')}`,
    index: i,
    startFrame: i * dur,
    durationInFrames: dur,
    narration: pose,
    emphasis: [],
    negative: [],
    durationHint: sceneSeconds,
    visualDescription: '',
    character: { visible: true, pose, expression: EXPR[pose] ?? 'neutral', position: i % 3 === 0 ? 'center' : 'left', motion: pose === 'walking' ? 'walk-across' : 'none', facing: 'right' },
    background: (['spotlight', 'grid', 'floor', 'vignette', 'stars', 'city', 'black'] as const)[i % 7]!,
    props: i % 3 === 0 ? [] : [{ asset: PROP_ASSETS[(i * 3) % PROP_ASSETS.length]!, animation: 'pop', placement: 'right', count: 1, delay: 0.1 }],
    effect: i === 13 ? 'confetti' : 'none',
    camera: i % 2 ? 'zoom-in' : 'static',
    transition: i === 0 ? 'cut' : (['fade', 'slide-left', 'slide-up', 'wipe', 'zoom-through'] as const)[i % 5]!,
    textOverlay: i % 3 === 0 ? { text: pose.toUpperCase(), style: 'headline' } : null,
    chart: i === 6 ? { kind: 'line', trend: 'up', values: [1, 3, 2, 5, 4, 7, 9] } : null,
    sfx: [],
  }));
  return {
    version: 1,
    title: 'Mascot pose sheet',
    language: 'en',
    fps: VIDEO_FPS,
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    durationInFrames: scenes.length * dur,
    theme: DEFAULT_THEME,
    characterId: 'nummo',
    scenes,
    captions: scenes.map((s) => ({ startFrame: s.startFrame + 5, endFrame: s.startFrame + s.durationInFrames - 5, words: [{ text: s.character.pose, startFrame: s.startFrame + 5, endFrame: s.startFrame + 30, tone: 'accent' as const }] })),
    images: {},
  };
}
