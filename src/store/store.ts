import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { engineFor } from '../ai';
import { uid } from '../ai/text';
import type { GenerationContext, IdeaRequest } from '../ai/types';
import { CHANNELS, emptyScoreCard } from '../domain/channels';
import { generateProductionTasks, mergeProductionTasks } from '../domain/production';
import { nextAction } from '../domain/readiness';
import { buildReview, emptyPerformanceInputs } from '../domain/review';
import { scoreIdea } from '../domain/scoring';
import type {
  Beat,
  BRollSuggestion,
  ChannelId,
  ConceptCanvas,
  ContentProject,
  Direction,
  Idea,
  IdeaOrigin,
  LibraryEntry,
  PerformanceInputs,
  Priority,
  RejectionReason,
  SectionAction,
  Settings,
  Stage,
} from '../domain/types';
import { seedLibrary } from './seed';

// ---------------------------------------------------------------------------

export const emptyConcept = (): ConceptCanvas => ({
  coreArgument: '',
  viewerTransformation: '',
  startingBelief: '',
  endingBelief: '',
  personalStake: '',
  evidence: [],
  tension: '',
  counterargument: '',
  honestLimitation: '',
  memorableLine: '',
});

export const defaultDirection = (channelId: ChannelId = 'corey-williams'): Direction => ({
  channelId,
  seriesId: undefined,
  goals: ['authority'],
  audienceState: 'mixed',
  availableTimeMinutes: 360,
  availableMaterials: '',
  desiredFormatId: undefined,
  energy: 'medium',
  timeliness: 'evergreen',
  personalExperience: '',
  topic: '',
});

interface Busy {
  key: string;
  label: string;
}

export interface AppState {
  ideas: Idea[];
  projects: ContentProject[];
  library: LibraryEntry[];
  settings: Settings;
  direction: Direction;
  shortlist: string[];
  busy: Busy | null;
  error: string | null;
  aiLog: { at: string; command: string; response: string }[];

  // --- infrastructure ---
  setBusy: (b: Busy | null) => void;
  setError: (e: string | null) => void;
  context: () => GenerationContext;

  // --- settings & direction ---
  updateSettings: (patch: Partial<Settings>) => void;
  setActiveChannel: (id: ChannelId | null) => void;
  setDirection: (patch: Partial<Direction>) => void;

  // --- ideas ---
  generateIdeas: (opts: { origin: IdeaOrigin; count: number; steer?: string; sourceEntryIds?: string[]; sourceProjectId?: string }) => Promise<void>;
  critiqueIdea: (ideaId: string) => Promise<void>;
  addManualIdea: (workingTitle: string) => void;
  toggleShortlist: (ideaId: string) => void;
  clearShortlist: () => void;
  rejectIdea: (ideaId: string, reason: RejectionReason, note?: string) => void;
  saveIdeaForLater: (ideaId: string) => void;
  mergeShortlisted: (aId: string, bId: string) => Promise<void>;
  adaptIdea: (ideaId: string, target: ChannelId) => Promise<void>;
  selectIdea: (ideaId: string) => string;

  // --- projects ---
  updateProject: (id: string, patch: Partial<ContentProject>) => void;
  updateConcept: (id: string, patch: Partial<ConceptCanvas>) => void;
  setStage: (id: string, stage: Stage) => void;
  setPriority: (id: string, priority: Priority) => void;
  deleteProject: (id: string) => void;

  developConcept: (id: string) => Promise<void>;
  challengePremise: (id: string) => Promise<string>;
  generatePackaging: (id: string) => Promise<void>;
  selectTitle: (id: string, titleId: string) => void;
  selectHook: (id: string, hookId: string) => void;
  selectThumbnail: (id: string, thumbId: string) => void;

