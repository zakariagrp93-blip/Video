import fsp from 'node:fs/promises';
import path from 'node:path';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH, type PipelineStage } from '../../shared/constants';
import {
  AudioPlanSchema,
  GenerationOptionsSchema,
  NarrationManifestSchema,
  ScriptSchema,
  StoryboardSchema,
  VideoPlanSchema,
  type AudioPlan,
  type NarrationManifest,
  type Project,
  type Script,
  type Storyboard,
  type VideoPlan,
} from '../../shared/schemas';
import { buildNarration } from '../audio/narration';
import { mixAudio } from '../audio/mixer';
import { generateMusic, seedFrom } from '../audio/synth';
import { encodeWav } from '../audio/wav';
import { exportVectorIllustrations } from '../characters/characterLibrary';
import { importCustomIcons } from '../characters/customIcons';
import { projectPaths, type ProjectPaths } from '../projects/projectStore';
import type { ProviderContext } from '../providers/types';
import { startAssetServer } from '../render/assetServer';
import { assembleFinal, ensureRenderBrowser, extractThumbnail, renderCharacterSheet, renderSceneChunks, validateMp4 } from '../render/renderer';
import { buildScriptRequest, generateValidatedScript } from '../script/scriptEngine';
import { generateValidatedStoryboard } from '../storyboard/storyboardEngine';
import type { Studio } from '../studio';
import { DEFAULT_CAPTION_OPTIONS, SENTENCE_CAPTION_OPTIONS, absoluteWords, buildCaptions, toSrt, validateCaptions } from '../subtitles/subtitleEngine';
import { buildAudioPlan, buildVideoPlan, planScenes } from '../timing/timeline';
import { CancelledError, StageError, UserFacingError, errorMessage, isRetryable, throwIfAborted } from '../util/errors';
import { ensureDir, exists, readJson, safeJoin, sanitizeFileName, writeFileAtomic, writeJson } from '../util/fsx';
import { hashOf } from '../util/hash';
import { withRetry } from '../util/retry';
import { EtaEstimator, overallProgress, type ProgressEvent } from './progress';

export interface RunOptions {
  signal?: AbortSignal;
  onProgress?: (e: ProgressEvent) => void;
}

interface StageContext {
  project: Project;
  paths: ProjectPaths;
  ctx: ProviderContext;
  signal?: AbortSignal;
  report: (stageProgress: number, message: string, extra?: Partial<ProgressEvent>) => void;
  warn: (w: string) => void;
}

/**
 * The automatic generation pipeline. Each stage writes its outputs into the
 * project folder and is marked done only after its outputs validate. On
 * re-run, completed stages are skipped, so a failure never discards finished
 * work (scripts, voice, rendered scenes…).
 */
export class GenerationPipeline {
  constructor(private readonly studio: Studio) {}

  private stageFns: Record<PipelineStage, (s: StageContext) => Promise<string | void>> = {
    script: (s) => this.stageScript(s),
    storyboard: (s) => this.stageStoryboard(s),
    illustrations: (s) => this.stageIllustrations(s),
    voice: (s) => this.stageVoice(s),
    animation: (s) => this.stageAnimation(s),
    subtitles: (s) => this.stageSubtitles(s),
    render: (s) => this.stageRender(s),
    export: (s) => this.stageExport(s),
  };

  /** Pre-flight checks that fail fast with an actionable message, before any work or cost. */
  preflight(project: Project): string[] {
    const problems: string[] = [];
    const parsed = GenerationOptionsSchema.safeParse(project.options);
    if (!parsed.success) problems.push(...parsed.error.issues.map((i) => i.message));
    const llm = this.studio.providers.currentLlm();
    const r1 = llm.checkReady(project.options);
    if (r1 && project.stages.script.status !== 'done') problems.push(r1);
    const tts = this.studio.providers.currentTts();
    const r2 = tts.checkReady(project.options.language);
    if (r2 && project.stages.voice.status !== 'done') problems.push(r2);
    const img = this.studio.providers.currentImage();
    const r3 = img.checkReady();
    if (r3 && project.stages.illustrations.status !== 'done') problems.push(r3);
    return problems;
  }

