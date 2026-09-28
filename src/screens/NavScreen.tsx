import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, useList } from '../store';
import { categoryPath } from '../catalog';
import { categoryEmoji, categoryHue } from '../catColors';
import { catIdOf, isCatKey, visibleKeys } from '../listView';
import { describeLeg, finalHeading, planRoute, type Instruction, type Pt } from '../route';
import { CHAINS, MODES, type ChainId, type Mode } from '../types';
import { Empty, Header } from '../ui/components';
import { useWakeLock } from '../ui/useWakeLock';
import type { CameraMode, ShelfLabel, Store3D } from '../nav/Store3D';

const ARROW: Record<Instruction['icon'], string> = { straight: '⬆', left: '⬅', right: '➡', back: '⤵', here: '📍' };

export default function NavScreen({ chainId, mode }: { chainId: ChainId; mode: Mode }) {
  const categories = useApp((s) => s.categories);
  const products = useApp((s) => s.products);
  const list = useList(chainId, mode);
  const branch = useApp((s) => s.branches.find((b) => b.id === list?.branchId));
  const navigate = useNavigate();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<Store3D | null>(null);
  const [cam, setCam] = useState<CameraMode>('follow');
  const [voice, setVoice] = useState(false);
  const [failed, setFailed] = useState(false);
  useWakeLock();

  const items = list?.items ?? {};
  const keys = useMemo(() => visibleKeys(items, categories, products), [items, categories, products]);
  // Plan once over the full list so stop numbers stay stable while shopping.
  const route = useMemo(
    () => (branch?.map ? planRoute(branch.map, keys, products, categories) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branch?.map, keys.join('|')],
  );
  const pending = (k: string) => items[k]?.status === 'pending';
  const current = route ? route.stops.findIndex((s) => s.keys.some(pending)) : -1;
  const stopIndex = current === -1 ? (route?.stops.length ?? 0) : current;
  const doneStops = useMemo(() => new Set(route?.stops.map((s, i) => (s.keys.some(pending) ? -1 : i)).filter((i) => i >= 0)), [route, items]); // eslint-disable-line react-hooks/exhaustive-deps

  const labels = useMemo<ShelfLabel[]>(() => {
    if (!branch?.map) return [];
    const byCat = new Map<string, Pt[]>();
    for (const [k, cell] of Object.entries(branch.map.cells)) {
      const id = cell.catIds?.[0];
      if (cell.kind !== 'shelf' || !id) continue;
      byCat.set(id, [...(byCat.get(id) ?? []), k.split(',').map(Number) as Pt]);
    }
    return [...byCat].map(([id, cells]) => {
      const name = categories.find((c) => c.id === id)?.name ?? '';
      return { text: `${categoryEmoji(categoryPath(categories, id))} ${name}`, hue: categoryHue(categories, chainId, id), cells };
    });
  }, [branch?.map, categories, chainId]);

  // Build the 3D view once per map/route.
  useEffect(() => {
    if (!route || !branch?.map || !hostRef.current) return;
    let disposed = false;
    import('../nav/Store3D')
      .then(({ Store3D }) => {
        if (disposed || !hostRef.current) return;
        try {
          viewRef.current = new Store3D(hostRef.current, branch.map!, route, labels);
          viewRef.current.setProgress(stopIndex, doneStops);
        } catch {
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      viewRef.current?.dispose();
      viewRef.current = null;
    };
  }, [route, branch?.map, labels]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    viewRef.current?.setProgress(stopIndex, doneStops);
  }, [stopIndex, doneStops]);
  useEffect(() => viewRef.current?.setCameraMode(cam), [cam]);

  const nameOf = (k: string) => (isCatKey(k) ? categories.find((c) => c.id === catIdOf(k))?.name ?? '' : products.find((p) => p.id === k)?.name ?? '');
  const stop = route && current >= 0 ? route.stops[current] : null;
  const steps = useMemo(() => {
    if (!route || !stop) return [];
    const heading = current > 0 ? finalHeading(route.stops[current - 1].leg) : null;
    return describeLeg(stop.leg, stop.shelf, heading);
  }, [route, stop, current]);
  const shelfLabel = stop && branch?.map ? (branch.map.cells[`${stop.shelf[0]},${stop.shelf[1]}`]?.label ?? '') : '';
  const nextStop = route && current >= 0 ? route.stops.slice(current + 1).find((s) => s.keys.some(pending)) : undefined;

  // Spoken guidance on each new stop.
  useEffect(() => {
    if (!voice || !stop || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(`${steps.map((s) => s.text).join(', ')}. ${stop.keys.map(nameOf).join(' ו')}`);
    u.lang = 'he-IL';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }, [voice, current]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = `/c/${chainId}/${mode}/shop`;
  if (!branch?.map || !route) {
    return (
      <div className="page">
        <Header title="ניווט בחנות" back={back} />
        <Empty icon="🗺️" title={!branch ? 'לא נבחר סניף' : 'לסניף אין מפה'}>
          <p className="muted">הניווט צריך סניף עם מפה. בחר סניף ברשימת הקניות, או צור מפה לסניף.</p>
          <div className="stack">
            <Link className="btn primary" to={branch ? `/c/${chainId}/branches/${branch.id}` : `/c/${chainId}/branches`}>
              {branch ? 'יצירת מפה לסניף' : 'סניפים ומפות'}
            </Link>
          </div>
        </Empty>
      </div>
    );
  }

  const total = route.stops.length;
  const finished = current === -1;
  const { toggleStatus } = useApp.getState();

  return (
    <div className={`nav-screen ${CHAINS[chainId].className}`}>
      <div className={`nav-banner ${finished ? 'done' : ''}`}>
        <button className="nav-close" onClick={() => navigate(back)} aria-label="יציאה מהניווט">
          ✕
        </button>
        {finished ? (
          <div className="nav-instr">
            <span className="nav-arrow">🏁</span>
            <div>
              <strong>סיימת את כל הרשימה!</strong>
              <div className="nav-sub">{route.exit.length > 1 ? 'המסלול לקופות מסומן במפה' : 'אפשר לגשת לקופות'}</div>
            </div>
          </div>
        ) : (
          <div className="nav-instr">
            <span className="nav-arrow">{ARROW[steps.find((s) => s.icon !== 'straight')?.icon ?? 'straight']}</span>
            <div>
              <strong>{steps.slice(0, 2).map((s) => s.text).join(', ')}</strong>
              <div className="nav-sub">{steps.slice(2).map((s) => s.text).join(' · ') || steps[steps.length - 1]?.text}</div>
            </div>
          </div>
        )}
      </div>

      <div className="nav-view" ref={hostRef}>
        {failed && <div className="nav-fallback">התצוגה התלת־ממדית לא נתמכת במכשיר הזה. אפשר להמשיך לפי הרשימה.</div>}
        <div className="nav-tools">
          <button className="nav-tool" onClick={() => setCam(cam === 'follow' ? 'overview' : 'follow')}>
            {cam === 'follow' ? '🗺️ מבט על' : '🧭 מעקב'}
          </button>
          <button className={`nav-tool ${voice ? 'on' : ''}`} onClick={() => setVoice(!voice)} aria-label="הנחיה קולית">
            {voice ? '🔊' : '🔈'}
          </button>
        </div>
      </div>

      <div className="nav-card">
        <div className="nav-progress">
          <span>
            {MODES[mode].name} · עצירה {Math.min(stopIndex + 1, total)} מתוך {total}
          </span>
          <div className="progress">
            <div className="progress-bought" style={{ width: `${(doneStops.size / Math.max(1, total)) * 100}%` }} />
          </div>
        </div>
        {stop ? (
          <>
            <div className="nav-target muted small">
              📍 {shelfLabel || 'המוצר הבא'}
              {nextStop && <span> · אחר כך: {nextStop.keys.map(nameOf).join(', ')}</span>}
            </div>
            {stop.keys.map((k) => (
              <div key={k} className={`nav-item status-${items[k]?.status}`}>
                <span className="nav-item-name">
                  {nameOf(k)}
                  {(items[k]?.qty ?? 1) > 1 && <span className="shop-qty" dir="ltr">×{items[k].qty}</span>}
                </span>
                <button className="btn nav-missing" onClick={() => toggleStatus(chainId, mode, k, 'missing')}>
                  {items[k]?.status === 'missing' ? 'לא היה ✕' : 'לא היה'}
                </button>
                <button className="btn primary nav-check" onClick={() => toggleStatus(chainId, mode, k, 'bought')} aria-label="נקנה">
                  {items[k]?.status === 'bought' ? '✓ נקנה' : '✓'}
                </button>
              </div>
            ))}
          </>
        ) : (
          <div className="stack">
            {route.unplaced.some(pending) && (
              <p className="muted small">לא במפה: {route.unplaced.filter(pending).map(nameOf).join(', ')}</p>
            )}
            <Link className="btn primary big block" to={back}>
              חזרה לרשימה ולסיום הקנייה
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
