// Source library client. Sefaria's public API is the primary source (texts, commentary links,
// name resolution, search, calendars). When the network is down, the built-in snapshot
// (src/data/snapshot.json) serves the demo study set, clearly marked as such.
import snapshotJson from '../data/snapshot.json';
import { plain } from './hebrew';
import { COMMENTATORS, type TextKind } from './lexicon';
import { kindOf, splitRef } from './refs';
import { libraryText } from './library';
import { IS_ARTIFACT } from '../env';

const API = 'https://www.sefaria.org/api';

export interface Version {
  title: string;
  heTitle: string;
  license: string;
  source: string;
}

/** sefaria: live API; library: the offline library shipped with the Artifact; snapshot: the small built-in set. */
export type Origin = 'sefaria' | 'library' | 'snapshot';

export interface Section {
  /** Sefaria section ref: "Berakhot 2a", "Mishnah Berakhot 1", "Genesis 1". */
  ref: string;
  heRef: string;
  book: string;
  heBook: string;
  kind: TextKind;
  categories: string[];
  sectionNames: string[];
  segments: string[];
  version: Version;
  next: string | null;
  prev: string | null;
  /** 1-based segment range the request pointed at (a mishnah, a verse, a parasha's start). */
  focus?: { from: number; to: number };
  origin: Origin;
}

export interface Comment {
  /** Exact ref of this comment, e.g. "Rashi on Berakhot 2a:1:2". */
  ref: string;
  /** 1-based segment of the base text it comments on. */
  segment: number;
  index: number;
  text: string;
  /** דיבור המתחיל, when the comment has one. */
  dh: string | null;
}

export interface Commentary {
  id: string;
  he: string;
  /** Sefaria index, e.g. "Rashi on Berakhot". */
  index: string;
  ref: string;
  baseRef: string;
  comments: Comment[];
  version: Version;
  origin: Origin;
}

interface RawText {
  ref: string;
  heRef: string;
  indexTitle: string;
  heIndexTitle: string;
  categories: string[];
  sectionNames: string[];
  next: string | null;
  prev: string | null;
  text: unknown;
  version: Version;
  sectionRef?: string;
  sections?: (string | number)[];
  toSections?: (string | number)[];
  firstAvailableSectionRef?: string;
}

const snapshot = snapshotJson as unknown as { fetchedAt: string; texts: Record<string, RawText> };
export const SNAPSHOT_DATE = snapshot.fetchedAt;
export const SNAPSHOT_REFS = Object.keys(snapshot.texts);

export class SourceError extends Error {
  constructor(
    message: string,
    readonly reason: 'offline' | 'not-found' | 'no-hebrew',
  ) {
    super(message);
  }
}

const cache = new Map<string, Promise<RawText & { origin: Origin }>>();

/** For tests: makes every network call fail as if the device were offline. */
let forcedOffline = false;
export function setOffline(v: boolean) {
  forcedOffline = v;
  cache.clear();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  if (forcedOffline || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    throw new SourceError('אין חיבור לאינטרנט', 'offline');
  }
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new SourceError('אין חיבור לספריא', 'offline');
  }
  if (res.status === 404) throw new SourceError('המקור לא נמצא', 'not-found');
  if (!res.ok) throw new SourceError(`ספריא החזירה שגיאה ${res.status}`, 'offline');
  return res.json() as Promise<T>;
}

interface ApiText {
  ref: string;
  heRef: string;
  indexTitle: string;
  heIndexTitle: string;
  categories: string[];
  sectionNames: string[];
  next: string | null;
  prev: string | null;
  sectionRef: string;
  sections: (string | number)[];
  toSections: (string | number)[];
  firstAvailableSectionRef?: string;
  versions: { text: unknown; versionTitle: string; versionTitleInHebrew?: string; license: string; versionSource?: string }[];
  error?: string;
}

