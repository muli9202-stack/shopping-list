import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store';
import { buildSections, categoryPath, childCategories } from '../catalog';
import { categoryEmoji, categoryHue } from '../catColors';
import { sampleMap } from '../route';
import { CHAINS, MODES, MODE_IDS, type Branch, type CellKind, type ChainId, type MapCell, type StoreMap } from '../types';
import { Empty, Header } from '../ui/components';
import { confirmDialog, Sheet } from '../ui/dialog';

type Tool = CellKind | 'assign';

const TOOLS: { id: Tool; label: string; icon: string; hint: string }[] = [
  { id: 'assign', label: 'שיבוץ', icon: '📦', hint: 'לחיצה על מדף בוחרת מה יש עליו' },
  { id: 'shelf', label: 'מדף', icon: '🟫', hint: 'גרירה מציירת מדפים' },
  { id: 'floor', label: 'מעבר', icon: '⬜', hint: 'גרירה מוחקת ומפנה מקום להליכה' },
  { id: 'entrance', label: 'כניסה', icon: '🚪', hint: 'לחיצה מסמנת את הכניסה' },
  { id: 'checkout', label: 'קופות', icon: '💳', hint: 'לחיצה מסמנת קופה' },
  { id: 'wall', label: 'קיר', icon: '⬛', hint: 'גרירה מציירת קיר' },
];

const emptyMap = (): StoreMap => ({ rows: 12, cols: 10, cells: { '11,9': { kind: 'entrance' } } });

