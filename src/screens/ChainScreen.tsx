import { useApp } from '../store';
import { CHAINS, MODES, MODE_IDS, listKey, type ChainId } from '../types';
import { Header, Tile } from '../ui/components';
import { visibleKeys } from '../listView';

export default function ChainScreen({ chainId }: { chainId: ChainId }) {
  const lists = useApp((s) => s.lists);
  const categories = useApp((s) => s.categories);
  const products = useApp((s) => s.products);
  const historyCount = useApp((s) => s.history.filter((h) => h.chainId === chainId).length);
  const chain = CHAINS[chainId];

  return (
    <div className={`page ${chain.className}`}>
      <Header title={chain.name} subtitle="בחר סוג קנייה" back="/" />
      <div className="tiles tiles-big">
        {MODE_IDS.map((mode) => {
          const n = visibleKeys(lists[listKey(chainId, mode)]?.items ?? {}, categories, products).length;
          return (
            <Tile
              key={mode}
              to={`/c/${chainId}/${mode}`}
              className="tile-mode"
              icon={MODES[mode].emoji}
              title={MODES[mode].name}
              subtitle={n ? `${n} פריטים ברשימה של ${MODES[mode].period}` : 'אין רשימה פעילה'}
            />
          );
        })}
        <Tile
          to={`/c/${chainId}/history`}
          className="tile-history"
          icon="📜"
          title="היסטוריה"
          subtitle={historyCount ? `${historyCount} קניות שמורות` : 'עדיין אין קניות שמורות'}
        />
      </div>
    </div>
  );
}
