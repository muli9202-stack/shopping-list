// Renders an illustration spec. Always labeled "המחשה להסבר", with its assumptions and
// sources; every element that has a source opens it when clicked.
import { engine } from '../brain/engine';
import type { FlowIllus, Illustration, SceneIllus, TimelineIllus } from '../core/illustration';
import { useStudy } from '../state/store';

/** Opens a ref from an illustration: a line on the open page, a comment on it, or another source. */
export async function goToRef(ref: string) {
  const s = useStudy.getState();
  const section = s.section;
  if (!section) return;
  if (ref.startsWith(`${section.ref}:`)) {
    const seg = Number(ref.slice(section.ref.length + 1).split(':')[0]);
    s.set({ focusSeg: seg, highlight: { ref: section.ref, seg, epoch: s.epoch } });
    return;
  }
  const m = ref.match(/^(.*) on (.*) (\S+?):(\d+):\d+$/);
  if (m && `${m[2]} ${m[3]}` === section.ref) {
    await engine.openCommentary(m[1]);
    useStudy.getState().set({ commentHighlight: ref, focusSeg: Number(m[4]), highlight: { ref: section.ref, seg: Number(m[4]), epoch: useStudy.getState().epoch } });
    return;
  }
  await engine.openRef(ref, { silent: true });
}

const W = 640;

