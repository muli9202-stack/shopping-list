/** "ינשופי" – the app's owl guide, drawn as an original SVG. */
export function Mascot({ size = 110, mood = 'happy', cheer }: { size?: number; mood?: 'happy' | 'wow' | 'think'; cheer?: boolean }) {
  return (
    <span className={`mascot ${cheer ? 'cheer' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden>
        <ellipse cx="60" cy="112" rx="30" ry="5" fill="rgba(0,0,0,.12)" />
        <path d="M30 40 L24 14 L46 30 Z" fill="#8d5a2b" />
        <path d="M90 40 L96 14 L74 30 Z" fill="#8d5a2b" />
        <ellipse cx="60" cy="68" rx="40" ry="42" fill="#b07642" />
        <ellipse cx="60" cy="80" rx="26" ry="28" fill="#f3d9b1" />
        <path d="M48 76 q4 4 8 0 M58 84 q4 4 8 0 M48 92 q4 4 8 0 M64 76 q4 4 8 0" stroke="#d9b98a" strokeWidth="2" fill="none" />
        <ellipse cx="22" cy="72" rx="10" ry="22" fill="#8d5a2b" className="wing-l">
          <animateTransform attributeName="transform" type="rotate" values="0 22 55;-14 22 55;0 22 55" dur="1.6s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="98" cy="72" rx="10" ry="22" fill="#8d5a2b">
          <animateTransform attributeName="transform" type="rotate" values="0 98 55;14 98 55;0 98 55" dur="1.6s" repeatCount="indefinite" />
        </ellipse>
        <circle cx="44" cy="48" r="17" fill="#fff" />
        <circle cx="76" cy="48" r="17" fill="#fff" />
        <circle cx={mood === 'think' ? 48 : 45} cy={mood === 'think' ? 44 : 49} r={mood === 'wow' ? 9 : 7} fill="#2b2d42" />
        <circle cx={mood === 'think' ? 80 : 75} cy={mood === 'think' ? 44 : 49} r={mood === 'wow' ? 9 : 7} fill="#2b2d42" />
        <circle cx="47" cy="46" r="2.5" fill="#fff" />
        <circle cx="77" cy="46" r="2.5" fill="#fff" />
        <rect x="27" y="30" width="34" height="0" fill="#b07642">
          <animate attributeName="height" values="0;0;36;0" keyTimes="0;0.92;0.96;1" dur="4s" repeatCount="indefinite" />
        </rect>
        <rect x="59" y="30" width="34" height="0" fill="#b07642">
          <animate attributeName="height" values="0;0;36;0" keyTimes="0;0.92;0.96;1" dur="4s" repeatCount="indefinite" />
        </rect>
        <path d="M54 58 L66 58 L60 70 Z" fill="#ffb703" />
        <path d="M44 108 l-4 6 M50 108 l0 7 M70 108 l0 7 M76 108 l4 6" stroke="#ffb703" strokeWidth="4" strokeLinecap="round" />
        <path d="M36 22 q24 -16 48 0 l-4 6 q-20 -10 -40 0 Z" fill="#8338ec" />
        <circle cx="60" cy="10" r="5" fill="#ff5d8f" />
      </svg>
    </span>
  );
}

export function MascotSays({ text, mood, cheer, size }: { text: string; mood?: 'happy' | 'wow' | 'think'; cheer?: boolean; size?: number }) {
  return (
    <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
      <Mascot mood={mood} cheer={cheer} size={size ?? 90} />
      <div className="bubble">{text}</div>
    </div>
  );
}
