/**
 * Script scanner.
 *
 * Reads a script — written here, pasted from anywhere, or synced from a doc —
 * and pulls out everything it asks you to produce or find: images, B-roll,
 * graphics, screen recordings, gameplay, citations, and unfilled placeholders.
 *
 * It is deliberately tolerant about notation, because nobody writes brackets
 * consistently at 1am. All of these are understood:
 *
 *   [IMAGE: burnt breaker, macro]        [IMG - burnt breaker]
 *   [B-ROLL: morning routine]            [BROLL morning routine]
 *   B-ROLL: morning routine              (at the start of a line)
 *   [GRAPHIC: belief loop diagram]       [DIAGRAM: belief loop]
 *   [SCREEN: meter reading]              [GAMEPLAY: clutch at 4:12]
 *   [SOURCE: Deep Work p.94]             [CITE: NEC 210.8]
 *   [PERSONAL STORY PLACEHOLDER: ...]    [TODO: find the date]
 */

import { uid } from '../ai/text';
import type { AssetKind, ScannedAsset, ScriptDoc } from './types';

interface Rule {
  kind: AssetKind;
  /** Keywords that can appear as the bracket tag or the line prefix. */
  tags: string[];
}

const RULES: Rule[] = [
  { kind: 'image', tags: ['image', 'img', 'photo', 'still', 'picture'] },
  { kind: 'b-roll', tags: ['b-roll', 'broll', 'b roll', 'cutaway', 'insert'] },
  { kind: 'graphic', tags: ['graphic', 'diagram', 'chart', 'animation', 'title card', 'lower third'] },
  { kind: 'screen-recording', tags: ['screen', 'screen recording', 'screencap', 'screen capture', 'capture'] },
  { kind: 'gameplay', tags: ['gameplay', 'clip', 'game footage'] },
  { kind: 'source', tags: ['source', 'cite', 'citation', 'ref', 'reference'] },
  { kind: 'placeholder', tags: ['placeholder', 'todo', 'tk', 'fixme', 'personal story placeholder'] },
];

/** Longest tags first so "b-roll" wins over "b" and "screen recording" over "screen". */
const TAG_LOOKUP: { tag: string; kind: AssetKind }[] = RULES.flatMap((r) =>
  r.tags.map((tag) => ({ tag, kind: r.kind })),
).sort((a, b) => b.tag.length - a.tag.length);

function kindForTag(tagText: string): AssetKind | null {
  const t = tagText.trim().toLowerCase();
  for (const { tag, kind } of TAG_LOOKUP) {
    if (t === tag || t.startsWith(`${tag} `) || t.startsWith(`${tag}:`) || t.startsWith(`${tag}-`)) {
      return kind;
    }
  }
  return null;
}

/** Strip the leading tag from the matched body, leaving the description. */
function describe(body: string): string {
  return body
    .replace(/^[a-z0-9 _-]+\s*[:\-–—]\s*/i, '')
    .replace(/^[a-z0-9 _-]+\s+/i, (m) => (kindForTag(m) ? '' : m))
    .trim();
}

const IMAGE_KINDS: AssetKind[] = ['image', 'graphic'];

function promptFor(kind: AssetKind, description: string): string | undefined {
  if (!IMAGE_KINDS.includes(kind) || !description) return undefined;
  const style =
    kind === 'graphic'
      ? 'clean vector diagram, labelled, high contrast, flat background, no photographic texture'
      : 'cinematic photograph, shallow depth of field, natural light, high contrast';
  return `${description}, ${style}, no text, no watermark, 16:9`;
}

export interface ScanResult {
  assets: ScannedAsset[];
  /** Counts by kind, for the summary strip. */
  counts: Record<AssetKind, number>;
  /** Lines scanned, so an empty result can be explained. */
  lineCount: number;
}

const emptyCounts = (): Record<AssetKind, number> => ({
  image: 0,
  'b-roll': 0,
  graphic: 0,
  'screen-recording': 0,
  gameplay: 0,
  source: 0,
  placeholder: 0,
});

/**
 * Scan script text. Existing assets are passed in so that status and library
 * links survive a rescan — re-scanning must never lose the work of marking
 * fifteen shots as "have".
 */
