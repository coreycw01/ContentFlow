import { useMemo, useState } from 'react';

import { CHANNELS } from '../../domain/channels';
import { scriptGate } from '../../domain/readiness';
import type { ArgumentMap, ContentProject, SectionAction } from '../../domain/types';
import { useStore } from '../../store/store';
import { Card, Chip, Empty, Field, LazyText, Modal, Tabs, Why, fmtDuration } from '../../ui/components';

const MAP_FIELDS: { key: keyof ArgumentMap; label: string }[] = [
  { key: 'hook', label: 'Hook' },
  { key: 'context', label: 'Context' },
  { key: 'coreClaim', label: 'Core claim' },
  { key: 'supportOne', label: 'Supporting point one' },
  { key: 'supportTwo', label: 'Supporting point two' },
  { key: 'personalStory', label: 'Personal story' },
  { key: 'objection', label: 'Objection' },
  { key: 'resolution', label: 'Resolution' },
  { key: 'finalTakeaway', label: 'Final takeaway' },
];

const ACTIONS: { id: SectionAction; label: string }[] = [
  { id: 'more-personal', label: 'More personal' },
  { id: 'more-precise', label: 'More precise' },
  { id: 'add-tension', label: 'Add tension' },
  { id: 'remove-repetition', label: 'Remove repetition' },
  { id: 'challenge-claim', label: 'Challenge this claim' },
  { id: 'add-example', label: 'Add an example' },
  { id: 'simplify', label: 'Simplify' },
  { id: 'more-conversational', label: 'More conversational' },
  { id: 'add-technical', label: 'Add technical explanation' },
  { id: 'add-humor', label: 'Add humour' },
  { id: 'connect-previous', label: 'Connect to previous' },
  { id: 'cut-20', label: 'Cut 20%' },
  { id: 'preserve-wording', label: 'Preserve my wording' },
];

type Level = 'map' | 'beats' | 'sections' | 'full';

