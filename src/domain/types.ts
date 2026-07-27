/**
 * Core domain types for Creator Engine.
 *
 * The central object is a ContentProject. Every idea, concept, packaging
 * decision, script beat, timeline row, production task and performance result
 * hangs off exactly one ContentProject.
 */

export type ChannelId = 'corey-williams' | 'core-workshop' | 'cdogg' | 'worlds-finest';

// ---------------------------------------------------------------------------
// Direction (Stage 1)
// ---------------------------------------------------------------------------

export type ContentGoal =
  | 'authority'
  | 'audience'
  | 'connection'
  | 'evergreen'
  | 'current-event'
  | 'document-project'
  | 'test-format'
  | 'publish-fast';

export type AudienceState = 'cold' | 'warm' | 'core' | 'mixed';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type Timeliness = 'evergreen' | 'seasonal' | 'this-month' | 'this-week' | 'now';

export interface Direction {
  channelId: ChannelId;
  /** Pillar or series id from the channel definition. */
  seriesId?: string;
  goals: ContentGoal[];
  audienceState: AudienceState;
  /** Minutes of working time realistically available. */
  availableTimeMinutes: number;
  /** Free text: footage, parts, recordings, books already on hand. */
  availableMaterials: string;
  /** Format id from the channel definition. */
  desiredFormatId?: string;
  energy: EnergyLevel;
  timeliness: Timeliness;
  personalExperience: string;
  topic: string;
}

// ---------------------------------------------------------------------------
// Ideas (Stage 2)
// ---------------------------------------------------------------------------

/** Every dimension the scoring system knows about. 0-100. */
export interface ScoreCard {
  audienceRelevance: number;
  personalConnection: number;
  originality: number;
  clarity: number;
  emotionalTension: number;
  curiosity: number;
  credibility: number;
  visualPotential: number;
  productionFeasibility: number;
  seriesPotential: number;
  searchPotential: number;
  sharePotential: number;
  brandValue: number;
}

export type ScoreDimension = keyof ScoreCard;

export type EffortLevel = 'low' | 'medium' | 'high';

export interface Idea {
  id: string;
  createdAt: string;
  channelId: ChannelId;
  seriesId?: string;
  workingTitle: string;
  premise: string;
  viewerProblem: string;
  corePromise: string;
  authorityBasis: string;
  emotionalAngle: string;
  channelFit: string;
  recommendedFormatId?: string;
  /** Blunt criticism. Empty array means the engine found nothing to warn about. */
  originalityWarnings: string[];
  effort: EffortLevel;
  timeliness: Timeliness;
  scores: ScoreCard;
  /** Set by the scoring engine using the channel's weights. */
  weightedScore: number;
  viralityScore: number;
  brandScore: number;
  status: 'generated' | 'shortlisted' | 'selected' | 'saved' | 'rejected' | 'merged';
  rejection?: { reason: RejectionReason; note?: string; at: string };
  /** Ids of the ideas this one was merged from. */
  mergedFrom?: string[];
  /** Set when the idea is promoted into a ContentProject. */
  projectId?: string;
  /** Which library entries seeded this idea, for provenance. */
  sourceEntryIds?: string[];
  /** Where the idea came from, for the learning loop. */
  origin: IdeaOrigin;
}

export type IdeaOrigin =
  | 'focused'
  | 'broad'
  | 'deep'
  | 'personal-experience'
  | 'library'
  | 'external-source'
  | 'follow-up'
  | 'counterargument'
  | 'series-continuation'
  | 'manual'
  | 'adapted';

export type RejectionReason =
  | 'too-generic'
  | 'not-personal-enough'
  | 'already-covered'
  | 'weak-title'
  | 'too-much-work'
  | 'wrong-channel'
  | 'not-interested'
  | 'cannot-support-claim'
  | 'wrong-time';

// ---------------------------------------------------------------------------
// Concept canvas (Stage 3)
// ---------------------------------------------------------------------------

export type EvidenceKind =
  | 'personal-experience'
  | 'demonstration'
  | 'source'
  | 'technical-explanation'
  | 'gameplay'
  | 'cultural-context'
  | 'counterexample';

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  detail: string;
  /** Optional link back to a library entry. */
  entryId?: string;
}

export interface ConceptCanvas {
  coreArgument: string;
  viewerTransformation: string;
  startingBelief: string;
  endingBelief: string;
  personalStake: string;
  evidence: Evidence[];
  tension: string;
  counterargument: string;
  honestLimitation: string;
  memorableLine: string;
}

// ---------------------------------------------------------------------------
// Packaging (Virality Workshop)
// ---------------------------------------------------------------------------

export type TitleAngle =
  | 'search'
  | 'browse'
  | 'contrarian'
  | 'personal-story'
  | 'authority'
  | 'curiosity'
  | 'plain';

