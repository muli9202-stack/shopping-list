import { useApp } from '../store';
import { CHAINS, MODES, MODE_IDS, listKey, type ChainId } from '../types';
import { Header, Tile } from '../ui/components';

export default function ChainScreen({ chainId }: { chainId: ChainId }) {
  const lists = useApp((s) => s.lists);
  const productCount = useApp((s) => s.products.filter((p) => p.chainId === chainId).length);
  const chain = CHAINS[chainId];

  return (
    <div className={`page ${chain.className}`}>
      <Header title={chain.name} subtitle="בחר סוג קנייה" back="/" />
      <div className="tiles tiles-big">
        {MODE_IDS.map((mode) => {
          const n = Object.keys(lists[listKey(chainId, mode)]?.items ?? {}).length;
          return (
            <Tile
              key={mode}
              to={`/c/${chainId}/${mode}`}
              className="tile-mode"
              icon={MODES[mode].emoji}
              title={MODES[mode].name}
              subtitle={n ? `${n} מוצרים ברשימה של ${MODES[mode].period}` : 'אין רשימה פעילה'}
            />
          );
        })}
      </div>
      <h2 className="section-title">ניהול</h2>
      <div className="tiles">
        <Tile to={`/c/${chainId}/catalog`} className="tile-small" icon="📋" title="מאגר המוצרים" subtitle={`${productCount} מוצרים`} />
      </div>
    </div>
  );
}
