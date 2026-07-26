/**
 * Production board generation.
 *
 * Tasks are derived from the actual script, timeline and packaging of this
 * project — not from a static checklist. If a beat needs a diagram, a diagram
 * task appears. If no beat uses gameplay, no gameplay task appears.
 */

import { CHANNELS } from './channels';
import type { ContentProject, ProductionTask, VisualTreatment } from './types';

let seq = 0;
const tid = () => `task_${Date.now().toString(36)}_${(seq++).toString(36)}`;

const task = (
  phase: ProductionTask['phase'],
  label: string,
  derivedFrom?: string,
  beatId?: string,
): ProductionTask => ({ id: tid(), phase, label, done: false, derivedFrom, beatId });

const TREATMENT_TASKS: Partial<Record<VisualTreatment, (n: number) => string>> = {
  'easy-to-record': (n) => `Record ${n} planned B-roll setup${n > 1 ? 's' : ''}`,
  'project-closeup': (n) => `Shoot ${n} project closeup${n > 1 ? 's' : ''}`,
  'screen-recording': (n) => `Capture ${n} screen recording${n > 1 ? 's' : ''}`,
  gameplay: (n) => `Pull ${n} gameplay segment${n > 1 ? 's' : ''} from footage`,
  archival: (n) => `Dig out ${n} archival clip${n > 1 ? 's' : ''}`,
  'existing-footage': (n) => `Locate ${n} existing clip${n > 1 ? 's' : ''} on disk`,
  'generated-image': (n) => `Generate ${n} image${n > 1 ? 's' : ''} from the saved prompts`,
  diagram: (n) => `Build ${n} diagram${n > 1 ? 's' : ''}`,
  stock: (n) => `Source ${n} stock clip${n > 1 ? 's' : ''}`,
};

