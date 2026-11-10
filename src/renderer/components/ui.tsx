import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { IconX } from './Icons';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; icon?: React.ReactNode }> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  ...rest
}) => (
  <button className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
    {icon}
    {children && <span>{children}</span>}
  </button>
);

export const Card: React.FC<Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & { title?: React.ReactNode; actions?: React.ReactNode }> = ({ title, actions, children, className = '', ...rest }) => (
  <section className={`card ${className}`} {...rest}>
    {(title || actions) && (
      <header className="card-header">
        {title && <h3>{title}</h3>}
        {actions && <div className="card-actions">{actions}</div>}
      </header>
    )}
    {children}
  </section>
);

export const Badge: React.FC<{ tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'info'; children: React.ReactNode }> = ({ tone = 'neutral', children }) => <span className={`badge badge-${tone}`}>{children}</span>;

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const tone = status === 'completed' ? 'success' : status === 'failed' ? 'danger' : status === 'running' ? 'accent' : status === 'queued' ? 'info' : status === 'cancelled' ? 'warning' : 'neutral';
  const label = status === 'completed' ? 'Completed' : status === 'failed' ? 'Failed' : status === 'running' ? 'Generating' : status === 'queued' ? 'Queued' : status === 'cancelled' ? 'Cancelled' : 'Draft';
  return <Badge tone={tone}>{label}</Badge>;
};

export function Field({ label, hint, children, error }: { label: string; hint?: React.ReactNode; children: React.ReactNode; error?: string | null }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({ value, options, onChange, disabled }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <select className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}>
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'danger' | 'success' }) {
  return (
    <div className={`progress progress-${tone}`}>
      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value * 100)).toFixed(1)}%` }} />
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 720 }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {children}
    </div>
  );
}

/* Toasts ---------------------------------------------------------------- */
type Toast = { id: number; tone: 'info' | 'success' | 'error'; text: string };
const ToastCtx = createContext<(tone: Toast['tone'], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast['tone'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 8000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
