import { describe, expect, it } from 'vitest';

import { CHANNELS } from '../domain/channels';
import type { ContentProject } from '../domain/types';
import { localEngine } from './localEngine';
import { clicheWarnings, shortSubject } from './text';

const project = (over: Partial<ContentProject> & Pick<ContentProject, 'channelId'>): ContentProject => ({
  id: 'p1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  workingTitle: 'Test project',
  stage: 'packaging',
  priority: 'normal',
  concept: {
    coreArgument: '', viewerTransformation: '', startingBelief: '', endingBelief: '',
    personalStake: '', evidence: [], tension: '', counterargument: '', honestLimitation: '', memorableLine: '',
  },
  packaging: { titles: [], hooks: [], thumbnails: [], curiosityGaps: [], stakes: [], emotionalFraming: [] },
  script: { beats: [], estimatedDurationSeconds: 0, chapterMarkers: [] },
  production: [],
  brandAssociations: [],
  notes: '',
  effort: 'medium',
  contentValue: 50,
  viralityScore: 50,
  ...over,
});

describe('shortSubject', () => {
  it('returns null for a phrase too long to inline', () => {
    expect(shortSubject("You Keep Becoming the Person You're Trying to Escape")).toBeNull();
  });

  it('strips a leading pronoun-plus-verb', () => {
    expect(shortSubject('You keep avoiding hard conversations')).toBe('avoiding hard conversations');
  });

  it('keeps a short noun phrase', () => {
    expect(shortSubject('a failed breaker panel')).toBe('failed breaker panel');
  });
});

describe('packaging never splices a whole sentence into a title template', () => {
  it('produces ten readable titles from a long working title', async () => {
    const p = project({
      channelId: 'corey-williams',
      workingTitle: "You Keep Becoming the Person You're Trying to Escape",
      concept: {
        ...project({ channelId: 'corey-williams' }).concept,
        coreArgument:
          'People revert because the room still expects the old version of them, so new behaviour never gets reinforced.',
      },
    });
    const packaging = await localEngine.generatePackaging(p);

    expect(packaging.titles).toHaveLength(10);
    for (const t of packaging.titles) {
      // The specific mangling this guards against: a template verb followed by
      // the second-person opener of the working title.
      expect(t.text.toLowerCase()).not.toMatch(/getting you keep|fix you keep|half of you keep|behind you keep/);
      expect(t.text.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });

  it('still produces ten titles when nothing short can be extracted', async () => {
    const p = project({
      channelId: 'core-workshop',
      workingTitle:
        'Rebuilding The Completely Destroyed Distribution Panel That Somebody Wired Backwards Fifteen Years Ago',
    });
    const packaging = await localEngine.generatePackaging(p);
    expect(packaging.titles).toHaveLength(10);
    expect(new Set(packaging.titles.map((t) => t.text)).size).toBe(10);
  });

  it('generates five hooks and three thumbnail concepts with image prompts', async () => {
    const packaging = await localEngine.generatePackaging(project({ channelId: 'corey-williams' }));
    expect(packaging.hooks).toHaveLength(5);
    expect(packaging.thumbnails).toHaveLength(3);
    for (const t of packaging.thumbnails) {
      expect(t.imagePrompt.length).toBeGreaterThan(40);
      expect(t.imagePrompt).toMatch(/no text/i);
    }
  });
});

describe('the engine criticises rather than praises', () => {
  it('flags stock title shapes', () => {
    expect(clicheWarnings('The Truth About Discipline').length).toBeGreaterThan(0);
    expect(clicheWarnings('5 Habits That Changed My Life').length).toBeGreaterThan(0);
    expect(clicheWarnings("You Don't Need More Discipline").length).toBeGreaterThan(0);
  });

  it('leaves a specific, unusual title alone', () => {
    expect(clicheWarnings('Rewiring a 1962 Distribution Board Without Killing the Tenant')).toHaveLength(0);
  });

  it('warns when an idea has no grounding in stated experience', async () => {
    const ideas = await localEngine.generateIdeas({
      origin: 'focused',
      count: 3,
      context: {
        direction: {
          channelId: 'corey-williams',
          goals: ['authority'],
          audienceState: 'mixed',
          availableTimeMinutes: 300,
          availableMaterials: '',
          energy: 'medium',
          timeliness: 'evergreen',
          personalExperience: '', // nothing stated
          topic: 'discipline',
        },
        library: [],
        history: [],
        rejectionSignals: [],
        lessons: [],
      },
    });
    expect(ideas.length).toBe(3);
    expect(ideas.some((i) => i.originalityWarnings.some((w) => /library|lived|researched/i.test(w)))).toBe(true);
  });
});

describe('beat sheets follow the channel structure', () => {
  it('uses each channel’s own structure', async () => {
    for (const cid of ['corey-williams', 'core-workshop', 'cdogg', 'worlds-finest'] as const) {
      const beats = await localEngine.generateBeatSheet(project({ channelId: cid }));
      expect(beats.map((b) => b.role)).toEqual(CHANNELS[cid].scriptMode.structure);
    }
  });

  it('leaves at least one beat deliberately uncovered on an essay channel', async () => {
    const beats = await localEngine.generateBeatSheet(project({ channelId: 'corey-williams' }));
    const stillness = beats.filter((b) => b.tracks.bRoll.some((s) => s.treatment === 'no-b-roll'));
    expect(stillness.length).toBeGreaterThan(0);
  });

  it('leans on gameplay for CDogg', async () => {
    const beats = await localEngine.generateBeatSheet(project({ channelId: 'cdogg' }));
    expect(beats.filter((b) => b.visualTreatment === 'gameplay').length).toBeGreaterThan(0);
  });
});

describe('title delivery check', () => {
  it('fails a title the script never addresses', async () => {
    const p = project({ channelId: 'corey-williams' });
    p.packaging.titles = [
      {
        id: 't1', text: 'Rewiring a Distribution Board Safely', angle: 'search', score: 70, selected: true,
        checks: { clearPromise: true, curiosityGap: false, overpromises: false, soundsLikeCorey: true, concreteLanguage: true, interchangeable: false, notes: [] },
      },
    ];
    p.script.beats = [
      {
        id: 'b1', role: 'Opening', purpose: '', information: 'Identity and habits and reversion', emotion: '',
        visualTreatment: 'a-roll', durationSeconds: 60, transition: '', retentionRisk: 'low',
        tracks: { aRoll: '', bRoll: [], onScreenText: '', graphics: '', music: '', soundEffects: '', source: '', editingNote: '' },
      },
    ];
    const result = await localEngine.checkTitleDelivery(p);
    expect(result.delivered).toBe(false);
  });

  it('fails an overpromising title outright', async () => {
    const p = project({ channelId: 'corey-williams' });
    p.packaging.titles = [
      {
        id: 't1', text: 'Everything You Know About Habits Is Wrong', angle: 'contrarian', score: 30, selected: true,
        checks: { clearPromise: false, curiosityGap: true, overpromises: true, soundsLikeCorey: false, concreteLanguage: false, interchangeable: true, notes: [] },
      },
    ];
    const result = await localEngine.checkTitleDelivery(p);
    expect(result.delivered).toBe(false);
    expect(result.note).toMatch(/absolute language|narrow the title/i);
  });
});