  generateArgumentMap: (id: string) => Promise<void>;
  generateBeatSheet: (id: string) => Promise<void>;
  updateBeat: (id: string, beatId: string, patch: Partial<Beat>) => void;
  draftSection: (id: string, beatId: string, action?: SectionAction) => Promise<void>;
  suggestBRoll: (id: string, beatId: string) => Promise<void>;
  addBRoll: (id: string, beatId: string, suggestion: BRollSuggestion) => void;
  removeBRoll: (id: string, beatId: string, suggestionId: string) => void;
  approveScript: (id: string) => void;
  checkTitleDelivery: (id: string) => Promise<void>;
  findShortsMoments: (id: string) => Promise<string[]>;

  regenerateProduction: (id: string) => void;
  toggleTask: (id: string, taskId: string) => void;
  addTask: (id: string, phase: 'pre' | 'recording' | 'post', label: string) => void;

  saveReview: (id: string, inputs: PerformanceInputs) => Promise<void>;

  // --- library ---
  addLibraryEntry: (entry: Omit<LibraryEntry, 'id' | 'createdAt' | 'usedByProjectIds'>) => void;
  updateLibraryEntry: (id: string, patch: Partial<LibraryEntry>) => void;
  deleteLibraryEntry: (id: string) => void;

  // --- AI bar ---
  runCommand: (command: string, projectId?: string) => Promise<string>;

  resetAll: () => void;
}

const now = () => new Date().toISOString();

function projectFromIdea(idea: Idea): ContentProject {
  return {
    id: uid('proj'),
    createdAt: now(),
    updatedAt: now(),
    channelId: idea.channelId,
    seriesId: idea.seriesId,
    ideaId: idea.id,
    workingTitle: idea.workingTitle,
    stage: 'selected',
    priority: 'normal',
    concept: {
      ...emptyConcept(),
      coreArgument: '',
      personalStake: idea.authorityBasis,
      startingBelief: idea.viewerProblem,
      viewerTransformation: idea.corePromise,
    },
    packaging: { titles: [], hooks: [], thumbnails: [], curiosityGaps: [], stakes: [], emotionalFraming: [] },
    script: { beats: [], estimatedDurationSeconds: 0, chapterMarkers: [] },
    production: [],
    brandAssociations: CHANNELS[idea.channelId].brandAssociations.slice(0, 2),
    notes: '',
    effort: idea.effort,
    contentValue: idea.brandScore,
    viralityScore: idea.viralityScore,
  };
}