export function ScriptTab({ projectId }: { projectId: string }) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId))!;
  const generateArgumentMap = useStore((s) => s.generateArgumentMap);
  const generateBeatSheet = useStore((s) => s.generateBeatSheet);
  const updateProject = useStore((s) => s.updateProject);
  const updateBeat = useStore((s) => s.updateBeat);
  const draftSection = useStore((s) => s.draftSection);
  const approveScript = useStore((s) => s.approveScript);
  const findShortsMoments = useStore((s) => s.findShortsMoments);
  const busy = useStore((s) => s.busy);

  const [level, setLevel] = useState<Level>(project.script.beats.length ? 'sections' : 'map');
  const [shorts, setShorts] = useState<string[] | null>(null);

  const ch = CHANNELS[project.channelId];
  const gate = scriptGate(project);
  const { argumentMap, beats } = project.script;

  const fullScript = useMemo(() => assembleScript(project), [project]);
  const drafted = beats.filter((b) => b.draft?.trim()).length;

  if (!gate.ok && !gate.overridable) {
    return (
      <Card title="Scripting is blocked" sub={`${ch.name} holds the line here.`}>
        {gate.blockers.map((b, i) => (
          <div key={i} className="blocker" style={{ marginBottom: 8 }}>
            {b}
          </div>
        ))}
        <Why>
          This is the one gate the app will not let you skip on this channel. A vague core argument produces a
          polished video that says nothing, and you will not notice until it is edited.
        </Why>
      </Card>
    );
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card
        title="Script Studio"
        sub={`${ch.scriptMode.scriptRequirement.replace('-', ' ')} · ${ch.scriptMode.structure.length} structural sections`}
        right={
          <div className="row">
            {beats.length > 0 && (
              <button className="btn" disabled={!!busy} onClick={async () => setShorts(await findShortsMoments(projectId))}>
                Find Shorts moments
              </button>
            )}
            <button className="btn primary" disabled={beats.length === 0} onClick={() => approveScript(projectId)}>
              Approve script
            </button>
          </div>
        }
      >
        <Why>
          Four levels, on purpose. Jumping straight to prose produces a script that sounds finished and argues
          nothing. Approving generates the production board from your actual beats.
        </Why>
        <div className="row" style={{ gap: 6 }}>
          <Chip>{beats.length} beats</Chip>
          <Chip>{drafted}/{beats.length} drafted</Chip>
          <Chip>{fmtDuration(project.script.estimatedDurationSeconds)} estimated</Chip>
          {project.script.approvedAt && <Chip tone="good">approved</Chip>}
        </div>
        {ch.scriptMode.avoid.length > 0 && (
          <div className="notice" style={{ marginTop: 12 }}>
            <strong>Never on {ch.name}: </strong>
            {ch.scriptMode.avoid.join(' · ')}
          </div>
        )}
      </Card>

      <Tabs<Level>
        tabs={[
          { id: 'map', label: 'Level 1 — Argument map' },
          { id: 'beats', label: 'Level 2 — Beat sheet' },
          { id: 'sections', label: 'Level 3 — Section drafts' },
          { id: 'full', label: 'Level 4 — Full script' },
        ]}
        active={level}
        onChange={setLevel}
      />

      {level === 'map' && (
        <Card
          title="Argument map"
          sub="Structure before prose."
          right={
            <button className="btn" disabled={!!busy} onClick={() => generateArgumentMap(projectId)}>
              {argumentMap ? 'Regenerate' : 'Build the argument map'}
            </button>
          }
        >
          {!argumentMap ? (
            <Empty>No argument map yet. This is level 1 of 4.</Empty>
          ) : (
            <div className="grid two">
              {MAP_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <LazyText
                    rows={2}
                    value={argumentMap[f.key]}
                    onCommit={(v) =>
                      updateProject(projectId, {
                        script: { ...project.script, argumentMap: { ...argumentMap, [f.key]: v } },
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          )}
        </Card>
      )}

      {level === 'beats' && (
        <Card
          title="Beat sheet"
          sub="Purpose, information, emotion, visual treatment, duration, transition and retention risk."
          right={
            <button className="btn" disabled={!!busy} onClick={() => generateBeatSheet(projectId)}>
              {beats.length ? 'Regenerate beats' : 'Generate the beat sheet'}
            </button>
          }
          flush
        >
          {beats.length === 0 ? (
            <Empty>No beats yet. This is level 2 of 4.</Empty>
          ) : (
            <div className="table-scroll" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Beat</th>
                    <th>Purpose</th>
                    <th>Emotion</th>
                    <th>Visual</th>
                    <th className="num">Duration</th>
                    <th>Transition</th>
                    <th>Retention risk</th>
                  </tr>
                </thead>
                <tbody>
                  {beats.map((b) => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 550 }}>{b.role}</td>
                      <td className="dim">{b.purpose}</td>
                      <td>{b.emotion}</td>
                      <td className="nowrap">{b.visualTreatment}</td>
                      <td className="num">
                        <input
                          type="number"
                          style={{ width: 62, textAlign: 'right' }}
                          value={b.durationSeconds}
                          onChange={(e) => updateBeat(projectId, b.id, { durationSeconds: Number(e.target.value) })}
                        />
                      </td>
                      <td className="dim">{b.transition}</td>
                      <td>
                        <Chip tone={b.retentionRisk === 'high' ? 'bad' : b.retentionRisk === 'medium' ? 'warn' : 'good'}>
                          {b.retentionRisk}
                        </Chip>
                        {b.retentionNote && <div className="small dim" style={{ marginTop: 4 }}>{b.retentionNote}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {level === 'sections' && (
        <div className="col" style={{ gap: 12 }}>
          {beats.length === 0 ? (
            <Empty>Build the beat sheet first.</Empty>
          ) : (
            beats.map((b, idx) => (
              <Card
                key={b.id}
                title={`${idx + 1}. ${b.role}`}
                sub={`${b.purpose} · ${fmtDuration(b.durationSeconds)} · ${b.emotion}`}
                right={
                  <div className="row">
                    <label className="row small dim" style={{ gap: 5 }}>
                      <input
                        type="checkbox"
                        checked={!!b.preserved}
                        onChange={(e) => updateBeat(projectId, b.id, { preserved: e.target.checked })}
                      />
                      Lock wording
                    </label>
                    <button
                      className="btn small"
                      disabled={!!busy}
                      onClick={() => draftSection(projectId, b.id)}
                    >
                      {b.draft ? 'Redraft' : 'Draft this section'}
                    </button>
                  </div>
                }
              >
                <LazyText
                  rows={b.draft ? Math.min(16, Math.max(4, b.draft.split('\n').length + 1)) : 4}
                  value={b.draft ?? ''}
                  placeholder={b.information}
                  onCommit={(v) => updateBeat(projectId, b.id, { draft: v })}
                />
                <div className="row optional-controls" style={{ gap: 5, marginTop: 10 }}>
                  {ACTIONS.map((a) => (
                    <button
                      key={a.id}
                      className="btn small ghost"
                      disabled={!!busy || !b.draft}
                      onClick={() => draftSection(projectId, b.id, a.id)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {level === 'full' && (
        <Card
          title="Full script"
          sub={`${fmtDuration(project.script.estimatedDurationSeconds)} estimated · ${project.script.chapterMarkers.length} chapters`}
          right={
            <button className="btn small" onClick={() => navigator.clipboard?.writeText(fullScript)}>
              Copy
            </button>
          }
        >
          {beats.length === 0 ? (
            <Empty>Nothing to assemble yet.</Empty>
          ) : (
            <div
              className="prose mono"
              style={{ background: 'var(--bg-sunken)', padding: 16, borderRadius: 6, fontSize: 12.5 }}
            >
              {fullScript}
            </div>
          )}
        </Card>
      )}

      {shorts && (
        <Modal title="Shorts extraction markers" onClose={() => setShorts(null)}>
          <ul className="small" style={{ paddingLeft: 16 }}>
            {shorts.map((s, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                {s}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function assembleScript(project: ContentProject): string {
  const lines: string[] = [];
  const selectedTitle = project.packaging.titles.find((t) => t.selected);
  lines.push(`# ${selectedTitle?.text ?? project.workingTitle}`);
  lines.push(`Channel: ${CHANNELS[project.channelId].name}`);
  lines.push(`Estimated duration: ${fmtDuration(project.script.estimatedDurationSeconds)}`);
  if (project.concept.coreArgument) lines.push(`Core argument: ${project.concept.coreArgument}`);
  lines.push('');

  let t = 0;
  for (const b of project.script.beats) {
    const start = t;
    t += b.durationSeconds;
    lines.push(`--- ${fmtDuration(start)}–${fmtDuration(t)} · ${b.role.toUpperCase()} ---`);
    lines.push('');
    lines.push(b.draft?.trim() || `[NOT DRAFTED] ${b.information}`);
    lines.push('');
    const meta: string[] = [];
    if (b.tracks.onScreenText) meta.push(`ON-SCREEN TEXT: ${b.tracks.onScreenText}`);
    if (b.tracks.graphics) meta.push(`GRAPHICS: ${b.tracks.graphics}`);
    if (b.tracks.bRoll.length)
      meta.push(`B-ROLL: ${b.tracks.bRoll.map((s) => `${s.description} (${s.treatment}${s.alreadyHave ? ', have it' : ''})`).join(' | ')}`);
    if (b.tracks.aRoll) meta.push(`CAMERA: ${b.tracks.aRoll}`);
    if (b.tracks.music) meta.push(`MUSIC: ${b.tracks.music}`);
    if (b.tracks.soundEffects) meta.push(`SFX: ${b.tracks.soundEffects}`);
    if (b.tracks.source) meta.push(`SOURCE: ${b.tracks.source}`);
    if (b.tracks.editingNote) meta.push(`EDIT: ${b.tracks.editingNote}`);
    if (b.transition) meta.push(`TRANSITION: ${b.transition}`);
    if (b.shortsCandidate) meta.push('SHORTS MARKER: candidate for vertical extraction');
    if (meta.length) {
      lines.push(...meta.map((m) => `  ${m}`));
      lines.push('');
    }
  }

  if (project.concept.memorableLine) {
    lines.push(`LINE THAT SHOULD SURVIVE: ${project.concept.memorableLine}`);
  }
  if (project.concept.honestLimitation) {
    lines.push(`STATED ON CAMERA — WHAT THIS CANNOT PROVE: ${project.concept.honestLimitation}`);
  }
  return lines.join('\n');
}
