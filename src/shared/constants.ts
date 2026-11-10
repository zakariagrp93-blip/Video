/**
 * Shared vocabularies used by the script engine, the storyboard engine,
 * the Remotion compositions and the UI. Every value here has a concrete
 * implementation in the animation / asset libraries — nothing is decorative.
 */

export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;

export const LANGUAGES = ['fr', 'en', 'es', 'de'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
};

export const DURATION_OPTIONS = ['30', '45', '60', '90', 'auto'] as const;
export type DurationOption = (typeof DURATION_OPTIONS)[number];

export const NARRATOR_OPTIONS = ['male', 'female', 'auto'] as const;
export type NarratorOption = (typeof NARRATOR_OPTIONS)[number];

export const STORYTELLING_STYLES = ['educational', 'hypothetical', 'facts', 'storytelling', 'unexpected'] as const;
export type StorytellingStyle = (typeof STORYTELLING_STYLES)[number];

export const STORYTELLING_LABELS: Record<StorytellingStyle, string> = {
  educational: 'Educational',
  hypothetical: 'Hypothetical',
  facts: 'Financial facts',
  storytelling: 'Storytelling',
  unexpected: 'Unexpected scenario',
};

/** Content families. Each one has its own writer, art direction, music and captions. */
export const CATEGORIES = ['finance', 'motivation', 'stickfigure'] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  finance: 'Finance story (mascot)',
  motivation: 'Motivation edit (money, discipline, mindset)',
  stickfigure: 'Stick-figure explainer (Claude animates it)',
};

/** Music for motivation edits. */
export const EDIT_MUSIC_STYLES = ['auto', 'phonk', 'epic', 'piano'] as const;
export type EditMusicStyle = (typeof EDIT_MUSIC_STYLES)[number];
export const EDIT_MUSIC_LABELS: Record<EditMusicStyle, string> = {
  auto: 'Automatic',
  phonk: 'Dark phonk (808 + cowbell)',
  epic: 'Epic cinematic (drums + strings)',
  piano: 'Emotional piano',
};

/** Themes the motivation writer knows. */
export const MOTIVATION_THEMES = ['money', 'discipline', 'success', 'mindset'] as const;
export type MotivationTheme = (typeof MOTIVATION_THEMES)[number];

/**
 * Full-frame cinematic "shots" for motivation edits (original vector scenes in
 * src/remotion/edit/motifs.tsx). "spotlight" shows the scene's hero prop.
 */
export const MOTIFS = [
  'skyline',
  'road',
  'mountain',
  'stairs',
  'rain',
  'chess',
  'alarm',
  'spotlight',
  'sunrise',
  'gym',
  'crowd',
  'desk',
  'steps',
] as const;
export type Motif = (typeof MOTIFS)[number];

export const VISUAL_STYLES = ['minimal-finance', 'custom-brand', 'full-frame'] as const;
export type VisualStyle = (typeof VISUAL_STYLES)[number];

export const VISUAL_STYLE_LABELS: Record<VisualStyle, string> = {
  'minimal-finance': 'Finance Lite inspired (cinematic band)',
  'custom-brand': 'Custom brand style (cinematic band)',
  'full-frame': 'Full-frame (big mascot, karaoke captions)',
};

/** Mascot poses. Each one is a distinct, hand-built skeleton in the Mascot component. */
export const POSES = [
  'idle',
  'walking',
  'running',
  'sitting',
  'thinking',
  'surprised',
  'happy',
  'sad',
  'shocked',
  'pointing',
  'holding-money',
  'holding-phone',
  'explaining',
  'celebrating',
] as const;
export type Pose = (typeof POSES)[number];

export const EXPRESSIONS = [
  'neutral',
  'happy',
  'sad',
  'surprised',
  'shocked',
  'thinking',
  'worried',
  'excited',
  'smug',
  'determined',
] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export const CHARACTER_POSITIONS = ['left', 'center', 'right'] as const;
export type CharacterPosition = (typeof CHARACTER_POSITIONS)[number];

export const CHARACTER_MOTIONS = [
  'none',
  'enter-left',
  'enter-right',
  'exit-left',
  'exit-right',
  'walk-across',
  'jump',
  'bounce',
  'shiver',
  'lean-in',
] as const;
export type CharacterMotion = (typeof CHARACTER_MOTIONS)[number];

