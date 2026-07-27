import { describe, expect, it } from 'vitest';

import { CHANNELS, CHANNEL_IDS } from './channels';
import { normaliseGoogleDocUrl, scanScript } from './scriptScan';
import { SEED_BANK, rollSeed, seedsFor } from './seeds';

describe('script scanner', () => {
  it('finds bracketed markers of every kind', () => {
    const { assets, counts } = scanScript(`
I spent five years getting this wrong.
[IMAGE: burnt breaker, macro]
[B-ROLL: morning routine footage]
[GRAPHIC: belief loop diagram]
[SCREEN: multimeter reading]
[GAMEPLAY: clutch at 4:12]
[SOURCE: NEC 210.8]
[TODO: find the exact date]
`);
    expect(counts.image).toBe(1);
    expect(counts['b-roll']).toBe(1);
    expect(counts.graphic).toBe(1);
    expect(counts['screen-recording']).toBe(1);
    expect(counts.gameplay).toBe(1);
    expect(counts.source).toBe(1);
    expect(counts.placeholder).toBe(1);
    expect(assets).toHaveLength(7);
  });

  it('accepts loose notation', () => {
    const { assets } = scanScript(`
[IMG - burnt neutral]
[BROLL morning walk]
B-ROLL: the drive home
[Personal story placeholder: the year it happened]
`);
    const kinds = assets.map((a) => a.kind).sort();
    expect(kinds).toEqual(['b-roll', 'b-roll', 'image', 'placeholder']);
    expect(assets.find((a) => a.description === 'the drive home')).toBeTruthy();
  });

  it('records the line number so a marker can be found again', () => {
    const { assets } = scanScript('line one\nline two\n[IMAGE: a thing]');
    expect(assets[0].line).toBe(3);
  });

  it('does not treat ordinary prose as a marker', () => {
    const { assets } = scanScript(
      'The source of the problem was structural. My image of myself was wrong. I had a clip in mind.',
    );
    expect(assets).toHaveLength(0);
  });

  it('deduplicates identical requests', () => {
    const { assets } = scanScript('[B-ROLL: morning routine]\nlater\n[B-ROLL: morning routine]');
    expect(assets).toHaveLength(1);
  });

  it('writes an image prompt for image and graphic kinds only', () => {
    const { assets } = scanScript('[IMAGE: a mirror]\n[GRAPHIC: a loop]\n[B-ROLL: a walk]\n[SOURCE: a book]');
    const byKind = Object.fromEntries(assets.map((a) => [a.kind, a]));
    expect(byKind.image.imagePrompt).toMatch(/no text/);
    expect(byKind.graphic.imagePrompt).toMatch(/diagram/);
    expect(byKind['b-roll'].imagePrompt).toBeUndefined();
    expect(byKind.source.imagePrompt).toBeUndefined();
  });

  it('preserves status and links across a rescan', () => {
    const first = scanScript('[B-ROLL: morning routine]\n[IMAGE: a mirror]');
    const marked = first.assets.map((a) =>
      a.kind === 'b-roll' ? { ...a, status: 'have' as const, linkedEntryId: 'lib_1' } : a,
    );

    // The script grows; the earlier marks must survive.
    const second = scanScript('[B-ROLL: morning routine]\n[IMAGE: a mirror]\n[GRAPHIC: new thing]', marked);
    const broll = second.assets.find((a) => a.kind === 'b-roll')!;
    expect(broll.status).toBe('have');
    expect(broll.linkedEntryId).toBe('lib_1');
    expect(broll.id).toBe(marked.find((a) => a.kind === 'b-roll')!.id);
    expect(second.assets).toHaveLength(3);
  });

  it('returns nothing for an empty script', () => {
    expect(scanScript('').assets).toHaveLength(0);
  });
});

