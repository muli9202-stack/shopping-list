// The chavruta's figure. Drawn locally in SVG: a respectful study partner with gentle head
// motion and blinking. The mouth is driven directly by the speech layer (mouth.subscribe),
// so it moves only while audio plays and closes the instant speech stops.
import { useEffect, useRef } from 'react';
import { brainMode } from '../brain/engine';
import { AVATAR_LABEL, mouth, useStudy, type AvatarState, type Settings } from '../state/store';

const SKIN = { young: '#e9c4a0', elder: '#e3bd98', woman: '#ecc7a4' };

function Background({ kind }: { kind: Settings['background'] }) {
  if (kind === 'plain') return <rect width="240" height="240" fill="var(--avatar-bg-plain)" />;
  const shelves = kind === 'beit-midrash' ? ['#7a4a2a', '#8b5a34', '#6e4126'] : ['#3e5c76', '#4b6c88', '#2f4a62'];
  const books = ['#7d1f1f', '#1f4e79', '#2f5d3a', '#6b4f1d', '#4a2c5c', '#8a6a2a'];
  return (
    <g>
      <rect width="240" height="240" fill={kind === 'beit-midrash' ? '#d9c7a7' : '#c9d3dc'} />
      {[30, 85, 140, 195].map((y, row) => (
        <g key={y}>
          {Array.from({ length: 22 }, (_, i) => (
            <rect key={i} x={i * 11 + (row % 2) * 4} y={y - 34} width={9} height={32 - ((i * 7 + row) % 5)} rx={1} fill={books[(i + row) % books.length]} opacity={0.55} />
          ))}
          <rect x="0" y={y - 2} width="240" height="6" fill={shelves[row % 3]} opacity={0.8} />
        </g>
      ))}
      {kind === 'beit-midrash' && <rect x="0" y="0" width="240" height="240" fill="url(#warm)" />}
    </g>
  );
}

function Figure({ look, state }: { look: Settings['look']; state: AvatarState }) {
  const mouthRef = useRef<SVGEllipseElement>(null);
  const lidRef = useRef<SVGGElement>(null);

  useEffect(
    () =>
      mouth.subscribe((v) => {
        const m = mouthRef.current;
        if (!m) return;
        m.setAttribute('ry', (0.6 + v * 6).toFixed(2));
        m.setAttribute('rx', (7 - v * 1.5).toFixed(2));
      }),
    [],
  );

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const blink = () => {
      lidRef.current?.classList.add('blink');
      setTimeout(() => lidRef.current?.classList.remove('blink'), 140);
      t = setTimeout(blink, 2500 + Math.random() * 3500);
    };
    t = setTimeout(blink, 1800);
    return () => clearTimeout(t);
  }, []);

  const skin = SKIN[look];
  const eyeY = state === 'checking' ? 106 : state === 'thinking' ? 100 : 103;
  const eyeDx = state === 'listening' ? -1.5 : 0;
  return (
    <g className={`figure state-${state}`}>
      {/* body */}
      <path d="M50 240 C55 185 85 168 120 168 C155 168 185 185 190 240 Z" fill={look === 'woman' ? '#3d4f6b' : '#1d232d'} />
      {look !== 'woman' && <path d="M104 170 L120 205 L136 170 Z" fill="#f4f4f2" />}
      {look === 'woman' && <path d="M100 172 Q120 186 140 172 L136 182 Q120 192 104 182 Z" fill="#e8e2d6" />}
      <g className="head">
        <rect x="108" y="140" width="24" height="30" rx="10" fill={skin} />
        {look === 'woman' && <path d="M70 108 C68 60 100 44 120 44 C140 44 172 60 170 108 C172 140 160 158 150 162 L90 162 C80 158 68 140 70 108 Z" fill="#6c5a8a" />}
        <ellipse cx="120" cy="108" rx="34" ry="42" fill={skin} />
        {/* hair / kippah / head covering */}
        {look === 'young' && <path d="M86 98 C86 70 100 62 120 62 C140 62 154 70 154 98 C150 84 136 78 120 78 C104 78 90 84 86 98 Z" fill="#3b2a1d" />}
        {look === 'elder' && <path d="M86 98 C86 72 100 64 120 64 C140 64 154 72 154 98 C150 86 136 80 120 80 C104 80 90 86 86 98 Z" fill="#b9b4ab" />}
        {look !== 'woman' && <path d="M100 70 Q120 56 140 70 Q120 64 100 70 Z" fill="#1c2a4a" stroke="#1c2a4a" strokeWidth="6" strokeLinejoin="round" />}
        {look === 'woman' && <path d="M84 96 C84 62 102 52 120 52 C138 52 156 62 156 96 C150 78 136 70 120 70 C104 70 90 78 84 96 Z" fill="#7d6a9c" />}
        {/* beard */}
        {look === 'young' && <path d="M90 118 C92 150 106 160 120 160 C134 160 148 150 150 118 C146 136 136 142 120 142 C104 142 94 136 90 118 Z" fill="#3b2a1d" opacity="0.9" />}
        {look === 'elder' && <path d="M88 116 C88 162 104 176 120 176 C136 176 152 162 152 116 C148 140 136 146 120 146 C104 146 92 140 88 116 Z" fill="#d8d4cc" />}
        {/* eyes */}
        <g ref={lidRef} className="eyes">
          <ellipse cx={105 + eyeDx} cy={eyeY} rx="4" ry="4.4" fill="#2a2420" />
          <ellipse cx={135 + eyeDx} cy={eyeY} rx="4" ry="4.4" fill="#2a2420" />
        </g>
        <path d="M97 93 Q105 89 113 93" stroke="#3b2a1d" strokeWidth="2" fill="none" opacity={look === 'elder' ? 0.4 : 0.8} />
        <path d="M127 93 Q135 89 143 93" stroke="#3b2a1d" strokeWidth="2" fill="none" opacity={look === 'elder' ? 0.4 : 0.8} />
        {look === 'elder' && (
          <g fill="none" stroke="#5b5148" strokeWidth="1.6">
            <circle cx="105" cy="104" r="9" />
            <circle cx="135" cy="104" r="9" />
            <path d="M114 104 L126 104" />
          </g>
        )}
        <path d="M120 106 Q117 118 121 121" stroke="#b78c68" strokeWidth="2" fill="none" />
        <ellipse ref={mouthRef} cx="120" cy="131" rx="7" ry="0.6" fill="#7a3b33" />
      </g>
      {state === 'checking' && (
        <g className="book">
          <path d="M84 214 Q102 206 120 214 L120 236 Q102 228 84 236 Z" fill="#f4ecd8" stroke="#8b6b3a" />
          <path d="M156 214 Q138 206 120 214 L120 236 Q138 228 156 236 Z" fill="#efe4c8" stroke="#8b6b3a" />
        </g>
      )}
    </g>
  );
}

