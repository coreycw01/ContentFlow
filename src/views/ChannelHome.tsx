import { useMemo } from 'react';

import { CHANNELS, type ChannelDef, type HomePanel } from '../domain/channels';
import { nextAction } from '../domain/readiness';
import { stageDef } from '../domain/stages';
import type { ContentProject, LibraryEntry } from '../domain/types';
import { useStore } from '../store/store';
import { Card, Chip, Empty, Why, relativeDays } from '../ui/components';
import { navigate } from '../ui/router';

/**
 * A channel workspace is not a colour change. Each channel gets its own home
 * screen, built from the panels its doctrine actually needs, in its own
 * vocabulary — a Core Workshop build queue, a CDogg clip bin, a World's Finest
 * watchlist with nothing that counts, nags or scores.
 */
export function ChannelHome({ channelId }: { channelId: ContentProject['channelId'] }) {
  const projects = useStore((s) => s.projects);
  const library = useStore((s) => s.library);
  const ideas = useStore((s) => s.ideas);

  const ch = CHANNELS[channelId];
  const mine = useMemo(() => projects.filter((p) => p.channelId === channelId), [projects, channelId]);
  const myLibrary = useMemo(
    () => library.filter((e) => e.channelIds.length === 0 || e.channelIds.includes(channelId)),
    [library, channelId],
  );

  const ctx = { ch, projects: mine, library: myLibrary, ideas: ideas.filter((i) => i.channelId === channelId) };

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ maxWidth: 620 }}>
            <div style={{ fontSize: 17, fontWeight: 620, letterSpacing: '-0.01em' }}>{ch.name}</div>
            <div className="small dim" style={{ marginTop: 4 }}>{ch.purpose}</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {ch.workspace.quickActions.map((a) => (
              <button key={a.label} className="btn small" title={a.hint} onClick={() => navigate(a.route)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {ch.workspace.homePanels.map((panel) => (
        <Panel key={panel} panel={panel} {...ctx} />
      ))}
    </div>
  );
}

interface PanelProps {
  panel: HomePanel;
  ch: ChannelDef;
  projects: ContentProject[];
  library: LibraryEntry[];
  ideas: ReturnType<typeof useStore.getState>['ideas'];
}

function Panel({ panel, ch, projects, library }: PanelProps) {
  const open = projects.filter((p) => !['published', 'review', 'archived'].includes(p.stage));

  switch (panel) {
    // -----------------------------------------------------------------------
    case 'next-action': {
      const target = open.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0];
      if (!target) {
        return (
          <Card title="Nothing open" sub={`No ${ch.workspace.projectNoun} in progress on this channel.`}>
            <button className="btn primary" onClick={() => navigate('/ideas')}>
              Start one
            </button>
          </Card>
        );
      }
      const na = nextAction(target);
      return (
        <Card
          title="Next move"
          sub={target.workingTitle}
          right={
            <button className="btn primary" onClick={() => navigate(na.route)}>
              {na.label}
            </button>
          }
        >
          <div className="small dim">{na.hint}</div>
        </Card>
      );
    }

    // -----------------------------------------------------------------------
    case 'in-flight':
      return (
        <Card title={`${ch.workspace.projectNoun}s in progress`} sub={`${open.length} open`}>
          {open.length === 0 ? (
            <Empty>Nothing open.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {open.map((p) => (
                <div
                  key={p.id}
                  className="row"
                  style={{ justifyContent: 'space-between', cursor: 'pointer' }}
                  onClick={() => navigate(`/project/${p.id}/concept`)}
                >
                  <span className="small">{p.workingTitle}</span>
                  <span className="row" style={{ gap: 5 }}>
                    <VideoChips project={p} />
                    <Chip>{stageDef(p.stage).label}</Chip>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      );

    // ------------------------------------------------ Corey Williams panels
    case 'legacy': {
      const ranked = open.sort((a, b) => b.contentValue - a.contentValue).slice(0, 4);
      return (
        <Card title="The body of work" sub="Ranked by long-term value, not by reach.">
          {ranked.length === 0 ? (
            <Empty>Nothing in development.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {ranked.map((p) => (
                <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <a href={`#/project/${p.id}/concept`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                    {p.workingTitle}
                  </a>
                  <Chip tone="accent">{p.contentValue}</Chip>
                </div>
              ))}
            </div>
          )}
          <Why>A video still true in five years beats four that summarise other people.</Why>
        </Card>
      );
    }

    case 'story-bank': {
      const stories = library.filter((e) => e.type === 'personal-story');
      const unspent = stories.filter((e) => !e.used);
      return (
        <Card
          title="Story bank"
          sub={`${unspent.length} unspent of ${stories.length}`}
          right={<button className="btn small" onClick={() => navigate('/library')}>Open library</button>}
        >
          {unspent.length === 0 ? (
            <Empty>No unused personal stories. This channel runs on them — worth adding a few.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {unspent.slice(0, 5).map((e) => (
                <div key={e.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">{e.title}</span>
                  {e.unresolved && <Chip tone="warn">unresolved</Chip>}
                </div>
              ))}
            </div>
          )}
        </Card>
      );
    }

    case 'claim-check': {
      const risky = projects.filter(
        (p) => p.concept.coreArgument.trim() && !p.concept.honestLimitation.trim(),
      );
      return (
        <Card title="Claim checker" sub="Arguments with no stated limit.">
          {risky.length === 0 ? (
            <Empty>Every open argument states what it cannot prove.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {risky.slice(0, 5).map((p) => (
                <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <a href={`#/project/${p.id}/concept`} style={{ color: 'var(--text)', textDecoration: 'none' }} className="small">
                    {p.workingTitle}
                  </a>
                  <Chip tone="warn">no honest limitation</Chip>
                </div>
              ))}
            </div>
          )}
        </Card>
      );
    }

    // -------------------------------------------------- Core Workshop panels
    case 'build-queue': {
      const buildable = library.filter((e) => e.type === 'build-project');
      const ready = buildable.filter((e) => e.materialsOnHand);
      return (
        <Card title="Build queue" sub={`${ready.length} buildable with what you own`}>
          {buildable.length === 0 ? (
            <Empty>No build projects logged yet.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {buildable.slice(0, 6).map((e) => (
                <div key={e.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">{e.title}</span>
                  <Chip tone={e.materialsOnHand ? 'good' : undefined}>
                    {e.materialsOnHand ? 'materials on hand' : 'needs buying'}
                  </Chip>
                </div>
              ))}
            </div>
          )}
        </Card>
      );
    }

    case 'materials': {
      const needed = projects.flatMap((p) =>
        p.assets.filter((a) => a.status === 'needed').map((a) => ({ p, a })),
      );
      return (
        <Card title="Shopping and shot list" sub={`${needed.length} things the scripts still ask for`}>
          {needed.length === 0 ? (
            <Empty>Nothing outstanding.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {needed.slice(0, 6).map(({ p, a }) => (
                <div key={a.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">{a.description}</span>
                  <span className="row" style={{ gap: 5 }}>
                    <Chip>{a.kind}</Chip>
                    <span className="small dim">{p.workingTitle.slice(0, 22)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      );
    }

    case 'safety': {
      const missing = projects.filter(
        (p) =>
          ['scripting', 'ready-to-record', 'recording'].includes(p.stage) &&
          !p.script.beats.some((b) => /safety|ppe|lockout|breaker|voltage|glove/i.test(`${b.role} ${b.information}`)) &&
          !/safety|ppe|lockout/i.test(p.scriptDoc.content),
      );
      return (
        <Card title="Safety check" sub="Required before recording on this channel.">
          {missing.length === 0 ? (
            <Empty>Every build heading to camera has a safety note.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {missing.map((p) => (
                <div key={p.id} className="blocker">
                  <strong>{p.workingTitle}</strong> — no safety note yet.
                </div>
              ))}
            </div>
          )}
        </Card>
      );
    }

    // ---------------------------------------------------------- CDogg panels
    case 'clip-bin': {
      const clips = library.filter((e) => e.type === 'gameplay-moment');
      const unused = clips.filter((e) => !e.used);
      return (
        <Card
          title="Clip bin"
          sub={`${unused.length} unused moments`}
          right={<button className="btn small" onClick={() => navigate('/library')}>Add a clip</button>}
        >
          {unused.length === 0 ? (
            <Empty>No unused clips logged. Mark moments while you record — that is the whole pipeline here.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {unused.slice(0, 8).map((e) => (
                <div key={e.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">{e.title}</span>
                  {e.source && <Chip>{e.source}</Chip>}
                </div>
              ))}
            </div>
          )}
        </Card>
      );
    }

    case 'shorts': {
      const candidates = projects.flatMap((p) =>
        p.script.beats.filter((b) => b.shortsCandidate).map((b) => ({ p, b })),
      );
      return (
        <Card title="Shorts queue" sub={`${candidates.length} marked moments`}>
          {candidates.length === 0 ? (
            <Empty>Nothing marked for vertical yet.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {candidates.slice(0, 8).map(({ p, b }) => (
                <div key={b.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">{b.role}</span>
                  <span className="small dim">{p.workingTitle.slice(0, 28)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      );
    }

    case 'footage': {
      const footage = library.filter((e) => ['b-roll', 'gameplay-moment'].includes(e.type) && !e.used);
      return (
        <Card title="Unused footage" sub={`${footage.length} items on disk`}>
          {footage.length === 0 ? (
            <Empty>Everything captured has been used.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {footage.slice(0, 6).map((e) => (
                <div key={e.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">{e.title}</span>
                  <Chip>{e.type}</Chip>
                </div>
              ))}
            </div>
          )}
        </Card>
      );
    }

    // -------------------------------------------------- World's Finest panels
    case 'quick-reaction':
      return (
        <Card title="Seen something?" sub="One card, camera on, done. No pipeline required.">
          <div className="row">
            <button className="btn primary" onClick={() => navigate('/ideas')}>
              Start a reaction
            </button>
          </div>
          <Why>
            This channel has no cadence target, no overdue badges and no consistency warnings. If planning it
            starts to feel like work, the app is wrong, not you.
          </Why>
        </Card>
      );

    case 'watchlist': {
      const list = library.filter((e) => e.type === 'movie-reaction');
      return (
        <Card
          title="Watchlist"
          sub="Things coming out that you actually care about."
          right={<button className="btn small" onClick={() => navigate('/library')}>Edit list</button>}
        >
          {list.length === 0 ? (
            <Empty>Nothing on the list. Add what you are looking forward to — and only that.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {list.map((e) => (
                <div key={e.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">{e.title}</span>
                  <Chip tone={e.used ? undefined : 'good'}>{e.used ? 'covered' : 'not yet'}</Chip>
                </div>
              ))}
            </div>
          )}
        </Card>
      );
    }

    // -----------------------------------------------------------------------
    case 'unused-material': {
      const unused = library.filter((e) => !e.used);
      return (
        <Card title="Unused material" sub={`${unused.length} items`}>
          <div className="col" style={{ gap: 6 }}>
            {unused.slice(0, 6).map((e) => (
              <div key={e.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span className="small">{e.title}</span>
                <Chip>{e.type}</Chip>
              </div>
            ))}
          </div>
        </Card>
      );
    }

    case 'lessons': {
      const lessons = projects.filter((p) => p.review).flatMap((p) => p.review!.changeNextTime);
      return (
        <Card title="What the numbers taught you" sub="From published reviews.">
          {lessons.length === 0 ? (
            <Empty>No reviews yet on this channel.</Empty>
          ) : (
            <ul className="small" style={{ margin: 0, paddingLeft: 16 }}>
              {lessons.slice(0, 5).map((l, i) => (
                <li key={i} style={{ marginBottom: 5 }}>{l}</li>
              ))}
            </ul>
          )}
        </Card>
      );
    }

    case 'upcoming': {
      const scheduled = projects.filter((p) => p.targetPublishDate);
      return (
        <Card title="Scheduled" sub={`${scheduled.length} with a date`}>
          {scheduled.length === 0 ? (
            <Empty>Nothing dated.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {scheduled.map((p) => (
                <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">{p.workingTitle}</span>
                  <Chip>{p.targetPublishDate}</Chip>
                </div>
              ))}
            </div>
          )}
        </Card>
      );
    }
  }
}

/** Compact recorded / edited / uploaded indicator. */
export function VideoChips({ project }: { project: ContentProject }) {
  const v = project.videoStatus;
  const steps: [string, boolean][] = [
    ['R', !!v.recordedAt],
    ['E', !!v.editedAt],
    ['U', !!v.uploadedAt],
  ];
  if (!steps.some(([, on]) => on)) return null;
  return (
    <span className="row" style={{ gap: 3 }}>
      {steps.map(([k, on]) => (
        <span
          key={k}
          title={{ R: 'Recorded', E: 'Edited', U: 'Uploaded' }[k]}
          style={{
            width: 16, height: 16, borderRadius: 3, fontSize: 10, lineHeight: '16px', textAlign: 'center',
            background: on ? 'var(--accent)' : 'var(--line)',
            color: on ? '#10120f' : 'var(--text-faint)',
            fontWeight: 600,
          }}
        >
          {k}
        </span>
      ))}
    </span>
  );
}

export { relativeDays };
