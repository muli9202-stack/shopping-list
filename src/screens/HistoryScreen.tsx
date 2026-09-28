import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { formatDate } from '../stats';
import { CHAINS, MODES, MODE_IDS, listKey, type ChainId, type HistoryEntry, type Mode } from '../types';
import { Empty, Header } from '../ui/components';
import { confirmDialog } from '../ui/dialog';
import { withUndo } from '../ui/toast';

/** "the week of 27.9–3.10" (Sunday to Saturday) or "September 2026". */
function periodLabel(entry: HistoryEntry): string {
  const d = new Date(entry.date);
  if (entry.mode === 'monthly') return `חודש ${d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}`;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const f = (x: Date) => `${x.getDate()}.${x.getMonth() + 1}`;
  return `השבוע של ${f(start)}–${f(end)}`;
}

const STATUS_ICON = { bought: '✓', missing: '✕', pending: '·' } as const;

export default function HistoryScreen({ chainId }: { chainId: ChainId }) {
  const history = useApp((s) => s.history);
  const branches = useApp((s) => s.branches);
  const [filter, setFilter] = useState<Mode | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const entries = useMemo(
    () =>
      history
        .filter((h) => h.chainId === chainId && (filter === 'all' || h.mode === filter))
        .sort((a, b) => b.date - a.date),
    [history, chainId, filter],
  );

  return (
    <div className={`page ${CHAINS[chainId].className}`}>
      <Header title="היסטוריית קניות" subtitle={CHAINS[chainId].name} back={`/c/${chainId}`} />
      <div className="chip-row">
        <button className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          הכול
        </button>
        {MODE_IDS.map((m) => (
          <button key={m} className={`chip ${filter === m ? 'active' : ''}`} onClick={() => setFilter(m)}>
            {MODES[m].name}
          </button>
        ))}
      </div>
      {entries.length === 0 ? (
        <Empty icon="📜" title="אין עדיין קניות שמורות">
          <p className="muted">בסוף כל קנייה לוחצים על "סיום קנייה ושמירה", והרשימה תופיע כאן לפי תאריך.</p>
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
  const { deleteHistory, replaceList } = useApp.getState();
  const navigate = useNavigate();
  const bought = entry.items.filter((i) => i.status === 'bought').length;
  const missing = entry.items.filter((i) => i.status === 'missing').length;
  const period = MODES[entry.mode].period;

  const reuse = async () => {
    const current = useApp.getState().lists[listKey(entry.chainId, entry.mode)];
    const n = Object.keys(current?.items ?? {}).filter((k) => !k.startsWith('cat:')).length;
    const ok = await confirmDialog({
      title: `לעשות את הרשימה הזאת שוב ${period}?`,
      message: n
        ? `הרשימה הנוכחית של ${period} (${n} פריטים) תוחלף ברשימה מ-${formatDate(entry.date)}. אחר כך אפשר להוסיף ולהוריד.`
        : `הרשימה מ-${formatDate(entry.date)} תיטען כרשימה של ${period}. אחר כך אפשר להוסיף ולהוריד.`,
      confirmText: 'טעינה',
    });
    if (!ok) return;
    replaceList(entry.chainId, entry.mode, entry.items.map((i) => ({ productId: i.productId, qty: i.qty })));
    navigate(`/c/${entry.chainId}/${entry.mode}`);
  };

  return (
    <section className="card history-card">
      <button className="history-head" onClick={onToggle}>
        <div>
          <span className={`mode-tag mode-${entry.mode}`}>{MODES[entry.mode].name}</span>
          <strong> {formatDate(entry.date)}</strong>
          {branchName && <span className="muted small"> · {branchName}</span>}
          <div className="period-label">{periodLabel(entry)}</div>
          <div className="muted small">
            {entry.items.length} פריטים · {bought} נקנו{missing > 0 && ` · ${missing} לא היו במלאי`}
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
          <div className="stack history-actions">
            <button className="btn primary" onClick={reuse}>
              🔁 לעשות את הרשימה הזאת שוב {period}
            </button>
            <button
              className="btn ghost small danger-text"
              onClick={async () => {
                withUndo('הקנייה נמחקה מההיסטוריה', () => deleteHistory(entry.id));
              }}
            >
              מחיקה מההיסטוריה
            </button>
          </div>
        </>
      )}
    </section>
  );
}
