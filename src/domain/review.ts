/**
 * Performance learning loop.
 *
 * Four separate results, deliberately not collapsed into one number:
 *   packaging  — did people click?
 *   content    — did they keep watching?
 *   brand      — did it strengthen the intended identity?
 *   creator    — was Corey proud of it, and was the process sustainable?
 *
 * A video can underperform numerically and still be strategically valuable.
 * A viral video can damage channel identity by attracting the wrong audience.
 */

import { CHANNELS } from './channels';
import type { ContentProject, PerformanceInputs, PerformanceReview } from './types';

export interface ResultVerdict {
  label: 'strong' | 'fine' | 'weak' | 'mixed';
  text: string;
}

/** Rough CTR expectations, by channel character rather than by industry myth. */
const CTR_BASELINE: Record<string, number> = {
  'corey-williams': 4.5,
  'core-workshop': 5.0,
  cdogg: 5.5,
  'worlds-finest': 4.0,
};

export function analysePackaging(project: ContentProject, i: PerformanceInputs): ResultVerdict {
  const base = CTR_BASELINE[project.channelId] ?? 4.5;
  const ctr = i.clickThroughRate;
  const title = project.packaging.titles.find((t) => t.selected);
  const bits: string[] = [];
  let label: ResultVerdict['label'];

  if (ctr >= base * 1.4) {
    label = 'strong';
    bits.push(`${ctr.toFixed(1)}% CTR against a ${base}% working baseline — the packaging did its job.`);
  } else if (ctr >= base * 0.85) {
    label = 'fine';
    bits.push(`${ctr.toFixed(1)}% CTR is in the normal band for this channel.`);
  } else {
    label = 'weak';
    bits.push(`${ctr.toFixed(1)}% CTR against a ${base}% baseline — people saw it and kept scrolling.`);
  }

  if (i.impressions > 0 && i.views / i.impressions < 0.02 && i.impressions > 5000) {
    bits.push('High impressions with low clicks usually means the thumbnail is legible but not interesting, not the reverse.');
  }
  if (title?.checks.interchangeable) {
    bits.push('The chosen title was flagged as interchangeable with other creators at packaging time. That flag was probably right.');
  }
  if (label === 'strong' && i.averageViewDurationSeconds < project.script.estimatedDurationSeconds * 0.25) {
    bits.push('Clicks were strong and retention was not: the packaging promised something the video did not open with.');
  }
  return { label, text: bits.join(' ') };
}

export function analyseContent(project: ContentProject, i: PerformanceInputs): ResultVerdict {
  const planned = Math.max(1, project.script.estimatedDurationSeconds);
  const pct = (i.averageViewDurationSeconds / planned) * 100;
  const bits: string[] = [];
  let label: ResultVerdict['label'];

  if (pct >= 55) {
    label = 'strong';
    bits.push(`${Math.round(pct)}% average view duration — the argument held.`);
  } else if (pct >= 35) {
    label = 'fine';
    bits.push(`${Math.round(pct)}% average view duration, which is ordinary rather than bad.`);
  } else {
    label = 'weak';
    bits.push(`${Math.round(pct)}% average view duration — they left early.`);
  }

  const curve = i.retentionCurve;
  if (curve.length >= 3) {
    let worstIdx = 1;
    let worstDrop = 0;
    for (let k = 1; k < curve.length; k++) {
      const drop = curve[k - 1] - curve[k];
      if (drop > worstDrop) {
        worstDrop = drop;
        worstIdx = k;
      }
    }
    const at = Math.round((worstIdx / curve.length) * planned);
    const beat = beatAt(project, at);
    bits.push(
      `Sharpest drop around ${fmt(at)}${beat ? ` — that is "${beat.role}"${beat.retentionRisk === 'high' ? ', which was flagged high-risk at beat-sheet time' : ''}.` : '.'}`,
    );
  }
  if (i.shares > i.likes * 0.15 && i.shares > 5) {
    bits.push('Share rate is unusually high relative to likes — people are sending this to someone specific.');
  }
  return { label, text: bits.join(' ') };
}

export function analyseBrand(project: ContentProject, i: PerformanceInputs): ResultVerdict {
  const ch = CHANNELS[project.channelId];
  const bits: string[] = [];
  let label: ResultVerdict['label'] = 'fine';

  const intended = project.brandAssociations;
  if (intended.length === 0) {
    bits.push('No brand associations were set on this project, so there is nothing to measure identity against.');
    return { label: 'mixed', text: bits.join(' ') };
  }
  bits.push(`Intended to strengthen: ${intended.join(', ')}.`);

  const returning = i.returningViewerPercent;
  const subsPerK = i.views > 0 ? (i.subscribersGained / i.views) * 1000 : 0;

  if (returning >= 35 && subsPerK >= 2) {
    label = 'strong';
    bits.push(`${returning}% returning viewers and ${subsPerK.toFixed(1)} subs per 1k views: it landed with the people you are actually building for.`);
  } else if (returning < 15 && i.views > 2000) {
    label = 'mixed';
    bits.push(`Only ${returning}% returning viewers. Reach came from strangers, which grows numbers faster than it grows a body of work.`);
  } else {
    bits.push(`${returning}% returning viewers, ${subsPerK.toFixed(1)} subs per 1k views.`);
  }

  if (ch.viralityPolicy === 'advisory') {
    bits.push('On this channel that number is context, not a target. It is not supposed to be optimised.');
    label = 'fine';
  }
  if (i.trafficSource.toLowerCase().includes('browse') && returning < 20 && ch.rigor === 'maximum') {
    bits.push('Mostly browse traffic with low return rate: this attracted an audience that does not yet know who you are.');
  }
  return { label, text: bits.join(' ') };
}

