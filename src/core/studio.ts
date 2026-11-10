import fs from 'node:fs';
import path from 'node:path';
import type { Project } from '../shared/schemas';
import { AssetCache } from './assets/assetCache';
import { CharacterLibrary } from './characters/characterLibrary';
import { CostTracker } from './cost/costTracker';
import { AppDatabase } from './db/database';
import { FFmpeg, resolveMediaBinaries } from './media/ffmpeg';
import { GenerationPipeline } from './pipeline/pipeline';
import { GenerationQueue } from './pipeline/queue';
import { ProjectStore } from './projects/projectStore';
import { ProviderRegistry } from './providers/registry';
import type { ProviderContext } from './providers/types';
import { bundleHashOf, type RenderEnvironment } from './render/renderer';
import { SecretStore, SettingsStore, type SecretCipher } from './settings/settingsStore';
import { ensureDir } from './util/fsx';
import { createLogger, setLogFile, type Logger } from './util/logger';

export interface StudioPaths {
  dataDir: string;
  projectsDir: string;
  cacheDir: string;
  voicesDir: string;
  charactersDir: string;
  logsDir: string;
  /** Pre-built Remotion bundle (folder containing index.html). */
  remotionBundle: string;
}

export function defaultPaths(dataDir: string, remotionBundle: string): StudioPaths {
  return {
    dataDir,
    projectsDir: path.join(dataDir, 'projects'),
    cacheDir: path.join(dataDir, 'cache'),
    voicesDir: path.join(dataDir, 'voices'),
    charactersDir: path.join(dataDir, 'characters'),
    logsDir: path.join(dataDir, 'logs'),
    remotionBundle,
  };
}

export interface StudioOptions {
  paths: StudioPaths;
  cipher: SecretCipher;
  /** Persist settings, secrets and the database to disk (false for tests). */
  persist?: boolean;
}

/** Composition root: wires storage, providers, pipeline and queue together. */
export class Studio {
  readonly log: Logger = createLogger('studio');
  readonly queue: GenerationQueue;
  readonly pipeline: GenerationPipeline;

  private constructor(
    readonly paths: StudioPaths,
    readonly db: AppDatabase,
    readonly settings: SettingsStore,
    readonly secrets: SecretStore,
    readonly projects: ProjectStore,
    readonly cache: AssetCache,
    readonly cost: CostTracker,
    readonly providers: ProviderRegistry,
    readonly characters: CharacterLibrary,
  ) {
    this.pipeline = new GenerationPipeline(this);
    this.queue = new GenerationQueue(this.pipeline, this.projects);
  }

  static async create(opts: StudioOptions): Promise<Studio> {
    const { paths } = opts;
    const persist = opts.persist ?? true;
    for (const d of [paths.dataDir, paths.projectsDir, paths.cacheDir, paths.voicesDir, paths.charactersDir, paths.logsDir]) await ensureDir(d);
    if (persist) setLogFile(path.join(paths.logsDir, 'studio.log'));
    const db = await AppDatabase.open(persist ? path.join(paths.dataDir, 'studio.sqlite') : null);
    const settings = new SettingsStore(persist ? path.join(paths.dataDir, 'settings.json') : null);
    const secrets = new SecretStore(persist ? path.join(paths.dataDir, 'secrets.json') : null, opts.cipher);
    const projects = new ProjectStore(paths.projectsDir, db);
    const cache = new AssetCache(paths.cacheDir, db, () => settings.get().cacheEnabled, () => settings.get().cacheMaxMb * 1024 * 1024);
    const cost = new CostTracker(db, () => settings.get().pricing);
    const providers = new ProviderRegistry(() => settings.get(), secrets, paths.voicesDir);
    const characters = new CharacterLibrary(paths.charactersDir);
    const studio = new Studio(paths, db, settings, secrets, projects, cache, cost, providers, characters);
    await projects.reindex();
    await studio.recoverInterrupted();
    return studio;
  }

  /** Projects left "running"/"queued" by a crash or forced quit become resumable failures. */
  private async recoverInterrupted(): Promise<void> {
    for (const p of await this.projects.list()) {
      if (p.status === 'running' || p.status === 'queued') {
        const project = await this.projects.get(p.id);
        const running = Object.entries(project.stages).find(([, s]) => s.status === 'running');
        if (running) project.stages[running[0] as keyof Project['stages']] = { ...running[1], status: 'failed', error: 'Interrupted (application closed).' };
        project.status = 'failed';
        project.error = 'Generation was interrupted. Click Retry to resume from where it stopped.';
        project.failedStage = (running?.[0] as Project['failedStage']) ?? project.failedStage;
        await this.projects.save(project);
      }
    }
  }

  ffmpeg(): FFmpeg {
    return new FFmpeg(resolveMediaBinaries(this.settings.get().ffmpegPath));
  }

  renderEnv(): RenderEnvironment {
    const s = this.settings.get();
    const bundle = this.paths.remotionBundle;
    if (!fs.existsSync(path.join(bundle, 'index.html'))) {
      throw new Error(`Remotion bundle not found at ${bundle}. Run "npm run build:remotion".`);
    }
    return {
      serveUrl: bundle,
      browserExecutable: s.browserExecutable || process.env.FVS_BROWSER || null,
      binariesDirectory: process.env.FVS_REMOTION_BINARIES || null,
      concurrency: s.renderConcurrency,
      quality: s.exportQuality,
      ffmpeg: this.ffmpeg(),
      bundleHash: bundleHashOf(bundle),
    };
  }

  providerContext(projectId: string | undefined, signal?: AbortSignal): ProviderContext {
    return {
      signal,
      projectId,
      cache: this.cache,
      log: createLogger(projectId ? `project:${projectId}` : 'providers'),
      usage: (rec) => {
        this.cost.record({ ...rec, projectId });
      },
    };
  }

  async dashboard(): Promise<{
    totalVideos: number;
    completed: number;
    failed: number;
    running: number;
    storageBytes: number;
    cache: { entries: number; bytes: number; hits: number };
    totalCostUsd: number;
    unknownCostRequests: number;
  }> {
    const list = await this.projects.list();
    const totals = this.cost.totals();
    return {
      totalVideos: list.filter((p) => p.status === 'completed').length,
      completed: list.filter((p) => p.status === 'completed').length,
      failed: list.filter((p) => p.status === 'failed').length,
      running: list.filter((p) => p.status === 'running' || p.status === 'queued').length,
      storageBytes: (await this.projects.storageUsed()) + this.cache.stats().bytes,
      cache: this.cache.stats(),
      totalCostUsd: totals.usd,
      unknownCostRequests: totals.unknownCount,
    };
  }

  async close(): Promise<void> {
    this.queue.cancelAll();
    await this.db.close();
  }
}
