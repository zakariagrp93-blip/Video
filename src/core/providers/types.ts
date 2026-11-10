import type { Language, NarratorOption } from '../../shared/constants';
import type { GenerationOptions, Script, Storyboard, WordTiming } from '../../shared/schemas';
import type { AssetCache } from '../assets/assetCache';
import type { UsageRecord } from '../cost/costTracker';
import type { Logger } from '../util/logger';

export interface ProviderContext {
  signal?: AbortSignal;
  projectId?: string;
  cache: AssetCache;
  log: Logger;
  /** Record a billable (or cached) provider request for cost tracking. */
  usage(rec: Omit<UsageRecord, 'projectId'>): void;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

export interface ScriptRequest {
  options: GenerationOptions;
  /** Target narration length in seconds (resolved from the duration option). */
  targetSeconds: number;
  /** Target spoken word range for that length. */
  wordRange: [number, number];
}

export interface SceneReview {
  ok: boolean;
  issues: string[];
}

/* ------------------------------------------------------------------ */

export interface LLMProvider {
  readonly id: string;
  readonly label: string;
  readonly model: string;
  readonly isLocal: boolean;
  /** Returns an explanation if the provider cannot be used (missing key, unsupported language…), else null. */
  checkReady(options?: GenerationOptions): string | null;
  testConnection(ctx: ProviderContext): Promise<ConnectionTestResult>;
  generateScript(req: ScriptRequest, ctx: ProviderContext, feedback?: string[]): Promise<Script>;
  generateStoryboard(script: Script, req: ScriptRequest, ctx: ProviderContext, feedback?: string[]): Promise<Storyboard>;
  /** Reviews scene data for continuity/consistency problems that schema validation cannot catch. */
  validateScenes(storyboard: Storyboard, ctx: ProviderContext): Promise<SceneReview>;
}

/* ------------------------------------------------------------------ */

export interface IllustrationRequest {
  key: string;
  prompt: string;
  /** Path to a reference image (character sheet) when the provider supports it. */
  referenceFile?: string;
  transparent?: boolean;
}

export interface GeneratedImage {
  /** PNG bytes. */
  data: Buffer;
  cached: boolean;
}

export interface ImageProvider {
  readonly id: string;
  readonly label: string;
  readonly isLocal: boolean;
  readonly supportsReferences: boolean;
  checkReady(): string | null;
  testConnection(ctx: ProviderContext): Promise<ConnectionTestResult>;
  /** Vector provider returns null: the built-in SVG library renders the asset. */
  generateIllustration(req: IllustrationRequest, ctx: ProviderContext): Promise<GeneratedImage | null>;
  generateCharacter(req: IllustrationRequest, ctx: ProviderContext): Promise<GeneratedImage | null>;
  generateFromReference(req: IllustrationRequest & { referenceFile: string }, ctx: ProviderContext): Promise<GeneratedImage | null>;
}

/* ------------------------------------------------------------------ */

export interface VoiceInfo {
  id: string;
  label: string;
  language: Language;
  gender: 'male' | 'female' | 'unspecified';
  installed?: boolean;
  /** ElevenLabs voice category ("premade" voices work on free plans). */
  category?: string;
  sizeMb?: number;
}

export interface SynthesisRequest {
  /** Text sent to the engine (already normalized for speech). */
  text: string;
  language: Language;
  voiceId: string;
  speed: number;
}

export interface SynthesisResult {
  samples: Float32Array;
  sampleRate: number;
  /** Word timings relative to the start of this audio, if the provider returns them. */
  words?: WordTiming[];
  alignment: 'provider-words' | 'provider-chars' | 'none';
  cached: boolean;
}

export interface TTSProvider {
  readonly id: string;
  readonly label: string;
  readonly isLocal: boolean;
  checkReady(language: Language): string | null;
  testConnection(ctx: ProviderContext): Promise<ConnectionTestResult>;
  listVoices(language?: Language): Promise<VoiceInfo[]>;
  resolveVoice(language: Language, narrator: NarratorOption): Promise<VoiceInfo>;
  /** Make sure voice resources are available locally (download models, etc.). */
  prepareVoice?(voice: VoiceInfo, ctx: ProviderContext, onProgress?: (fraction: number) => void): Promise<void>;
  synthesize(req: SynthesisRequest, ctx: ProviderContext): Promise<SynthesisResult>;
}