  async run(projectId: string, opts: RunOptions = {}): Promise<Project> {
    const store = this.studio.projects;
    let project = await store.get(projectId);
    const paths = projectPaths(store.dirFor(projectId));
    const ctx = this.studio.providerContext(projectId, opts.signal);
    const warnings: string[] = [];
    let currentStage: PipelineStage | null = null;

    const emit = (e: Partial<ProgressEvent> & { stage: PipelineStage | null; stageProgress: number; message: string }) => {
      const stageIndex = e.stage ? PIPELINE_STAGES.indexOf(e.stage) : -1;
      opts.onProgress?.({
        projectId,
        status: e.status ?? 'running',
        stageIndex,
        overall: e.stage ? overallProgress(e.stage, e.stageProgress) : e.status === 'completed' ? 1 : 0,
        etaSec: null,
        warnings: warnings.length ? [...warnings] : undefined,
        ...e,
      });
    };

    const problems = this.preflight(project);
    if (problems.length) {
      project.status = 'failed';
      project.error = problems.join(' ');
      project.failedStage = 'script';
      await store.save(project);
      store.event(projectId, 'failed', 'script', project.error);
      emit({ status: 'failed', stage: 'script', stageProgress: 0, message: project.error, error: { stage: 'script', message: project.error, retryable: false } });
      return project;
    }

    project.status = 'running';
    project.error = undefined;
    project.failedStage = undefined;
    await store.save(project);
    store.event(projectId, 'started');

    try {
      for (const stage of PIPELINE_STAGES) {
        throwIfAborted(opts.signal);
        currentStage = stage;
        project = await store.get(projectId);
        const state = project.stages[stage];
        if (state.status === 'done' && (await this.outputsExist(stage, paths))) {
          emit({ stage, stageProgress: 1, message: `${PIPELINE_STAGE_LABELS[stage]} — reused` });
          continue;
        }
        const maxRetries = this.studio.settings.get().maxRetries;
        project = await store.setStage(projectId, stage, { status: 'running', startedAt: new Date().toISOString(), error: undefined, finishedAt: undefined });
        emit({ stage, stageProgress: 0, message: PIPELINE_STAGE_LABELS[stage] });
        const detail = await withRetry(
          async (attempt) => {
            project = await store.setStage(projectId, stage, { attempts: (project.stages[stage].attempts ?? 0) + 1 });
            if (attempt > 0) emit({ stage, stageProgress: 0, message: `${PIPELINE_STAGE_LABELS[stage]} — retry ${attempt}/${maxRetries}` });
            return this.stageFns[stage]({
              project,
              paths,
              ctx,
              signal: opts.signal,
              report: (p, message, extra) => emit({ stage, stageProgress: p, message, ...extra }),
              warn: (w) => warnings.push(w),
            });
          },
          {
            retries: maxRetries,
            signal: opts.signal,
            shouldRetry: (err) => isRetryable(err),
            onRetry: (err, attempt) => {
              ctx.log.warn(`Stage ${stage} failed (attempt ${attempt}), retrying:`, errorMessage(err));
              store.event(projectId, 'retry', stage, errorMessage(err));
            },
          },
        );
        project = await store.setStage(projectId, stage, { status: 'done', finishedAt: new Date().toISOString(), detail: detail || undefined });
        emit({ stage, stageProgress: 1, message: `${PIPELINE_STAGE_LABELS[stage]} — done` });
      }
      project = await store.get(projectId);
      const cost = this.studio.cost.projectCost(projectId);
      project.status = 'completed';
      project.costUsd = cost.usd;
      project.costKnown = cost.known;
      await store.save(project);
      store.event(projectId, 'completed', undefined, warnings.join(' | ') || undefined);
      emit({ status: 'completed', stage: null, stageProgress: 1, overall: 1, message: 'Video ready' });
      return project;
    } catch (err) {
      const cancelled = err instanceof CancelledError || opts.signal?.aborted;
      project = await store.get(projectId);
      const stage = currentStage ?? 'script';
      const message = cancelled ? 'Generation cancelled.' : errorMessage(err);
      const retryable = !cancelled && (err instanceof UserFacingError || err instanceof StageError ? err.retryable : true);
      project.stages[stage] = { ...project.stages[stage], status: 'failed', error: message, finishedAt: new Date().toISOString() };
      project.status = cancelled ? 'cancelled' : 'failed';
      project.failedStage = stage;
      project.error = message;
      const cost = this.studio.cost.projectCost(projectId);
      project.costUsd = cost.usd;
      project.costKnown = cost.known;
      await store.save(project);
      store.event(projectId, cancelled ? 'cancelled' : 'failed', stage, message);
      ctx.log.error(`Generation ${cancelled ? 'cancelled' : 'failed'} at ${stage}:`, err);
      emit({ status: project.status, stage, stageProgress: 0, message, error: { stage, message, retryable } });
      return project;
    }
  }

