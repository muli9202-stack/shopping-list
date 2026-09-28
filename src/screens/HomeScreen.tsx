import { Link } from 'react-router-dom';
import { useApp } from '../store';
import { dueToday } from '../reminder';
import { CHAINS, CHAIN_IDS, MODES } from '../types';
import { Tile } from '../ui/components';

export default function HomeScreen() {
  const products = useApp((s) => s.products);
  const reminder = useApp((s) => s.settings.reminder);
  const due = dueToday(reminder);
  return (
    <div className="page">
      <header className="home-head">
        <div>
          <h1>רשימת הקניות שלי</h1>
          <p className="muted">באיזו רשת קונים היום?</p>
        </div>
        <Link to="/settings" className="icon-btn" aria-label="הגדרות">
          ⚙️
        </Link>
      </header>
      {due && <div className="reminder-banner">🔔 היום יום {MODES[due].name}: הגיע הזמן להכין רשימה</div>}
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
    </div>
  );
}
