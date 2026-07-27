/**
 * Claude-powered creative engine.
 *
 * Uses the official Anthropic SDK from the browser. Every request carries the
 * doctrine of the channel it is for (see prompts.ts), so the model cannot
 * flatten four channels into one voice.
 *
 * Structured outputs are used everywhere a shape matters, and every method
 * falls back to the local doctrine engine if the call fails — the app stays
 * usable offline or without a key.
 */

import Anthropic from '@anthropic-ai/sdk';

import { CHANNELS } from '../domain/channels';
import { scoreIdea } from '../domain/scoring';
import type {
  ArgumentMap,
  BRollSuggestion,
  Beat,
  ChannelId,
  ConceptCanvas,
  ContentProject,
  Idea,
  LibraryEntry,
  Packaging,
  ScoreCard,
  SectionAction,
  ThumbnailConcept,
  VisualTreatment,
} from '../domain/types';
import { localEngine } from './localEngine';
import {
  directionBrief,
  historyBrief,
  lessonsBrief,
  libraryBrief,
  projectBrief,
  systemPrompt,
} from './prompts';
import { uid } from './text';
import type { CreativeEngine, GenerationContext, IdeaRequest } from './types';

const MODEL = 'claude-opus-5';

type Schema = Record<string, unknown>;

const obj = (properties: Record<string, Schema>, required?: string[]): Schema => ({
  type: 'object',
  properties,
  required: required ?? Object.keys(properties),
  additionalProperties: false,
});

const str = (description?: string): Schema => ({ type: 'string', ...(description ? { description } : {}) });
const num = (description?: string): Schema => ({ type: 'number', ...(description ? { description } : {}) });
const arr = (items: Schema): Schema => ({ type: 'array', items });
const enumOf = (values: readonly string[]): Schema => ({ type: 'string', enum: [...values] });

const SCORE_KEYS: (keyof ScoreCard)[] = [
  'audienceRelevance', 'personalConnection', 'originality', 'clarity', 'emotionalTension',
  'curiosity', 'credibility', 'visualPotential', 'productionFeasibility', 'seriesPotential',
  'searchPotential', 'sharePotential', 'brandValue',
];

const scoreSchema = (): Schema =>
  obj(Object.fromEntries(SCORE_KEYS.map((k) => [k, num('0-100')])) as Record<string, Schema>);

const TREATMENTS: VisualTreatment[] = [
  'a-roll', 'b-roll', 'existing-footage', 'easy-to-record', 'archival', 'screen-recording',
  'gameplay', 'project-closeup', 'generated-image', 'diagram', 'stock', 'text-only', 'no-b-roll',
];

export class AnthropicEngine implements CreativeEngine {
  readonly name = 'Claude';
  private client: Anthropic;

