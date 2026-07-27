/** Small deterministic text helpers shared by the local engine. */

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic RNG so regenerating with the same seed is reproducible. */
export function rng(seed: string) {
  let s = hash(seed) || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function pick<T>(items: T[], r: () => number): T {
  return items[Math.floor(r() * items.length) % items.length];
}

export function pickMany<T>(items: T[], n: number, r: () => number): T[] {
  const pool = items.slice();
  const out: T[] = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  }
  return out;
}

export function jitter(base: number, spread: number, r: () => number): number {
  return Math.max(1, Math.min(99, Math.round(base + (r() * 2 - 1) * spread)));
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with', 'that',
  'this', 'it', 'is', 'are', 'was', 'were', 'be', 'been', 'my', 'your', 'i', 'you',
  'we', 'they', 'about', 'how', 'why', 'what', 'when', 'from', 'as', 'at', 'by', 'so',
  'have', 'has', 'had', 'do', 'does', 'did', 'not', 'no', 'me', 'their', 'them',
]);

/** Meaningful words from a blob, longest first. */
export function keywords(text: string, limit = 8): string[] {
  const seen = new Set<string>();
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .filter((w) => (seen.has(w) ? false : (seen.add(w), true)))
    .sort((a, b) => b.length - a.length)
    .slice(0, limit);
}

/** A short noun phrase suitable for dropping into a title. */
export function subjectPhrase(text: string, fallback = 'this'): string {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return fallback;
  const firstClause = cleaned.split(/[.;:!?]/)[0];
  const words = firstClause.split(' ');
  if (words.length <= 9) return lowerFirst(firstClause);
  return lowerFirst(words.slice(0, 9).join(' '));
}

/**
 * A short noun phrase safe to inline mid-sentence, or null when the source is
 * too long to read naturally inside a template. Callers should fall back to a
 * template that does not need the subject rather than splicing in a whole
 * sentence — "I spent five years getting you keep becoming the person you're
 * trying to escape wrong" is what happens otherwise.
 */
export function shortSubject(text: string, maxWords = 6): string | null {
  const cleaned = text.trim().replace(/[.?!]+$/, '');
  if (!cleaned) return null;
  // The leading article is kept on purpose: stripping it turns "the third
  // week" into "Third Week", and every template that inlines it then reads
  // "The Case Against Third Week".
  const stripped = cleaned
    .replace(/^(you|i|we|they|he|she)\s+(keep|kept|are|is|was|were|will|would|should|can|could|don'?t|do|did|need|needed)\s+/i, '')
    .replace(/^(why|how|what|when)\s+/i, '');
  const words = stripped.split(/\s+/);
  if (words.length > maxWords) return null;
  return lowerFirst(stripped);
}

export const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
export const upperFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function titleCase(s: string): string {
  const small = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'but', 'is', 'you', 'your']);
  return s
    .split(' ')
    .map((w, i) => (i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : upperFirst(w)))
    .join(' ');
}

export const sentence = (s: string) => {
  const t = upperFirst(s.trim());
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

/**
 * Phrases that mark an idea as derivative. The engine is supposed to say so
 * rather than praise everything.
 */
export const CLICHE_PATTERNS: { pattern: RegExp; note: string }[] = [
  { pattern: /identity over discipline|discipline (isn'?t|is not) enough|you don'?t need (more )?discipline/i, note: 'The "identity over discipline" framing is everywhere. It needs a more precise personal argument to survive comparison.' },
  { pattern: /\b(the )?truth about\b/i, note: '"The truth about X" is a stock title shape. It promises revelation and usually delivers an opinion.' },
  { pattern: /\bchanged my life\b/i, note: '"Changed my life" is unfalsifiable and reads as filler.' },
  { pattern: /\b(secret|secrets|nobody tells you|no one talks about)\b/i, note: 'Secret-knowledge framing overpromises. If it is genuinely uncommon, show the evidence instead of claiming rarity.' },
  { pattern: /\bhabits? that\b|\b\d+ habits\b/i, note: 'Habit listicles are the most saturated shape in this space.' },
  { pattern: /\bmindset\b/i, note: '"Mindset" is doing a lot of unexamined work here. Name the specific belief.' },
  { pattern: /\bgame changer|next level|level up\b/i, note: 'Hype vocabulary. It does not sound like Corey.' },
  { pattern: /\b(ultimate|complete) guide\b/i, note: 'Guide framing sets an encyclopedic promise a single video cannot keep.' },
  { pattern: /\bwhy (you|we|most people) (are|keep|always|never)\b/i, note: 'This title shape is extremely common. The premise needs to be unusual to compensate.' },
  { pattern: /\bin 202\d\b/i, note: 'Year-stamping kills evergreen value for a marginal search bump.' },
  { pattern: /\byou'?re doing .* wrong\b/i, note: '"You\'re doing X wrong" is confrontational packaging on a claim that is usually softer than the title.' },
  { pattern: /\bi tried\b.*\bfor \d+ days\b/i, note: 'The "I tried X for N days" format is heavily worn. It needs a genuinely unexpected result.' },
  { pattern: /\beveryone|nobody|always|never\b/i, note: 'Absolute language. An intelligent skeptic will find the exception in the first comment.' },
];

export function clicheWarnings(...texts: string[]): string[] {
  const blob = texts.join(' ');
  const out: string[] = [];
  for (const { pattern, note } of CLICHE_PATTERNS) {
    if (pattern.test(blob) && !out.includes(note)) out.push(note);
  }
  return out;
}

let counter = 0;
export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

export const secondsToClock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Rough spoken-word timing: ~150 wpm. */
export const wordsToSeconds = (words: number) => Math.round((words / 150) * 60);
export const secondsToWords = (seconds: number) => Math.round((seconds / 60) * 150);
