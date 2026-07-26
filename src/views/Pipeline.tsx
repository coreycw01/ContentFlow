import { useMemo, useState } from 'react';

import { CHANNELS, CHANNEL_IDS } from '../domain/channels';
import { nextAction } from '../domain/readiness';
import { effortLabel } from '../domain/scoring';
import { STAGES, stageDef } from '../domain/stages';
import type { ContentProject, Priority, Stage } from '../domain/types';
import { useStore } from '../store/store';
import { Card, Chip, Empty, relativeDays } from '../ui/components';
import { navigate } from '../ui/router';

type Layout = 'kanban' | 'table' | 'channel' | 'priority' | 'timeline';

const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export function PipelineView() {
  const projects = useStore((s) => s.projects);
  const active = useStore((s) => s.settings.activeChannelId);
  const setStage = useStore((s) => s.setStage);
  const [layout, setLayout] = useState<Layout>('kanban');

  const scoped = useMemo(
    () => (active ? projects.filter((p) => p.channelId === active) : projects),
    [projects, active],
  );

  if (projects.length === 0) {
    return (
      <Empty>
        No projects yet. <a href="#/ideas">Generate ideas</a>, compare them in the Selection Room, and select a
        winner to create the first Content Project.
      </Empty>
    );
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 4 }}>
          {(['kanban', 'table', 'channel', 'priority', 'timeline'] as Layout[]).map((l) => (
            <button
              key={l}
              className={`btn small${layout === l ? ' primary' : ''}`}
              onClick={() => setLayout(l)}
            >
              {l[0].toUpperCase() + l.slice(1)}
            </button>
          ))}
        </div>
        <span className="small dim">{scoped.length} projects</span>
      </div>

      {layout === 'kanban' && <Kanban projects={scoped} onMove={setStage} />}
      {layout === 'table' && <TableView projects={scoped} />}
      {layout === 'channel' && <ChannelView projects={scoped} />}
      {layout === 'priority' && <PriorityView projects={scoped} />}
      {layout === 'timeline' && <TimelineView projects={scoped} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ProjectCard({ p, onMove }: { p: ContentProject; onMove?: (id: string, s: Stage) => void }) {
  const ch = CHANNELS[p.channelId];
  const series = ch.series.find((s) => s.id === p.seriesId);
  const na = nextAction(p);
  return (
    <div className="pcard" style={{ borderLeftColor: ch.accent }} onClick={() => navigate(`/project/${p.id}/concept`)}>
      <div className="t">{p.workingTitle}</div>
      <div className="row" style={{ gap: 4, marginBottom: 6 }}>
        <Chip>{ch.name}</Chip>
        {series && <Chip>{series.name}</Chip>}
        {p.priority !== 'normal' && (
          <Chip tone={p.priority === 'urgent' ? 'bad' : p.priority === 'high' ? 'warn' : undefined}>{p.priority}</Chip>
        )}
      </div>
      <div className="m">
        Value {p.contentValue} · Virality {p.viralityScore} · {effortLabel(p.effort)} effort
      </div>
      <div className="m" style={{ marginTop: 4 }}>Next: {na.label}</div>
      {p.blocker && <div className="m" style={{ color: 'var(--bad)' }}>Blocked: {p.blocker}</div>}
      {p.targetPublishDate && <div className="m">Target {p.targetPublishDate}</div>}
      {onMove && (
        <div className="row optional-controls" style={{ marginTop: 8, gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <select
            className="small"
            value={p.stage}
            onChange={(e) => onMove(p.id, e.target.value as Stage)}
            style={{ fontSize: 11, padding: '3px 6px' }}
          >
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function Kanban({ projects, onMove }: { projects: ContentProject[]; onMove: (id: string, s: Stage) => void }) {
  const used = STAGES.filter((s) => projects.some((p) => p.stage === s.id) || s.active);
  return (
    <div className="kanban">
      {used.map((s) => {
        const items = projects.filter((p) => p.stage === s.id);
        return (
          <div key={s.id} className="kanban-col">
            <h4>
              <span>{s.label}</span>
              <span>{items.length}</span>
            </h4>
            <div className="small dim" style={{ marginBottom: 8, fontSize: 11, lineHeight: 1.4 }}>{s.why}</div>
            {items.map((p) => (
              <ProjectCard key={p.id} p={p} onMove={onMove} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function TableView({ projects }: { projects: ContentProject[] }) {
  return (
    <Card flush>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Channel</th>
              <th>Series</th>
              <th>Stage</th>
              <th>Priority</th>
              <th className="num">Value</th>
              <th className="num">Virality</th>
              <th>Effort</th>
              <th>Next action</th>
              <th>Blocker</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const ch = CHANNELS[p.channelId];
              return (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/project/${p.id}/concept`)}>
                  <td>{p.workingTitle}</td>
                  <td className="nowrap">{ch.name}</td>
                  <td className="nowrap dim">{ch.series.find((s) => s.id === p.seriesId)?.name ?? '—'}</td>
                  <td className="nowrap">{stageDef(p.stage).label}</td>
                  <td>{p.priority}</td>
                  <td className="num">{p.contentValue}</td>
                  <td className="num">{p.viralityScore}</td>
                  <td>{effortLabel(p.effort)}</td>
                  <td className="dim">{nextAction(p).label}</td>
                  <td style={{ color: p.blocker ? 'var(--bad)' : undefined }}>{p.blocker ?? '—'}</td>
                  <td className="nowrap">{p.targetPublishDate ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ChannelView({ projects }: { projects: ContentProject[] }) {
  return (
    <div className="grid two">
      {CHANNEL_IDS.map((cid) => {
        const ch = CHANNELS[cid];
        const items = projects.filter((p) => p.channelId === cid);
        return (
          <Card key={cid} title={ch.name} sub={`${items.length} projects · ${ch.tagline}`}>
            {items.length === 0 ? (
              <Empty>Nothing here.</Empty>
            ) : (
              items.map((p) => <ProjectCard key={p.id} p={p} />)
            )}
          </Card>
        );
      })}
    </div>
  );
}

function PriorityView({ projects }: { projects: ContentProject[] }) {
  const groups: Priority[] = ['urgent', 'high', 'normal', 'low'];
  const sorted = projects.slice().sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  return (
    <div className="col" style={{ gap: 14 }}>
      {groups.map((g) => {
        const items = sorted.filter((p) => p.priority === g);
        if (items.length === 0) return null;
        return (
          <Card key={g} title={g[0].toUpperCase() + g.slice(1)} sub={`${items.length} projects`}>
            <div className="grid three">
              {items.map((p) => (
                <ProjectCard key={p.id} p={p} />
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function TimelineView({ projects }: { projects: ContentProject[] }) {
  const sorted = projects
    .slice()
    .sort((a, b) => (a.targetPublishDate ?? '9999').localeCompare(b.targetPublishDate ?? '9999'));
  return (
    <Card flush>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Target</th>
              <th>Title</th>
              <th>Channel</th>
              <th>Stage</th>
              <th>Last touched</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/project/${p.id}/concept`)}>
                <td className="nowrap mono">{p.targetPublishDate ?? 'unscheduled'}</td>
                <td>{p.workingTitle}</td>
                <td className="nowrap">{CHANNELS[p.channelId].name}</td>
                <td className="nowrap">{stageDef(p.stage).label}</td>
                <td className="nowrap dim">{relativeDays(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
