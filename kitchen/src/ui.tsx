import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { useStore } from './store';
import type { CollectionKey, Video } from './types';
import { embedUrl, thumbUrl, watchUrl } from './youtube';
import { IS_ARTIFACT } from './env';

/* ---------------- transient UI state (not persisted) ---------------- */

export const useUi = create<{ playing: Video | null; play: (v: Video | null) => void }>((set) => ({
  playing: null,
  play: (playing) => set({ playing }),
}));

/* ---------------- layout ---------------- */

export function Header({ title, back, children, tone }: { title: string; back?: string; children?: ReactNode; tone?: string }) {
  const nav = useNavigate();
  return (
    <header className="topbar" style={tone ? ({ '--tone': tone } as React.CSSProperties) : undefined}>
      {back !== undefined ? (
        <button className="icon-btn" aria-label="חזרה" onClick={() => (back ? nav(back) : nav(-1))}>
          →
        </button>
      ) : (
        <span className="icon-btn ghost" />
      )}
      <h1>{title}</h1>
      <div className="topbar-end">
        {children}
        <Link to="/" className="icon-btn" aria-label="דף הבית">
          ⌂
        </Link>
      </div>
    </header>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="סגירה" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- small widgets ---------------- */

export function Stars({ value, onChange, small }: { value: number; onChange?: (v: number) => void; small?: boolean }) {
  return (
    <div className={`stars${small ? ' small' : ''}`} aria-label={`דירוג ${value} מתוך 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= value ? 'on' : ''}
          disabled={!onChange}
          aria-label={`${n} כוכבים`}
          onClick={(e) => {
            e.stopPropagation();
            onChange?.(n === value ? 0 : n);
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

const TILE_HUES = [350, 20, 40, 145, 190, 220, 265, 320];

export function Thumb({ id, alt, icon }: { id: string; alt: string; icon?: string }) {
  const [broken, setBroken] = useState(false);
  // The chat view blocks images from other sites, so it gets a colored tile instead.
  if (!id || broken || IS_ARTIFACT) {
    const hue = TILE_HUES[[...(id || alt)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TILE_HUES.length];
    return (
      <div className="thumb thumb-empty" style={{ '--hue': hue } as React.CSSProperties} aria-hidden>
        {icon ?? '🍽️'}
      </div>
    );
  }
  return <img className="thumb" src={thumbUrl(id)} alt={alt} loading="lazy" onError={() => setBroken(true)} />;
}

export function CollectionButtons({ kind, id }: { kind: 'video' | 'recipe'; id: string }) {
  const collections = useStore((s) => s.collections);
  const toggle = useStore((s) => s.toggleCollection);
  const btn = (key: CollectionKey, label: string) => {
    const on = collections[key].some((e) => e.kind === kind && e.id === id);
    return (
      <button
        type="button"
        className={`chip ${key}${on ? ' on' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          toggle(key, kind, id);
        }}
      >
        {on ? `✓ ב${label}` : `+ הוסף ל${label}`}
      </button>
    );
  };
  return (
    <div className="chips">
      {btn('shabbat', 'שבת')}
      {btn('chag', 'חג')}
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="search">
      <span aria-hidden>🔍</span>
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button className="icon-btn" aria-label="ניקוי" onClick={() => onChange('')}>
          ✕
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

/* ---------------- in-app YouTube player ---------------- */

export function Player() {
  const playing = useUi((s) => s.playing);
  const play = useUi((s) => s.play);
  const chef = useStore((s) => s.chefs.find((c) => c.id === playing?.chefId));
  if (!playing) return null;
  return (
    <Modal title={playing.title} onClose={() => play(null)} wide>
      {IS_ARTIFACT ? (
        // The chat view can't embed other sites, so the video opens in YouTube.
        <a className="player player-link" href={watchUrl(playing.youtubeId)} target="_blank" rel="noreferrer">
          <Thumb id={playing.youtubeId} alt={playing.title} />
          <span className="play-badge">▶</span>
          <span className="player-cta">צפייה ביוטיוב</span>
        </a>
      ) : (
        <div className="player">
          <iframe
            src={embedUrl(playing.youtubeId)}
            title={playing.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}
      <div className="row between wrap gap">
        <span className="muted">{chef?.name}</span>
        <a className="muted small" href={watchUrl(playing.youtubeId)} target="_blank" rel="noreferrer">
          פתיחה ביוטיוב ↗
        </a>
      </div>
    </Modal>
  );
}

/* ---------------- in-page confirmation (Artifact viewers block window.confirm) ---------------- */

const useAsk = create<{ msg: string | null; resolve: ((ok: boolean) => void) | null }>(() => ({ msg: null, resolve: null }));

export function ask(msg: string): Promise<boolean> {
  useAsk.getState().resolve?.(false);
  return new Promise((resolve) => useAsk.setState({ msg, resolve }));
}

export const confirmDelete = (what: string) => ask(`למחוק את ${what}?`);

export function ConfirmDialog() {
  const { msg, resolve } = useAsk();
  if (!msg) return null;
  const done = (ok: boolean) => {
    useAsk.setState({ msg: null, resolve: null });
    resolve?.(ok);
  };
  return (
    <div className="backdrop confirm-backdrop" onClick={() => done(false)}>
      <div className="sheet confirm" role="alertdialog" aria-label={msg} onClick={(e) => e.stopPropagation()}>
        <p className="confirm-msg">{msg}</p>
        <div className="row gap">
          <button className="btn danger grow" onClick={() => done(true)} autoFocus>
            כן
          </button>
          <button className="btn ghost grow" onClick={() => done(false)}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
