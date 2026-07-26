import { useState } from 'react';

import type { ProductionPhase } from '../../domain/types';
import { useStore } from '../../store/store';
import { Card, Chip, Empty, Why } from '../../ui/components';

const PHASES: { id: ProductionPhase; label: string; sub: string }[] = [
  { id: 'pre', label: 'Pre-production', sub: 'Everything decided before the camera turns on.' },
  { id: 'recording', label: 'Recording', sub: 'Capture list built from your actual beats.' },
  { id: 'post', label: 'Post-production', sub: 'Assembly against the timeline.' },
];

export function ProductionTab({ projectId }: { projectId: string }) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId))!;
  const regenerateProduction = useStore((s) => s.regenerateProduction);
  const toggleTask = useStore((s) => s.toggleTask);
  const addTask = useStore((s) => s.addTask);

  const [newTask, setNewTask] = useState<Record<string, string>>({});

  const done = project.production.filter((t) => t.done).length;
  const total = project.production.length;

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card
        title="Production board"
        sub={total ? `${done}/${total} complete` : 'Generated from the script and timeline — not a static checklist.'}
        right={
          <button className="btn" onClick={() => regenerateProduction(projectId)}>
            {total ? 'Regenerate from script' : 'Generate checklist'}
          </button>
        }
      >
        <Why>
          Every task below traces back to something in your project: a beat, a thumbnail, a cited source, a
          channel requirement. If a beat uses no gameplay, no gameplay task appears.
        </Why>
        {total > 0 && (
          <div style={{ height: 5, background: 'var(--line-soft)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{ height: '100%', width: `${(done / total) * 100}%`, background: 'var(--accent)' }}
            />
          </div>
        )}
      </Card>

      {total === 0 ? (
        <Empty>
          No checklist yet. Approve the script, or generate the checklist directly from whatever exists now.
        </Empty>
      ) : (
        PHASES.map((phase) => {
          const tasks = project.production.filter((t) => t.phase === phase.id);
          if (tasks.length === 0) return null;
          const phaseDone = tasks.filter((t) => t.done).length;
          return (
            <Card
              key={phase.id}
              title={phase.label}
              sub={phase.sub}
              right={<Chip tone={phaseDone === tasks.length ? 'good' : undefined}>{phaseDone}/{tasks.length}</Chip>}
            >
              <div className="col" style={{ gap: 4 }}>
                {tasks.map((t) => (
                  <label key={t.id} className="row" style={{ gap: 9, alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={t.done}
                      style={{ marginTop: 3 }}
                      onChange={() => toggleTask(projectId, t.id)}
                    />
                    <span style={{ flex: 1 }}>
                      <span className={t.done ? 'strike' : ''}>{t.label}</span>
                      {t.derivedFrom && (
                        <span className="small dim" style={{ marginLeft: 8 }}>
                          ← {t.derivedFrom}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>

              <div className="row optional-controls" style={{ marginTop: 12 }}>
                <input
                  style={{ flex: 1 }}
                  placeholder="Add a task…"
                  value={newTask[phase.id] ?? ''}
                  onChange={(e) => setNewTask({ ...newTask, [phase.id]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (newTask[phase.id] ?? '').trim()) {
                      addTask(projectId, phase.id, newTask[phase.id].trim());
                      setNewTask({ ...newTask, [phase.id]: '' });
                    }
                  }}
                />
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
