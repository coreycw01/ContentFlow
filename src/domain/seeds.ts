/**
 * Seed banks.
 *
 * A seed is the single word or short phrase an idea grows from. Good seeds are
 * concrete and slightly uncomfortable — they name a thing, a moment or a
 * tension rather than a category. "Discipline" is a bad seed; "the third week"
 * is a good one, because there is only one honest video in it.
 *
 * Every seed here is channel-specific. Rolling a random seed on Core Workshop
 * must never hand you a comic-book prompt.
 */

import type { ChannelId } from './types';

export interface SeedGroup {
  label: string;
  seeds: string[];
}

export const SEED_BANK: Record<ChannelId, SeedGroup[]> = {
  'corey-williams': [
    {
      label: 'Moments',
      seeds: [
        'the third week',
        'the drive home after',
        'the conversation I rehearsed and still lost',
        'the morning I stopped counting',
        'the version of me my old friends still expect',
        'the promise I made at 2am',
        'the day the routine stopped working',
        'the room that expects the old me',
        'saying it out loud for the first time',
        'the apology that came four years late',
      ],
    },
    {
      label: 'Tensions',
      seeds: [
        'discipline that only works when nobody is watching',
        'being right and being useful',
        'wanting to change and wanting to be known',
        'the cost of a principle',
        'consistency versus honesty',
        'the identity you protect by failing',
        'advice that is true and useless',
        'the standard you hold others to',
        'quitting well versus quitting early',
        'privacy and accountability',
      ],
    },
    {
      label: 'Systems',
      seeds: [
        'feedback loops in a marriage',
        'the evidence your habits produce',
        'what your calendar actually believes',
        'default settings of a life',
        'compounding in decades',
        'the load-bearing habit',
        'friction as a design tool',
        'measuring the wrong thing on purpose',
      ],
    },
    {
      label: 'Fatherhood and legacy',
      seeds: [
        'what my kids will remember',
        'the thing I do that they will copy',
        'teaching a skill I only half have',
        'the body of work versus the highlight',
        'what I want said at the end',
        'inheriting a temperament',
      ],
    },
  ],

  'core-workshop': [
    {
      label: 'Failures',
      seeds: [
        'the burnt neutral',
        'the joint that looked fine',
        'a print that failed at 90%',
        'the tool that lied to me',
        'backfed breaker',
        'the wire nut nobody checked',
        'thermal runaway',
        'the bearing that sounded fine yesterday',
        'a torque spec ignored',
        'the ground that was not a ground',
      ],
    },
    {
      label: 'Techniques',
      seeds: [
        'crimp versus solder',
        'reading a panel schedule that lies',
        'setting first-layer height properly',
        'voltage drop over distance',
        'tapping a hole without snapping the tap',
        'measuring before you cut, twice',
        'load calculation from scratch',
        'annealing a printed part',
        'diagnosing intermittent faults',
        'bonding versus grounding',
      ],
    },
    {
      label: 'Builds',
      seeds: [
        'shop dust collection on a budget',
        'a jig that paid for itself',
        'printed replacement for a discontinued part',
        'a bench power supply from salvage',
        'automating one boring shop task',
        'a fixture that makes the next ten easier',
        'repairing something designed not to be repaired',
        'a robot arm that does one useful thing',
      ],
    },
    {
      label: 'Job site',
      seeds: [
        'the call-back I earned',
        'what the previous electrician left me',
        'quoting a job I did not understand',
        'working around a customer who is home',
        'the fix that was not the fix',
        'POV: opening a wall I did not want to open',
      ],
    },
  ],

  cdogg: [
    {
      label: 'Marvel Rivals',
      seeds: [
        'the clutch I do not deserve',
        'a hero I refuse to learn',
        'the team comp that should not work',
        'dying to the same thing four times',
        'reading the flank before it happens',
        'ranked at 2am',
        'the ult I saved too long',
        'countering my own main',
      ],
    },
    {
      label: 'Paralives',
      seeds: [
        'building a house I would actually live in',
        'the family that went off the rails',
        'furnishing one room for two hours',
        'a build with one weird constraint',
        'recreating my own house badly',
      ],
    },
    {
      label: 'Planetary Life',
      seeds: [
        'the ecosystem that collapsed',
        'optimising until it stopped being fun',
        'a species I accidentally doomed',
        'watching a simulation prove me wrong',
      ],
    },
    {
      label: 'Systems and reactions',
      seeds: [
        'why this mechanic feels good',
        'the hidden rule nobody reads',
        'a patch that changed everything quietly',
        'the tutorial that taught the wrong thing',
        'rage that turned into respect',
        'the run that went completely sideways',
        'first look, no research',
      ],
    },
  ],

  'worlds-finest': [
    {
      label: 'Reactions',
      seeds: [
        'what I expected versus what I got',
        'the scene that got me',
        'a casting choice I was wrong about',
        'the trailer beat that gave it away',
        'watching it with my kid',
        'the ending nobody is talking about',
      ],
    },
    {
      label: 'The page',
      seeds: [
        'the run this came from',
        'a comic that broke my brain at twelve',
        'the panel that lives in my head',
        'an adaptation that understood the source',
        'a character ruined by one decision',
        'back issues from the quarter bin',
      ],
    },
    {
      label: 'Does it hold up',
      seeds: [
        'rewatching it as an adult',
        'the sequel everyone forgot',
        'a movie I defended for years',
        'nostalgia versus the actual film',
      ],
    },
  ],
};

/** Flat list of every seed for a channel. */
export const seedsFor = (channelId: ChannelId): string[] =>
  SEED_BANK[channelId].flatMap((g) => g.seeds);

/**
 * Roll a random seed for a channel, avoiding anything already used. Returns
 * null only when every seed in the bank has been exhausted.
 */
export function rollSeed(channelId: ChannelId, exclude: string[] = []): string | null {
  const used = new Set(exclude.map((s) => s.trim().toLowerCase()));
  const pool = seedsFor(channelId).filter((s) => !used.has(s.toLowerCase()));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
