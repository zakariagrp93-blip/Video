import fsp from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { LANGUAGES, PIPELINE_STAGES } from '../src/shared/constants';
import type { DashboardDTO, FvsApi, ProjectDetailDTO, ProviderInfoDTO, SystemInfoDTO } from '../src/shared/ipc';
import { GenerationOptionsSchema, SECRET_KEYS, SettingsSchema, TTS_PROVIDERS, type GenerationOptions } from '../src/shared/schemas';
import { projectPaths } from '../src/core/projects/projectStore';
import { PiperTTSProvider } from '../src/core/providers/tts/piper/piperTts';
import type { Studio } from '../src/core/studio';
import { exists, sanitizeFileName } from '../src/core/util/fsx';

/** Host-specific operations (dialogs, shell) injected by the Electron main process. */
export interface HostServices {
  openPath(p: string): Promise<void>;
  showItemInFolder(p: string): void;
  saveFileDialog(defaultName: string): Promise<string | null>;
  chooseFolder(): Promise<string | null>;
  chooseFile(): Promise<string | null>;
  appVersion: string;
  versions: { electron: string; node: string };
  secureStorage: boolean;
  emitVoiceDownload(e: { voiceId: string; fraction: number; done?: boolean; error?: string }): void;
}

const id = z.string().regex(/^[a-z0-9-]+$/i).max(64);
const SettingsPatch = SettingsSchema.partial();

/**
 * All renderer-callable operations. Every argument is validated with zod: the
 * renderer is treated as untrusted input.
 */