export function analyseCreator(project: ContentProject, i: PerformanceInputs): ResultVerdict {
  const bits: string[] = [];
  let label: ResultVerdict['label'];
  if (i.creatorSatisfaction >= 8) {
    label = 'strong';
    bits.push(`You rated this ${i.creatorSatisfaction}/10. Keep the parts of this process that made that true.`);
  } else if (i.creatorSatisfaction >= 5) {
    label = 'fine';
    bits.push(`${i.creatorSatisfaction}/10 — fine, not memorable.`);
  } else {
    label = 'weak';
    bits.push(`${i.creatorSatisfaction}/10. That matters as much as the retention graph.`);
  }
  if (!i.processSustainable) {
    bits.push('You marked the process unsustainable. If the format only works when you have a free weekend, it is not a format yet.');
    if (label === 'strong') label = 'mixed';
  }
  const undone = project.production.filter((t) => !t.done).length;
  if (undone > 6) bits.push(`${undone} production tasks were never checked off — worth knowing whether they were unnecessary or skipped under pressure.`);

  if (i.creatorSatisfaction >= 8 && i.views < 500) {
    bits.push('Low views, high satisfaction: this is the kind of video that pays off over years, not weeks. Do not delete it from the strategy.');
  }
  return { label, text: bits.join(' ') };
}

function beatAt(project: ContentProject, seconds: number) {
  let t = 0;
  for (const b of project.script.beats) {
    if (seconds >= t && seconds < t + b.durationSeconds) return b;
    t += b.durationSeconds;
  }
  return undefined;
}

export const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Build the deterministic parts of a review. AI can enrich this afterwards. */
export function buildReview(project: ContentProject, inputs: PerformanceInputs): PerformanceReview {
  const packaging = analysePackaging(project, inputs);
  const content = analyseContent(project, inputs);
  const brand = analyseBrand(project, inputs);
  const creator = analyseCreator(project, inputs);

  const whatWorked: string[] = [];
  const whatFailed: string[] = [];
  if (packaging.label === 'strong') whatWorked.push('Packaging: the title/thumbnail pair earned the click.');
  if (packaging.label === 'weak') whatFailed.push('Packaging: the promise was not visible enough to stop a scroll.');
  if (content.label === 'strong') whatWorked.push('Structure: the beat order held attention.');
  if (content.label === 'weak') whatFailed.push('Structure: the middle did not earn its length.');
  if (brand.label === 'strong') whatWorked.push('It reached the audience you are actually building.');
  if (brand.label === 'mixed') whatFailed.push('Reach came from outside your intended audience.');
  if (creator.label === 'weak') whatFailed.push('The process cost more than the result was worth.');
  if (creator.label === 'strong') whatWorked.push('You would make this again, which is a real signal.');

  const hookMatched =
    inputs.retentionCurve.length > 1 ? inputs.retentionCurve[1] >= 60 : packaging.label !== 'strong' || content.label !== 'weak';

  const changeNextTime: string[] = [];
  if (packaging.label === 'strong' && content.label === 'weak')
    changeNextTime.push('Open the video with the thing the thumbnail promised, in the first fifteen seconds.');
  if (packaging.label === 'weak' && content.label === 'strong')
    changeNextTime.push('The video was good and the packaging buried it. Re-title and re-thumbnail this one before making anything new.');
  if (!inputs.processSustainable) changeNextTime.push('Cut one production step from the next project in this format.');
  if (brand.label === 'mixed') changeNextTime.push('Next video on this channel should be unmistakably for the core audience.');

  return {
    inputs,
    packagingResult: packaging.text,
    contentResult: content.text,
    brandResult: brand.text,
    creatorResult: creator.text,
    whatWorked,
    whatFailed,
    dropOffNote: content.text,
    hookMatchedVideo: hookMatched,
    audienceLanguage: inputs.notableComments.slice(0, 5),
    followUpOpportunities: [],
    reusableClips: project.script.beats.filter((b) => b.shortsCandidate).map((b) => b.role),
    newQuestions: [],
    changeNextTime,
    reviewedAt: new Date().toISOString(),
  };
}

export const emptyPerformanceInputs = (): PerformanceInputs => ({
  views: 0,
  impressions: 0,
  clickThroughRate: 0,
  averageViewDurationSeconds: 0,
  retentionCurve: [100, 80, 65, 55, 48, 42, 38, 33, 28, 22],
  subscribersGained: 0,
  comments: 0,
  shares: 0,
  likes: 0,
  trafficSource: 'Browse',
  returningViewerPercent: 0,
  shortsViews: 0,
  creatorSatisfaction: 7,
  processSustainable: true,
  notableComments: [],
});
