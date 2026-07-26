/**
 * Gates and next-action logic.
 *
 * Two rules drive this file:
 *
 * 1. The app blocks script generation when the core argument is vague.
 *    Otherwise it produces five minutes of polished repetition.
 * 2. Every gate is skippable except on channels whose doctrine says otherwise,
 *    and every blocked state comes with a reason and a fix — never a dead end.
 */

import { CHANNELS } from './channels';
import type { ContentProject } from './types';

export interface GateResult {
  ok: boolean;
  /** Hard blockers. */
  blockers: string[];
  /** Soft warnings the user may knowingly ignore. */
  warnings: string[];
  /** Whether the user is allowed to override. */
  overridable: boolean;
}

/** Abstractions that make a core argument unfalsifiable. */
const VAGUE_TOKENS = [
  'things', 'stuff', 'life', 'better', 'growth', 'mindset', 'journey', 'success',
  'happiness', 'productivity', 'motivation', 'improve', 'level up', 'unlock',
  'the truth about', 'everything', 'anything', 'people should', 'we all',
];

/** Phrases that describe the video instead of stating its argument. */
const META_OPENERS = [
  'this video is about', 'this video will', "in this video", 'this is a video',
  'i want to talk about', "we'll talk about", 'we will talk about', "i'm going to talk about",
  'today i want to', 'this essay is about',
];

/** Words that indicate an actual claim rather than a topic label. */
const CLAIM_MARKERS = [
  ' is ', ' are ', ' because ', ' means ', ' requires ', ' fails ', ' causes ',
  ' produces ', ' unless ', ' until ', ' instead of ', ' rather than ', ' cannot ',
  " isn't ", ' not ', ' when ', ' only ', ' but ', ' so that ',
];

export interface ArgumentQuality {
  vague: boolean;
  score: number; // 0-100
  problems: string[];
}

/**
 * Heuristic vagueness check for the core argument. It is intentionally
 * conservative: it flags obviously empty arguments rather than trying to
 * grade prose.
 */
export function assessCoreArgument(text: string): ArgumentQuality {
  const t = text.trim();
  const lower = ` ${t.toLowerCase()} `;
  const problems: string[] = [];
  let score = 100;

  if (t.length === 0) {
    return { vague: true, score: 0, problems: ['The core argument is empty.'] };
  }
  const words = t.split(/\s+/).length;
  if (words < 8) {
    problems.push('Too short to be an argument — this reads as a topic, not a claim.');
    score -= 45;
  }
  if (!CLAIM_MARKERS.some((m) => lower.includes(m))) {
    problems.push('No claim structure. Say what is true and why, not what the video is about.');
    score -= 30;
  }
  // Describing the video is not the same as stating what it argues.
  if (META_OPENERS.some((m) => lower.includes(m))) {
    problems.push('This describes the video rather than stating its claim. Cut "this video is about…" and say the thing.');
    score -= 30;
  }

  const hits = VAGUE_TOKENS.filter((v) => lower.includes(` ${v} `) || lower.includes(`${v} `));
  if (hits.length >= 2) {
    problems.push(`Leaning on abstractions: ${hits.slice(0, 4).join(', ')}. Replace at least one with something specific.`);
    // Each additional abstraction compounds — soup is worse than one soft word.
    score -= Math.min(45, 15 + (hits.length - 2) * 12);
  }
  if (t.endsWith('?')) {
    problems.push('This is a question. A question is a hook, not an argument — answer it here.');
    score -= 25;
  }
  if (/^(how|why|what|when) /i.test(t) && words < 16) {
    problems.push('Starts as a headline rather than a position.');
    score -= 15;
  }
  score = Math.max(0, Math.min(100, score));
  return { vague: score < 55, score, problems };
}

/** Can this project move into scripting? */
export function scriptGate(project: ContentProject): GateResult {
  const gates = CHANNELS[project.channelId].gates;
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (gates.requireCoreArgument) {
    const q = assessCoreArgument(project.concept.coreArgument);
    if (q.vague) {
      blockers.push(
        `Core argument is too vague to script (${q.score}/100). ${q.problems[0] ?? ''}`.trim(),
      );
      q.problems.slice(1).forEach((p) => warnings.push(p));
    }
  }
  if (gates.requireEvidence && project.concept.evidence.length === 0) {
    blockers.push('No evidence yet. Add at least one lived example, demonstration or source.');
  }
  if (gates.requireCounterargument && !project.concept.counterargument.trim()) {
    warnings.push('No counterargument. An intelligent skeptic will find one whether or not you do.');
  }
  if (gates.requireHonestLimitation && !project.concept.honestLimitation.trim()) {
    warnings.push('No honest limitation written. Saying what this cannot prove is what makes the rest credible.');
  }
  if (!project.concept.viewerTransformation.trim()) {
    warnings.push('No viewer transformation defined — the ending will drift.');
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    // Only the reflective/technical channels hold the line hard.
    overridable: CHANNELS[project.channelId].rigor !== 'maximum',
  };
}

