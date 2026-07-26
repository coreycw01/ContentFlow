import { useState } from 'react';

import { CHANNELS } from '../../domain/channels';
import { emptyPerformanceInputs } from '../../domain/review';
import type { PerformanceInputs } from '../../domain/types';
import { useStore } from '../../store/store';
import { Card, Chip, Field, Modal, Why } from '../../ui/components';

const NUMERIC: { key: keyof PerformanceInputs; label: string; step?: number }[] = [
  { key: 'views', label: 'Views' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clickThroughRate', label: 'Click-through rate (%)', step: 0.1 },
  { key: 'averageViewDurationSeconds', label: 'Average view duration (s)' },
  { key: 'subscribersGained', label: 'Subscribers gained' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
  { key: 'likes', label: 'Likes' },
  { key: 'returningViewerPercent', label: 'Returning viewers (%)' },
  { key: 'shortsViews', label: 'Shorts views' },
];

export function ReviewTab({ projectId }: { projectId: string }) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId))!;
  const saveReview = useStore((s) => s.saveReview);
  const explainProject = useStore((s) => s.runCommand);
  const busy = useStore((s) => s.busy);

  const [inputs, setInputs] = useState<PerformanceInputs>(project.review?.inputs ?? emptyPerformanceInputs());
  const [comments, setComments] = useState((project.review?.inputs.notableComments ?? []).join('\n'));
  const [explanation, setExplanation] = useState<string | null>(null);

  const ch = CHANNELS[project.channelId];
  const review = project.review;

  const set = (k: keyof PerformanceInputs, v: number | boolean | string) =>
    setInputs((p) => ({ ...p, [k]: v }));

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card
        title="Performance learning loop"
        sub="Four separate results, deliberately not collapsed into one number."
        right={
          <button
            className="btn primary"
            onClick={() =>
              saveReview(projectId, {
                ...inputs,
                notableComments: comments.split('\n').map((c) => c.trim()).filter(Boolean),
              })
            }
          >
            {review ? 'Recalculate review' : 'Run the review'}
          </button>
        }
      >
        <Why>
          A video can underperform numerically and still be strategically valuable. A viral video can damage a
          channel by attracting the wrong audience. That is why the creator result is a first-class metric here,
          not a footnote.
        </Why>

        <div className="grid four">
          {NUMERIC.map((n) => (
            <Field key={n.key} label={n.label}>
              <input
                type="number"
                step={n.step ?? 1}
                value={inputs[n.key] as number}
                onChange={(e) => set(n.key, Number(e.target.value))}
              />
            </Field>
          ))}
          <Field label="Traffic source">
            <select value={inputs.trafficSource} onChange={(e) => set('trafficSource', e.target.value)}>
              {['Browse', 'Suggested', 'Search', 'External', 'Shorts feed', 'Subscriptions'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid two">
          <Field label={`Your satisfaction — ${inputs.creatorSatisfaction}/10`} hint="This counts as much as the retention graph.">
            <input
              type="range"
              min={1}
              max={10}
              value={inputs.creatorSatisfaction}
              onChange={(e) => set('creatorSatisfaction', Number(e.target.value))}
            />
          </Field>
          <Field label="Process" hint="If the format only works when you have a free weekend, it is not a format yet.">
            <label className="row small" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={inputs.processSustainable}
                onChange={(e) => set('processSustainable', e.target.checked)}
              />
              The process was sustainable
            </label>
          </Field>
        </div>

        <Field label="Retention curve" hint="Percent still watching, sampled evenly. Comma-separated.">
          <input
            value={inputs.retentionCurve.join(', ')}
            onChange={(e) =>
              setInputs((p) => ({
                ...p,
                retentionCurve: e.target.value
                  .split(',')
                  .map((v) => Number(v.trim()))
                  .filter((v) => !Number.isNaN(v)),
              }))
            }
          />
        </Field>

        <Field label="Notable comments" hint="One per line. Audience language feeds future packaging.">
          <textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
        </Field>
      </Card>

      {review && (
        <>
          <div className="grid two">
            <Card title="Packaging result" sub="Did people click?">
              <p className="prose" style={{ margin: 0 }}>{review.packagingResult}</p>
            </Card>
            <Card title="Content result" sub="Did they keep watching?">
              <p className="prose" style={{ margin: 0 }}>{review.contentResult}</p>
            </Card>
            <Card title="Brand result" sub="Did it strengthen the intended identity?">
              <p className="prose" style={{ margin: 0 }}>{review.brandResult}</p>
              {ch.viralityPolicy === 'advisory' && (
                <div className="notice" style={{ marginTop: 10 }}>
                  Numbers on {ch.name} are context, not a target.
                </div>
              )}
            </Card>
            <Card title="Creator result" sub="Were you proud of it, and was the process sustainable?">
              <p className="prose" style={{ margin: 0 }}>{review.creatorResult}</p>
            </Card>
          </div>

          <div className="grid two">
            <Card title="What worked">
              {review.whatWorked.length === 0 ? (
                <span className="dim small">Nothing stood out as a clear win.</span>
              ) : (
                <ul className="small" style={{ margin: 0, paddingLeft: 16 }}>
                  {review.whatWorked.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="What failed">
              {review.whatFailed.length === 0 ? (
                <span className="dim small">Nothing clearly failed.</span>
              ) : (
                <ul className="small" style={{ margin: 0, paddingLeft: 16 }}>
                  {review.whatFailed.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card
            title="Learning outputs"
            sub="These feed straight back into idea generation."
            right={
              <button
                className="btn"
                disabled={!!busy}
                onClick={async () =>
                  setExplanation(
                    await explainProject('Analyze why this published video performed the way it did, and what to change next time.', projectId),
                  )
                }
              >
                Analyze in depth
              </button>
            }
          >
            <div className="row" style={{ gap: 6, marginBottom: 12 }}>
              <Chip tone={review.hookMatchedVideo ? 'good' : 'bad'}>
                {review.hookMatchedVideo ? 'Hook matched the video' : 'Hook did not match the video'}
              </Chip>
              {review.reusableClips.length > 0 && <Chip>{review.reusableClips.length} reusable clips</Chip>}
            </div>

            {review.changeNextTime.length > 0 && (
              <>
                <div className="small dim" style={{ marginBottom: 6 }}>Change next time:</div>
                <ul className="small" style={{ margin: '0 0 12px', paddingLeft: 16 }}>
                  {review.changeNextTime.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </>
            )}

            {review.audienceLanguage.length > 0 && (
              <>
                <div className="small dim" style={{ marginBottom: 6 }}>Audience language worth reusing:</div>
                <ul className="small" style={{ margin: 0, paddingLeft: 16 }}>
                  {review.audienceLanguage.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </>
      )}

      {explanation && (
        <Modal title="Why it performed the way it did" onClose={() => setExplanation(null)}>
          <div className="prose">{explanation}</div>
        </Modal>
      )}
    </div>
  );
}
