import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { fmtMoney } from '../money';
import { CHAINS, CHAIN_IDS, MODES, type ChainId, type HistoryEntry } from '../types';
import { Empty, Header } from '../ui/components';

// Validated series colors (colorblind-safe pair, >= 3:1 on the light surface).
const SERIES: Record<ChainId, string> = { neto: '#119184', yesh: '#7c3aed' };
const MONTHS = 12;

const amountOf = (h: HistoryEntry) => h.paid ?? (h.estimated && h.estimated > 0 ? h.estimated : undefined);

interface MonthBucket {
  key: string;
  label: string;
  long: string;
  byChain: Record<ChainId, number>;
  total: number;
}

export default function SpendingScreen() {
  const history = useApp((s) => s.history);
  const [active, setActive] = useState<string | null>(null);

  const months = useMemo(() => {
    const now = new Date();
    const out: MonthBucket[] = [];
    for (let i = MONTHS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString('he-IL', { month: 'short' }),
        long: d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }),
        byChain: { neto: 0, yesh: 0 },
        total: 0,
      });
    }
    const idx = new Map(out.map((m, i) => [m.key, i]));
    for (const h of history) {
      const amt = amountOf(h);
      const d = new Date(h.date);
      const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (amt === undefined || i === undefined) continue;
      out[i].byChain[h.chainId] += amt;
      out[i].total += amt;
    }
    return out;
  }, [history]);

  const withAmount = history.filter((h) => amountOf(h) !== undefined);
  const noAmount = history.length - withAmount.length;
  const thisMonth = months[months.length - 1];
  const activeMonths = months.filter((m) => m.total > 0);
  const avg = activeMonths.length ? activeMonths.reduce((s, m) => s + m.total, 0) / activeMonths.length : 0;
  const byMode = (['weekly', 'monthly'] as const).map((mode) => ({
    mode,
    sum: withAmount.filter((h) => h.mode === mode && new Date(h.date).getFullYear() === new Date().getFullYear()).reduce((s, h) => s + amountOf(h)!, 0),
  }));

  return (
    <div className="page">
      <Header title="סיכום הוצאות" back="/" />
      {withAmount.length === 0 ? (
        <Empty icon="💰" title="עדיין אין נתוני הוצאות">
          <p className="muted">בסיום כל קנייה אפשר לרשום כמה שילמת. אם יש מחירים למוצרים, הסכום מחושב גם אוטומטית.</p>
        </Empty>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <strong>{fmtMoney(Math.round(thisMonth.total))}</strong>
              <span>החודש</span>
            </div>
            <div className="stat">
              <strong>{fmtMoney(Math.round(avg))}</strong>
              <span>ממוצע לחודש</span>
            </div>
            <div className="stat">
              <strong>{withAmount.length}</strong>
              <span>קניות עם סכום</span>
            </div>
          </div>

          <section className="card">
            <div className="chart-head">
              <h2>הוצאות לפי חודש</h2>
              <div className="legend">
                {CHAIN_IDS.map((c) => (
                  <span key={c}>
                    <i style={{ background: SERIES[c] }} />
                    {CHAINS[c].name}
                  </span>
                ))}
              </div>
            </div>
            <BarChart months={months} active={active} onActive={setActive} />
            {active && <MonthTip month={months.find((m) => m.key === active)!} />}
          </section>

          <section className="card">
            <h2>השנה לפי סוג קנייה</h2>
            {byMode.map((m) => (
              <div key={m.mode} className="money-row table-row">
                <span>{MODES[m.mode].name}</span>
                <strong>{fmtMoney(Math.round(m.sum))}</strong>
              </div>
            ))}
          </section>

          <section className="card">
            <h2>טבלה</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>חודש</th>
                  {CHAIN_IDS.map((c) => (
                    <th key={c}>{CHAINS[c].name}</th>
                  ))}
                  <th>סה״כ</th>
                </tr>
              </thead>
              <tbody>
                {[...activeMonths].reverse().map((m) => (
                  <tr key={m.key}>
                    <td>{m.long}</td>
                    {CHAIN_IDS.map((c) => (
                      <td key={c}>{m.byChain[c] ? fmtMoney(Math.round(m.byChain[c])) : '—'}</td>
                    ))}
                    <td>
                      <strong>{fmtMoney(Math.round(m.total))}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {noAmount > 0 && <p className="muted small">{noAmount} קניות בלי סכום לא נכללו.</p>}
          </section>
        </>
      )}
    </div>
  );
}

function MonthTip({ month }: { month: MonthBucket }) {
  return (
    <div className="chart-tip">
      <strong>{month.long}</strong>
      {CHAIN_IDS.map((c) => (
        <span key={c}>
          <i style={{ background: SERIES[c] }} />
          {CHAINS[c].name}: {fmtMoney(Math.round(month.byChain[c]))}
        </span>
      ))}
      <span>סה״כ {fmtMoney(Math.round(month.total))}</span>
    </div>
  );
}

/** Stacked monthly bars; oldest month on the right to follow the reading direction. */
function BarChart({ months, active, onActive }: { months: MonthBucket[]; active: string | null; onActive: (k: string | null) => void }) {
  const W = 340;
  const H = 180;
  const padTop = 10;
  const padBottom = 22;
  const padSide = 34;
  const plotH = H - padTop - padBottom;
  const max = Math.max(...months.map((m) => m.total), 1);
  const nice = niceMax(max);
  const slot = (W - padSide) / months.length;
  const barW = Math.min(18, slot * 0.6);
  const y = (v: number) => padTop + plotH - (v / nice) * plotH;
  const ticks = [0, nice / 2, nice];

  return (
    <svg className="bar-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="הוצאות לפי חודש" onClick={() => onActive(null)}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={0} x2={W - padSide} y1={y(t)} y2={y(t)} className="grid" />
          <text x={W - padSide + 4} y={y(t) + 4} className="axis" textAnchor="start">
            {t >= 1000 ? `${Math.round(t / 100) / 10}K` : Math.round(t)}
          </text>
        </g>
      ))}
      {months.map((m, i) => {
        // RTL: index 0 (oldest) sits at the right edge of the plot.
        const cx = W - padSide - slot * (i + 0.5);
        let base = 0;
        const segs = CHAIN_IDS.filter((c) => m.byChain[c] > 0).map((c) => {
          const from = base;
          base += m.byChain[c];
          return { c, from, to: base };
        });
        const dim = active && active !== m.key;
        return (
          <g
            key={m.key}
            opacity={dim ? 0.35 : 1}
            onClick={(e) => {
              e.stopPropagation();
              onActive(active === m.key ? null : m.key);
            }}
          >
            {/* Hit target wider than the bar. */}
            <rect x={cx - slot / 2} y={padTop} width={slot} height={plotH} fill="transparent" />
            {segs.map((s, j) => {
              const top = y(s.to);
              // 2px surface gap between stacked segments.
              const bottom = y(s.from) - (j > 0 ? 2 : 0);
              const h = Math.max(0, bottom - top);
              const isTop = j === segs.length - 1;
              return isTop ? (
                <path key={s.c} d={roundedTop(cx - barW / 2, top, barW, h, Math.min(4, h))} fill={SERIES[s.c]} />
              ) : (
                <rect key={s.c} x={cx - barW / 2} y={top} width={barW} height={h} fill={SERIES[s.c]} />
              );
            })}
            <text x={cx} y={H - 6} className="axis" textAnchor="middle">
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