describe('Google Docs link handling', () => {
  it('normalises a share link to the canonical edit URL', () => {
    const r = normaliseGoogleDocUrl('https://docs.google.com/document/d/ABC123_x-y/edit?usp=sharing');
    expect(r).toEqual({ url: 'https://docs.google.com/document/d/ABC123_x-y/edit' });
  });

  it('accepts a link without a scheme', () => {
    const r = normaliseGoogleDocUrl('docs.google.com/document/d/ABC123/edit');
    expect('url' in r && r.url).toContain('/document/d/ABC123/edit');
  });

  it('rejects a non-Google URL', () => {
    expect(normaliseGoogleDocUrl('https://example.com/document/d/ABC/edit')).toHaveProperty('error');
  });

  it('rejects a Google URL that is not a document', () => {
    expect(normaliseGoogleDocUrl('https://drive.google.com/drive/folders/XYZ')).toHaveProperty('error');
  });

  it('allows clearing the field', () => {
    expect(normaliseGoogleDocUrl('  ')).toEqual({ url: '' });
  });
});

describe('seed banks are channel-specific', () => {
  it('gives every channel its own seeds', () => {
    for (const id of CHANNEL_IDS) {
      expect(seedsFor(id).length).toBeGreaterThan(10);
    }
  });

  it('never shares a seed between channels', () => {
    const seen = new Map<string, string>();
    for (const id of CHANNEL_IDS) {
      for (const s of seedsFor(id)) {
        const prior = seen.get(s.toLowerCase());
        expect(prior, `"${s}" appears on both ${prior} and ${id}`).toBeUndefined();
        seen.set(s.toLowerCase(), id);
      }
    }
  });

  it('rolls a seed belonging to the requested channel', () => {
    for (const id of CHANNEL_IDS) {
      const rolled = rollSeed(id)!;
      expect(seedsFor(id)).toContain(rolled);
    }
  });

  it('never repeats a seed already used', () => {
    const all = seedsFor('cdogg');
    // Exclude everything but one; the roll must return that one.
    const target = all[3];
    const rolled = rollSeed('cdogg', all.filter((s) => s !== target));
    expect(rolled).toBe(target);
  });

  it('returns null when the bank is exhausted rather than repeating', () => {
    expect(rollSeed('worlds-finest', seedsFor('worlds-finest'))).toBeNull();
  });

  it('groups seeds under labels that match the channel world', () => {
    expect(SEED_BANK['core-workshop'].map((g) => g.label)).toContain('Failures');
    expect(SEED_BANK.cdogg.map((g) => g.label)).toContain('Marvel Rivals');
    expect(SEED_BANK['worlds-finest'].map((g) => g.label)).toContain('The page');
  });
});

describe('each channel is a different workspace', () => {
  it('gives every channel its own home panels', () => {
    const layouts = CHANNEL_IDS.map((id) => CHANNELS[id].workspace.homePanels.join(','));
    expect(new Set(layouts).size).toBe(CHANNEL_IDS.length);
  });

  it('uses the channel’s own vocabulary for a project', () => {
    expect(CHANNELS['corey-williams'].workspace.projectNoun).toBe('essay');
    expect(CHANNELS['core-workshop'].workspace.projectNoun).toBe('build');
    expect(CHANNELS['worlds-finest'].workspace.projectNoun).toBe('reaction');
  });

  it("keeps World's Finest free of any counting or queueing panel", () => {
    const panels = CHANNELS['worlds-finest'].workspace.homePanels;
    expect(panels).not.toContain('legacy');
    expect(panels).not.toContain('lessons');
    expect(panels).not.toContain('build-queue');
    expect(panels).toContain('quick-reaction');
  });

  it('gives Core Workshop a safety panel and nobody else', () => {
    for (const id of CHANNEL_IDS) {
      const hasSafety = CHANNELS[id].workspace.homePanels.includes('safety');
      expect(hasSafety).toBe(id === 'core-workshop');
    }
  });

  it('gives every channel quick actions and a seed placeholder', () => {
    for (const id of CHANNEL_IDS) {
      expect(CHANNELS[id].workspace.quickActions.length).toBeGreaterThan(0);
      expect(CHANNELS[id].seedPlaceholder.length).toBeGreaterThan(10);
    }
  });
});