  /** Reset a stage and every later stage so they run again (earlier work and caches are kept). */
  async resetFrom(projectId: string, from: PipelineStage): Promise<Project> {
    const project = await this.studio.projects.get(projectId);
    const idx = PIPELINE_STAGES.indexOf(from);
    for (const s of PIPELINE_STAGES.slice(idx)) project.stages[s] = { status: 'pending', attempts: 0 };
    project.status = 'draft';
    project.error = undefined;
    project.failedStage = undefined;
    if (idx <= PIPELINE_STAGES.indexOf('export')) {
      await fsp.rm(projectPaths(this.studio.projects.dirFor(projectId)).finalMp4, { force: true });
    }
    return this.studio.projects.save(project);
  }

  private async outputsExist(stage: PipelineStage, p: ProjectPaths): Promise<boolean> {
    const files: Record<PipelineStage, string[]> = {
      script: [p.scriptJson],
      storyboard: [p.storyboardJson],
      illustrations: [path.join(p.illustrationsDir, 'manifest.json')],
      voice: [path.join(p.audioDir, 'narration.json'), path.join(p.audioDir, 'narration.wav')],
      animation: [path.join(p.renderDir, 'timeline.json'), path.join(p.audioDir, 'mix.wav')],
      subtitles: [path.join(p.renderDir, 'plan.json'), path.join(p.subtitlesDir, 'subtitles.srt')],
      render: [path.join(p.renderDir, 'chunks.json')],
      export: [p.finalMp4],
    };
    for (const f of files[stage]) if (!(await exists(f))) return false;
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Stages                                                              */
  /* ------------------------------------------------------------------ */

  private async stageScript(s: StageContext): Promise<string> {
    const settings = this.studio.settings.get();
    const llm = this.studio.providers.currentLlm();
    const req = buildScriptRequest(s.project.options, settings.speakingSpeed);
    s.report(0.1, `Writing script with ${llm.label}…`);
    const { script, warnings, attempts } = await generateValidatedScript(llm, req, s.ctx, llm.isLocal ? 1 : 3);
    warnings.forEach(s.warn);
    await writeJson(s.paths.scriptJson, ScriptSchema.parse(script));
    const project = await this.studio.projects.get(s.project.id);
    project.title = script.title;
    await this.studio.projects.save(project);
    return `${script.scenes.length} scenes, ${script.fullNarration.split(/\s+/).length} words (${llm.label}${attempts > 1 ? `, ${attempts} attempts` : ''})`;
  }

  private async stageStoryboard(s: StageContext): Promise<string> {
    const settings = this.studio.settings.get();
    const llm = this.studio.providers.currentLlm();
    const script = ScriptSchema.parse(await readJson(s.paths.scriptJson));
    const req = buildScriptRequest(s.project.options, settings.speakingSpeed);
    s.report(0.1, 'Directing scenes…');
    const { storyboard, warnings } = await generateValidatedStoryboard(llm, script, req, s.ctx, llm.isLocal ? 1 : 3);
    warnings.forEach(s.warn);
    await writeJson(s.paths.storyboardJson, StoryboardSchema.parse(storyboard));
    return `${storyboard.scenes.length} scenes directed`;
  }

  private async stageIllustrations(s: StageContext): Promise<string> {
    const settings = this.studio.settings.get();
    const sb = StoryboardSchema.parse(await readJson(s.paths.storyboardJson));
    s.report(0.1, 'Loading character library…');
    await this.studio.characters.ensure();
    const chars = await this.studio.characters.exportForProject(sb, s.paths.charactersDir);
    const accent = s.project.options.visualStyle === 'custom-brand' ? settings.brand.accent : '#FFD60A';
    s.report(0.3, 'Exporting vector illustrations…');
    const vectors = await exportVectorIllustrations(sb, s.paths.illustrationsDir, accent);
    const images: Record<string, string> = {};
    const provider = this.studio.providers.currentImage();
    const requests = sb.illustrations.slice(0, settings.maxAiImagesPerVideo);
    if (!provider.isLocal && requests.length) {
      let reference: string | undefined;
      if (provider.supportsReferences) {
        const sheet = this.studio.characters.referenceSheetPath();
        if (!(await this.studio.characters.hasReferenceSheet())) {
          try {
            await renderCharacterSheet(sheet, this.studio.renderEnv());
          } catch (err) {
            s.warn(`Character reference sheet could not be rendered: ${errorMessage(err)}`);
          }
        }
        if (await exists(sheet)) reference = sheet;
      }
      for (let i = 0; i < requests.length; i++) {
        throwIfAborted(s.signal);
        const r = requests[i]!;
        s.report(0.4 + (0.6 * i) / requests.length, `Generating illustration "${r.key}" (${i + 1}/${requests.length})…`, { scene: { index: i, total: requests.length } });
        try {
          const img = await provider.generateIllustration({ key: r.key, prompt: r.prompt, referenceFile: reference, transparent: true }, s.ctx);
          if (img) {
            const name = `${r.key}.png`;
            await writeFileAtomic(safeJoin(s.paths.illustrationsDir, name), img.data);
            images[r.key] = name;
          }
        } catch (err) {
          if (err instanceof CancelledError) throw err;
          // A failed optional illustration falls back to the vector asset already set on the prop.
          s.warn(`Illustration "${r.key}" failed (${errorMessage(err)}); using the vector asset instead.`);
        }
      }
    }
    // The user's own icon pack (e.g. icons they licensed from Flaticon / Noun Project).
    const custom = await importCustomIcons(settings.customIconsDir, sb, s.paths.illustrationsDir);
    Object.assign(images, custom.images);
    custom.warnings.forEach(s.warn);
    if (sb.illustrations.length > requests.length) s.warn(`${sb.illustrations.length - requests.length} AI illustration request(s) skipped by the per-video limit; vector assets used.`);
    await writeJson(path.join(s.paths.illustrationsDir, 'manifest.json'), { provider: provider.id, vectors, images, characters: chars });
    return `${chars.length} character poses, ${vectors.length} vector assets, ${Object.keys(custom.images).length} custom icons, ${Object.keys(images).length - Object.keys(custom.images).length} AI illustrations`;
  }

  private async stageVoice(s: StageContext): Promise<string> {
    const settings = this.studio.settings.get();
    const sb = StoryboardSchema.parse(await readJson(s.paths.storyboardJson));
    const tts = this.studio.providers.currentTts();
    const voice = await tts.resolveVoice(s.project.options.language, s.project.options.narrator);
    if (tts.prepareVoice && !voice.installed) {
      s.report(0.02, `Downloading voice ${voice.label}…`);
      await tts.prepareVoice(voice, s.ctx, (f) => s.report(0.02 + f * 0.18, `Downloading voice ${voice.label}… ${Math.round(f * 100)}%`));
    }
    const manifest = await buildNarration({
      storyboard: sb,
      tts,
      voice,
      language: s.project.options.language,
      speed: settings.speakingSpeed,
      audioDir: s.paths.audioDir,
      ctx: s.ctx,
      onScene: (i, n) => s.report(0.2 + (0.8 * i) / n, `Narrating scene ${i + 1}/${n} (${voice.label})`, { scene: { index: i, total: n } }),
    });
    await writeJson(path.join(s.paths.audioDir, 'narration.json'), NarrationManifestSchema.parse(manifest));
    return `${manifest.totalDuration.toFixed(1)} s of narration, voice ${voice.label}`;
  }

  private async stageAnimation(s: StageContext): Promise<string> {
    const settings = this.studio.settings.get();
    const sb = StoryboardSchema.parse(await readJson(s.paths.storyboardJson));
    const narration = NarrationManifestSchema.parse(await readJson(path.join(s.paths.audioDir, 'narration.json')));
    s.report(0.1, 'Synchronising scene timing to the narration…');
    const { scenes, durationInFrames } = planScenes(sb, narration, VIDEO_FPS);
    const brand = s.project.options.visualStyle === 'custom-brand' ? settings.brand : null;
    const cinematic = s.project.options.visualStyle !== 'full-frame';
    const script = ScriptSchema.parse(await readJson(s.paths.scriptJson));
    const draft = buildVideoPlan(sb, narration, [], {
      brand,
      images: {},
      layout: cinematic ? 'cinema' : 'tall',
      captionMode: cinematic ? 'sentence' : 'karaoke',
      banner: cinematic ? script.title : undefined,
      iconTone: settings.iconTone,
    });
    await writeJson(path.join(s.paths.renderDir, 'timeline.draft.json'), draft);

    s.report(0.3, 'Composing music…');
    const durationSec = durationInFrames / VIDEO_FPS;
    const musicFile = path.join(s.paths.audioDir, 'music.wav');
    if (settings.musicEnabled) {
      const mood = s.project.options.storytelling === 'unexpected' ? 'tense' : s.project.options.storytelling === 'hypothetical' ? 'upbeat' : 'calm';
      const seed = seedFrom(s.project.id);
      const key = hashOf({ v: 'music-1', seed, d: Math.ceil(durationSec), mood }, 32);
      const cached = await s.ctx.cache.get('music', key, 'wav');
      if (cached) await fsp.copyFile(cached, musicFile);
      else {
        const wav = encodeWav(generateMusic({ durationSec: durationSec + 0.5, seed, mood }));
        await writeFileAtomic(musicFile, wav);
        await s.ctx.cache.put('music', key, 'wav', wav, 'procedural');
      }
    }
    s.report(0.7, 'Mixing narration, music and sound effects…');
    const audioPlan: AudioPlan = buildAudioPlan(
      draft,
      path.join(s.paths.audioDir, narration.masterFile),
      narration.totalDuration,
      { enabled: settings.musicEnabled, file: settings.musicEnabled ? musicFile : undefined, volume: settings.musicVolume },
      { sfx: settings.sfxVolume, narration: settings.narrationVolume },
    );
    AudioPlanSchema.parse(audioPlan);
    const mix = await mixAudio(audioPlan, path.join(s.paths.audioDir, 'mix.wav'));
    await writeJson(path.join(s.paths.audioDir, 'audio-plan.json'), audioPlan);
    await writeJson(path.join(s.paths.renderDir, 'timeline.json'), { durationInFrames, scenes: scenes.map((x) => ({ id: x.id, startFrame: x.startFrame, durationInFrames: x.durationInFrames })) });
    return `${scenes.length} scenes over ${durationSec.toFixed(1)} s, ${audioPlan.sfx.length} sound effects, music ${settings.musicEnabled ? 'on' : 'off'} (peak ${mix.peak.toFixed(2)})`;
  }

  private async stageSubtitles(s: StageContext): Promise<string> {
    const draft = VideoPlanSchema.parse(await readJson(path.join(s.paths.renderDir, 'timeline.draft.json')));
    const narration = NarrationManifestSchema.parse(await readJson(path.join(s.paths.audioDir, 'narration.json')));
    s.report(0.2, 'Aligning subtitles to the voice…');
    const words = absoluteWords(narration, draft.scenes.map((x) => x.id));
    const captions = buildCaptions(words, draft.scenes, draft.captionMode === 'sentence' ? SENTENCE_CAPTION_OPTIONS : DEFAULT_CAPTION_OPTIONS);
    const issues = validateCaptions(captions, draft.durationInFrames);
    if (issues.length) throw new StageError('subtitles', `Subtitle timing invalid: ${issues.slice(0, 3).join('; ')}`, false);
    await writeJson(path.join(s.paths.subtitlesDir, 'captions.json'), captions);
    await writeFileAtomic(path.join(s.paths.subtitlesDir, 'subtitles.srt'), toSrt(captions, draft.fps));
    const manifest = (await readJson(path.join(s.paths.illustrationsDir, 'manifest.json'))) as { images: Record<string, string> };
    const plan: VideoPlan = VideoPlanSchema.parse({ ...draft, captions, images: manifest.images });
    await writeJson(path.join(s.paths.renderDir, 'plan.json'), plan);
    const methods = [...new Set(narration.segments.map((x) => x.alignment))].join(', ');
    return `${captions.length} caption cues (${methods})`;
  }

  private async stageRender(s: StageContext): Promise<string> {
    const planOnDisk = VideoPlanSchema.parse(await readJson(path.join(s.paths.renderDir, 'plan.json')));
    const env = this.studio.renderEnv();
    let server: Awaited<ReturnType<typeof startAssetServer>> | undefined;
    let plan = planOnDisk;
    if (Object.keys(planOnDisk.images).length) {
      server = await startAssetServer(s.paths.illustrationsDir);
      // Image URLs are content-addressed so chunk cache keys stay stable across runs.
      const images: Record<string, string> = {};
      for (const [k, file] of Object.entries(planOnDisk.images)) images[k] = `${server.baseUrl}/${encodeURIComponent(file)}`;
      plan = { ...planOnDisk, images };
    }
    const eta = new EtaEstimator(plan.durationInFrames);
    let cachedScenes = 0;
    try {
      if (!env.browserExecutable) {
        // First render on a new machine downloads Remotion's headless Chrome (once).
        await ensureRenderBrowser(null, (f) => s.report(0, `Downloading renderer browser (one-time)… ${Math.round(f * 100)}%`));
      }
      s.report(0.0, 'Starting renderer…');
      const chunks = await renderSceneChunks(plan, s.paths.scenesDir, env, {
        signal: s.signal,
        keyPlan: planOnDisk, // hash with file names, not ephemeral server ports
        onProgress: (p) => {
          if (p.cached && p.sceneFraction === 1) cachedScenes += 1;
          s.report(p.framesDone / p.framesTotal, `Rendering scene ${p.sceneIndex + 1}/${p.sceneCount}${p.cached ? ' (cached)' : ''}`, {
            scene: { index: p.sceneIndex, total: p.sceneCount },
            etaSec: eta.update(p.framesDone),
          });
        },
      });
      await writeJson(path.join(s.paths.renderDir, 'chunks.json'), chunks.map((c) => path.basename(c)));
      return `${chunks.length} scene chunks (${cachedScenes} reused from cache)`;
    } finally {
      await server?.close();
    }
  }

  private async stageExport(s: StageContext): Promise<string> {
    const settings = this.studio.settings.get();
    const plan = VideoPlanSchema.parse(await readJson(path.join(s.paths.renderDir, 'plan.json')));
    const chunks = ((await readJson(path.join(s.paths.renderDir, 'chunks.json'))) as string[]).map((c) => safeJoin(s.paths.scenesDir, c));
    for (const c of chunks) if (!(await exists(c))) throw new StageError('export', `Missing rendered scene ${path.basename(c)}; re-run rendering.`, false);
    const ffmpeg = this.studio.ffmpeg();
    const durationSec = plan.durationInFrames / plan.fps;
    s.report(0.05, 'Assembling scenes and encoding audio…');
    await assembleFinal(chunks, path.join(s.paths.audioDir, 'mix.wav'), s.paths.renderDir, s.paths.finalMp4, durationSec, ffmpeg, {
      signal: s.signal,
      onProgress: (f) => s.report(0.05 + f * 0.6, 'Encoding final MP4…'),
    });
    s.report(0.7, 'Validating MP4…');
    const v = await validateMp4(s.paths.finalMp4, ffmpeg, { width: VIDEO_WIDTH, height: VIDEO_HEIGHT, fps: VIDEO_FPS, durationSec });
    if (!v.ok) {
      await fsp.rm(s.paths.finalMp4, { force: true });
      throw new StageError('export', `Exported MP4 failed validation: ${v.issues.join(' ')}`, true);
    }
    s.report(0.9, 'Creating thumbnail…');
    await extractThumbnail(s.paths.finalMp4, s.paths.thumbnail, Math.min(2.2, durationSec / 2), ffmpeg);
    const stat = await fsp.stat(s.paths.finalMp4);
    const project = await this.studio.projects.get(s.project.id);
    project.durationSec = v.probe?.duration ?? durationSec;
    project.fileSize = stat.size;
    await this.studio.projects.save(project);
    if (settings.outputFolder) {
      try {
        await ensureDir(settings.outputFolder);
        const name = `${sanitizeFileName(project.title)}-${project.id.slice(-6)}.mp4`;
        await fsp.copyFile(s.paths.finalMp4, path.join(settings.outputFolder, name));
      } catch (err) {
        s.warn(`Could not copy the video to the output folder: ${errorMessage(err)}`);
      }
    }
    return `${(stat.size / 1024 / 1024).toFixed(1)} MB, ${durationSec.toFixed(1)} s, validated`;
  }

  /** Read helpers for the UI. */
  async readArtifacts(projectId: string): Promise<{ script?: Script; storyboard?: Storyboard; narration?: NarrationManifest; srt?: string }> {
    const p = projectPaths(this.studio.projects.dirFor(projectId));
    const out: { script?: Script; storyboard?: Storyboard; narration?: NarrationManifest; srt?: string } = {};
    if (await exists(p.scriptJson)) out.script = ScriptSchema.parse(await readJson(p.scriptJson));
    if (await exists(p.storyboardJson)) out.storyboard = StoryboardSchema.parse(await readJson(p.storyboardJson));
    const n = path.join(p.audioDir, 'narration.json');
    if (await exists(n)) out.narration = NarrationManifestSchema.parse(await readJson(n));
    const srt = path.join(p.subtitlesDir, 'subtitles.srt');
    if (await exists(srt)) out.srt = await fsp.readFile(srt, 'utf8');
    return out;
  }
}