  constructor(apiKey: string, private model: string = MODEL) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  /** One structured-output call. Throws on transport or parse failure. */
  private async json<T>(channelId: ChannelId, user: string, schema: Schema): Promise<T> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: systemPrompt(channelId),
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{ role: 'user', content: user }],
    });
    if (response.stop_reason === 'refusal') {
      throw new Error('Claude declined this request.');
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return JSON.parse(text) as T;
  }

  /** Free-form prose call. */
  private async prose(channelId: ChannelId, user: string, maxTokens = 4000): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      system: systemPrompt(channelId),
      messages: [{ role: 'user', content: user }],
    });
    if (response.stop_reason === 'refusal') return 'Claude declined this request.';
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
  }

  // -------------------------------------------------------------------------

  async generateIdeas(req: IdeaRequest): Promise<Idea[]> {
    const ctx = req.context;
    const cid = ctx.direction.channelId;
    const ch = CHANNELS[cid];

    const schema = obj({
      ideas: arr(
        obj({
          workingTitle: str(),
          premise: str('One or two sentences.'),
          viewerProblem: str(),
          corePromise: str(),
          authorityBasis: str('Why Corey specifically can make this. Say plainly if he cannot yet.'),
          emotionalAngle: str(),
          channelFit: str(),
          recommendedFormatId: enumOf(ch.formats.map((f) => f.id)),
          originalityWarnings: arr(str('Blunt criticism. Empty array only if there is genuinely nothing to warn about.')),
          effort: enumOf(['low', 'medium', 'high']),
          scores: scoreSchema(),
        }),
      ),
    });

    const originInstruction: Record<string, string> = {
      focused: 'Generate tightly focused ideas that all serve the stated topic and goal.',
      broad: 'Generate a deliberately wide spread — different formats, different emotional angles, different levels of effort.',
      deep: 'Generate ONE idea, developed further than usual: the premise should carry a worked example, a counterargument and an honest limitation.',
      'personal-experience': 'Every idea must be rooted in stated lived experience. If there is not enough, say so in the warnings rather than inventing.',
      library: 'Build these ideas out of the library material provided. Reference which entry each one uses.',
      'external-source': 'Build these from books, games, films, projects or current events mentioned in the brief.',
      'follow-up': 'These are follow-ups to an existing video: they must advance the argument, not restate it.',
      counterargument: 'These argue against a position Corey has already published. Steelman the opposing view.',
      'series-continuation': 'These continue an existing series and should feel like the next chapter.',
      manual: 'Generate ideas from the brief.',
      adapted: 'Adapt the given idea for this channel.',
    };

    const user = [
      `Generate ${req.count} video idea${req.count === 1 ? '' : 's'} for ${ch.name}.`,
      req.seed?.trim()
        ? `THE SEED — every idea must grow from this, and the phrase should be recognisable in each title: "${req.seed.trim()}". Give ${req.count === 1 ? 'it' : 'each'} a genuinely different angle on the same seed; do not drift to a neighbouring topic.`
        : 'No seed given, so draw from the library and the direction below.',
      originInstruction[req.origin] ?? originInstruction.focused,
      req.steer ? `Additional steer: ${req.steer}` : '',
      '',
      directionBrief(ctx.direction),
      '',
      libraryBrief(
        req.sourceEntryIds?.length
          ? ctx.library.filter((e) => req.sourceEntryIds!.includes(e.id))
          : ctx.library,
      ),
      '',
      historyBrief(ctx.history),
      '',
      lessonsBrief(ctx),
      '',
      'Score each idea 0-100 on every dimension, honestly. Low scores are useful information; do not inflate.',
      'originalityWarnings must be blunt. If the idea is a familiar shape, say which shape and what would make it worth making anyway.',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const result = await this.json<{ ideas: Omit<Idea, 'id' | 'createdAt' | 'channelId' | 'seriesId' | 'timeliness' | 'weightedScore' | 'viralityScore' | 'brandScore' | 'status' | 'origin'>[] }>(
        cid,
        user,
        schema,
      );
      return result.ideas.map((raw) =>
        scoreIdea({
          ...raw,
          id: uid('idea'),
          createdAt: new Date().toISOString(),
          channelId: cid,
          seriesId: ctx.direction.seriesId,
          timeliness: ctx.direction.timeliness,
          weightedScore: 0,
          viralityScore: 0,
          brandScore: 0,
          status: 'generated',
          origin: req.origin,
          sourceEntryIds: req.sourceEntryIds,
        } as Idea),
      );
    } catch {
      return localEngine.generateIdeas(req);
    }
  }

  async critique(idea: Idea): Promise<string[]> {
    const schema = obj({ criticisms: arr(str()) });
    const user = [
      'Criticise this idea. Do not praise it. Name what is derivative, unsupported or vague, and what it would take to fix each problem.',
      '',
      `Title: ${idea.workingTitle}`,
      `Premise: ${idea.premise}`,
      `Viewer problem: ${idea.viewerProblem}`,
      `Corey's authority: ${idea.authorityBasis}`,
      `Scores: ${JSON.stringify(idea.scores)}`,
      '',
      'If the idea genuinely has no structural problem, say so in one item and name the execution risk instead.',
    ].join('\n');
    try {
      const r = await this.json<{ criticisms: string[] }>(idea.channelId, user, schema);
      return r.criticisms;
    } catch {
      return localEngine.critique(idea);
    }
  }

  async mergeIdeas(a: Idea, b: Idea): Promise<Idea> {
    const schema = obj({
      workingTitle: str(),
      premise: str(),
      viewerProblem: str(),
      corePromise: str(),
      authorityBasis: str(),
      emotionalAngle: str(),
      originalityWarnings: arr(str()),
      effort: enumOf(['low', 'medium', 'high']),
      scores: scoreSchema(),
    });
    const user = [
      'Merge these two ideas into one that is sharper than either, not a compromise between them.',
      'If merging them makes the argument muddier, say so in the warnings.',
      '',
      `A: ${a.workingTitle} — ${a.premise}`,
      `B: ${b.workingTitle} — ${b.premise}`,
    ].join('\n');
    try {
      const r = await this.json<Partial<Idea>>(a.channelId, user, schema);
      return scoreIdea({
        ...a,
        ...r,
        id: uid('idea'),
        createdAt: new Date().toISOString(),
        status: 'generated',
        origin: 'manual',
        mergedFrom: [a.id, b.id],
      } as Idea);
    } catch {
      return localEngine.mergeIdeas(a, b);
    }
  }

  async adaptIdea(idea: Idea, target: ChannelId): Promise<Idea> {
    const to = CHANNELS[target];
    const schema = obj({
      workingTitle: str(),
      premise: str(),
      viewerProblem: str(),
      corePromise: str(),
      authorityBasis: str(),
      emotionalAngle: str(),
      channelFit: str(),
      recommendedFormatId: enumOf(to.formats.map((f) => f.id)),
      originalityWarnings: arr(str()),
      effort: enumOf(['low', 'medium', 'high']),
      scores: scoreSchema(),
    });
    const user = [
      `Adapt this idea from ${CHANNELS[idea.channelId].name} to ${to.name}.`,
      'This is not a re-title. The shape of the video changes: the evidence, the pacing, the promise and the effort all change with the channel.',
      `If this genuinely should not be a ${to.name} video, say so in the warnings.`,
      '',
      `Original: ${idea.workingTitle} — ${idea.premise}`,
      `Corey's authority on it: ${idea.authorityBasis}`,
    ].join('\n');
    try {
      const r = await this.json<Partial<Idea>>(target, user, schema);
      return scoreIdea({
        ...idea,
        ...r,
        id: uid('idea'),
        createdAt: new Date().toISOString(),
        channelId: target,
        seriesId: undefined,
        status: 'generated',
        origin: 'adapted',
      } as Idea);
    } catch {
      return localEngine.adaptIdea(idea, target);
    }
  }

  async developConcept(project: ContentProject, library: LibraryEntry[]): Promise<ConceptCanvas> {
    const schema = obj({
      coreArgument: str('One sentence. A claim, not a topic.'),
      viewerTransformation: str(),
      startingBelief: str(),
      endingBelief: str(),
      personalStake: str(),
      evidence: arr(
        obj({
          kind: enumOf(['personal-experience', 'demonstration', 'source', 'technical-explanation', 'gameplay', 'cultural-context', 'counterexample']),
          detail: str(),
        }),
      ),
      tension: str(),
      counterargument: str('The strongest version, not a strawman.'),
      honestLimitation: str('What this video genuinely cannot prove.'),
      memorableLine: str(),
    });
    const user = [
      'Develop the concept canvas for this project. Keep anything already written unless it is clearly wrong; fill in what is empty.',
      'Do not invent lived experience. Where personal evidence is needed and missing, write a placeholder that names what Corey needs to supply.',
      '',
      projectBrief(project),
      '',
      libraryBrief(library.filter((e) => e.channelIds.length === 0 || e.channelIds.includes(project.channelId))),
    ].join('\n');
    try {
      const r = await this.json<Omit<ConceptCanvas, 'evidence'> & { evidence: { kind: string; detail: string }[] }>(
        project.channelId,
        user,
        schema,
      );
      return {
        ...r,
        evidence: r.evidence.map((e) => ({ id: uid('ev'), kind: e.kind as ConceptCanvas['evidence'][number]['kind'], detail: e.detail })),
      };
    } catch {
      return localEngine.developConcept(project, library);
    }
  }

  async challengePremise(project: ContentProject): Promise<string> {
    try {
      return await this.prose(
        project.channelId,
        [
          'Attack this premise the way an intelligent, sympathetic skeptic would. Be specific about what would falsify it.',
          'Finish by naming the one change that would make the argument hardest to dismiss.',
          '',
          projectBrief(project),
        ].join('\n'),
      );
    } catch {
      return localEngine.challengePremise(project);
    }
  }

  async generatePackaging(project: ContentProject): Promise<Packaging> {
    const schema = obj({
      titles: arr(
        obj({
          text: str(),
          angle: enumOf(['search', 'browse', 'contrarian', 'personal-story', 'authority', 'curiosity', 'plain']),
          score: num('0-100'),
          checks: obj({
            clearPromise: { type: 'boolean' },
            curiosityGap: { type: 'boolean' },
            overpromises: { type: 'boolean' },
            soundsLikeCorey: { type: 'boolean' },
            concreteLanguage: { type: 'boolean' },
            interchangeable: { type: 'boolean' },
            notes: arr(str()),
          }),
        }),
      ),
      hooks: arr(obj({ text: str('Spoken opening, 2-4 sentences.'), mechanism: str() })),
      thumbnails: arr(
        obj({
          mainVisual: str(),
          subject: str(),
          background: str(),
          focalObject: str(),
          text: str('Optional on-thumbnail text; empty string if none.'),
          composition: str(),
          contrastConcept: str(),
          scrollStopReason: str(),
          questionCreated: str(),
          titleAnswersWhat: str(),
          imagePrompt: str('A clean prompt for an image generator. No text in the image.'),
        }),
      ),
      curiosityGaps: arr(str()),
      stakes: arr(str()),
      emotionalFraming: arr(str()),
    });
    const user = [
      'Produce packaging for this project: exactly 10 title directions, 5 hooks, 3 thumbnail concepts.',
      'Cover the search, browse, contrarian, personal-story and authority angles across the ten titles.',
      'Set the checks honestly — mark overpromises and interchangeable as true when they are true, and explain in notes.',
      '',
      projectBrief(project),
    ].join('\n');
    try {
      const r = await this.json<{
        titles: Omit<Packaging['titles'][number], 'id'>[];
        hooks: Omit<Packaging['hooks'][number], 'id'>[];
        thumbnails: Omit<ThumbnailConcept, 'id'>[];
        curiosityGaps: string[];
        stakes: string[];
        emotionalFraming: string[];
      }>(project.channelId, user, schema);
      return {
        titles: r.titles.map((t) => ({ ...t, id: uid('title') })).sort((a, b) => b.score - a.score),
        hooks: r.hooks.map((h) => ({ ...h, id: uid('hook') })),
        thumbnails: r.thumbnails.map((t) => ({ ...t, id: uid('thumb') })),
        curiosityGaps: r.curiosityGaps,
        stakes: r.stakes,
        emotionalFraming: r.emotionalFraming,
      };
    } catch {
      return localEngine.generatePackaging(project);
    }
  }

  async generateThumbnailPrompt(project: ContentProject, concept: ThumbnailConcept): Promise<string> {
    try {
      return await this.prose(
        project.channelId,
        [
          'Write a single image-generation prompt for this thumbnail concept. One paragraph, no preamble, no text rendered in the image.',
          '',
          JSON.stringify(concept, null, 2),
        ].join('\n'),
        800,
      );
    } catch {
      return localEngine.generateThumbnailPrompt(project, concept);
    }
  }

  async generateArgumentMap(project: ContentProject): Promise<ArgumentMap> {
    const schema = obj({
      hook: str(), context: str(), coreClaim: str(), supportOne: str(), supportTwo: str(),
      personalStory: str(), objection: str(), resolution: str(), finalTakeaway: str(),
    });
    const user = [
      'Build the argument map (Level 1 of the script studio). Structure only — no prose yet.',
      'Each field is one or two sentences describing what happens there.',
      '',
      projectBrief(project),
    ].join('\n');
    try {
      return await this.json<ArgumentMap>(project.channelId, user, schema);
    } catch {
      return localEngine.generateArgumentMap(project);
    }
  }

  async generateBeatSheet(project: ContentProject): Promise<Beat[]> {
    const ch = CHANNELS[project.channelId];
    const schema = obj({
      beats: arr(
        obj({
          role: str('Which structural section this beat serves.'),
          purpose: str(),
          information: str(),
          emotion: str(),
          visualTreatment: enumOf(TREATMENTS),
          durationSeconds: num(),
          transition: str(),
          retentionRisk: enumOf(['low', 'medium', 'high']),
          retentionNote: str('Empty string when risk is low.'),
          shortsCandidate: { type: 'boolean' },
          onScreenText: str('Empty string when none.'),
          graphics: str('Empty string when none.'),
          music: str('Empty string when none, or "Drop to silence" where stillness matters.'),
          editingNote: str(),
          source: str('Citation needed for this beat, or empty string.'),
          bRoll: arr(
            obj({
              treatment: enumOf(TREATMENTS),
              description: str(),
              alreadyHave: { type: 'boolean' },
            }),
          ),
        }),
      ),
    });
    const user = [
      `Build the beat sheet (Level 2) following this channel's structure: ${ch.scriptMode.structure.join(' → ')}.`,
      'Do not cover every beat with B-roll. Some beats — especially the counterargument — are stronger held on the face with nothing over them. Use the no-b-roll treatment where that is true.',
      'Flag retention risk honestly, especially on the first beat and any beat that runs long.',
      '',
      projectBrief(project),
      '',
      project.script.argumentMap ? `ARGUMENT MAP:\n${JSON.stringify(project.script.argumentMap, null, 2)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const r = await this.json<{
        beats: {
          role: string; purpose: string; information: string; emotion: string;
          visualTreatment: VisualTreatment; durationSeconds: number; transition: string;
          retentionRisk: Beat['retentionRisk']; retentionNote: string; shortsCandidate: boolean;
          onScreenText: string; graphics: string; music: string; editingNote: string; source: string;
          bRoll: { treatment: VisualTreatment; description: string; alreadyHave: boolean }[];
        }[];
      }>(project.channelId, user, schema);

      return r.beats.map((b) => ({
        id: uid('beat'),
        role: b.role,
        purpose: b.purpose,
        information: b.information,
        emotion: b.emotion,
        visualTreatment: b.visualTreatment,
        durationSeconds: Math.max(5, Math.round(b.durationSeconds)),
        transition: b.transition,
        retentionRisk: b.retentionRisk,
        retentionNote: b.retentionNote || undefined,
        shortsCandidate: b.shortsCandidate,
        tracks: {
          aRoll: b.visualTreatment === 'a-roll' ? 'Direct to camera' : '',
          bRoll: b.bRoll.map((s) => ({ id: uid('broll'), ...s })),
          onScreenText: b.onScreenText,
          graphics: b.graphics,
          music: b.music,
          soundEffects: '',
          source: b.source,
          editingNote: b.editingNote,
        },
      }));
    } catch {
      return localEngine.generateBeatSheet(project);
    }
  }

  async draftSection(project: ContentProject, beat: Beat, action?: SectionAction): Promise<string> {
    if (beat.preserved && action !== 'preserve-wording') return beat.draft ?? '';
    const ch = CHANNELS[project.channelId];
    const actionInstruction: Record<SectionAction, string> = {
      'more-personal': 'Rewrite so the general claim is replaced by a specific occasion. Mark anything you do not know with [PLACEHOLDER: ...].',
      'more-precise': 'Rewrite with concrete numbers, dates and named things. Flag any claim that needs a source.',
      'add-tension': 'Rewrite so the opposing position is stated at full strength before it is answered.',
      'remove-repetition': 'Remove every sentence that restates a point already made.',
      'challenge-claim': 'Rewrite so the strongest objection is raised inside the section and answered honestly.',
      'add-example': 'Add one concrete worked example, about thirty seconds spoken.',
      simplify: 'Rewrite in shorter sentences and plainer words without losing precision.',
      'more-conversational': 'Rewrite the way Corey would say it across a table.',
      'add-technical': 'Add the mechanism — spec, tolerance, code reference or physical reason.',
      'add-humor': 'Add one dry aside, placed after the hard part.',
      'connect-previous': 'Open by connecting explicitly to the previous beat.',
      'cut-20': 'Cut roughly 20% of the words. Preserve every idea; remove only the slack.',
      'preserve-wording': 'Return the text unchanged.',
    };

    const user = [
      action ? actionInstruction[action] : `Draft this section (Level 3). Target roughly ${Math.round((beat.durationSeconds / 60) * 150)} words.`,
      ch.scriptMode.scriptRequirement === 'editing-script'
        ? 'This channel wants an EDITING script: cues, moments and markers rather than fully written spoken lines.'
        : ch.scriptMode.scriptRequirement === 'reaction-card'
          ? 'This channel wants a REACTION CARD: a handful of talking points, not prose.'
          : 'Write spoken prose in Corey\'s voice.',
      'Where lived detail is required and unknown, write [PERSONAL STORY PLACEHOLDER: what is needed] rather than inventing it.',
      'Output the section text only — no headings, no commentary.',
      '',
      `BEAT: ${beat.role}`,
      `Purpose: ${beat.purpose}`,
      `Information: ${beat.information}`,
      `Emotion: ${beat.emotion}`,
      beat.draft ? `\nCURRENT DRAFT:\n${beat.draft}` : '',
      '',
      projectBrief(project),
    ]
      .filter(Boolean)
      .join('\n');

    try {
      return await this.prose(project.channelId, user, 3000);
    } catch {
      return localEngine.draftSection(project, beat, action);
    }
  }

  async suggestBRoll(project: ContentProject, beat: Beat, library: LibraryEntry[]): Promise<BRollSuggestion[]> {
    const schema = obj({
      suggestions: arr(
        obj({
          treatment: enumOf(TREATMENTS),
          description: str(),
          alreadyHave: { type: 'boolean' },
          imagePrompt: str('Only for generated-image or diagram treatments; empty string otherwise.'),
        }),
      ),
    });
    const user = [
      'Suggest visuals for this beat. Constant B-roll is not automatically good editing — if this beat is stronger held still on the face, return a single no-b-roll suggestion saying why.',
      '',
      `BEAT: ${beat.role} (${beat.durationSeconds}s) — ${beat.information}`,
      `Emotion: ${beat.emotion}`,
      '',
      libraryBrief(library.filter((e) => e.type === 'b-roll' || e.type === 'gameplay-moment')),
    ].join('\n');
    try {
      const r = await this.json<{ suggestions: Omit<BRollSuggestion, 'id'>[] }>(project.channelId, user, schema);
      return r.suggestions.map((s) => ({ ...s, id: uid('broll'), imagePrompt: s.imagePrompt || undefined }));
    } catch {
      return localEngine.suggestBRoll(project, beat, library);
    }
  }

  async checkTitleDelivery(project: ContentProject): Promise<{ delivered: boolean; note: string }> {
    const title = project.packaging.titles.find((t) => t.selected);
    if (!title) return { delivered: false, note: 'No title selected, so there is nothing to check against.' };
    const schema = obj({ delivered: { type: 'boolean' }, note: str() });
    const user = [
      `Does this script actually deliver the promise in the title "${title.text}"?`,
      'Be strict. If the script gets close but never lands the specific claim in the title, that is a no.',
      '',
      project.script.beats.map((b) => `[${b.role}] ${b.draft || b.information}`).join('\n\n'),
    ].join('\n');
    try {
      return await this.json<{ delivered: boolean; note: string }>(project.channelId, user, schema);
    } catch {
      return localEngine.checkTitleDelivery(project);
    }
  }

  async findShortsMoments(project: ContentProject): Promise<string[]> {
    const schema = obj({ moments: arr(str('Timestamp, beat name, and why it stands alone.')) });
    const user = [
      'Find the moments in this script that would work as standalone vertical Shorts. A Short needs its own beginning and end.',
      'If nothing qualifies, say so in one item rather than forcing candidates.',
      '',
      project.script.beats.map((b) => `[${b.role}] (${b.durationSeconds}s) ${b.draft || b.information}`).join('\n\n'),
    ].join('\n');
    try {
      const r = await this.json<{ moments: string[] }>(project.channelId, user, schema);
      return r.moments;
    } catch {
      return localEngine.findShortsMoments(project);
    }
  }

  async explainUnderperformance(project: ContentProject): Promise<string> {
    if (!project.review) return 'No performance data entered yet.';
    try {
      return await this.prose(
        project.channelId,
        [
          'Explain what happened with this video. Separate four results: packaging (did they click), content (did they keep watching), brand (did it strengthen the intended identity), creator (was Corey proud, was the process sustainable).',
          'A video can underperform numerically and still be strategically right. A viral video can damage the channel by attracting the wrong audience. Say which of those happened here if either did.',
          'End with the single change worth making next time.',
          '',
          projectBrief(project),
          '',
          `PERFORMANCE DATA:\n${JSON.stringify(project.review.inputs, null, 2)}`,
          '',
          `DETERMINISTIC ANALYSIS ALREADY COMPUTED:\nPackaging: ${project.review.packagingResult}\nContent: ${project.review.contentResult}\nBrand: ${project.review.brandResult}\nCreator: ${project.review.creatorResult}`,
        ].join('\n'),
        3000,
      );
    } catch {
      return localEngine.explainUnderperformance(project);
    }
  }

  async freeform(command: string, project: ContentProject | null, context: GenerationContext): Promise<string> {
    const cid = project?.channelId ?? context.direction.channelId;
    try {
      return await this.prose(
        cid,
        [
          command,
          '',
          project ? projectBrief(project) : directionBrief(context.direction),
          '',
          libraryBrief(context.library, 15),
        ].join('\n'),
        4000,
      );
    } catch (err) {
      return `Claude request failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}
