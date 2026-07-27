import { useMemo, useState } from 'react';

import { CHANNELS, CHANNEL_IDS, topWeightedDimensions } from '../domain/channels';
import { effortLabel } from '../domain/scoring';
import { SEED_BANK, rollSeed } from '../domain/seeds';
import type { ChannelId, ContentGoal, Idea, IdeaOrigin, RejectionReason } from '../domain/types';
import { useStore } from '../store/store';
import { Card, Chip, Empty, Field, Modal, ScoreGrid, Why } from '../ui/components';
import { navigate } from '../ui/router';

const GOALS: { id: ContentGoal; label: string }[] = [
  { id: 'authority', label: 'Build authority' },
  { id: 'audience', label: 'Build audience' },
  { id: 'connection', label: 'Strengthen viewer connection' },
  { id: 'evergreen', label: 'Searchable evergreen' },
  { id: 'current-event', label: 'Respond to a current event' },
  { id: 'document-project', label: 'Document a project' },
  { id: 'test-format', label: 'Test a new format' },
  { id: 'publish-fast', label: 'Publish something quickly' },
];

/** Generators that take the seed. Origin changes how the seed is used. */
const RUNS: { origin: IdeaOrigin; count: number; label: string; hint: string; primary?: boolean }[] = [
  { origin: 'focused', count: 3, label: '3 angles', hint: 'Three different takes on this seed.', primary: true },
  { origin: 'broad', count: 10, label: '10 angles', hint: 'Every angle the channel supports.' },
  { origin: 'deep', count: 1, label: 'One, deep', hint: 'A single idea developed further.' },
];

/** Generators that ignore the seed and pull from elsewhere. */
const SOURCES: { origin: IdeaOrigin; count: number; label: string; hint: string }[] = [
  { origin: 'library', count: 5, label: 'From my library', hint: 'Built out of material you already have.' },
  { origin: 'personal-experience', count: 4, label: 'From experience', hint: 'Rooted in what you have lived.' },
  { origin: 'follow-up', count: 3, label: 'Follow-ups', hint: 'Advance an argument you already made.' },
  { origin: 'counterargument', count: 3, label: 'Counterarguments', hint: 'Argue against your own published position.' },
  { origin: 'series-continuation', count: 3, label: 'Series continuations', hint: 'The next chapter in a series.' },
];

const REJECTIONS: { id: RejectionReason; label: string }[] = [
  { id: 'too-generic', label: 'Too generic' },
  { id: 'not-personal-enough', label: 'Not personal enough' },
  { id: 'already-covered', label: 'Already covered' },
  { id: 'weak-title', label: 'Weak title' },
  { id: 'too-much-work', label: 'Too much work' },
  { id: 'wrong-channel', label: 'Wrong channel' },
  { id: 'not-interested', label: 'Not interested' },
  { id: 'cannot-support-claim', label: 'Cannot support the claim' },
  { id: 'wrong-time', label: 'Good idea, wrong time' },
];

