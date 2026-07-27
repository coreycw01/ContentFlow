/**
 * The local creative engine.
 *
 * This runs with no API key and no network. It is not a language model: it is
 * a doctrine-driven generator. Everything it produces is derived from the
 * channel definition, the direction inputs, the content library and the
 * project's own concept canvas — which means it is honest about its limits and
 * still useful offline.
 *
 * It is deliberately willing to criticise. Ideas that trip the cliché lexicon
 * or that lack personal evidence get warnings and score penalties.
 */

import { CHANNELS, emptyScoreCard, formatOf } from '../domain/channels';
import { rollSeed } from '../domain/seeds';
import { scoreIdea } from '../domain/scoring';
import { assessCoreArgument } from '../domain/readiness';
import type {
  ArgumentMap,
  BRollSuggestion,
  Beat,
  BeatTracks,
  ChannelId,
  ConceptCanvas,
  ContentProject,
  EffortLevel,
  HookOption,
  Idea,
  LibraryEntry,
  Packaging,
  ScoreCard,
  SectionAction,
  ThumbnailConcept,
  TitleAngle,
  TitleOption,
  VisualTreatment,
} from '../domain/types';
import type { CreativeEngine, GenerationContext, IdeaRequest } from './types';
import {
  clicheWarnings,
  jitter,
  keywords,
  lowerFirst,
  pick,
  pickMany,
  rng,
  secondsToWords,
  sentence,
  shortSubject,
  subjectPhrase,
  titleCase,
  uid,
  upperFirst,
} from './text';

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------

/**
 * A seed is the short, concrete phrase an idea grows from — "the third week",
 * "the burnt neutral", "the clutch I do not deserve". Keeping it short is what
 * makes the templates below read like sentences instead of like mail merge.
 */
interface Seed {
  /** Short phrase, title-ready. */
  text: string;
  /** Any longer context behind it. */
  detail: string;
  /** Lived evidence backing it, if any. */
  experience: string;
  entryId?: string;
  /** True when it came from real library material or stated experience. */
  grounded: boolean;
}

/** Title-case for the start of a title. */
const Cap = (s: string) => titleCase(s);
/** Lower-case for mid-sentence use. */
const low = (s: string) => lowerFirst(s);

