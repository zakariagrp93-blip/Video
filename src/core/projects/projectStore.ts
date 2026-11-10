import fsp from 'node:fs/promises';
import path from 'node:path';
import { PIPELINE_STAGES, type PipelineStage, type ProjectStatus } from '../../shared/constants';
import { ProjectSchema, type GenerationOptions, type Project, type StageState } from '../../shared/schemas';
import type { AppDatabase } from '../db/database';
import { copyDir, dirSize, ensureDir, exists, readJson, safeJoin, writeJson } from '../util/fsx';
import { newId } from '../util/hash';

export interface ProjectPaths {
  root: string;
  projectJson: string;
  scriptJson: string;
  storyboardJson: string;
  audioDir: string;
  charactersDir: string;
  illustrationsDir: string;
  subtitlesDir: string;
  scenesDir: string;
  renderDir: string;
  finalMp4: string;
  thumbnail: string;
}

export function projectPaths(root: string): ProjectPaths {
  return {
    root,
    projectJson: safeJoin(root, 'project.json'),
    scriptJson: safeJoin(root, 'script.json'),
    storyboardJson: safeJoin(root, 'storyboard.json'),
    audioDir: safeJoin(root, 'audio'),
    charactersDir: safeJoin(root, 'characters'),
    illustrationsDir: safeJoin(root, 'illustrations'),
    subtitlesDir: safeJoin(root, 'subtitles'),
    scenesDir: safeJoin(root, 'scenes'),
    renderDir: safeJoin(root, 'render'),
    finalMp4: safeJoin(root, 'final.mp4'),
    thumbnail: safeJoin(root, 'thumbnail.jpg'),
  };
}

export interface ProjectSummary {
  id: string;
  title: string;
  topic: string;
  status: ProjectStatus;
  language: string;
  createdAt: string;
  updatedAt: string;
  durationSec: number | null;
  fileSize: number | null;
  projectDir: string;
  failedStage: string | null;
  error: string | null;
  costUsd: number;
  costKnown: boolean;
  hasVideo: boolean;
  hasThumbnail: boolean;
}

function emptyStages(): Record<PipelineStage, StageState> {
  return Object.fromEntries(PIPELINE_STAGES.map((s) => [s, { status: 'pending', attempts: 0 }])) as Record<
    PipelineStage,
    StageState
  >;
}

/** Stores project folders on disk (source of truth for assets) and indexes them in SQLite. */
export class ProjectStore {
  constructor(
    private readonly projectsDir: string,
    private readonly db: AppDatabase,
  ) {}

  dirFor(id: string): string {
    if (!/^[a-z0-9-]+$/i.test(id)) throw new Error(`Invalid project id: ${id}`);
    return safeJoin(this.projectsDir, id);
  }

  paths(id: string): ProjectPaths {
    return projectPaths(this.dirFor(id));
  }

  async create(options: GenerationOptions, title?: string): Promise<Project> {
    const id = newId('p');
    const now = new Date().toISOString();
    const project: Project = ProjectSchema.parse({
      id,
      title: title ?? options.topic.slice(0, 120),
      options,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      stages: emptyStages(),
      costUsd: 0,
      costKnown: true,
    });
    const p = this.paths(id);
    for (const d of [p.root, p.audioDir, p.charactersDir, p.illustrationsDir, p.subtitlesDir, p.scenesDir, p.renderDir]) {
      await ensureDir(d);
    }
    await this.save(project);
    this.event(id, 'created', undefined, options.topic);
    return project;
  }

  async get(id: string): Promise<Project> {
    const raw = await readJson(this.paths(id).projectJson);
    return ProjectSchema.parse(raw);
  }

  async save(project: Project): Promise<Project> {
    project.updatedAt = new Date().toISOString();
    const valid = ProjectSchema.parse(project);
    await writeJson(this.paths(valid.id).projectJson, valid);
    this.db.run(
      `INSERT INTO projects (id, title, topic, status, language, created_at, updated_at, duration_sec, file_size, project_dir, failed_stage, error, cost_usd, cost_known)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title=excluded.title, status=excluded.status, updated_at=excluded.updated_at,
         duration_sec=excluded.duration_sec, file_size=excluded.file_size, failed_stage=excluded.failed_stage,
         error=excluded.error, cost_usd=excluded.cost_usd, cost_known=excluded.cost_known`,
      [
        valid.id,
        valid.title,
        valid.options.topic,
        valid.status,
        valid.options.language,
        valid.createdAt,
        valid.updatedAt,
        valid.durationSec ?? null,
        valid.fileSize ?? null,
        this.dirFor(valid.id),
        valid.failedStage ?? null,
        valid.error ?? null,
        valid.costUsd,
        valid.costKnown ? 1 : 0,
      ],
    );
    return valid;
  }