export function scanScript(text: string, existing: ScannedAsset[] = []): ScanResult {
  const counts = emptyCounts();
  const assets: ScannedAsset[] = [];
  if (!text.trim()) return { assets, counts, lineCount: 0 };

  const previous = new Map(existing.map((a) => [`${a.kind}|${a.description.toLowerCase()}`, a]));
  const seen = new Set<string>();
  const lines = text.split('\n');

  const push = (kind: AssetKind, raw: string, description: string, line: number) => {
    const desc = description || raw.replace(/^[[\](){}]+|[[\](){}]+$/g, '').trim();
    const key = `${kind}|${desc.toLowerCase()}`;
    if (!desc || seen.has(key)) return;
    seen.add(key);
    const prior = previous.get(key);
    counts[kind] += 1;
    assets.push({
      id: prior?.id ?? uid('asset'),
      kind,
      raw: raw.trim(),
      description: desc,
      line,
      status: prior?.status ?? 'needed',
      imagePrompt: prior?.imagePrompt ?? promptFor(kind, desc),
      linkedEntryId: prior?.linkedEntryId,
    });
  };

  lines.forEach((lineText, i) => {
    const lineNo = i + 1;

    // 1. Bracketed markers anywhere in the line: [TAG: description]
    for (const match of lineText.matchAll(/\[([^\]]{2,240})\]/g)) {
      const body = match[1];
      const kind = kindForTag(body);
      if (kind) push(kind, match[0], describe(body), lineNo);
    }

    // 2. A whole line used as a marker: "B-ROLL: morning routine"
    const linePrefix = lineText.match(/^\s*([A-Za-z][A-Za-z \-]{1,28})\s*[:\-–—]\s*(.+)$/);
    if (linePrefix) {
      const kind = kindForTag(linePrefix[1]);
      // Only treat it as a marker when the tag is written as a label, not prose.
      const looksLikeLabel = linePrefix[1] === linePrefix[1].toUpperCase() || /^[A-Z][a-z-]+$/.test(linePrefix[1].trim());
      if (kind && looksLikeLabel) push(kind, lineText.trim(), linePrefix[2].trim(), lineNo);
    }
  });

  return { assets, counts, lineCount: lines.length };
}

// ---------------------------------------------------------------------------

export const emptyScriptDoc = (): ScriptDoc => ({
  content: '',
  source: 'app',
  wordCount: 0,
});

export const countWords = (text: string): number =>
  text.trim() ? text.trim().split(/\s+/).length : 0;

/** ~150 spoken words per minute. */
export const spokenSeconds = (words: number): number => Math.round((words / 150) * 60);

/**
 * Google Docs share links come in several shapes. Normalise to the canonical
 * document URL, and reject anything that is not actually a Docs link so the
 * field cannot silently hold a broken address.
 */
export function normaliseGoogleDocUrl(input: string): { url: string } | { error: string } {
  const raw = input.trim();
  if (!raw) return { url: '' };
  let parsed: URL;
  try {
    parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return { error: 'That is not a URL.' };
  }
  if (!/(^|\.)google\.com$/.test(parsed.hostname)) {
    return { error: 'That is not a Google Docs link.' };
  }
  const id = parsed.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!id) return { error: 'That Google link does not point at a document.' };
  return { url: `https://docs.google.com/document/d/${id}/edit` };
}

/**
 * Assemble a script document from the beat sheet, so a project that was built
 * through the Script Studio can hand its text to the scanner and to Docs.
 */
export function assembleFromBeats(beats: { role: string; draft?: string; information: string; tracks: { bRoll: { description: string; treatment: string }[]; onScreenText: string; graphics: string; source: string } }[]): string {
  const out: string[] = [];
  for (const b of beats) {
    out.push(`## ${b.role}`);
    out.push('');
    out.push(b.draft?.trim() || `[PLACEHOLDER: ${b.information}]`);
    out.push('');
    for (const s of b.tracks.bRoll) {
      if (s.treatment === 'no-b-roll') continue;
      const tag = s.treatment === 'diagram' ? 'GRAPHIC' : s.treatment === 'generated-image' ? 'IMAGE' : 'B-ROLL';
      out.push(`[${tag}: ${s.description}]`);
    }
    if (b.tracks.graphics) out.push(`[GRAPHIC: ${b.tracks.graphics}]`);
    if (b.tracks.source) out.push(`[SOURCE: ${b.tracks.source}]`);
    out.push('');
  }
  return out.join('\n');
}
