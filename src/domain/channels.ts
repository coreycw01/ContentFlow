/**
 * Channel doctrine.
 *
 * This file is the strategic heart of the app. The four channels are NOT
 * treated equally, and that asymmetry is encoded here as data rather than
 * left to memory:
 *
 *   - Corey Williams and Core Workshop get the strongest research,
 *     development, quality-control and consistency systems.
 *   - CDogg optimises for speed, personality and extraction from existing
 *     recordings.
 *   - World's Finest stays intentionally lightweight. Virality is visible but
 *     never allowed to drive a recommendation, and the channel is exempt from
 *     every consistency, cadence and guilt mechanic in the product.
 *
 * Anything that reads "how hard should the app push here?" should read it from
 * this file.
 */

import type { ChannelId, EffortLevel, ScoreCard, ScoreDimension } from './types';

export type Rigor = 'maximum' | 'high' | 'moderate' | 'minimal';

/** How much say the virality score gets in a recommendation. */
export type ViralityPolicy =
  | 'primary' // may lead a recommendation
  | 'secondary' // informs, but personal/brand value outranks it
  | 'advisory'; // shown, never allowed to change the ranking

export interface SeriesDef {
  id: string;
  name: string;
  description: string;
}

export interface FormatDef {
  id: string;
  name: string;
  description: string;
  typicalEffort: EffortLevel;
  typicalDurationSeconds: number;
  /** Formats that lean on material Corey already has. */
  usesExistingFootage?: boolean;
}

export interface ScriptModeDef {
  /** Ordered structure sections that seed the argument map / beat sheet. */
  structure: string[];
  /** Things the generator must not do on this channel. */
  avoid: string[];
  /** Whether a full spoken script is expected at all. */
  scriptRequirement: 'full-script' | 'structured-script' | 'editing-script' | 'reaction-card';
  toneNotes: string[];
}

/** Panels a channel's home is built from, in order. */
export type HomePanel =
  | 'next-action'
  | 'in-flight'
  | 'story-bank'
  | 'legacy'
  | 'claim-check'
  | 'build-queue'
  | 'materials'
  | 'safety'
  | 'footage'
  | 'clip-bin'
  | 'shorts'
  | 'watchlist'
  | 'quick-reaction'
  | 'unused-material'
  | 'lessons'
  | 'upcoming';

/** A one-click action offered on that channel's home. */
export interface QuickAction {
  label: string;
  hint: string;
  route: string;
}

export interface WorkspaceMode {
  /** Feature switches that reshape the UI when this channel is active. */
  features: {
    claimChecker: boolean;
    personalStoryLibrary: boolean;
    researchPanel: boolean;
    legacyTracker: boolean;
    materialsAndTools: boolean;
    safetyNotes: boolean;
    buildStages: boolean;
    technicalDiagrams: boolean;
    footageImporter: boolean;
    momentMarkers: boolean;
    clipExtraction: boolean;
    shortsGenerator: boolean;
    watchlist: boolean;
    quickCapture: boolean;
  };
  /** Consistency / cadence pressure the app is allowed to apply. */
  pressure: {
    consistencyWarnings: boolean;
    overdueIndicators: boolean;
    cadenceTargetDays: number | null;
  };
  /** How heavy the interface should feel. */
  density: 'reflective' | 'structured' | 'fast' | 'bare';
  /** The home screen for this channel, in order. */
  homePanels: HomePanel[];
  /** Channel-specific one-click actions. */
  quickActions: QuickAction[];
  /** What the workspace calls a project, in this channel's own vocabulary. */
  projectNoun: string;
}

export interface Gates {
  /** Block script generation until the core argument is specific. */
  requireCoreArgument: boolean;
  /** Block until at least one evidence item exists. */
  requireEvidence: boolean;
  /** Block until a counterargument is written. */
  requireCounterargument: boolean;
  /** Block until the honest limitation is written. */
  requireHonestLimitation: boolean;
  /** Require a safety note in the production checklist. */
  requireSafetyNote: boolean;
  /** Require the title-delivery check before publishing. */
  requireTitleDeliveryCheck: boolean;
}

