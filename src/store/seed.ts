import { uid } from '../ai/text';
import type { LibraryEntry } from '../domain/types';

const entry = (e: Omit<LibraryEntry, 'id' | 'createdAt' | 'usedByProjectIds'>): LibraryEntry => ({
  id: uid('lib'),
  createdAt: new Date().toISOString(),
  usedByProjectIds: [],
  ...e,
});

/**
 * Starter library. These are prompts for Corey to replace with his own
 * material, not fabricated biography — each one is phrased as a slot to fill.
 */
export const seedLibrary = (): LibraryEntry[] => [
  entry({
    type: 'personal-story',
    title: 'The habit that survived and the three that did not',
    body: 'Placeholder: the specific period where one routine stuck and the others collapsed. Name the year, what changed in the environment, and what you told yourself at the time.',
    tags: ['identity', 'discipline', 'habits'],
    channelIds: ['corey-williams'],
    brandAssociations: ['Identity development', 'Discipline'],
    used: false,
    unresolved: true,
  }),
  entry({
    type: 'personal-story',
    title: 'The conversation I handled badly',
    body: 'Placeholder: a conflict where being right cost more than being wrong would have. Who was in the room, what was actually at stake, what you would say now.',
    tags: ['communication', 'conflict'],
    channelIds: ['corey-williams'],
    brandAssociations: ['Communication'],
    used: false,
    unresolved: true,
  }),
  entry({
    type: 'lesson',
    title: 'Diagnose before you replace',
    body: 'Placeholder: the job where guessing at the faulty component cost a second trip. The correct order of operations you use now.',
    tags: ['electrical', 'diagnosis', 'method'],
    channelIds: ['core-workshop'],
    brandAssociations: ['Electrical expertise', 'Practical problem-solving'],
    used: false,
  }),
  entry({
    type: 'build-project',
    title: 'Shop project buildable with tools already owned',
    body: 'Placeholder: the project on the list that needs no new purchases. List the stock and tools it uses.',
    tags: ['build', 'constraint'],
    channelIds: ['core-workshop'],
    brandAssociations: ['Engineering competence'],
    used: false,
    materialsOnHand: true,
  }),
  entry({
    type: 'gameplay-moment',
    title: 'Marvel Rivals — unused clutch clip',
    body: 'Placeholder: session date, timestamp, what happened, and why the read worked.',
    tags: ['marvel-rivals', 'clip'],
    channelIds: ['cdogg'],
    brandAssociations: ['Gaming personality'],
    used: false,
    source: 'Marvel Rivals',
  }),
  entry({
    type: 'movie-reaction',
    title: 'Comic adaptation watchlist',
    body: 'Placeholder: what is coming out, when, and whether you actually care. If you do not care, it does not go on the channel.',
    tags: ['watchlist'],
    channelIds: ['worlds-finest'],
    brandAssociations: ['Comic-book history and nostalgia'],
    used: false,
  }),
  entry({
    type: 'hook-pattern',
    title: 'Admission + withheld specific',
    body: 'Open by admitting a mistake you made for years, then withhold the small thing that finally changed it until after the title card.',
    tags: ['hook'],
    channelIds: [],
    brandAssociations: [],
    used: false,
  }),
  entry({
    type: 'framework',
    title: 'Belief → Action → Evidence loop',
    body: 'Identity produces behaviour; behaviour produces evidence; evidence reinforces identity. Changing behaviour without changing the evidence loop produces temporary compliance.',
    tags: ['framework', 'identity', 'systems'],
    channelIds: ['corey-williams'],
    brandAssociations: ['Identity development', 'Systems thinking'],
    used: false,
  }),
];
