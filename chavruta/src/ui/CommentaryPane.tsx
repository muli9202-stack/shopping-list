// Commentary beside the text. Each comment is shown under the line it explains, with its
// דיבור המתחיל. Below: other commentators Sefaria links to this page (direct commentary),
// parallel passages, and related sources, kept apart so they are not confused.
import { useEffect, useRef } from 'react';
import { engine } from '../brain/engine';
import { plain } from '../core/hebrew';
import { splitDh, type LinkGroup } from '../core/sefaria';
import { useStudy } from '../state/store';
import { licenseHe } from './TextPane';

const RELATION_HE: Record<LinkGroup['relation'], string> = {
  commentary: 'פירושים ישירים על הקטע',
  parallel: 'סוגיות ומשניות מקבילות',
  quotation: 'מקורות שמצטטים את הקטע',
  related: 'מקורות הקשורים לנושא',
};

export function CommentaryPane({ onClose }: { onClose?: () => void }) {
  const section = useStudy((s) => s.section);
  const open = useStudy((s) => s.openCommentaries);
  const active = useStudy((s) => s.activeCommentary);
  const commentaries = useStudy((s) => s.commentaries);
  const focusSeg = useStudy((s) => s.focusSeg);
  const commentHighlight = useStudy((s) => s.commentHighlight);
  const links = useStudy((s) => s.links);
  const box = useRef<HTMLDivElement>(null);
  const com = active ? commentaries[active] : null;

  useEffect(() => {
    const target =
      (commentHighlight && box.current?.querySelector(`[data-ref="${CSS.escape(commentHighlight)}"]`)) ||
      box.current?.querySelector(`[data-seg="${focusSeg}"]`);
    target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [commentHighlight, focusSeg, active]);

  if (!section) return null;
  const loadedIds = new Set(Object.keys(commentaries));
  const groups = (['commentary', 'parallel', 'quotation', 'related'] as const).map((rel) => ({
    rel,
    items: links.filter((l) => l.relation === rel && !(rel === 'commentary' && open.includes(l.id))).slice(0, rel === 'commentary' ? 30 : 12),
  }));

  return (
    <aside className="commentary-pane" aria-label="פירושים">
      <div className="tabs" role="tablist">
        {open.map((id) => (
          <div key={id} className={`tab ${id === active ? 'active' : ''}`}>
            <button role="tab" aria-selected={id === active} onClick={() => useStudy.getState().set({ activeCommentary: id })}>
              {commentaries[id]?.he ?? id}
            </button>
            <button className="tab-x" aria-label={`סגור ${commentaries[id]?.he ?? id}`} onClick={() => engine.closeCommentary(id)}>
              ✕
            </button>
          </div>
        ))}
        {onClose && (
          <button className="icon-btn" aria-label="סגור את חלון הפירושים" onClick={onClose}>
            ⌄
          </button>
        )}
      </div>
      <div className="commentary-scroll" ref={box}>
        {com ? (
          <>
            <p className="pane-note">
              {com.he} על {section.heRef} · פירוש ישיר, כל דיבור מוצג ליד השורה שעליה הוא נאמר
            </p>
            {com.comments.length === 0 && <p className="muted">אין ל{com.he} דיבורים על העמוד הזה.</p>}
            {groupBySeg(com.comments).map(([seg, list]) => (
              <section key={seg} data-seg={seg} className={`c-group ${seg === focusSeg ? 'focus' : ''}`}>
                <button className="c-anchor" onClick={() => useStudy.getState().set({ focusSeg: seg, highlight: { ref: section.ref, seg, epoch: useStudy.getState().epoch } })}>
                  על שורה {seg}
                </button>
                {list.map((c) => {
                  const { dh, body } = splitDh(c.text);
                  return (
                    <p key={c.ref} data-ref={c.ref} className={`comment ${commentHighlight === c.ref ? 'mark' : ''}`} lang="he">
                      {dh && <b className="dh">{dh}</b>} {plain(body)}
                    </p>
                  );
                })}
              </section>
            ))}
            <p className="edition">
              מהדורה: {com.version.heTitle || com.version.title} · רישיון: {licenseHe(com.version.license)}
              {com.origin === 'snapshot' && ' · מעותק שמור במכשיר'}
              {com.origin === 'library' && ' · ספרייה מקומית מתוך ספריא'}
            </p>
          </>
        ) : (
          <p className="muted">אפשר לומר „פתח רש״י” או לבחור מפרש מהרשימה.</p>
        )}
        <div className="links">
          {groups.map(
            (g) =>
              g.items.length > 0 && (
                <details key={g.rel} open={g.rel === 'commentary'}>
                  <summary>
                    {RELATION_HE[g.rel]} ({g.items.length})
                  </summary>
                  <ul>
                    {g.items.map((l) => (
                      <li key={`${g.rel}:${l.id}`}>
                        <button
                          className="link-btn"
                          onClick={() => (g.rel === 'commentary' ? engine.openCommentary(l.id) : engine.openRef(l.refs[0]))}
                          title={g.rel === 'commentary' ? 'פתח לצד הדף' : `פתח את ${l.refs[0]}`}
                        >
                          {l.he}
                        </button>{' '}
                        <span className="muted small">
                          {g.rel === 'commentary' ? `על שורות ${l.segments.sort((a, b) => a - b).slice(0, 6).join(', ')}` : l.refs[0]}
                          {g.rel === 'commentary' && loadedIds.has(l.id) ? ' · נטען' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ),
          )}
          {links.length === 0 && section.origin === 'sefaria' && <p className="muted small">טוען קישורים…</p>}
        </div>
      </div>
    </aside>
  );
}

function groupBySeg<T extends { segment: number }>(list: T[]): [number, T[]][] {
  const m = new Map<number, T[]>();
  for (const c of list) m.set(c.segment, [...(m.get(c.segment) ?? []), c]);
  return [...m.entries()];
}
