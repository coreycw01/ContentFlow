import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { DIMENSION_LABELS } from '../domain/channels';
import type { ScoreCard, ScoreDimension } from '../domain/types';

export function Card({
  title,
  sub,
  right,
  children,
  flush,
}: {
  title?: string;
  sub?: string;
  right?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <div className={`card${flush ? ' flush' : ''}`}>
      {(title || right) && (
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', padding: flush ? '16px 16px 0' : undefined }}>
          <div>
            {title && <h3>{title}</h3>}
            {sub && <div className="card-sub">{sub}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <div className="small dim" style={{ marginTop: 4 }}>{hint}</div>}
    </label>
  );
}

export function Why({ children }: { children: ReactNode }) {
  return <div className="why">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Chip({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'accent' | 'good' | 'warn' | 'bad';
}) {
  return <span className={`chip${tone ? ` ${tone}` : ''}`}>{children}</span>;
}

export function ScoreBar({
  dimension,
  value,
  dim,
}: {
  dimension: ScoreDimension | string;
  value: number;
  dim?: boolean;
}) {
  const label = (DIMENSION_LABELS as Record<string, string>)[dimension] ?? dimension;
  return (
    <div className={`score-row${dim ? ' dim' : ''}`}>
      <div className="label">{label}</div>
      <div className="track">
        <div className="fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <div className="val">{Math.round(value)}</div>
    </div>
  );
}

export function ScoreGrid({
  scores,
  highlight = [],
  deprioritised = [],
}: {
  scores: ScoreCard;
  highlight?: ScoreDimension[];
  deprioritised?: ScoreDimension[];
}) {
  const order = [
    ...highlight,
    ...(Object.keys(scores) as ScoreDimension[]).filter((d) => !highlight.includes(d)),
  ];
  return (
    <div className="col" style={{ gap: 5 }}>
      {order.map((d) => (
        <ScoreBar key={d} dimension={d} value={scores[d]} dim={deprioritised.includes(d)} />
      ))}
    </div>
  );
}

export function Stat({ n, k }: { n: ReactNode; k: string }) {
  return (
    <div className="stat">
      <div className="n">{n}</div>
      <div className="k">{k}</div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={t.id === active ? 'active' : ''} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn ghost small" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Textarea that commits on blur, so typing never re-renders the whole tree. */
export function LazyText({
  value,
  onCommit,
  rows = 3,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <textarea
      rows={rows}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local)}
    />
  );
}

export function LazyInput({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <input
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local)}
    />
  );
}

export const fmtDuration = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export const relativeDays = (iso?: string) => {
  if (!iso) return '—';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
};
