import { useState } from 'react';

import { uid } from '../../ai/text';
import { ALL_BRAND_ASSOCIATIONS, CHANNELS } from '../../domain/channels';
import { assessCoreArgument, scriptGate } from '../../domain/readiness';
import type { EvidenceKind } from '../../domain/types';
import { useStore } from '../../store/store';
import { Card, Chip, Field, LazyText, Modal, Why } from '../../ui/components';
import { navigate } from '../../ui/router';

const EVIDENCE_KINDS: { id: EvidenceKind; label: string }[] = [
  { id: 'personal-experience', label: 'Personal experience' },
  { id: 'demonstration', label: 'Demonstration' },
  { id: 'source', label: 'Book or source' },
  { id: 'technical-explanation', label: 'Technical explanation' },
  { id: 'gameplay', label: 'Gameplay evidence' },
  { id: 'cultural-context', label: 'Film scene / cultural context' },
  { id: 'counterexample', label: 'Counterexample' },
];

const FIELDS: { key: keyof typeof PROMPTS; label: string; rows?: number }[] = [
  { key: 'coreArgument', label: 'Core argument', rows: 3 },
  { key: 'viewerTransformation', label: 'Viewer transformation' },
  { key: 'startingBelief', label: 'Starting belief' },
  { key: 'endingBelief', label: 'Ending belief' },
  { key: 'personalStake', label: 'Personal stake' },
  { key: 'tension', label: 'Tension' },
  { key: 'counterargument', label: 'Counterargument' },
  { key: 'honestLimitation', label: 'Honest limitation' },
  { key: 'memorableLine', label: 'Memorable line' },
];

const PROMPTS = {
  coreArgument: 'What exactly is the video saying? A claim, not a topic.',
  viewerTransformation: 'What should the viewer understand, feel or do differently afterwards?',
  startingBelief: 'What does the viewer likely believe before watching?',
  endingBelief: 'What should replace or complicate that belief?',
  personalStake: 'Why does this matter to you?',
  tension: 'What contradiction keeps the video alive?',
  counterargument: 'What would an intelligent skeptic say?',
  honestLimitation: 'What can this video not prove?',
  memorableLine: 'What sentence should survive after the video ends?',
} as const;