function buildSeeds(ctx: GenerationContext, req: IdeaRequest): Seed[] {
  const { direction, library } = ctx;
  const out: Seed[] = [];
  const push = (s: Seed) => {
    if (s.text.trim() && !out.some((x) => x.text.toLowerCase() === s.text.toLowerCase())) out.push(s);
  };

  // 1. An explicit seed always leads — this is what the user typed or rolled.
  if (req.seed?.trim()) {
    push({
      text: shortSubject(req.seed, 9) ?? req.seed.trim(),
      detail: req.seed.trim(),
      experience: direction.personalExperience.trim(),
      grounded: Boolean(direction.personalExperience.trim()),
    });
  }

  // 2. Library material named explicitly.
  const named = req.sourceEntryIds?.length
    ? library.filter((e) => req.sourceEntryIds!.includes(e.id))
    : [];
  for (const e of named) {
    push({
      text: shortSubject(e.title, 9) ?? e.title,
      detail: e.body || e.title,
      experience: ['personal-story', 'lesson', 'build-project'].includes(e.type) ? e.body : '',
      entryId: e.id,
      grounded: true,
    });
  }

  // 3. The direction topic, when one was set.
  if (direction.topic.trim()) {
    push({
      text: shortSubject(direction.topic, 9) ?? subjectPhrase(direction.topic),
      detail: direction.topic.trim(),
      experience: direction.personalExperience.trim(),
      grounded: Boolean(direction.personalExperience.trim()),
    });
  }

  // 4. Fall back to unused library material for this channel.
  if (out.length < 3) {
    const pool = library.filter(
      (e) =>
        (e.channelIds.length === 0 || e.channelIds.includes(direction.channelId)) &&
        !e.used &&
        ['personal-story', 'lesson', 'build-project', 'gameplay-moment', 'movie-reaction', 'raw-idea', 'framework'].includes(e.type),
    );
    for (const e of pool.slice(0, 4)) {
      push({
        text: shortSubject(e.title, 9) ?? e.title,
        detail: e.body || e.title,
        experience: ['personal-story', 'lesson', 'build-project'].includes(e.type) ? e.body : '',
        entryId: e.id,
        grounded: true,
      });
    }
  }

  // 5. Last resort: roll from the channel's own seed bank rather than emitting
  //    something generic. An ungrounded seed is flagged on the card.
  while (out.length === 0) {
    const rolled = rollSeed(direction.channelId, out.map((s) => s.text));
    if (!rolled) break;
    push({ text: rolled, detail: rolled, experience: '', grounded: false });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Angle templates
// ---------------------------------------------------------------------------

interface Angle {
  id: string;
  label: string;
  formatId: string;
  emotionalAngle: string;
  effort: EffortLevel;
  title: (s: Seed) => string;
  premise: (s: Seed) => string;
  viewerProblem: (s: Seed) => string;
  corePromise: (s: Seed) => string;
  bias: Partial<ScoreCard>;
}

const ANGLES: Record<ChannelId, Angle[]> = {
  'corey-williams': [
    {
      id: 'got-it-wrong',
      label: 'What I got wrong',
      formatId: 'personal-essay',
      emotionalAngle: 'Recognition, then discomfort',
      effort: 'high',
      title: (s) => `${Cap(s.text)} — What I Got Wrong for Five Years`,
      premise: (s) => sentence(`A specific account of ${low(s.text)}, and the belief underneath it that kept producing the same outcome`),
      viewerProblem: () => 'They have the same pattern and have been treating it as a discipline problem.',
      corePromise: () => 'One honest post-mortem, with the mechanism named plainly.',
      bias: { personalConnection: 90, credibility: 84, emotionalTension: 84, brandValue: 88, originality: 72 },
    },
    {
      id: 'structure-not-willpower',
      label: 'Structural, not moral',
      formatId: 'framework-explainer',
      emotionalAngle: 'Relief — it was never a character flaw',
      effort: 'high',
      title: (s) => `${Cap(s.text)} Is a Structure Problem`,
      premise: (s) => sentence(`${upperFirst(low(s.text))} persists because the structure around it keeps rewarding it, so effort alone produces temporary compliance`),
      viewerProblem: () => 'They keep trying harder at something that is not an effort problem.',
      corePromise: () => 'A model of where the behaviour is produced, and which lever actually moves it.',
      bias: { originality: 76, clarity: 84, credibility: 80, brandValue: 86, visualPotential: 60, seriesPotential: 78 },
    },
    {
      id: 'nobody-warns',
      label: 'The unwarned part',
      formatId: 'personal-essay',
      emotionalAngle: 'Being told the thing nobody said',
      effort: 'medium',
      title: (s) => `Nobody Warns You About ${Cap(s.text)}`,
      premise: (s) => sentence(`The part of ${low(s.text)} that does not appear in any advice, because it only shows up once you are already committed`),
      viewerProblem: () => 'They followed good advice and hit something it never mentioned.',
      corePromise: () => 'The missing precondition, named before they need it.',
      bias: { curiosity: 84, emotionalTension: 80, personalConnection: 80, originality: 74 },
    },
    {
      id: 'case-against',
      label: 'Argue the other side',
      formatId: 'counterpoint',
      emotionalAngle: 'Friction with something they believe',
      effort: 'medium',
      title: (s) => `The Case Against ${Cap(s.text)}`,
      premise: (s) => sentence(`Take the strongest argument against ${low(s.text)} seriously enough to be changed by it`),
      viewerProblem: () => 'They hold the position without having tested it.',
      corePromise: () => 'A real disagreement, defended, not a strawman knocked over.',
      bias: { originality: 84, emotionalTension: 78, credibility: 78, curiosity: 80, brandValue: 78 },
    },
    {
      id: 'what-it-cost',
      label: 'The ledger',
      formatId: 'personal-essay',
      emotionalAngle: 'Sober accounting',
      effort: 'medium',
      title: (s) => `${Cap(s.text)}, and What It Cost`,
      premise: (s) => sentence(`An itemised account of what ${low(s.text)} actually cost — in time, relationships and options closed`),
      viewerProblem: () => 'They can see the benefit and have never priced the bill.',
      corePromise: () => 'An honest ledger, including the parts that still look worth it.',
      bias: { emotionalTension: 84, personalConnection: 82, originality: 76, brandValue: 80 },
    },
    {
      id: 'twenty-years',
      label: 'Measured in decades',
      formatId: 'personal-essay',
      emotionalAngle: 'Weight',
      effort: 'high',
      title: (s) => `${Cap(s.text)} in Twenty Years`,
      premise: (s) => sentence(`Evaluating ${low(s.text)} on a twenty-year horizon, which inverts almost every short-term recommendation`),
      viewerProblem: () => 'Every decision is optimised on a timescale that does not match their life.',
      corePromise: () => 'A longer measuring stick, and what it changes tomorrow morning.',
      bias: { brandValue: 92, personalConnection: 80, credibility: 78, searchPotential: 30, sharePotential: 44, seriesPotential: 80 },
    },
    {
      id: 'cannot-prove',
      label: 'The honest limit',
      formatId: 'personal-essay',
      emotionalAngle: 'Trust through admission',
      effort: 'medium',
      title: (s) => `${Cap(s.text)}: the Part I Still Cannot Prove`,
      premise: (s) => sentence(`Everything about ${low(s.text)} that holds up, and the one claim that rests on nothing but a decade of anecdote`),
      viewerProblem: () => 'They have heard confident versions of this and no honest ones.',
      corePromise: () => 'The argument and its exact edge, stated on camera.',
      bias: { credibility: 92, originality: 84, personalConnection: 82, brandValue: 86, sharePotential: 44 },
    },
    {
      id: 'loop',
      label: 'Drawn as a loop',
      formatId: 'framework-explainer',
      emotionalAngle: 'Clarity',
      effort: 'high',
      title: (s) => `${Cap(s.text)}, Drawn as a Loop`,
      premise: (s) => sentence(`Treating ${low(s.text)} as a feedback loop — belief, action, evidence — explains why the same outcome keeps arriving`),
      viewerProblem: () => 'They think in incidents; the problem is a cycle.',
      corePromise: () => 'A diagram they can hold in their head, and a place to cut the loop.',
      bias: { clarity: 88, visualPotential: 78, originality: 74, brandValue: 82, seriesPotential: 82 },
    },
  ],

  'core-workshop': [
    {
      id: 'what-failed',
      label: 'What actually failed',
      formatId: 'teardown',
      emotionalAngle: 'Detective satisfaction',
      effort: 'medium',
      title: (s) => `${Cap(s.text)} — What Actually Failed`,
      premise: (s) => sentence(`Open up ${low(s.text)}, find the real failure mode rather than the obvious one, and decide whether to repair or condemn it`),
      viewerProblem: () => 'They replace parts by guesswork and pay for it twice.',
      corePromise: () => 'A repeatable diagnostic order of operations.',
      bias: { credibility: 92, searchPotential: 86, visualPotential: 84, clarity: 84, curiosity: 78 },
    },
    {
      id: 'done-properly',
      label: 'Done properly',
      formatId: 'planned-build',
      emotionalAngle: 'Satisfaction of a thing made right',
      effort: 'high',
      title: (s) => `${Cap(s.text)}, Done Properly`,
      premise: (s) => sentence(`Take ${low(s.text)} from improvised to correct, showing every decision and the one that was wrong`),
      viewerProblem: () => 'They have the same job and no reference for what finished should look like.',
      corePromise: () => 'A correct result with the reasoning and the failure left in.',
      bias: { visualPotential: 90, credibility: 88, searchPotential: 78, clarity: 82, emotionalTension: 40 },
    },
    {
      id: 'manual-does-not-say',
      label: 'What the manual omits',
      formatId: 'technique-explainer',
      emotionalAngle: 'Insider knowledge',
      effort: 'medium',
      title: (s) => `${Cap(s.text)}: What the Manual Does Not Say`,
      premise: (s) => sentence(`The field knowledge around ${low(s.text)} that is correct, load-bearing, and written down nowhere`),
      viewerProblem: () => 'They followed the instructions exactly and it still went wrong.',
      corePromise: () => 'The specific tolerance, tool or check that decides the outcome.',
      bias: { searchPotential: 92, clarity: 88, credibility: 88, seriesPotential: 78, sharePotential: 48 },
    },
    {
      id: 'already-in-the-shop',
      label: 'Under constraint',
      formatId: 'planned-build',
      emotionalAngle: 'Resourcefulness',
      effort: 'medium',
      title: (s) => `${Cap(s.text)} With What Was Already in the Shop`,
      premise: (s) => sentence(`Solve ${low(s.text)} under a hard constraint: no new purchases, existing tools and stock only`),
      viewerProblem: () => 'Every build video assumes a tool budget they do not have.',
      corePromise: () => 'A constrained solution that still meets spec, and where the constraint hurt.',
      bias: { productionFeasibility: 88, originality: 80, visualPotential: 82, credibility: 80 },
    },
    {
      id: 'left-in-the-edit',
      label: 'The failure kept in',
      formatId: 'planned-build',
      emotionalAngle: 'Credibility through honesty',
      effort: 'medium',
      title: (s) => `${Cap(s.text)} — the Failure I Left in the Edit`,
      premise: (s) => sentence(`The attempt at ${low(s.text)} that went wrong on camera, kept in, because the recovery is the useful part`),
      viewerProblem: () => 'Every tutorial they watch works first time, which teaches them nothing.',
      corePromise: () => 'A real failure and the diagnosis that followed it.',
      bias: { credibility: 92, originality: 82, visualPotential: 80, emotionalTension: 66 },
    },
    {
      id: 'what-goes-wrong',
      label: 'Realistic failure modes',
      formatId: 'technique-explainer',
      emotionalAngle: 'Sober respect',
      effort: 'low',
      title: (s) => `What Goes Wrong With ${Cap(s.text)}`,
      premise: (s) => sentence(`The realistic failure and injury modes around ${low(s.text)}, stated without panic or bravado`),
      viewerProblem: () => 'They have seen the shortcut work on camera and never seen it fail.',
      corePromise: () => 'The exact conditions under which the shortcut kills the job.',
      bias: { credibility: 92, searchPotential: 78, clarity: 86, emotionalTension: 62 },
    },
    {
      id: 'field-solve',
      label: 'Unscripted job-site solve',
      formatId: 'job-site-solve',
      emotionalAngle: 'Competence under real conditions',
      effort: 'medium',
      title: (s) => `Real Job, Real Problem: ${Cap(s.text)}`,
      premise: (s) => sentence(`POV footage of solving ${low(s.text)} on an actual job, structured after the fact rather than staged`),
      viewerProblem: () => 'Tutorials show ideal conditions they never work in.',
      corePromise: () => 'What the decision looks like when the wall is already open.',
      bias: { credibility: 92, visualPotential: 84, productionFeasibility: 82, originality: 76 },
    },
    {
      id: 'v2',
      label: 'Version two',
      formatId: 'planned-build',
      emotionalAngle: 'Progress you can see',
      effort: 'medium',
      title: (s) => `${Cap(s.text)} v2 — Fixing What I Got Wrong`,
      premise: (s) => sentence(`Return to ${low(s.text)} with the failures from version one as the design brief`),
      viewerProblem: () => 'They only ever see version one, which is the version that hides the lessons.',
      corePromise: () => 'A design changed by real use, with before-and-after data.',
      bias: { seriesPotential: 90, credibility: 86, visualPotential: 84, brandValue: 78 },
    },
  ],

  cdogg: [
    {
      id: 'rewound',
      label: 'One moment, rewound',
      formatId: 'moment-deep-dive',
      emotionalAngle: 'Adrenaline then explanation',
      effort: 'low',
      title: (s) => `${Cap(s.text)} — Rewound and Explained`,
      premise: (s) => sentence(`Open on ${low(s.text)}, then rewind and explain what actually made it work`),
      viewerProblem: () => 'They want the highlight and the reason, not one without the other.',
      corePromise: () => 'The clip, then the read behind it.',
      bias: { sharePotential: 88, emotionalTension: 84, productionFeasibility: 92, curiosity: 84, visualPotential: 82 },
    },
    {
      id: 'should-not-have-worked',
      label: 'Should not have worked',
      formatId: 'moment-deep-dive',
      emotionalAngle: 'Disbelief',
      effort: 'low',
      title: (s) => `This Should Not Have Worked: ${Cap(s.text)}`,
      premise: (s) => sentence(`Break down ${low(s.text)} — the play that had no business landing, and the three things that quietly made it possible`),
      viewerProblem: () => 'They see the clip and cannot tell luck from a read.',
      corePromise: () => 'An honest split between skill and luck.',
      bias: { sharePotential: 90, curiosity: 86, emotionalTension: 82, productionFeasibility: 90 },
    },
    {
      id: 'everything-wrong',
      label: 'The disaster run',
      formatId: 'session-highlights',
      emotionalAngle: 'Comedy of failure',
      effort: 'low',
      title: (s) => `Everything That Went Wrong: ${Cap(s.text)}`,
      premise: (s) => sentence(`A compilation of every way ${low(s.text)} fell apart, narrated without pretending it was skill`),
      viewerProblem: () => 'They want to laugh with someone, not be lectured at.',
      corePromise: () => 'Honest failure, funny reactions, no fake competence.',
      bias: { sharePotential: 90, emotionalTension: 78, productionFeasibility: 94, personalConnection: 84, credibility: 40 },
    },
    {
      id: 'rule-behind-it',
      label: 'The systems read',
      formatId: 'systems-essay',
      emotionalAngle: 'The satisfying click of understanding',
      effort: 'medium',
      title: (s) => `${Cap(s.text)}, and the Rule Behind It`,
      premise: (s) => sentence(`Use ${low(s.text)} to explain the underlying system, and why it produces the moments players remember`),
      viewerProblem: () => 'They feel the design working and cannot name it.',
      corePromise: () => 'The mechanic explained by someone who plays it and thinks in systems.',
      bias: { originality: 82, curiosity: 84, clarity: 76, brandValue: 72, searchPotential: 72, credibility: 74 },
    },
    {
      id: 'best-bits',
      label: 'Session with a shape',
      formatId: 'session-highlights',
      emotionalAngle: 'Company',
      effort: 'low',
      title: (s) => `${Cap(s.text)} — Best Bits`,
      premise: (s) => sentence(`Cut the ${low(s.text)} footage into an arc with a real turn in the middle, not a flat highlight reel`),
      viewerProblem: () => 'Most highlight reels have no shape and blur together.',
      corePromise: () => 'A session that goes somewhere, cut from footage that already exists.',
      bias: { productionFeasibility: 96, audienceRelevance: 84, sharePotential: 76, personalConnection: 78 },
    },
    {
      id: 'cannot-stop',
      label: 'Obsession',
      formatId: 'first-look',
      emotionalAngle: 'Enthusiasm',
      effort: 'low',
      title: (s) => `I Cannot Stop Thinking About ${Cap(s.text)}`,
      premise: (s) => sentence(`Why ${low(s.text)} has been rattling around all week, and what that says about the design`),
      viewerProblem: () => 'They half-noticed the same thing and moved on.',
      corePromise: () => 'Genuine enthusiasm with an actual argument under it.',
      bias: { audienceRelevance: 88, sharePotential: 78, productionFeasibility: 88, personalConnection: 82 },
    },
    {
      id: 'vertical',
      label: 'Shorts pack',
      formatId: 'shorts-pack',
      emotionalAngle: 'Fast hits',
      effort: 'low',
      title: (s) => `${Cap(s.text)} (Vertical Cuts)`,
      premise: (s) => sentence(`Pull three to five vertical clips out of the ${low(s.text)} recordings already on disk`),
      viewerProblem: () => 'They discover channels through Shorts and never see the long form.',
      corePromise: () => 'Free reach from footage that already exists.',
      bias: { productionFeasibility: 96, sharePotential: 86, visualPotential: 78, brandValue: 42 },
    },
    {
      id: 'first-look',
      label: 'First look, no research',
      formatId: 'first-look',
      emotionalAngle: 'Unfiltered reaction',
      effort: 'low',
      title: (s) => `${Cap(s.text)} — First Look, No Research`,
      premise: (s) => sentence(`Go into ${low(s.text)} completely cold and narrate the actual experience, wrong guesses included`),
      viewerProblem: () => 'Every other take has been rehearsed after three hours of reading.',
      corePromise: () => 'A genuinely first reaction, with the mistakes left in.',
      bias: { audienceRelevance: 90, productionFeasibility: 92, sharePotential: 76, originality: 58 },
    },
  ],

  'worlds-finest': [
    {
      id: 'honest-reaction',
      label: 'Honest reaction',
      formatId: 'reaction-card',
      emotionalAngle: 'Unfiltered enthusiasm or disappointment',
      effort: 'low',
      title: (s) => `${Cap(s.text)} — Honest Reaction`,
      premise: (s) => sentence(`Say what ${low(s.text)} actually felt like, including the parts that did not work`),
      viewerProblem: () => 'Most reaction content is performed rather than felt.',
      corePromise: () => 'A real opinion from someone who grew up with these characters.',
      bias: { personalConnection: 90, emotionalTension: 82, productionFeasibility: 94, originality: 48 },
    },
    {
      id: 'expected-different',
      label: 'Expectation gap',
      formatId: 'reaction-card',
      emotionalAngle: 'Anticipation meeting reality',
      effort: 'low',
      title: (s) => `I Expected Something Completely Different: ${Cap(s.text)}`,
      premise: (s) => sentence(`Compare the version of ${low(s.text)} in my head beforehand with the one that actually showed up`),
      viewerProblem: () => 'They had the same expectations and want to know if they were alone.',
      corePromise: () => 'A specific personal before-and-after, not a score out of ten.',
      bias: { personalConnection: 88, emotionalTension: 84, curiosity: 74, productionFeasibility: 92 },
    },
    {
      id: 'from-the-page',
      label: 'Where it came from',
      formatId: 'nostalgia-piece',
      emotionalAngle: 'Nostalgia and affection',
      effort: 'low',
      title: (s) => `${Cap(s.text)}, and Where It Came From on the Page`,
      premise: (s) => sentence(`Where ${low(s.text)} comes from in the comics, and whether the adaptation understood it`),
      viewerProblem: () => 'They enjoyed it and have no idea what it is referencing.',
      corePromise: () => 'Source context from someone who actually read it.',
      bias: { personalConnection: 86, credibility: 76, audienceRelevance: 74, productionFeasibility: 88 },
    },
    {
      id: 'holds-up',
      label: 'Does it hold up',
      formatId: 'nostalgia-piece',
      emotionalAngle: 'Affection tested',
      effort: 'low',
      title: (s) => `Rewatching ${Cap(s.text)} Years Later`,
      premise: (s) => sentence(`Watch ${low(s.text)} again with adult eyes and report honestly on what survived`),
      viewerProblem: () => 'They remember loving it and are afraid to check.',
      corePromise: () => 'An honest verdict from someone with the same memory.',
      bias: { personalConnection: 88, emotionalTension: 78, productionFeasibility: 90, seriesPotential: 70 },
    },
    {
      id: 'first-thoughts',
      label: 'Same-day take',
      formatId: 'trailer-take',
      emotionalAngle: 'Excitement',
      effort: 'low',
      title: (s) => `${Cap(s.text)} — First Thoughts`,
      premise: (s) => sentence(`Five honest minutes on ${low(s.text)}, same day, no research pass`),
      viewerProblem: () => 'They want a take from someone whose taste they know.',
      corePromise: () => 'Fast, unpolished, genuine.',
      bias: { productionFeasibility: 96, personalConnection: 82, emotionalTension: 74, originality: 42 },
    },
    {
      id: 'actually-landed',
      label: 'The part that landed',
      formatId: 'reaction-card',
      emotionalAngle: 'Specific appreciation',
      effort: 'low',
      title: (s) => `${Cap(s.text)}: the Part That Actually Landed`,
      premise: (s) => sentence(`Skip the plot summary and talk about the one moment in ${low(s.text)} that did the work`),
      viewerProblem: () => 'Every review recaps the plot and never says what moved them.',
      corePromise: () => 'One moment, taken seriously.',
      bias: { personalConnection: 88, emotionalTension: 86, curiosity: 76, productionFeasibility: 90 },
    },
  ],
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function baseScores(
  angle: Angle,
  subject: Seed,
  ctx: GenerationContext,
  r: () => number,
): ScoreCard {
  const s = emptyScoreCard(58);
  Object.assign(s, angle.bias);

  const d = ctx.direction;

  // Grounding in real material is the single biggest honest signal available.
  if (!subject.grounded) {
    s.personalConnection = Math.min(s.personalConnection, 42);
    s.credibility = Math.min(s.credibility, 52);
  } else if (subject.experience) {
    s.personalConnection = Math.min(96, s.personalConnection + 8);
    s.credibility = Math.min(96, s.credibility + 6);
  }

  // Goals nudge the dimensions they actually correspond to.
  if (d.goals.includes('authority')) s.credibility += 6;
  if (d.goals.includes('audience')) s.sharePotential += 8;
  if (d.goals.includes('connection')) s.personalConnection += 6;
  if (d.goals.includes('evergreen')) {
    s.searchPotential += 10;
    s.brandValue += 4;
  }
  if (d.goals.includes('current-event')) {
    s.searchPotential -= 6;
    s.audienceRelevance += 8;
  }
  if (d.goals.includes('test-format')) s.originality += 6;
  if (d.goals.includes('publish-fast')) s.productionFeasibility += 10;
  if (d.goals.includes('document-project')) s.visualPotential += 8;

  // Feasibility must respect the time actually available.
  const effortMinutes: Record<EffortLevel, number> = { low: 120, medium: 360, high: 900 };
  const ratio = d.availableTimeMinutes / effortMinutes[angle.effort];
  s.productionFeasibility = Math.round(
    Math.max(15, Math.min(98, (s.productionFeasibility ?? 58) * Math.min(1.25, Math.max(0.45, ratio)))),
  );
  if (d.energy === 'low' && angle.effort === 'high') s.productionFeasibility -= 12;
  if (d.energy === 'high' && angle.effort === 'high') s.productionFeasibility += 6;

  // Series membership genuinely raises series potential.
  if (d.seriesId) s.seriesPotential = Math.min(96, (s.seriesPotential ?? 58) + 12);

  // Audience state changes what "relevant" means.
  if (d.audienceState === 'cold') s.searchPotential += 6;
  if (d.audienceState === 'core') s.personalConnection += 4;

  // Timeliness
  if (d.timeliness === 'now' || d.timeliness === 'this-week') {
    s.audienceRelevance += 8;
    s.searchPotential -= 8;
  }
  if (d.timeliness === 'evergreen') s.searchPotential += 8;

  for (const k of Object.keys(s) as (keyof ScoreCard)[]) {
    s[k] = jitter(s[k], 5, r);
  }
  return s;
}

function alreadyCovered(title: string, premise: string, history: ContentProject[]): string | null {
  const words = new Set(keywords(`${title} ${premise}`, 10));
  for (const p of history) {
    const prior = new Set(keywords(`${p.workingTitle} ${p.concept.coreArgument}`, 10));
    let shared = 0;
    words.forEach((w) => {
      if (prior.has(w)) shared += 1;
    });
    if (words.size && shared / words.size >= 0.5) {
      return `Close to "${p.workingTitle}", which you already made. Either advance that argument or pick a different angle.`;
    }
  }
  return null;
}

function applyRejectionSignals(idea: Idea, ctx: GenerationContext): Idea {
  const sig = new Map(ctx.rejectionSignals.map((s) => [s.reason, s.count]));
  const scores = { ...idea.scores };
  const warnings = [...idea.originalityWarnings];

  if ((sig.get('too-generic') ?? 0) >= 2 && scores.originality < 70) {
    scores.originality = Math.max(20, scores.originality - 10);
    warnings.push('You have rejected generic ideas repeatedly — this one is not clearly differentiated yet.');
  }
  if ((sig.get('not-personal-enough') ?? 0) >= 2 && scores.personalConnection < 70) {
    scores.personalConnection = Math.max(20, scores.personalConnection - 10);
    warnings.push('Flagged because you keep rejecting ideas you have no personal stake in.');
  }
  if ((sig.get('too-much-work') ?? 0) >= 2 && idea.effort === 'high') {
    warnings.push('You have been rejecting high-effort ideas. This is a high-effort idea.');
  }
  return { ...idea, scores, originalityWarnings: warnings };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class LocalEngine implements CreativeEngine {
  readonly name = 'Local doctrine engine';

  async generateIdeas(req: IdeaRequest): Promise<Idea[]> {
    const { context: ctx, count, origin } = req;
    const cid = ctx.direction.channelId;
    const ch = CHANNELS[cid];
    const seeds = buildSeeds(ctx, req);
    const angles = ANGLES[cid];
    const r = rng(`${cid}|${req.seed ?? ctx.direction.topic}|${origin}|${req.steer ?? ''}|${Date.now()}`);

    if (seeds.length === 0) return [];

    const ideas: Idea[] = [];
    const usedCombos = new Set<string>();

    for (let i = 0; i < count; i++) {
      // Vary the angle first: with one seed and ten ideas the user wants ten
      // different takes on their seed, not the same take on ten topics.
      let subject = seeds[Math.floor(i / angles.length) % seeds.length];
      let angle = angles[(i + Math.floor(r() * angles.length)) % angles.length];
      let key = `${subject.text}|${angle.id}`;
      let guard = 0;
      while (usedCombos.has(key) && guard++ < 24) {
        angle = pick(angles, r);
        if (guard > 12) subject = pick(seeds, r);
        key = `${subject.text}|${angle.id}`;
      }
      usedCombos.add(key);

      const workingTitle = angle.title(subject);
      const premise = angle.premise(subject);
      const scores = baseScores(angle, subject, ctx, r);

      const warnings = clicheWarnings(workingTitle, premise);
      const covered = alreadyCovered(workingTitle, premise, ctx.history);
      if (covered) warnings.push(covered);
      if (!subject.grounded) {
        warnings.push('Nothing in your library or stated experience backs this. It will sound researched rather than lived unless you attach a real example.');
      }
      if (warnings.length) scores.originality = Math.max(15, scores.originality - 8 * warnings.length);

      const authority = subject.experience
        ? sentence(`Direct experience: ${subject.experience.slice(0, 160)}`)
        : ctx.direction.personalExperience
          ? sentence(ctx.direction.personalExperience.slice(0, 160))
          : 'No stated authority yet — this is the weakest part of the card.';

      let idea: Idea = {
        id: uid('idea'),
        createdAt: new Date().toISOString(),
        channelId: cid,
        seriesId: ctx.direction.seriesId,
        workingTitle,
        premise,
        viewerProblem: angle.viewerProblem(subject),
        corePromise: angle.corePromise(subject),
        authorityBasis: authority,
        emotionalAngle: angle.emotionalAngle,
        channelFit: `${ch.name}: ${angle.label}. ${ch.tagline}.`,
        recommendedFormatId: ctx.direction.desiredFormatId ?? angle.formatId,
        originalityWarnings: warnings,
        effort: angle.effort,
        timeliness: ctx.direction.timeliness,
        scores,
        weightedScore: 0,
        viralityScore: 0,
        brandScore: 0,
        status: 'generated',
        origin,
        sourceEntryIds: subject.entryId ? [subject.entryId] : undefined,
      };
      idea = applyRejectionSignals(idea, ctx);
      ideas.push(scoreIdea(idea));
    }

    if (origin === 'deep' && ideas.length) {
      // A deeply developed single idea gets an expanded premise and promise.
      const one = ideas[0];
      one.premise = `${one.premise} ${sentence(
        `The video does not stop at naming the pattern: it walks one worked example end to end, states what the evidence cannot show, and leaves the viewer with a check they can run on themselves this week`,
      )}`;
      one.corePromise = `${one.corePromise} Delivered with one worked example, one counterargument answered, and one honest limitation stated on camera.`;
    }

    return ideas.sort((a, b) => b.weightedScore - a.weightedScore);
  }

  async critique(idea: Idea): Promise<string[]> {
    const ch = CHANNELS[idea.channelId];
    const out: string[] = [...idea.originalityWarnings];
    if (idea.scores.personalConnection < 55)
      out.push(`Personal connection is ${idea.scores.personalConnection}. On ${ch.name} that is the dimension carrying the most weight — this idea does not have standing yet.`);
    if (idea.scores.originality < 55)
      out.push('This is a familiar shape. Name the specific thing you know that other people making this video do not.');
    if (idea.scores.clarity < 50)
      out.push('The promise is fuzzy. If you cannot say what the viewer walks away with in one sentence, the script will wander.');
    if (idea.scores.credibility < 50 && ch.rigor !== 'minimal')
      out.push('Nothing here proves the claim. Add a demonstration, a number, or a story with a date on it.');
    if (idea.effort === 'high' && idea.scores.productionFeasibility < 45)
      out.push('High effort and low feasibility given your stated time. This is the kind of project that sits at 70% for three months.');
    if (ch.viralityPolicy === 'advisory' && idea.viralityScore > 75)
      out.push(`Virality is ${idea.viralityScore}, which on ${ch.name} is neither good nor bad. Do not let it decide anything.`);
    if (out.length === 0)
      out.push('No structural problem found. The remaining risk is execution: the argument has to be as specific on camera as it is on this card.');
    return out;
  }

  async mergeIdeas(a: Idea, b: Idea): Promise<Idea> {
    const scores = { ...a.scores };
    for (const k of Object.keys(scores) as (keyof ScoreCard)[]) {
      scores[k] = Math.round((a.scores[k] + b.scores[k]) / 2);
    }
    // A merge should keep the better half of each, not average everything down.
    scores.originality = Math.max(a.scores.originality, b.scores.originality);
    scores.personalConnection = Math.max(a.scores.personalConnection, b.scores.personalConnection);
    scores.clarity = Math.max(20, Math.min(a.scores.clarity, b.scores.clarity) - 6); // merged ideas get muddier

    const merged: Idea = {
      ...a,
      id: uid('idea'),
      createdAt: new Date().toISOString(),
      workingTitle: `${a.workingTitle.replace(/\.$/, '')} (through the lens of ${lowerFirst(b.workingTitle)})`,
      premise: `${a.premise} ${b.premise}`,
      corePromise: `${a.corePromise} ${b.corePromise}`,
      viewerProblem: a.viewerProblem,
      originalityWarnings: [
        ...new Set([
          ...a.originalityWarnings,
          ...b.originalityWarnings,
          'Merged ideas lose clarity by default. Cut this back to one sentence before you develop it.',
        ]),
      ],
      effort: a.effort === 'high' || b.effort === 'high' ? 'high' : a.effort,
      scores,
      status: 'generated',
      mergedFrom: [a.id, b.id],
      origin: 'manual',
    };
    return scoreIdea(merged);
  }

  async adaptIdea(idea: Idea, target: ChannelId): Promise<Idea> {
    const from = CHANNELS[idea.channelId];
    const to = CHANNELS[target];
    const angle = ANGLES[target][0];
    const subject: Seed = {
      text: shortSubject(idea.workingTitle, 9) ?? subjectPhrase(idea.workingTitle),
      detail: idea.premise,
      experience: idea.authorityBasis,
      grounded: true,
    };
    const scores = { ...idea.scores };
    // Re-weighting alone is not adaptation: the shape of the video changes.
    scores.visualPotential = target === 'core-workshop' || target === 'cdogg' ? Math.min(95, scores.visualPotential + 15) : scores.visualPotential;
    scores.credibility = target === 'cdogg' ? Math.max(30, scores.credibility - 12) : scores.credibility;
    scores.productionFeasibility = target === 'cdogg' || target === 'worlds-finest' ? Math.min(95, scores.productionFeasibility + 15) : scores.productionFeasibility;

    const adapted: Idea = {
      ...idea,
      id: uid('idea'),
      createdAt: new Date().toISOString(),
      channelId: target,
      seriesId: undefined,
      workingTitle: angle.title(subject),
      premise: angle.premise(subject),
      corePromise: angle.corePromise(subject),
      viewerProblem: angle.viewerProblem(subject),
      channelFit: `Adapted from ${from.name}. On ${to.name} the same subject has to arrive as: ${angle.label.toLowerCase()}.`,
      recommendedFormatId: angle.formatId,
      emotionalAngle: angle.emotionalAngle,
      effort: angle.effort,
      scores,
      status: 'generated',
      origin: 'adapted',
      originalityWarnings: [
        `Adapted across channels. Check that this is genuinely a ${to.name} video and not a ${from.name} video wearing a costume.`,
      ],
    };
    return scoreIdea(adapted);
  }

  async developConcept(project: ContentProject, library: LibraryEntry[]): Promise<ConceptCanvas> {
    const ch = CHANNELS[project.channelId];
    const c = project.concept;
    const subject = subjectPhrase(project.workingTitle);
    const stories = library.filter(
      (e) => e.type === 'personal-story' && (e.channelIds.length === 0 || e.channelIds.includes(project.channelId)),
    );
    const r = rng(project.id);

    const coreArgument =
      c.coreArgument.trim() ||
      sentence(`${upperFirst(subject)} persists because the structure around it keeps rewarding it, so changing the behaviour without changing the structure produces temporary compliance and predictable reversion`);

    const evidence = c.evidence.length
      ? c.evidence
      : [
          ...(stories.length
            ? [{ id: uid('ev'), kind: 'personal-experience' as const, detail: pick(stories, r).title, entryId: pick(stories, r).id }]
            : []),
          ...(ch.workspace.features.materialsAndTools
            ? [{ id: uid('ev'), kind: 'demonstration' as const, detail: 'On-camera demonstration with measurable before-and-after' }]
            : []),
        ];

    return {
      coreArgument,
      viewerTransformation:
        c.viewerTransformation.trim() ||
        sentence(`They stop treating ${subject} as a personal failing and start looking for the loop producing it`),
      startingBelief:
        c.startingBelief.trim() || sentence(`"I know what to do, I just need to be more consistent"`),
      endingBelief:
        c.endingBelief.trim() ||
        sentence(`"Consistency is an output of a structure I can design, not an input I have to summon"`),
      personalStake:
        c.personalStake.trim() ||
        sentence(project.direction?.personalExperience || `This is the mistake ${ch.name === 'Corey Williams' ? 'I made for years' : 'that cost me a job'}`),
      evidence,
      tension:
        c.tension.trim() ||
        sentence(`Effort genuinely matters, and effort applied inside the wrong structure is indistinguishable from laziness from the outside`),
      counterargument:
        c.counterargument.trim() ||
        sentence(`"Plenty of people change through sheer discipline, so the structural account is an excuse"`),
      honestLimitation:
        c.honestLimitation.trim() ||
        sentence(`This is one person's pattern over ${project.direction?.personalExperience ? 'five years' : 'a limited window'}, not a controlled study, and it cannot tell you which structure will work for you`),
      memorableLine:
        c.memorableLine.trim() ||
        sentence(`You do not rise to your goals; you fall back to the version of yourself that the room still expects`),
    };
  }

  async challengePremise(project: ContentProject): Promise<string> {
    const q = assessCoreArgument(project.concept.coreArgument);
    const lines: string[] = [];
    if (q.vague) {
      lines.push(`The argument scores ${q.score}/100 for specificity. ${q.problems.join(' ')}`);
    }
    lines.push(
      'A skeptic reading this would say: the mechanism you are describing is unfalsifiable as written. What observation would prove you wrong?',
    );
    if (!project.concept.evidence.some((e) => e.kind === 'personal-experience' || e.kind === 'demonstration')) {
      lines.push('There is no lived or demonstrated evidence attached, so every claim currently rests on plausibility.');
    }
    if (!project.concept.honestLimitation.trim()) {
      lines.push('You have not stated what this cannot prove. Until you do, the video is arguing with a strawman.');
    }
    if (project.concept.counterargument.trim()) {
      lines.push(`Your stated counterargument — "${project.concept.counterargument}" — is the easy version. The harder one is that the effect you are describing may just be regression to the mean.`);
    }
    return lines.join('\n\n');
  }

  async generatePackaging(project: ContentProject): Promise<Packaging> {
    const ch = CHANNELS[project.channelId];
    const argument = project.concept.coreArgument || project.workingTitle;
    // A subject only gets spliced into a template when it is short enough to
    // read as a noun phrase. Otherwise the subject-free templates carry it.
    const subject = shortSubject(project.workingTitle) ?? shortSubject(argument);
    const keyword = keywords(`${project.workingTitle} ${argument}`, 3).join(' ');
    const r = rng(`${project.id}|packaging`);

    const withSubject: { text: string; angle: TitleAngle }[] = subject
      ? [
          { text: titleCase(`How to actually fix ${subject}`), angle: 'search' },
          { text: titleCase(`You keep solving the wrong half of ${subject}`), angle: 'contrarian' },
          { text: titleCase(`${upperFirst(subject)} is not a discipline problem`), angle: 'contrarian' },
          { text: titleCase(`I spent five years getting ${subject} wrong`), angle: 'personal-story' },
          { text: titleCase(`What ${subject} looks like from the inside`), angle: 'curiosity' },
          { text: titleCase(`The loop behind ${subject}`), angle: 'browse' },
          { text: titleCase(`${upperFirst(subject)}, explained properly`), angle: 'plain' },
        ]
      : [];

    const subjectFree: { text: string; angle: TitleAngle }[] = [
      { text: keyword ? titleCase(`${upperFirst(keyword)} — what nobody checks first`) : 'What Nobody Checks First', angle: 'search' },
      { text: titleCase(project.workingTitle), angle: 'plain' },
      { text: titleCase(`The version of me that kept coming back`), angle: 'personal-story' },
      { text: titleCase(`I was solving the wrong half of this`), angle: 'contrarian' },
      { text: titleCase(`After ${ch.id === 'core-workshop' ? 'twelve years on the tools' : 'five years of this'}, here is what changed`), angle: 'authority' },
      { text: titleCase(`The part of this nobody explains`), angle: 'curiosity' },
      { text: keyword ? titleCase(`${upperFirst(keyword)}, properly explained`) : 'Explained Properly', angle: 'search' },
      { text: titleCase(`What I got wrong about this for years`), angle: 'personal-story' },
      { text: titleCase(`The mechanism underneath it`), angle: 'browse' },
      { text: titleCase(`Why the obvious fix does not hold`), angle: 'contrarian' },
    ];

    // Always ten directions, subject-derived ones first where they read well.
    const raw = [...withSubject, ...subjectFree].slice(0, 10);

    const titles: TitleOption[] = raw.map((t) => {
      const warns = clicheWarnings(t.text);
      const overpromises = /everything|anything|never|always|guaranteed|nobody/i.test(t.text);
      const interchangeable = warns.length > 0;
      const concrete = /\d|five|twelve|mirror|loop|breaker|clip/i.test(t.text);
      const gap = t.angle === 'curiosity' || t.angle === 'contrarian' || t.angle === 'browse';
      const soundsLikeCorey = ch.id === 'cdogg' ? !/philosoph|framework/i.test(t.text) : !/hack|crush|dominate|insane/i.test(t.text);
      const notes = [...warns];
      if (overpromises) notes.push('Absolute language — narrow the claim or the video will not keep it.');
      if (!gap && t.angle !== 'search') notes.push('No curiosity gap: the title states the whole video.');

      let score = 60;
      if (gap) score += 10;
      if (concrete) score += 8;
      if (soundsLikeCorey) score += 8;
      if (overpromises) score -= 15;
      if (interchangeable) score -= 12;
      if (t.angle === 'search' && ch.weights.searchPotential >= 8) score += 10;
      if (t.angle === 'personal-story' && ch.weights.personalConnection >= 9) score += 10;
      if (t.angle === 'contrarian' && ch.rigor === 'minimal') score -= 8;

      return {
        id: uid('title'),
        text: t.text,
        angle: t.angle,
        score: Math.max(5, Math.min(99, score)),
        checks: {
          clearPromise: t.angle === 'search' || t.angle === 'plain' || t.angle === 'authority',
          curiosityGap: gap,
          overpromises,
          soundsLikeCorey,
          concreteLanguage: concrete,
          interchangeable,
          notes,
        },
      };
    }).sort((a, b) => b.score - a.score);

    const hooks: HookOption[] = [
      {
        id: uid('hook'),
        text: sentence(
          subject
            ? `For about five years I thought ${subject} was a willpower problem. It was not, and the thing that finally showed me was embarrassingly small`
            : `For about five years I thought this was a willpower problem. It was not, and the thing that finally showed me was embarrassingly small`,
        ),
        mechanism: 'Personal admission + withheld specific',
      },
      {
        id: uid('hook'),
        text: sentence(`There is a version of this that works and a version that looks identical and does nothing. The difference is one step most people skip`),
        mechanism: 'Near-identical alternatives, one withheld variable',
      },
      {
        id: uid('hook'),
        text: sentence(`${upperFirst(project.concept.startingBelief || 'You already know what to do')} — that sentence is doing a lot of damage`),
        mechanism: 'Attack the viewer\'s starting belief directly',
      },
      {
        id: uid('hook'),
        text: sentence(`Here is the result first, then I will show you every wrong turn that got there`),
        mechanism: 'Result-first, process withheld',
      },
      {
        id: uid('hook'),
        text: sentence(`I want to argue with something I said in an earlier video`),
        mechanism: 'Self-contradiction — high trust, high curiosity',
      },
    ];

    const thumbnails: ThumbnailConcept[] = [
      {
        id: uid('thumb'),
        mainVisual: 'Corey facing a mirror, reflection composed while the real figure looks frustrated',
        subject: 'Corey, three-quarter profile, tight crop',
        background: 'Dark, low-key, single warm key light',
        focalObject: 'Mirror edge splitting the frame',
        text: 'STILL ME?',
        composition: 'Subject left third, reflection right third, hard vertical divide',
        contrastConcept: 'Warm subject against cool reflection',
        scrollStopReason: 'Two versions of the same face disagreeing with each other',
        questionCreated: 'Which one is the real one, and why do they not match?',
        titleAnswersWhat: 'The title names the mechanism; the thumbnail only shows the conflict',
        imagePrompt:
          'Cinematic portrait, man in his thirties facing a mirror in a dim room, warm key light on his frustrated face, his reflection appears calm and composed, hard vertical split composition, shallow depth of field, moody colour grade, high contrast, photographic, no text',
      },
      {
        id: uid('thumb'),
        mainVisual: 'A single loop diagram drawn on glass, Corey behind it slightly out of focus',
        subject: 'Corey out of focus, hand mid-gesture',
        background: 'Workshop or study, dark',
        focalObject: 'Belief → Action → Evidence loop',
        text: 'THE LOOP',
        composition: 'Diagram foreground right, face background left',
        contrastConcept: 'Sharp white line-work against a dark blurred figure',
        scrollStopReason: 'A diagram implies there is an actual mechanism, not just an opinion',
        questionCreated: 'What is the loop, and where does it break?',
        titleAnswersWhat: 'The title says what the loop produces; the thumbnail shows only its shape',
        imagePrompt:
          'Dark study, glowing white hand-drawn circular flow diagram on glass in foreground, man out of focus behind it gesturing, three labelled nodes, dramatic rim lighting, cinematic, high contrast, photographic, no text',
      },
      {
        id: uid('thumb'),
        mainVisual: ch.id === 'core-workshop'
          ? 'Split frame: failed part on the left, corrected assembly on the right'
          : 'Two identical chairs, one occupied, one empty, same room',
        subject: ch.id === 'core-workshop' ? 'Hands holding the failed component' : 'Empty chair as the subject',
        background: ch.id === 'core-workshop' ? 'Workbench, task lighting' : 'Neutral room, natural light',
        focalObject: ch.id === 'core-workshop' ? 'The failure point, in focus' : 'The empty chair',
        text: ch.id === 'core-workshop' ? 'THIS FAILED' : 'WHO SITS HERE?',
        composition: 'Hard split down the centre',
        contrastConcept: 'Damage against correctness',
        scrollStopReason: 'A visible before-and-after in a single frame',
        questionCreated: 'What went wrong, and was it avoidable?',
        titleAnswersWhat: 'The title names the cause; the thumbnail shows only the consequence',
        imagePrompt:
          ch.id === 'core-workshop'
            ? 'Split-frame product photograph, burnt failed electrical component on the left, correctly installed clean assembly on the right, workbench task lighting, macro detail, high contrast, photographic, no text'
            : 'Two identical chairs in a plain naturally lit room, one occupied by a blurred figure, one conspicuously empty, symmetrical composition, muted colour, cinematic, no text',
      },
    ];

    return {
      titles,
      hooks,
      thumbnails,
      curiosityGaps: [
        'The video names a mechanism the title only gestures at.',
        'One specific number or date is withheld until the second act.',
        'The counterexample is promised early and paid off late.',
      ],
      stakes: [
        sentence(`If this stays unexamined, the same outcome arrives again in six months`),
        sentence(`The cost is not failure, it is a slow average`),
      ],
      emotionalFraming: [
        'Relief before instruction: it was not a character defect.',
        'Discomfort held long enough to matter, then resolved honestly.',
        pickMany(['Affection', 'Frustration', 'Curiosity', 'Pride', 'Vindication'], 1, r)[0] + ' as the closing note.',
      ],
    };
  }

  async generateThumbnailPrompt(project: ContentProject, concept: ThumbnailConcept): Promise<string> {
    return [
      concept.mainVisual,
      concept.subject,
      `background: ${concept.background}`,
      `focal object: ${concept.focalObject}`,
      `composition: ${concept.composition}`,
      `lighting/contrast: ${concept.contrastConcept}`,
      'cinematic photographic style, high contrast, shallow depth of field, no text, no watermark, 16:9',
      `context: ${project.concept.coreArgument.slice(0, 120)}`,
    ].join(', ');
  }

  async generateArgumentMap(project: ContentProject): Promise<ArgumentMap> {
    const c = project.concept;
    const hook = project.packaging.hooks.find((h) => h.selected) ?? project.packaging.hooks[0];
    const personal = c.evidence.find((e) => e.kind === 'personal-experience');
    return {
      hook: hook?.text ?? sentence(`Open on the moment ${lowerFirst(subjectPhrase(project.workingTitle))} stopped being abstract`),
      context: c.startingBelief ? sentence(`Where the viewer is starting: ${lowerFirst(c.startingBelief)}`) : 'Set the situation in two sentences, no throat-clearing.',
      coreClaim: c.coreArgument || 'State the claim in one sentence.',
      supportOne: c.evidence[0]?.detail ?? 'First support — the strongest piece of evidence.',
      supportTwo: c.evidence[1]?.detail ?? 'Second support — a different kind of evidence from the first.',
      personalStory: personal?.detail ?? c.personalStake ?? 'The story that made this real.',
      objection: c.counterargument || 'What an intelligent skeptic says here.',
      resolution: c.tension ? sentence(`Hold the tension: ${lowerFirst(c.tension)}`) : 'Answer the objection without dismissing it.',
      finalTakeaway: c.memorableLine || c.viewerTransformation || 'The sentence that should survive the video.',
    };
  }

  async generateBeatSheet(project: ContentProject): Promise<Beat[]> {
    const ch = CHANNELS[project.channelId];
    const map = project.script.argumentMap ?? (await this.generateArgumentMap(project));
    const structure = ch.scriptMode.structure;
    const format = formatOf(project.channelId, project.packaging ? undefined : undefined);
    const target = format?.typicalDurationSeconds ?? 720;
    const r = rng(`${project.id}|beats`);

    // Map the channel's structure onto argument-map content where they align.
    const contentFor = (role: string, index: number): string => {
      const l = role.toLowerCase();
      if (l.includes('opening') || l.includes('cold open') || l.includes('expected') || l.includes('what is being built')) return map.hook;
      if (l.includes('tension') || l.includes('why it matters') || l.includes('setup') || l.includes('emotional reaction')) return map.context;
      if (l.includes('framework') || l.includes('technical') || l.includes('commentary') || l.includes('what worked')) return map.coreClaim;
      if (l.includes('lived example') || l.includes('build process') || l.includes('gameplay beats') || l.includes('connection to the characters')) return map.personalStory;
      if (l.includes('counterargument') || l.includes('failure') || l.includes('reactions') || l.includes('what did not')) return map.objection;
      if (l.includes('practical') || l.includes('result') || l.includes('callback') || l.includes('larger')) return map.resolution;
      if (l.includes('conclusion') || l.includes('lessons') || l.includes('outro') || l.includes('takeaway')) return map.finalTakeaway;
      if (l.includes('constraints') || l.includes('materials') || l.includes('safety')) return map.supportOne;
      if (l.includes('clip candidates')) return 'List the moments that stand alone as Shorts.';
      return index % 2 === 0 ? map.supportOne : map.supportTwo;
    };

    const weights = structure.map((role) => {
      const l = role.toLowerCase();
      if (l.includes('opening') || l.includes('cold open')) return 0.7;
      if (l.includes('conclusion') || l.includes('outro') || l.includes('takeaway')) return 0.8;
      if (l.includes('build process') || l.includes('gameplay beats') || l.includes('lived example')) return 2.2;
      if (l.includes('safety')) return 0.4;
      return 1.2;
    });
    const weightSum = weights.reduce((a, b) => a + b, 0);

    return structure.map((role, i) => {
      const duration = Math.max(15, Math.round((weights[i] / weightSum) * target));
      const treatment = treatmentFor(project.channelId, role, i);
      const risk: Beat['retentionRisk'] =
        i === 0 ? 'high' : duration > target * 0.22 ? 'high' : i === 1 ? 'medium' : duration > target * 0.15 ? 'medium' : 'low';

      const tracks: BeatTracks = {
        aRoll: treatment === 'a-roll' ? 'Direct to camera' : '',
        bRoll: bRollFor(project.channelId, role, treatment, r),
        onScreenText: onScreenTextFor(role, project),
        graphics: /framework|technical|systems|loop/i.test(role) ? 'Diagram: Belief → Action → Evidence' : '',
        music: /opening|cold open|outro/i.test(role) ? 'Bed in' : /counterargument|failure|reaction/i.test(role) ? 'Drop to silence' : '',
        soundEffects: '',
        source: /technical|framework|book/i.test(role) ? 'Cite on screen' : '',
        editingNote: editingNoteFor(role, i),
      };

      return {
        id: uid('beat'),
        role,
        purpose: purposeFor(role),
        information: contentFor(role, i),
        emotion: emotionFor(role, project.channelId),
        visualTreatment: treatment,
        durationSeconds: duration,
        transition: i === structure.length - 1 ? 'End card' : transitionFor(role),
        retentionRisk: risk,
        retentionNote:
          risk === 'high'
            ? i === 0
              ? 'The first beat always carries the most risk. If the hook does not name a stake in ten seconds, everything after it is wasted.'
              : `This beat is ${Math.round((duration / target) * 100)}% of the runtime. Long stretches without a turn are where viewers leave.`
            : undefined,
        tracks,
        shortsCandidate: /cold open|lived example|memorable|takeaway|result|clip candidates/i.test(role),
      };
    });
  }

  async draftSection(project: ContentProject, beat: Beat, action?: SectionAction): Promise<string> {
    if (beat.preserved && action !== 'preserve-wording') {
      return beat.draft ?? '';
    }
    const ch = CHANNELS[project.channelId];
    const words = secondsToWords(beat.durationSeconds);
    const base = beat.draft?.trim();

    // With no existing draft, produce a scaffold rather than fake prose. On
    // reaction/editing channels a scaffold is the finished deliverable.
    if (!base) {
      if (ch.scriptMode.scriptRequirement === 'editing-script' || ch.scriptMode.scriptRequirement === 'reaction-card') {
        return [
          `[${beat.role}] — ${beat.durationSeconds}s`,
          `Cue: ${beat.purpose}`,
          `Beat content: ${beat.information}`,
          `Energy: ${beat.emotion}`,
          `Edit: ${beat.tracks.editingNote}`,
          beat.shortsCandidate ? 'Mark for Shorts.' : '',
        ]
          .filter(Boolean)
          .join('\n');
      }
      return [
        `[${beat.role} — target ${words} words / ${beat.durationSeconds}s]`,
        '',
        beat.information,
        '',
        `Say it in your own words. What this beat must land: ${beat.purpose}`,
        `Tone: ${beat.emotion}. ${ch.scriptMode.toneNotes[0]}`,
        beat.retentionNote ? `Retention: ${beat.retentionNote}` : '',
        '',
        '[PERSONAL STORY PLACEHOLDER — the specific one, with the date]',
      ]
        .filter(Boolean)
        .join('\n');
    }

    // With an existing draft, apply the requested transformation.
    switch (action) {
      case 'cut-20': {
        const sentences = base.split(/(?<=[.!?])\s+/);
        const keep = Math.max(1, Math.round(sentences.length * 0.8));
        return sentences.slice(0, keep).join(' ');
      }
      case 'remove-repetition': {
        const seen = new Set<string>();
        return base
          .split(/(?<=[.!?])\s+/)
          .filter((s) => {
            const k = keywords(s, 5).join(' ');
            if (!k) return true;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .join(' ');
      }
      case 'preserve-wording':
        return base;
      case 'more-personal':
        return `${base}\n\n[MORE PERSONAL] Replace the general claim above with the specific occasion: where you were, what year, who was in the room, what you actually said.`;
      case 'more-precise':
        return `${base}\n\n[MORE PRECISE] Every quantity in this section needs a number, a unit or a date. Mark any sentence you cannot source and cut it.`;
      case 'add-tension':
        return `${base}\n\n[TENSION] Before resolving this, state the strongest version of the opposite position and sit in it for two sentences.`;
      case 'challenge-claim':
        return `${base}\n\n[CHALLENGE] The claim in this section assumes ${lowerFirst(project.concept.startingBelief || 'the reader shares your premise')}. Say why that assumption holds, or narrow the claim.`;
      case 'add-example':
        return `${base}\n\n[EXAMPLE] One concrete case, thirty seconds, with the outcome stated plainly.`;
      case 'simplify':
        return base
          .split(/(?<=[.!?])\s+/)
          .map((s) => (s.split(' ').length > 28 ? `${s.split(' ').slice(0, 22).join(' ')}.` : s))
          .join(' ');
      case 'more-conversational':
        return `${base}\n\n[CONVERSATIONAL] Read this aloud. Anywhere you would not say it that way to someone across a table, rewrite it.`;
      case 'add-technical':
        return `${base}\n\n[TECHNICAL] Add the mechanism: the spec, the tolerance, the code reference or the physical reason it behaves this way.`;
      case 'add-humor':
        return `${base}\n\n[HUMOUR] One dry aside, placed after the hard part, not during it.`;
      case 'connect-previous':
        return `[CONNECT] Open by referring back to the previous beat in one clause, then continue.\n\n${base}`;
      default:
        return base;
    }
  }

  async suggestBRoll(project: ContentProject, beat: Beat, library: LibraryEntry[]): Promise<BRollSuggestion[]> {
    const r = rng(`${project.id}|${beat.id}`);
    const existing = library.filter(
      (e) => e.type === 'b-roll' && (e.channelIds.length === 0 || e.channelIds.includes(project.channelId)),
    );
    return bRollFor(project.channelId, beat.role, beat.visualTreatment, r, existing);
  }

  async checkTitleDelivery(project: ContentProject): Promise<{ delivered: boolean; note: string }> {
    const title = project.packaging.titles.find((t) => t.selected);
    if (!title) return { delivered: false, note: 'No title selected, so there is nothing to check against.' };
    const titleWords = new Set(keywords(title.text, 8));
    const scriptBlob = project.script.beats
      .map((b) => `${b.information} ${b.draft ?? ''} ${b.tracks.onScreenText}`)
      .join(' ');
    const scriptWords = new Set(keywords(scriptBlob, 60));
    const missing: string[] = [];
    titleWords.forEach((w) => {
      if (!scriptWords.has(w)) missing.push(w);
    });
    const covered = titleWords.size ? 1 - missing.length / titleWords.size : 0;

    if (title.checks.overpromises) {
      return {
        delivered: false,
        note: `"${title.text}" uses absolute language the script does not defend. Narrow the title or add the section that earns it.`,
      };
    }
    if (covered >= 0.6) {
      return {
        delivered: true,
        note: `The script addresses ${Math.round(covered * 100)}% of the concepts the title raises. The promise is kept.`,
      };
    }
    return {
      delivered: false,
      note: `The script never gets to: ${missing.slice(0, 5).join(', ')}. Either the title is describing a different video, or a section is missing.`,
    };
  }

  async findShortsMoments(project: ContentProject): Promise<string[]> {
    const out: string[] = [];
    let t = 0;
    for (const b of project.script.beats) {
      const standalone =
        b.shortsCandidate ||
        b.durationSeconds <= 75 ||
        /memorable|takeaway|result|clutch|reaction|failure/i.test(`${b.role} ${b.purpose}`);
      if (standalone) {
        out.push(
          `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} — "${b.role}" (${b.durationSeconds}s): ${b.information.slice(0, 90)}`,
        );
      }
      t += b.durationSeconds;
    }
    if (project.concept.memorableLine) out.push(`Memorable line as a standalone vertical: "${project.concept.memorableLine}"`);
    return out.length ? out : ['Nothing in this beat sheet stands alone yet. Shorts need a moment with its own beginning and end.'];
  }

  async explainUnderperformance(project: ContentProject): Promise<string> {
    const r = project.review;
    if (!r) return 'No performance data entered yet.';
    const lines = [
      `Packaging: ${r.packagingResult}`,
      `Content: ${r.contentResult}`,
      `Brand: ${r.brandResult}`,
      `Creator: ${r.creatorResult}`,
    ];
    if (r.changeNextTime.length) lines.push(`Change next time: ${r.changeNextTime.join(' ')}`);
    return lines.join('\n\n');
  }

  async freeform(command: string, project: ContentProject | null, context: GenerationContext): Promise<string> {
    const ch = CHANNELS[project?.channelId ?? context.direction.channelId];
    return [
      `The local engine handles structured actions only — it has no language model behind it.`,
      ``,
      `"${command}" is not one of its built-in operations. Everything the buttons in the app do (idea generation, critique, packaging, beat sheets, B-roll, Shorts markers, title-delivery checks, review analysis) works offline.`,
      ``,
      `For open-ended requests, switch the provider to Claude in Settings. Channel doctrine for ${ch.name} will be sent with every request, so the output stays on-brand.`,
    ].join('\n');
  }
}

// ---------------------------------------------------------------------------
// Beat helpers
// ---------------------------------------------------------------------------

function treatmentFor(channelId: ChannelId, role: string, index: number): VisualTreatment {
  const l = role.toLowerCase();
  if (channelId === 'cdogg') {
    if (l.includes('cold open') || l.includes('gameplay') || l.includes('reaction') || l.includes('callback')) return 'gameplay';
    if (l.includes('outro') || l.includes('setup')) return 'a-roll';
    return 'gameplay';
  }
  if (channelId === 'core-workshop') {
    if (l.includes('safety') || l.includes('why it matters')) return 'a-roll';
    if (l.includes('materials')) return 'project-closeup';
    if (l.includes('build') || l.includes('result') || l.includes('failure')) return 'project-closeup';
    if (l.includes('technical')) return 'diagram';
    return 'a-roll';
  }
  if (channelId === 'worlds-finest') {
    return index === 0 ? 'a-roll' : l.includes('context') || l.includes('larger') ? 'stock' : 'a-roll';
  }
  // Corey Williams: stillness is allowed and often correct.
  if (l.includes('opening') || l.includes('conclusion')) return 'a-roll';
  if (l.includes('lived example')) return 'archival';
  if (l.includes('framework')) return 'diagram';
  if (l.includes('counterargument')) return 'no-b-roll';
  if (l.includes('practical')) return 'easy-to-record';
  return 'a-roll';
}

function bRollFor(
  channelId: ChannelId,
  role: string,
  treatment: VisualTreatment,
  r: () => number,
  existing: LibraryEntry[] = [],
): BRollSuggestion[] {
  const l = role.toLowerCase();

  // Deliberate stillness. Not every second needs covering.
  if (treatment === 'no-b-roll' || l.includes('counterargument')) {
    return [
      {
        id: uid('broll'),
        treatment: 'no-b-roll',
        description: 'Hold on the face. This beat is where the viewer decides whether to trust you — covering it with footage reads as evasion.',
        alreadyHave: true,
      },
    ];
  }

  const match = existing.find((e) => keywords(e.title, 4).some((k) => l.includes(k)));
  const out: BRollSuggestion[] = [];
  if (match) {
    out.push({
      id: uid('broll'),
      treatment: 'existing-footage',
      description: `${match.title} — already in the library`,
      alreadyHave: true,
    });
  }

  const byChannel: Record<ChannelId, BRollSuggestion[]> = {
    'corey-williams': [
      { id: uid('broll'), treatment: 'archival', description: 'Personal archival footage from the period being described', alreadyHave: false },
      { id: uid('broll'), treatment: 'easy-to-record', description: 'Morning routine / desk / walking — ten minutes to shoot', alreadyHave: false },
      { id: uid('broll'), treatment: 'diagram', description: 'Animated loop: Belief → Action → Evidence', alreadyHave: false, imagePrompt: 'Minimal three-node circular flow diagram, white line art on dark background, labelled Belief, Action, Evidence, clean vector style' },
      { id: uid('broll'), treatment: 'text-only', description: 'Full-frame quote card holding the memorable line', alreadyHave: true },
    ],
    'core-workshop': [
      { id: uid('broll'), treatment: 'project-closeup', description: 'Macro on the failure point, before cleanup', alreadyHave: false },
      { id: uid('broll'), treatment: 'screen-recording', description: 'CAD / schematic / meter reading screen capture', alreadyHave: false },
      { id: uid('broll'), treatment: 'diagram', description: 'Labelled cross-section of the assembly', alreadyHave: false, imagePrompt: 'Technical cross-section diagram, labelled callouts, clean line art, engineering drawing style, white on dark' },
      { id: uid('broll'), treatment: 'easy-to-record', description: 'Tool laydown shot on the bench', alreadyHave: false },
    ],
    cdogg: [
      { id: uid('broll'), treatment: 'gameplay', description: 'Raw clip from the recorded session — mark the timestamp', alreadyHave: true },
      { id: uid('broll'), treatment: 'screen-recording', description: 'Scoreboard / stats / patch notes capture', alreadyHave: false },
      { id: uid('broll'), treatment: 'existing-footage', description: 'Reaction cam from the same session', alreadyHave: true },
    ],
    'worlds-finest': [
      { id: uid('broll'), treatment: 'text-only', description: 'Title card only — this channel does not need a B-roll budget', alreadyHave: true },
      { id: uid('broll'), treatment: 'stock', description: 'Comic panel or poster still (fair-use crop)', alreadyHave: false },
    ],
  };

  const pool = byChannel[channelId];
  const n = channelId === 'worlds-finest' ? 1 : Math.min(pool.length, 1 + Math.floor(r() * 2));
  out.push(...pickMany(pool, n, r));
  return out;
}

function purposeFor(role: string): string {
  const l = role.toLowerCase();
  if (l.includes('opening') || l.includes('cold open')) return 'Earn the next thirty seconds.';
  if (l.includes('tension') || l.includes('why it matters')) return 'Make the stakes concrete before any teaching happens.';
  if (l.includes('example') || l.includes('build')) return 'Convert the claim into something the viewer can see.';
  if (l.includes('framework') || l.includes('technical')) return 'Give the viewer a reusable model.';
  if (l.includes('counterargument') || l.includes('failure')) return 'Answer the objection the viewer is already forming.';
  if (l.includes('practical') || l.includes('result')) return 'Turn understanding into something actionable.';
  if (l.includes('conclusion') || l.includes('outro') || l.includes('takeaway')) return 'Leave one sentence behind.';
  if (l.includes('safety')) return 'Say the thing that keeps someone out of hospital.';
  return 'Advance the argument by one step.';
}

function emotionFor(role: string, channelId: ChannelId): string {
  const l = role.toLowerCase();
  if (channelId === 'cdogg') return l.includes('cold open') ? 'Spike' : l.includes('outro') ? 'Warm sign-off' : 'Loose and reactive';
  if (l.includes('opening')) return 'Recognition';
  if (l.includes('tension')) return 'Discomfort';
  if (l.includes('example') || l.includes('story')) return 'Intimacy';
  if (l.includes('counterargument')) return 'Fairness';
  if (l.includes('conclusion') || l.includes('takeaway')) return 'Settled';
  return 'Steady';
}

function transitionFor(role: string): string {
  const l = role.toLowerCase();
  if (l.includes('opening') || l.includes('cold open')) return 'Hard cut to title';
  if (l.includes('counterargument')) return 'Beat of silence';
  if (l.includes('framework')) return 'Graphic wipe';
  return 'Natural cut';
}

function editingNoteFor(role: string, index: number): string {
  const l = role.toLowerCase();
  if (index === 0) return 'Slow push-in. No music for the first four seconds.';
  if (l.includes('counterargument')) return 'Brief silence. Let the objection sit before answering it.';
  if (l.includes('framework') || l.includes('technical')) return 'Graphic explanation — hold long enough to read.';
  if (l.includes('story') || l.includes('example')) return 'Natural cuts, no jump-cut compression on the emotional beat.';
  if (l.includes('conclusion') || l.includes('takeaway')) return 'Let the last line breathe. Cut before the music resolves.';
  return 'Standard pacing.';
}

function onScreenTextFor(role: string, project: ContentProject): string {
  const l = role.toLowerCase();
  if (l.includes('framework') || l.includes('technical')) return 'Belief → Action → Evidence';
  if (l.includes('conclusion') || l.includes('takeaway')) return project.concept.memorableLine.slice(0, 60);
  if (l.includes('safety')) return 'SAFETY';
  if (l.includes('materials')) return 'Materials & tools';
  return '';
}

export const localEngine = new LocalEngine();
