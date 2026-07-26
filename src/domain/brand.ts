/**
 * Brand Intelligence.
 *
 * Tracks what the body of work is actually saying, versus what Corey wants it
 * to say, and raises warnings when the pattern drifts. Note the last warning
 * in this file: the app watches itself for turning World's Finest into an
 * obligation.
 */

import { ALL_BRAND_ASSOCIATIONS, CHANNELS, CHANNEL_IDS } from './channels';
import type { ChannelId, ContentProject, LibraryEntry } from './types';

const DAY = 24 * 60 * 60 * 1000;

export type CoverageLevel = 'very-low' | 'low' | 'medium' | 'heavy';

export interface CoverageRow {
  association: string;
  count: number;
  level: CoverageLevel;
  recommendation: string;
  channelIds: ChannelId[];
}

const daysAgo = (iso?: string) => (iso ? (Date.now() - new Date(iso).getTime()) / DAY : Infinity);

function levelFor(count: number, max: number): CoverageLevel {
  if (count === 0) return 'very-low';
  if (max <= 1) return count >= 1 ? 'medium' : 'very-low';
  const ratio = count / max;
  if (ratio >= 0.75) return 'heavy';
  if (ratio >= 0.4) return 'medium';
  return 'low';
}

const RECOMMENDATION: Record<CoverageLevel, string> = {
  heavy: 'Pause temporarily — the audience has heard this recently.',
  medium: 'Continue at current weight.',
  low: 'Develop next.',
  'very-low': 'Strong opportunity — this association is going cold.',
};