export function ConceptTab({ projectId }: { projectId: string }) {
  const project = useStore((s) => s.projects.find((p) => p.id === projectId))!;
  const updateConcept = useStore((s) => s.updateConcept);
  const updateProject = useStore((s) => s.updateProject);
  const developConcept = useStore((s) => s.developConcept);
  const challengePremise = useStore((s) => s.challengePremise);
  const library = useStore((s) => s.library);
  const busy = useStore((s) => s.busy);

  const [challenge, setChallenge] = useState<string | null>(null);
  const [newEvidence, setNewEvidence] = useState<{ kind: EvidenceKind; detail: string }>({
    kind: 'personal-experience',
    detail: '',
  });

  const ch = CHANNELS[project.channelId];
  const quality = assessCoreArgument(project.concept.coreArgument);
  const gate = scriptGate(project);

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card
        title="Concept canvas"
        sub="A topic becomes an argument here. Everything downstream inherits whatever you write."
        right={
          <div className="row">
            <button className="btn" disabled={!!busy} onClick={() => developConcept(projectId)}>
              Develop with AI
            </button>
            <button
              className="btn primary"
              disabled={!gate.ok && !gate.overridable}
              onClick={() => navigate(`/project/${projectId}/packaging`)}
            >
              Package it
            </button>
          </div>
        }
      >
        <Why>
          Script generation is blocked while the core argument is vague. Without a specific claim the engine can
          only produce five minutes of polished repetition.
        </Why>

        <div
          className={quality.vague ? 'blocker' : 'notice'}
          style={{ marginBottom: 14 }}
        >
          <strong>Core argument specificity: {quality.score}/100. </strong>
          {quality.problems.length ? quality.problems.join(' ') : 'Specific enough to script from.'}
        </div>

        <div className="grid two">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={PROMPTS[f.key]}>
              <LazyText
                rows={f.rows ?? 2}
                value={project.concept[f.key]}
                onCommit={(v) => updateConcept(projectId, { [f.key]: v })}
              />
            </Field>
          ))}
        </div>

        <div className="row optional-controls">
          <button className="btn small ghost" disabled={!!busy} onClick={async () => setChallenge(await challengePremise(projectId))}>
            Challenge this premise
          </button>
        </div>
      </Card>

      <Card title="Evidence" sub="What actually supports the claim. An empty list is a real problem on this channel.">
        {project.concept.evidence.length === 0 ? (
          <div className="small dim" style={{ marginBottom: 12 }}>
            No evidence attached yet.{' '}
            {ch.gates.requireEvidence && <strong>{ch.name} blocks scripting until at least one item exists.</strong>}
          </div>
        ) : (
          <div className="col" style={{ gap: 6, marginBottom: 12 }}>
            {project.concept.evidence.map((e) => (
              <div key={e.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small">
                  <Chip>{EVIDENCE_KINDS.find((k) => k.id === e.kind)?.label ?? e.kind}</Chip> {e.detail}
                </span>
                <button
                  className="btn small ghost danger"
                  onClick={() =>
                    updateConcept(projectId, {
                      evidence: project.concept.evidence.filter((x) => x.id !== e.id),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="row" style={{ gap: 8 }}>
          <select
            style={{ width: 220 }}
            value={newEvidence.kind}
            onChange={(e) => setNewEvidence({ ...newEvidence, kind: e.target.value as EvidenceKind })}
          >
            {EVIDENCE_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            style={{ flex: 1 }}
            value={newEvidence.detail}
            placeholder="What is the evidence?"
            onChange={(e) => setNewEvidence({ ...newEvidence, detail: e.target.value })}
          />
          <button
            className="btn"
            disabled={!newEvidence.detail.trim()}
            onClick={() => {
              updateConcept(projectId, {
                evidence: [
                  ...project.concept.evidence,
                  { id: uid('ev'), kind: newEvidence.kind, detail: newEvidence.detail.trim() },
                ],
              });
              setNewEvidence({ ...newEvidence, detail: '' });
            }}
          >
            Add
          </button>
        </div>

        {ch.workspace.features.personalStoryLibrary && (
          <div style={{ marginTop: 14 }}>
            <div className="small dim" style={{ marginBottom: 6 }}>Attach an unused personal story from the library:</div>
            <div className="row" style={{ gap: 6 }}>
              {library
                .filter((e) => e.type === 'personal-story' && !e.used)
                .slice(0, 6)
                .map((e) => (
                  <button
                    key={e.id}
                    className="btn small ghost"
                    onClick={() =>
                      updateConcept(projectId, {
                        evidence: [
                          ...project.concept.evidence,
                          { id: uid('ev'), kind: 'personal-experience', detail: e.title, entryId: e.id },
                        ],
                      })
                    }
                  >
                    {e.title}
                  </button>
                ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="Brand associations" sub="What this video is meant to strengthen. Feeds the brand map.">
        <div className="row" style={{ gap: 6 }}>
          {ALL_BRAND_ASSOCIATIONS.map((a) => {
            const on = project.brandAssociations.includes(a);
            return (
              <button
                key={a}
                className={`btn small${on ? ' primary' : ''}`}
                onClick={() =>
                  updateProject(projectId, {
                    brandAssociations: on
                      ? project.brandAssociations.filter((x) => x !== a)
                      : [...project.brandAssociations, a],
                  })
                }
              >
                {a}
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Notes">
        <LazyText rows={4} value={project.notes} onCommit={(v) => updateProject(projectId, { notes: v })} />
      </Card>

      {challenge && (
        <Modal title="An intelligent skeptic reads your argument" onClose={() => setChallenge(null)}>
          <div className="prose">{challenge}</div>
        </Modal>
      )}
    </div>
  );
}
