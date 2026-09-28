import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { fmtMoney } from '../money';
import { CHAINS } from '../types';
import { Empty, Header } from '../ui/components';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export default function CompareScreen() {
  const products = useApp((s) => s.products);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const yesh = new Map(products.filter((p) => p.chainId === 'yesh' && p.price).map((p) => [norm(p.name), p.price!]));
    return products
      .filter((p) => p.chainId === 'neto' && p.price && yesh.has(norm(p.name)))
      .map((p) => ({ name: p.name, neto: p.price!, yesh: yesh.get(norm(p.name))! }))
      .sort((a, b) => Math.abs(b.neto - b.yesh) - Math.abs(a.neto - a.yesh));
  }, [products]);

  const shown = query.trim() ? rows.filter((r) => r.name.includes(query.trim())) : rows;
  const netoWins = rows.filter((r) => r.neto < r.yesh).length;
  const yeshWins = rows.filter((r) => r.yesh < r.neto).length;
  const sumNeto = rows.reduce((s, r) => s + r.neto, 0);
  const sumYesh = rows.reduce((s, r) => s + r.yesh, 0);

  return (
    <div className="page">
      <Header title="השוואת מחירים" subtitle={`${CHAINS.neto.name} מול ${CHAINS.yesh.name}`} back="/" />
      {rows.length === 0 ? (
        <Empty icon="⚖️" title="אין עדיין מה להשוות">
          <p className="muted">
            ההשוואה עובדת על מוצרים עם אותו שם בשתי הרשתות, שיש להם מחיר בשתיהן. מחיר מוסיפים דרך ✎ עריכה ← לחיצה על מוצר.
          </p>
        </Empty>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <strong>{netoWins}</strong>
              <span>זול יותר ב{CHAINS.neto.name}</span>
            </div>
            <div className="stat">
              <strong>{yeshWins}</strong>
              <span>זול יותר ב{CHAINS.yesh.name}</span>
            </div>
            <div className="stat">
              <strong>{fmtMoney(Math.abs(Math.round((sumNeto - sumYesh) * 100) / 100))}</strong>
              <span>הפרש לסל של {rows.length} מוצרים</span>
            </div>
          </div>
          <p className="center">
            על כל המוצרים המשותפים, הסל זול יותר ב
            <strong>{sumNeto <= sumYesh ? CHAINS.neto.name : CHAINS.yesh.name}</strong>.
          </p>
          <div className="search-row">
            <input className="input search" type="search" placeholder="🔍 חיפוש מוצר" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <section className="card">
            <table className="data-table compare-table">
              <thead>
                <tr>
                  <th>מוצר</th>
                  <th>{CHAINS.neto.name}</th>
                  <th>{CHAINS.yesh.name}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className={r.neto < r.yesh ? 'cheaper' : ''}>
                      {fmtMoney(r.neto)}
                      {r.neto < r.yesh && ' ✓'}
                    </td>
                    <td className={r.yesh < r.neto ? 'cheaper' : ''}>
                      {fmtMoney(r.yesh)}
                      {r.yesh < r.neto && ' ✓'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
