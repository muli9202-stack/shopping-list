import { Link } from 'react-router-dom';
import { useApp } from '../store';
import { CHAINS, CHAIN_IDS } from '../types';
import { Tile } from '../ui/components';

export default function HomeScreen() {
  const products = useApp((s) => s.products);
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
              subtitle={count ? `${count} מוצרים במאגר` : 'המאגר עדיין ריק'}
            />
          );
        })}
      </div>
    </div>
  );
}