export interface ChannelDef {
  id: ChannelId;
  name: string;
  tagline: string;
  purpose: string;
  /** Why this channel exists — shown when the app wants to explain itself. */
  doctrine: string;
  accent: string;
  accentSoft: string;
  rigor: Rigor;
  viralityPolicy: ViralityPolicy;
  /** Per-dimension weights. Relative, not normalised — the scorer normalises. */
  weights: Record<ScoreDimension, number>;
  /** Dimensions the channel deliberately down-weights, for UI explanation. */
  deprioritised: ScoreDimension[];
  series: SeriesDef[];
  formats: FormatDef[];
  scriptMode: ScriptModeDef;
  workspace: WorkspaceMode;
  gates: Gates;
  brandAssociations: string[];
  /** Priority for the "which channel needs attention?" dashboard question. */
  strategicPriority: number; // 1 = highest
  /** Placeholder shown in the seed box — sets the expectation for this channel. */
  seedPlaceholder: string;
}

const zeroWeights = (): Record<ScoreDimension, number> => ({
  audienceRelevance: 1,
  personalConnection: 1,
  originality: 1,
  clarity: 1,
  emotionalTension: 1,
  curiosity: 1,
  credibility: 1,
  visualPotential: 1,
  productionFeasibility: 1,
  seriesPotential: 1,
  searchPotential: 1,
  sharePotential: 1,
  brandValue: 1,
});

