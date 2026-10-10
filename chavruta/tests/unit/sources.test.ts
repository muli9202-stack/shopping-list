import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expandAbbreviation, speakable } from '../../src/core/lexicon';
import { amudLabel, stepAmud } from '../../src/core/refs';
import { loadCommentary, loadSection, setOffline, splitDh } from '../../src/core/sefaria';
import { checkCitation, quoteAppearsIn } from '../../src/core/verify';
import { gematria, toHebrewNumeral, tokenize } from '../../src/core/hebrew';

// These tests run against the built-in snapshot (offline), so they are deterministic.
beforeAll(() => setOffline(true));
afterAll(() => setOffline(false));

describe('Hebrew numerals', () => {
  it('round-trips', () => {
    for (const n of [1, 2, 9, 10, 15, 16, 21, 64, 119, 176]) expect(gematria(toHebrewNumeral(n))).toBe(n);
    expect(toHebrewNumeral(15)).toBe('ט״ו');
    expect(toHebrewNumeral(2)).toBe('ב׳');
  });
  it('tokenizes with niqqud kept for display', () => {
    const t = tokenize('<big><strong>מֵאֵימָתַי</strong></big> קוֹרִין אֶת שְׁמַע');
    expect(t.filter((x) => !x.sep).map((x) => x.key)).toEqual(['מאימתי', 'קורינ', 'את', 'שמע']);
    expect(t.map((x) => x.text).join('')).toBe('מֵאֵימָתַי קוֹרִין אֶת שְׁמַע');
  });
});

describe('amudim', () => {
  it('steps a→b→next daf and stops at the edges', () => {
    expect(stepAmud('Berakhot 2a', 1)).toBe('Berakhot 2b');
    expect(stepAmud('Berakhot 2b', 1)).toBe('Berakhot 3a');
    expect(stepAmud('Berakhot 3a', -1)).toBe('Berakhot 2b');
    expect(stepAmud('Berakhot 2a', -1)).toBeNull();
    expect(stepAmud('Berakhot 64b', 1)).toBeNull();
    expect(amudLabel('2b')).toBe('דף ב׳ עמוד ב׳');
  });
});

describe('library (snapshot)', () => {
  it('loads Berakhot 2a and 2b as different texts', async () => {
    const a = await loadSection('Berakhot 2a');
    const b = await loadSection('Berakhot 2b');
    expect(a.ref).toBe('Berakhot 2a');
    expect(b.ref).toBe('Berakhot 2b');
    expect(a.origin).toBe('snapshot');
    expect(a.kind).toBe('talmud');
    expect(a.segments[0]).toContain('מֵאֵימָתַי');
    expect(b.segments[0]).not.toEqual(a.segments[0]);
    expect(a.version.license).toBe('CC-BY-NC');
  });

  it('opens a specific segment as focus inside its section', async () => {
    const s = await loadSection('Berakhot 2a:3');
    expect(s.ref).toBe('Berakhot 2a');
    expect(s.focus).toEqual({ from: 3, to: 3 });
  });

  it('ties each Rashi to the line it explains', async () => {
    const s = await loadSection('Berakhot 2a');
    const rashi = await loadCommentary('Rashi', s);
    const first = rashi.comments.filter((c) => c.segment === 1);
    expect(first.map((c) => c.ref)).toEqual(['Rashi on Berakhot 2a:1:1', 'Rashi on Berakhot 2a:1:2']);
    expect(first[1].dh).toBe('עד סוף האשמורה הראשונה');
    // Rashi has nothing on line 2 (וחכמים אומרים עד חצות)
    expect(rashi.comments.some((c) => c.segment === 2)).toBe(false);
    const tos = await loadCommentary('Tosafot', s);
    expect(tos.comments[0].ref).toBe('Tosafot on Berakhot 2a:1:1');
  });

  it('loads Mishnah and Torah commentaries', async () => {
    const m = await loadSection('Mishnah Berakhot 1:1');
    expect(m.kind).toBe('mishnah');
    const bart = await loadCommentary('Bartenura', m);
    expect(bart.comments[0].ref).toMatch(/^Bartenura on Mishnah Berakhot 1:1:1$/);
    const g = await loadSection('Genesis 1');
    expect(g.kind).toBe('tanakh');
    for (const c of ['Rashi', 'Ramban', 'Ibn Ezra', 'Sforno']) {
      const com = await loadCommentary(c, g);
      expect(com.comments.length).toBeGreaterThan(0);
    }
  });

  it('extracts דיבור המתחיל in both styles', () => {
    expect(splitDh('<b>מֵאֵימָתַי קוֹרִין</b>. מִשָּׁעָה').dh).toBe('מאימתי קורין');
    expect(splitDh('היכא קאי – מהיכא קא סליק').dh).toBe('היכא קאי');
  });
});

describe('verification', () => {
  it('accepts a real quote regardless of niqqud and rejects an invented one', () => {
    const src = 'מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בָּעֲרָבִין? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכוֹל בִּתְרוּמָתָן.';
    expect(quoteAppearsIn('משעה שהכהנים נכנסים', src)).toBe(true);
    expect(quoteAppearsIn('מאימתי קורין ... בתרומתן', src)).toBe(true);
    expect(quoteAppearsIn('משעה שהלויים נכנסים', src)).toBe(false);
  });

  it('checks a citation against the cited ref', async () => {
    expect((await checkCitation('Rashi on Berakhot 2a:1:2', 'שליש הלילה')).ok).toBe(true);
    const fake = await checkCitation('Rashi on Berakhot 2a:1:2', 'רביע הלילה');
    expect(fake).toMatchObject({ ok: false, reason: 'quote-not-found' });
  });
});

describe('abbreviations and speech', () => {
  it('expands by context', () => {
    expect(expandAbbreviation('ר"ת', '')?.text).toBe('רבינו תם');
    expect(expandAbbreviation('ר"א', 'דברי רבי אליעזר')?.text).toBe('רבי אליעזר');
    expect(expandAbbreviation('ר"א', 'אמר רבי אלעזר')?.text).toBe('רבי אלעזר');
    expect(expandAbbreviation('ר"י', '', 'rishonim')?.text).toBe('רבינו יצחק');
    const unsure = expandAbbreviation('ר"א', '');
    expect(unsure?.alternatives.length).toBeGreaterThan(0);
  });
  it('spells refs for the voice without touching the display text', () => {
    expect(speakable('פתחנו דף ב׳ עמוד א׳')).toContain('דף בֵּית עמוד אָלֶף');
    expect(speakable('נפתח את רש״י')).toContain('רַשִׁ"י');
  });
});