/** Raw text for a ref, from Sefaria or (offline) the snapshot. */
export function getRaw(ref: string): Promise<RawText & { origin: Origin }> {
  const key = ref;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        // The Artifact cannot reach Sefaria; it reads from the library published next to it.
        if (IS_ARTIFACT) {
          const lib = await libraryText(ref).catch(() => null);
          if (lib) return { ...lib, origin: 'library' as const };
        }
        try {
          const d = await fetchJson<ApiText>(`${API}/v3/texts/${encodeURIComponent(ref)}?version=hebrew`);
          if (d.error) throw new SourceError(d.error, 'not-found');
          const v = d.versions?.[0];
          if (!v) throw new SourceError('אין נוסח עברי למקור הזה', 'no-hebrew');
          return {
            ref: d.ref,
            heRef: d.heRef,
            indexTitle: d.indexTitle,
            heIndexTitle: d.heIndexTitle,
            categories: d.categories,
            sectionNames: d.sectionNames,
            next: d.next,
            prev: d.prev,
            text: v.text,
            sectionRef: d.sectionRef,
            sections: d.sections,
            toSections: d.toSections,
            firstAvailableSectionRef: d.firstAvailableSectionRef,
            version: { title: v.versionTitle, heTitle: v.versionTitleInHebrew ?? '', license: v.license, source: v.versionSource ?? '' },
            origin: 'sefaria' as const,
          };
        } catch (e) {
          cache.delete(key);
          const snap = snapshot.texts[ref];
          if (e instanceof SourceError && e.reason === 'offline') {
            if (snap) return { ...snap, sectionRef: snap.ref, origin: 'snapshot' as const };
            // "Berakhot 2a:3" offline → the snapshot's "Berakhot 2a" with focus 3.
            const { book, sections } = splitRef(ref);
            const section = snapshot.texts[`${book} ${sections[0]}`];
            if (section && sections.length > 1) {
              let text: unknown = section.text;
              for (const s of sections.slice(1)) text = Array.isArray(text) ? text[Number(s) - 1] : undefined;
              if (text !== undefined) {
                const heRef = `${section.heRef}:${sections.slice(1).join(':')}`;
                return { ...section, ref, heRef, text, sectionRef: section.ref, sections, toSections: sections, origin: 'snapshot' as const };
              }
            }
          }
          throw e;
        }
      })(),
    );
  }
  return cache.get(key)!;
}

const flat = (t: unknown): string[] => (Array.isArray(t) ? t.flatMap(flat) : typeof t === 'string' ? [t] : []);

/**
 * Opens any ref as a whole section (amud / chapter) with the requested part as focus.
 * "Berakhot 2a:3" → section "Berakhot 2a", focus 3. "Genesis 6:9-11:32" → "Genesis 6", focus 9–22.
 */
export async function loadSection(ref: string): Promise<Section> {
  let raw = await getRaw(ref);
  let focus: Section['focus'];
  if (!raw.sectionRef && raw.firstAvailableSectionRef) raw = await getRaw(raw.firstAvailableSectionRef);
  const sectionRef = raw.sectionRef ?? raw.ref;
  if (sectionRef !== raw.ref) {
    const sec = await getRaw(sectionRef);
    const from = Number(raw.sections?.[raw.sections.length - 1]);
    const sameSection = raw.toSections && raw.sections && raw.toSections.slice(0, -1).join(':') === raw.sections.slice(0, -1).join(':');
    const len = flat(sec.text).length;
    const to = sameSection ? Number(raw.toSections![raw.toSections!.length - 1]) : len;
    if (Number.isFinite(from)) focus = { from, to: Number.isFinite(to) ? Math.min(to, len) : from };
    raw = sec;
  }
  const segments = flat(raw.text);
  if (!segments.length) throw new SourceError('המקור נמצא אבל אין בו טקסט עברי', 'no-hebrew');
  const { book } = splitRef(raw.ref);
  return {
    ref: raw.ref,
    heRef: raw.heRef,
    book: raw.indexTitle || book,
    heBook: raw.heIndexTitle,
    kind: kindOf(raw.categories, raw.indexTitle),
    categories: raw.categories,
    sectionNames: raw.sectionNames,
    segments,
    version: raw.version,
    next: raw.next,
    prev: raw.prev,
    focus,
    origin: raw.origin,
  };
}

/** Splits a comment into its דיבור המתחיל and the explanation. */
export function splitDh(html: string): { dh: string | null; body: string } {
  const bold = html.match(/^\s*<(?:b|strong)>(.*?)<\/(?:b|strong)>\s*/);
  if (bold) return { dh: plain(bold[1]).replace(/[.:–-]\s*$/, ''), body: html.slice(bold[0].length) };
  const p = plain(html);
  const dash = p.search(/ [–-] /);
  if (dash > 0 && dash < 120) return { dh: p.slice(0, dash), body: p.slice(dash + 3) };
  return { dh: null, body: html };
}

/** Section part of a ref ("Berakhot 2a" → "2a", "Mishnah Berakhot 1" → "1"). */
const sectionPart = (s: Section) => s.ref.slice(s.book.length).trim();

/** A commentator's comments on a whole section, each tied to the segment it explains. */
export async function loadCommentary(id: string, section: Section, heName?: string): Promise<Commentary> {
  const index = `${id} on ${section.book}`;
  const ref = `${index} ${sectionPart(section)}`;
  const raw = await getRaw(ref);
  const bySegment = Array.isArray(raw.text) ? (raw.text as unknown[]) : [];
  const comments: Comment[] = [];
  bySegment.forEach((seg, si) => {
    const list = Array.isArray(seg) ? flat(seg) : typeof seg === 'string' ? [seg] : [];
    list.forEach((text, ci) => {
      if (!plain(text)) return;
      comments.push({ ref: `${ref}:${si + 1}:${ci + 1}`, segment: si + 1, index: ci + 1, text, dh: splitDh(text).dh });
    });
  });
  const known = COMMENTATORS.find((c) => c.id === id);
  return {
    id,
    he: known?.he ?? heName ?? id,
    index,
    ref,
    baseRef: section.ref,
    comments,
    version: raw.version,
    origin: raw.origin,
  };
}

