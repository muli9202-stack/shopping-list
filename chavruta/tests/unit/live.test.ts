import { describe, expect, it } from 'vitest';
import { currentParasha, fetchRefText, loadCommentary, loadLinks, loadSection, resolveName, search } from '../../src/core/sefaria';

// Talks to the real Sefaria API. Runs only with LIVE=1 (npm run chavruta:live).
describe.skipIf(!process.env.LIVE)('live Sefaria', () => {
  it('opens a page outside the snapshot with focus, links and Tosafot', async () => {
    const s = await loadSection('Bava Metzia 21a:3');
    expect(s).toMatchObject({ ref: 'Bava Metzia 21a', kind: 'talmud', origin: 'sefaria', focus: { from: 3, to: 3 } });
    const links = await loadLinks(s);
    expect(links.some((l) => l.relation === 'commentary' && l.id === 'Rashi')).toBe(true);
    const tos = await loadCommentary('Tosafot', s);
    expect(tos.comments[0].ref).toMatch(/^Tosafot on Bava Metzia 21a:\d+:\d+$/);
  });
  it('resolves names, the weekly parasha and full-text search', async () => {
    expect(await resolveName('פרשת נח')).toMatchObject({ ref: 'Genesis 6:9-11:32' });
    const p = await currentParasha();
    const ps = await loadSection(p.ref);
    expect(ps.kind).toBe('tanakh');
    expect(ps.focus?.from).toBeGreaterThan(0);
    const hits = await search('כל הלילה כשר לקריאת המגילה', 4);
    expect(hits.length).toBeGreaterThan(0);
    expect((await fetchRefText(hits[0].ref)).text.length).toBeGreaterThan(10);
  });
});