/** Can this project be marked ready to record? */
export function recordGate(project: ContentProject): GateResult {
  const ch = CHANNELS[project.channelId];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const req = ch.scriptMode.scriptRequirement;

  if (project.script.beats.length === 0) {
    if (req === 'reaction-card') {
      warnings.push('No talking points yet. A seven-bullet card is enough here.');
    } else {
      blockers.push('No beats yet. Build the beat sheet before recording.');
    }
  }
  if (req === 'full-script' && project.script.beats.some((b) => !b.draft?.trim())) {
    warnings.push('Some beats have no draft. Recording from an outline is fine — just know which parts are improvised.');
  }
  if (!project.packaging.titles.some((t) => t.selected)) {
    warnings.push('No title direction chosen. The hook usually changes once the title is fixed.');
  }
  if (ch.gates.requireSafetyNote) {
    const hasSafety =
      project.script.beats.some((b) => /safety|ppe|lockout|breaker|voltage|glove/i.test(`${b.role} ${b.information} ${b.draft ?? ''}`)) ||
      project.production.some((t) => /safety/i.test(t.label));
    if (!hasSafety) blockers.push('Core Workshop requires a safety note before recording.');
  }
  return { ok: blockers.length === 0, blockers, warnings, overridable: ch.rigor !== 'high' && ch.rigor !== 'maximum' };
}

/** Can this project publish? */
export function publishGate(project: ContentProject): GateResult {
  const ch = CHANNELS[project.channelId];
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (ch.gates.requireTitleDeliveryCheck) {
    const title = project.packaging.titles.find((t) => t.selected);
    if (title && title.checks.deliveredByScript === false) {
      blockers.push(`The script does not deliver "${title.text}". Change the title or change the video.`);
    }
    if (title && title.checks.deliveredByScript === undefined) {
      warnings.push('Title-delivery check has not been run.');
    }
  }
  return { ok: blockers.length === 0, blockers, warnings, overridable: true };
}

/**
 * The single recommended next action for a project. Every stage in the app has
 * one primary button; this decides what it says.
 */
export function nextAction(project: ContentProject): { label: string; hint: string; route: string } {
  const p = project;
  const ch = CHANNELS[p.channelId];
  const to = (tab: string) => `#/project/${p.id}/${tab}`;

  switch (p.stage) {
    case 'inbox':
    case 'generated':
    case 'reviewing':
      return { label: 'Compare and decide', hint: 'Put it next to its alternatives before committing.', route: '#/selection' };
    case 'selected':
    case 'developing': {
      const gate = scriptGate(p);
      if (!gate.ok) return { label: 'Sharpen the core argument', hint: gate.blockers[0], route: to('concept') };
      return { label: 'Package it', hint: 'Decide the promise before writing the video that keeps it.', route: to('packaging') };
    }
    case 'packaging': {
      if (!p.packaging.titles.some((t) => t.selected))
        return { label: 'Choose a title direction', hint: 'Ten directions generated; pick the one that sounds like you.', route: to('packaging') };
      return { label: 'Build the argument map', hint: 'Structure before prose.', route: to('script') };
    }
    case 'scripting': {
      if (!p.script.argumentMap) return { label: 'Build the argument map', hint: 'Level 1 of 4.', route: to('script') };
      if (p.script.beats.length === 0) return { label: 'Generate the beat sheet', hint: 'Level 2 of 4.', route: to('script') };
      if (ch.scriptMode.scriptRequirement !== 'reaction-card' && p.script.beats.some((b) => !b.draft))
        return { label: 'Draft the remaining sections', hint: 'Level 3 of 4 — one section at a time.', route: to('script') };
      return { label: 'Approve the script', hint: 'Approving generates the shot list and production board.', route: to('script') };
    }
    case 'ready-to-record':
      return { label: 'Work the recording checklist', hint: 'Generated from your actual beats, not a generic list.', route: to('production') };
    case 'recording':
      return { label: 'Mark capture complete', hint: 'Then the post checklist unlocks.', route: to('production') };
    case 'editing':
      return { label: 'Work the post checklist', hint: 'Timeline is the source of truth for B-roll.', route: to('timeline') };
    case 'scheduled':
      return { label: 'Confirm title and thumbnail alignment', hint: 'Last honest check before it is public.', route: to('packaging') };
    case 'published':
      return { label: 'Enter performance data', hint: 'Four results: packaging, content, brand, creator.', route: to('review') };
    case 'review':
      return { label: 'Capture the lesson', hint: 'This feeds the next round of idea generation.', route: to('review') };
    case 'archived':
      return { label: 'Reuse this material', hint: 'Clips, stories and hooks live on in the library.', route: '#/library' };
  }
}
