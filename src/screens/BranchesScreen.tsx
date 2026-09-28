import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { CHAINS, type ChainId } from '../types';
import { Empty, Header } from '../ui/components';
import { confirmDialog, promptDialog } from '../ui/dialog';
import { withUndo } from '../ui/toast';

export default function BranchesScreen({ chainId }: { chainId: ChainId }) {
  const allBranches = useApp((s) => s.branches);
  const branches = allBranches.filter((b) => b.chainId === chainId);
  const { addBranch, updateBranch, deleteBranch } = useApp.getState();
  const navigate = useNavigate();

  const add = async () => {
    const name = await promptDialog({ title: 'סניף חדש', placeholder: 'לדוגמה: נטו חיסכון בני ברק, רבי עקיבא' });
    if (!name) return;
    const id = addBranch(chainId, name);
    navigate(`/c/${chainId}/branches/${id}`);
  };

  return (
    <div className={`page ${CHAINS[chainId].className}`}>
      <Header title="סניפים ומפות" subtitle={CHAINS[chainId].name} back={`/c/${chainId}`} />
      {branches.length === 0 ? (
        <Empty icon="🗺️" title="עדיין אין סניפים">
          <p className="muted">מוסיפים סניף, ומציירים לו מפה פשוטה: איפה הכניסה, המעברים והמדפים, ומה יש על כל מדף. לפי המפה הרשימה תסודר במסלול הכי קצר.</p>
          <div className="stack">
            <button className="btn primary" onClick={add}>
              + סניף ראשון
            </button>
          </div>
        </Empty>
      ) : (
        <>
          <div className="stack">
            {branches.map((b) => {
              const shelves = Object.values(b.map?.cells ?? {}).filter((c) => c.kind === 'shelf');
              const placed = shelves.filter((c) => c.catIds?.length || c.productIds?.length).length;
              return (
                <div key={b.id} className="card branch-card">
                  <Link to={`/c/${chainId}/branches/${b.id}`} className="branch-main">
                    <span className="branch-icon">🏬</span>
                    <span>
                      <strong>{b.name}</strong>
                      {b.address && <span className="muted small"> · {b.address}</span>}
                      <span className="muted small branch-meta">
                        {b.map ? `מפה ${b.map.cols}×${b.map.rows} · ${placed} מדפים משובצים` : 'עדיין אין מפה'}
                      </span>
                    </span>
                    <span className="chev">‹</span>
                  </Link>
                  <div className="row branch-actions">
                    <button
                      className="btn small ghost"
                      onClick={async () => {
                        const name = await promptDialog({ title: 'שם הסניף', initial: b.name });
                        if (name) updateBranch(b.id, { name });
                      }}
                    >
                      ✎ שם
                    </button>
                    <button
                      className="btn small ghost"
                      onClick={async () => {
                        const address = await promptDialog({ title: 'כתובת', initial: b.address, placeholder: 'רחוב ועיר' });
                        if (address !== null) updateBranch(b.id, { address });
                      }}
                    >
                      📍 כתובת
                    </button>
                    {allBranches.some((o) => o.id !== b.id && o.map) && (
                      <button
                        className="btn small ghost"
                        onClick={async () => {
                          const others = allBranches.filter((o) => o.id !== b.id && o.map);
                          const name = await promptDialog({
                            title: 'העתקת מפה מסניף אחר',
                            message: `מאיזה סניף? (${others.map((o) => o.name).join(', ')})`,
                            initial: others[0].name,
                          });
                          const src = others.find((o) => o.name === name);
                          if (src?.map && (await confirmDialog({ title: 'העתקת מפה', message: `המפה של "${b.name}" תוחלף במפה של "${src.name}".`, confirmText: 'העתקה' })))
                            updateBranch(b.id, { map: JSON.parse(JSON.stringify(src.map)) });
                        }}
                      >
                        ⧉ העתקת מפה
                      </button>
                    )}
                    <button
                      className="btn small ghost danger-text"
                      onClick={() => {
                        withUndo(`הסניף "${b.name}" נמחק`, () => deleteBranch(b.id));
                      }}
                    >
                      מחיקה
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button className="btn dashed block add-branch" onClick={add}>
            + סניף חדש
          </button>
        </>
      )}
    </div>
  );
}