export function generateProductionTasks(project: ContentProject): ProductionTask[] {
  const ch = CHANNELS[project.channelId];
  const beats = project.script.beats;
  const tasks: ProductionTask[] = [];

  // ---------------- Pre-production ----------------
  const selectedTitle = project.packaging.titles.find((t) => t.selected);
  tasks.push(
    task('pre', selectedTitle ? `Lock title: "${selectedTitle.text}"` : 'Finalize title direction', 'Packaging'),
  );
  const thumb = project.packaging.thumbnails.find((t) => t.selected) ?? project.packaging.thumbnails[0];
  if (thumb) {
    tasks.push(task('pre', `Draft thumbnail: ${thumb.mainVisual}`, 'Thumbnail concept'));
    if (thumb.focalObject) tasks.push(task('pre', `Prepare focal object: ${thumb.focalObject}`, 'Thumbnail concept'));
  } else {
    tasks.push(task('pre', 'Create thumbnail draft', 'Packaging'));
  }

  const sourced = project.concept.evidence.filter((e) => e.kind === 'source');
  if (sourced.length) {
    tasks.push(task('pre', `Gather ${sourced.length} cited source${sourced.length > 1 ? 's' : ''}`, 'Concept evidence'));
  }
  const beatsWithSources = beats.filter((b) => b.tracks.source.trim());
  beatsWithSources.forEach((b) =>
    tasks.push(task('pre', `Verify source for "${b.role}": ${b.tracks.source}`, 'Timeline source track', b.id)),
  );

  if (ch.workspace.features.materialsAndTools) {
    tasks.push(task('pre', 'Confirm materials and tools on hand', 'Channel mode: Core Workshop'));
    tasks.push(task('pre', 'Confirm build setup and workspace', 'Channel mode: Core Workshop'));
  }
  if (ch.gates.requireSafetyNote) {
    tasks.push(task('pre', 'Write the on-camera safety warning', 'Channel gate: safety required'));
  }
  if (ch.workspace.features.footageImporter) {
    tasks.push(task('pre', 'Import and label existing footage', 'Channel mode: footage-led'));
  }
  if (project.channelId === 'cdogg') {
    tasks.push(task('pre', 'Confirm game build / patch version on record', 'Channel mode: CDogg'));
  }

  const needsCamera = beats.some((b) => b.visualTreatment === 'a-roll') || beats.length === 0;
  if (needsCamera) {
    tasks.push(task('pre', 'Charge camera and spare batteries', 'A-roll beats'));
    tasks.push(task('pre', 'Prepare camera and framing', 'A-roll beats'));
    tasks.push(task('pre', 'Prepare microphone and level check', 'A-roll beats'));
    tasks.push(task('pre', 'Set up lighting', 'A-roll beats'));
  }
  if (ch.scriptMode.scriptRequirement !== 'reaction-card') {
    tasks.push(task('pre', 'Load script / beat sheet on the teleprompter or tablet', 'Script'));
  }
  tasks.push(task('pre', `Build shot list (${beats.length} beat${beats.length === 1 ? '' : 's'})`, 'Beat sheet'));

  // ---------------- Recording ----------------
  const aRollBeats = beats.filter((b) => b.visualTreatment === 'a-roll' || b.tracks.aRoll.trim());
  if (aRollBeats.length) {
    tasks.push(task('recording', `Record main A-roll — ${aRollBeats.length} beats`, 'Beat sheet'));
  }
  const hookBeat = beats[0];
  if (hookBeat) {
    tasks.push(task('recording', 'Record an alternate hook take', 'Retention insurance on beat 1', hookBeat.id));
  }
  if (thumb) tasks.push(task('recording', `Shoot thumbnail poses: ${thumb.subject}`, 'Thumbnail concept'));
  tasks.push(task('recording', 'Record 30s of room tone', 'Audio post'));

  // B-roll tasks grouped by treatment, derived from the timeline.
  const byTreatment = new Map<VisualTreatment, number>();
  for (const b of beats) {
    for (const s of b.tracks.bRoll) {
      if (s.alreadyHave && s.treatment !== 'existing-footage' && s.treatment !== 'archival') continue;
      byTreatment.set(s.treatment, (byTreatment.get(s.treatment) ?? 0) + 1);
    }
  }
  for (const [treatment, count] of byTreatment) {
    const make = TREATMENT_TASKS[treatment];
    if (!make) continue;
    const phase: ProductionTask['phase'] =
      treatment === 'diagram' || treatment === 'generated-image' || treatment === 'stock' ? 'post' : 'recording';
    tasks.push(task(phase, make(count), 'B-roll suggestions on the timeline'));
  }

  if (ch.workspace.features.momentMarkers) {
    tasks.push(task('recording', 'Drop moment markers during capture', 'Channel mode: moment-led'));
  }
  if (ch.workspace.features.buildStages) {
    tasks.push(task('recording', 'Shoot closeups at each build stage transition', 'Channel mode: build stages'));
  }
  tasks.push(task('recording', 'Pickups pass for fluffed lines', 'Standard'));

  // ---------------- Post ----------------
  tasks.push(task('post', 'Import and back up files', 'Standard'));
  tasks.push(task('post', 'Synchronize audio', 'Standard'));
  tasks.push(task('post', 'Assemble rough cut against the beat timeline', 'Timeline'));
  const highRisk = beats.filter((b) => b.retentionRisk === 'high');
  highRisk.forEach((b) =>
    tasks.push(task('post', `Tighten high-retention-risk beat: "${b.role}"`, b.retentionNote ?? 'Retention risk flagged', b.id)),
  );
  tasks.push(task('post', 'Remove repetition pass', 'Standard'));
  const textBeats = beats.filter((b) => b.tracks.onScreenText.trim());
  if (textBeats.length) tasks.push(task('post', `Add ${textBeats.length} on-screen text card${textBeats.length > 1 ? 's' : ''}`, 'Timeline text track'));
  const graphicBeats = beats.filter((b) => b.tracks.graphics.trim());
  if (graphicBeats.length) tasks.push(task('post', `Build ${graphicBeats.length} graphic${graphicBeats.length > 1 ? 's' : ''}`, 'Timeline graphics track'));
  const silenceBeats = beats.filter((b) => /silence/i.test(b.tracks.music) || /silence/i.test(b.tracks.editingNote));
  if (silenceBeats.length) tasks.push(task('post', `Protect ${silenceBeats.length} deliberate silence moment${silenceBeats.length > 1 ? 's' : ''} from music bed`, 'Timeline music track'));
  tasks.push(task('post', 'Mix audio', 'Standard'));
  tasks.push(task('post', 'Color correction', 'Standard'));
  tasks.push(task('post', 'Add subtitles', 'Standard'));
  tasks.push(task('post', 'Export thumbnail stills', 'Thumbnail'));
  const shorts = beats.filter((b) => b.shortsCandidate);
  if (shorts.length && ch.workspace.features.shortsGenerator) {
    tasks.push(task('post', `Cut ${shorts.length} Short${shorts.length > 1 ? 's' : ''} from marked beats`, 'Shorts markers'));
  }
  if (ch.workspace.features.claimChecker) {
    tasks.push(task('post', 'Final claim check — every stated fact traceable', 'Channel mode: claim checker'));
  }
  if (ch.gates.requireTitleDeliveryCheck) {
    tasks.push(task('post', 'Final title / thumbnail alignment check', 'Publish gate'));
  }

  return tasks;
}

/** Merge regenerated tasks with existing ones, preserving completion state. */
export function mergeProductionTasks(
  existing: ProductionTask[],
  regenerated: ProductionTask[],
): ProductionTask[] {
  const doneLabels = new Set(existing.filter((t) => t.done).map((t) => t.label));
  const manual = existing.filter((t) => t.derivedFrom === 'Manual');
  return [
    ...regenerated.map((t) => (doneLabels.has(t.label) ? { ...t, done: true } : t)),
    ...manual,
  ];
}
