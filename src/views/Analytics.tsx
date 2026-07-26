import { useMemo } from 'react';

import { CHANNELS, CHANNEL_IDS } from '../domain/channels';
import { fmt } from '../domain/review';
import { useStore } from '../store/store';
import { Card, Chip, Empty, Stat, Why } from '../ui/components';
import { navigate } from '../ui/router';

export function AnalyticsView() {
  const projects = useStore((s) => s.projects);
  const reviewed = useMemo(() => projects.filter((p) => p.review), [projects]);

  const totals = useMemo(() => {
    const r = reviewed.map((p) => p.review!.inputs);
    const views = r.reduce((a, x) => a + x.views, 0);
    const subs = r.reduce((a, x) => a + x.subscribersGained, 0);
    const avgCtr = r.length ? r.reduce((a, x) => a + x.clickThroughRate, 0) / r.length : 0;
    const avgSat = r.length ? r.reduce((a, x) => a + x.creatorSatisfaction, 0) / r.length : 0;
    const unsustainable = r.filter((x) => !x.processSustainable).length;
    return { views, subs, avgCtr, avgSat, unsustainable };
  }, [reviewed]);

  if (reviewed.length === 0) {
    return (
      <Empty>
        No reviews yet. Publish a project, then enter its performance data on the project's Review tab. Analytics
        here are computed from what you enter — the app does not connect to YouTube.
      </Empty>
    );
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="grid four">
        <Card><Stat n={totals.views.toLocaleString()} k="Total views" /></Card>
        <Card><Stat n={`${totals.avgCtr.toFixed(1)}%`} k="Average CTR" /></Card>
        <Card><Stat n={totals.subs.toLocaleString()} k="Subscribers gained" /></Card>
        <Card><Stat n={`${totals.avgSat.toFixed(1)}/10`} k="Average satisfaction" /></Card>
      </div>

      {totals.unsustainable > 0 && (
        <Card title="Sustainability" sub="The metric nobody else tracks.">
          <div className="notice">
            {totals.unsustainable} of {reviewed.length} reviewed videos were marked as an unsustainable process. A
            format that only works when you have a free weekend is not a format yet.
          </div>
        </Card>
      )}

      <Card title="Per-video results" sub="Packaging, content, brand and creator — kept separate on purpose." flush>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Video</th>
                <th>Channel</th>
                <th className="num">Views</th>
                <th className="num">CTR</th>
                <th className="num">AVD</th>
                <th className="num">Subs</th>
                <th className="num">Return %</th>
                <th className="num">Satisfaction</th>
                <th>Hook matched</th>
              </tr>
            </thead>
            <tbody>
              {reviewed.map((p) => {
                const i = p.review!.inputs;
                return (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/project/${p.id}/review`)}>
                    <td>{p.workingTitle}</td>
                    <td className="nowrap">{CHANNELS[p.channelId].name}</td>
                    <td className="num">{i.views.toLocaleString()}</td>
                    <td className="num">{i.clickThroughRate.toFixed(1)}%</td>
                    <td className="num">{fmt(i.averageViewDurationSeconds)}</td>
                    <td className="num">{i.subscribersGained}</td>
                    <td className="num">{i.returningViewerPercent}%</td>
                    <td className="num">{i.creatorSatisfaction}/10</td>
                    <td>
                      <Chip tone={p.review!.hookMatchedVideo ? 'good' : 'bad'}>
                        {p.review!.hookMatchedVideo ? 'yes' : 'no'}
                      </Chip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="By channel" sub="Averages only mean something within a channel — these four are not comparable.">
        <Why>
          Comparing CDogg's CTR to Corey Williams' CTR would be a category error. They are optimising for
          different things, and one of them is deliberately not optimising at all.
        </Why>
        <div className="grid four">
          {CHANNEL_IDS.map((cid) => {
            const mine = reviewed.filter((p) => p.channelId === cid);
            if (mine.length === 0) {
              return (
                <Card key={cid} title={CHANNELS[cid].name}>
                  <span className="dim small">No reviewed videos.</span>
                </Card>
              );
            }
            const avgCtr = mine.reduce((a, p) => a + p.review!.inputs.clickThroughRate, 0) / mine.length;
            const avgSat = mine.reduce((a, p) => a + p.review!.inputs.creatorSatisfaction, 0) / mine.length;
            const views = mine.reduce((a, p) => a + p.review!.inputs.views, 0);
            return (
              <Card key={cid} title={CHANNELS[cid].name} sub={`${mine.length} reviewed`}>
                <div className="col small" style={{ gap: 4 }}>
                  <div>Views: {views.toLocaleString()}</div>
                  <div>CTR: {avgCtr.toFixed(1)}%</div>
                  <div>Satisfaction: {avgSat.toFixed(1)}/10</div>
                  {CHANNELS[cid].viralityPolicy === 'advisory' && (
                    <div className="dim" style={{ marginTop: 4 }}>
                      Numbers here are context, not targets.
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </Card>

      <Card title="Accumulated lessons" sub="Everything the review loop has learned. These feed idea generation.">
        <ul className="small" style={{ margin: 0, paddingLeft: 16 }}>
          {reviewed.flatMap((p) =>
            p.review!.changeNextTime.map((c, i) => (
              <li key={`${p.id}_${i}`} style={{ marginBottom: 6 }}>
                {c} <span className="dim">— {p.workingTitle}</span>
              </li>
            )),
          )}
        </ul>
      </Card>
    </div>
  );
}
