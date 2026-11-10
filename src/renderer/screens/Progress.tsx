import { useEffect, useState } from 'react';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, type PipelineStage } from '../../shared/constants';
import { mediaUrl, type ProgressDTO } from '../../shared/ipc';
import type { Navigate } from '../App';
import { api, errorText } from '../api';
import { IconAlert, IconCheck, IconDownload, IconFolder, IconPlay, IconRefresh, IconX } from '../components/Icons';
import { Badge, Button, Card, ProgressBar, StatusBadge, useToast } from '../components/ui';
import { formatBytes, formatCost, formatDuration, formatEta } from '../format';
import { useAsync, useProgress } from '../hooks';

export function ProgressScreen({ projectId, navigate }: { projectId: string; navigate: Navigate }) {
  const toast = useToast();
  const { data, error, reload } = useAsync(() => api().getProject(projectId), [projectId]);
  const [live, setLive] = useState<ProgressDTO | null>(null);

  useEffect(() => setLive(data?.progress ?? null), [data?.progress]);
  useProgress((e) => {
    setLive(e);
    if (e.status !== 'running' && e.status !== 'queued') reload();
    else if (e.stageProgress === 1 || e.stageProgress === 0) reload();
  }, projectId);

  if (error) return <div className="page"><div className="alert alert-danger">{error}</div></div>;
  if (!data) return <div className="page"><div className="muted">Loading…</div></div>;

  const { project } = data;
  const running = project.status === 'running' || project.status === 'queued';
  const overall = project.status === 'completed' ? 1 : live && live.projectId === projectId ? live.overall : 0;

  const stageView = (s: PipelineStage) => {
    const st = project.stages[s];
    const isLive = running && live?.stage === s && live.status === 'running';
    if (isLive) return { status: 'running' as const, progress: live!.stageProgress, message: live!.message };
    return { status: st.status, progress: st.status === 'done' ? 1 : 0, message: st.error ?? st.detail ?? '' };
  };

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast('success', ok);
      reload();
    } catch (e) {
      toast('error', errorText(e));
    }
  };

  const warnings = live?.projectId === projectId ? live.warnings : undefined;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="row gap-8">
            <StatusBadge status={project.status} />
            <span className="muted small">{project.options.language.toUpperCase()} · {project.options.duration === 'auto' ? 'auto' : `${project.options.duration} s`} · {project.options.storytelling}</span>
          </div>
          <h1 className="title-clamp">{project.title}</h1>
          <div className="muted small">Topic: {project.options.topic}</div>
        </div>
        <div className="row gap-8">
          {running && (
            <Button variant="danger" icon={<IconX size={16} />} onClick={() => act(() => api().cancel(projectId), 'Cancellation requested')}>
              Cancel
            </Button>
          )}
          {(project.status === 'failed' || project.status === 'cancelled' || project.status === 'draft') && (
            <Button variant="primary" icon={<IconRefresh size={16} />} onClick={() => act(() => api().retry(projectId), 'Resuming generation')}>
              {project.status === 'draft' ? 'Generate' : 'Retry'}
            </Button>
          )}
        </div>
      </div>

      <div className="progress-layout">
        <Card className="pipeline-card">
          <div className="overall">
            <div className="overall-pct">{Math.floor(overall * 100)}%</div>
            <div className="overall-meta">
              <div>{running ? (live?.message ?? 'Starting…') : project.status === 'completed' ? 'Video ready' : project.status === 'failed' ? 'Generation failed' : project.status === 'cancelled' ? 'Cancelled' : 'Not started'}</div>
              <div className="muted small">
                {running && live?.scene ? `Scene ${live.scene.index + 1} of ${live.scene.total}` : ''}
                {running && live?.etaSec ? ` · ${formatEta(live.etaSec)}` : ''}
              </div>
            </div>
          </div>
          <ProgressBar value={overall} tone={project.status === 'failed' ? 'danger' : project.status === 'completed' ? 'success' : 'accent'} />

          <ol className="stages">
            {PIPELINE_STAGES.map((s, i) => {
              const v = stageView(s);
              return (
                <li key={s} className={`stage stage-${v.status}`}>
                  <div className="stage-icon">
                    {v.status === 'done' ? <IconCheck size={14} /> : v.status === 'failed' ? <IconX size={14} /> : v.status === 'running' ? <span className="spinner" /> : <span>{i + 1}</span>}
                  </div>
                  <div className="stage-body">
                    <div className="stage-title">
                      {PIPELINE_STAGE_LABELS[s]}
                      {v.status === 'running' && <span className="muted small"> · {Math.floor(v.progress * 100)}%</span>}
                    </div>
                    {v.message && <div className={`stage-msg ${v.status === 'failed' ? 'danger-text' : 'muted'}`}>{v.message}</div>}
                    {v.status === 'running' && <ProgressBar value={v.progress} />}
                  </div>
                </li>
              );
            })}
          </ol>

          {project.status === 'failed' && project.error && (
            <div className="alert alert-danger">
              <div className="row gap-8">
                <IconAlert size={16} /> <strong>Failed at: {project.failedStage ? PIPELINE_STAGE_LABELS[project.failedStage] : 'unknown stage'}</strong>
              </div>
              <div>{project.error}</div>
              <div className="small muted">Completed stages are kept. Retry resumes from the failed stage without paying for finished work again.</div>
            </div>
          )}
          {warnings && warnings.length > 0 && (
            <div className="alert alert-warning">
              {warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}
        </Card>

        <div className="side-col">
          <Card title="Preview">
            {project.status === 'completed' && data.project.fileSize ? (
              <>
                <video className="player" src={mediaUrl(projectId, 'final.mp4', project.updatedAt)} controls playsInline />
                <div className="row gap-8 wrap mt-12">
                  <Button icon={<IconPlay size={14} />} onClick={() => act(() => api().openInSystemPlayer(projectId))}>Open in player</Button>
                  <Button icon={<IconFolder size={14} />} onClick={() => act(() => api().openFileLocation(projectId))}>Show file</Button>
                  <Button variant="primary" icon={<IconDownload size={14} />} onClick={() => act(async () => { const p = await api().exportCopy(projectId); if (p) toast('success', `Saved to ${p}`); })}>
                    Export MP4
                  </Button>
                </div>
              </>
            ) : (
              <div className="player-placeholder">
                <div className="muted">{running ? 'The video appears here when the export has finished and passed validation.' : 'No video yet.'}</div>
              </div>
            )}
          </Card>
          <Card title="Details">
            <dl className="details">
              <dt>Duration</dt>
              <dd>{formatDuration(project.durationSec)}</dd>
              <dt>File size</dt>
              <dd>{formatBytes(project.fileSize)}</dd>
              <dt>Estimated cost</dt>
              <dd>
                {formatCost(data.cost.usd, data.cost.known)} <span className="muted small">({data.cost.requests} requests, {data.cost.cachedHits} cached)</span>
              </dd>
            </dl>
            {data.script && (
              <details className="script-details">
                <summary>Script ({data.script.scenes.length} scenes)</summary>
                <ol className="script-list">
                  {data.script.scenes.map((s, i) => (
                    <li key={i}>{s.narration}</li>
                  ))}
                </ol>
                {data.script.assumptions.length > 0 && (
                  <div className="small muted">
                    <strong>Assumptions:</strong> {data.script.assumptions.join(' · ')}
                  </div>
                )}
              </details>
            )}
            <div className="row gap-8 mt-12">
              <Button size="sm" variant="ghost" onClick={() => navigate({ name: 'library' })}>
                Go to library
              </Button>
              {project.status === 'completed' && <Badge tone="success">Validated MP4 · H.264/AAC · 1080×1920 · 30 fps</Badge>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
