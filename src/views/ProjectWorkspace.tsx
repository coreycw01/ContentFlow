import { CHANNELS } from '../domain/channels';
import { nextAction, publishGate, recordGate, scriptGate } from '../domain/readiness';
import { STAGES, stageDef } from '../domain/stages';
import type { Priority, Stage } from '../domain/types';
import { useStore } from '../store/store';
import { Chip, Empty, LazyInput } from '../ui/components';
import { navigate } from '../ui/router';
import { ConceptTab } from './project/Concept';
import { PackagingTab } from './project/Packaging';
import { ProductionTab } from './project/Production';
import { ReviewTab } from './project/Review';
import { ScriptTab } from './project/Script';
import { TimelineTab } from './project/Timeline';

const TABS = [
  { id: 'concept', label: 'Concept' },
  { id: 'packaging', label: 'Packaging' },
  { id: 'script', label: 'Script' },
  { id: 'timeline', label: 'Timeline & B-roll' },
  { id: 'production', label: 'Production' },
  { id: 'review', label: 'Review' },
] as const;

export function ProjectWorkspace({ projectId, tab = 'concept' }: { projectId?: string; tab?: string }) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId));
  const updateProject = useStore((s) => s.updateProject);
  const setStage = useStore((s) => s.setStage);
  const deleteProject = useStore((s) => s.deleteProject);

  if (!project) {
    return (
      <Empty>
        Project not found. <a href="#/pipeline">Back to the pipeline.</a>
      </Empty>
    );
  }

  const ch = CHANNELS[project.channelId];
  const na = nextAction(project);
  const gate =
    project.stage === 'scripting' || project.stage === 'developing' || project.stage === 'packaging'
      ? scriptGate(project)
      : project.stage === 'ready-to-record'
        ? recordGate(project)
        : publishGate(project);

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <LazyInput value={project.workingTitle} onCommit={(v) => updateProject(project.id, { workingTitle: v })} />
            <div className="row" style={{ gap: 5, marginTop: 8 }}>
              <Chip tone="accent">{ch.name}</Chip>
              <Chip>{stageDef(project.stage).label}</Chip>
              <Chip>Value {project.contentValue}</Chip>
              <Chip>Virality {project.viralityScore}</Chip>
              {ch.viralityPolicy === 'advisory' && <Chip>virality is advisory here</Chip>}
            </div>
          </div>
          <div className="col" style={{ alignItems: 'flex-end', gap: 8 }}>
            <button className="btn primary" onClick={() => navigate(na.route)}>
              {na.label}
            </button>
            <span className="small dim" style={{ maxWidth: 280, textAlign: 'right' }}>{na.hint}</span>
          </div>
        </div>

        <div className="row optional-controls" style={{ marginTop: 14, gap: 10 }}>
          <label className="row small" style={{ gap: 6 }}>
            <span className="dim">Stage</span>
            <select value={project.stage} onChange={(e) => setStage(project.id, e.target.value as Stage)}>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="row small" style={{ gap: 6 }}>
            <span className="dim">Priority</span>
            <select
              value={project.priority}
              onChange={(e) => updateProject(project.id, { priority: e.target.value as Priority })}
            >
              {['low', 'normal', 'high', 'urgent'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="row small" style={{ gap: 6 }}>
            <span className="dim">Target publish</span>
            <input
              type="date"
              style={{ width: 150 }}
              value={project.targetPublishDate ?? ''}
              onChange={(e) => updateProject(project.id, { targetPublishDate: e.target.value || undefined })}
            />
          </label>
          <label className="row small" style={{ gap: 6, flex: 1, minWidth: 200 }}>
            <span className="dim">Blocker</span>
            <LazyInput
              value={project.blocker ?? ''}
              placeholder="Nothing blocking"
              onCommit={(v) => updateProject(project.id, { blocker: v || undefined })}
            />
          </label>
          <button className="btn small ghost danger" onClick={() => { deleteProject(project.id); navigate('/pipeline'); }}>
            Delete
          </button>
        </div>

        {ch.workspace.pressure.overdueIndicators === false && (
          <div className="notice" style={{ marginTop: 12 }}>
            {ch.name} runs without cadence targets, overdue badges or consistency warnings. If planning this
            starts to feel like work, strip it back — the app is wrong, not you.
          </div>
        )}
      </div>

      {(gate.blockers.length > 0 || gate.warnings.length > 0) && (
        <div className="col" style={{ gap: 8 }}>
          {gate.blockers.map((b, i) => (
            <div key={i} className="blocker">
              <strong>Blocked: </strong>
              {b}
            </div>
          ))}
          {gate.warnings.map((w, i) => (
            <div key={i} className="notice">
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => navigate(`/project/${project.id}/${t.id}`)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'concept' && <ConceptTab projectId={project.id} />}
      {tab === 'packaging' && <PackagingTab projectId={project.id} />}
      {tab === 'script' && <ScriptTab projectId={project.id} />}
      {tab === 'timeline' && <TimelineTab projectId={project.id} />}
      {tab === 'production' && <ProductionTab projectId={project.id} />}
      {tab === 'review' && <ReviewTab projectId={project.id} />}
    </div>
  );
}