export interface TitleCheck {
  clearPromise: boolean;
  curiosityGap: boolean;
  overpromises: boolean;
  soundsLikeCorey: boolean;
  concreteLanguage: boolean;
  interchangeable: boolean;
  /** Set once the script exists: does the video actually deliver the title? */
  deliveredByScript?: boolean;
  notes: string[];
}

export interface TitleOption {
  id: string;
  text: string;
  angle: TitleAngle;
  checks: TitleCheck;
  score: number;
  selected?: boolean;
}

export interface HookOption {
  id: string;
  text: string;
  mechanism: string;
  selected?: boolean;
}

export interface ThumbnailConcept {
  id: string;
  mainVisual: string;
  subject: string;
  background: string;
  focalObject: string;
  text?: string;
  composition: string;
  contrastConcept: string;
  scrollStopReason: string;
  questionCreated: string;
  titleAnswersWhat: string;
  imagePrompt: string;
  selected?: boolean;
}

export interface Packaging {
  titles: TitleOption[];
  hooks: HookOption[];
  thumbnails: ThumbnailConcept[];
  curiosityGaps: string[];
  stakes: string[];
  emotionalFraming: string[];
}

// ---------------------------------------------------------------------------
// Script Studio (four levels)
// ---------------------------------------------------------------------------

export interface ArgumentMap {
  hook: string;
  context: string;
  coreClaim: string;
  supportOne: string;
  supportTwo: string;
  personalStory: string;
  objection: string;
  resolution: string;
  finalTakeaway: string;
}

export type VisualTreatment =
  | 'a-roll'
  | 'b-roll'
  | 'existing-footage'
  | 'easy-to-record'
  | 'archival'
  | 'screen-recording'
  | 'gameplay'
  | 'project-closeup'
  | 'generated-image'
  | 'diagram'
  | 'stock'
  | 'text-only'
  | 'no-b-roll';

export interface Beat {
  id: string;
  /** Which argument-map slot this beat serves. */
  role: string;
  purpose: string;
  information: string;
  emotion: string;
  visualTreatment: VisualTreatment;
  durationSeconds: number;
  transition: string;
  retentionRisk: 'low' | 'medium' | 'high';
  retentionNote?: string;
  /** Level 3 output for this beat. */
  draft?: string;
  /** Text the user asked the engine never to touch. */
  preserved?: boolean;
  /** Timeline tracks. */
  tracks: BeatTracks;
  shortsCandidate?: boolean;
}

export interface BeatTracks {
  aRoll: string;
  bRoll: BRollSuggestion[];
  onScreenText: string;
  graphics: string;
  music: string;
  soundEffects: string;
  source: string;
  editingNote: string;
}

export interface BRollSuggestion {
  id: string;
  treatment: VisualTreatment;
  description: string;
  /** true when the app believes Corey already has this on disk. */
  alreadyHave: boolean;
  imagePrompt?: string;
}

export interface Script {
  argumentMap?: ArgumentMap;
  beats: Beat[];
  /** Assembled Level 4 view, regenerated from beats. */
  fullScriptMarkdown?: string;
  estimatedDurationSeconds: number;
  chapterMarkers: { atSeconds: number; label: string }[];
  approvedAt?: string;
}

export type SectionAction =
  | 'more-personal'
  | 'more-precise'
  | 'add-tension'
  | 'remove-repetition'
  | 'challenge-claim'
  | 'add-example'
  | 'simplify'
  | 'more-conversational'
  | 'add-technical'
  | 'add-humor'
  | 'connect-previous'
  | 'cut-20'
  | 'preserve-wording';

// ---------------------------------------------------------------------------
// Script document (Level 4 storage, or a script written anywhere else)
// ---------------------------------------------------------------------------

export interface ScriptDoc {
  /** The script text itself. Written here, pasted in, or synced from a doc. */
  content: string;
  /** Where the canonical copy lives, when it is not this app. */
  googleDocUrl?: string;
  /** Free-form label for any other external home (Notion, Drive, a file). */
  externalLabel?: string;
  source: 'app' | 'pasted' | 'google-docs' | 'assembled';
  updatedAt?: string;
  /** Words at the last save, so drift against the beat sheet is visible. */
  wordCount: number;
}

/**
 * Something the script asks for that has to be produced or found: an image,
 * a B-roll shot, a graphic, a citation. Extracted by scanning the script text.
 */
export type AssetKind =
  | 'image'
  | 'b-roll'
  | 'graphic'
  | 'screen-recording'
  | 'gameplay'
  | 'source'
  | 'placeholder';

export type AssetStatus = 'needed' | 'have' | 'done';

export interface ScannedAsset {
  id: string;
  kind: AssetKind;
  /** The exact text that matched, so the user can find it in the script. */
  raw: string;
  description: string;
  /** 1-indexed line in the script, for locating it. */
  line: number;
  status: AssetStatus;
  /** Generated for image/graphic kinds. */
  imagePrompt?: string;
  /** Set when the user matches it to something already in the library. */
  linkedEntryId?: string;
}

