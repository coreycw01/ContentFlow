import { useMemo } from 'react';

import { brandCoverage, brandWarnings, channelHealth } from '../domain/brand';
import { CHANNELS, CHANNEL_IDS } from '../domain/channels';
import { useStore } from '../store/store';
import { Card, Chip, Empty, ScoreBar, Why } from '../ui/components';

const LEVEL_TONE = {
  heavy: 'warn',
  medium: undefined,
  low: 'accent',
  'very-low': 'good',
} as const;

export function BrandView() {
  const projects = useStore((s) => s.projects);
  const library = useStore((s) => s.library);

  const coverage = useMemo(() => brandCoverage(projects), [projects]);
  const warnings = useMemo(() => brandWarnings(projects, library), [projects, library]);
  const health = useMemo(() => channelHealth(projects), [projects]);

  const published = projects.filter((p) => p.publishedAt);
  const maxCount = Math.max(1, ...coverage.map((c) => c.count));

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card title="Brand map" sub="What the body of work is actually saying, versus what you want it to say.">
        <Why>
          This is measured from published projects and the associations you tagged them with. It is a mirror, not
          a plan — if it looks wrong, the uploads are what changed, not the map.
        </Why>
        {published.length === 0 ? (
          <Empty>Nothing published yet, so there is no pattern to read.</Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Brand association</th>
                  <th style={{ width: '35%' }}>Recent coverage</th>
                  <th className="num">Videos</th>
                  <th>Level</th>
                  <th>Recommendation</th>
                  <th>Channels</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((row) => (
                  <tr key={row.association}>
                    <td style={{ fontWeight: 550 }}>{row.association}</td>
                    <td>
                      <ScoreBar dimension={row.association} value={(row.count / maxCount) * 100} />
                    </td>
                    <td className="num">{row.count}</td>
                    <td>
                      <Chip tone={LEVEL_TONE[row.level]}>{row.level.replace('-', ' ')}</Chip>
                    </td>
                    <td className="dim">{row.recommendation}</td>
                    <td className="nowrap dim">
                      {row.channelIds.map((c) => CHANNELS[c].name).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Personal-brand warning system"
        sub={warnings.length ? `${warnings.length} pattern${warnings.length === 1 ? '' : 's'} flagged.` : 'Nothing flagged.'}
      >
        {warnings.length === 0 ? (
          <Empty>No warnings. Either the work is coherent, or there is not enough of it yet to form a pattern.</Empty>
        ) : (
          <div className="col" style={{ gap: 12 }}>
            {warnings.map((w) => (
              <div
                key={w.id}
                className="card"
                style={{
                  margin: 0,
                  background: 'var(--panel-2)',
                  borderLeft: `2px solid ${
                    w.severity === 'serious' ? 'var(--bad)' : w.severity === 'watch' ? 'var(--warn)' : 'var(--line)'
                  }`,
                }}
              >
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <strong style={{ fontSize: 13.5 }}>{w.title}</strong>
                  <div className="row" style={{ gap: 5 }}>
                    {w.channelId && <Chip>{CHANNELS[w.channelId].name}</Chip>}
                    <Chip tone={w.severity === 'serious' ? 'bad' : w.severity === 'watch' ? 'warn' : undefined}>
                      {w.severity}
                    </Chip>
                  </div>
                </div>
                <div className="small" style={{ marginTop: 6 }}>{w.detail}</div>
                {w.action && (
                  <div className="small" style={{ marginTop: 6, color: 'var(--accent)' }}>
                    → {w.action}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Channel doctrine" sub="How hard the app is allowed to push on each channel. This is data, not habit.">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Rigor</th>
                <th>Virality policy</th>
                <th>Cadence target</th>
                <th>Consistency warnings</th>
                <th>Overdue badges</th>
                <th className="num">Priority</th>
              </tr>
            </thead>
            <tbody>
              {CHANNEL_IDS.map((cid) => {
                const ch = CHANNELS[cid];
                return (
                  <tr key={cid}>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: ch.accent,
                          marginRight: 7,
                        }}
                      />
                      {ch.name}
                    </td>
                    <td>{ch.rigor}</td>
                    <td>
                      <Chip tone={ch.viralityPolicy === 'advisory' ? 'good' : undefined}>{ch.viralityPolicy}</Chip>
                    </td>
                    <td>{ch.workspace.pressure.cadenceTargetDays ? `${ch.workspace.pressure.cadenceTargetDays} days` : 'none'}</td>
                    <td>{ch.workspace.pressure.consistencyWarnings ? 'on' : 'off'}</td>
                    <td>{ch.workspace.pressure.overdueIndicators ? 'on' : 'off'}</td>
                    <td className="num">{ch.strategicPriority}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Why>
          World's Finest runs with every pressure mechanic switched off. That is not an oversight — turning it into
          a virality-optimised production machine would destroy the reason the channel exists.
        </Why>
      </Card>

      <div className="grid four">
        {health.map((h) => {
          const ch = CHANNELS[h.channelId];
          return (
            <Card key={h.channelId} title={ch.name} sub={ch.purpose}>
              <div className="row" style={{ gap: 5 }}>
                {ch.brandAssociations.map((a) => (
                  <Chip key={a}>{a}</Chip>
                ))}
              </div>
              <div className="small dim" style={{ marginTop: 10 }}>{h.status}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
