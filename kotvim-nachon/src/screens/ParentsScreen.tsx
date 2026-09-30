import { useState } from 'react';
import { useStore } from '../store';
import { useNav } from '../nav';
import { TopBar } from '../ui/kit';
import { SKILLS, SKILL_BY_ID } from '../data/skills';
import { GRADES } from './FamilyScreen';
import { parentSummary } from '../services/ai';
import type { Child, SkillId } from '../types';

// Validated categorical order (blue, orange, aqua) – colour follows the skill, legend + direct labels carry identity.
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'];

export function ParentsScreen() {
  const children = useStore((s) => s.children);
  const go = useNav((s) => s.go);
  const [sel, setSel] = useState(children[0]?.id ?? null);
  const child = children.find((c) => c.id === sel);
  return (
    <div className="screen" style={{ background: '#f8f9fa' }}>
      <TopBar
        title="👨‍👩‍👧 לוח ההורים"
        right={
          <button className="icon-btn" aria-label="הגדרות" onClick={() => go({ name: 'settings' })}>
            ⚙️
          </button>
        }
      />
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {children.map((c) => (
          <button key={c.id} className={`chip ${sel === c.id ? 'on' : ''}`} onClick={() => setSel(c.id)}>
            {c.avatar} {c.name}
          </button>
        ))}
      </div>
      {child ? <ChildReport key={child.id} child={child} /> : <p className="muted">עוד אין ילדים.</p>}
    </div>
  );
}