const recalcScript = (beats: Beat[]) => ({
  estimatedDurationSeconds: beats.reduce((a, b) => a + b.durationSeconds, 0),
  chapterMarkers: beats.reduce<{ atSeconds: number; label: string }[]>((acc, b) => {
    const at = acc.length ? acc[acc.length - 1].atSeconds : 0;
    const prev = beats[beats.indexOf(b) - 1];
    acc.push({ atSeconds: prev ? at + prev.durationSeconds : 0, label: b.role });
    return acc;
  }, []),
});

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ideas: [],
      projects: [],
      library: seedLibrary(),
      settings: {
        aiProvider: 'local',
        anthropicApiKey: '',
        anthropicModel: 'claude-opus-5',
        activeChannelId: null,
      },
      direction: defaultDirection(),
      shortlist: [],
      busy: null,
      error: null,
      aiLog: [],

      setBusy: (busy) => set({ busy }),
      setError: (error) => set({ error }),

      context: (): GenerationContext => {
        const s = get();
        const rejections = new Map<string, { count: number; examples: string[] }>();
        for (const i of s.ideas) {
          if (i.status !== 'rejected' || !i.rejection) continue;
          const r = rejections.get(i.rejection.reason) ?? { count: 0, examples: [] };
          r.count += 1;
          if (r.examples.length < 3) r.examples.push(i.workingTitle);
          rejections.set(i.rejection.reason, r);
        }
        return {
          direction: s.direction,
          library: s.library,
          history: s.projects.filter((p) => ['published', 'review', 'archived'].includes(p.stage)),
          rejectionSignals: Array.from(rejections, ([reason, v]) => ({ reason, ...v })),
          lessons: s.projects.flatMap((p) => p.review?.changeNextTime ?? []),
        };
      },

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setActiveChannel: (id) =>
        set((s) => ({
          settings: { ...s.settings, activeChannelId: id },
          direction: id ? { ...s.direction, channelId: id, seriesId: undefined } : s.direction,
        })),
      setDirection: (patch) => set((s) => ({ direction: { ...s.direction, ...patch } })),

      // ---------------------------------------------------------------- ideas
      generateIdeas: async (opts) => {
        const s = get();
        set({ busy: { key: 'ideas', label: 'Generating ideas…' }, error: null });
        try {
          const req: IdeaRequest = {
            context: s.context(),
            origin: opts.origin,
            count: opts.count,
            steer: opts.steer,
            sourceEntryIds: opts.sourceEntryIds,
            sourceProjectId: opts.sourceProjectId,
          };
          const ideas = await engineFor(s.settings).generateIdeas(req);
          set((st) => ({ ideas: [...ideas, ...st.ideas] }));
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
        } finally {
          set({ busy: null });
        }
      },

      critiqueIdea: async (ideaId) => {
        const s = get();
        const idea = s.ideas.find((i) => i.id === ideaId);
        if (!idea) return;
        set({ busy: { key: 'critique', label: 'Looking for the weak point…' } });
        try {
          const warnings = await engineFor(s.settings).critique(idea);
          set((st) => ({
            ideas: st.ideas.map((i) => (i.id === ideaId ? { ...i, originalityWarnings: warnings } : i)),
          }));
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
        } finally {
          set({ busy: null });
        }
      },

      addManualIdea: (workingTitle) => {
        const s = get();
        const idea = scoreIdea({
          id: uid('idea'),
          createdAt: now(),
          channelId: s.direction.channelId,
          seriesId: s.direction.seriesId,
          workingTitle,
          premise: '',
          viewerProblem: '',
          corePromise: '',
          authorityBasis: '',
          emotionalAngle: '',
          channelFit: '',
          originalityWarnings: [],
          effort: 'medium',
          timeliness: s.direction.timeliness,
          scores: emptyScoreCard(55),
          weightedScore: 0,
          viralityScore: 0,
          brandScore: 0,
          status: 'generated',
          origin: 'manual',
        });
        set((st) => ({ ideas: [idea, ...st.ideas] }));
      },

      toggleShortlist: (ideaId) =>
        set((s) => {
          const on = s.shortlist.includes(ideaId);
          const shortlist = on ? s.shortlist.filter((i) => i !== ideaId) : [...s.shortlist, ideaId].slice(-4);
          return {
            shortlist,
            ideas: s.ideas.map((i) =>
              i.id === ideaId ? { ...i, status: on ? 'generated' : 'shortlisted' } : i,
            ),
          };
        }),

      clearShortlist: () => set({ shortlist: [] }),

      rejectIdea: (ideaId, reason, note) =>
        set((s) => ({
          shortlist: s.shortlist.filter((i) => i !== ideaId),
          ideas: s.ideas.map((i) =>
            i.id === ideaId ? { ...i, status: 'rejected', rejection: { reason, note, at: now() } } : i,
          ),
          library: [
            ...s.library,
            {
              id: uid('lib'),
              createdAt: now(),
              type: 'rejected-idea' as const,
              title: s.ideas.find((i) => i.id === ideaId)?.workingTitle ?? 'Rejected idea',
              body: `Rejected: ${reason}${note ? ` — ${note}` : ''}`,
              tags: [reason],
              channelIds: [s.ideas.find((i) => i.id === ideaId)?.channelId].filter(Boolean) as ChannelId[],
              brandAssociations: [],
              used: false,
              usedByProjectIds: [],
            },
          ],
        })),

      saveIdeaForLater: (ideaId) =>
        set((s) => ({
          ideas: s.ideas.map((i) => (i.id === ideaId ? { ...i, status: 'saved' } : i)),
          shortlist: s.shortlist.filter((i) => i !== ideaId),
        })),

      mergeShortlisted: async (aId, bId) => {
        const s = get();
        const a = s.ideas.find((i) => i.id === aId);
        const b = s.ideas.find((i) => i.id === bId);
        if (!a || !b) return;
        set({ busy: { key: 'merge', label: 'Merging…' } });
        try {
          const merged = await engineFor(s.settings).mergeIdeas(a, b);
          set((st) => ({
            ideas: [
              merged,
              ...st.ideas.map((i) => (i.id === aId || i.id === bId ? { ...i, status: 'merged' as const } : i)),
            ],
            shortlist: [merged.id],
          }));
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
        } finally {
          set({ busy: null });
        }
      },

      adaptIdea: async (ideaId, target) => {
        const s = get();
        const idea = s.ideas.find((i) => i.id === ideaId);
        if (!idea) return;
        set({ busy: { key: 'adapt', label: `Adapting for ${CHANNELS[target].name}…` } });
        try {
          const adapted = await engineFor(s.settings).adaptIdea(idea, target);
          set((st) => ({ ideas: [adapted, ...st.ideas] }));
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
        } finally {
          set({ busy: null });
        }
      },

      selectIdea: (ideaId) => {
        const s = get();
        const idea = s.ideas.find((i) => i.id === ideaId);
        if (!idea) return '';
        const project = projectFromIdea(idea);
        set((st) => ({
          projects: [project, ...st.projects],
          ideas: st.ideas.map((i) =>
            i.id === ideaId ? { ...i, status: 'selected', projectId: project.id } : i,
          ),
          shortlist: st.shortlist.filter((i) => i !== ideaId),
        }));
        return project.id;
      },

      // ------------------------------------------------------------- projects
      updateProject: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now() } : p)),
        })),

      updateConcept: (id, patch) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, concept: { ...p.concept, ...patch }, updatedAt: now() } : p,
          ),
        })),

      setStage: (id, stage) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  stage,
                  publishedAt: stage === 'published' && !p.publishedAt ? now() : p.publishedAt,
                  updatedAt: now(),
                }
              : p,
          ),
        }));
        const p = get().projects.find((x) => x.id === id);
        if (p) get().updateProject(id, { nextAction: nextAction(p).label });
      },

      setPriority: (id, priority) => get().updateProject(id, { priority }),

      deleteProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

      developConcept: async (id) => {
        const s = get();
        const p = s.projects.find((x) => x.id === id);
        if (!p) return;
        set({ busy: { key: 'concept', label: 'Developing the concept…' } });
        try {
          const concept = await engineFor(s.settings).developConcept(p, s.library);
          get().updateProject(id, { concept, stage: p.stage === 'selected' ? 'developing' : p.stage });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
        } finally {
          set({ busy: null });
        }
      },

      challengePremise: async (id) => {
        const s = get();
        const p = s.projects.find((x) => x.id === id);
        if (!p) return '';
        set({ busy: { key: 'challenge', label: 'Arguing with you…' } });
        try {
          return await engineFor(s.settings).challengePremise(p);
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
          return '';
        } finally {
          set({ busy: null });
        }
      },

      generatePackaging: async (id) => {
        const s = get();
        const p = s.projects.find((x) => x.id === id);
        if (!p) return;
        set({ busy: { key: 'packaging', label: 'Writing titles, hooks and thumbnails…' } });
        try {
          const packaging = await engineFor(s.settings).generatePackaging(p);
          get().updateProject(id, {
            packaging,
            stage: ['selected', 'developing'].includes(p.stage) ? 'packaging' : p.stage,
          });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
        } finally {
          set({ busy: null });
        }
      },

      selectTitle: (id, titleId) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  packaging: {
                    ...p.packaging,
                    titles: p.packaging.titles.map((t) => ({ ...t, selected: t.id === titleId })),
                  },
                  updatedAt: now(),
                }
              : p,
          ),
        })),

      selectHook: (id, hookId) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  packaging: {
                    ...p.packaging,
                    hooks: p.packaging.hooks.map((h) => ({ ...h, selected: h.id === hookId })),
                  },
                  updatedAt: now(),
                }
              : p,
          ),
        })),

      selectThumbnail: (id, thumbId) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  packaging: {
                    ...p.packaging,
                    thumbnails: p.packaging.thumbnails.map((t) => ({ ...t, selected: t.id === thumbId })),
                  },
                  updatedAt: now(),
                }
              : p,
          ),
        })),

      // --------------------------------------------------------------- script
      generateArgumentMap: async (id) => {
        const s = get();
        const p = s.projects.find((x) => x.id === id);
        if (!p) return;
        set({ busy: { key: 'argmap', label: 'Building the argument map…' } });
        try {
          const argumentMap = await engineFor(s.settings).generateArgumentMap(p);
          get().updateProject(id, {
            script: { ...p.script, argumentMap },
            stage: ['selected', 'developing', 'packaging'].includes(p.stage) ? 'scripting' : p.stage,
          });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
        } finally {
          set({ busy: null });
        }
      },

      generateBeatSheet: async (id) => {
        const s = get();
        const p = s.projects.find((x) => x.id === id);
        if (!p) return;
        set({ busy: { key: 'beats', label: 'Building the beat sheet…' } });
        try {
          const beats = await engineFor(s.settings).generateBeatSheet(p);
          get().updateProject(id, {
            script: { ...p.script, beats, ...recalcScript(beats) },
            stage: ['selected', 'developing', 'packaging'].includes(p.stage) ? 'scripting' : p.stage,
          });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
        } finally {
          set({ busy: null });
        }
      },

      updateBeat: (id, beatId, patch) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== id) return p;
            const beats = p.script.beats.map((b) => (b.id === beatId ? { ...b, ...patch } : b));
            return { ...p, script: { ...p.script, beats, ...recalcScript(beats) }, updatedAt: now() };
          }),
        })),

      draftSection: async (id, beatId, action) => {
        const s = get();
        const p = s.projects.find((x) => x.id === id);
        const beat = p?.script.beats.find((b) => b.id === beatId);
        if (!p || !beat) return;
        set({ busy: { key: `draft_${beatId}`, label: action ? 'Rewriting…' : 'Drafting…' } });
        try {
          const draft = await engineFor(s.settings).draftSection(p, beat, action);
          get().updateBeat(id, beatId, { draft });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
        } finally {
          set({ busy: null });
        }
      },

      suggestBRoll: async (id, beatId) => {
        const s = get();
        const p = s.projects.find((x) => x.id === id);
        const beat = p?.script.beats.find((b) => b.id === beatId);
        if (!p || !beat) return;
        set({ busy: { key: `broll_${beatId}`, label: 'Finding visuals…' } });
        try {
          const bRoll = await engineFor(s.settings).suggestBRoll(p, beat, s.library);
          get().updateBeat(id, beatId, { tracks: { ...beat.tracks, bRoll } });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
        } finally {
          set({ busy: null });
        }
      },

      addBRoll: (id, beatId, suggestion) => {
        const beat = get().projects.find((p) => p.id === id)?.script.beats.find((b) => b.id === beatId);
        if (!beat) return;
        get().updateBeat(id, beatId, { tracks: { ...beat.tracks, bRoll: [...beat.tracks.bRoll, suggestion] } });
      },

      removeBRoll: (id, beatId, suggestionId) => {
        const beat = get().projects.find((p) => p.id === id)?.script.beats.find((b) => b.id === beatId);
        if (!beat) return;
        get().updateBeat(id, beatId, {
          tracks: { ...beat.tracks, bRoll: beat.tracks.bRoll.filter((s) => s.id !== suggestionId) },
        });
      },

      approveScript: (id) => {
        const p = get().projects.find((x) => x.id === id);
        if (!p) return;
        const tasks = mergeProductionTasks(p.production, generateProductionTasks(p));
        get().updateProject(id, {
          script: { ...p.script, approvedAt: now() },
          production: tasks,
          stage: 'ready-to-record',
        });
      },

      checkTitleDelivery: async (id) => {
        const s = get();
        const p = s.projects.find((x) => x.id === id);
        if (!p) return;
        set({ busy: { key: 'titlecheck', label: 'Checking the script keeps the promise…' } });
        try {
          const { delivered, note } = await engineFor(s.settings).checkTitleDelivery(p);
          set((st) => ({
            projects: st.projects.map((x) =>
              x.id === id
                ? {
                    ...x,
                    packaging: {
                      ...x.packaging,
                      titles: x.packaging.titles.map((t) =>
                        t.selected
                          ? { ...t, checks: { ...t.checks, deliveredByScript: delivered, notes: [...t.checks.notes, note] } }
                          : t,
                      ),
                    },
                    updatedAt: now(),
                  }
                : x,
            ),
          }));
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
        } finally {
          set({ busy: null });
        }
      },

      findShortsMoments: async (id) => {
        const s = get();
        const p = s.projects.find((x) => x.id === id);
        if (!p) return [];
        set({ busy: { key: 'shorts', label: 'Finding Shorts moments…' } });
        try {
          return await engineFor(s.settings).findShortsMoments(p);
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) });
          return [];
        } finally {
          set({ busy: null });
        }
      },

      // ----------------------------------------------------------- production
      regenerateProduction: (id) => {
        const p = get().projects.find((x) => x.id === id);
        if (!p) return;
        get().updateProject(id, { production: mergeProductionTasks(p.production, generateProductionTasks(p)) });
      },

      toggleTask: (id, taskId) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  production: p.production.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
                  updatedAt: now(),
                }
              : p,
          ),
        })),

      addTask: (id, phase, label) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  production: [
                    ...p.production,
                    { id: uid('task'), phase, label, done: false, derivedFrom: 'Manual' },
                  ],
                  updatedAt: now(),
                }
              : p,
          ),
        })),

      // --------------------------------------------------------------- review
      saveReview: async (id, inputs) => {
        const s = get();
        const p = s.projects.find((x) => x.id === id);
        if (!p) return;
        const review = buildReview(p, inputs);
        get().updateProject(id, { review, stage: 'review' });

        // Feed the lesson back into the library so future generation sees it.
        if (review.changeNextTime.length) {
          get().addLibraryEntry({
            type: 'lesson',
            title: `Lesson from "${p.workingTitle}"`,
            body: review.changeNextTime.join(' '),
            tags: ['performance'],
            channelIds: [p.channelId],
            brandAssociations: p.brandAssociations,
            used: false,
          });
        }
      },

      // -------------------------------------------------------------- library
      addLibraryEntry: (entry) =>
        set((s) => ({
          library: [{ id: uid('lib'), createdAt: now(), usedByProjectIds: [], ...entry }, ...s.library],
        })),

      updateLibraryEntry: (id, patch) =>
        set((s) => ({ library: s.library.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

      deleteLibraryEntry: (id) => set((s) => ({ library: s.library.filter((e) => e.id !== id) })),

      // --------------------------------------------------------------- AI bar
      runCommand: async (command, projectId) => {
        const s = get();
        const project = projectId ? s.projects.find((p) => p.id === projectId) ?? null : null;
        set({ busy: { key: 'command', label: 'Working…' } });
        try {
          const response = await engineFor(s.settings).freeform(command, project, s.context());
          set((st) => ({ aiLog: [{ at: now(), command, response }, ...st.aiLog].slice(0, 50) }));
          return response;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          set({ error: msg });
          return msg;
        } finally {
          set({ busy: null });
        }
      },

      resetAll: () =>
        set({
          ideas: [],
          projects: [],
          library: seedLibrary(),
          shortlist: [],
          direction: defaultDirection(),
          aiLog: [],
          error: null,
        }),
    }),
    {
      name: 'creator-engine-v1',
      partialize: (s) => ({
        ideas: s.ideas,
        projects: s.projects,
        library: s.library,
        settings: s.settings,
        direction: s.direction,
        shortlist: s.shortlist,
        aiLog: s.aiLog,
      }),
    },
  ),
);

export { emptyPerformanceInputs };
