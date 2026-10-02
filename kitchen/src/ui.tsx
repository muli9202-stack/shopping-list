import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { useStore } from './store';
import type { CollectionKey, Video } from './types';
import { embedUrl, thumbUrl, watchUrl } from './youtube';

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

export function Thumb({ id, alt }: { id: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (!id || broken) return <div className="thumb thumb-empty">🍽️</div>;
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
      <div className="player">
        <iframe
          src={embedUrl(playing.youtubeId)}
          title={playing.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <div className="row between wrap gap">
        <span className="muted">{chef?.name}</span>
        <a className="muted small" href={watchUrl(playing.youtubeId)} target="_blank" rel="noreferrer">
          פתיחה ביוטיוב ↗
        </a>
      </div>
    </Modal>
  );
}

export const confirmDelete = (what: string) => window.confirm(`למחוק את ${what}?`);
