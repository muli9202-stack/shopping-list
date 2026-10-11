// The offline library that ships with the Artifact version (built by scripts/build-library.mjs):
// all of Bavli with Rashi and Tosafot, all of Mishnah with Bartenura, the whole Tanakh, and the
// main commentaries on the Torah. Books are fetched on demand from files published next to the
// page and turned into the same shape the Sefaria API returns, so the rest of the app is unchanged.
import { toHebrewNumeral } from './hebrew';
import { parseAmud, splitRef, stepAmud } from './refs';

export interface LibraryBook {
  file: string;
  he: string;
  categories: string[];
  sectionNames: string[];
  base: string | null;
  collective: string | null;
  versions: { title: string; heTitle: string; license: string }[];
  length: number;
}

export interface LibraryIndex {
  builtAt: string;
  source: string;
  books: Record<string, LibraryBook>;
}

let indexPromise: Promise<LibraryIndex | null> | null = null;
const books = new Map<string, Promise<unknown[]>>();

/** The library's table of contents, or null when this build has no library next to it. */
export function libraryIndex(): Promise<LibraryIndex | null> {
  indexPromise ??= fetch('lib/index.json')
    .then((r) => (r.ok ? (r.json() as Promise<LibraryIndex>) : null))
    .catch(() => null);
  return indexPromise;
}

async function gunzipIfNeeded(buf: ArrayBuffer): Promise<string> {
  const head = new Uint8Array(buf, 0, 2);
  if (head[0] === 0x1f && head[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }
  return new TextDecoder().decode(buf);
}

function loadBook(title: string, file: string): Promise<unknown[]> {
  if (!books.has(title)) {
    books.set(
      title,
      fetch(`lib/${file}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.arrayBuffer();
        })
        .then(gunzipIfNeeded)
        .then((t) => JSON.parse(t) as unknown[])
        .catch((e) => {
          books.delete(title);
          throw e;
        }),
    );
  }
  return books.get(title)!;
}

const isTalmud = (b: LibraryBook) => b.sectionNames[0] === 'Daf';

/** Array index of a top-level section: "2a" → 2, "2b" → 3 (Daf arrays start at 1a); "3" → 2. */
function sectionIndex(b: LibraryBook, s: string): number {
  if (isTalmud(b)) {
    const p = parseAmud(s);
    return p ? (p.daf - 1) * 2 + (p.amud === 'a' ? 0 : 1) : -1;
  }
  return Number(s) - 1;
}

function sectionName(b: LibraryBook, i: number): string {
  return isTalmud(b) ? `${Math.floor(i / 2) + 1}${i % 2 ? 'b' : 'a'}` : String(i + 1);
}

function sectionHe(b: LibraryBook, s: string): string {
  if (isTalmud(b)) {
    const p = parseAmud(s);
    return p ? `${toHebrewNumeral(p.daf)} ${p.amud === 'a' ? 'א' : 'ב'}` : s;
  }
  return toHebrewNumeral(Number(s));
}

const hasText = (t: unknown): boolean => (Array.isArray(t) ? t.some(hasText) : typeof t === 'string' && t.trim().length > 0);

/** Next or previous section that has text. */
function neighbour(title: string, b: LibraryBook, text: unknown[], i: number, dir: 1 | -1): string | null {
  if (isTalmud(b) && !b.base) {
    const ref = stepAmud(`${title} ${sectionName(b, i)}`, dir);
    return ref;
  }
  for (let j = i + dir; j >= 0 && j < text.length; j += dir) if (hasText(text[j])) return `${title} ${sectionName(b, j)}`;
  return null;
}

export interface LibraryText {
  ref: string;
  heRef: string;
  indexTitle: string;
  heIndexTitle: string;
  categories: string[];
  sectionNames: string[];
  next: string | null;
  prev: string | null;
  text: unknown;
  sectionRef: string;
  sections: string[];
  toSections: string[];
  version: { title: string; heTitle: string; license: string; source: string };
}

/**
 * A ref from the library, in the Sefaria API's shape. Handles a book ("Berakhot" → its first
 * section), a section ("Berakhot 2a"), a segment ("Berakhot 2a:3", "Rashi on Berakhot 2a:1:2")
 * and a range inside one section ("Genesis 1:3-5"). Returns null when the book is not in the library.
 */
export async function libraryText(ref: string): Promise<LibraryText | null> {
  const idx = await libraryIndex();
  if (!idx) return null;
  const range = ref.match(/^(.*?)-(\d+[ab]?(?::\d+)*)$/);
  const startRef = range ? range[1] : ref;
  let { book, sections } = splitRef(startRef);
  let b = idx.books[book];
  if (!b && idx.books[startRef]) {
    book = startRef;
    sections = [];
    b = idx.books[book];
  }
  if (!b) return null;
  const text = await loadBook(book, b.file);
  if (!sections.length) {
    const first = text.findIndex(hasText);
    sections = [sectionName(b, Math.max(0, first))];
  }
  const si = sectionIndex(b, sections[0]);
  if (si < 0 || si >= text.length || !hasText(text[si])) return null;
  let part: unknown = text[si];
  for (const s of sections.slice(1)) part = Array.isArray(part) ? part[Number(s) - 1] : undefined;
  if (part === undefined) return null;
  const sectionRef = `${book} ${sections[0]}`;
  const toSections = range ? [...sections.slice(0, sections.length - range[2].split(':').length), ...range[2].split(':')] : sections;
  const v = b.versions;
  return {
    ref: `${book} ${sections.join(':')}`,
    heRef: `${b.he} ${sectionHe(b, sections[0])}${sections.length > 1 ? `:${sections.slice(1).map((n) => toHebrewNumeral(Number(n))).join(':')}` : ''}`,
    indexTitle: book,
    heIndexTitle: b.he,
    categories: b.categories,
    sectionNames: b.sectionNames,
    next: neighbour(book, b, text, si, 1),
    prev: neighbour(book, b, text, si, -1),
    text: range && sections.length > 1 && Array.isArray(text[si]) ? (text[si] as unknown[]) : part,
    sectionRef,
    sections,
    toSections,
    version: {
      title: v.map((x) => x.title).join(' + ') || 'Sefaria',
      heTitle: v.map((x) => x.heTitle || x.title).join(' + '),
      license: [...new Set(v.map((x) => x.license || 'unknown'))].join(', '),
      source: 'ספריא (עותק מקומי)',
    },
  };
}

/** Finds a book by its Hebrew name ("ירושלמי" is not included; Bavli, Mishnah and Tanakh are). */
export async function libraryBookByHebrew(he: string): Promise<string | null> {
  const idx = await libraryIndex();
  if (!idx) return null;
  const want = he.replace(/[״"׳']/g, '').trim();
  const hit = Object.entries(idx.books).find(([, b]) => b.he.replace(/[״"׳']/g, '') === want);
  return hit?.[0] ?? null;
}
