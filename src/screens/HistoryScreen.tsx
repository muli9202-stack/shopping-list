import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { formatDate } from '../stats';
import { CHAINS, MODES, type ChainId, type HistoryEntry, type Mode } from '../types';
import { Empty, Header } from '../ui/components';
import { confirmDialog } from '../ui/dialog';

const STATUS_ICON = { bought: '✓', missing: '✕', pending: '·' } as const;

export default function HistoryScreen({ chainId, mode }: { chainId: ChainId; mode: Mode }) {
  const history = useApp((s) => s.history);
  const branches = useApp((s) => s.branches);
  const entries = useMemo(
    () => history.filter((h) => h.chainId === chainId && h.mode === mode).sort((a, b) => b.date - a.date),
    [history, chainId, mode],
  );
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className={`page ${CHAINS[chainId].className}`}>
      <Header title="היסטוריית קניות" subtitle={`${CHAINS[chainId].name} · ${MODES[mode].name}`} back={`/c/${chainId}/${mode}`} />
      {entries.length === 0 ? (
        <Empty icon="📜" title="אין עדיין קניות שמורות">
          <p className="muted">בסוף כל קנייה לוחצים על "סיום קנייה ושמירה", והרשימה תופיע כאן.</p>
        </Empty>
      ) : (
        entries.map((e) => (
          <HistoryCard
            key={e.id}
            entry={e}
            branchName={branches.find((b) => b.id === e.branchId)?.name}
            open={open === e.id}
            onToggle={() => setOpen(open === e.id ? null : e.id)}
          />
        ))
      )}
    </div>
  );
}

function HistoryCard({ entry, branchName, open, onToggle }: { entry: HistoryEntry; branchName?: string; open: boolean; onToggle: () => void }) {
  const { deleteHistory, mergeIntoList } = useApp.getState();
  const navigate = useNavigate();
  const bought = entry.items.filter((i) => i.status === 'bought').length;
  const missing = entry.items.filter((i) => i.status === 'missing').length;

  return (
    <section className="card history-card">
      <button className="history-head" onClick={onToggle}>
        <div>
          <strong>{formatDate(entry.date)}</strong>
          {branchName && <span className="muted small"> · {branchName}</span>}
          <div className="muted small">
            {entry.items.length} מוצרים · {bought} נקנו{missing > 0 && ` · ${missing} לא היו במלאי`}
          </div>
        </div>
        <span className="chev">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <>
          <ul className="history-items">
            {entry.items.map((it) => (
              <li key={it.productId} className={`h-${it.status}`}>
                <span className="h-icon">{STATUS_ICON[it.status]}</span>
                <span className="stat-name">{it.name}</span>
                {it.qty > 1 && (
                  <span className="muted small" dir="ltr">
                    ×{it.qty}
                  </span>
                )}
                {it.status === 'missing' && <span className="missing-note small">לא היה במלאי</span>}
              </li>
            ))}
          </ul>
          <div className="row">
            <button
              className="btn small"
              onClick={() => {
                mergeIntoList(entry.chainId, entry.mode, entry.items.map((i) => ({ productId: i.productId, qty: i.qty })));
                navigate(`/c/${entry.chainId}/${entry.mode}`);
              }}
            >
              העתקה לרשימה הנוכחית
            </button>
            <button
              className="btn small ghost danger-text"
              onClick={async () => {
                if (await confirmDialog({ title: 'מחיקת הרשימה מההיסטוריה', confirmText: 'מחיקה', danger: true })) deleteHistory(entry.id);
              }}
            >
              מחיקה
            </button>
          </div>
        </>
      )}
    </section>
  );
}