/** Vector illustration library (SVG components in src/remotion/props). */
export const PROP_ASSETS = [
  'banknote',
  'money-stack',
  'coin',
  'coin-stack',
  'money-bag',
  'bank',
  'house',
  'mansion',
  'car',
  'sports-car',
  'phone',
  'credit-card',
  'laptop',
  'chart-up',
  'chart-down',
  'clock',
  'building',
  'shop',
  'piggy-bank',
  'calendar',
  'gift',
  'wallet',
  'briefcase',
  'receipt',
  'plane',
  'diploma',
  'shopping-bag',
  'percent-badge',
  'lock',
  'hourglass',
  'coffee',
  'yacht',
  'question-mark',
  'exclamation',
  'trophy',
  'graduation-cap',
] as const;
export type PropAsset = (typeof PROP_ASSETS)[number];

export const PROP_ANIMATIONS = [
  'pop',
  'fade',
  'float',
  'fall',
  'slide-left',
  'slide-right',
  'rise',
  'grow',
  'shake',
  'spin',
  'pulse',
  'none',
] as const;
export type PropAnimation = (typeof PROP_ANIMATIONS)[number];

export const PROP_PLACEMENTS = [
  'left',
  'right',
  'top',
  'top-left',
  'top-right',
  'bottom',
  'center',
  'around',
  'hand',
] as const;
export type PropPlacement = (typeof PROP_PLACEMENTS)[number];

export const CAMERA_MOVES = ['static', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'push-in', 'shake', 'tilt'] as const;
export type CameraMove = (typeof CAMERA_MOVES)[number];

export const TRANSITIONS = ['cut', 'fade', 'slide-left', 'slide-up', 'zoom-through', 'wipe'] as const;
export type Transition = (typeof TRANSITIONS)[number];

export const BACKGROUNDS = ['black', 'vignette', 'spotlight', 'grid', 'floor', 'city', 'stars'] as const;
export type Background = (typeof BACKGROUNDS)[number];

export const EFFECTS = ['none', 'money-rain', 'coin-burst', 'sparkles', 'impact', 'confetti', 'smoke', 'speed-lines'] as const;
export type Effect = (typeof EFFECTS)[number];

export const SFX_TYPES = ['whoosh', 'pop', 'impact', 'coin', 'cash', 'tick', 'riser', 'ding', 'swoosh', 'fail', 'typing', 'heartbeat'] as const;
export type SfxType = (typeof SFX_TYPES)[number];

export const SFX_TIMINGS = ['start', 'middle', 'end'] as const;
export type SfxTiming = (typeof SFX_TIMINGS)[number];

export const TEXT_STYLES = ['headline', 'number', 'label', 'warning'] as const;
export type TextStyle = (typeof TEXT_STYLES)[number];

export const CHART_KINDS = ['line', 'bar'] as const;
export const CHART_TRENDS = ['up', 'down', 'volatile'] as const;

/** User-facing pipeline stages, in order. */
export const PIPELINE_STAGES = [
  'script',
  'storyboard',
  'illustrations',
  'voice',
  'animation',
  'subtitles',
  'render',
  'export',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  script: 'Writing script',
  storyboard: 'Building storyboard',
  illustrations: 'Generating illustrations',
  voice: 'Generating voice',
  animation: 'Creating animations',
  subtitles: 'Synchronizing subtitles',
  render: 'Rendering video',
  export: 'Exporting final MP4',
};

/** Relative weight of each stage in overall progress (rendering dominates wall-clock time). */
export const PIPELINE_STAGE_WEIGHTS: Record<PipelineStage, number> = {
  script: 4,
  storyboard: 3,
  illustrations: 4,
  voice: 12,
  animation: 4,
  subtitles: 2,
  render: 64,
  export: 7,
};

export const PROJECT_STATUSES = ['draft', 'queued', 'running', 'completed', 'failed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const EXPORT_QUALITIES = ['standard', 'high', 'max'] as const;
export type ExportQuality = (typeof EXPORT_QUALITIES)[number];

/** H.264 CRF per export quality (lower = better). */
export const QUALITY_CRF: Record<ExportQuality, number> = { standard: 23, high: 18, max: 15 };

/** Narration words-per-second calibration per language at speed 1.0 (used for script length targets only — real timing always comes from the audio). */
export const WORDS_PER_SECOND: Record<Language, number> = { fr: 2.6, en: 2.6, es: 2.7, de: 2.3 };

export const DEFAULT_THEME = {
  background: '#000000',
  foreground: '#FFFFFF',
  accent: '#FFD60A',
  danger: '#FF453A',
  positive: '#32D74B',
  muted: '#8E8E93',
};
export type Theme = typeof DEFAULT_THEME;