export type LinkRelation = 'commentary' | 'parallel' | 'quotation' | 'related';

export interface LinkGroup {
  /** Collective title (e.g. "Rashi") or book title for non-commentary links. */
  id: string;
  he: string;
  category: string;
  relation: LinkRelation;
  /** Segments in the current section the links anchor to. */
  segments: number[];
  refs: string[];
}

interface ApiLink {
  ref: string;
  anchorRef: string;
  category: string;
  type: string;
  index_title: string;
  collectiveTitle?: { en: string; he: string };
  heTitle?: string;
}

/**
 * Every source Sefaria links to this section, grouped and classified:
 * direct commentary on the passage, parallel sugya, quotation, or a related source.
 */
export async function loadLinks(section: Section): Promise<LinkGroup[]> {
  const links = await fetchJson<ApiLink[]>(`${API}/links/${encodeURIComponent(section.ref)}?with_text=0`);
  const groups = new Map<string, LinkGroup>();
  for (const l of links) {
    const relation: LinkRelation =
      l.type === 'commentary' && l.category === 'Commentary'
        ? 'commentary'
        : l.type === 'quotation' || l.category === 'Quoting Commentary'
          ? 'quotation'
          : (l.category === 'Talmud' || l.category === 'Mishnah') && l.type !== 'commentary'
            ? 'parallel'
            : 'related';
    const id = relation === 'commentary' ? (l.collectiveTitle?.en ?? l.index_title) : l.index_title;
    const he = relation === 'commentary' ? (l.collectiveTitle?.he ?? l.heTitle ?? id) : (l.heTitle ?? id);
    const key = `${relation}:${id}`;
    const g = groups.get(key) ?? { id, he, category: l.category, relation, segments: [], refs: [] };
    const seg = Number(l.anchorRef.split(':').pop());
    if (Number.isFinite(seg) && !g.segments.includes(seg)) g.segments.push(seg);
    g.refs.push(l.ref);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.refs.length - a.refs.length);
}

export interface SearchHit {
  ref: string;
  heRef: string;
  categories: string[];
}

/** Full-text search over Sefaria (used to find candidate sources; the original text is then fetched and quoted). */
export async function search(query: string, size = 6): Promise<SearchHit[]> {
  const d = await fetchJson<{ hits: { hits: { _source: { ref: string; heRef: string; categories: string[] } }[] } }>(
    `${API}/search-wrapper`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, type: 'text', size, field: 'naive_lemmatizer', source_proj: true, filters: [], filter_fields: [], aggs: [] }),
    },
  );
  const seen = new Set<string>();
  return d.hits.hits
    .map((h) => h._source)
    .filter((s) => (seen.has(s.ref) ? false : (seen.add(s.ref), true)))
    .map((s) => ({ ref: s.ref, heRef: s.heRef, categories: s.categories }));
}

/** The text of one exact ref (a segment or a comment), as plain letters with niqqud kept. */
export async function fetchRefText(ref: string): Promise<{ ref: string; heRef: string; text: string; version: Version; origin: Origin }> {
  const r = await getRaw(ref);
  return { ref: r.ref, heRef: r.heRef, text: flat(r.text).map(plain).join(' '), version: r.version, origin: r.origin };
}

/** Resolves free Hebrew ("פרשת נח", "ירושלמי ברכות פרק א") to a Sefaria ref. */
export async function resolveName(text: string): Promise<{ ref: string; isBook: boolean } | null> {
  const d = await fetchJson<{ is_ref?: boolean; ref?: string; is_book?: boolean }>(`${API}/name/${encodeURIComponent(text)}?limit=1`);
  return d.is_ref && d.ref ? { ref: d.ref, isBook: !!d.is_book } : null;
}

/** This week's parasha (Israel schedule). */
export async function currentParasha(): Promise<{ ref: string; he: string }> {
  const d = await fetchJson<{ calendar_items: { title: { en: string }; displayValue: { he: string }; ref: string }[] }>(
    `${API}/calendars?timezone=Asia/Jerusalem&diaspora=0`,
  );
  const item = d.calendar_items.find((c) => c.title.en === 'Parashat Hashavua');
  if (!item) throw new SourceError('לא נמצאה פרשת השבוע', 'not-found');
  return { ref: item.ref, he: item.displayValue.he };
}

/** Commentators offered by default for a text kind, in display order. */
export const defaultCommentators = (kind: TextKind) => COMMENTATORS.filter((c) => c.on.includes(kind));