export function brandCoverage(projects: ContentProject[], windowDays = 180): CoverageRow[] {
  const recent = projects.filter(
    (p) => (p.stage === 'published' || p.stage === 'review' || p.stage === 'archived') && daysAgo(p.publishedAt) <= windowDays,
  );
  const counts = new Map<string, { n: number; channels: Set<ChannelId> }>();
  for (const a of ALL_BRAND_ASSOCIATIONS) counts.set(a, { n: 0, channels: new Set() });
  for (const p of recent) {
    for (const a of p.brandAssociations) {
      const row = counts.get(a) ?? { n: 0, channels: new Set<ChannelId>() };
      row.n += 1;
      row.channels.add(p.channelId);
      counts.set(a, row);
    }
  }
  const max = Math.max(1, ...Array.from(counts.values()).map((c) => c.n));
  return ALL_BRAND_ASSOCIATIONS.map((association) => {
    const row = counts.get(association)!;
    const level = levelFor(row.n, max);
    return {
      association,
      count: row.n,
      level,
      recommendation: RECOMMENDATION[level],
      channelIds: Array.from(row.channels),
    };
  }).sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Warning system
// ---------------------------------------------------------------------------

export type WarningSeverity = 'info' | 'watch' | 'serious';

export interface BrandWarning {
  id: string;
  severity: WarningSeverity;
  title: string;
  detail: string;
  channelId?: ChannelId;
  /** What to do about it. */
  action?: string;
}

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .sort()
    .join(' ');

function overlapScore(a: string, b: string): number {
  const wa = new Set(normalise(a).split(' ').filter(Boolean));
  const wb = new Set(normalise(b).split(' ').filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  wa.forEach((w) => {
    if (wb.has(w)) shared += 1;
  });
  return shared / Math.min(wa.size, wb.size);
}

export function brandWarnings(projects: ContentProject[], library: LibraryEntry[]): BrandWarning[] {
  const out: BrandWarning[] = [];
  const published = projects.filter((p) => p.publishedAt);
  const recent = published.filter((p) => daysAgo(p.publishedAt) <= 90);

  // 1. Too many unrelated uploads --------------------------------------------
  const recentAssoc = recent.flatMap((p) => p.brandAssociations);
  const unique = new Set(recentAssoc).size;
  if (recent.length >= 4 && unique >= recent.length * 1.5) {
    out.push({
      id: 'scatter',
      severity: 'watch',
      title: 'Recent uploads do not add up to a shape',
      detail: `${recent.length} videos in 90 days touching ${unique} different associations. Individually fine; collectively it reads as a feed rather than a body of work.`,
      action: 'Pick two associations and make the next three videos serve them.',
    });
  }

  // 2. Repeating the same claim ----------------------------------------------
  for (let i = 0; i < published.length; i++) {
    for (let j = i + 1; j < published.length; j++) {
      const a = published[i];
      const b = published[j];
      if (a.channelId !== b.channelId) continue;
      const sim = overlapScore(a.concept.coreArgument || a.workingTitle, b.concept.coreArgument || b.workingTitle);
      if (sim >= 0.6) {
        out.push({
          id: `repeat_${a.id}_${b.id}`,
          severity: 'watch',
          channelId: a.channelId,
          title: 'You have made this argument already',
          detail: `"${a.workingTitle}" and "${b.workingTitle}" are making close to the same claim.`,
          action: 'Either advance the argument (what changed since?) or archive one.',
        });
      }
    }
  }

  // 3. Chasing trends outside authority --------------------------------------
  const outsideAuthority = projects.filter(
    (p) =>
      p.stage !== 'archived' &&
      p.direction?.timeliness === 'now' &&
      !p.concept.personalStake.trim() &&
      p.concept.evidence.every((e) => e.kind !== 'personal-experience' && e.kind !== 'demonstration'),
  );
  outsideAuthority.forEach((p) =>
    out.push({
      id: `trend_${p.id}`,
      severity: 'serious',
      channelId: p.channelId,
      title: 'Timely topic with no personal stake',
      detail: `"${p.workingTitle}" is being made because it is current, not because you have standing in it.`,
      action: 'Add lived evidence or a demonstration, or drop it.',
    }),
  );

  // 4. Titles that promise more than the script delivers ----------------------
  projects.forEach((p) => {
    const t = p.packaging.titles.find((x) => x.selected);
    if (!t) return;
    if (t.checks.overpromises || t.checks.deliveredByScript === false) {
      out.push({
        id: `overpromise_${p.id}`,
        severity: 'serious',
        channelId: p.channelId,
        title: 'Title writes a cheque the script does not cash',
        detail: `"${t.text}" on "${p.workingTitle}".`,
        action: 'Narrow the title or add the section that earns it.',
      });
    }
  });

  // 5. Overproduction delaying consistency -----------------------------------
  CHANNEL_IDS.forEach((cid) => {
    const ch = CHANNELS[cid];
    if (!ch.workspace.pressure.consistencyWarnings) return; // World's Finest opts out entirely
    const inFlight = projects.filter(
      (p) => p.channelId === cid && ['developing', 'packaging', 'scripting', 'ready-to-record', 'recording', 'editing'].includes(p.stage),
    );
    const stalled = inFlight.filter((p) => daysAgo(p.updatedAt) > 21);
    if (inFlight.length >= 4 && stalled.length >= 2) {
      out.push({
        id: `overproduction_${cid}`,
        severity: 'watch',
        channelId: cid,
        title: 'Production is eating consistency',
        detail: `${inFlight.length} projects open on ${ch.name}, ${stalled.length} untouched for 3+ weeks.`,
        action: 'Ship the closest one at 80% rather than perfecting all four.',
      });
    }
  });

  // 6. Theory without lived experience ---------------------------------------
  const cwPublished = published.filter((p) => p.channelId === 'corey-williams').slice(-6);
  const noStory = cwPublished.filter(
    (p) => !p.concept.evidence.some((e) => e.kind === 'personal-experience'),
  );
  if (cwPublished.length >= 3 && noStory.length >= Math.ceil(cwPublished.length * 0.6)) {
    out.push({
      id: 'theory-heavy',
      severity: 'serious',
      channelId: 'corey-williams',
      title: 'Too much theory, not enough lived evidence',
      detail: `${noStory.length} of the last ${cwPublished.length} Corey Williams videos had no personal-experience evidence.`,
      action: 'Next one starts from a story you have not told yet.',
    });
  }

  // 7. Personal storytelling without a useful conclusion ----------------------
  const storyNoPayoff = published.filter(
    (p) =>
      p.channelId === 'corey-williams' &&
      p.concept.evidence.some((e) => e.kind === 'personal-experience') &&
      !p.concept.viewerTransformation.trim(),
  );
  if (storyNoPayoff.length >= 2) {
    out.push({
      id: 'story-no-payoff',
      severity: 'watch',
      channelId: 'corey-williams',
      title: 'Stories without a landing',
      detail: `${storyNoPayoff.length} videos tell a personal story but never define what the viewer does differently.`,
      action: 'Fill in the viewer transformation before scripting the next one.',
    });
  }

  // 8. Channel overlap --------------------------------------------------------
  for (let i = 0; i < projects.length; i++) {
    for (let j = i + 1; j < projects.length; j++) {
      const a = projects[i];
      const b = projects[j];
      if (a.channelId === b.channelId) continue;
      if (a.stage === 'archived' || b.stage === 'archived') continue;
      if (overlapScore(a.workingTitle, b.workingTitle) >= 0.7) {
        out.push({
          id: `overlap_${a.id}_${b.id}`,
          severity: 'info',
          title: 'Two channels are circling the same video',
          detail: `"${a.workingTitle}" (${CHANNELS[a.channelId].name}) and "${b.workingTitle}" (${CHANNELS[b.channelId].name}).`,
          action: 'Decide which channel owns it — or split the angle deliberately.',
        });
      }
    }
  }

  // 9. Neglecting a high-priority channel ------------------------------------
  CHANNEL_IDS.forEach((cid) => {
    const ch = CHANNELS[cid];
    const target = ch.workspace.pressure.cadenceTargetDays;
    if (!target || !ch.workspace.pressure.overdueIndicators) return;
    const last = published
      .filter((p) => p.channelId === cid)
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))[0];
    const gap = daysAgo(last?.publishedAt);
    if (gap > target * 2.5 && ch.strategicPriority <= 2) {
      out.push({
        id: `neglect_${cid}`,
        severity: 'serious',
        channelId: cid,
        title: `${ch.name} is being neglected`,
        detail: Number.isFinite(gap)
          ? `${Math.round(gap)} days since the last upload against a ${target}-day target on a priority-${ch.strategicPriority} channel.`
          : `No published videos yet on a priority-${ch.strategicPriority} channel.`,
        action: 'Promote the strongest saved idea on this channel to Selected.',
      });
    }
  });

  // 10. Treating World's Finest like an obligation ---------------------------
  const wf = projects.filter((p) => p.channelId === 'worlds-finest');
  const wfHeavy = wf.filter(
    (p) => p.script.beats.length > 8 || p.production.filter((t) => !t.done).length > 14 || p.targetPublishDate,
  );
  if (wfHeavy.length) {
    out.push({
      id: 'wf-obligation',
      severity: 'watch',
      channelId: 'worlds-finest',
      title: "World's Finest is starting to look like work",
      detail: `${wfHeavy.length} project${wfHeavy.length > 1 ? 's have' : ' has'} a full production load or a deadline attached. This channel exists because it is easy.`,
      action: 'Strip it back to a reaction card, or drop the target date.',
    });
  }
  const wfBacklog = wf.filter((p) => ['developing', 'packaging', 'scripting'].includes(p.stage));
  if (wfBacklog.length >= 3) {
    out.push({
      id: 'wf-backlog',
      severity: 'info',
      channelId: 'worlds-finest',
      title: "World's Finest backlog is building",
      detail: `${wfBacklog.length} half-planned reactions. Not a problem — but they are stale by definition.`,
      action: 'Archive the ones you no longer feel like making. No guilt attached.',
    });
  }

  // Library signal: unused material worth spending -----------------------------
  const unusedStories = library.filter((e) => e.type === 'personal-story' && !e.used);
  if (unusedStories.length >= 5) {
    out.push({
      id: 'unused-stories',
      severity: 'info',
      title: `${unusedStories.length} personal stories sitting unused`,
      detail: 'The most defensible content you have is already written down and unspent.',
      action: 'Generate Corey Williams ideas from unresolved stories.',
    });
  }

  const order: Record<WarningSeverity, number> = { serious: 0, watch: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

export interface ChannelHealth {
  channelId: ChannelId;
  published90: number;
  inFlight: number;
  daysSinceLastPublish: number | null;
  /** 0-100. Cadence is only part of it on channels that want cadence. */
  health: number;
  status: string;
  /** True when the app must not nag about this channel. */
  pressureExempt: boolean;
}

export function channelHealth(projects: ContentProject[]): ChannelHealth[] {
  return CHANNEL_IDS.map((cid) => {
    const ch = CHANNELS[cid];
    const mine = projects.filter((p) => p.channelId === cid);
    const published = mine.filter((p) => p.publishedAt);
    const published90 = published.filter((p) => daysAgo(p.publishedAt) <= 90).length;
    const inFlight = mine.filter((p) => !['published', 'review', 'archived'].includes(p.stage)).length;
    const last = published.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))[0];
    const gap = last?.publishedAt ? Math.round(daysAgo(last.publishedAt)) : null;
    const pressureExempt = !ch.workspace.pressure.overdueIndicators;

    let health: number;
    let status: string;
    if (pressureExempt) {
      // Health here means "is there something easy and enjoyable available",
      // never "are you behind".
      health = inFlight > 0 ? 85 : 70;
      status = inFlight > 0 ? 'Something loose and ready when you feel like it' : 'Nothing pending — that is fine';
    } else {
      const target = ch.workspace.pressure.cadenceTargetDays ?? 14;
      const cadence = gap === null ? 40 : Math.max(0, 100 - Math.max(0, gap - target) * (60 / target));
      const flow = Math.min(100, inFlight * 25);
      health = Math.round(cadence * 0.6 + flow * 0.4);
      status =
        gap === null
          ? 'No uploads yet'
          : gap > target * 2
            ? `${gap} days since last upload — overdue`
            : gap > target
              ? `${gap} days since last upload`
              : `On cadence (${gap}d)`;
    }
    return { channelId: cid, published90, inFlight, daysSinceLastPublish: gap, health, status, pressureExempt };
  });
}
