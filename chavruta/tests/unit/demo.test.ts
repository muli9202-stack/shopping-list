import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO } from '../../src/brain/demoContent';
import { parseStepLine } from '../../src/brain/claude';
import { illustrationRefs } from '../../src/core/illustration';
import { setOffline } from '../../src/core/sefaria';
import { checkCitation } from '../../src/core/verify';

beforeAll(() => setOffline(true));
afterAll(() => setOffline(false));

// Every quote the demo chavruta says must appear, letter for letter, in the ref it cites.
describe('demo content is faithful to the sources', () => {
  for (const [ref, sec] of Object.entries(DEMO)) {
    const lines = [
      ...Object.values(sec.segments).flat(),
      ...sec.answers.flatMap((a) => a.lines),
      ...sec.glossary.filter((g) => g.cite).map((g) => ({ cite: g.cite, quote: g.quote, text: g.word })),
      ...sec.claims.map((c) => ({ cite: c.cite, quote: c.quote, text: c.whoHe })),
    ].filter((l) => l.cite);

    it.each(lines.map((l) => [l.cite!, l.quote ?? '', l.text]))(`${ref}: %s "%s"`, async (cite, quote) => {
      const r = await checkCitation(cite, quote || null);
      expect(r).toMatchObject({ ok: true });
    });

    it(`${ref}: every quote line has a quote to check`, () => {
      for (const l of Object.values(sec.segments).flat()) {
        if (l.kind === 'quote' || l.kind === 'commentator') expect(l.quote, l.text).toBeTruthy();
      }
    });

    it(`${ref}: illustration sources exist`, async () => {
      for (const il of Object.values(sec.illustrations)) {
        for (const r of illustrationRefs(il!)) expect((await checkCitation(r, null)).ok, r).toBe(true);
      }
    });
  }
});

describe('model output parsing', () => {
  it('reads JSON lines into steps', () => {
    expect(parseStepLine('{"t":"say","kind":"quote","text":"מאימתי","cite":"Berakhot 2a:1","quote":"מאימתי","hl":{"seg":1}}')).toEqual({
      t: 'say',
      kind: 'quote',
      text: 'מאימתי',
      cite: 'Berakhot 2a:1',
      quote: 'מאימתי',
      hl: { seg: 1, words: undefined },
    });
    expect(parseStepLine('{"t":"open_commentary","who":"Rashi"}')).toEqual({ t: 'open_commentary', who: 'Rashi' });
    expect(parseStepLine('{"t":"resume_pending"}')).toEqual({ t: 'resume_pending' });
  });
  it('speaks a stray Hebrew sentence as explanation and drops junk', () => {
    expect(parseStepLine('זה הסבר.')).toMatchObject({ t: 'say', kind: 'explain' });
    expect(parseStepLine('```json')).toBeNull();
    expect(parseStepLine('{"t":"say","text":""}')).toBeNull();
    expect(parseStepLine('{"t":"illustrate","spec":{"kind":"bogus"}}')).toBeNull();
  });
  it('validates illustrations', () => {
    const s = parseStepLine(
      JSON.stringify({ t: 'illustrate', spec: { kind: 'table', title: 'ש', columns: ['א', 'ב'], rows: [{ cells: ['1', '2', '3'] }], sources: [{ label: 'x', ref: 'Berakhot 2a:1' }] } }),
    );
    expect(s).toMatchObject({ t: 'illustrate', spec: { kind: 'table', rows: [{ cells: ['1', '2'] }] } });
  });
});