export const CHANNELS: Record<ChannelId, ChannelDef> = {
  // -------------------------------------------------------------------------
  'corey-williams': {
    id: 'corey-williams',
    name: 'Corey Williams',
    tagline: 'Legacy-oriented philosophical content',
    purpose:
      'Intentional living, identity development and systems thinking for builders, thinkers and doers.',
    doctrine:
      'This channel is a body of work, not a feed. Depth, lived truth and credibility outrank speed and upload simplicity. A video that takes three weeks and is still true in five years beats four videos that summarise other people.',
    accent: '#c8a15a',
    accentSoft: 'rgba(200, 161, 90, 0.14)',
    rigor: 'maximum',
    viralityPolicy: 'secondary',
    weights: {
      ...zeroWeights(),
      personalConnection: 10,
      credibility: 9,
      originality: 9,
      brandValue: 10,
      emotionalTension: 8,
      clarity: 7,
      audienceRelevance: 6,
      seriesPotential: 6,
      curiosity: 5,
      searchPotential: 3,
      sharePotential: 3,
      visualPotential: 3,
      productionFeasibility: 2,
    },
    deprioritised: ['productionFeasibility', 'searchPotential', 'sharePotential'],
    series: [
      { id: 'identity-lab', name: 'Identity Lab', description: 'How identity produces behaviour, and how it can be rebuilt on purpose.' },
      { id: 'systems-of-a-life', name: 'Systems of a Life', description: 'Systems thinking applied to habits, money, attention and relationships.' },
      { id: 'hard-conversations', name: 'Hard Conversations', description: 'Communication under pressure, conflict, honesty and repair.' },
      { id: 'field-notes', name: 'Field Notes', description: 'Shorter reflective pieces drawn from a single lived moment.' },
      { id: 'the-long-game', name: 'The Long Game', description: 'Legacy, fatherhood, and decisions measured in decades.' },
    ],
    formats: [
      { id: 'personal-essay', name: 'Personal philosophical essay', description: 'One argument, lived evidence, honest limits.', typicalEffort: 'high', typicalDurationSeconds: 900 },
      { id: 'framework-explainer', name: 'Framework explainer', description: 'A named model with a diagram and a real application.', typicalEffort: 'high', typicalDurationSeconds: 780 },
      { id: 'story-first', name: 'Story-first reflection', description: 'A single story carrying the whole argument.', typicalEffort: 'medium', typicalDurationSeconds: 600 },
      { id: 'counterpoint', name: 'Counterpoint to my own video', description: 'Where an earlier claim was too clean.', typicalEffort: 'medium', typicalDurationSeconds: 540 },
      { id: 'book-response', name: 'Book response', description: 'Not a summary — an argument with the book.', typicalEffort: 'high', typicalDurationSeconds: 840 },
    ],
    scriptMode: {
      structure: [
        'Personal opening',
        'Philosophical tension',
        'Lived example',
        'Framework',
        'Counterargument',
        'Practical implication',
        'Reflective conclusion',
      ],
      avoid: [
        'Generic motivational language',
        'Fake certainty',
        'Excessive rhetorical questions',
        'Pretending every insight is revolutionary',
        'Borrowed authority — cite the lived source or cut the claim',
      ],
      scriptRequirement: 'full-script',
      toneNotes: [
        'Write the way Corey talks when he is being careful, not when he is being impressive.',
        'Concrete nouns over abstractions. Name the year, the job, the argument.',
        'Say what the argument cannot prove before the viewer says it.',
      ],
    },
    workspace: {
      features: {
        claimChecker: true,
        personalStoryLibrary: true,
        researchPanel: true,
        legacyTracker: true,
        materialsAndTools: false,
        safetyNotes: false,
        buildStages: false,
        technicalDiagrams: true,
        footageImporter: false,
        momentMarkers: false,
        clipExtraction: false,
        shortsGenerator: true,
        watchlist: false,
        quickCapture: true,
      },
      pressure: { consistencyWarnings: true, overdueIndicators: true, cadenceTargetDays: 10 },
      density: 'reflective',
      projectNoun: 'essay',
      homePanels: ['next-action', 'legacy', 'story-bank', 'in-flight', 'claim-check', 'lessons'],
      quickActions: [
        { label: 'Start from a story', hint: 'Pull an unresolved personal story out of the library.', route: '/library' },
        { label: 'Argue with myself', hint: 'Counterarguments to something already published.', route: '/ideas' },
        { label: 'Open the legacy tracker', hint: 'What the body of work currently says.', route: '/brand' },
      ],
    },
    gates: {
      requireCoreArgument: true,
      requireEvidence: true,
      requireCounterargument: true,
      requireHonestLimitation: true,
      requireSafetyNote: false,
      requireTitleDeliveryCheck: true,
    },
    brandAssociations: [
      'Intentional living',
      'Identity development',
      'Systems thinking',
      'Discipline',
      'Communication',
      'Fatherhood and family',
      'Curiosity',
    ],
    strategicPriority: 1,
    seedPlaceholder: 'the third week · being right and being useful · what my kids will remember',
  },

  // -------------------------------------------------------------------------
  'core-workshop': {
    id: 'core-workshop',
    name: 'Core Workshop',
    tagline: 'Engineering, builds and expert problem-solving',
    purpose:
      'Demonstrated technical competence: 3D printing, electronics, electrical trade work, mechanical builds and POV job-site problem-solving.',
    doctrine:
      'Credibility here is earned by showing the result and the failure that preceded it. A build with a visible before-and-after, a correct technical explanation and an honest safety note outranks a clever thumbnail.',
    accent: '#4da3ff',
    accentSoft: 'rgba(77, 163, 255, 0.14)',
    rigor: 'high',
    viralityPolicy: 'secondary',
    weights: {
      ...zeroWeights(),
      credibility: 10,
      visualPotential: 9,
      searchPotential: 9,
      clarity: 8,
      audienceRelevance: 8,
      productionFeasibility: 7,
      seriesPotential: 7,
      originality: 6,
      personalConnection: 5,
      brandValue: 7,
      curiosity: 5,
      sharePotential: 4,
      emotionalTension: 3,
    },
    deprioritised: ['emotionalTension', 'sharePotential'],
    series: [
      { id: '3d-printing', name: '3D Printing', description: 'Design, print, tune, fail, fix.' },
      { id: 'electronics', name: 'Electronics', description: 'Circuits, microcontrollers, sensors, power.' },
      { id: 'electrical-trade', name: 'Electrical Trade Work', description: 'Real job-site electrical work and code-correct practice.' },
      { id: 'mechanical-builds', name: 'Mechanical Builds', description: 'Fabrication, assemblies, repairs, tools.' },
      { id: 'pov-problem-solving', name: 'POV Problem Solving', description: 'Meta-glasses footage of unscripted diagnosis in the field.' },
      { id: 'robotics', name: 'Robotics', description: 'Motion, control, and machines that do something.' },
    ],
    formats: [
      { id: 'planned-build', name: 'Planned build', description: 'Scoped project with a shot list tied to build stages.', typicalEffort: 'high', typicalDurationSeconds: 900 },
      { id: 'job-site-solve', name: 'Job-site problem solve', description: 'Organic diagnosis captured POV, structured afterwards.', typicalEffort: 'medium', typicalDurationSeconds: 600, usesExistingFootage: true },
      { id: 'teardown', name: 'Teardown / diagnosis', description: 'Open it, explain it, fix or condemn it.', typicalEffort: 'medium', typicalDurationSeconds: 660 },
      { id: 'technique-explainer', name: 'Technique explainer', description: 'One method done correctly, searchable title.', typicalEffort: 'medium', typicalDurationSeconds: 480 },
      { id: 'tool-review-in-use', name: 'Tool review in use', description: 'Judged by a real job, not by unboxing.', typicalEffort: 'low', typicalDurationSeconds: 420 },
      { id: 'fix-it-fast', name: 'Fix-it-fast short form', description: 'One problem, one fix, minimal setup.', typicalEffort: 'low', typicalDurationSeconds: 240 },
    ],
    scriptMode: {
      structure: [
        'What is being built or fixed',
        'Why it matters',
        'Constraints',
        'Materials and tools',
        'Safety warning',
        'Build process',
        'Technical explanation',
        'Failure or adjustment',
        'Result',
        'Lessons',
      ],
      avoid: [
        'Skipping the failure — the failure is the credibility',
        'Hand-waving the technical explanation',
        'Implying unsafe practice is fine because it worked',
        'Claiming a result the footage does not show',
      ],
      scriptRequirement: 'structured-script',
      toneNotes: [
        'Explain to a competent peer, not to a beginner who needs reassurance.',
        'Every number stated on camera should be verifiable on screen.',
        'Where code or spec applies, say which one.',
      ],
    },
    workspace: {
      features: {
        claimChecker: true,
        personalStoryLibrary: false,
        researchPanel: true,
        legacyTracker: false,
        materialsAndTools: true,
        safetyNotes: true,
        buildStages: true,
        technicalDiagrams: true,
        footageImporter: true,
        momentMarkers: true,
        clipExtraction: true,
        shortsGenerator: true,
        watchlist: false,
        quickCapture: true,
      },
      pressure: { consistencyWarnings: true, overdueIndicators: true, cadenceTargetDays: 10 },
      density: 'structured',
      projectNoun: 'build',
      homePanels: ['next-action', 'build-queue', 'materials', 'safety', 'in-flight', 'footage'],
      quickActions: [
        { label: 'Buildable with what I own', hint: 'Projects needing no new purchases.', route: '/library' },
        { label: 'Import POV footage', hint: 'Meta-glasses and job-site captures.', route: '/library' },
        { label: 'Diagnose something', hint: 'Start a teardown from a failure.', route: '/ideas' },
      ],
    },
    gates: {
      requireCoreArgument: true,
      requireEvidence: true,
      requireCounterargument: false,
      requireHonestLimitation: true,
      requireSafetyNote: true,
      requireTitleDeliveryCheck: true,
    },
    brandAssociations: [
      'Engineering competence',
      'Practical problem-solving',
      'Electrical expertise',
      'Robotics',
      'Systems thinking',
      'Family builds',
      'Curiosity',
    ],
    strategicPriority: 2,
    seedPlaceholder: 'the burnt neutral · crimp versus solder · a print that failed at 90%',
  },

  // -------------------------------------------------------------------------
  cdogg: {
    id: 'cdogg',
    name: 'CDogg',
    tagline: 'Personality-forward gaming with systems analysis',
    purpose:
      'Entertainment first, with the systems brain switched on. Most videos should be extracted from recordings that already exist.',
    doctrine:
      'Speed beats polish here. The job of the app on this channel is to find the moment in footage Corey already recorded, cut friction, and stay out of the way. An editing script usually beats a written spoken script.',
    accent: '#ff6b4d',
    accentSoft: 'rgba(255, 107, 77, 0.14)',
    rigor: 'moderate',
    viralityPolicy: 'primary',
    weights: {
      ...zeroWeights(),
      emotionalTension: 8,
      curiosity: 7,
      sharePotential: 10,
      audienceRelevance: 9,
      productionFeasibility: 10,
      visualPotential: 8,
      personalConnection: 7,
      originality: 5,
      clarity: 4,
      credibility: 3,
      searchPotential: 5,
      seriesPotential: 6,
      brandValue: 4,
    },
    deprioritised: ['credibility', 'clarity'],
    series: [
      { id: 'marvel-rivals', name: 'Marvel Rivals', description: 'Hero shooter: mechanics, meta reads, clutch moments.' },
      { id: 'paralives', name: 'Paralives', description: 'Life-sim building and storytelling.' },
      { id: 'planetary-life', name: 'Planetary Life', description: 'Simulation and emergent-systems play.' },
      { id: 'open-ended', name: 'Open-Ended Gaming', description: 'Whatever is fun right now — sandbox, co-op, first looks.' },
      { id: 'systems-breakdown', name: 'Systems Breakdown', description: 'Why the game design actually works, in CDogg voice.' },
    ],
    formats: [
      { id: 'session-highlights', name: 'Session highlights', description: 'Best beats from one recorded session.', typicalEffort: 'low', typicalDurationSeconds: 720, usesExistingFootage: true },
      { id: 'moment-deep-dive', name: 'Moment deep-dive', description: 'One clutch or disaster, replayed and explained.', typicalEffort: 'low', typicalDurationSeconds: 420, usesExistingFootage: true },
      { id: 'systems-essay', name: 'Systems essay', description: 'Design analysis over gameplay — the crossover format.', typicalEffort: 'medium', typicalDurationSeconds: 780, usesExistingFootage: true },
      { id: 'build-showcase', name: 'Build / creation showcase', description: 'Paralives-style creation with commentary.', typicalEffort: 'low', typicalDurationSeconds: 600, usesExistingFootage: true },
      { id: 'shorts-pack', name: 'Shorts pack', description: 'Three to five vertical clips from existing footage.', typicalEffort: 'low', typicalDurationSeconds: 60, usesExistingFootage: true },
      { id: 'first-look', name: 'First look / patch reaction', description: 'Timely, low prep, high personality.', typicalEffort: 'low', typicalDurationSeconds: 660 },
    ],
    scriptMode: {
      structure: [
        'Cold open moment',
        'Session setup',
        'Best gameplay beats',
        'Reactions',
        'Running commentary themes',
        'Callback moments',
        'Outro',
        'Clip candidates',
      ],
      avoid: [
        'Over-writing spoken lines that should be live reaction',
        'Explaining a joke',
        'Forcing an essay structure onto a highlight reel',
        'Waiting for perfect footage before publishing',
      ],
      scriptRequirement: 'editing-script',
      toneNotes: [
        'Write cues, not lines. The personality is in the take, not the page.',
        'Mark the moments; let the edit carry the pacing.',
        'Systems analysis is a seasoning, not the meal.',
      ],
    },
    workspace: {
      features: {
        claimChecker: false,
        personalStoryLibrary: false,
        researchPanel: false,
        legacyTracker: false,
        materialsAndTools: false,
        safetyNotes: false,
        buildStages: false,
        technicalDiagrams: false,
        footageImporter: true,
        momentMarkers: true,
        clipExtraction: true,
        shortsGenerator: true,
        watchlist: false,
        quickCapture: true,
      },
      pressure: { consistencyWarnings: true, overdueIndicators: true, cadenceTargetDays: 5 },
      density: 'fast',
      projectNoun: 'video',
      homePanels: ['next-action', 'clip-bin', 'footage', 'shorts', 'in-flight'],
      quickActions: [
        { label: 'Cut from last session', hint: 'Turn recorded footage into a video.', route: '/library' },
        { label: 'Find Shorts', hint: 'Vertical clips from what already exists.', route: '/pipeline' },
        { label: 'Patch reaction', hint: 'Timely, low prep, high personality.', route: '/ideas' },
      ],
    },
    gates: {
      requireCoreArgument: false,
      requireEvidence: false,
      requireCounterargument: false,
      requireHonestLimitation: false,
      requireSafetyNote: false,
      requireTitleDeliveryCheck: true,
    },
    brandAssociations: ['Gaming personality', 'Systems analysis in gaming', 'Curiosity'],
    strategicPriority: 3,
    seedPlaceholder: 'the clutch I do not deserve · dying to the same thing four times',
  },

  // -------------------------------------------------------------------------
  'worlds-finest': {
    id: 'worlds-finest',
    name: "World's Finest",
    tagline: 'Genuine comic-book reactions, zero pressure',
    purpose:
      'A casual, unscheduled outlet for honest reactions to comic-book films, shows and trailers. It exists because Corey enjoys it.',
    doctrine:
      'This channel is protected from the machine. Virality is displayed but never allowed to change a recommendation. No cadence targets, no overdue badges, no consistency warnings, no guilt. If planning this channel starts to feel like work, the app is wrong, not Corey.',
    accent: '#8f6bff',
    accentSoft: 'rgba(143, 107, 255, 0.14)',
    rigor: 'minimal',
    viralityPolicy: 'advisory',
    weights: {
      ...zeroWeights(),
      personalConnection: 10, // genuine interest
      emotionalTension: 9, // emotional connection
      productionFeasibility: 9, // ease
      audienceRelevance: 5,
      curiosity: 4,
      originality: 3,
      clarity: 3,
      credibility: 3,
      visualPotential: 3,
      seriesPotential: 3,
      searchPotential: 2,
      sharePotential: 2,
      brandValue: 4,
    },
    deprioritised: ['searchPotential', 'sharePotential', 'originality', 'seriesPotential'],
    series: [
      { id: 'first-reactions', name: 'First Reactions', description: 'Immediately after watching, unedited opinion.' },
      { id: 'trailer-talk', name: 'Trailer Talk', description: 'Quick takes on new trailers.' },
      { id: 'back-issues', name: 'Back Issues', description: 'Old comics and the history behind them.' },
      { id: 'rewatch', name: 'Rewatch', description: 'Does it hold up?' },
    ],
    formats: [
      { id: 'reaction-card', name: 'Loose reaction', description: 'Talking points on a card, camera on, done.', typicalEffort: 'low', typicalDurationSeconds: 720 },
      { id: 'trailer-take', name: 'Trailer take', description: 'Five minutes, same day.', typicalEffort: 'low', typicalDurationSeconds: 300 },
      { id: 'nostalgia-piece', name: 'Nostalgia piece', description: 'A comic that mattered, and why.', typicalEffort: 'low', typicalDurationSeconds: 600 },
    ],
    scriptMode: {
      structure: [
        'What I expected',
        'Immediate emotional reaction',
        'What worked',
        'What did not',
        'Connection to the characters',
        'Larger superhero context',
        'Final honest takeaway',
      ],
      avoid: [
        'Manufactured outrage or engagement bait',
        'Pretending to expertise about production or box office',
        'Turning enjoyment into obligation',
        'Writing a formal script when a card would do',
      ],
      scriptRequirement: 'reaction-card',
      toneNotes: [
        'The value is that it is honest, not that it is right.',
        'A reaction card of seven bullets is a finished deliverable here.',
      ],
    },
    workspace: {
      features: {
        claimChecker: false,
        personalStoryLibrary: false,
        researchPanel: false,
        legacyTracker: false,
        materialsAndTools: false,
        safetyNotes: false,
        buildStages: false,
        technicalDiagrams: false,
        footageImporter: false,
        momentMarkers: false,
        clipExtraction: false,
        shortsGenerator: false,
        watchlist: true,
        quickCapture: true,
      },
      pressure: { consistencyWarnings: false, overdueIndicators: false, cadenceTargetDays: null },
      density: 'bare',
      projectNoun: 'reaction',
      homePanels: ['quick-reaction', 'watchlist', 'in-flight'],
      quickActions: [
        { label: 'Just react to something', hint: 'One card, no pipeline.', route: '/ideas' },
        { label: 'What is coming out', hint: 'Trailer and release watchlist.', route: '/library' },
      ],
    },
    gates: {
      requireCoreArgument: false,
      requireEvidence: false,
      requireCounterargument: false,
      requireHonestLimitation: false,
      requireSafetyNote: false,
      requireTitleDeliveryCheck: false,
    },
    brandAssociations: ['Comic-book history and nostalgia', 'Curiosity'],
    strategicPriority: 4,
    seedPlaceholder: 'the scene that got me · a casting choice I was wrong about',
  },
};

