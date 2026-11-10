import { mediaUrl } from '../../shared/ipc';
import type { Navigate } from '../App';
import { api } from '../api';
import { IconAlert, IconPlus, IconRefresh, IconSpark } from '../components/Icons';
import { Button, Card, Empty, StatusBadge, useToast } from '../components/ui';
import { formatBytes, formatCost, formatDate, formatDuration } from '../format';
import { useAsync, useProgress } from '../hooks';
import { errorText } from '../api';

export function Dashboard({ navigate }: { navigate: Navigate }) {
  const { data, error, reload } = useAsync(() => api().dashboard());
  const toast = useToast();
  useProgress((e) => {
    if (e.status !== 'running') reload();
  });

  const retry = async (id: string) => {
    try {
      await api().retry(id);
      navigate({ name: 'progress', projectId: id });
    } catch (e) {
      toast('error', errorText(e));
    }
  };

  return (
    <div className="page">
      <div className="hero">
        <div>
          <div className="eyebrow">
            <IconSpark size={14} /> AI-powered finance storytelling
          </div>
          <h1>
            Turn a topic into a <span className="accent">finished TikTok video</span>.
          </h1>
          <p className="muted">Script, storyboard, illustrations, narration, animation, subtitles, music and a 1080×1920 MP4 — fully automatic.</p>
        </div>
        <Button variant="primary" size="lg" icon={<IconPlus />} onClick={() => navigate({ name: 'create' })}>
          CREATE A VIDEO
        </Button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="stats">
        <Stat label="Videos generated" value={data ? String(data.totalVideos) : '—'} />
        <Stat label="Failed generations" value={data ? String(data.failed) : '—'} tone={data?.failed ? 'danger' : undefined} />
        <Stat label="In progress" value={data ? String(data.running) : '—'} />
        <Stat label="Storage used" value={data ? formatBytes(data.storageBytes) : '—'} />
        <Stat label="API spend (estimated)" value={data ? formatCost(data.totalCostUsd, data.unknownCostRequests === 0) : '—'} />
      </div>

      <div className="grid-2">
        <Card title="Recent projects" actions={<Button size="sm" variant="ghost" onClick={() => navigate({ name: 'library' })}>View library</Button>}>
          {data && data.recent.length === 0 ? (
            <Empty title="No videos yet">
              <p className="muted">Create your first video — it takes one topic and one click.</p>
            </Empty>
          ) : (
            <div className="recent-list">
              {data?.recent.map((p) => (
                <button key={p.id} className="recent-item" onClick={() => navigate({ name: 'progress', projectId: p.id })}>
                  <div className="thumb-sm">{p.hasThumbnail ? <img src={mediaUrl(p.id, 'thumbnail.jpg', p.updatedAt)} alt="" /> : <div className="thumb-placeholder" />}</div>
                  <div className="recent-meta">
                    <div className="recent-title">{p.title}</div>
                    <div className="muted small">
                      {formatDate(p.createdAt)} · {formatDuration(p.durationSec)}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title={<span className="row gap-8"><IconAlert size={16} /> Failed generations</span>}>
          {data && data.failedProjects.length === 0 ? (
            <Empty title="Nothing failed">
              <p className="muted">Failed or cancelled generations appear here with a one-click retry.</p>
            </Empty>
          ) : (
            <div className="recent-list">
              {data?.failedProjects.map((p) => (
                <div key={p.id} className="recent-item static">
                  <div className="recent-meta">
                    <div className="recent-title">{p.title}</div>
                    <div className="small danger-text clamp-2">{p.failedStage ? `${p.failedStage}: ` : ''}{p.error}</div>
                  </div>
                  <Button size="sm" icon={<IconRefresh size={14} />} onClick={() => retry(p.id)}>
                    Retry
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Generation history">
        {data && data.history.length === 0 ? (
          <Empty title="No activity yet" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Project</th>
                <th>Event</th>
                <th>Stage</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data?.history.map((h, i) => (
                <tr key={i}>
                  <td className="nowrap muted">{formatDate(h.at)}</td>
                  <td className="clamp-1">{h.title ?? h.projectId}</td>
                  <td>
                    <span className={`event event-${h.kind}`}>{h.kind}</span>
                  </td>
                  <td className="muted">{h.stage ?? ''}</td>
                  <td className="muted clamp-1">{h.message ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
