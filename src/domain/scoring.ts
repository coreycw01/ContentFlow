/**
 * Scoring engine.
 *
 * The universal dimensions are the same everywhere; the weighting is not.
 * Ranking is always driven by the channel's weighted score. Virality is
 * computed and displayed for every channel, but its influence on the
 * recommendation is governed by the channel's viralityPolicy — and on
 * World's Finest it has none at all.
 */

import { CHANNELS, DIMENSIONS, DIMENSION_LABELS } from './channels';
import type { ChannelId, EffortLevel, Idea, ScoreCard, ScoreDimension } from './types';

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Weighted 0-100 score using the channel's priorities. */
export function weightedScore(channelId: ChannelId, scores: ScoreCard): number {
  const w = CHANNELS[channelId].weights;
  let total = 0;
  let weightSum = 0;
  for (const d of DIMENSIONS) {
    total += scores[d] * w[d];
    weightSum += w[d];
  }
  return clamp(weightSum === 0 ? 0 : total / weightSum);
}

/** Packaging-and-spread potential. Deliberately channel-independent. */
export function viralityScore(scores: ScoreCard): number {
  const parts: [ScoreDimension, number][] = [
    ['curiosity', 3],
    ['sharePotential', 3],
    ['emotionalTension', 2],
    ['visualPotential', 2],
    ['clarity', 1],
    ['searchPotential', 1],
  ];
  const sum = parts.reduce((a, [d, k]) => a + scores[d] * k, 0);
  const weight = parts.reduce((a, [, k]) => a + k, 0);
  return clamp(sum / weight);
}

/** Long-term body-of-work value. Also channel-independent by design. */
export function brandScore(scores: ScoreCard): number {
  const parts: [ScoreDimension, number][] = [
    ['brandValue', 3],
    ['personalConnection', 3],
    ['credibility', 2],
    ['originality', 2],
    ['seriesPotential', 1],
  ];
  const sum = parts.reduce((a, [d, k]) => a + scores[d] * k, 0);
  const weight = parts.reduce((a, [, k]) => a + k, 0);
  return clamp(sum / weight);
}

export function scoreIdea(idea: Idea): Idea {
  return {
    ...idea,
    weightedScore: weightedScore(idea.channelId, idea.scores),
    viralityScore: viralityScore(idea.scores),
    brandScore: brandScore(idea.scores),
  };
}

/**
 * Ranking value used by the Selection Room and every "what should I do next"
 * recommendation. On advisory channels the virality score is stripped out
 * entirely so a high-virality idea can never outrank a genuinely wanted one.
 */
export function rankingScore(idea: Idea): number {
  const policy = CHANNELS[idea.channelId].viralityPolicy;
  if (policy === 'advisory') return idea.weightedScore;
  const viralWeight = policy === 'primary' ? 0.35 : 0.15;
  return clamp(idea.weightedScore * (1 - viralWeight) + idea.viralityScore * viralWeight);
}

export const EFFORT_ORDER: Record<EffortLevel, number> = { low: 0, medium: 1, high: 2 };

export const effortLabel = (e: EffortLevel) => e[0].toUpperCase() + e.slice(1);

