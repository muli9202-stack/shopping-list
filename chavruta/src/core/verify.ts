// Checks the chavruta's claims before they are spoken: a cited ref must exist, a quote must
// appear letter for letter (niqqud aside) in the text it is attributed to.
import { norm } from './hebrew';
import { fetchRefText, SourceError } from './sefaria';

export interface QuoteCheck {
  ok: boolean;
  reason?: 'quote-not-found' | 'ref-not-found' | 'offline';
  /** The source text the quote was checked against (plain letters). */
  sourceText?: string;
  heRef?: string;
}

/**
 * True when every part of the quote (split on "..." / "וכו'") appears in the source, in order.
 * Comparison ignores niqqud, punctuation and final-letter forms, nothing else.
 */
export function quoteAppearsIn(quote: string, source: string): boolean {
  const parts = quote
    .split(/\.\.\.|…|וכו['׳]?/)
    .map((p) => norm(p))
    .filter((p) => p.length >= 2);
  if (!parts.length) return false;
  const hay = norm(source);
  let from = 0;
  for (const p of parts) {
    const at = hay.indexOf(p, from);
    if (at < 0) return false;
    from = at + p.length;
  }
  return true;
}

/** Checks a quote against a ref the chavruta cited, fetching the ref's text if needed. */
export async function checkCitation(ref: string, quote: string | null, known?: Map<string, string>): Promise<QuoteCheck> {
  let text = known?.get(ref);
  let heRef: string | undefined;
  if (text === undefined) {
    try {
      const r = await fetchRefText(ref);
      text = r.text;
      heRef = r.heRef;
      known?.set(ref, text);
    } catch (e) {
      if (e instanceof SourceError && e.reason === 'offline') return { ok: false, reason: 'offline' };
      return { ok: false, reason: 'ref-not-found' };
    }
  }
  if (!text) return { ok: false, reason: 'ref-not-found' };
  if (quote && !quoteAppearsIn(quote, text)) return { ok: false, reason: 'quote-not-found', sourceText: text, heRef };
  return { ok: true, sourceText: text, heRef };
}
