import { describe, expect, it } from 'vitest';

import { CHANNELS, CHANNEL_IDS, emptyScoreCard } from './channels';
import { assessCoreArgument, recordGate, scriptGate } from './readiness';
import { generateProductionTasks } from './production';
import { brandWarnings, channelHealth } from './brand';
import { rankingScore, recommend, scoreIdea, weightedScore } from './scoring';
import type { ContentProject, Idea, ScoreCard } from './types';

// ---------------------------------------------------------------------------
// helpers

const idea = (over: Partial<Idea> & Pick<Idea, 'channelId'>): Idea =>
  scoreIdea({
    id: Math.random().toString(36),
    createdAt: new Date().toISOString(),
    workingTitle: 'Untitled',
    premise: '',
    viewerProblem: '',
    corePromise: '',
    authorityBasis: '',
    emotionalAngle: '',
    channelFit: '',
    originalityWarnings: [],
    effort: 'medium',
    timeliness: 'evergreen',
    scores: emptyScoreCard(50),
    weightedScore: 0,
    viralityScore: 0,
    brandScore: 0,
    status: 'generated',
    origin: 'manual',
    ...over,
  } as Idea);

const project = (over: Partial<ContentProject> & Pick<ContentProject, 'channelId'>): ContentProject => ({
  id: 'p1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  workingTitle: 'Test project',
  stage: 'developing',
  priority: 'normal',
  concept: {
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

// ---------------------------------------------------------------------------

describe('channel doctrine is asymmetric', () => {
  it("weights World's Finest away from reach and toward genuine interest", () => {
    const wf = CHANNELS['worlds-finest'].weights;
    expect(wf.personalConnection).toBeGreaterThan(wf.searchPotential);
    expect(wf.personalConnection).toBeGreaterThan(wf.sharePotential);
    expect(wf.productionFeasibility).toBeGreaterThan(wf.originality);
  });

  it('weights Corey Williams toward credibility and away from upload simplicity', () => {
    const cw = CHANNELS['corey-williams'].weights;
    expect(cw.credibility).toBeGreaterThan(cw.productionFeasibility);
    expect(cw.brandValue).toBeGreaterThan(cw.searchPotential);
    expect(cw.personalConnection).toBeGreaterThan(cw.sharePotential);
  });

  it('weights Core Workshop toward demonstrable, searchable, credible work', () => {
    const cwk = CHANNELS['core-workshop'].weights;
    expect(cwk.credibility).toBeGreaterThan(cwk.emotionalTension);
    expect(cwk.visualPotential).toBeGreaterThan(cwk.emotionalTension);
    expect(cwk.searchPotential).toBeGreaterThan(cwk.sharePotential);
  });

  it('weights CDogg toward low friction and shareability', () => {
    const cd = CHANNELS.cdogg.weights;
    expect(cd.productionFeasibility).toBeGreaterThan(cd.credibility);
    expect(cd.sharePotential).toBeGreaterThan(cd.credibility);
  });

  it('gives the two rigorous channels the strongest gates', () => {
    expect(CHANNELS['corey-williams'].gates.requireCoreArgument).toBe(true);
    expect(CHANNELS['corey-williams'].gates.requireCounterargument).toBe(true);
    expect(CHANNELS['core-workshop'].gates.requireSafetyNote).toBe(true);
    expect(CHANNELS.cdogg.gates.requireCoreArgument).toBe(false);
    expect(CHANNELS['worlds-finest'].gates.requireCoreArgument).toBe(false);
  });

  it('exempts World’s Finest from every pressure mechanic', () => {
    const wf = CHANNELS['worlds-finest'].workspace.pressure;
    expect(wf.consistencyWarnings).toBe(false);
    expect(wf.overdueIndicators).toBe(false);
    expect(wf.cadenceTargetDays).toBeNull();
  });

  it('does not exempt the two priority channels from cadence', () => {
    for (const id of ['corey-williams', 'core-workshop'] as const) {
      expect(CHANNELS[id].workspace.pressure.cadenceTargetDays).toBeGreaterThan(0);
      expect(CHANNELS[id].workspace.pressure.overdueIndicators).toBe(true);
    }
  });
});

describe('virality never drives ranking on an advisory channel', () => {
  const highVirality: Partial<ScoreCard> = {
    curiosity: 95, sharePotential: 95, emotionalTension: 90, visualPotential: 90, clarity: 90, searchPotential: 90,
  };

  it("ignores virality entirely when ranking World's Finest ideas", () => {
    const viral = idea({
      channelId: 'worlds-finest',
      workingTitle: 'Viral one',
      scores: { ...emptyScoreCard(50), ...highVirality },
    });
    expect(viral.viralityScore).toBeGreaterThan(80);
    // Ranking equals the weighted score exactly — no virality contribution.
    expect(rankingScore(viral)).toBe(viral.weightedScore);
  });

  it('lets a genuinely wanted idea beat a more viral one on an advisory channel', () => {
    const wanted = idea({
      channelId: 'worlds-finest',
      workingTitle: 'The one he wants to make',
      scores: { ...emptyScoreCard(45), personalConnection: 95, emotionalTension: 92, productionFeasibility: 90 },
    });
    const viral = idea({
      channelId: 'worlds-finest',
      workingTitle: 'The clickable one',
      scores: { ...emptyScoreCard(45), ...highVirality, personalConnection: 30 },
    });
    expect(viral.viralityScore).toBeGreaterThan(wanted.viralityScore);
    expect(rankingScore(wanted)).toBeGreaterThan(rankingScore(viral));

    const rec = recommend([viral, wanted])!;
    expect(rec.winnerId).toBe(wanted.id);
    expect(rec.body).toMatch(/deliberately not a reason|not on a schedule/i);
  });

  it('does allow virality to contribute on CDogg', () => {
    const viral = idea({ channelId: 'cdogg', scores: { ...emptyScoreCard(50), ...highVirality } });
    expect(rankingScore(viral)).toBeGreaterThan(viral.weightedScore);
  });
});

describe('scoring reflects the channel, not a global notion of quality', () => {
  it('scores the same idea differently on different channels', () => {
    const scores: ScoreCard = {
      ...emptyScoreCard(50),
      credibility: 95,
      personalConnection: 95,
      productionFeasibility: 20,
      sharePotential: 20,
    };
    const cw = weightedScore('corey-williams', scores);
    const cd = weightedScore('cdogg', scores);
    expect(cw).toBeGreaterThan(cd);
  });
});

describe('the vague-argument gate', () => {
  it('rejects a topic phrase', () => {
    expect(assessCoreArgument('discipline and identity').vague).toBe(true);
  });

  it('rejects a question', () => {
    expect(assessCoreArgument('Why do people keep going back to old habits?').vague).toBe(true);
  });

  it('rejects abstraction soup', () => {
    const q = assessCoreArgument(
      'This video is about mindset and growth and how to improve your life and find success in everything',
    );
    expect(q.vague).toBe(true);
  });

  it('accepts a specific claim', () => {
    const q = assessCoreArgument(
      'People revert to old habits because the room still expects the old version of them, so the behaviour change never gets reinforced.',
    );
    expect(q.vague).toBe(false);
    expect(q.score).toBeGreaterThanOrEqual(55);
  });

  it('blocks scripting on Corey Williams and refuses to be overridden', () => {
    const gate = scriptGate(project({ channelId: 'corey-williams', concept: { ...project({ channelId: 'corey-williams' }).concept, coreArgument: 'identity stuff' } }));
    expect(gate.ok).toBe(false);
    expect(gate.overridable).toBe(false);
  });

  it('does not block scripting on CDogg', () => {
    const gate = scriptGate(project({ channelId: 'cdogg' }));
    expect(gate.ok).toBe(true);
  });

  it("does not block scripting on World's Finest", () => {
    const gate = scriptGate(project({ channelId: 'worlds-finest' }));
    expect(gate.ok).toBe(true);
  });
});

describe('Core Workshop safety gate', () => {
  it('blocks recording with no safety note anywhere', () => {
    const p = project({
      channelId: 'core-workshop',
      script: {
        beats: [
          {
            id: 'b1', role: 'Build process', purpose: '', information: 'Cut the panel to size', emotion: '',
            visualTreatment: 'project-closeup', durationSeconds: 60, transition: '', retentionRisk: 'low',
            tracks: { aRoll: '', bRoll: [], onScreenText: '', graphics: '', music: '', soundEffects: '', source: '', editingNote: '' },
          },
        ],
        estimatedDurationSeconds: 60,
        chapterMarkers: [],
      },
    });
    expect(recordGate(p).blockers.some((b) => /safety/i.test(b))).toBe(true);
  });

  it('passes once a safety beat exists', () => {
    const p = project({
      channelId: 'core-workshop',
      script: {
        beats: [
          {
            id: 'b1', role: 'Safety warning', purpose: '', information: 'Kill the breaker and verify dead', emotion: '',
            visualTreatment: 'a-roll', durationSeconds: 30, transition: '', retentionRisk: 'low',
            tracks: { aRoll: '', bRoll: [], onScreenText: '', graphics: '', music: '', soundEffects: '', source: '', editingNote: '' },
          },
        ],
        estimatedDurationSeconds: 30,
        chapterMarkers: [],
      },
    });
    expect(recordGate(p).blockers.some((b) => /safety/i.test(b))).toBe(false);
  });
});

describe('production tasks derive from the actual project', () => {
  const beat = (role: string, treatment: 'gameplay' | 'diagram' | 'a-roll') => ({
    id: role, role, purpose: '', information: '', emotion: '',
    visualTreatment: treatment as never, durationSeconds: 60, transition: '', retentionRisk: 'low' as const,
    tracks: {
      aRoll: '', bRoll: [{ id: `${role}_b`, treatment: treatment as never, description: 'x', alreadyHave: false }],
      onScreenText: '', graphics: '', music: '', soundEffects: '', source: '', editingNote: '',
    },
  });

  it('adds gameplay tasks only when a beat uses gameplay', () => {
    const withGameplay = generateProductionTasks(
      project({ channelId: 'cdogg', script: { beats: [beat('Cold open', 'gameplay')], estimatedDurationSeconds: 60, chapterMarkers: [] } }),
    );
    expect(withGameplay.some((t) => /gameplay/i.test(t.label))).toBe(true);

    const withoutGameplay = generateProductionTasks(
      project({ channelId: 'corey-williams', script: { beats: [beat('Opening', 'a-roll')], estimatedDurationSeconds: 60, chapterMarkers: [] } }),
    );
    expect(withoutGameplay.some((t) => /gameplay/i.test(t.label))).toBe(false);
  });

  it('adds a safety task on Core Workshop and not on Corey Williams', () => {
    const cwk = generateProductionTasks(project({ channelId: 'core-workshop' }));
    expect(cwk.some((t) => /safety/i.test(t.label))).toBe(true);
    const cw = generateProductionTasks(project({ channelId: 'corey-williams' }));
    expect(cw.some((t) => /safety/i.test(t.label))).toBe(false);
  });

  it('adds a diagram task when a beat needs one', () => {
    const tasks = generateProductionTasks(
      project({ channelId: 'corey-williams', script: { beats: [beat('Framework', 'diagram')], estimatedDurationSeconds: 60, chapterMarkers: [] } }),
    );
    expect(tasks.some((t) => /diagram/i.test(t.label))).toBe(true);
  });
});

describe('brand warning system', () => {
  const old = new Date(Date.now() - 400 * 86400000).toISOString();

  it("warns when World's Finest starts looking like work", () => {
    const warnings = brandWarnings(
      [project({ channelId: 'worlds-finest', targetPublishDate: '2026-09-01' })],
      [],
    );
    expect(warnings.some((w) => w.id === 'wf-obligation')).toBe(true);
  });

  it("never raises a neglect warning for World's Finest", () => {
    const warnings = brandWarnings(
      [project({ channelId: 'worlds-finest', stage: 'published', publishedAt: old })],
      [],
    );
    expect(warnings.some((w) => w.id === 'neglect_worlds-finest')).toBe(false);
  });

  it('does raise a neglect warning for a stale priority channel', () => {
    const warnings = brandWarnings(
      [project({ channelId: 'corey-williams', stage: 'published', publishedAt: old })],
      [],
    );
    expect(warnings.some((w) => w.id === 'neglect_corey-williams')).toBe(true);
  });

  it('flags a title that overpromises', () => {
    const p = project({ channelId: 'corey-williams' });
    p.packaging.titles = [
      {
        id: 't1', text: 'Everything you know is wrong', angle: 'contrarian', score: 40, selected: true,
        checks: { clearPromise: false, curiosityGap: true, overpromises: true, soundsLikeCorey: false, concreteLanguage: false, interchangeable: true, notes: [] },
      },
    ];
    expect(brandWarnings([p], []).some((w) => w.id.startsWith('overpromise_'))).toBe(true);
  });
});

describe('channel health', () => {
  it("never reports World's Finest as overdue", () => {
    const health = channelHealth([
      project({ channelId: 'worlds-finest', stage: 'published', publishedAt: new Date(Date.now() - 500 * 86400000).toISOString() }),
    ]);
    const wf = health.find((h) => h.channelId === 'worlds-finest')!;
    expect(wf.pressureExempt).toBe(true);
    expect(wf.status).not.toMatch(/overdue/i);
  });

  it('reports every channel', () => {
    expect(channelHealth([]).map((h) => h.channelId).sort()).toEqual(CHANNEL_IDS.slice().sort());
  });
});
