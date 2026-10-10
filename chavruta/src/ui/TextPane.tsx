// The study page: the real text, segment by segment, with clickable words, the
// highlight of what the chavruta is reading, bookmarks and notes, and the edition label.
import { useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../brain/engine';
import { norm, tokenize } from '../core/hebrew';
import { amudLabel } from '../core/refs';
import { useStudy } from '../state/store';

const LICENSE_HE: Record<string, string> = {
  'Public Domain': 'נחלת הכלל',
  'CC-BY': 'CC-BY',
  'CC-BY-SA': 'CC-BY-SA',
  'CC-BY-NC': 'CC-BY-NC (שימוש לא מסחרי)',
  'CC0': 'CC0',
};

export const licenseHe = (l: string) => LICENSE_HE[l] ?? l;

/** Indexes (among word tokens) of a phrase inside a segment, for highlighting. */
function phraseRange(keys: string[], phrase?: string): [number, number] | null {
  if (!phrase) return null;
  const want = norm(phrase).split(' ').filter(Boolean);
  if (!want.length) return null;
  for (let i = 0; i + want.length <= keys.length; i++) {
    if (want.every((w, j) => keys[i + j] === w || keys[i + j]?.replace(/^ו/, '') === w.replace(/^ו/, ''))) return [i, i + want.length - 1];
  }
  return null;
}

export function TextPane() {
  const section = useStudy((s) => s.section);
  const epoch = useStudy((s) => s.epoch);
  const highlight = useStudy((s) => s.highlight);
  const selection = useStudy((s) => s.selection);
  const focusSeg = useStudy((s) => s.focusSeg);
  const fontScale = useStudy((s) => s.settings.fontScale);
  const bookmarks = useStudy((s) => s.bookmarks);
  const notes = useStudy((s) => s.notes);
  const loading = useStudy((s) => s.loading);
  const [menu, setMenu] = useState<{ seg: number; word: number; text: string } | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const tokens = useMemo(() => section?.segments.map((s) => tokenize(s)) ?? [], [section]);

  // A highlight from an older page (a late answer after navigation) is ignored.
  const hl = highlight && section && highlight.ref === section.ref && highlight.epoch === epoch ? highlight : null;

  useEffect(() => {
    if (!hl) return;
    const el = scroller.current?.querySelector(`[data-seg="${hl.seg}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [hl?.seg, hl?.words, hl]);

  useEffect(() => setMenu(null), [section?.ref]);

  if (!section) return null;
  const talmud = section.kind === 'talmud';
  const sectionPart = section.ref.slice(section.book.length).trim();

  return (
    <article className="text-pane" style={{ ['--font-scale' as string]: fontScale }} aria-label={`דף הלימוד: ${section.heRef}`}>
      <header className="text-head">
        <h2>
          {section.heRef}
          {talmud && <span className="amud-badge" title="דף ועמוד">{amudLabel(sectionPart)}</span>}
        </h2>
        {loading && <span className="loading">טוען…</span>}
      </header>
      <div className="text-scroll" ref={scroller}>
        {tokens.map((toks, i) => {
          const seg = i + 1;
          const wordToks = toks.filter((t) => !t.sep);
          const keys = wordToks.map((t) => t.key);
          const range = hl?.seg === seg ? phraseRange(keys, hl.words) : null;
          const marked = bookmarks.some((b) => b.ref === section.ref && b.seg === seg);
          const note = notes[`${section.ref}:${seg}`];
          let w = -1;
          return (
            <div
              key={`${section.ref}-${seg}`}
              data-seg={seg}
              className={`segment ${hl?.seg === seg ? 'hl' : ''} ${focusSeg === seg ? 'focus' : ''} ${section.focus && seg >= section.focus.from && seg <= section.focus.to ? 'in-range' : ''}`}
            >
              <div className="seg-side">
                <button className="seg-num" title={`שורה ${seg}: לחיצה מעבירה את המוקד לכאן`} onClick={() => useStudy.getState().set({ focusSeg: seg, highlight: { ref: section.ref, seg, epoch } })}>
                  {seg}
                </button>
                <button
                  className={`icon-btn small ${marked ? 'on' : ''}`}
                  aria-label={marked ? 'הסר סימנייה' : 'הוסף סימנייה'}
                  title={marked ? 'הסר סימנייה' : 'הוסף סימנייה'}
                  onClick={() => useStudy.getState().toggleBookmark({ ref: section.ref, seg, he: `${section.heRef}, שורה ${seg}` })}
                >
                  {marked ? '★' : '☆'}
                </button>
                <button className={`icon-btn small ${note ? 'on' : ''}`} aria-label="הערה" title="הערה" onClick={() => setNoteFor(noteFor === seg ? null : seg)}>
                  ✎
                </button>
              </div>
              <p className="seg-text" lang="he">
                {toks.map((t, k) => {
                  if (t.sep) return <span key={k}>{t.text}</span>;
                  w++;
                  const idx = w;
                  const inPhrase = range && idx >= range[0] && idx <= range[1];
                  const selected = selection && selection.ref === section.ref && selection.seg === seg && selection.word === idx;
                  return (
                    <span
                      key={k}
                      role="button"
                      tabIndex={0}
                      className={`w ${inPhrase ? 'mark' : ''} ${selected ? 'sel' : ''}`}
                      onClick={() => {
                        useStudy.getState().set({ selection: { ref: section.ref, seg, word: idx, text: t.text }, focusSeg: seg });
                        setMenu({ seg, word: idx, text: t.text });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          (e.currentTarget as HTMLElement).click();
                        }
                      }}
                    >
                      {t.text}
                    </span>
                  );
                })}
              </p>
              {menu && menu.seg === seg && (
                <div className="word-menu" role="menu" aria-label={`פעולות על „${menu.text}”`}>
                  <strong>{menu.text}</strong>
                  <button role="menuitem" onClick={() => (setMenu(null), engine.dispatch({ type: 'word', word: menu.text, text: menu.text }))}>
                    פירוש המילה
                  </button>
                  <button role="menuitem" onClick={() => (setMenu(null), engine.dispatch({ type: 'commentary', who: section.kind === 'mishnah' ? 'Bartenura' : 'Rashi', action: 'open' }))}>
                    {section.kind === 'mishnah' ? 'ברטנורא על הקטע' : 'רש״י על הקטע'}
                  </button>
                  <button role="menuitem" onClick={() => (setMenu(null), engine.dispatch({ type: 'chat', text: `מה הפשט בשורה ${seg}?` }))}>
                    מה הפשט כאן?
                  </button>
                  <button role="menuitem" className="ghost" onClick={() => setMenu(null)} aria-label="סגור">
                    ✕
                  </button>
                </div>
              )}
              {(noteFor === seg || note) && (
                <textarea
                  className="note"
                  placeholder="הערה שלי על השורה הזאת"
                  defaultValue={note ?? ''}
                  autoFocus={noteFor === seg}
                  onBlur={(e) => {
                    useStudy.getState().setNote(`${section.ref}:${seg}`, e.target.value);
                    setNoteFor(null);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <footer className="edition">
        תצוגת טקסט דיגיטלית · מהדורה: {section.version.heTitle || section.version.title} · רישיון: {licenseHe(section.version.license)} ·{' '}
        {section.origin === 'snapshot' ? (
          <span className="warn">מעותק שמור במכשיר (אין חיבור לספריא)</span>
        ) : (
          <a href={`https://www.sefaria.org/${encodeURIComponent(section.ref.replace(/ /g, '_'))}?lang=he`} target="_blank" rel="noreferrer">
            ספריא
          </a>
        )}
      </footer>
    </article>
  );
}
