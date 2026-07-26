import { useState } from 'react';

import { uid } from '../../ai/text';
import { CHANNELS } from '../../domain/channels';
import type { BeatTracks, VisualTreatment } from '../../domain/types';
import { useStore } from '../../store/store';
import { Card, Chip, Empty, LazyInput, Modal, Why, fmtDuration } from '../../ui/components';

const TREATMENTS: { id: VisualTreatment; label: string; note: string }[] = [
  { id: 'a-roll', label: 'A-roll', note: 'You, on camera.' },
  { id: 'existing-footage', label: 'Existing footage', note: 'Already on disk.' },
  { id: 'easy-to-record', label: 'Easy to record', note: 'Ten minutes with the camera.' },
  { id: 'archival', label: 'Archival personal', note: 'Old footage from the period described.' },
  { id: 'screen-recording', label: 'Screen recording', note: 'Capture from the machine.' },
  { id: 'gameplay', label: 'Gameplay', note: 'Pulled from a recorded session.' },
  { id: 'project-closeup', label: 'Project closeup', note: 'Macro on the work.' },
  { id: 'generated-image', label: 'Generated image', note: 'From a saved prompt.' },
  { id: 'diagram', label: 'Diagram', note: 'Built in post.' },
  { id: 'stock', label: 'Stock', note: 'Last resort.' },
  { id: 'text-only', label: 'Text only', note: 'Full-frame card.' },
  { id: 'no-b-roll', label: 'No B-roll', note: 'Deliberate stillness. Hold on the face.' },
];

const TRACK_ROWS: { key: keyof BeatTracks; label: string }[] = [
  { key: 'aRoll', label: 'A-roll' },
  { key: 'onScreenText', label: 'On-screen text' },
  { key: 'graphics', label: 'Graphics' },
  { key: 'music', label: 'Music' },
  { key: 'soundEffects', label: 'Sound FX' },
  { key: 'source', label: 'Source' },
  { key: 'editingNote', label: 'Editing note' },
];

