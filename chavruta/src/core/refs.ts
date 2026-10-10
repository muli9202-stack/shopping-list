// Source references: what to open, how to name it in Hebrew, and how to move between amudim.
import { toHebrewNumeral } from './hebrew';
import { TANAKH, TRACTATES, type TextKind } from './lexicon';

export type Amud = 'a' | 'b';

export type Target =
  | { kind: 'talmud'; tractate: string; daf: number; amud: Amud; line?: number }
  | { kind: 'mishnah'; tractate: string; perek: number; mishnah?: number }
  | { kind: 'tanakh'; book: string; chapter: number; verse?: number }
  /** Anything else (Yerushalmi, Tosefta, Rambam, parasha names…): resolved through Sefaria's name API. */
  | { kind: 'name'; text: string }
  | { kind: 'parasha'; name: 'current' };

/** The Sefaria ref to request for a target ("Berakhot 2a:3", "Mishnah Berakhot 1:2", "Genesis 1:5"). */
export function targetToSefaria(t: Target): string | null {
  switch (t.kind) {
    case 'talmud': {
      const tr = TRACTATES.find((x) => x.bavli === t.tractate);
      return `${tr?.bavli ?? t.tractate} ${t.daf}${t.amud}${t.line ? `:${t.line}` : ''}`;
    }
    case 'mishnah':
      return `${t.tractate} ${t.perek}${t.mishnah ? `:${t.mishnah}` : ''}`;
    case 'tanakh':
      return `${t.book} ${t.chapter}${t.verse ? `:${t.verse}` : ''}`;
    default:
      return null;
  }
}

/** Hebrew name for a target, for confirmations before the text arrives. */
export function targetToHebrew(t: Target): string {
  switch (t.kind) {
    case 'talmud': {
      const tr = TRACTATES.find((x) => x.bavli === t.tractate);
      return `${tr?.he ?? t.tractate} דף ${toHebrewNumeral(t.daf)} עמוד ${t.amud === 'a' ? 'א׳' : 'ב׳'}`;
    }
    case 'mishnah': {
      const tr = TRACTATES.find((x) => x.mishnah === t.tractate);
      return `משנה ${tr?.he ?? t.tractate} פרק ${toHebrewNumeral(t.perek)}${t.mishnah ? ` משנה ${toHebrewNumeral(t.mishnah)}` : ''}`;
    }
    case 'tanakh': {
      const b = TANAKH.find((x) => x.sefaria === t.book);
      return `${b?.he ?? t.book} פרק ${toHebrewNumeral(t.chapter)}${t.verse ? ` פסוק ${toHebrewNumeral(t.verse)}` : ''}`;
    }
    case 'parasha':
      return 'פרשת השבוע';
    case 'name':
      return t.text;
  }
}

export function kindOf(categories: string[] | undefined, indexTitle = ''): TextKind {
  const c = categories ?? [];
  if (c[0] === 'Talmud' && c[1] === 'Bavli') return 'talmud';
  if (c[0] === 'Mishnah' || indexTitle === 'Pirkei Avot') return 'mishnah';
  if (c[0] === 'Tanakh') return 'tanakh';
  return 'other';
}

const AMUD_RE = /^(\d+)([ab])$/;

/** "Berakhot 2a" → "Berakhot 2b"; "Berakhot 2b" → "Berakhot 3a". Null past the end of the tractate or before 2a. */
export function stepAmud(sectionRef: string, dir: 1 | -1): string | null {
  const m = sectionRef.match(/^(.*) (\d+[ab])$/);
  if (!m) return null;
  const [, book, daf] = m;
  const dm = daf.match(AMUD_RE)!;
  let n = Number(dm[1]);
  let a = dm[2] as Amud;
  if (dir === 1) {
    if (a === 'a') a = 'b';
    else {
      a = 'a';
      n++;
    }
  } else if (a === 'b') a = 'a';
  else {
    a = 'b';
    n--;
  }
  if (n < 2) return null;
  const last = TRACTATES.find((t) => t.bavli === book)?.lastDaf;
  if (last && n > last) return null;
  return `${book} ${n}${a}`;
}

/** Parses Sefaria's "2a"/"2b" section names. */
export function parseAmud(section: string): { daf: number; amud: Amud } | null {
  const m = section.match(AMUD_RE);
  return m ? { daf: Number(m[1]), amud: m[2] as Amud } : null;
}

/** Hebrew label for a Talmud amud from a Sefaria section ("2a" → "ב׳ עמוד א׳"), to double-check a/b on screen. */
export function amudLabel(section: string): string {
  const p = parseAmud(section);
  if (!p) return section;
  return `דף ${toHebrewNumeral(p.daf)} עמוד ${p.amud === 'a' ? 'א׳' : 'ב׳'}`;
}

/** Splits "Rashi on Berakhot 2a:1:2" into its parts. */
export function splitRef(ref: string): { book: string; sections: string[] } {
  const m = ref.match(/^(.*?) ((?:\d+[ab]?)(?::\d+)*)(?:-.*)?$/);
  if (!m) return { book: ref, sections: [] };
  return { book: m[1], sections: m[2].split(':') };
}
