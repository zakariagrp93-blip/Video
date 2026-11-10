import type { ProjectStore } from '../projects/projectStore';
import { createLogger } from '../util/logger';
import type { GenerationPipeline } from './pipeline';
import type { ProgressEvent } from './progress';

const log = createLogger('queue');

/**
 * Sequential generation queue (one video renders at a time to keep memory and
 * CPU predictable). Supports cancellation of the running job and queued jobs.
 */
export class GenerationQueue {
  private pending: string[] = [];
  private running: { id: string; controller: AbortController } | null = null;
  private listeners = new Set<(e: ProgressEvent) => void>();
  private lastEvent = new Map<string, ProgressEvent>();
  private idleResolvers: Array<() => void> = [];

  constructor(
    private readonly pipeline: GenerationPipeline,
    private readonly projects: ProjectStore,
  ) {}

  onProgress(fn: (e: ProgressEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: ProgressEvent): void {
    this.lastEvent.set(e.projectId, e);
    for (const l of this.listeners) {
      try {
        l(e);
      } catch (err) {
        log.error('progress listener failed', err);
      }
    }
  }

  snapshot(): { running: string | null; queued: string[]; last: ProgressEvent[] } {
    return { running: this.running?.id ?? null, queued: [...this.pending], last: [...this.lastEvent.values()] };
  }

  lastProgress(projectId: string): ProgressEvent | undefined {
    return this.lastEvent.get(projectId);
  }

  async enqueue(projectId: string): Promise<void> {
    if (this.running?.id === projectId || this.pending.includes(projectId)) return;
    const project = await this.projects.get(projectId);
    project.status = 'queued';
    await this.projects.save(project);
    this.pending.push(projectId);
    this.emit({ projectId, status: 'queued', stage: null, stageIndex: -1, stageProgress: 0, overall: 0, message: this.running ? 'Waiting in queue…' : 'Starting…', etaSec: null });
    void this.pump();
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    const next = this.pending.shift();
    if (!next) {
      this.idleResolvers.splice(0).forEach((r) => r());
      return;
    }
    const controller = new AbortController();
    this.running = { id: next, controller };
    try {
      await this.pipeline.run(next, { signal: controller.signal, onProgress: (e) => this.emit(e) });
    } catch (err) {
      log.error('pipeline crashed', err);
    } finally {
      this.running = null;
      void this.pump();
    }
  }

  async cancel(projectId: string): Promise<boolean> {
    if (this.running?.id === projectId) {
      this.running.controller.abort();
      return true;
    }
    const idx = this.pending.indexOf(projectId);
    if (idx >= 0) {
      this.pending.splice(idx, 1);
      const project = await this.projects.get(projectId);
      project.status = 'cancelled';
      project.error = 'Removed from the queue.';
      await this.projects.save(project);
      this.emit({ projectId, status: 'cancelled', stage: null, stageIndex: -1, stageProgress: 0, overall: 0, message: 'Removed from queue', etaSec: null });
      return true;
    }
    return false;
  }

  cancelAll(): void {
    this.pending = [];
    this.running?.controller.abort();
  }

  isBusy(projectId: string): boolean {
    return this.running?.id === projectId || this.pending.includes(projectId);
  }

  /** Resolves when the queue has nothing left to run. */
  whenIdle(): Promise<void> {
    if (!this.running && this.pending.length === 0) return Promise.resolve();
    return new Promise((r) => this.idleResolvers.push(r));
  }
}