export function IdeasView() {
  const direction = useStore((s) => s.direction);
  const setDirection = useStore((s) => s.setDirection);
  const generateIdeas = useStore((s) => s.generateIdeas);
  const addManualIdea = useStore((s) => s.addManualIdea);
  const ideas = useStore((s) => s.ideas);
  const busy = useStore((s) => s.busy);
  const library = useStore((s) => s.library);

  const [seed, setSeed] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const ch = CHANNELS[direction.channelId];
  const visible = useMemo(
    () =>
      ideas
        .filter((i) => i.channelId === direction.channelId)
        .filter((i) => (showAll ? true : !['rejected', 'merged', 'selected'].includes(i.status))),
    [ideas, direction.channelId, showAll],
  );

  const libraryCount = library.filter(
    (e) => e.channelIds.length === 0 || e.channelIds.includes(direction.channelId),
  ).length;

  const roll = () => {
    const used = ideas.filter((i) => i.channelId === direction.channelId).map((i) => i.workingTitle);
    const next = rollSeed(direction.channelId, [...used, seed]);
    if (next) setSeed(next);
  };

  const run = (origin: IdeaOrigin, count: number, useSeed: boolean) =>
    generateIdeas({ origin, count, seed: useSeed ? seed.trim() || undefined : undefined });

  return (
    <div className="col" style={{ gap: 14 }}>
      {/* ------------------------------------------------------------- spark */}
      <Card
        title="Start with one thing"
        sub={`A word, a phrase, a moment. Short and concrete beats broad and safe.`}
        right={
          <div className="row">
            <select
              value={direction.channelId}
              style={{ width: 168 }}
              onChange={(e) =>
                setDirection({
                  channelId: e.target.value as ChannelId,
                  seriesId: undefined,
                  desiredFormatId: undefined,
                })
              }
            >
              {CHANNEL_IDS.map((id) => (
                <option key={id} value={id}>
                  {CHANNELS[id].name}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <input
            style={{ flex: 1, fontSize: 16, padding: '12px 14px' }}
            value={seed}
            placeholder={ch.seedPlaceholder}
            onChange={(e) => setSeed(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy) run('focused', 3, true);
            }}
          />
          <button className="btn" onClick={roll} disabled={!!busy} title={`Random ${ch.name} seed`}>
            Roll a seed
          </button>
        </div>

        <div className="row" style={{ gap: 8 }}>
          {RUNS.map((g) => (
            <button
              key={g.origin}
              className={`btn${g.primary ? ' primary' : ''}`}
              disabled={!!busy}
              title={g.hint}
              onClick={() => run(g.origin, g.count, true)}
            >
              {g.label}
            </button>
          ))}
          <button className="btn ghost small" onClick={() => setShowBank(!showBank)}>
            {showBank ? 'Hide seed bank' : `Browse ${ch.name} seeds`}
          </button>
          <div className="spacer" style={{ flex: 1 }} />
          <button className="btn ghost small" onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? 'Hide direction' : 'Refine direction'}
          </button>
        </div>

        {!seed.trim() && (
          <Why>
            With no seed the engine falls back to your library and the channel's own bank. Typing something
            specific — "the third week", "the burnt neutral" — is what stops the output being generic.
          </Why>
        )}

        {showBank && (
          <div className="col" style={{ gap: 10, marginTop: 14 }}>
            {SEED_BANK[direction.channelId].map((group) => (
              <div key={group.label}>
                <div className="small dim" style={{ marginBottom: 5 }}>{group.label}</div>
                <div className="row" style={{ gap: 5 }}>
                  {group.seeds.map((s) => (
                    <button
                      key={s}
                      className={`btn small${seed === s ? ' primary' : ''}`}
                      onClick={() => setSeed(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* --------------------------------------------------- optional refine */}
      {showAdvanced && (
        <Card title="Direction" sub="Optional. Every field here narrows what the engine may suggest.">
          <div className="grid three">
            <Field label="Series or pillar">
              <select value={direction.seriesId ?? ''} onChange={(e) => setDirection({ seriesId: e.target.value || undefined })}>
                <option value="">Any</option>
                {ch.series.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Desired video type">
              <select
                value={direction.desiredFormatId ?? ''}
                onChange={(e) => setDirection({ desiredFormatId: e.target.value || undefined })}
              >
                <option value="">Let the engine choose</option>
                {ch.formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Timeliness">
              <select value={direction.timeliness} onChange={(e) => setDirection({ timeliness: e.target.value as never })}>
                <option value="evergreen">Evergreen</option>
                <option value="seasonal">Seasonal</option>
                <option value="this-month">This month</option>
                <option value="this-week">This week</option>
                <option value="now">Now</option>
              </select>
            </Field>
          </div>

          <Field label="Content goals">
            <div className="row" style={{ gap: 6 }}>
              {GOALS.map((g) => {
                const on = direction.goals.includes(g.id);
                return (
                  <button
                    key={g.id}
                    className={`btn small${on ? ' primary' : ''}`}
                    onClick={() =>
                      setDirection({
                        goals: on ? direction.goals.filter((x) => x !== g.id) : [...direction.goals, g.id],
                      })
                    }
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid three">
            <Field label="Audience state">
              <select value={direction.audienceState} onChange={(e) => setDirection({ audienceState: e.target.value as never })}>
                <option value="cold">Cold — they don't know me</option>
                <option value="warm">Warm — some familiarity</option>
                <option value="core">Core — regulars</option>
                <option value="mixed">Mixed</option>
              </select>
            </Field>
            <Field label={`Available time — ${direction.availableTimeMinutes} min`}>
              <input
                type="range"
                min={30}
                max={1800}
                step={30}
                value={direction.availableTimeMinutes}
                onChange={(e) => setDirection({ availableTimeMinutes: Number(e.target.value) })}
              />
            </Field>
            <Field label="Energy level">
              <select value={direction.energy} onChange={(e) => setDirection({ energy: e.target.value as never })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </Field>
          </div>

          <div className="grid two">
            <Field label="Personal experience available" hint="The engine will not invent lived experience you have not stated.">
              <textarea
                rows={2}
                value={direction.personalExperience}
                placeholder="e.g. Five years of intentional self-development"
                onChange={(e) => setDirection({ personalExperience: e.target.value })}
              />
            </Field>
            <Field label="Available footage or materials">
              <textarea
                rows={2}
                value={direction.availableMaterials}
                placeholder="e.g. Two Marvel Rivals sessions recorded, Meta-glasses footage from Tuesday"
                onChange={(e) => setDirection({ availableMaterials: e.target.value })}
              />
            </Field>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------------ other sources */}
      <Card
        title="Or pull from somewhere else"
        sub={`${libraryCount} library items in scope for ${ch.name}.`}
      >
        <div className="row" style={{ gap: 6 }}>
          {SOURCES.map((g) => (
            <button key={g.origin} className="btn small" disabled={!!busy} title={g.hint} onClick={() => run(g.origin, g.count, false)}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <input
            style={{ flex: 1 }}
            placeholder="Or capture a raw idea in your own words…"
            onKeyDown={(e) => {
              const v = (e.target as HTMLInputElement).value;
              if (e.key === 'Enter' && v.trim()) {
                addManualIdea(v.trim());
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
        </div>
      </Card>

      {/* -------------------------------------------------------------- cards */}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>
          {visible.length} idea{visible.length === 1 ? '' : 's'} on {ch.name}
        </h3>
        <div className="row">
          <span className="small dim">
            weighted on {topWeightedDimensions(direction.channelId, 2).join(' + ')}
          </span>
          <button className="btn small ghost" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Hide rejected' : 'Show rejected'}
          </button>
          <button className="btn small" onClick={() => navigate('/selection')}>
            Selection Room
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <Empty>Nothing yet. Type a seed above, or roll one.</Empty>
      ) : (
        <div className="grid two">
          {visible.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function IdeaCard({ idea }: { idea: Idea }) {
  const ch = CHANNELS[idea.channelId];
  const shortlist = useStore((s) => s.shortlist);
  const toggleShortlist = useStore((s) => s.toggleShortlist);
  const critiqueIdea = useStore((s) => s.critiqueIdea);
  const rejectIdea = useStore((s) => s.rejectIdea);
  const saveIdeaForLater = useStore((s) => s.saveIdeaForLater);
  const adaptIdea = useStore((s) => s.adaptIdea);
  const selectIdea = useStore((s) => s.selectIdea);
  const busy = useStore((s) => s.busy);

  const [rejecting, setRejecting] = useState(false);
  const [adapting, setAdapting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const format = ch.formats.find((f) => f.id === idea.recommendedFormatId);
  const on = shortlist.includes(idea.id);

  return (
    <div className="card" style={{ borderLeft: `2px solid ${ch.accent}`, opacity: idea.status === 'rejected' ? 0.5 : 1 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ fontSize: 15, lineHeight: 1.35, flex: 1 }}>{idea.workingTitle}</h3>
        <Chip tone="accent">{idea.weightedScore}</Chip>
      </div>

      <div className="row" style={{ gap: 5, margin: '8px 0' }}>
        {format && <Chip>{format.name}</Chip>}
        <Chip>{effortLabel(idea.effort)} effort</Chip>
        <Chip>Virality {idea.viralityScore}</Chip>
        <Chip>Brand {idea.brandScore}</Chip>
        {idea.status === 'saved' && <Chip tone="warn">saved</Chip>}
        {idea.status === 'rejected' && <Chip tone="bad">{idea.rejection?.reason}</Chip>}
      </div>

      {idea.premise && <p className="small" style={{ margin: '0 0 8px' }}>{idea.premise}</p>}

      {expanded && (
        <div className="col small" style={{ gap: 8, marginBottom: 10 }}>
          {idea.viewerProblem && <div><span className="dim">Viewer problem: </span>{idea.viewerProblem}</div>}
          {idea.corePromise && <div><span className="dim">Core promise: </span>{idea.corePromise}</div>}
          {idea.authorityBasis && <div><span className="dim">Why Corey: </span>{idea.authorityBasis}</div>}
          {idea.emotionalAngle && <div><span className="dim">Emotional angle: </span>{idea.emotionalAngle}</div>}
          {idea.channelFit && <div><span className="dim">Channel fit: </span>{idea.channelFit}</div>}
          <div style={{ marginTop: 6 }}>
            <ScoreGrid
              scores={idea.scores}
              highlight={topWeightedDimensions(idea.channelId, 5)}
              deprioritised={ch.deprioritised}
            />
          </div>
        </div>
      )}

      {idea.originalityWarnings.length > 0 && (
        <ul className="warning-list">
          {idea.originalityWarnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button
          className={`btn small${on ? ' primary' : ''}`}
          onClick={() => toggleShortlist(idea.id)}
          disabled={idea.status === 'rejected'}
        >
          {on ? 'Shortlisted' : 'Compare'}
        </button>
        <button
          className="btn small"
          disabled={idea.status === 'rejected'}
          onClick={() => {
            const id = selectIdea(idea.id);
            if (id) navigate(`/project/${id}/concept`);
          }}
        >
          Select
        </button>
        <button className="btn small ghost" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Less' : 'More'}
        </button>
        <div className="optional-controls row" style={{ gap: 8 }}>
          <button className="btn small ghost" onClick={() => critiqueIdea(idea.id)} disabled={!!busy}>
            Why is this weak?
          </button>
          <button className="btn small ghost" onClick={() => setAdapting(true)}>Adapt</button>
          <button className="btn small ghost" onClick={() => saveIdeaForLater(idea.id)}>Save</button>
          <button className="btn small ghost danger" onClick={() => setRejecting(true)}>Reject</button>
        </div>
      </div>

      {rejecting && (
        <Modal title="Why are you rejecting this?" onClose={() => setRejecting(false)}>
          <Why>Rejection reasons improve future generation — the engine down-weights the patterns you keep turning down.</Why>
          <div className="row" style={{ gap: 6 }}>
            {REJECTIONS.map((r) => (
              <button key={r.id} className="btn small" onClick={() => { rejectIdea(idea.id, r.id); setRejecting(false); }}>
                {r.label}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {adapting && (
        <Modal title="Adapt for another channel" onClose={() => setAdapting(false)}>
          <Why>
            This is not a re-title. The shape of the video changes with the channel — the evidence, the pacing and
            the promise all move.
          </Why>
          <div className="row" style={{ gap: 6 }}>
            {CHANNEL_IDS.filter((c) => c !== idea.channelId).map((c) => (
              <button key={c} className="btn small" onClick={() => { adaptIdea(idea.id, c); setAdapting(false); }}>
                {CHANNELS[c].name}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