export function TimelineTab({ projectId }: { projectId: string }) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId))!;
  const updateBeat = useStore((s) => s.updateBeat);
  const suggestBRoll = useStore((s) => s.suggestBRoll);
  const addBRoll = useStore((s) => s.addBRoll);
  const removeBRoll = useStore((s) => s.removeBRoll);
  const busy = useStore((s) => s.busy);

  const [prompt, setPrompt] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const ch = CHANNELS[project.channelId];
  const beats = project.script.beats;

  if (beats.length === 0) {
    return (
      <Empty>
        The timeline is built from your beat sheet. <a href={`#/project/${projectId}/script`}>Generate beats first.</a>
      </Empty>
    );
  }

  const coverage = beats.filter((b) => b.tracks.bRoll.some((s) => s.treatment !== 'no-b-roll')).length;
  const stillness = beats.filter((b) => b.tracks.bRoll.some((s) => s.treatment === 'no-b-roll')).length;
  const haveAlready = beats.reduce((n, b) => n + b.tracks.bRoll.filter((s) => s.alreadyHave).length, 0);
  const needToGet = beats.reduce((n, b) => n + b.tracks.bRoll.filter((s) => !s.alreadyHave).length, 0);

  let clock = 0;

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card title="Visual timeline" sub={`${beats.length} beats · ${fmtDuration(project.script.estimatedDurationSeconds)}`}>
        <Why>
          Constant B-roll is not automatically good editing. Some moments — usually the ones where you are asking
          the viewer to trust you — are stronger held on the face with nothing over them.
        </Why>
        <div className="row" style={{ gap: 6 }}>
          <Chip>{coverage} beats covered</Chip>
          <Chip tone={stillness > 0 ? 'good' : 'warn'}>{stillness} deliberate stillness</Chip>
          <Chip tone="good">{haveAlready} shots you already have</Chip>
          <Chip tone="warn">{needToGet} shots to get</Chip>
        </div>
      </Card>

      <Card title="Timeline" flush>
        <div className="timeline" style={{ padding: '0 16px 16px' }}>
          {beats.map((b, idx) => {
            const start = clock;
            clock += b.durationSeconds;
            return (
              <div key={b.id} className="tl-beat">
                <div>
                  <div className="tl-time">
                    {fmtDuration(start)}
                    <br />
                    {fmtDuration(clock)}
                  </div>
                  <div className="small" style={{ marginTop: 6, fontWeight: 550 }}>
                    {idx + 1}. {b.role}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Chip tone={b.retentionRisk === 'high' ? 'bad' : b.retentionRisk === 'medium' ? 'warn' : undefined}>
                      {b.retentionRisk} risk
                    </Chip>
                  </div>
                  {ch.workspace.features.shortsGenerator && (
                    <label className="row small dim" style={{ gap: 4, marginTop: 6 }}>
                      <input
                        type="checkbox"
                        checked={!!b.shortsCandidate}
                        onChange={(e) => updateBeat(projectId, b.id, { shortsCandidate: e.target.checked })}
                      />
                      Short
                    </label>
                  )}
                </div>

                <div className="tl-tracks">
                  <div className="tl-track">
                    <div className="k">Dialogue</div>
                    <div className="small" style={{ whiteSpace: 'pre-wrap' }}>
                      {b.draft?.trim() || <span className="dim">{b.information}</span>}
                    </div>
                  </div>

                  <div className="tl-track">
                    <div className="k">B-roll</div>
                    <div className="col" style={{ gap: 5 }}>
                      {b.tracks.bRoll.length === 0 && <span className="small dim">Nothing planned.</span>}
                      {b.tracks.bRoll.map((s) => (
                        <div key={s.id} className="row" style={{ gap: 6, justifyContent: 'space-between' }}>
                          <span className="small">
                            <Chip tone={s.treatment === 'no-b-roll' ? 'accent' : s.alreadyHave ? 'good' : undefined}>
                              {s.treatment}
                            </Chip>{' '}
                            {s.description}
                          </span>
                          <span className="row" style={{ gap: 4 }}>
                            {s.imagePrompt && (
                              <button className="btn small ghost" onClick={() => setPrompt(s.imagePrompt!)}>
                                Prompt
                              </button>
                            )}
                            <button className="btn small ghost danger" onClick={() => removeBRoll(projectId, b.id, s.id)}>
                              ×
                            </button>
                          </span>
                        </div>
                      ))}
                      <div className="row optional-controls" style={{ gap: 5 }}>
                        <button
                          className="btn small ghost"
                          disabled={!!busy}
                          onClick={() => suggestBRoll(projectId, b.id)}
                        >
                          Suggest visuals
                        </button>
                        <button className="btn small ghost" onClick={() => setAdding(b.id)}>
                          Add manually
                        </button>
                      </div>
                    </div>
                  </div>

                  {TRACK_ROWS.map((row) => (
                    <div key={row.key} className="tl-track">
                      <div className="k">{row.label}</div>
                      <LazyInput
                        value={b.tracks[row.key] as string}
                        placeholder="—"
                        onCommit={(v) => updateBeat(projectId, b.id, { tracks: { ...b.tracks, [row.key]: v } })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {prompt && (
        <Modal title="Image generation prompt" onClose={() => setPrompt(null)}>
          <div className="mono prose" style={{ background: 'var(--bg-sunken)', padding: 12, borderRadius: 6 }}>
            {prompt}
          </div>
          <button className="btn small" style={{ marginTop: 12 }} onClick={() => navigator.clipboard?.writeText(prompt)}>
            Copy
          </button>
        </Modal>
      )}

      {adding && (
        <AddBRollModal
          onClose={() => setAdding(null)}
          onAdd={(treatment, description, alreadyHave) => {
            addBRoll(projectId, adding, { id: uid('broll'), treatment, description, alreadyHave });
            setAdding(null);
          }}
        />
      )}
    </div>
  );
}

function AddBRollModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (t: VisualTreatment, d: string, have: boolean) => void;
}) {
  const [treatment, setTreatment] = useState<VisualTreatment>('easy-to-record');
  const [description, setDescription] = useState('');
  const [have, setHave] = useState(false);
  const def = TREATMENTS.find((t) => t.id === treatment)!;

  return (
    <Modal title="Add a visual" onClose={onClose}>
      <label className="field">
        <span>Treatment</span>
        <select value={treatment} onChange={(e) => setTreatment(e.target.value as VisualTreatment)}>
          {TREATMENTS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="small dim" style={{ marginTop: 4 }}>{def.note}</div>
      </label>
      <label className="field">
        <span>Description</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
      </label>
      <label className="row small" style={{ gap: 6, marginBottom: 14 }}>
        <input type="checkbox" checked={have} onChange={(e) => setHave(e.target.checked)} />
        I already have this
      </label>
      <button className="btn primary" disabled={!description.trim()} onClick={() => onAdd(treatment, description.trim(), have)}>
        Add to timeline
      </button>
    </Modal>
  );
}