  async setStage(id: string, stage: PipelineStage, patch: Partial<StageState>): Promise<Project> {
    const project = await this.get(id);
    project.stages[stage] = { ...project.stages[stage], ...patch } as StageState;
    return this.save(project);
  }

  async list(): Promise<ProjectSummary[]> {
    const rows = this.db.all<Record<string, unknown>>('SELECT * FROM projects ORDER BY created_at DESC');
    const out: ProjectSummary[] = [];
    for (const r of rows) {
      const dir = String(r.project_dir);
      out.push({
        id: String(r.id),
        title: String(r.title),
        topic: String(r.topic),
        status: r.status as ProjectStatus,
        language: String(r.language),
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
        durationSec: (r.duration_sec as number | null) ?? null,
        fileSize: (r.file_size as number | null) ?? null,
        projectDir: dir,
        failedStage: (r.failed_stage as string | null) ?? null,
        error: (r.error as string | null) ?? null,
        costUsd: Number(r.cost_usd ?? 0),
        costKnown: Number(r.cost_known ?? 1) === 1,
        hasVideo: await exists(path.join(dir, 'final.mp4')),
        hasThumbnail: await exists(path.join(dir, 'thumbnail.jpg')),
      });
    }
    return out;
  }

  /** Re-index project folders that exist on disk but not in the DB (e.g. after DB loss). */
  async reindex(): Promise<number> {
    await ensureDir(this.projectsDir);
    const known = new Set(this.db.all<{ id: string }>('SELECT id FROM projects').map((r) => r.id));
    let added = 0;
    for (const entry of await fsp.readdir(this.projectsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || known.has(entry.name)) continue;
      try {
        const project = await this.get(entry.name);
        await this.save(project);
        added += 1;
      } catch {
        /* not a project folder */
      }
    }
    return added;
  }

  async delete(id: string): Promise<void> {
    await fsp.rm(this.dirFor(id), { recursive: true, force: true });
    this.db.run('DELETE FROM projects WHERE id = ?', [id]);
    this.db.run('DELETE FROM generation_events WHERE project_id = ?', [id]);
  }

  /** Copy a project with all of its assets; the copy can be re-rendered without new API calls. */
  async duplicate(id: string): Promise<Project> {
    const source = await this.get(id);
    const copyId = newId('p');
    await copyDir(this.dirFor(id), this.dirFor(copyId));
    const now = new Date().toISOString();
    const copy: Project = {
      ...source,
      id: copyId,
      title: `${source.title} (copy)`,
      createdAt: now,
      updatedAt: now,
      duplicatedFrom: id,
      costUsd: 0,
    };
    if (copy.status === 'running' || copy.status === 'queued') copy.status = 'draft';
    await this.save(copy);
    this.event(copyId, 'duplicated', undefined, `from ${id}`);
    return copy;
  }

  event(projectId: string, kind: string, stage?: string, message?: string): void {
    this.db.run('INSERT INTO generation_events (project_id, kind, stage, message, at) VALUES (?, ?, ?, ?, ?)', [
      projectId,
      kind,
      stage ?? null,
      message ?? null,
      new Date().toISOString(),
    ]);
  }

  history(limit = 100): Array<{ projectId: string; kind: string; stage: string | null; message: string | null; at: string; title: string | null }> {
    return this.db
      .all<Record<string, unknown>>(
        `SELECT e.project_id, e.kind, e.stage, e.message, e.at, p.title FROM generation_events e
         LEFT JOIN projects p ON p.id = e.project_id ORDER BY e.id DESC LIMIT ?`,
        [limit],
      )
      .map((r) => ({
        projectId: String(r.project_id),
        kind: String(r.kind),
        stage: (r.stage as string | null) ?? null,
        message: (r.message as string | null) ?? null,
        at: String(r.at),
        title: (r.title as string | null) ?? null,
      }));
  }

  async storageUsed(): Promise<number> {
    return dirSize(this.projectsDir);
  }
}
