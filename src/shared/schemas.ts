import { z } from 'zod';
import {
  BACKGROUNDS,
  CAMERA_MOVES,
  CHARACTER_MOTIONS,
  CHARACTER_POSITIONS,
  CHART_KINDS,
  CHART_TRENDS,
  DURATION_OPTIONS,
  EFFECTS,
  EXPORT_QUALITIES,
  EXPRESSIONS,
  LANGUAGES,
  NARRATOR_OPTIONS,
  PIPELINE_STAGES,
  POSES,
  PROJECT_STATUSES,
  PROP_ANIMATIONS,
  PROP_ASSETS,
  PROP_PLACEMENTS,
  SFX_TIMINGS,
  SFX_TYPES,
  STORYTELLING_STYLES,
  TEXT_STYLES,
  TRANSITIONS,
  VISUAL_STYLES,
} from './constants';

/* ------------------------------------------------------------------ */
/* Generation request                                                  */
/* ------------------------------------------------------------------ */

export const GenerationOptionsSchema = z.object({
  topic: z.string().trim().min(8, 'Topic is too short (min 8 characters).').max(300, 'Topic is too long (max 300 characters).'),
  duration: z.enum(DURATION_OPTIONS),
  language: z.enum(LANGUAGES),
  narrator: z.enum(NARRATOR_OPTIONS),
  storytelling: z.enum(STORYTELLING_STYLES),
  visualStyle: z.enum(VISUAL_STYLES),
});
export type GenerationOptions = z.infer<typeof GenerationOptionsSchema>;

/* ------------------------------------------------------------------ */
/* Script (stage 1 output)                                             */
/* ------------------------------------------------------------------ */

