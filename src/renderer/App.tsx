import React, { useEffect, useState } from 'react';
import type { ProgressDTO } from '../shared/ipc';
import { PIPELINE_STAGE_LABELS } from '../shared/constants';
import { IconActivity, IconFilm, IconHome, IconPlus, IconSettings, Logo } from './components/Icons';
import { ProgressBar, ToastProvider } from './components/ui';
import { useProgress } from './hooks';
import { Dashboard } from './screens/Dashboard';
import { Generator } from './screens/Generator';
import { Library } from './screens/Library';
import { ProgressScreen } from './screens/Progress';
import { SettingsScreen } from './screens/Settings';

export type Route = { name: 'dashboard' } | { name: 'create' } | { name: 'progress'; projectId: string } | { name: 'library' } | { name: 'settings' };
export type Navigate = (r: Route) => void;

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'dashboard' });
  const [active, setActive] = useState<ProgressDTO | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.fvs) {
      setBridgeError('The desktop bridge is unavailable. Start the app with "npm start" (Electron), not in a regular browser.');
      return;
    }
    void window.fvs.queueState().then((q) => {
      const running = q.last.find((e) => e.projectId === q.running);
      if (running) setActive(running);
    });
  }, []);

  useProgress((e) => {
    if (e.status === 'running' || e.status === 'queued') setActive(e);
    else setActive((a) => (a && a.projectId === e.projectId ? null : a));
  });

  const nav: Array<{ key: Route['name']; label: string; icon: React.ReactNode; to: Route }> = [
    { key: 'dashboard', label: 'Dashboard', icon: <IconHome />, to: { name: 'dashboard' } },
    { key: 'create', label: 'Create video', icon: <IconPlus />, to: { name: 'create' } },
    { key: 'library', label: 'Video library', icon: <IconFilm />, to: { name: 'library' } },
    { key: 'settings', label: 'Settings', icon: <IconSettings />, to: { name: 'settings' } },
  ];

  return (
    <ToastProvider>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <Logo />
            <div>
              <div className="brand-name">Finance Video</div>
              <div className="brand-sub">STUDIO</div>
            </div>
          </div>
          <nav>
            {nav.map((n) => (
              <button key={n.key} className={`nav-item ${route.name === n.key ? 'active' : ''}`} onClick={() => setRoute(n.to)}>
                {n.icon}
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
          {active && (
            <button className="active-job" onClick={() => setRoute({ name: 'progress', projectId: active.projectId })}>
              <div className="active-job-title">
                <IconActivity size={14} /> {active.status === 'queued' ? 'Queued' : 'Generating'}
              </div>
              <div className="active-job-stage">{active.stage ? PIPELINE_STAGE_LABELS[active.stage] : active.message}</div>
              <ProgressBar value={active.overall} />
              <div className="active-job-pct">{Math.floor(active.overall * 100)}%</div>
            </button>
          )}
          <div className="sidebar-footer">Local-first · your keys stay on this PC</div>
        </aside>
        <main className="main">
          {bridgeError ? (
            <div className="bridge-error">{bridgeError}</div>
          ) : route.name === 'dashboard' ? (
            <Dashboard navigate={setRoute} />
          ) : route.name === 'create' ? (
            <Generator navigate={setRoute} />
          ) : route.name === 'progress' ? (
            <ProgressScreen projectId={route.projectId} navigate={setRoute} />
          ) : route.name === 'library' ? (
            <Library navigate={setRoute} />
          ) : (
            <SettingsScreen />
          )}
        </main>
      </div>
    </ToastProvider>
  );
}