export const CHANNEL_IDS: ChannelId[] = [
  'corey-williams',
  'core-workshop',
  'cdogg',
  'worlds-finest',
];

export const channel = (id: ChannelId): ChannelDef => CHANNELS[id];

export const seriesOf = (id: ChannelId, seriesId?: string): SeriesDef | undefined =>
  seriesId ? CHANNELS[id].series.find((s) => s.id === seriesId) : undefined;

export const formatOf = (id: ChannelId, formatId?: string): FormatDef | undefined =>
  formatId ? CHANNELS[id].formats.find((f) => f.id === formatId) : undefined;

/** Every brand association the app tracks, deduplicated across channels. */
export const ALL_BRAND_ASSOCIATIONS: string[] = Array.from(
  new Set(CHANNEL_IDS.flatMap((id) => CHANNELS[id].brandAssociations)),
);

/** Human labels for score dimensions. */
export const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  audienceRelevance: 'Audience relevance',
  personalConnection: 'Personal connection',
  originality: 'Originality',
  clarity: 'Clarity',
  emotionalTension: 'Emotional tension',
  curiosity: 'Curiosity',
  credibility: 'Credibility',
  visualPotential: 'Visual potential',
  productionFeasibility: 'Production feasibility',
  seriesPotential: 'Series potential',
  searchPotential: 'Search potential',
  sharePotential: 'Share potential',
  brandValue: 'Personal-brand value',
};

export const DIMENSIONS = Object.keys(DIMENSION_LABELS) as ScoreDimension[];

/** The dimensions a channel leans on hardest, for "why did it score that way". */
export function topWeightedDimensions(id: ChannelId, count = 5): ScoreDimension[] {
  const w = CHANNELS[id].weights;
  return DIMENSIONS.slice()
    .sort((a, b) => w[b] - w[a])
    .slice(0, count);
}

export const emptyScoreCard = (fill = 50): ScoreCard =>
  DIMENSIONS.reduce((acc, d) => {
    acc[d] = fill;
    return acc;
  }, {} as ScoreCard);
