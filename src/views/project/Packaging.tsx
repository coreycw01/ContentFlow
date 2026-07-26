import { useState } from 'react';

import { CHANNELS } from '../../domain/channels';
import { useStore } from '../../store/store';
import { Card, Chip, Empty, Modal, Why } from '../../ui/components';
import { navigate } from '../../ui/router';

const CHECK_LABELS: { key: string; label: string; goodWhenTrue: boolean }[] = [
  { key: 'clearPromise', label: 'Promise is clear', goodWhenTrue: true },
  { key: 'curiosityGap', label: 'Meaningful curiosity gap', goodWhenTrue: true },
  { key: 'overpromises', label: 'Overpromises', goodWhenTrue: false },
  { key: 'soundsLikeCorey', label: 'Sounds like Corey', goodWhenTrue: true },
  { key: 'concreteLanguage', label: 'Concrete language', goodWhenTrue: true },
  { key: 'interchangeable', label: 'Interchangeable with anyone', goodWhenTrue: false },
];

export function PackagingTab({ projectId }: { projectId: string }) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId))!;
  const generatePackaging = useStore((s) => s.generatePackaging);
  const selectTitle = useStore((s) => s.selectTitle);
  const selectHook = useStore((s) => s.selectHook);
  const selectThumbnail = useStore((s) => s.selectThumbnail);
  const checkTitleDelivery = useStore((s) => s.checkTitleDelivery);
  const busy = useStore((s) => s.busy);

  const [prompt, setPrompt] = useState<string | null>(null);
  const { titles, hooks, thumbnails, curiosityGaps, stakes, emotionalFraming } = project.packaging;
  const ch = CHANNELS[project.channelId];
  const selected = titles.find((t) => t.selected);

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card
        title="Virality Workshop"
        sub="Packaging plus viewer psychology — not magical prediction."
        right={
          <div className="row">
            <button className="btn" disabled={!!busy} onClick={() => generatePackaging(projectId)}>
              {titles.length ? 'Regenerate' : 'Generate packaging'}
            </button>
            <button
              className="btn primary"
              disabled={!selected}
              onClick={() => navigate(`/project/${projectId}/script`)}
            >
              Build the script
            </button>
          </div>
        }
      >
        <Why>
          The title is decided before the script so the script has a promise to keep. Writing the video first and
          then hunting for a title is how a video ends up promising something it never delivers.
        </Why>
        {ch.viralityPolicy === 'advisory' && (
          <div className="notice">
            On {ch.name}, packaging is optional. A title and thumbnail help people find it, but nothing here is a
            performance obligation.
          </div>
        )}
      </Card>

      {titles.length === 0 ? (
        <Empty>No packaging yet. Generate ten title directions, five hooks and three thumbnail concepts.</Empty>
      ) : (
        <>
          <Card title={`${titles.length} title directions`} sub="Sorted by quality score. Select one.">
            <div className="col" style={{ gap: 10 }}>
              {titles.map((t) => (
                <div
                  key={t.id}
                  className="card"
                  style={{
                    padding: 12,
                    margin: 0,
                    borderColor: t.selected ? 'var(--accent)' : undefined,
                    background: t.selected ? 'var(--accent-soft)' : 'var(--panel-2)',
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 550, fontSize: 14 }}>{t.text}</div>
                      <div className="row" style={{ gap: 4, marginTop: 6 }}>
                        <Chip>{t.angle}</Chip>
                        {CHECK_LABELS.map((c) => {
                          const val = (t.checks as unknown as Record<string, boolean>)[c.key];
                          if (val === undefined) return null;
                          const good = c.goodWhenTrue ? val : !val;
                          if (!val && !c.goodWhenTrue) return null;
                          if (!val && c.goodWhenTrue) {
                            return (
                              <Chip key={c.key} tone="warn">
                                no {c.label.toLowerCase()}
                              </Chip>
                            );
                          }
                          return (
                            <Chip key={c.key} tone={good ? 'good' : 'bad'}>
                              {c.label}
                            </Chip>
                          );
                        })}
                        {t.checks.deliveredByScript === true && <Chip tone="good">script delivers it</Chip>}
                        {t.checks.deliveredByScript === false && <Chip tone="bad">script does not deliver it</Chip>}
                      </div>
                      {t.checks.notes.length > 0 && (
                        <ul className="warning-list">
                          {t.checks.notes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="col" style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Chip tone="accent">{t.score}</Chip>
                      <button
                        className={`btn small${t.selected ? ' primary' : ''}`}
                        onClick={() => selectTitle(projectId, t.id)}
                      >
                        {t.selected ? 'Selected' : 'Use this'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selected && project.script.beats.length > 0 && (
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn" disabled={!!busy} onClick={() => checkTitleDelivery(projectId)}>
                  Check whether the script fulfills the title
                </button>
              </div>
            )}
          </Card>

          <Card title="Hooks" sub="The first fifteen seconds decide everything after them.">
            <div className="col" style={{ gap: 10 }}>
              {hooks.map((h) => (
                <div
                  key={h.id}
                  className="card"
                  style={{
                    padding: 12,
                    margin: 0,
                    background: h.selected ? 'var(--accent-soft)' : 'var(--panel-2)',
                    borderColor: h.selected ? 'var(--accent)' : undefined,
                  }}
                >
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div className="small">{h.text}</div>
                      <div className="small dim" style={{ marginTop: 4 }}>Mechanism: {h.mechanism}</div>
                    </div>
                    <button
                      className={`btn small${h.selected ? ' primary' : ''}`}
                      onClick={() => selectHook(projectId, h.id)}
                    >
                      {h.selected ? 'Selected' : 'Use'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Thumbnail concepts" sub="Each one includes what the thumbnail asks and what only the title answers.">
            <div className="grid three">
              {thumbnails.map((t) => (
                <div
                  key={t.id}
                  className="card"
                  style={{
                    margin: 0,
                    background: t.selected ? 'var(--accent-soft)' : 'var(--panel-2)',
                    borderColor: t.selected ? 'var(--accent)' : undefined,
                  }}
                >
                  <div style={{ fontWeight: 550, marginBottom: 8 }}>{t.mainVisual}</div>
                  {t.text && (
                    <div
                      className="mono"
                      style={{ fontSize: 16, letterSpacing: '0.04em', margin: '8px 0', color: 'var(--accent)' }}
                    >
                      "{t.text}"
                    </div>
                  )}
                  <dl className="small" style={{ margin: 0 }}>
                    {[
                      ['Subject', t.subject],
                      ['Background', t.background],
                      ['Focal object', t.focalObject],
                      ['Composition', t.composition],
                      ['Contrast', t.contrastConcept],
                      ['Stops the scroll because', t.scrollStopReason],
                      ['Question it creates', t.questionCreated],
                      ['Only the title answers', t.titleAnswersWhat],
                    ].map(([k, v]) => (
                      <div key={k} style={{ marginBottom: 5 }}>
                        <span className="dim">{k}: </span>
                        {v}
                      </div>
                    ))}
                  </dl>
                  <div className="row" style={{ marginTop: 10 }}>
                    <button
                      className={`btn small${t.selected ? ' primary' : ''}`}
                      onClick={() => selectThumbnail(projectId, t.id)}
                    >
                      {t.selected ? 'Selected' : 'Use'}
                    </button>
                    <button className="btn small ghost" onClick={() => setPrompt(t.imagePrompt)}>
                      Image prompt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid three">
            <Card title="Curiosity gaps">
              <ul className="small" style={{ margin: 0, paddingLeft: 16 }}>
                {curiosityGaps.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </Card>
            <Card title="Stakes">
              <ul className="small" style={{ margin: 0, paddingLeft: 16 }}>
                {stakes.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </Card>
            <Card title="Emotional framing">
              <ul className="small" style={{ margin: 0, paddingLeft: 16 }}>
                {emotionalFraming.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}

      {prompt && (
        <Modal title="Image generation prompt" onClose={() => setPrompt(null)}>
          <div className="mono prose" style={{ background: 'var(--bg-sunken)', padding: 12, borderRadius: 6 }}>
            {prompt}
          </div>
          <button
            className="btn small"
            style={{ marginTop: 12 }}
            onClick={() => navigator.clipboard?.writeText(prompt)}
          >
            Copy
          </button>
        </Modal>
      )}
    </div>
  );
}