// ---------------------------------------------------------------------------
// Video production status
// ---------------------------------------------------------------------------

/**
 * The physical state of the video, tracked separately from the pipeline stage.
 * Stage is where the work is; this is what actually exists.
 */
export interface VideoStatus {
  recordedAt?: string;
  editedAt?: string;
  uploadedAt?: string;
}

export type VideoStatusKey = keyof VideoStatus;

// ---------------------------------------------------------------------------
// Production board
// ---------------------------------------------------------------------------

export type ProductionPhase = 'pre' | 'recording' | 'post';

export interface ProductionTask {
  id: string;
  phase: ProductionPhase;
  label: string;
  done: boolean;
  /** Why this task exists — derived from a beat, a thumbnail, a claim, etc. */
  derivedFrom?: string;
  beatId?: string;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export type Stage =
  | 'inbox'
  | 'generated'
  | 'reviewing'
  | 'selected'
  | 'developing'
  | 'packaging'
  | 'scripting'
  | 'ready-to-record'
  | 'recording'
  | 'editing'
  | 'scheduled'
  | 'published'
  | 'review'
  | 'archived';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

// ---------------------------------------------------------------------------
// Performance learning loop
// ---------------------------------------------------------------------------

export interface PerformanceInputs {
  views: number;
  impressions: number;
  clickThroughRate: number; // percent
  averageViewDurationSeconds: number;
  retentionCurve: number[]; // percent remaining, sampled evenly across the video
  subscribersGained: number;
  comments: number;
  shares: number;
  likes: number;
  trafficSource: string;
  returningViewerPercent: number;
  shortsViews: number;
  /** 1-10. Deliberately not optional: the creator result is a first-class metric. */
  creatorSatisfaction: number;
  processSustainable: boolean;
  notableComments: string[];
}

export interface PerformanceReview {
  inputs: PerformanceInputs;
  packagingResult: string;
  contentResult: string;
  brandResult: string;
  creatorResult: string;
  whatWorked: string[];
  whatFailed: string[];
  dropOffNote: string;
  hookMatchedVideo: boolean;
  audienceLanguage: string[];
  followUpOpportunities: string[];
  reusableClips: string[];
  newQuestions: string[];
  changeNextTime: string[];
  reviewedAt: string;
}

// ---------------------------------------------------------------------------
// Content Project
// ---------------------------------------------------------------------------

export interface ContentProject {
  id: string;
  createdAt: string;
  updatedAt: string;
  channelId: ChannelId;
  seriesId?: string;
  ideaId?: string;
  workingTitle: string;
  stage: Stage;
  priority: Priority;
  direction?: Direction;
  concept: ConceptCanvas;
  packaging: Packaging;
  script: Script;
  /** The script as a document, however it got here. */
  scriptDoc: ScriptDoc;
  /** Images, B-roll and citations the script asks for. */
  assets: ScannedAsset[];
  production: ProductionTask[];
  /** What physically exists: recorded, edited, uploaded. */
  videoStatus: VideoStatus;
  review?: PerformanceReview;
  targetPublishDate?: string;
  publishedAt?: string;
  blocker?: string;
  nextAction?: string;
  /** Brand associations this project is meant to strengthen. */
  brandAssociations: string[];
  notes: string;
  /** Effort/value carried forward from the idea so pipeline cards stay honest. */
  effort: EffortLevel;
  contentValue: number;
  viralityScore: number;
}

// ---------------------------------------------------------------------------
// Content Library
// ---------------------------------------------------------------------------

export type LibraryType =
  | 'raw-idea'
  | 'personal-story'
  | 'lesson'
  | 'quote'
  | 'research'
  | 'book'
  | 'framework'
  | 'build-project'
  | 'technical-explanation'
  | 'gameplay-moment'
  | 'movie-reaction'
  | 'b-roll'
  | 'thumbnail-photo'
  | 'hook-pattern'
  | 'successful-title'
  | 'rejected-idea'
  | 'unfinished-script';

export interface LibraryEntry {
  id: string;
  createdAt: string;
  type: LibraryType;
  title: string;
  body: string;
  tags: string[];
  /** Channels this material naturally serves. Empty = any. */
  channelIds: ChannelId[];
  /** Brand associations this material can strengthen. */
  brandAssociations: string[];
  /** For stories/moments: has it been used in a published video yet? */
  used: boolean;
  usedByProjectIds: string[];
  /** For personal stories: is the story resolved, or still open? */
  unresolved?: boolean;
  /** For build projects: can it be done with tools/materials on hand? */
  materialsOnHand?: boolean;
  /** For recordings: source game/session. */
  source?: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface Settings {
  aiProvider: 'local' | 'anthropic';
  anthropicApiKey: string;
  anthropicModel: string;
  /** Channel workspace currently active, or null for the cross-channel view. */
  activeChannelId: ChannelId | null;
}
