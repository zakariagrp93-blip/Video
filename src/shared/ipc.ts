import type { Language, PipelineStage } from './constants';
import type { GenerationOptions, NarrationManifest, Project, Script, SecretKey, SecretStatus, Settings, Storyboard } from './schemas';

export interface ProjectSummaryDTO {
  id: string;
  title: string;
  topic: string;
  status: Project['status'];
  language: string;
  createdAt: string;
  updatedAt: string;
  durationSec: number | null;
  fileSize: number | null;
  failedStage: string | null;
  error: string | null;
  costUsd: number;
  costKnown: boolean;
  hasVideo: boolean;
  hasThumbnail: boolean;
}

export interface ProgressDTO {
  projectId: string;
  status: Project['status'];
  stage: PipelineStage | null;
  stageIndex: number;
  stageProgress: number;
  overall: number;
  message: string;
  scene?: { index: number; total: number };
  etaSec: number | null;
  error?: { stage: PipelineStage; message: string; retryable: boolean };
  warnings?: string[];
}

export interface DashboardDTO {
  totalVideos: number;
  completed: number;
  failed: number;
  running: number;
  storageBytes: number;
  cache: { entries: number; bytes: number; hits: number };
  totalCostUsd: number;
  unknownCostRequests: number;
  recent: ProjectSummaryDTO[];
  failedProjects: ProjectSummaryDTO[];
  history: Array<{ projectId: string; kind: string; stage: string | null; message: string | null; at: string; title: string | null }>;
}

export interface ProjectDetailDTO {
  project: Project;
  script?: Script;
  storyboard?: Storyboard;
  narration?: NarrationManifest;
  srt?: string;
  cost: { usd: number; known: boolean; requests: number; cachedHits: number };
  requests: Array<Record<string, unknown>>;
  progress?: ProgressDTO;
  busy: boolean;
  folder: string;
}

export interface ConnectionTestDTO {
  ok: boolean;
  message: string;
}

export interface VoiceDTO {
  id: string;
  label: string;
  language: Language;
  gender: 'male' | 'female' | 'unspecified';
  installed?: boolean;
  /** ElevenLabs voice category ("premade" voices work on free plans). */
  category?: string;
  sizeMb?: number;
}

export interface SystemInfoDTO {
  appVersion: string;
  electron: string;
  node: string;
  platform: string;
  ffmpeg: string;
  ffmpegOk: boolean;
  remotionBundle: boolean;
  dataDir: string;
  secureStorage: boolean;
}

export interface ProviderInfoDTO {
  llm: { id: string; label: string; local: boolean; ready: string | null };
  image: { id: string; label: string; local: boolean; ready: string | null };
  tts: { id: string; label: string; local: boolean; ready: string | null };
}

/** The complete API exposed to the renderer by the preload script. */
export interface FvsApi {
  dashboard(): Promise<DashboardDTO>;
  listProjects(): Promise<ProjectSummaryDTO[]>;
  getProject(id: string): Promise<ProjectDetailDTO>;
  preflight(options: GenerationOptions): Promise<string[]>;
  providerInfo(options?: GenerationOptions): Promise<ProviderInfoDTO>;
  generate(options: GenerationOptions): Promise<{ projectId: string }>;
  retry(id: string): Promise<void>;
  regenerate(id: string, fromStage: PipelineStage): Promise<void>;
  cancel(id: string): Promise<boolean>;
  duplicate(id: string): Promise<{ projectId: string }>;
  deleteProject(id: string): Promise<void>;
  openFileLocation(id: string): Promise<void>;
  openInSystemPlayer(id: string): Promise<void>;
  exportCopy(id: string): Promise<string | null>;
  getSettings(): Promise<{ settings: Settings; secrets: SecretStatus }>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  setSecret(key: SecretKey, value: string | null): Promise<SecretStatus>;
  testProvider(kind: 'llm' | 'image' | 'tts', id: string): Promise<ConnectionTestDTO>;
  listVoices(provider: Settings['ttsProvider'], language: Language): Promise<VoiceDTO[]>;
  installVoice(voiceId: string): Promise<void>;
  chooseFolder(): Promise<string | null>;
  chooseFile(): Promise<string | null>;
  clearCache(): Promise<void>;
  systemInfo(): Promise<SystemInfoDTO>;
  customIcons(): Promise<{ dir: string; found: string[]; expected: string[] }>;
  openCustomIconsFolder(): Promise<void>;
  queueState(): Promise<{ running: string | null; queued: string[]; last: ProgressDTO[] }>;
  onProgress(cb: (e: ProgressDTO) => void): () => void;
  onVoiceDownload(cb: (e: { voiceId: string; fraction: number; done?: boolean; error?: string }) => void): () => void;
}

export const IPC = {
  invoke: 'fvs:invoke',
  progress: 'fvs:progress',
  voiceDownload: 'fvs:voice-download',
} as const;

export type FvsMethod = Exclude<keyof FvsApi, 'onProgress' | 'onVoiceDownload'>;

export function mediaUrl(projectId: string, file: 'final.mp4' | 'thumbnail.jpg', bust?: string): string {
  return `fvs-media://project/${encodeURIComponent(projectId)}/${file}${bust ? `?v=${encodeURIComponent(bust)}` : ''}`;
}