export function Avatar({ compact = false }: { compact?: boolean }) {
  const settings = useStudy((s) => s.settings);
  const state = useStudy((s) => s.avatar);
  const caption = useStudy((s) => s.caption);
  const interim = useStudy((s) => s.interim);
  useStudy((s) => s.settings.apiKey);
  const demo = brainMode() === 'demo';
  return (
    <section className={`avatar ${compact ? 'compact' : ''}`} aria-label="החברותא">
      <div className="avatar-frame">
        {settings.voiceOnly ? (
          <VoiceOnly />
        ) : (
          <svg viewBox="0 0 240 240" role="img" aria-label={`דמות החברותא, ${AVATAR_LABEL[state]}`}>
            <defs>
              <radialGradient id="warm" cx="50%" cy="30%" r="80%">
                <stop offset="0" stopColor="#fff5d6" stopOpacity="0.45" />
                <stop offset="1" stopColor="#5a3a1a" stopOpacity="0.35" />
              </radialGradient>
            </defs>
            <Background kind={settings.background} />
            <Figure look={settings.look} state={state} />
          </svg>
        )}
        <div className={`avatar-state s-${state}`} role="status" aria-live="polite">
          <span className="dot" /> {AVATAR_LABEL[state]}
        </div>
      </div>
      <p className="ai-note">חברותא מבוססת בינה מלאכותית{demo ? ' · מצב הדגמה' : ''}</p>
      {settings.captions && (
        <div className="caption" aria-live="polite">
          {caption ? caption.text : interim ? <span className="interim">אתה: {interim}</span> : null}
        </div>
      )}
    </section>
  );
}

function VoiceOnly() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      mouth.subscribe((v) => {
        if (ref.current) ref.current.style.transform = `scale(${1 + v * 0.35})`;
      }),
    [],
  );
  return (
    <div className="voice-only">
      <div ref={ref} className="voice-orb" />
    </div>
  );
}
