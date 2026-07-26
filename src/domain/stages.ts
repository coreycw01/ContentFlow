import type { Stage } from './types';

export interface StageDef {
  id: Stage;
  label: string;
  /** Why this step matters — shown inline so the workflow explains itself. */
  why: string;
  /** Whether this stage is a working stage (vs terminal/holding). */
  active: boolean;
}

export const STAGES: StageDef[] = [
  { id: 'inbox', label: 'Inbox', why: 'Raw capture. Nothing here has been judged yet.', active: false },
  { id: 'generated', label: 'Generated', why: 'Fresh idea cards waiting for a first read.', active: false },
  { id: 'reviewing', label: 'Reviewing', why: 'Shortlisted for side-by-side comparison.', active: true },
  { id: 'selected', label: 'Selected', why: 'A decision was made. This is now a real project.', active: true },
  { id: 'developing', label: 'Developing', why: 'The concept canvas is where a topic becomes an argument.', active: true },
  { id: 'packaging', label: 'Packaging', why: 'Title, hook and thumbnail decided before the script is written, so the script has a promise to keep.', active: true },
  { id: 'scripting', label: 'Scripting', why: 'Argument map, beat sheet, section drafts, full script.', active: true },
  { id: 'ready-to-record', label: 'Ready to Record', why: 'Script approved. Shot list and checklist generated.', active: true },
  { id: 'recording', label: 'Recording', why: 'Capture in progress.', active: true },
  { id: 'editing', label: 'Editing', why: 'Assembly against the timeline.', active: true },
  { id: 'scheduled', label: 'Scheduled', why: 'Uploaded, waiting on a publish date.', active: true },
  { id: 'published', label: 'Published', why: 'Live. Data starts arriving.', active: false },
  { id: 'review', label: 'Review', why: 'Packaging, content, brand and creator results — then the lesson.', active: true },
  { id: 'archived', label: 'Archived', why: 'Closed out. Still searchable as material.', active: false },
];

export const STAGE_IDS = STAGES.map((s) => s.id);

export const stageDef = (id: Stage): StageDef => STAGES.find((s) => s.id === id) ?? STAGES[0];

export const stageIndex = (id: Stage): number => STAGE_IDS.indexOf(id);

export function nextStage(id: Stage): Stage | null {
  const i = stageIndex(id);
  if (i < 0 || i >= STAGE_IDS.length - 1) return null;
  return STAGE_IDS[i + 1];
}

/** Stages where the project is waiting on Corey rather than on the calendar. */
export const WORKING_STAGES: Stage[] = [
  'selected',
  'developing',
  'packaging',
  'scripting',
  'ready-to-record',
  'recording',
  'editing',
];
