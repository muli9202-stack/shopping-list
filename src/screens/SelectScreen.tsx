import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp, useList } from '../store';
import { buildSections } from '../catalog';
import { CHAINS, CHAIN_IDS, MODES, type ChainId, type Mode } from '../types';
import { Empty, Header, Stepper, Tile } from '../ui/components';
import { confirmDialog } from '../ui/dialog';

export default function SelectScreen({ chainId, mode }: { chainId: ChainId; mode: Mode }) {
  const categories = useApp((s) => s.categories);
  const products = useApp((s) => s.products);
  const list = useList(chainId, mode);
  const historyCount = useApp((s) => s.history.filter((h) => h.chainId === chainId && h.mode === mode).length);
  const { toggleSelect, setQty, clearList, loadSampleCatalog, copyCatalog } = useApp.getState();
  const [query, setQuery] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);

  const items = list?.items ?? {};
  const selectedCount = Object.keys(items).length;
  const q = query.trim();
  const sections = useMemo(
    () =>
      buildSections(categories, products, chainId, (p) => (!q || p.name.includes(q)) && (!onlySelected || !!items[p.id])),
    [categories, products, chainId, q, onlySelected, items],
  );
  const hasCatalog = products.some((p) => p.chainId === chainId);
  const otherChain = CHAIN_IDS.find((c) => c !== chainId)!;
  const period = MODES[mode].period;

  return (
    <div className={`page with-bottom-bar ${CHAINS[chainId].className}`}>
      <Header
        title={MODES[mode].name}
        subtitle={`${CHAINS[chainId].name} · סמן את מה שצריך ${period}`}
        back={`/c/${chainId}`}
        actions={
          <>
            <Link to={`/c/${chainId}/${mode}/history`} className="icon-btn" aria-label="היסטוריה">
              📜
            </Link>
            <Link to={`/c/${chainId}/catalog`} className="icon-btn" aria-label="עריכת המאגר">
              ✎
            </Link>
          </>
        }
      />

      <div className="tiles quick-tiles">
        <Tile
          to={`/c/${chainId}/${mode}/shop`}
          className="tile-small tile-accent"
          icon="🛒"
          title={`כניסה לרשימת הקניות שיצרת ${period}`}
          subtitle={selectedCount ? `${selectedCount} מוצרים` : 'עדיין לא נבחרו מוצרים'}
        />
        <Tile
          to={`/c/${chainId}/${mode}/average`}
          className="tile-small tile-accent"
          icon="📊"
          title="כניסה לקנייה הממוצעת שלי"
          subtitle={historyCount ? `מבוסס על ${historyCount} רשימות` : 'עדיין אין היסטוריה'}
        />
      </div>

      {!hasCatalog ? (
        <Empty icon="🧺" title="אין עדיין מוצרים במאגר">
          <p className="muted">כדי ליצור רשימה צריך קודם להכניס מוצרים למאגר של {CHAINS[chainId].name}.</p>
          <div className="stack">
            <Link className="btn primary" to={`/c/${chainId}/catalog`}>
              מעבר למאגר המוצרים
            </Link>
            <button className="btn" onClick={() => loadSampleCatalog(chainId)}>
              טעינת מאגר לדוגמה
            </button>
            {products.some((p) => p.chainId === otherChain) && (
              <button className="btn" onClick={() => copyCatalog(otherChain, chainId)}>
                העתקת המאגר של {CHAINS[otherChain].name}
              </button>
            )}
          </div>
        </Empty>
      ) : (
        <>
          <div className="search-row">
            <input className="input search" type="search" placeholder="🔍 חיפוש מוצר" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className={`chip ${onlySelected ? 'active' : ''}`} onClick={() => setOnlySelected(!onlySelected)}>
              נבחרו ({selectedCount})
            </button>
          </div>

          {sections.length === 0 && <p className="muted center pad">לא נמצאו מוצרים</p>}

          {sections.map((sec) => (
            <section key={sec.category?.id ?? 'none'} className={`cat-section depth-${Math.min(sec.depth, 3)}`}>
              <div className="cat-head">
                <span className="cat-name">{sec.category?.name ?? sec.path}</span>
              </div>
              <div className="pick-grid">
                {sec.products.map((p) => {
                  const it = items[p.id];
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      className={`pick ${it ? 'selected' : ''}`}
                      onClick={() => toggleSelect(chainId, mode, p.id)}
                      onKeyDown={(e) => e.key === 'Enter' && toggleSelect(chainId, mode, p.id)}
                    >
                      <span className="pick-check">{it ? '✓' : ''}</span>
                      <span className="pick-name">{p.name}</span>
                      {it && <Stepper value={it.qty} onChange={(v) => setQty(chainId, mode, p.id, v)} />}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {selectedCount > 0 && (
            <div className="center pad">
              <button
                className="btn ghost small"
                onClick={async () => {
                  if (await confirmDialog({ title: 'ניקוי הרשימה', message: 'כל הסימונים יבוטלו.', confirmText: 'ניקוי', danger: true }))
                    clearList(chainId, mode);
                }}
              >
                ניקוי כל הסימונים
              </button>
            </div>
          )}
        </>
      )}

      <div className="bottom-bar">
        <Link to={`/c/${chainId}/${mode}/shop`} className={`btn primary block big ${selectedCount ? '' : 'disabled'}`}>
          כניסה לרשימת הקניות של {period}
          {selectedCount > 0 && <span className="count-pill">{selectedCount}</span>}
        </Link>
      </div>
    </div>
  );
}