export const ClaimSchema = z.object({
  text: z.string().min(1),
  kind: z.enum(['hypothesis', 'calculation', 'fact']),
  /** Required for kind === 'fact': where the fact can be verified. */
  source: z.string().optional(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const ScriptSceneSchema = z.object({
  narration: z.string().trim().min(2),
  visual: z.string().trim().min(2),
  characterAction: z.string().trim().min(2),
  camera: z.string().trim().min(2),
  animation: z.string().trim().min(2),
  sfx: z.string().trim().min(1),
  durationHint: z.number().min(1).max(15),
  /** Words that deserve yellow emphasis in subtitles. */
  emphasis: z.array(z.string()).default([]),
  /** Words that deserve red (negative) emphasis in subtitles. */
  negative: z.array(z.string()).default([]),
});
export type ScriptScene = z.infer<typeof ScriptSceneSchema>;

export const ScriptSchema = z.object({
  version: z.literal(1),
  title: z.string().trim().min(3).max(120),
  hook: z.string().trim().min(5),
  language: z.enum(LANGUAGES),
  storytelling: z.enum(STORYTELLING_STYLES),
  isHypothetical: z.boolean(),
  assumptions: z.array(z.string()).default([]),
  claims: z.array(ClaimSchema).default([]),
  scenes: z.array(ScriptSceneSchema).min(8).max(15),
  finalLine: z.string().trim().min(3),
  fullNarration: z.string().trim().min(20),
  hashtags: z.array(z.string()).default([]),
  generator: z.object({ provider: z.string(), model: z.string() }),
});
export type Script = z.infer<typeof ScriptSchema>;

/* ------------------------------------------------------------------ */
/* Storyboard (stage 2 output)                                         */
/* ------------------------------------------------------------------ */

export const CharacterDirectionSchema = z.object({
  visible: z.boolean(),
  pose: z.enum(POSES),
  expression: z.enum(EXPRESSIONS),
  position: z.enum(CHARACTER_POSITIONS),
  motion: z.enum(CHARACTER_MOTIONS),
  facing: z.enum(['left', 'right']),
});
export type CharacterDirection = z.infer<typeof CharacterDirectionSchema>;

export const ScenePropSchema = z.object({
  asset: z.enum(PROP_ASSETS),
  animation: z.enum(PROP_ANIMATIONS),
  placement: z.enum(PROP_PLACEMENTS),
  count: z.number().int().min(1).max(12).default(1),
  label: z.string().max(24).optional(),
  /** 0..1 — when in the scene the prop appears (fraction of scene duration). */
  delay: z.number().min(0).max(0.9).default(0),
  /** Optional AI illustration key (illustrations/<key>.png) replacing the vector asset. */
  imageKey: z.string().optional(),
});
export type SceneProp = z.infer<typeof ScenePropSchema>;

export const CounterSchema = z.object({
  from: z.number(),
  to: z.number(),
  prefix: z.string().max(6).default(''),
  suffix: z.string().max(12).default(''),
  decimals: z.number().int().min(0).max(2).default(0),
});
export type Counter = z.infer<typeof CounterSchema>;

export const TextOverlaySchema = z.object({
  text: z.string().max(60),
  style: z.enum(TEXT_STYLES),
  counter: CounterSchema.optional(),
});
export type TextOverlay = z.infer<typeof TextOverlaySchema>;

export const ChartSchema = z.object({
  kind: z.enum(CHART_KINDS),
  trend: z.enum(CHART_TRENDS),
  values: z.array(z.number()).min(3).max(16),
  label: z.string().max(30).optional(),
});
export type Chart = z.infer<typeof ChartSchema>;

export const SceneSfxSchema = z.object({ type: z.enum(SFX_TYPES), at: z.enum(SFX_TIMINGS) });
export type SceneSfx = z.infer<typeof SceneSfxSchema>;

export const StoryboardSceneSchema = z.object({
  id: z.string().min(1),
  narration: z.string().trim().min(2),
  emphasis: z.array(z.string()).default([]),
  negative: z.array(z.string()).default([]),
  durationHint: z.number().min(1).max(15),
  visualDescription: z.string().default(''),
  character: CharacterDirectionSchema,
  background: z.enum(BACKGROUNDS),
  props: z.array(ScenePropSchema).max(5),
  effect: z.enum(EFFECTS),
  camera: z.enum(CAMERA_MOVES),
  transition: z.enum(TRANSITIONS),
  textOverlay: TextOverlaySchema.nullable(),
  chart: ChartSchema.nullable(),
  sfx: z.array(SceneSfxSchema).max(3),
});
export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;

export const StoryboardSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1),
  language: z.enum(LANGUAGES),
  characterId: z.string().min(1),
  scenes: z.array(StoryboardSceneSchema).min(8).max(15),
  /**
   * Optional AI illustrations for objects the vector library cannot express.
   * Each one is generated once, cached, and referenced by props via imageKey.
   */
  illustrations: z
    .array(z.object({ key: z.string().regex(/^[a-z0-9-]{2,40}$/), prompt: z.string().min(5).max(400) }))
    .max(8)
    .default([]),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

/* ------------------------------------------------------------------ */
/* Audio + subtitles                                                   */
/* ------------------------------------------------------------------ */

export const WordTimingSchema = z.object({
  text: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
});
export type WordTiming = z.infer<typeof WordTimingSchema>;

export const NarrationSegmentSchema = z.object({
  sceneId: z.string(),
  file: z.string(),
  /** Real duration of the audio file, measured from the decoded samples. */
  duration: z.number().positive(),
  /** Offset of this segment in the master narration track (seconds). */
  start: z.number().min(0),
  words: z.array(WordTimingSchema),
  alignment: z.enum(['provider-words', 'provider-chars', 'silence-anchored', 'proportional']),
});
export type NarrationSegment = z.infer<typeof NarrationSegmentSchema>;

export const NarrationManifestSchema = z.object({
  provider: z.string(),
  voice: z.string(),
  sampleRate: z.number(),
  speed: z.number(),
  segments: z.array(NarrationSegmentSchema),
  totalDuration: z.number(),
  masterFile: z.string(),
});
export type NarrationManifest = z.infer<typeof NarrationManifestSchema>;

export const CaptionWordSchema = z.object({
  text: z.string(),
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(0),
  tone: z.enum(['normal', 'accent', 'danger']),
});
export type CaptionWord = z.infer<typeof CaptionWordSchema>;

export const CaptionCueSchema = z.object({
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(0),
  words: z.array(CaptionWordSchema).min(1),
});
export type CaptionCue = z.infer<typeof CaptionCueSchema>;

/* ------------------------------------------------------------------ */
/* Render plan (input props of the Remotion composition)               */
/* ------------------------------------------------------------------ */

export const PlannedSceneSchema = StoryboardSceneSchema.extend({
  index: z.number().int().min(0),
  startFrame: z.number().int().min(0),
  durationInFrames: z.number().int().min(1),
});
export type PlannedScene = z.infer<typeof PlannedSceneSchema>;

export const ThemeSchema = z.object({
  background: z.string(),
  foreground: z.string(),
  accent: z.string(),
  danger: z.string(),
  positive: z.string(),
  muted: z.string(),
});

export const VideoPlanSchema = z.object({
  version: z.literal(1),
  title: z.string(),
  language: z.enum(LANGUAGES),
  fps: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationInFrames: z.number().int().positive(),
  theme: ThemeSchema,
  brandName: z.string().optional(),
  characterId: z.string(),
  scenes: z.array(PlannedSceneSchema).min(1),
  captions: z.array(CaptionCueSchema),
  /** imageKey -> URL reachable by the renderer (local asset server). */
  images: z.record(z.string(), z.string()),
});
export type VideoPlan = z.infer<typeof VideoPlanSchema>;

/* ------------------------------------------------------------------ */
/* Sound design                                                        */
/* ------------------------------------------------------------------ */

export const SfxEventSchema = z.object({ type: z.enum(SFX_TYPES), time: z.number().min(0), gain: z.number().min(0).max(2) });
export type SfxEvent = z.infer<typeof SfxEventSchema>;

export const AudioPlanSchema = z.object({
  narrationFile: z.string(),
  narrationDuration: z.number(),
  totalDuration: z.number(),
  music: z.object({ enabled: z.boolean(), file: z.string().optional(), volume: z.number() }),
  sfx: z.array(SfxEventSchema),
  sfxVolume: z.number(),
  narrationVolume: z.number(),
});
export type AudioPlan = z.infer<typeof AudioPlanSchema>;

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export const StageStateSchema = z.object({
  status: z.enum(['pending', 'running', 'done', 'failed', 'skipped']),
  attempts: z.number().int().min(0),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  error: z.string().optional(),
  detail: z.string().optional(),
});
export type StageState = z.infer<typeof StageStateSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  options: GenerationOptionsSchema,
  status: z.enum(PROJECT_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
  stages: z.record(z.enum(PIPELINE_STAGES), StageStateSchema),
  failedStage: z.enum(PIPELINE_STAGES).optional(),
  error: z.string().optional(),
  durationSec: z.number().optional(),
  fileSize: z.number().optional(),
  costUsd: z.number().default(0),
  costKnown: z.boolean().default(true),
  duplicatedFrom: z.string().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const LLM_PROVIDERS = ['offline', 'anthropic', 'openai'] as const;
export const IMAGE_PROVIDERS = ['vector', 'openai'] as const;
export const TTS_PROVIDERS = ['piper', 'elevenlabs', 'openai'] as const;
export const SECRET_KEYS = ['anthropicApiKey', 'openaiApiKey', 'elevenlabsApiKey'] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];

export const SettingsSchema = z.object({
  llmProvider: z.enum(LLM_PROVIDERS).default('offline'),
  llmModel: z.object({ anthropic: z.string(), openai: z.string() }).default({ anthropic: 'claude-opus-5-5', openai: 'gpt-5' }),
  imageProvider: z.enum(IMAGE_PROVIDERS).default('vector'),
  imageModel: z.string().default('gpt-image-1'),
  /** Max AI illustrations per video (cost guard). Vector assets are unlimited. */
  maxAiImagesPerVideo: z.number().int().min(0).max(8).default(2),
  ttsProvider: z.enum(TTS_PROVIDERS).default('piper'),
  voices: z
    .object({
      piper: z.record(z.string(), z.string()).default({}),
      elevenlabs: z.object({ male: z.string(), female: z.string() }).default({ male: '', female: '' }),
      openai: z.object({ male: z.string(), female: z.string() }).default({ male: 'onyx', female: 'nova' }),
    })
    .default({ piper: {}, elevenlabs: { male: '', female: '' }, openai: { male: 'onyx', female: 'nova' } }),
  elevenlabsModel: z.string().default('eleven_multilingual_v2'),
  openaiTtsModel: z.string().default('gpt-4o-mini-tts'),
  speakingSpeed: z.number().min(0.7).max(1.4).default(1.0),
  defaultDuration: z.enum(DURATION_OPTIONS).default('60'),
  defaultLanguage: z.enum(LANGUAGES).default('fr'),
  exportQuality: z.enum(EXPORT_QUALITIES).default('high'),
  outputFolder: z.string().default(''),
  musicEnabled: z.boolean().default(true),
  musicVolume: z.number().min(0).max(1).default(0.18),
  sfxVolume: z.number().min(0).max(1).default(0.55),
  narrationVolume: z.number().min(0).max(2).default(1.0),
  cacheEnabled: z.boolean().default(true),
  cacheMaxMb: z.number().int().min(100).max(100000).default(2048),
  maxRetries: z.number().int().min(0).max(5).default(2),
  renderConcurrency: z.number().int().min(1).max(16).default(2),
  ffmpegPath: z.string().default(''),
  browserExecutable: z.string().default(''),
  brand: z
    .object({ name: z.string().max(40), accent: z.string(), danger: z.string() })
    .default({ name: '', accent: '#00E5FF', danger: '#FF453A' }),
  /** User-editable pricing (USD). 0 = unknown -> cost shown as "unknown" rather than invented. */
  pricing: z
    .object({
      anthropicInputPerMTok: z.number().min(0),
      anthropicOutputPerMTok: z.number().min(0),
      openaiInputPerMTok: z.number().min(0),
      openaiOutputPerMTok: z.number().min(0),
      openaiImagePerImage: z.number().min(0),
      openaiTtsPerMChar: z.number().min(0),
      elevenlabsPerMChar: z.number().min(0),
    })
    .default({
      anthropicInputPerMTok: 4,
      anthropicOutputPerMTok: 20,
      openaiInputPerMTok: 0,
      openaiOutputPerMTok: 0,
      openaiImagePerImage: 0,
      openaiTtsPerMChar: 0,
      elevenlabsPerMChar: 0,
    }),
});
export type Settings = z.infer<typeof SettingsSchema>;

/** What the renderer process is allowed to see about secrets. */
export type SecretStatus = Record<SecretKey, boolean>;