/** Dimensions where this idea is weakest relative to what the channel wants. */
export function weakestForChannel(idea: Idea, count = 3): ScoreDimension[] {
  const w = CHANNELS[idea.channelId].weights;
  return DIMENSIONS.slice()
    .map((d) => ({ d, cost: (100 - idea.scores[d]) * w[d] }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, count)
    .map((x) => x.d);
}

export function strongestForChannel(idea: Idea, count = 3): ScoreDimension[] {
  const w = CHANNELS[idea.channelId].weights;
  return DIMENSIONS.slice()
    .map((d) => ({ d, gain: idea.scores[d] * w[d] }))
    .sort((a, b) => b.gain - a.gain)
    .slice(0, count)
    .map((x) => x.d);
}

export interface ComparisonRow {
  label: string;
  values: (number | string)[];
  /** Higher is better for numeric rows; effort is inverted. */
  higherIsBetter: boolean;
  numeric: boolean;
}

export function buildComparison(ideas: Idea[]): ComparisonRow[] {
  if (ideas.length === 0) return [];
  const rows: ComparisonRow[] = [
    { label: 'Channel fit', values: ideas.map((i) => i.weightedScore), higherIsBetter: true, numeric: true },
    { label: 'Personal authority', values: ideas.map((i) => i.scores.personalConnection), higherIsBetter: true, numeric: true },
    { label: 'Originality', values: ideas.map((i) => i.scores.originality), higherIsBetter: true, numeric: true },
    { label: 'Credibility', values: ideas.map((i) => i.scores.credibility), higherIsBetter: true, numeric: true },
    { label: 'Emotional tension', values: ideas.map((i) => i.scores.emotionalTension), higherIsBetter: true, numeric: true },
    { label: 'Virality potential', values: ideas.map((i) => i.viralityScore), higherIsBetter: true, numeric: true },
    { label: 'Production effort', values: ideas.map((i) => effortLabel(i.effort)), higherIsBetter: false, numeric: false },
    { label: 'Brand value', values: ideas.map((i) => i.brandScore), higherIsBetter: true, numeric: true },
  ];
  return rows;
}

export interface Recommendation {
  winnerId: string;
  headline: string;
  /** One blunt paragraph. */
  body: string;
  /** Per-idea one-liners, in the order given. */
  notes: { ideaId: string; text: string }[];
}

/**
 * The blunt recommendation. It is allowed to say an idea is weak, and on
 * advisory channels it explicitly refuses to let virality drive the call.
 */
export function recommend(ideas: Idea[]): Recommendation | null {
  if (ideas.length === 0) return null;
  const ranked = ideas.slice().sort((a, b) => rankingScore(b) - rankingScore(a));
  const winner = ranked[0];
  const ch = CHANNELS[winner.channelId];
  const mostViral = ideas.slice().sort((a, b) => b.viralityScore - a.viralityScore)[0];
  const easiest = ideas.slice().sort((a, b) => EFFORT_ORDER[a.effort] - EFFORT_ORDER[b.effort])[0];
  const mostPersonal = ideas
    .slice()
    .sort((a, b) => b.scores.personalConnection - a.scores.personalConnection)[0];

  const sentences: string[] = [];

  if (ch.viralityPolicy === 'advisory') {
    sentences.push(
      `${winner.workingTitle} is the one you actually want to make, which on ${ch.name} is the whole test.`,
    );
    if (mostViral.id !== winner.id) {
      sentences.push(
        `${mostViral.workingTitle} scores higher on virality (${mostViral.viralityScore} vs ${winner.viralityScore}), and that is deliberately not a reason to pick it here.`,
      );
    }
    sentences.push(
      'This channel is not on a schedule and does not owe anyone a growth curve. Pick the one that sounds fun tonight.',
    );
  } else {
    sentences.push(
      `${winner.workingTitle} is the strongest ${ch.name} choice: ${winner.weightedScore} on channel fit, ${winner.brandScore} on brand value.`,
    );
    if (mostViral.id !== winner.id && mostViral.viralityScore > winner.viralityScore + 6) {
      const gap = mostViral.scores.personalConnection < winner.scores.personalConnection;
      sentences.push(
        `${mostViral.workingTitle} may attract more clicks (${mostViral.viralityScore} virality)${
          gap
            ? `, but your connection to it is weaker (${mostViral.scores.personalConnection} vs ${winner.scores.personalConnection}) and the video risks sounding researched rather than lived.`
            : ', so it is a real alternative if reach is this month\'s goal.'
        }`,
      );
    }
    if (easiest.id !== winner.id && EFFORT_ORDER[easiest.effort] < EFFORT_ORDER[winner.effort]) {
      sentences.push(
        `${easiest.workingTitle} is the fastest publish, but it contributes less to the long-term identity of the channel (${easiest.brandScore} brand value).`,
      );
    }
    if (mostPersonal.id !== winner.id && mostPersonal.scores.personalConnection > winner.scores.personalConnection + 10) {
      sentences.push(
        `If you want the one you can defend in a room full of skeptics, that is ${mostPersonal.workingTitle}.`,
      );
    }
  }

  const notes = ideas.map((i) => {
    const weak = weakestForChannel(i, 1)[0];
    const strong = strongestForChannel(i, 1)[0];
    const warn = i.originalityWarnings[0];
    return {
      ideaId: i.id,
      text: warn
        ? `Strongest on ${DIMENSION_LABELS[strong].toLowerCase()}. ${warn}`
        : `Strongest on ${DIMENSION_LABELS[strong].toLowerCase()}; weakest link is ${DIMENSION_LABELS[weak].toLowerCase()} (${i.scores[weak]}).`,
    };
  });

  return {
    winnerId: winner.id,
    headline: `Pick: ${winner.workingTitle}`,
    body: sentences.join(' '),
    notes,
  };
}
