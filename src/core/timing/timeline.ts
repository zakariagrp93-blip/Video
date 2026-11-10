import { DEFAULT_THEME, VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH, type SfxType } from '../../shared/constants';
import type { AudioPlan, NarrationManifest, PlannedScene, SfxEvent, Storyboard, VideoPlan } from '../../shared/schemas';

export interface TimelineOptions {
  fps?: number;
  brand?: { name: string; accent: string; danger: string } | null;
  images?: Record<string, string>;
}

/** Visual cut happens slightly before the next scene's narration begins. */
const CUT_LEAD = 0.14;
const MIN_SCENE_SEC = 1.2;

/**
 * Turn measured narration timing into frame-accurate scene placement.
 */
export function planScenes(storyboard: Storyboard, narration: NarrationManifest, fps = VIDEO_FPS): { scenes: PlannedScene[]; durationInFrames: number } {
  const total = Math.ceil(narration.totalDuration * fps);
  const bySceneId = new Map(narration.segments.map((s) => [s.sceneId, s]));
  const starts: number[] = storyboard.scenes.map((sc, i) => {
    if (i === 0) return 0;
    const seg = bySceneId.get(sc.id);
    if (!seg) throw new Error(`Missing narration for scene ${sc.id}`);
    return Math.max(0, Math.round((seg.start - CUT_LEAD) * fps));
  });
  // Enforce monotonic starts and a minimum scene length.
  for (let i = 1; i < starts.length; i++) starts[i] = Math.max(starts[i]!, starts[i - 1]! + Math.round(MIN_SCENE_SEC * fps));
  const scenes: PlannedScene[] = storyboard.scenes.map((sc, i) => {
    const start = starts[i]!;
    const end = i < starts.length - 1 ? starts[i + 1]! : Math.max(total, start + Math.round(MIN_SCENE_SEC * fps));
    return { ...sc, index: i, startFrame: start, durationInFrames: end - start };
  });
  const last = scenes[scenes.length - 1]!;
  return { scenes, durationInFrames: last.startFrame + last.durationInFrames };
}

export function buildVideoPlan(storyboard: Storyboard, narration: NarrationManifest, captions: VideoPlan['captions'], opts: TimelineOptions = {}): VideoPlan {
  const fps = opts.fps ?? VIDEO_FPS;
  const { scenes, durationInFrames } = planScenes(storyboard, narration, fps);
  const theme = { ...DEFAULT_THEME };
  if (opts.brand) {
    theme.accent = opts.brand.accent || theme.accent;
    theme.danger = opts.brand.danger || theme.danger;
  }
  return {
    version: 1,
    title: storyboard.title,
    language: storyboard.language,
    fps,
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    durationInFrames,
    theme,
    brandName: opts.brand?.name || undefined,
    characterId: storyboard.characterId,
    scenes,
    captions,
    images: opts.images ?? {},
  };
}

const EFFECT_SFX: Partial<Record<string, SfxType>> = {
  'money-rain': 'cash',
  'coin-burst': 'coin',
  impact: 'impact',
  confetti: 'pop',
  sparkles: 'ding',
};

/** Derive the sound-effect timeline from the plan (scene SFX, transitions, effects). */
export function buildSfxTimeline(plan: VideoPlan): SfxEvent[] {
  const events: SfxEvent[] = [];
  const sec = (f: number) => f / plan.fps;
  for (const sc of plan.scenes) {
    const start = sec(sc.startFrame);
    const dur = sec(sc.durationInFrames);
    if (sc.index > 0 && sc.transition !== 'cut') events.push({ type: sc.transition === 'zoom-through' ? 'whoosh' : 'swoosh', time: Math.max(0, start - 0.12), gain: 0.5 });
    for (const s of sc.sfx) {
      const at = s.at === 'start' ? start + 0.08 : s.at === 'middle' ? start + dur * 0.45 : start + Math.max(0.1, dur - 0.5);
      events.push({ type: s.type, time: at, gain: s.type === 'impact' ? 0.8 : 0.65 });
    }
    const fx = EFFECT_SFX[sc.effect];
    if (fx && !sc.sfx.some((s) => s.type === fx)) events.push({ type: fx, time: start + 0.25, gain: 0.5 });
    for (const p of sc.props) {
      if (p.animation === 'pop' && events.filter((e) => Math.abs(e.time - (start + p.delay * dur)) < 0.2).length === 0) {
        events.push({ type: 'pop', time: start + p.delay * dur + 0.05, gain: 0.35 });
      }
    }
  }
  // Avoid stacking: keep at most one event per 120 ms of the same type.
  events.sort((a, b) => a.time - b.time);
  return events.filter((e, i) => !events.slice(0, i).some((p) => p.type === e.type && Math.abs(p.time - e.time) < 0.12));
}

export function buildAudioPlan(
  plan: VideoPlan,
  narrationFile: string,
  narrationDuration: number,
  music: { enabled: boolean; file?: string; volume: number },
  volumes: { sfx: number; narration: number },
): AudioPlan {
  return {
    narrationFile,
    narrationDuration,
    totalDuration: plan.durationInFrames / plan.fps,
    music,
    sfx: buildSfxTimeline(plan),
    sfxVolume: volumes.sfx,
    narrationVolume: volumes.narration,
  };
}