export function createHandlers(studio: Studio, host: HostServices): Omit<FvsApi, 'onProgress' | 'onVoiceDownload'> {
  const providerInfo = (options?: GenerationOptions): ProviderInfoDTO => {
    const llm = studio.providers.currentLlm();
    const image = studio.providers.currentImage();
    const tts = studio.providers.currentTts();
    return {
      llm: { id: llm.id, label: llm.label, local: llm.isLocal, ready: llm.checkReady(options) },
      image: { id: image.id, label: image.label, local: image.isLocal, ready: image.checkReady() },
      tts: { id: tts.id, label: tts.label, local: tts.isLocal, ready: tts.checkReady(options?.language ?? studio.settings.get().defaultLanguage) },
    };
  };

  return {
    async dashboard(): Promise<DashboardDTO> {
      const stats = await studio.dashboard();
      const list = await studio.projects.list();
      return {
        ...stats,
        recent: list.slice(0, 6),
        failedProjects: list.filter((p) => p.status === 'failed' || p.status === 'cancelled').slice(0, 6),
        history: studio.projects.history(40),
      };
    },
    listProjects: () => studio.projects.list(),
    async getProject(raw): Promise<ProjectDetailDTO> {
      const pid = id.parse(raw);
      const project = await studio.projects.get(pid);
      const artifacts = await studio.pipeline.readArtifacts(pid);
      return {
        project,
        ...artifacts,
        cost: studio.cost.projectCost(pid),
        requests: studio.cost.requestsFor(pid),
        progress: studio.queue.lastProgress(pid),
        busy: studio.queue.isBusy(pid),
        folder: studio.projects.dirFor(pid),
      };
    },
    async preflight(raw) {
      const parsed = GenerationOptionsSchema.safeParse(raw);
      if (!parsed.success) return parsed.error.issues.map((i) => i.message);
      const info = providerInfo(parsed.data);
      return [info.llm.ready, info.image.ready, info.tts.ready].filter((x): x is string => !!x);
    },
    async providerInfo(raw) {
      const parsed = raw ? GenerationOptionsSchema.safeParse(raw) : null;
      return providerInfo(parsed?.success ? parsed.data : undefined);
    },
    async generate(raw) {
      const options = GenerationOptionsSchema.parse(raw);
      const project = await studio.projects.create(options);
      await studio.queue.enqueue(project.id);
      return { projectId: project.id };
    },
    async retry(raw) {
      const pid = id.parse(raw);
      await studio.queue.enqueue(pid);
    },
    async regenerate(rawId, rawStage) {
      const pid = id.parse(rawId);
      const stage = z.enum(PIPELINE_STAGES).parse(rawStage);
      if (studio.queue.isBusy(pid)) throw new Error('This project is currently generating.');
      await studio.pipeline.resetFrom(pid, stage);
      await studio.queue.enqueue(pid);
    },
    cancel: (raw) => studio.queue.cancel(id.parse(raw)),
    async duplicate(raw) {
      const copy = await studio.projects.duplicate(id.parse(raw));
      return { projectId: copy.id };
    },
    async deleteProject(raw) {
      const pid = id.parse(raw);
      if (studio.queue.isBusy(pid)) await studio.queue.cancel(pid);
      await studio.projects.delete(pid);
    },
    async openFileLocation(raw) {
      const p = projectPaths(studio.projects.dirFor(id.parse(raw)));
      if (await exists(p.finalMp4)) host.showItemInFolder(p.finalMp4);
      else await host.openPath(p.root);
    },
    async openInSystemPlayer(raw) {
      const p = projectPaths(studio.projects.dirFor(id.parse(raw)));
      if (!(await exists(p.finalMp4))) throw new Error('This project has no exported video yet.');
      await host.openPath(p.finalMp4);
    },
    async exportCopy(raw) {
      const pid = id.parse(raw);
      const project = await studio.projects.get(pid);
      const p = projectPaths(studio.projects.dirFor(pid));
      if (!(await exists(p.finalMp4))) throw new Error('This project has no exported video yet.');
      const dest = await host.saveFileDialog(`${sanitizeFileName(project.title)}.mp4`);
      if (!dest) return null;
      await fsp.copyFile(p.finalMp4, dest);
      return dest;
    },
    async getSettings() {
      return { settings: studio.settings.get(), secrets: studio.secrets.status() };
    },
    updateSettings: (raw) => studio.settings.update(SettingsPatch.parse(raw)),
    async setSecret(rawKey, rawValue) {
      const key = z.enum(SECRET_KEYS).parse(rawKey);
      const value = z.string().max(400).nullable().parse(rawValue);
      await studio.secrets.set(key, value);
      return studio.secrets.status();
    },
    async testProvider(rawKind, rawId) {
      const kind = z.enum(['llm', 'image', 'tts']).parse(rawKind);
      const ctx = studio.providerContext(undefined);
      const registry = studio.providers[kind] as Record<string, { testConnection(c: typeof ctx): Promise<{ ok: boolean; message: string }> }>;
      const provider = registry[z.string().parse(rawId)];
      if (!provider) return { ok: false, message: 'Unknown provider.' };
      try {
        return await provider.testConnection(ctx);
      } catch (err) {
        return { ok: false, message: (err as Error).message };
      }
    },
    async listVoices(rawProvider, rawLang) {
      const provider = z.enum(TTS_PROVIDERS).parse(rawProvider);
      const language = z.enum(LANGUAGES).parse(rawLang);
      return studio.providers.tts[provider].listVoices(language);
    },
    async installVoice(raw) {
      const voiceId = z.string().max(64).parse(raw);
      const piper = studio.providers.tts.piper as PiperTTSProvider;
      const voice = (await piper.listVoices()).find((v) => v.id === voiceId);
      if (!voice) throw new Error('Unknown voice');
      try {
        await piper.prepareVoice(voice, studio.providerContext(undefined), (fraction) => host.emitVoiceDownload({ voiceId, fraction }));
        host.emitVoiceDownload({ voiceId, fraction: 1, done: true });
      } catch (err) {
        host.emitVoiceDownload({ voiceId, fraction: 0, error: (err as Error).message });
        throw err;
      }
    },
    chooseFolder: () => host.chooseFolder(),
    chooseFile: () => host.chooseFile(),
    clearCache: () => studio.cache.clear(),
    async systemInfo(): Promise<SystemInfoDTO> {
      const ff = studio.ffmpeg();
      let ffmpeg = 'not found';
      let ffmpegOk = false;
      try {
        ffmpeg = await ff.version();
        ffmpegOk = true;
      } catch (err) {
        ffmpeg = (err as Error).message;
      }
      return {
        appVersion: host.appVersion,
        electron: host.versions.electron,
        node: host.versions.node,
        platform: `${process.platform} ${process.arch}`,
        ffmpeg,
        ffmpegOk,
        remotionBundle: await exists(path.join(studio.paths.remotionBundle, 'index.html')),
        dataDir: studio.paths.dataDir,
        secureStorage: host.secureStorage,
      };
    },
    async queueState() {
      return studio.queue.snapshot();
    },
  };
}
