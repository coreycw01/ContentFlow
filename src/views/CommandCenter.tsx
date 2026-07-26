import { useMemo } from 'react';

import { CHANNELS } from '../domain/channels';
import { brandWarnings, channelHealth } from '../domain/brand';
import { nextAction } from '../domain/readiness';
import { EFFORT_ORDER, rankingScore } from '../domain/scoring';
import { WORKING_STAGES, stageDef } from '../domain/stages';
import type { ContentProject, Idea } from '../domain/types';
import { useStore } from '../store/store';
import { Card, Chip, Empty, Stat, Why, relativeDays } from '../ui/components';
import { navigate } from '../ui/router';

export function CommandCenter() {
  const projects = useStore((s) => s.projects);
  const ideas = useStore((s) => s.ideas);
  const library = useStore((s) => s.library);
  const active = useStore((s) => s.settings.activeChannelId);

  const scoped = useMemo(
    () => (active ? projects.filter((p) => p.channelId === active) : projects),
    [projects, active],
  );
  const scopedIdeas = useMemo(
    () => (active ? ideas.filter((i) => i.channelId === active) : ideas),
    [ideas, active],
  );

  const health = useMemo(() => channelHealth(projects), [projects]);
  const warnings = useMemo(() => brandWarnings(projects, library), [projects, library]);

  const working = scoped.filter((p) => WORKING_STAGES.includes(p.stage));
  const blocked = scoped.filter((p) => p.blocker);

  // "What should I work on next?" — the single recommendation.
  const recommendation = useMemo(() => pickNextMove(scoped, scopedIdeas, health, active), [scoped, scopedIdeas, health, active]);

  const quickWins = scoped
    .filter((p) => WORKING_STAGES.includes(p.stage) && p.effort === 'low')
    .concat(
      scopedIdeas
        .filter((i) => i.status !== 'rejected' && !i.projectId && i.effort === 'low')
        .slice(0, 3)
        .map(ideaAsPseudo),
    )
    .slice(0, 4);

  const legacy = scoped
    .filter((p) => !['published', 'review', 'archived'].includes(p.stage))
    .sort((a, b) => b.contentValue - a.contentValue)
    .slice(0, 3);

  const revisit = scopedIdeas.filter((i) => i.status === 'saved').slice(0, 5);

  const unusedFootage = library.filter(
    (e) => !e.used && ['gameplay-moment', 'b-roll', 'movie-reaction'].includes(e.type),
  );

  const lessons = projects
    .filter((p) => p.review)
    .slice(0, 3)
    .flatMap((p) => p.review!.changeNextTime.map((l) => ({ project: p.workingTitle, lesson: l })));

  const upcoming = scoped
    .filter((p) => p.targetPublishDate)
    .sort((a, b) => (a.targetPublishDate ?? '').localeCompare(b.targetPublishDate ?? ''))
    .slice(0, 6);

  return (
    <div className="col" style={{ gap: 14 }}>
      <Card
        title="Recommended next action"
        sub="One move, chosen from everything currently open."
        right={
          recommendation.route && (
            <button className="btn primary" onClick={() => navigate(recommendation.route!)}>
              {recommendation.cta}
            </button>
          )
        }
      >
        <div style={{ fontSize: 15, fontWeight: 550, marginBottom: 6 }}>{recommendation.headline}</div>
        <div className="dim small">{recommendation.reason}</div>
      </Card>

      <div className="grid four">
        {health
          .filter((h) => !active || h.channelId === active)
          .map((h) => {
            const ch = CHANNELS[h.channelId];
            return (
              <Card key={h.channelId}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row" style={{ gap: 7 }}>
                    <span
                      className="swatch"
                      style={{ width: 9, height: 9, borderRadius: 2, background: ch.accent, display: 'inline-block' }}
                    />
                    <strong style={{ fontSize: 13 }}>{ch.name}</strong>
                  </div>
                  {h.pressureExempt ? (
                    <Chip>no pressure</Chip>
                  ) : (
                    <Chip tone={h.health >= 70 ? 'good' : h.health >= 45 ? 'warn' : 'bad'}>{h.health}</Chip>
                  )}
                </div>
                <div className="small dim" style={{ marginTop: 8 }}>{h.status}</div>
                <div className="row small dim" style={{ marginTop: 8, gap: 12 }}>
                  <span>{h.inFlight} in flight</span>
                  <span>{h.published90} in 90d</span>
                </div>
              </Card>
            );
          })}
      </div>

      <div className="grid two">
        <Card title="Current pipeline" sub={`${working.length} projects need you`}>
          {working.length === 0 ? (
            <Empty>Nothing in production. That is either rest or drift — you decide which.</Empty>
          ) : (
            <div className="col" style={{ gap: 8 }}>
              {working.slice(0, 6).map((p) => {
                const na = nextAction(p);
                return (
                  <div
                    key={p.id}
                    className="pcard"
                    style={{ borderLeftColor: CHANNELS[p.channelId].accent, marginBottom: 0 }}
                    onClick={() => navigate(na.route)}
                  >
                    <div className="t">{p.workingTitle}</div>
                    <div className="m">
                      {stageDef(p.stage).label} · {na.label} · updated {relativeDays(p.updatedAt)}
                    </div>
                    {p.blocker && <div className="m" style={{ color: 'var(--bad)' }}>Blocked: {p.blocker}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="What deserves deeper development" sub="Highest long-term brand value, not highest virality.">
          {legacy.length === 0 ? (
            <Empty>No open projects yet.</Empty>
          ) : (
            <div className="col" style={{ gap: 8 }}>
              {legacy.map((p) => (
                <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <a href={`#/project/${p.id}/concept`} style={{ textDecoration: 'none', color: 'var(--text)' }}>
                    {p.workingTitle}
                  </a>
                  <Chip tone="accent">{p.contentValue}</Chip>
                </div>
              ))}
            </div>
          )}
          <Why>
            Brand value is measured by originality, personal connection and credibility — not by how many people
            would click.
          </Why>
        </Card>
      </div>

      <div className="grid two">
        <Card title="Quick wins" sub="Low effort, publishable soon.">
          {quickWins.length === 0 ? (
            <Empty>Nothing low-effort is queued.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {quickWins.map((p) => (
                <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{p.workingTitle}</span>
                  <Chip>{CHANNELS[p.channelId].name}</Chip>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Unused recordings and material" sub={`${unusedFootage.length} items on disk that could become content.`}>
          {unusedFootage.length === 0 ? (
            <Empty>Everything captured has been used.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {unusedFootage.slice(0, 6).map((e) => (
                <div key={e.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">{e.title}</span>
                  <Chip>{e.type}</Chip>
                </div>
              ))}
              <button className="btn small" style={{ marginTop: 6 }} onClick={() => navigate('/library')}>
                Generate ideas from these
              </button>
            </div>
          )}
        </Card>
      </div>

      <div className="grid two">
        <Card title="Ideas worth revisiting" sub="Saved for later, not rejected.">
          {revisit.length === 0 ? (
            <Empty>Nothing saved.</Empty>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {revisit.map((i) => (
                <div key={i.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="small">{i.workingTitle}</span>
                  <Chip>{CHANNELS[i.channelId].name}</Chip>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Performance lessons" sub="From published reviews. These feed idea generation.">
          {lessons.length === 0 ? (
            <Empty>No reviews entered yet.</Empty>
          ) : (
            <ul className="small" style={{ margin: 0, paddingLeft: 16 }}>
              {lessons.map((l, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {l.lesson} <span className="dim">— {l.project}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {warnings.length > 0 && (
        <Card
          title="Brand warnings"
          sub={`${warnings.length} pattern${warnings.length === 1 ? '' : 's'} worth knowing about.`}
          right={<button className="btn small" onClick={() => navigate('/brand')}>Open Brand Intelligence</button>}
        >
          <div className="col" style={{ gap: 8 }}>
            {warnings.slice(0, 3).map((w) => (
              <div key={w.id} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                <Chip tone={w.severity === 'serious' ? 'bad' : w.severity === 'watch' ? 'warn' : undefined}>
                  {w.severity}
                </Chip>
                <div>
                  <strong style={{ fontSize: 13 }}>{w.title}</strong>
                  <div className="small dim">{w.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid four">
        <Card><Stat n={scoped.length} k="Projects" /></Card>
        <Card><Stat n={scopedIdeas.filter((i) => i.status !== 'rejected').length} k="Live ideas" /></Card>
        <Card><Stat n={blocked.length} k="Blocked" /></Card>
        <Card><Stat n={upcoming.length} k="Scheduled" /></Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ideaAsPseudo(i: Idea): ContentProject {
  return {
    id: i.id,
    createdAt: i.createdAt,
    updatedAt: i.createdAt,
    channelId: i.channelId,
    workingTitle: i.workingTitle,
    stage: 'generated',
    priority: 'normal',
    concept: {
      coreArgument: '', viewerTransformation: '', startingBelief: '', endingBelief: '',
      personalStake: '', evidence: [], tension: '', counterargument: '', honestLimitation: '', memorableLine: '',
    },
    packaging: { titles: [], hooks: [], thumbnails: [], curiosityGaps: [], stakes: [], emotionalFraming: [] },
    script: { beats: [], estimatedDurationSeconds: 0, chapterMarkers: [] },
    production: [],
    brandAssociations: [],
    notes: '',
    effort: i.effort,
    contentValue: i.brandScore,
    viralityScore: i.viralityScore,
  };
}

function pickNextMove(
  projects: ContentProject[],
  ideas: Idea[],
  health: ReturnType<typeof channelHealth>,
  active: string | null,
): { headline: string; reason: string; cta?: string; route?: string } {
  // 1. A blocked project is the most expensive thing in the system.
  const blocked = projects.find((p) => p.blocker);
  if (blocked) {
    return {
      headline: `Unblock "${blocked.workingTitle}"`,
      reason: `${blocked.blocker} — a blocked project costs more than an unstarted one, because it is still occupying attention.`,
      cta: 'Open project',
      route: nextAction(blocked).route,
    };
  }

  // 2. Anything one step from publishing.
  const nearlyDone = projects
    .filter((p) => ['editing', 'scheduled', 'ready-to-record'].includes(p.stage))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0];
  if (nearlyDone) {
    const na = nextAction(nearlyDone);
    return {
      headline: `${na.label}: "${nearlyDone.workingTitle}"`,
      reason: `${na.hint} It has been sitting since ${relativeDays(nearlyDone.updatedAt)}, and finishing beats starting.`,
      cta: na.label,
      route: na.route,
    };
  }

  // 3. A neglected priority channel — but never World's Finest.
  const neglected = health
    .filter((h) => !h.pressureExempt && (h.daysSinceLastPublish ?? 999) > (CHANNELS[h.channelId].workspace.pressure.cadenceTargetDays ?? 14) * 2)
    .sort((a, b) => CHANNELS[a.channelId].strategicPriority - CHANNELS[b.channelId].strategicPriority)[0];
  if (neglected && !active) {
    return {
      headline: `${CHANNELS[neglected.channelId].name} needs attention`,
      reason: `${neglected.status}. It is a priority-${CHANNELS[neglected.channelId].strategicPriority} channel, so the gap costs more here than elsewhere.`,
      cta: 'Generate ideas',
      route: '/ideas',
    };
  }

  // 4. Ideas waiting for a decision.
  const undecided = ideas.filter((i) => ['generated', 'shortlisted'].includes(i.status));
  if (undecided.length >= 2) {
    const best = undecided.sort((a, b) => rankingScore(b) - rankingScore(a))[0];
    return {
      headline: `Decide between ${undecided.length} open ideas`,
      reason: `"${best.workingTitle}" currently ranks highest. Ideas that sit undecided quietly turn into ideas you never make.`,
      cta: 'Open Selection Room',
      route: '/selection',
    };
  }

  // 5. In-flight work.
  const inFlight = projects
    .filter((p) => WORKING_STAGES.includes(p.stage))
    .sort((a, b) => EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort])[0];
  if (inFlight) {
    const na = nextAction(inFlight);
    return {
      headline: `${na.label}: "${inFlight.workingTitle}"`,
      reason: na.hint,
      cta: na.label,
      route: na.route,
    };
  }

  return {
    headline: 'Start with direction, not with ideas',
    reason: 'Generating ideas without constraints produces generic sludge. Set the channel, the goal and what you actually have on hand first.',
    cta: 'Set direction',
    route: '/ideas',
  };
}
