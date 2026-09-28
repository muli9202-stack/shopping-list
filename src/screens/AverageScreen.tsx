import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import type { AiAnalysis } from '../ai';
import { computeAverage, formatDate, TIER_LABELS, type ProductStat } from '../stats';
import { CHAINS, MODES, listKey, type ChainId, type Mode } from '../types';
import { Empty, Header } from '../ui/components';
import { confirmDialog } from '../ui/dialog';

export default function AverageScreen({ chainId, mode }: { chainId: ChainId; mode: Mode }) {
  const allHistory = useApp((s) => s.history);
  const products = useApp((s) => s.products);
  const settings = useApp((s) => s.settings);
  const insight = useApp((s) => s.aiInsights[listKey(chainId, mode)]);
  const { mergeIntoList, setAiInsight } = useApp.getState();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const entries = useMemo(() => allHistory.filter((h) => h.chainId === chainId && h.mode === mode), [allHistory, chainId, mode]);
  const avg = useMemo(() => computeAverage(entries), [entries]);
  const productIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);
  const period = MODES[mode].period;
  const back = `/c/${chainId}/${mode}`;

  const runAi = async () => {
    setBusy(true);
    setError('');
    try {
      // The SDK is loaded on demand so it doesn't weigh on app start-up.
      const ai = await import('../ai').catch(() => null);
      if (!ai) throw new Error('אין חיבור לאינטרנט.');
      try {
        setAiInsight(chainId, mode, await ai.analyzeHistory({ apiKey: settings.apiKey, model: settings.model, chainId, mode, entries, products }));
      } catch (e) {
        setError(ai.describeAiError(e));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const useAsList = async (items: { productId: string; qty: number }[]) => {
    const valid = items.filter((i) => productIds.has(i.productId));
    const ok = await confirmDialog({
      title: 'יצירת רשימה מהקנייה הממוצעת',
      message: `${valid.length} מוצרים יסומנו ברשימה של ${period}. מוצרים שכבר סימנת יישארו. אפשר להוסיף ולהוריד אחר כך.`,
      confirmText: 'יצירת רשימה',
    });
    if (!ok) return;
    mergeIntoList(chainId, mode, valid);
    navigate(back);
  };

  if (!avg) {
    return (
      <div className={`page ${CHAINS[chainId].className}`}>
        <Header title="הקנייה הממוצעת שלי" subtitle={`${CHAINS[chainId].name} · ${MODES[mode].name}`} back={back} />
        <Empty icon="📊" title="עדיין אין היסטוריה">
          <p className="muted">
            אחרי כל קנייה לוחצים על "סיום קנייה ושמירה", והרשימה נשמרת בהיסטוריה. מהרשימות האלה מחושבת הקנייה הממוצעת שלך.
          </p>
        </Empty>
      </div>
    );
  }

  const localBasket = avg.products.filter((p) => p.frequency >= 0.5).map((p) => ({ productId: p.productId, qty: p.avgQty }));
  const stale = insight && insight.historyCount !== entries.length;

  return (
    <div className={`page ${CHAINS[chainId].className}`}>
      <Header
        title="הקנייה הממוצעת שלי"
        subtitle={`${CHAINS[chainId].name} · ${MODES[mode].name}`}
        back={back}
        actions={
          <Link to={`/c/${chainId}/${mode}/history`} className="icon-btn" aria-label="היסטוריה">
            📜
          </Link>
        }
      />

      <div className="stat-row">
        <div className="stat">
          <strong>{avg.lists}</strong>
          <span>רשימות</span>
        </div>
        <div className="stat">
          <strong>{avg.avgItems}</strong>
          <span>מוצרים בממוצע</span>
        </div>
        <div className="stat">
          <strong>{avg.avgDaysBetween ?? '—'}</strong>
          <span>ימים בין קניות</span>
        </div>
      </div>

      <section className="card ai-card">
        <div className="ai-head">
          <h2>✨ ניתוח AI</h2>
          {insight && <span className="muted small">{formatDate(insight.createdAt)}</span>}
        </div>
        {!settings.apiKey ? (
          <p className="muted">
            כדי לקבל ניתוח חכם מ-Claude, הכנס מפתח API ב<Link to="/settings" className="link">מסך ההגדרות</Link>. בינתיים מוצג למטה חישוב סטטיסטי.
          </p>
        ) : !insight ? (
          <>
            <p className="muted">Claude ינתח את {avg.lists} הרשימות שלך ויחשב מה אתה קונה בדרך כלל, כמה ובאיזו תדירות.</p>
            <button className="btn primary block" onClick={runAi} disabled={busy}>
              {busy ? 'מנתח…' : 'ניתוח הקנייה הממוצעת'}
            </button>
          </>
        ) : (
          <AiResult
            insight={insight.result}
            productIds={productIds}
            onUse={() => useAsList(insight.result.basket.map((b) => ({ productId: b.product_id, qty: b.typical_qty })))}
          />
        )}
        {insight && settings.apiKey && (
          <button className="btn ghost small block" onClick={runAi} disabled={busy}>
            {busy ? 'מנתח…' : stale ? '🔄 יש רשימות חדשות — רענון הניתוח' : '🔄 רענון הניתוח'}
          </button>
        )}
        {error && <p className="error-msg">{error}</p>}
      </section>

      <div className="section-head">
        <h2 className="section-title">חישוב לפי ההיסטוריה</h2>
        {localBasket.length > 0 && (
          <button className="btn small" onClick={() => useAsList(localBasket)}>
            צור רשימה ({localBasket.length})
          </button>
        )}
      </div>
      {(['always', 'often', 'sometimes'] as const).map((tier) => {
        const rows = avg.products.filter((p) => p.tier === tier);
        if (!rows.length) return null;
        return (
          <section key={tier} className="shop-section">
            <div className="shop-section-title">{TIER_LABELS[tier]}</div>
            <div className="catalog-items">
              {rows.map((p) => (
                <StatRow key={p.productId} stat={p} total={avg.lists} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StatRow({ stat, total }: { stat: ProductStat; total: number }) {
  return (
    <div className="stat-item">
      <div className="stat-item-top">
        <span className="stat-name">{stat.name}</span>
        <span className="muted small">
          {stat.appearances} מתוך {total}
          {stat.avgQty !== 1 && ` · בד״כ ${stat.avgQty} יח׳`}
        </span>
      </div>
      <div className="freq-bar">
        <div style={{ width: `${stat.frequency * 100}%` }} />
      </div>
      {stat.missing > 0 && <div className="missing-note small">לא היה במלאי {stat.missing} פעמים</div>}
    </div>
  );
}

function AiResult({
  insight,
  productIds,
  onUse,
}: {
  insight: AiAnalysis;
  productIds: Set<string>;
  onUse: () => void;
}) {
  return (
    <div className="ai-result">
      <p>{insight.summary}</p>
      <h3>הקנייה הממוצעת</h3>
      <ul className="basket">
        {insight.basket.map((b, i) => (
          <li key={i} className={productIds.has(b.product_id) ? '' : 'gone'}>
            <span className="stat-name">{b.name}</span>
            <span className="muted small">
              {b.frequency_label}
              {b.typical_qty > 1 && ` · ${b.typical_qty} יח׳`}
            </span>
          </li>
        ))}
      </ul>
      <button className="btn primary block" onClick={onUse}>
        יצירת רשימה מהקנייה הממוצעת
      </button>
      {insight.occasional.length > 0 && (
        <>
          <h3>נקנים מדי פעם</h3>
          <ul className="bullets">
            {insight.occasional.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}
      {insight.often_missing.length > 0 && (
        <>
          <h3>חסרים לעיתים קרובות</h3>
          <ul className="bullets">
            {insight.often_missing.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}
      {insight.insights.length > 0 && (
        <>
          <h3>תובנות</h3>
          <ul className="bullets">
            {insight.insights.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
