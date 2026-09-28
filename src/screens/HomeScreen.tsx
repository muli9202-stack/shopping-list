import { Link } from 'react-router-dom';
import { useApp } from '../store';
import { dueToday } from '../reminder';
import { visibleKeys } from '../listView';
import { CHAINS, CHAIN_IDS, MODES, MODE_IDS, listKey } from '../types';
import { Tile } from '../ui/components';
import { useSyncStatus } from '../syncStatus';
import QuickAdd from '../ui/QuickAdd';
import Welcome from '../ui/Welcome';

export default function HomeScreen() {
  const products = useApp((s) => s.products);
  const categories = useApp((s) => s.categories);
  const lists = useApp((s) => s.lists);
  const reminder = useApp((s) => s.settings.reminder);
  const seenWelcome = useApp((s) => !!s.settings.seenWelcome);
  const due = dueToday(reminder);
  const syncOn = useApp((s) => !!s.settings.sync?.enabled);
  const status = useSyncStatus((s) => s.status);

  // Lists in progress, most complete first.
  const active = CHAIN_IDS.flatMap((chain) =>
    MODE_IDS.map((mode) => {
      const items = lists[listKey(chain, mode)]?.items ?? {};
      const keys = visibleKeys(items, categories, products);
      const done = keys.filter((k) => items[k].status !== 'pending').length;
      return { chain, mode, total: keys.length, done };
    }),
  ).filter((l) => l.total > 0);

  return (
    <div className="page home">
      <header className="home-head">
        <div>
          <h1>רשימת הקניות שלי</h1>
          <p className="muted">{greeting()}</p>
        </div>
        <div className="row">
          {syncOn && (
            <Link to="/settings" className={`sync-dot s-${status}`} title="רשימה משותפת">
              {status === 'online' ? '☁️✓' : status === 'error' ? '☁️⚠' : '☁️…'}
            </Link>
          )}
          <Link to="/settings" className="icon-btn" aria-label="הגדרות">
            ⚙️
          </Link>
        </div>
      </header>

      {due && <div className="reminder-banner">🔔 היום יום {MODES[due].name}: הגיע הזמן להכין רשימה</div>}

      {active.length > 0 && (
        <section className="resume">
          {active.map((l) => (
            <Link key={`${l.chain}${l.mode}`} to={`/c/${l.chain}/${l.mode}/shop`} className={`resume-card ${CHAINS[l.chain].className}`}>
              <span className="resume-icon">{l.done ? '🛒' : '📝'}</span>
              <span className="resume-text">
                <strong>
                  {l.done ? 'להמשיך בקנייה' : 'הרשימה מוכנה'}: {CHAINS[l.chain].name}
                </strong>
                <span className="muted small">
                  {MODES[l.mode].name} · {l.done ? `${l.done} מתוך ${l.total} סומנו` : `${l.total} פריטים`}
                </span>
                <span className="progress">
                  <span className="progress-bought" style={{ width: `${(l.done / l.total) * 100}%` }} />
                </span>
              </span>
              <span className="chev">‹</span>
            </Link>
          ))}
        </section>
      )}

      <div className="tiles tiles-big">
        {CHAIN_IDS.map((id) => {
          const count = products.filter((p) => p.chainId === id).length;
          return (
            <Tile
              key={id}
              to={`/c/${id}`}
              className={`tile-chain ${CHAINS[id].className}`}
              icon="🛒"
              title={CHAINS[id].name}
              subtitle={count ? `${count} מוצרים` : 'עדיין אין מוצרים'}
            />
          );
        })}
      </div>
      <div className="tiles home-extra">
        <Tile to="/spending" className="tile-small" icon="💰" title="סיכום הוצאות" />
        <Tile to="/compare" className="tile-small" icon="⚖️" title="השוואת מחירים" />
      </div>

      {products.length > 0 && <QuickAdd />}
      {!seenWelcome && products.length === 0 && <Welcome />}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  const part = h < 5 ? 'לילה טוב' : h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
  return `${part}! באיזו רשת קונים היום?`;
}
