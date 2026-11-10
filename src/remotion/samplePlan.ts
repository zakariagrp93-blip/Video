import { DEFAULT_THEME, MOTIFS, POSES, PROP_ASSETS, VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH, type Expression } from '../shared/constants';
import type { PlannedScene, VideoPlan } from '../shared/schemas';
import { DEMO_STICK_SHOTS } from './stick/demoShots';

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
export function samplePlan(scenesCount: number = POSES.length, sceneSeconds = 2, layout: 'tall' | 'cinema' = 'tall', chartStyle: 'minimal' | 'classic' = 'classic'): VideoPlan {
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
    layout,
    captionMode: layout === 'cinema' ? 'sentence' : 'karaoke',
    iconTone: 'color',
    chartStyle,
    banner: layout === 'cinema' ? 'Et si tu recevais 1 million d’euros à 18 ans ?' : undefined,
    scenes,
    captions: scenes.map((s) => ({ startFrame: s.startFrame + 5, endFrame: s.startFrame + s.durationInFrames - 5, words: [{ text: s.character.pose, startFrame: s.startFrame + 5, endFrame: s.startFrame + 30, tone: 'accent' as const }] })),
    images: {},
  };
}

/** Demo motivation edit: one shot per motif with kinetic words — Remotion Studio preview and render tests. */
export function sampleEditPlan(sceneSeconds = 2.4): VideoPlan {
  const dur = Math.round(sceneSeconds * VIDEO_FPS);
  const heroes = ['sports-car', 'money-stack', 'trophy', 'hourglass'] as const;
  const lines = ['PERSONNE NE VIENDRA', 'TE RENDRE RICHE', 'CINQ HEURES DU MATIN', 'PAS D’EXCUSE', 'UNE MARCHE PAR JOUR', 'TU VAS DOUTER', 'JOUE POUR GAGNER', 'LÈVE-TOI', 'LE PRIX DU SUCCÈS', 'DEMAIN COMMENCE', 'TOUS PAREILS', 'APPRENDS EN SILENCE', 'PETIT À PETIT'];
  const silhouettes = new Set(['skyline', 'road', 'mountain', 'stairs', 'rain', 'sunrise', 'crowd', 'desk']);
  const scenes: PlannedScene[] = MOTIFS.map((motif, i) => ({
    id: `s${String(i + 1).padStart(2, '0')}`,
    index: i,
    startFrame: i * dur,
    durationInFrames: dur,
    narration: lines[i]!,
    emphasis: [],
    negative: [],
    durationHint: sceneSeconds,
    visualDescription: motif,
    character: { visible: silhouettes.has(motif), pose: motif === 'desk' ? 'sitting' : motif === 'road' || motif === 'stairs' ? 'walking' : 'idle', expression: 'determined', position: 'center', motion: 'none', facing: 'right' },
    background: 'black',
    props: motif === 'spotlight' ? [{ asset: heroes[i % heroes.length]!, animation: 'float', placement: 'center', count: 1, delay: 0 }] : [],
    effect: i === 1 ? 'impact' : motif === 'spotlight' ? 'sparkles' : motif === 'rain' ? 'smoke' : 'none',
    camera: (['push-in', 'pan-left', 'zoom-out', 'pan-right', 'tilt'] as const)[i % 5]!,
    transition: i === 0 ? 'cut' : i === 1 ? 'zoom-through' : i % 3 === 0 ? 'fade' : 'cut',
    textOverlay: null,
    chart: null,
    sfx: [],
    motif,
  }));
  return {
    version: 1,
    title: 'Motivation edit shots',
    language: 'fr',
    fps: VIDEO_FPS,
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    durationInFrames: scenes.length * dur,
    theme: DEFAULT_THEME,
    characterId: 'nummo',
    layout: 'tall',
    captionMode: 'kinetic',
    mode: 'edit',
    beat: { bpm: 130, offset: 0, dropAt: dur / VIDEO_FPS },
    iconTone: 'color',
    scenes,
    captions: scenes.map((s, i) => {
      const words = lines[i]!.split(' ');
      return {
        startFrame: s.startFrame + 4,
        endFrame: s.startFrame + s.durationInFrames - 2,
        words: words.map((w, k) => ({ text: w, startFrame: s.startFrame + 4 + k * 7, endFrame: s.startFrame + 10 + k * 7, tone: k === words.length - 1 ? ('accent' as const) : ('normal' as const) })),
      };
    }),
    images: {},
  };
}

/** Demo stick-figure explainer (hand-written shots in the format Claude produces). */
export function sampleStickPlan(seconds = 9, strict = false): VideoPlan {
  const dur = Math.round(seconds * VIDEO_FPS);
  const base = sampleEditPlan(seconds / 3);
  const scenes = base.scenes.slice(0, 3).map((s, i) => ({ ...s, motif: undefined, index: i, startFrame: Math.round((i * dur) / 3), durationInFrames: Math.round(((i + 1) * dur) / 3) - Math.round((i * dur) / 3) }));
  const words = ['cinq euros', 'par jour', 'ça fait combien'];
  return {
    ...base,
    title: 'Stick-figure demo',
    mode: 'stick',
    captionMode: 'karaoke',
    beat: undefined,
    durationInFrames: dur,
    scenes,
    captions: scenes.map((s, i) => ({ startFrame: s.startFrame + 6, endFrame: s.startFrame + s.durationInFrames - 6, words: [{ text: words[i]!, startFrame: s.startFrame + 6, endFrame: s.startFrame + 30, tone: 'normal' as const }] })),
    stick: { code: DEMO_STICK_SHOTS, strict },
  };
}