export default function MapEditorScreen({ chainId, branchId }: { chainId: ChainId; branchId: string }) {
  const branch = useApp((s) => s.branches.find((b) => b.id === branchId));
  const categories = useApp((s) => s.categories);
  const products = useApp((s) => s.products);
  const { updateBranch } = useApp.getState();
  const [tool, setTool] = useState<Tool>('assign');
  const [editing, setEditing] = useState<string | null>(null);
  const painting = useRef(false);

  const map = branch?.map;
  const setMap = (m: StoreMap) => updateBranch(branchId, { map: m });

  const topCats = childCategories(categories, chainId, null);
  const placedCats = useMemo(() => new Set(Object.values(map?.cells ?? {}).flatMap((c) => c.catIds ?? [])), [map]);
  const unplacedTop = topCats.filter((c) => !placedCats.has(c.id) && !categories.some((s) => s.parentId === c.id && placedCats.has(s.id)));

  if (!branch) {
    return (
      <div className="page">
        <Header title="סניף" back={`/c/${chainId}/branches`} />
        <Empty icon="🤷" title="הסניף לא נמצא" />
      </div>
    );
  }

  const paint = (r: number, c: number) => {
    if (!map || tool === 'assign') return;
    const k = `${r},${c}`;
    const cells = { ...map.cells };
    if (tool === 'entrance') for (const [kk, cell] of Object.entries(cells)) if (cell.kind === 'entrance') delete cells[kk];
    const old = cells[k];
    if (tool === 'floor') delete cells[k];
    else if (old?.kind === tool) return;
    else cells[k] = tool === 'shelf' && old?.kind === 'shelf' ? old : { kind: tool };
    setMap({ ...map, cells });
  };
  const cellFromPoint = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const rc = el?.dataset.rc;
    return rc ? (rc.split(',').map(Number) as [number, number]) : null;
  };
  const resize = (dr: number, dc: number) => {
    if (!map) return;
    const rows = Math.min(40, Math.max(4, map.rows + dr));
    const cols = Math.min(30, Math.max(4, map.cols + dc));
    const cells = Object.fromEntries(Object.entries(map.cells).filter(([k]) => {
      const [r, c] = k.split(',').map(Number);
      return r < rows && c < cols;
    }));
    setMap({ rows, cols, cells });
  };
  const hasEntrance = map && Object.values(map.cells).some((c) => c.kind === 'entrance');
  const shelfCount = map ? Object.values(map.cells).filter((c) => c.kind === 'shelf').length : 0;

  return (
    <div className={`page ${CHAINS[chainId].className}`}>
      <Header title={branch.name} subtitle="מפת הסניף" back={`/c/${chainId}/branches`} />

      {!map ? (
        <Empty icon="🗺️" title="עדיין אין מפה לסניף">
          <p className="muted">
            אפשר להתחיל ממפה לדוגמה (מעברים, מדפים, כניסה וקופות, עם הקטגוריות כבר משובצות) ולתקן אותה לפי הסניף, או לצייר מאפס.
          </p>
          <div className="stack">
            <button className="btn primary" onClick={() => setMap(sampleMap(topCats.map((c) => c.id)))}>
              מפה לדוגמה עם שיבוץ אוטומטי
            </button>
            <button className="btn" onClick={() => setMap(emptyMap())}>
              מפה ריקה
            </button>
          </div>
        </Empty>
      ) : (
        <>
          <div className="map-help small">
            המפה נראית מלמעלה. <b>{TOOLS.find((t) => t.id === tool)!.hint}.</b>
          </div>
          <div className="tool-row" role="toolbar">
            {TOOLS.map((t) => (
              <button key={t.id} className={`tool ${tool === t.id ? 'active' : ''}`} onClick={() => setTool(t.id)}>
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          <div className="map-scroll">
            <div
              className="map-grid"
              style={{ gridTemplateColumns: `repeat(${map.cols}, var(--cell))`, ['--cell' as string]: `min(calc((min(100vw, 640px) - 64px) / ${map.cols} - 2px), 34px)` }}
              onPointerDown={(e) => {
                const rc = cellFromPoint(e.clientX, e.clientY);
                if (!rc) return;
                if (tool === 'assign') {
                  if (map.cells[`${rc[0]},${rc[1]}`]?.kind === 'shelf') setEditing(`${rc[0]},${rc[1]}`);
                  return;
                }
                painting.current = !['entrance', 'checkout'].includes(tool);
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                paint(...rc);
              }}
              onPointerMove={(e) => {
                if (!painting.current) return;
                const rc = cellFromPoint(e.clientX, e.clientY);
                if (rc) paint(...rc);
              }}
              onPointerUp={() => (painting.current = false)}
              onPointerCancel={() => (painting.current = false)}
            >
              {Array.from({ length: map.rows * map.cols }, (_, i) => {
                const r = Math.floor(i / map.cols);
                const c = i % map.cols;
                return <MapCellView key={i} r={r} c={c} cell={map.cells[`${r},${c}`]} chainId={chainId} />;
              })}
            </div>
          </div>

          <div className="size-row">
            <span className="muted small">גודל: {map.cols} × {map.rows}</span>
            <div className="row">
              <button className="btn small ghost" onClick={() => resize(0, -1)}>− עמודה</button>
              <button className="btn small ghost" onClick={() => resize(0, 1)}>+ עמודה</button>
              <button className="btn small ghost" onClick={() => resize(-1, 0)}>− שורה</button>
              <button className="btn small ghost" onClick={() => resize(1, 0)}>+ שורה</button>
            </div>
          </div>

          {!hasEntrance && <div className="notice">חסרה כניסה. בחר 🚪 כניסה ולחץ על המשבצת שבה נכנסים לחנות.</div>}
          {shelfCount > 0 && unplacedTop.length > 0 && (
            <div className="notice edit-notice">
              <b>קטגוריות שעוד לא שובצו:</b> {unplacedTop.map((c) => c.name).join(', ')}. בחר 📦 שיבוץ ולחץ על מדף.
            </div>
          )}

          <MapLegend map={map} chainId={chainId} />

          <div className="stack map-actions">
            {MODE_IDS.map((m) => (
              <Link key={m} className="btn" to={`/c/${chainId}/${m}/shop?branch=${branchId}`}>
                🧭 לרשימת {MODES[m].name} במסלול של הסניף
              </Link>
            ))}
            <button
              className="btn ghost danger-text small"
              onClick={async () => {
                if (await confirmDialog({ title: 'איפוס המפה', message: 'כל הציור והשיבוצים יימחקו.', confirmText: 'איפוס', danger: true })) updateBranch(branchId, { map: undefined });
              }}
            >
              איפוס המפה
            </button>
          </div>
        </>
      )}

      {editing && map && (
        <ShelfSheet
          branch={branch}
          cellKey={editing}
          chainId={chainId}
          onClose={() => setEditing(null)}
          categoriesAll={categories}
          productsAll={products}
        />
      )}
    </div>
  );
}

function MapCellView({ r, c, cell, chainId }: { r: number; c: number; cell?: MapCell; chainId: ChainId }) {
  const categories = useApp((s) => s.categories);
  const kind = cell?.kind ?? 'floor';
  const firstCat = cell?.catIds?.[0] ? categories.find((x) => x.id === cell.catIds![0]) : undefined;
  const hue = firstCat ? categoryHue(categories, chainId, firstCat.id) : null;
  const content =
    kind === 'entrance' ? '🚪' : kind === 'checkout' ? '💳' : kind === 'shelf' ? (firstCat ? categoryEmoji(categoryPath(categories, firstCat.id)) : cell?.productIds?.length ? '•' : '') : '';
  return (
    <div
      data-rc={`${r},${c}`}
      className={`map-cell k-${kind} ${hue !== null ? 'tinted' : ''}`}
      style={hue !== null ? ({ ['--hue' as string]: hue } as CSSProperties) : undefined}
      title={cell?.label ?? firstCat?.name}
    >
      {content}
    </div>
  );
}

function MapLegend({ map, chainId }: { map: StoreMap; chainId: ChainId }) {
  const categories = useApp((s) => s.categories);
  const used = [...new Set(Object.values(map.cells).flatMap((c) => c.catIds ?? []))]
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);
  if (!used.length) return null;
  return (
    <div className="map-legend">
      {used.map((c) => (
        <span key={c.id} className="legend-chip" style={{ ['--hue' as string]: categoryHue(categories, chainId, c.id) ?? 0 } as CSSProperties}>
          {categoryEmoji(categoryPath(categories, c.id))} {c.name}
        </span>
      ))}
    </div>
  );
}

function ShelfSheet({
  branch,
  cellKey,
  chainId,
  onClose,
  categoriesAll,
  productsAll,
}: {
  branch: Branch;
  cellKey: string;
  chainId: ChainId;
  onClose: () => void;
  categoriesAll: ReturnType<typeof useApp.getState>['categories'];
  productsAll: ReturnType<typeof useApp.getState>['products'];
}) {
  const map = branch.map!;
  const cell = map.cells[cellKey] ?? { kind: 'shelf' as const };
  const [q, setQ] = useState('');
  const update = (patch: Partial<MapCell>) =>
    useApp.getState().updateBranch(branch.id, { map: { ...map, cells: { ...map.cells, [cellKey]: { ...cell, ...patch } } } });
  const toggle = (list: string[] | undefined, id: string) => (list?.includes(id) ? list.filter((x) => x !== id) : [...(list ?? []), id]);
  const sections = buildSections(categoriesAll, [], chainId, undefined, true).filter((s) => s.category);
  const productMatches = q.trim() ? productsAll.filter((p) => p.chainId === chainId && p.name.includes(q.trim())).slice(0, 30) : [];
  const [r, c] = cellKey.split(',').map(Number);
  // Other shelves in the same straight run, for "apply to the whole shelf row".
  const neighbours = [-1, 1].flatMap((d) => {
    const out: string[] = [];
    for (const [dr, dc] of [
      [d, 0],
      [0, d],
    ])
      for (let i = 1; ; i++) {
        const k = `${r + dr * i},${c + dc * i}`;
        if (map.cells[k]?.kind !== 'shelf') break;
        out.push(k);
      }
    return out;
  });

  return (
    <Sheet title="מה יש על המדף הזה?" onClose={onClose}>
      <label className="form">
        כיתוב (לא חובה)
        <input className="input" placeholder="לדוגמה: מעבר 3" defaultValue={cell.label ?? ''} onBlur={(e) => update({ label: e.target.value.trim() || undefined })} />
      </label>
      <h3 className="sheet-sub">קטגוריות</h3>
      <div className="menu">
        {sections.map((s) => (
          <label key={s.category!.id} className="check-line" style={{ paddingInlineStart: 4 + s.depth * 18 }}>
            <input type="checkbox" checked={!!cell.catIds?.includes(s.category!.id)} onChange={() => update({ catIds: toggle(cell.catIds, s.category!.id) })} />
            {s.depth === 0 && categoryEmoji(s.path)} {s.category!.name}
          </label>
        ))}
      </div>
      <h3 className="sheet-sub">מוצר מסוים (אם הוא לא ליד שאר הקטגוריה שלו)</h3>
      <input className="input" placeholder="🔍 חיפוש מוצר" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="menu">
        {(q.trim() ? productMatches : productsAll.filter((p) => cell.productIds?.includes(p.id))).map((p) => (
          <label key={p.id} className="check-line">
            <input type="checkbox" checked={!!cell.productIds?.includes(p.id)} onChange={() => update({ productIds: toggle(cell.productIds, p.id) })} />
            {p.name}
          </label>
        ))}
      </div>
      {neighbours.length > 0 && (
        <button
          className="btn block"
          onClick={() => {
            const cells = { ...map.cells };
            for (const k of neighbours) cells[k] = { ...cells[k], kind: 'shelf', catIds: cell.catIds, productIds: cell.productIds };
            useApp.getState().updateBranch(branch.id, { map: { ...map, cells } });
            onClose();
          }}
        >
          להחיל על כל שורת המדף ({neighbours.length + 1} משבצות)
        </button>
      )}
      <button className="btn primary block" onClick={onClose}>
        סיום
      </button>
    </Sheet>
  );
}
