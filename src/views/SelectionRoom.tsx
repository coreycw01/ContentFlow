import { useMemo, useState } from 'react';

import { CHANNELS } from '../domain/channels';
import { buildComparison, recommend } from '../domain/scoring';
import type { RejectionReason } from '../domain/types';
import { useStore } from '../store/store';
import { Card, Chip, Empty, Modal, Why } from '../ui/components';
import { navigate } from '../ui/router';

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

export function SelectionRoom() {
  const ideas = useStore((s) => s.ideas);
  const shortlist = useStore((s) => s.shortlist);
  const toggleShortlist = useStore((s) => s.toggleShortlist);
  const clearShortlist = useStore((s) => s.clearShortlist);
  const selectIdea = useStore((s) => s.selectIdea);
  const rejectIdea = useStore((s) => s.rejectIdea);
  const saveIdeaForLater = useStore((s) => s.saveIdeaForLater);
  const mergeShortlisted = useStore((s) => s.mergeShortlisted);
  const generateIdeas = useStore((s) => s.generateIdeas);
  const setDirection = useStore((s) => s.setDirection);
  const busy = useStore((s) => s.busy);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const candidates = useMemo(
    () => shortlist.map((id) => ideas.find((i) => i.id === id)).filter((i): i is NonNullable<typeof i> => !!i),
    [shortlist, ideas],
  );

  const rows = useMemo(() => buildComparison(candidates), [candidates]);
  const rec = useMemo(() => recommend(candidates), [candidates]);

  const available = ideas.filter((i) => ['generated', 'shortlisted', 'saved'].includes(i.status));

  if (candidates.length === 0) {
    return (
      <div className="col" style={{ gap: 14 }}>
        <Card title="Selection Room" sub="Put up to four ideas side by side before committing to one.">
          <Why>
            Comparing is not optional busywork. Most bad videos are chosen, not written — the mistake happens
            before a single word is drafted.
          </Why>
          {available.length === 0 ? (
            <Empty>
              No ideas available. <a href="#/ideas">Generate some first.</a>
            </Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {available.slice(0, 15).map((i) => (
                <div key={i.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">
                    {i.workingTitle} <Chip>{CHANNELS[i.channelId].name}</Chip>
                  </span>
                  <button className="btn small" onClick={() => toggleShortlist(i.id)}>
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  const mixedChannels = new Set(candidates.map((c) => c.channelId)).size > 1;

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card
        title={`Comparing ${candidates.length} idea${candidates.length === 1 ? '' : 's'}`}
        sub={mixedChannels ? 'Mixed channels — scores are weighted by each idea\'s own channel.' : CHANNELS[candidates[0].channelId].name}
        right={
          <div className="row">
            {candidates.length === 2 && (
              <button className="btn small" disabled={!!busy} onClick={() => setMerging(true)}>
                Merge two
              </button>
            )}
            <button className="btn small ghost" onClick={clearShortlist}>
              Clear
            </button>
          </div>
        }
        flush
      >
        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Dimension</th>
                {candidates.map((c) => (
                  <th key={c.id} className="num" style={{ minWidth: 150 }}>
                    {c.workingTitle}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const best = row.numeric
                  ? Math.max(...(row.values as number[]))
                  : null;
                return (
                  <tr key={row.label}>
                    <td className="dim">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td
                        key={i}
                        className="num"
                        style={{
                          color: row.numeric && v === best ? 'var(--accent)' : undefined,
                          fontWeight: row.numeric && v === best ? 600 : undefined,
                        }}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                );
              })}
              <tr>
                <td className="dim">Channel</td>
                {candidates.map((c) => (
                  <td key={c.id} className="num">
                    {CHANNELS[c.channelId].name}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {rec && (
        <Card title="The recommendation" sub="Blunt on purpose.">
          <div style={{ fontSize: 15, fontWeight: 550, marginBottom: 8 }}>{rec.headline}</div>
          <p className="prose" style={{ margin: 0 }}>{rec.body}</p>
          <div className="col" style={{ gap: 6, marginTop: 14 }}>
            {rec.notes.map((n) => {
              const idea = candidates.find((c) => c.id === n.ideaId)!;
              return (
                <div key={n.ideaId} className="small">
                  <strong>{idea.workingTitle}</strong>
                  <span className="dim"> — {n.text}</span>
                </div>
              );
            })}
          </div>
          {candidates.some((c) => CHANNELS[c.channelId].viralityPolicy === 'advisory') && (
            <Why>
              One or more of these is on a channel where virality is displayed but never allowed to change the
              ranking. That is deliberate.
            </Why>
          )}
        </Card>
      )}

      <div className="grid two">
        {candidates.map((c) => (
          <Card key={c.id} title={c.workingTitle} sub={CHANNELS[c.channelId].name}>
            {c.premise && <p className="small">{c.premise}</p>}
            {c.originalityWarnings.length > 0 && (
              <ul className="warning-list">
                {c.originalityWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <div className="row" style={{ marginTop: 12 }}>
              <button
                className={`btn small${rec?.winnerId === c.id ? ' primary' : ''}`}
                onClick={() => {
                  const id = selectIdea(c.id);
                  if (id) navigate(`/project/${id}/concept`);
                }}
              >
                Select this
              </button>
              <button
                className="btn small ghost"
                disabled={!!busy}
                onClick={() => {
                  setDirection({ channelId: c.channelId, topic: c.premise || c.workingTitle });
                  generateIdeas({ origin: 'focused', count: 3, steer: `Regenerate around this angle: ${c.workingTitle}` });
                }}
              >
                Regenerate around this
              </button>
              <button className="btn small ghost" onClick={() => saveIdeaForLater(c.id)}>
                Save for later
              </button>
              <button className="btn small ghost danger" onClick={() => setRejectingId(c.id)}>
                Reject
              </button>
            </div>
          </Card>
        ))}
      </div>

      {available.length > candidates.length && (
        <Card title="Add another candidate" sub={`Up to four at a time. ${candidates.length}/4 used.`}>
          <div className="col" style={{ gap: 6 }}>
            {available
              .filter((i) => !shortlist.includes(i.id))
              .slice(0, 10)
              .map((i) => (
                <div key={i.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">
                    {i.workingTitle} <Chip>{CHANNELS[i.channelId].name}</Chip>
                  </span>
                  <button className="btn small" disabled={candidates.length >= 4} onClick={() => toggleShortlist(i.id)}>
                    Add
                  </button>
                </div>
              ))}
          </div>
        </Card>
      )}

      {rejectingId && (
        <Modal title="Why are you rejecting this?" onClose={() => setRejectingId(null)}>
          <Why>Rejection reasons feed back into generation. The engine down-weights patterns you keep turning down.</Why>
          <div className="row" style={{ gap: 6 }}>
            {REJECTIONS.map((r) => (
              <button
                key={r.id}
                className="btn small"
                onClick={() => {
                  rejectIdea(rejectingId, r.id);
                  setRejectingId(null);
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {merging && candidates.length === 2 && (
        <Modal title="Merge two ideas" onClose={() => setMerging(false)}>
          <Why>
            Merging usually costs clarity. Do it when two ideas share one argument, not when you like both and
            cannot choose.
          </Why>
          <button
            className="btn primary"
            onClick={() => {
              mergeShortlisted(candidates[0].id, candidates[1].id);
              setMerging(false);
            }}
          >
            Merge "{candidates[0].workingTitle}" with "{candidates[1].workingTitle}"
          </button>
        </Modal>
      )}
    </div>
  );
}
