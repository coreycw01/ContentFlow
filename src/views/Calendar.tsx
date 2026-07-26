import { useMemo, useState } from 'react';

import { CHANNELS } from '../domain/channels';
import { stageDef } from '../domain/stages';
import { useStore } from '../store/store';
import { Card, Chip, Empty, Why } from '../ui/components';
import { navigate } from '../ui/router';

const DAY = 86400000;

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // Monday-first
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function CalendarView() {
  const projects = useStore((s) => s.projects);
  const updateProject = useStore((s) => s.updateProject);
  const active = useStore((s) => s.settings.activeChannelId);
  const [weekOffset, setWeekOffset] = useState(0);

  const scoped = useMemo(
    () => (active ? projects.filter((p) => p.channelId === active) : projects),
    [projects, active],
  );

  const weekStart = useMemo(() => {
    const d = startOfWeek(new Date());
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => new Date(weekStart.getTime() + i * DAY)),
    [weekStart],
  );

  const scheduled = scoped.filter((p) => p.targetPublishDate);
  const unscheduled = scoped.filter(
    (p) => !p.targetPublishDate && !['published', 'review', 'archived'].includes(p.stage),
  );

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card
        title="Publishing calendar"
        sub="Two weeks at a time. Only projects with a target date appear."
        right={
          <div className="row">
            <button className="btn small" onClick={() => setWeekOffset(weekOffset - 1)}>
              ←
            </button>
            <button className="btn small" onClick={() => setWeekOffset(0)}>
              Today
            </button>
            <button className="btn small" onClick={() => setWeekOffset(weekOffset + 1)}>
              →
            </button>
          </div>
        }
      >
        <Why>
          A target date is a commitment device, not an obligation. On World's Finest, attaching one is itself a
          warning sign — that channel is not supposed to be on a schedule.
        </Why>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {days.map((d) => {
            const key = iso(d);
            const items = scheduled.filter((p) => p.targetPublishDate === key);
            const isToday = key === iso(new Date());
            return (
              <div
                key={key}
                style={{
                  background: 'var(--panel-2)',
                  border: `1px solid ${isToday ? 'var(--accent)' : 'var(--line)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: 8,
                  minHeight: 96,
                }}
              >
                <div className="small dim" style={{ marginBottom: 6 }}>
                  {d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
                {items.map((p) => (
                  <div
                    key={p.id}
                    className="small"
                    style={{
                      background: 'var(--panel)',
                      borderLeft: `2px solid ${CHANNELS[p.channelId].accent}`,
                      borderRadius: 3,
                      padding: '4px 6px',
                      marginBottom: 4,
                      cursor: 'pointer',
                      lineHeight: 1.3,
                    }}
                    onClick={() => navigate(`/project/${p.id}/concept`)}
                  >
                    {p.workingTitle}
                    <div className="dim" style={{ fontSize: 10.5 }}>{stageDef(p.stage).label}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Unscheduled work" sub={`${unscheduled.length} open projects with no target date.`}>
        {unscheduled.length === 0 ? (
          <Empty>Everything open has a date.</Empty>
        ) : (
          <div className="col" style={{ gap: 6 }}>
            {unscheduled.map((p) => (
              <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small">
                  {p.workingTitle} <Chip>{CHANNELS[p.channelId].name}</Chip>{' '}
                  <Chip>{stageDef(p.stage).label}</Chip>
                </span>
                <input
                  type="date"
                  style={{ width: 150 }}
                  value=""
                  onChange={(e) => updateProject(p.id, { targetPublishDate: e.target.value || undefined })}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