function Timeline({ il }: { il: TimelineIllus }) {
  const left = 40;
  const right = W - 40;
  // Right-to-left: the start of the night is on the right.
  const x = (at: number) => right - at * (right - left);
  const rows = il.ranges.length;
  const H = 170 + rows * 26;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="illus-svg" role="img" aria-label={il.title}>
      <line x1={left} x2={right} y1={60} y2={60} className="axis" />
      <text x={right} y={126} textAnchor="middle" className="axis-label">
        {il.startLabel}
      </text>
      <text x={left} y={126} textAnchor="middle" className="axis-label">
        {il.endLabel}
      </text>
      {il.points.map((p, i) => {
        // Alternate labels above and below the axis so neighbours do not overlap.
        const above = i % 2 === 0;
        return (
          <g key={i} className={p.ref ? 'clickable' : ''} onClick={() => p.ref && goToRef(p.ref)} tabIndex={p.ref ? 0 : -1} role={p.ref ? 'button' : undefined}>
            <circle cx={x(p.at)} cy={60} r={7} className="pt" />
            {p.who && (
              <text x={x(p.at)} y={above ? 20 : 86} textAnchor="middle" className="pt-who">
                {p.who}
              </text>
            )}
            <text x={x(p.at)} y={above ? 40 : 104} textAnchor="middle" className="pt-label">
              {p.label}
            </text>
          </g>
        );
      })}
      {il.ranges.map((r, i) => (
        <g key={i} className={r.ref ? 'clickable' : ''} onClick={() => r.ref && goToRef(r.ref)} role={r.ref ? 'button' : undefined} tabIndex={r.ref ? 0 : -1}>
          <rect x={x(Math.max(r.from, r.to))} y={140 + i * 26} width={Math.abs(x(r.from) - x(r.to))} height={16} rx={8} className={`range c${i % 4}`} />
          <text x={x(r.from) - 8} y={153 + i * 26} textAnchor="start" className="range-label">
            {r.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Scene({ il }: { il: SceneIllus }) {
  const u = W / 12;
  const H = 7 * u;
  const byId = new Map(il.entities.map((e) => [e.id, e]));
  const cx = (e: SceneIllus['entities'][number]) => W - (e.x + (e.w ?? 0) / 2) * u;
  const cy = (e: SceneIllus['entities'][number]) => (e.y + (e.h ?? 0) / 2) * u;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="illus-svg" role="img" aria-label={il.title}>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="arrow-head" />
        </marker>
      </defs>
      {il.entities
        .filter((e) => e.shape === 'area' || e.shape === 'wall')
        .map((e) => (
          <g key={e.id} className={e.ref ? 'clickable' : ''} onClick={() => e.ref && goToRef(e.ref)}>
            <rect x={W - (e.x + (e.w ?? 1)) * u} y={e.y * u} width={(e.w ?? 1) * u} height={(e.h ?? 1) * u} className={e.shape} />
            <text x={cx(e)} y={e.y * u + 18} textAnchor="middle" className="ent-label">
              {e.label}
            </text>
          </g>
        ))}
      {il.arrows.map((a, i) => {
        const f = byId.get(a.from);
        const t = byId.get(a.to);
        if (!f || !t) return null;
        return (
          <g key={i}>
            <line x1={cx(f)} y1={cy(f)} x2={cx(t)} y2={cy(t)} className="arrow" markerEnd="url(#arr)" />
            {a.label && (
              <text x={(cx(f) + cx(t)) / 2} y={(cy(f) + cy(t)) / 2 - 6} textAnchor="middle" className="arrow-label">
                {a.label}
              </text>
            )}
          </g>
        );
      })}
      {il.entities
        .filter((e) => e.shape === 'person' || e.shape === 'object')
        .map((e) => (
          <g key={e.id} className={e.ref ? 'clickable' : ''} onClick={() => e.ref && goToRef(e.ref)} role={e.ref ? 'button' : undefined} tabIndex={e.ref ? 0 : -1}>
            {e.shape === 'person' ? (
              <>
                <circle cx={cx(e)} cy={cy(e) - 16} r={10} className="person" />
                <path d={`M${cx(e) - 14} ${cy(e) + 18} Q${cx(e)} ${cy(e) - 10} ${cx(e) + 14} ${cy(e) + 18} Z`} className="person" />
              </>
            ) : (
              <rect x={cx(e) - 14} y={cy(e) - 12} width={28} height={24} rx={4} className="object" />
            )}
            <text x={cx(e)} y={cy(e) + 36} textAnchor="middle" className="ent-label">
              {e.label}
            </text>
          </g>
        ))}
    </svg>
  );
}

const FLOW_HE: Record<FlowIllus['steps'][number]['type'], string> = {
  statement: 'מימרא',
  question: 'קושיה',
  answer: 'תירוץ',
  proof: 'ראיה',
  rejection: 'דחייה',
  conclusion: 'מסקנה',
};

function Flow({ il }: { il: FlowIllus }) {
  return (
    <ol className="flow">
      {il.steps.map((s, i) => (
        <li key={i} className={`flow-step t-${s.type}`}>
          <span className="flow-type">{FLOW_HE[s.type]}</span>
          {s.ref ? (
            <button className="link-btn" onClick={() => goToRef(s.ref!)}>
              {s.label}
            </button>
          ) : (
            <span>{s.label}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

export function IllustrationView({ il, onClose }: { il: Illustration; onClose: () => void }) {
  return (
    <section className="illustration" aria-label={`המחשה: ${il.title}`}>
      <header>
        <span className="badge">המחשה להסבר</span>
        <h3>{il.title}</h3>
        <button className="icon-btn" aria-label="סגור המחשה" onClick={onClose}>
          ✕
        </button>
      </header>
      {il.changed && <p className="changed">מה השתנה: {il.changed}</p>}
      {il.kind === 'timeline' && <Timeline il={il} />}
      {il.kind === 'scene' && <Scene il={il} />}
      {il.kind === 'flow' && <Flow il={il} />}
      {il.kind === 'table' && (
        <table className="illus-table">
          <thead>
            <tr>
              {il.columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {il.rows.map((r, i) => (
              <tr key={i} className={r.ref ? 'clickable' : ''} onClick={() => r.ref && goToRef(r.ref)}>
                {r.cells.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {il.assumptions.length > 0 && (
        <div className="assumptions">
          <strong>הנחות:</strong>
          <ul>
            {il.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {il.sources.length > 0 && (
        <p className="illus-sources">
          מקורות:{' '}
          {il.sources.map((s) => (
            <button key={s.ref} className="chip" onClick={() => goToRef(s.ref)}>
              {s.label}
            </button>
          ))}
        </p>
      )}
      <p className="muted small">המחשה להסבר בלבד. שינוי בה אינו פסק הלכה.</p>
    </section>
  );
}
