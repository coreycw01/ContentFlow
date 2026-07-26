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

import { CHANNELS, emptyScoreCard, formatOf, seriesOf } from '../domain/channels';
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
// Seed material
// ---------------------------------------------------------------------------

interface Subject {
  /** Short noun phrase used inside titles. */
  phrase: string;
  /** Longer descriptive text for premises. */
  detail: string;
  /** Keyword for search-shaped titles. */
  keyword: string;
  /** Lived evidence backing it, if any. */
  experience: string;
  entryId?: string;
  /** True when the subject came from real library material or stated experience. */
  grounded: boolean;
}

function buildSubjects(ctx: GenerationContext, req: IdeaRequest): Subject[] {
  const { direction, library } = ctx;
  const out: Subject[] = [];
  const chLibrary = library.filter(
    (e) => e.channelIds.length === 0 || e.channelIds.includes(direction.channelId),
  );

  if (direction.topic.trim()) {
    out.push({
      phrase: subjectPhrase(direction.topic),
      detail: direction.topic.trim(),
      keyword: keywords(direction.topic, 3).join(' ') || direction.topic.slice(0, 24),
      experience: direction.personalExperience.trim(),
      grounded: Boolean(direction.personalExperience.trim()),
    });
  }

  const wanted = req.sourceEntryIds?.length
    ? library.filter((e) => req.sourceEntryIds!.includes(e.id))
    : chLibrary.filter((e) =>
        ['personal-story', 'lesson', 'build-project', 'gameplay-moment', 'movie-reaction', 'raw-idea', 'framework', 'book', 'technical-explanation'].includes(e.type),
      );

  for (const e of wanted) {
    out.push({
      phrase: subjectPhrase(e.title),
      detail: e.body || e.title,
      keyword: keywords(`${e.title} ${e.tags.join(' ')}`, 3).join(' ') || e.title,
      experience: e.type === 'personal-story' || e.type === 'lesson' || e.type === 'build-project' ? e.body : '',
      entryId: e.id,
      grounded: true,
    });
  }

  if (direction.personalExperience.trim() && out.length < 3) {
    out.push({
      phrase: subjectPhrase(direction.personalExperience),
      detail: direction.personalExperience.trim(),
      keyword: keywords(direction.personalExperience, 3).join(' '),
      experience: direction.personalExperience.trim(),
      grounded: true,
    });
  }

  if (out.length === 0) {
    const s = seriesOf(direction.channelId, direction.seriesId);
    out.push({
      phrase: s ? subjectPhrase(s.name) : 'the thing you keep circling',
      detail: s?.description ?? 'No topic given, so this is a shot in the dark.',
      keyword: s?.name ?? '',
      experience: '',
      grounded: false,
    });
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
  title: (s: Subject) => string;
  premise: (s: Subject) => string;
  viewerProblem: (s: Subject) => string;
  corePromise: (s: Subject) => string;
  bias: Partial<ScoreCard>;
}

const ANGLES: Record<ChannelId, Angle[]> = {
  'corey-williams': [
    {
      id: 'structural',
      label: 'The problem is structural, not moral',
      formatId: 'framework-explainer',
      emotionalAngle: 'Relief — it was never a character flaw',
      effort: 'high',
      title: (s) => titleCase(`${upperFirst(s.phrase)} is a structure problem, not a willpower problem`),
      premise: (s) => sentence(`Most attempts to change ${lowerFirst(s.phrase)} fail because the underlying structure still rewards the old behaviour`),
      viewerProblem: () => 'They keep trying harder at something that is not a effort problem.',
      corePromise: () => 'A model of where the behaviour is actually being produced, and which lever moves it.',
      bias: { originality: 74, credibility: 80, emotionalTension: 72, brandValue: 84, clarity: 78 },
    },
    {
      id: 'return-to-old-self',
      label: 'Why the old version returns',
      formatId: 'personal-essay',
      emotionalAngle: 'Recognition, then discomfort',
      effort: 'high',
      title: () => titleCase(`You keep becoming the person you're trying to escape`),
      premise: (s) => sentence(`People revert because they change behaviour while preserving the identity that produced it — ${lowerFirst(s.phrase)} is where that shows`),
      viewerProblem: () => 'They start habits, hold them for weeks, and quietly return to baseline.',
      corePromise: () => 'A precise account of the reversion mechanism, from someone who has watched it happen in himself.',
      bias: { personalConnection: 86, emotionalTension: 88, originality: 66, brandValue: 88, curiosity: 80 },
    },
    {
      id: 'lived-counterpoint',
      label: 'Counterpoint to received wisdom',
      formatId: 'counterpoint',
      emotionalAngle: 'Friction with something they already believe',
      effort: 'medium',
      title: (s) => titleCase(`The advice about ${lowerFirst(s.phrase)} is right and still useless`),
      premise: (s) => sentence(`The standard advice on ${lowerFirst(s.phrase)} is technically correct but skips the condition that makes it applicable`),
      viewerProblem: () => 'They have followed good advice and it did not work, and assume the fault is theirs.',
      corePromise: () => 'The missing precondition, named plainly.',
      bias: { originality: 82, emotionalTension: 76, credibility: 74, curiosity: 78, brandValue: 76 },
    },
    {
      id: 'story-carrier',
      label: 'One story carries the argument',
      formatId: 'story-first',
      emotionalAngle: 'Intimacy',
      effort: 'medium',
      title: (s) => titleCase(`What ${lowerFirst(s.phrase)} taught me about who I actually am`),
      premise: (s) => sentence(`A single episode — ${lowerFirst(s.detail.slice(0, 90))} — exposes a belief that was running underneath everything else`),
      viewerProblem: () => 'They understand the concept intellectually and have never felt it.',
      corePromise: () => 'One concrete story, told honestly, with the conclusion earned rather than announced.',
      bias: { personalConnection: 92, credibility: 82, originality: 70, emotionalTension: 84, visualPotential: 40 },
    },
    {
      id: 'systems-of-self',
      label: 'Systems thinking applied inward',
      formatId: 'framework-explainer',
      emotionalAngle: 'Clarity',
      effort: 'high',
      title: (s) => titleCase(`${upperFirst(s.phrase)}, drawn as a loop`),
      premise: (s) => sentence(`Treating ${lowerFirst(s.phrase)} as a feedback loop — belief, action, evidence — explains why the same outcome keeps arriving`),
      viewerProblem: () => 'They think in incidents; the problem is a cycle.',
      corePromise: () => 'A diagram they can hold in their head and a place to cut the loop.',
      bias: { clarity: 86, originality: 72, visualPotential: 74, brandValue: 82, seriesPotential: 80 },
    },
    {
      id: 'cost-of-position',
      label: 'What this belief costs',
      formatId: 'personal-essay',
      emotionalAngle: 'Sober accounting',
      effort: 'medium',
      title: (s) => titleCase(`The hidden cost of being right about ${lowerFirst(s.phrase)}`),
      premise: (s) => sentence(`Holding a defensible position on ${lowerFirst(s.phrase)} has a price that nobody itemises`),
      viewerProblem: () => 'They win the argument and lose the relationship, repeatedly.',
      corePromise: () => 'An honest ledger of what a principle costs in practice.',
      bias: { emotionalTension: 82, personalConnection: 78, originality: 76, brandValue: 78 },
    },
    {
      id: 'long-game',
      label: 'Measured in decades',
      formatId: 'personal-essay',
      emotionalAngle: 'Weight',
      effort: 'high',
      title: (s) => titleCase(`${upperFirst(s.phrase)} in twenty years`),
      premise: (s) => sentence(`Evaluating ${lowerFirst(s.phrase)} on a twenty-year horizon inverts almost every short-term recommendation`),
      viewerProblem: () => 'Every decision is being optimised on a timescale that does not match their actual life.',
      corePromise: () => 'A longer measuring stick, and what it changes tomorrow morning.',
      bias: { brandValue: 92, personalConnection: 80, credibility: 78, searchPotential: 30, sharePotential: 44 },
    },
    {
      id: 'book-argument',
      label: 'Argue with the book',
      formatId: 'book-response',
      emotionalAngle: 'Intellectual friction',
      effort: 'high',
      title: (s) => titleCase(`Where ${upperFirst(s.phrase)} gets it wrong`),
      premise: (s) => sentence(`Taking ${lowerFirst(s.phrase)} seriously enough to disagree with it in a specific, testable place`),
      viewerProblem: () => 'They have read the summary and mistaken it for understanding.',
      corePromise: () => 'A real disagreement, defended, not a chapter recap.',
      bias: { originality: 80, credibility: 84, searchPotential: 62, clarity: 76 },
    },
  ],

  'core-workshop': [
    {
      id: 'before-after',
      label: 'Visible transformation',
      formatId: 'planned-build',
      emotionalAngle: 'Satisfaction of a thing made right',
      effort: 'high',
      title: (s) => titleCase(`Rebuilding ${lowerFirst(s.phrase)} properly`),
      premise: (s) => sentence(`Take ${lowerFirst(s.phrase)} from broken or improvised to correct, showing every decision and the one that was wrong`),
      viewerProblem: () => 'They have the same problem and no reference for what "done properly" looks like.',
      corePromise: () => 'A finished result with the reasoning and the failure left in.',
      bias: { visualPotential: 90, credibility: 86, searchPotential: 74, clarity: 80, emotionalTension: 40 },
    },
    {
      id: 'diagnosis',
      label: 'Diagnose before replacing',
      formatId: 'teardown',
      emotionalAngle: 'Detective satisfaction',
      effort: 'medium',
      title: (s) => titleCase(`Why ${lowerFirst(s.phrase)} failed — and what I found inside`),
      premise: (s) => sentence(`Diagnosis first: open ${lowerFirst(s.phrase)}, find the actual failure mode, then decide whether to fix or condemn it`),
      viewerProblem: () => 'They replace parts by guesswork and pay for it twice.',
      corePromise: () => 'A repeatable diagnostic order of operations.',
      bias: { credibility: 90, searchPotential: 84, visualPotential: 82, clarity: 82, curiosity: 74 },
    },
    {
      id: 'field-solve',
      label: 'Unscripted job-site solve',
      formatId: 'job-site-solve',
      emotionalAngle: 'Competence under real conditions',
      effort: 'medium',
      title: (s) => titleCase(`Real job, real problem: ${lowerFirst(s.phrase)}`),
      premise: (s) => sentence(`POV footage of solving ${lowerFirst(s.phrase)} on an actual job, structured after the fact rather than staged`),
      viewerProblem: () => 'Tutorials show ideal conditions they never work in.',
      corePromise: () => 'What the decision actually looks like when the wall is already open.',
      bias: { credibility: 92, visualPotential: 84, productionFeasibility: 82, originality: 74, searchPotential: 62 },
    },
    {
      id: 'technique',
      label: 'One technique, done right',
      formatId: 'technique-explainer',
      emotionalAngle: 'Confidence',
      effort: 'medium',
      title: (s) => titleCase(`How to ${lowerFirst(s.keyword || s.phrase)} without ruining it`),
      premise: (s) => sentence(`A single technique for ${lowerFirst(s.phrase)}, with the tolerance, the tool and the mistake that ruins it`),
      viewerProblem: () => 'They are one detail away from a correct result and do not know which detail.',
      corePromise: () => 'The specific number, tool and check that decides the outcome.',
      bias: { searchPotential: 92, clarity: 88, credibility: 84, seriesPotential: 78, sharePotential: 46 },
    },
    {
      id: 'constraint-build',
      label: 'Built with what I already own',
      formatId: 'planned-build',
      emotionalAngle: 'Resourcefulness',
      effort: 'medium',
      title: (s) => titleCase(`${upperFirst(s.phrase)} using only what was already in the shop`),
      premise: (s) => sentence(`Solve ${lowerFirst(s.phrase)} under a hard constraint: no new purchases, existing tools and stock only`),
      viewerProblem: () => 'Every build video assumes a tool budget they do not have.',
      corePromise: () => 'A constrained solution that still meets spec, and where the constraint hurt.',
      bias: { productionFeasibility: 88, originality: 78, visualPotential: 80, credibility: 78 },
    },
    {
      id: 'safety-truth',
      label: 'The unglamorous safety reality',
      formatId: 'technique-explainer',
      emotionalAngle: 'Sober respect',
      effort: 'low',
      title: (s) => titleCase(`What actually goes wrong with ${lowerFirst(s.phrase)}`),
      premise: (s) => sentence(`The realistic failure and injury modes around ${lowerFirst(s.phrase)}, stated without either panic or bravado`),
      viewerProblem: () => 'They have seen the shortcut work on camera and not seen it fail.',
      corePromise: () => 'The specific conditions under which the shortcut kills the job or the person.',
      bias: { credibility: 92, searchPotential: 76, clarity: 86, visualPotential: 60, emotionalTension: 62 },
    },
    {
      id: 'iteration',
      label: 'Version two of a previous build',
      formatId: 'planned-build',
      emotionalAngle: 'Progress you can see',
      effort: 'medium',
      title: (s) => titleCase(`${upperFirst(s.phrase)} v2 — fixing what I got wrong`),
      premise: (s) => sentence(`Return to ${lowerFirst(s.phrase)} with the failures from version one as the design brief`),
      viewerProblem: () => 'They only ever see version one, which is the version that hides the lessons.',
      corePromise: () => 'A design changed by real use, with the before-and-after data.',
      bias: { seriesPotential: 90, credibility: 86, visualPotential: 82, brandValue: 76 },
    },
  ],

  cdogg: [
    {
      id: 'clutch-moment',
      label: 'One moment, replayed',
      formatId: 'moment-deep-dive',
      emotionalAngle: 'Adrenaline then explanation',
      effort: 'low',
      title: (s) => titleCase(`This should not have worked — ${lowerFirst(s.phrase)}`),
      premise: (s) => sentence(`Open on the moment from ${lowerFirst(s.phrase)}, then rewind and explain what actually made it land`),
      viewerProblem: () => 'They want the highlight and the reason it worked, not one without the other.',
      corePromise: () => 'The clip, then the read behind it.',
      bias: { sharePotential: 88, emotionalTension: 84, productionFeasibility: 92, curiosity: 82, visualPotential: 82 },
    },
    {
      id: 'session-arc',
      label: 'Session with a shape',
      formatId: 'session-highlights',
      emotionalAngle: 'Company',
      effort: 'low',
      title: (s) => titleCase(`${upperFirst(s.phrase)} — the run that went completely sideways`),
      premise: (s) => sentence(`Cut one recorded session of ${lowerFirst(s.phrase)} into an arc with a real turn in the middle`),
      viewerProblem: () => 'Most highlight reels have no shape and blur together.',
      corePromise: () => 'A session that goes somewhere, edited from footage that already exists.',
      bias: { productionFeasibility: 94, audienceRelevance: 84, sharePotential: 74, personalConnection: 78 },
    },
    {
      id: 'systems-read',
      label: 'Why the system is designed that way',
      formatId: 'systems-essay',
      emotionalAngle: 'The satisfying click of understanding',
      effort: 'medium',
      title: (s) => titleCase(`The hidden rule that makes ${lowerFirst(s.phrase)} work`),
      premise: (s) => sentence(`Break down the underlying system in ${lowerFirst(s.phrase)} and why it produces the moments players remember`),
      viewerProblem: () => 'They feel the design working and cannot name it.',
      corePromise: () => 'The mechanic explained by someone who plays it and thinks about systems for a living.',
      bias: { originality: 80, clarity: 74, curiosity: 84, brandValue: 70, searchPotential: 70, credibility: 72 },
    },
    {
      id: 'disaster',
      label: 'The disaster run',
      formatId: 'session-highlights',
      emotionalAngle: 'Comedy of failure',
      effort: 'low',
      title: (s) => titleCase(`Everything that could go wrong in ${lowerFirst(s.phrase)}`),
      premise: (s) => sentence(`A full compilation of the ways ${lowerFirst(s.phrase)} fell apart, with commentary that does not pretend it was skill`),
      viewerProblem: () => 'They want to laugh with someone, not be lectured at.',
      corePromise: () => 'Honest failure, funny reactions, no fake competence.',
      bias: { sharePotential: 90, emotionalTension: 78, productionFeasibility: 92, personalConnection: 82, credibility: 40 },
    },
    {
      id: 'creation-showcase',
      label: 'Show what you built',
      formatId: 'build-showcase',
      emotionalAngle: 'Pride and playfulness',
      effort: 'low',
      title: (s) => titleCase(`Building ${lowerFirst(s.phrase)} and immediately regretting it`),
      premise: (s) => sentence(`Create ${lowerFirst(s.phrase)} on camera, narrate the choices, let the result speak`),
      viewerProblem: () => 'They want ideas for their own game and personality while they get them.',
      corePromise: () => 'A build worth copying and someone entertaining while it happens.',
      bias: { visualPotential: 86, productionFeasibility: 88, audienceRelevance: 82, sharePotential: 72 },
    },
    {
      id: 'patch-take',
      label: 'Timely patch or release reaction',
      formatId: 'first-look',
      emotionalAngle: 'Opinion with stakes',
      effort: 'low',
      title: (s) => titleCase(`${upperFirst(s.phrase)} changed everything — here's what actually matters`),
      premise: (s) => sentence(`React to ${lowerFirst(s.phrase)} while it is current, filtering hype from the changes that alter how the game is played`),
      viewerProblem: () => 'Patch notes are long and most reactions are noise.',
      corePromise: () => 'The two or three changes that genuinely matter, quickly.',
      bias: { audienceRelevance: 90, sharePotential: 78, productionFeasibility: 86, seriesPotential: 74, originality: 52 },
    },
    {
      id: 'shorts-pack',
      label: 'Shorts from existing footage',
      formatId: 'shorts-pack',
      emotionalAngle: 'Fast hits',
      effort: 'low',
      title: (s) => titleCase(`Best of ${lowerFirst(s.phrase)} — vertical cuts`),
      premise: (s) => sentence(`Pull three to five vertical clips out of the ${lowerFirst(s.phrase)} recordings already on disk`),
      viewerProblem: () => 'They discover channels through Shorts and never see the long form.',
      corePromise: () => 'Free reach from footage that already exists.',
      bias: { productionFeasibility: 96, sharePotential: 86, visualPotential: 78, brandValue: 42, seriesPotential: 60 },
    },
  ],

  'worlds-finest': [
    {
      id: 'honest-reaction',
      label: 'Honest first reaction',
      formatId: 'reaction-card',
      emotionalAngle: 'Enthusiasm or disappointment, unfiltered',
      effort: 'low',
      title: (s) => titleCase(`${upperFirst(s.phrase)} — my honest reaction`),
      premise: (s) => sentence(`Say what ${lowerFirst(s.phrase)} actually felt like to watch, including the parts that did not work`),
      viewerProblem: () => 'Most reaction content is performed rather than felt.',
      corePromise: () => 'A real opinion from someone who grew up with these characters.',
      bias: { personalConnection: 90, emotionalTension: 82, productionFeasibility: 94, originality: 46 },
    },
    {
      id: 'expectation-gap',
      label: 'What I expected vs what I got',
      formatId: 'reaction-card',
      emotionalAngle: 'Anticipation meeting reality',
      effort: 'low',
      title: (s) => titleCase(`I expected something completely different from ${lowerFirst(s.phrase)}`),
      premise: (s) => sentence(`Compare the version of ${lowerFirst(s.phrase)} in your head beforehand with the one that actually showed up`),
      viewerProblem: () => 'They had the same expectations and want to know if they were alone.',
      corePromise: () => 'A specific, personal before-and-after rather than a score out of ten.',
      bias: { personalConnection: 88, emotionalTension: 84, curiosity: 72, productionFeasibility: 92 },
    },
    {
      id: 'character-history',
      label: 'The comic history behind it',
      formatId: 'nostalgia-piece',
      emotionalAngle: 'Nostalgia and affection',
      effort: 'low',
      title: (s) => titleCase(`The comic run that ${lowerFirst(s.phrase)} came from`),
      premise: (s) => sentence(`Where ${lowerFirst(s.phrase)} comes from on the page, and whether the adaptation understood it`),
      viewerProblem: () => 'They enjoyed it and have no idea what it is referencing.',
      corePromise: () => 'The source material context, told by someone who actually read it.',
      bias: { personalConnection: 86, credibility: 74, audienceRelevance: 72, productionFeasibility: 88 },
    },
    {
      id: 'trailer-take',
      label: 'Same-day trailer take',
      formatId: 'trailer-take',
      emotionalAngle: 'Excitement',
      effort: 'low',
      title: (s) => titleCase(`${upperFirst(s.phrase)} trailer — first thoughts`),
      premise: (s) => sentence(`Five honest minutes on the ${lowerFirst(s.phrase)} trailer, same day, no research pass`),
      viewerProblem: () => 'They want a take from someone whose taste they know.',
      corePromise: () => 'Fast, unpolished, genuine.',
      bias: { productionFeasibility: 96, personalConnection: 82, emotionalTension: 74, originality: 40 },
    },
    {
      id: 'holds-up',
      label: 'Does it hold up?',
      formatId: 'nostalgia-piece',
      emotionalAngle: 'Affection tested',
      effort: 'low',
      title: (s) => titleCase(`Rewatching ${lowerFirst(s.phrase)} years later`),
      premise: (s) => sentence(`Watch ${lowerFirst(s.phrase)} again with adult eyes and report honestly on what survived`),
      viewerProblem: () => 'They remember loving it and are afraid to check.',
      corePromise: () => 'An honest verdict from someone with the same memory.',
      bias: { personalConnection: 88, emotionalTension: 78, productionFeasibility: 90, seriesPotential: 68 },
    },
  ],
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function baseScores(
  angle: Angle,
  subject: Subject,
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
    const subjects = buildSubjects(ctx, req);
    const angles = ANGLES[cid];
    const seed = `${cid}|${ctx.direction.topic}|${origin}|${req.steer ?? ''}|${Date.now()}`;
    const r = rng(seed);

    const ideas: Idea[] = [];
    const usedCombos = new Set<string>();

    for (let i = 0; i < count; i++) {
      let subject = subjects[i % subjects.length];
      let angle = angles[(i + Math.floor(r() * angles.length)) % angles.length];
      let key = `${subject.phrase}|${angle.id}`;
      let guard = 0;
      while (usedCombos.has(key) && guard++ < 12) {
        subject = pick(subjects, r);
        angle = pick(angles, r);
        key = `${subject.phrase}|${angle.id}`;
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
    const subject: Subject = {
      phrase: subjectPhrase(idea.workingTitle),
      detail: idea.premise,
      keyword: keywords(idea.workingTitle, 3).join(' '),
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
