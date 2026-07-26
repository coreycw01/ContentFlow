import type {
  ArgumentMap,
  BRollSuggestion,
  Beat,
  ChannelId,
  ConceptCanvas,
  ContentProject,
  Direction,
  Idea,
  IdeaOrigin,
  LibraryEntry,
  Packaging,
  SectionAction,
  ThumbnailConcept,
} from '../domain/types';

export interface GenerationContext {
  direction: Direction;
  library: LibraryEntry[];
  /** Previously published or archived projects, for follow-ups and repetition checks. */
  history: ContentProject[];
  /** Rejection reasons the user has given before, so the engine can avoid repeats. */
  rejectionSignals: { reason: string; count: number; examples: string[] }[];
  /** Lessons captured from published reviews. */
  lessons: string[];
}

export interface IdeaRequest {
  context: GenerationContext;
  origin: IdeaOrigin;
  count: number;
  /** For follow-ups / counterarguments / continuations. */
  sourceProjectId?: string;
  /** For library-seeded generation. */
  sourceEntryIds?: string[];
  /** Free text steer, e.g. "around the mirror metaphor". */
  steer?: string;
}

export interface CreativeEngine {
  readonly name: string;
  generateIdeas(req: IdeaRequest): Promise<Idea[]>;
  critique(idea: Idea): Promise<string[]>;
  mergeIdeas(a: Idea, b: Idea): Promise<Idea>;
  adaptIdea(idea: Idea, target: ChannelId): Promise<Idea>;
  developConcept(project: ContentProject, library: LibraryEntry[]): Promise<ConceptCanvas>;
  challengePremise(project: ContentProject): Promise<string>;
  generatePackaging(project: ContentProject): Promise<Packaging>;
  generateThumbnailPrompt(project: ContentProject, concept: ThumbnailConcept): Promise<string>;
  generateArgumentMap(project: ContentProject): Promise<ArgumentMap>;
  generateBeatSheet(project: ContentProject): Promise<Beat[]>;
  draftSection(project: ContentProject, beat: Beat, action?: SectionAction): Promise<string>;
  suggestBRoll(project: ContentProject, beat: Beat, library: LibraryEntry[]): Promise<BRollSuggestion[]>;
  checkTitleDelivery(project: ContentProject): Promise<{ delivered: boolean; note: string }>;
  findShortsMoments(project: ContentProject): Promise<string[]>;
  explainUnderperformance(project: ContentProject): Promise<string>;
  /** Escape hatch for the AI command bar. */
  freeform(command: string, project: ContentProject | null, context: GenerationContext): Promise<string>;
}