function ChildReport({ child }: { child: Child }) {
  const updateChild = useStore((s) => s.updateChild);
  const [loading, setLoading] = useState(false);
  const practiced = SKILLS.filter((s) => child.skills[s.id]);
  const weakest = practiced
    .slice()
    .sort((a, b) => child.skills[a.id]!.mastery - child.skills[b.id]!.mastery)
    .slice(0, 3)
    .map((s) => s.id);
  const pairs = Object.entries(child.pairs).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxPair = pairs[0]?.[1] ?? 1;
  const totalAttempts = practiced.reduce((a, s) => a + child.skills[s.id]!.attempts, 0);
  const totalCorrect = practiced.reduce((a, s) => a + child.skills[s.id]!.correct, 0);

  const refresh = async () => {
    setLoading(true);
    const text = await parentSummary(child);
    updateChild(child.id, (c) => ({ ...c, aiSummary: { t: Date.now(), text }, updatedAt: Date.now() }));
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="grid2">
        <Tile label="דיוק כללי" value={totalAttempts ? `${Math.round((totalCorrect / totalAttempts) * 100)}%` : '—'} />
        <Tile label="תרגולים" value={String(totalAttempts)} />
        <Tile label="ימים ברצף" value={`${child.streak} 🔥`} />
        <Tile label="כיתה" value={GRADES[child.grade - 1]} />
      </div>

      <div className="card">
        <div className="row">
          <b className="grow">🤖 סיכום וניתוח טעויות</b>
          <button className="btn white" style={{ padding: '8px 14px', fontSize: 16 }} disabled={loading} onClick={refresh}>
            {loading ? 'מנתח...' : 'עדכון'}
          </button>
        </div>
        <p style={{ whiteSpace: 'pre-line', marginBottom: 0 }}>{child.aiSummary?.text ?? 'לחצו "עדכון" לקבלת ניתוח של הטעויות וההתקדמות.'}</p>
        {child.aiSummary && <div className="small muted">עודכן {new Date(child.aiSummary.t).toLocaleDateString('he-IL')}</div>}
      </div>

      <div className="card">
        <b>🔤 אותיות שמתבלבלים בהן</b>
        {pairs.length === 0 && <p className="small muted">עוד לא נאספו טעויות.</p>}
        {pairs.map(([p, n]) => (
          <div key={p} className="stat-row">
            <span style={{ width: 120, fontWeight: 700 }}>{p}</span>
            <div className="bar">
              <div style={{ width: `${(n / maxPair) * 100}%`, background: '#2a78d6' }} />
            </div>
            <span style={{ width: 34, textAlign: 'left' }}>{n}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <b>🧩 שליטה בכל נושא</b>
        <p className="small muted" style={{ marginTop: 4 }}>
          אדום = קשה כרגע, ירוק = שולט. האפליקציה מתרגלת אוטומטית את הנושאים החלשים.
        </p>
        {SKILLS.filter((s) => s.minGrade <= child.grade).map((s) => {
          const p = child.skills[s.id];
          const m = p?.mastery ?? 0;
          const status = !p || p.attempts < 3 ? { t: 'אין מספיק נתונים', c: '#adb5bd' } : m < 0.55 ? { t: '⚠️ קשה', c: '#e34948' } : m < 0.8 ? { t: '↗ בתהליך', c: '#eda100' } : { t: '✔ שולט', c: '#0ca30c' };
          return (
            <div key={s.id} className="stat-row">
              <span style={{ width: 150, fontSize: 15 }}>{s.parentTitle}</span>
              <div className="bar">
                <div style={{ width: `${p ? m * 100 : 0}%`, background: status.c }} />
              </div>
              <span className="small" style={{ width: 90, textAlign: 'left' }}>
                {status.t}
              </span>
            </div>
          );
        })}
      </div>

      <div className="card">
        <b>📈 התקדמות לאורך זמן (הנושאים הקשים)</b>
        <TrendChart child={child} skills={weakest} />
      </div>

      <div className="card">
        <b>✏️ כתיבה והכתבות</b>
        {child.writings.length === 0 ? (
          <p className="small muted">עוד לא נכתבו סיפורים או הכתבות.</p>
        ) : (
          child.writings
            .slice(-6)
            .reverse()
            .map((w, k) => (
              <div key={k} className="stat-row small">
                <span>{w.mode === 'story' ? '📝 סיפור' : '🎧 הכתבה'}</span>
                <span className="grow muted">{new Date(w.t).toLocaleDateString('he-IL')}</span>
                <span>
                  {w.words} מילים · {w.mistakes} טעויות
                </span>
              </div>
            ))
        )}
      </div>

      <div className="card">
        <b>🕑 טעויות אחרונות</b>
        {child.mistakes.length === 0 && <p className="small muted">אין עדיין.</p>}
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {child.mistakes
            .slice(-16)
            .reverse()
            .map((m, k) => (
              <span key={k} className="chip" style={{ cursor: 'default', fontSize: 15 }}>
                <span style={{ color: '#c92a2a', textDecoration: 'line-through' }}>{m.typed || '—'}</span> ← <b>{m.expected}</b>
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card center" style={{ padding: 12 }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div className="small muted">{label}</div>
    </div>
  );
}

/** Daily accuracy per skill, one line per skill (max 3), with legend, end labels and hover tooltips. */
function TrendChart({ child, skills }: { child: Child; skills: SkillId[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const series = skills
    .map((id, k) => ({ id, color: SERIES[k], days: (child.skills[id]?.days ?? []).slice(-21) }))
    .filter((s) => s.days.length > 0);
  if (!series.length) return <p className="small muted">הגרף יופיע אחרי כמה ימי תרגול.</p>;
  const allDays = Array.from(new Set(series.flatMap((s) => s.days.map((d) => d.d)))).sort();
  const W = 320;
  const H = 170;
  const P = { l: 34, r: 12, t: 12, b: 26 };
  const x = (d: string) => P.l + (allDays.length === 1 ? (W - P.l - P.r) / 2 : (allDays.indexOf(d) / (allDays.length - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - v) * (H - P.t - P.b);
  return (
    <div style={{ position: 'relative' }}>
      <div className="row small" style={{ flexWrap: 'wrap', gap: 12, margin: '8px 0' }}>
        {series.map((s) => (
          <span key={s.id} className="row" style={{ gap: 4 }}>
            <span style={{ width: 14, height: 3, background: s.color, borderRadius: 2 }} /> {SKILL_BY_ID[s.id].parentTitle}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="גרף דיוק יומי לפי נושא" style={{ direction: 'ltr' }} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#e9ecef" />
            <text x={P.l - 6} y={y(v) + 4} fontSize="10" textAnchor="end" fill="#6c6f86">
              {v * 100}%
            </text>
          </g>
        ))}
        <text x={P.l} y={H - 6} fontSize="10" fill="#6c6f86">
          {il(allDays[0])}
        </text>
        <text x={W - P.r} y={H - 6} fontSize="10" textAnchor="end" fill="#6c6f86">
          {il(allDays[allDays.length - 1])}
        </text>
        {series.map((s) => {
          const pts = s.days.map((d) => ({ d: d.d, v: d.a ? d.c / d.a : 0, a: d.a }));
          return (
            <g key={s.id}>
              <polyline fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={pts.map((p) => `${x(p.d)},${y(p.v)}`).join(' ')} />
              {pts.map((p) => (
                <g key={p.d}>
                  <circle cx={x(p.d)} cy={y(p.v)} r="4" fill={s.color} stroke="#fff" strokeWidth="2" />
                  <circle
                    cx={x(p.d)}
                    cy={y(p.v)}
                    r="12"
                    fill="transparent"
                    onMouseEnter={() => setHover({ x: x(p.d), y: y(p.v), text: `${SKILL_BY_ID[s.id].parentTitle} · ${il(p.d)} · ${Math.round(p.v * 100)}% (${p.a} תרגולים)` })}
                    onClick={() => setHover({ x: x(p.d), y: y(p.v), text: `${SKILL_BY_ID[s.id].parentTitle} · ${il(p.d)} · ${Math.round(p.v * 100)}% (${p.a} תרגולים)` })}
                  />
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div
          className="small"
          style={{
            position: 'absolute',
            top: `${(hover.y / H) * 100}%`,
            left: `${Math.min(60, (hover.x / W) * 100)}%`,
            background: '#212529',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: 8,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            transform: 'translateY(-130%)',
          }}
        >
          {hover.text}
        </div>
      )}
    </div>
  );
}

/** YYYY-MM-DD → DD/MM */
function il(d?: string) {
  return d ? `${d.slice(8)}/${d.slice(5, 7)}` : '';
}
