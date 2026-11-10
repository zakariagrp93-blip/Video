import { useMemo, useState } from 'react';
import type { PipelineStage } from '../../shared/constants';
import { mediaUrl, type ProjectSummaryDTO } from '../../shared/ipc';
import type { Navigate } from '../App';
import { api, errorText } from '../api';
import { IconCopy, IconFolder, IconPlay, IconRefresh, IconTrash } from '../components/Icons';
import { Button, Empty, Modal, Segmented, StatusBadge, useToast } from '../components/ui';
import { formatBytes, formatDate, formatDuration } from '../format';
import { useAsync, useProgress } from '../hooks';

type Filter = 'all' | 'completed' | 'failed' | 'running';

const REGEN: Array<{ stage: PipelineStage; label: string; hint: string }> = [
  { stage: 'script', label: 'Everything', hint: 'New script and storyboard (cached API responses are reused when inputs are identical).' },
  { stage: 'voice', label: 'Voice and timing', hint: 'Keeps the script; re-narrates with the current voice settings.' },
  { stage: 'animation', label: 'Sound design', hint: 'Keeps script and voice; remixes music and sound effects.' },
  { stage: 'render', label: 'Re-render only', hint: 'Re-renders changed scenes and re-exports the MP4.' },
];

export function Library({ navigate }: { navigate: Navigate }) {
  const toast = useToast();
  const { data, error, reload } = useAsync(() => api().listProjects());
  const [filter, setFilter] = useState<Filter>('all');
  const [playing, setPlaying] = useState<ProjectSummaryDTO | null>(null);
  const [regen, setRegen] = useState<ProjectSummaryDTO | null>(null);
  const [deleting, setDeleting] = useState<ProjectSummaryDTO | null>(null);
  useProgress((e) => {
    if (e.status !== 'running') reload();
  });

  const items = useMemo(
    () =>
      (data ?? []).filter((p) =>
        filter === 'all' ? true : filter === 'completed' ? p.status === 'completed' : filter === 'failed' ? p.status === 'failed' || p.status === 'cancelled' : p.status === 'running' || p.status === 'queued',
      ),
    [data, filter],
  );

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast('success', ok);
      reload();
    } catch (e) {
      toast('error', errorText(e));
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Video library</h1>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'completed', label: 'Completed' },
            { value: 'running', label: 'In progress' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {data && items.length === 0 ? (
        <Empty title="No videos here yet">
          <Button variant="primary" onClick={() => navigate({ name: 'create' })}>
            Create a video
          </Button>
        </Empty>
      ) : (
        <div className="library-grid">
          {items.map((p) => (
            <article key={p.id} className="video-card">
              <button className="video-thumb" onClick={() => (p.hasVideo ? setPlaying(p) : navigate({ name: 'progress', projectId: p.id }))}>
                {p.hasThumbnail ? <img src={mediaUrl(p.id, 'thumbnail.jpg', p.updatedAt)} alt="" /> : <div className="thumb-placeholder" />}
                {p.hasVideo && (
                  <span className="play-overlay">
                    <IconPlay size={28} />
                  </span>
                )}
                <span className="duration-chip">{formatDuration(p.durationSec)}</span>
              </button>
              <div className="video-info">
                <div className="row space-between">
                  <StatusBadge status={p.status} />
                  <span className="muted small">{formatBytes(p.fileSize)}</span>
                </div>
                <button className="video-title" onClick={() => navigate({ name: 'progress', projectId: p.id })}>
                  {p.title}
                </button>
                <div className="muted small">{formatDate(p.createdAt)}</div>
                <div className="video-actions">
                  <button className="icon-btn" title="Play" disabled={!p.hasVideo} onClick={() => setPlaying(p)}>
                    <IconPlay size={16} />
                  </button>
                  <button className="icon-btn" title="Open file location" onClick={() => act(() => api().openFileLocation(p.id))}>
                    <IconFolder size={16} />
                  </button>
                  <button className="icon-btn" title="Regenerate" disabled={p.status === 'running' || p.status === 'queued'} onClick={() => setRegen(p)}>
                    <IconRefresh size={16} />
                  </button>
                  <button className="icon-btn" title="Duplicate project" onClick={() => act(() => api().duplicate(p.id), 'Project duplicated')}>
                    <IconCopy size={16} />
                  </button>
                  <button className="icon-btn danger" title="Delete project" onClick={() => setDeleting(p)}>
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={!!playing} onClose={() => setPlaying(null)} title={playing?.title ?? ''} width={480}>
        {playing && <video className="player" src={mediaUrl(playing.id, 'final.mp4', playing.updatedAt)} controls autoPlay playsInline />}
      </Modal>

      <Modal open={!!regen} onClose={() => setRegen(null)} title="Regenerate video" width={560}>
        <p className="muted">Choose what to regenerate. Finished assets that do not change are reused from the cache.</p>
        <div className="regen-list">
          {REGEN.map((r) => (
            <button
              key={r.stage}
              className="regen-item"
              onClick={() => {
                const target = regen!;
                setRegen(null);
                void act(() => api().regenerate(target.id, r.stage), 'Regeneration queued').then(() => navigate({ name: 'progress', projectId: target.id }));
              }}
            >
              <div className="regen-title">{r.label}</div>
              <div className="muted small">{r.hint}</div>
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete project?" width={480}>
        <p>
          This permanently deletes <strong>{deleting?.title}</strong> and all of its files (script, audio, scenes, MP4).
        </p>
        <div className="row gap-8 end">
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const target = deleting!;
              setDeleting(null);
              void act(() => api().deleteProject(target.id), 'Project deleted');
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
