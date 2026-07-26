/**
 * Prompt construction.
 *
 * Every request to Claude carries the doctrine of the channel it is for. That
 * is the point of the whole product: the model must not be allowed to flatten
 * four channels into one voice.
 */

import { CHANNELS, DIMENSION_LABELS, formatOf, seriesOf, topWeightedDimensions } from '../domain/channels';
import type { ChannelId, ContentProject, Direction, LibraryEntry } from '../domain/types';
import type { GenerationContext } from './types';

export function channelDoctrine(channelId: ChannelId): string {
  const ch = CHANNELS[channelId];
  const top = topWeightedDimensions(channelId, 5).map((d) => DIMENSION_LABELS[d]);
  const low = ch.deprioritised.map((d) => DIMENSION_LABELS[d]);

  return [
    `CHANNEL: ${ch.name} — ${ch.tagline}`,
    `PURPOSE: ${ch.purpose}`,
    `DOCTRINE: ${ch.doctrine}`,
    `RIGOR LEVEL: ${ch.rigor}`,
    `WHAT MATTERS MOST HERE: ${top.join(', ')}`,
    `WHAT MATTERS LEAST HERE: ${low.join(', ')}`,
    `VIRALITY POLICY: ${
      ch.viralityPolicy === 'advisory'
        ? 'Show virality if asked, but it must NEVER influence a recommendation on this channel. This channel is deliberately protected from optimisation.'
        : ch.viralityPolicy === 'primary'
          ? 'Virality and shareability are legitimate primary drivers here.'
          : 'Virality is secondary to personal authority and long-term brand value.'
    }`,
    `SERIES: ${ch.series.map((s) => `${s.name} (${s.description})`).join('; ')}`,
    `FORMATS: ${ch.formats.map((f) => `${f.name} — ${f.description}`).join('; ')}`,
    `SCRIPT STRUCTURE: ${ch.scriptMode.structure.join(' → ')}`,
    `SCRIPT REQUIREMENT: ${ch.scriptMode.scriptRequirement}`,
    `NEVER DO ON THIS CHANNEL: ${ch.scriptMode.avoid.join('; ')}`,
    `TONE: ${ch.scriptMode.toneNotes.join(' ')}`,
    `BRAND ASSOCIATIONS THIS CHANNEL CARRIES: ${ch.brandAssociations.join(', ')}`,
  ].join('\n');
}

export const CREATOR_PROFILE = `
You are working for Corey Williams, who runs four YouTube channels with deliberately different purposes.
He is an engineer and electrician with years on the tools, a father, a systems thinker, a gamer, and a
lifelong comic-book reader. He has spent about five years on deliberate self-development — habits,
communication, discipline, identity.

He does not want flattery. He wants an editor who will tell him when an idea is derivative, when a claim
outruns the evidence, and when a title promises something the script does not deliver. Praising a weak
idea costs him a month of production time, so it is worse than useless.
`.trim();

export function systemPrompt(channelId: ChannelId): string {
  return [
    CREATOR_PROFILE,
    '',
    channelDoctrine(channelId),
    '',
    'RULES:',
    '- Be specific. Replace abstractions with the concrete thing wherever you can.',
    '- Criticise honestly. If an idea is a familiar shape, say so and name what it would need to be worth making.',
    '- Never invent lived experience Corey has not stated. If a claim needs personal evidence he has not given you, say the evidence is missing rather than fabricating a story.',
    '- Respect the channel doctrine above over any general YouTube best practice.',
    '- Output valid JSON matching the requested schema and nothing else.',
  ].join('\n');
}

export function directionBrief(direction: Direction): string {
  const s = seriesOf(direction.channelId, direction.seriesId);
  const f = formatOf(direction.channelId, direction.desiredFormatId);
  return [
    `Topic: ${direction.topic || '(none given)'}`,
    s ? `Series: ${s.name} — ${s.description}` : 'Series: none chosen',
    f ? `Desired format: ${f.name}` : 'Desired format: open',
    `Goals: ${direction.goals.join(', ') || 'unspecified'}`,
    `Audience state: ${direction.audienceState}`,
    `Time available: ${direction.availableTimeMinutes} minutes`,
    `Energy: ${direction.energy}`,
    `Timeliness: ${direction.timeliness}`,
    `Materials/footage on hand: ${direction.availableMaterials || 'none stated'}`,
    `Personal experience Corey brings: ${direction.personalExperience || 'none stated'}`,
  ].join('\n');
}

export function libraryBrief(entries: LibraryEntry[], limit = 25): string {
  if (entries.length === 0) return 'Library: empty.';
  return [
    'CONTENT LIBRARY (real material Corey already has — prefer grounding ideas in these):',
    ...entries.slice(0, limit).map(
      (e) =>
        `- [${e.type}${e.used ? ', already used' : ', unused'}${e.unresolved ? ', unresolved' : ''}] ${e.title}: ${e.body.slice(0, 200)}`,
    ),
  ].join('\n');
}

export function historyBrief(history: ContentProject[], limit = 15): string {
  if (history.length === 0) return 'No published history yet.';
  return [
    'ALREADY PUBLISHED (do not repeat these arguments):',
    ...history.slice(-limit).map((p) => `- "${p.workingTitle}" — ${p.concept.coreArgument.slice(0, 160)}`),
  ].join('\n');
}

export function lessonsBrief(ctx: GenerationContext): string {
  const parts: string[] = [];
  if (ctx.rejectionSignals.length) {
    parts.push(
      'PAST REJECTIONS (avoid repeating these failure modes):',
      ...ctx.rejectionSignals.map((s) => `- ${s.reason} × ${s.count}${s.examples.length ? ` e.g. "${s.examples[0]}"` : ''}`),
    );
  }
  if (ctx.lessons.length) {
    parts.push('LESSONS FROM PUBLISHED PERFORMANCE:', ...ctx.lessons.slice(0, 10).map((l) => `- ${l}`));
  }
  return parts.join('\n');
}

export function projectBrief(project: ContentProject): string {
  const c = project.concept;
  return [
    `PROJECT: ${project.workingTitle}`,
    `Stage: ${project.stage}`,
    `Core argument: ${c.coreArgument || '(empty)'}`,
    `Viewer transformation: ${c.viewerTransformation || '(empty)'}`,
    `Starting belief: ${c.startingBelief || '(empty)'}`,
    `Ending belief: ${c.endingBelief || '(empty)'}`,
    `Personal stake: ${c.personalStake || '(empty)'}`,
    `Tension: ${c.tension || '(empty)'}`,
    `Counterargument: ${c.counterargument || '(empty)'}`,
    `Honest limitation: ${c.honestLimitation || '(empty)'}`,
    `Memorable line: ${c.memorableLine || '(empty)'}`,
    `Evidence: ${c.evidence.map((e) => `[${e.kind}] ${e.detail}`).join(' | ') || 'none'}`,
    project.packaging.titles.find((t) => t.selected)
      ? `Selected title: ${project.packaging.titles.find((t) => t.selected)!.text}`
      : 'No title selected yet.',
  ].join('\n');
}
