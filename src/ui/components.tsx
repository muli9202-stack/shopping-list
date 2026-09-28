import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export function Header({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: string;
  /** Route to go back to; omitted on the home screen. */
  back?: string;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="header">
      {back !== undefined && (
        <button className="icon-btn back" onClick={() => navigate(back)} aria-label="חזרה">
          →
        </button>
      )}
      <div className="header-titles">
        <h1>{title}</h1>
        {subtitle && <div className="header-sub">{subtitle}</div>}
      </div>
      <div className="header-actions">{actions}</div>
    </header>
  );
}

export function Tile({
  to,
  onClick,
  title,
  subtitle,
  icon,
  className = '',
  badge,
}: {
  to?: string;
  onClick?: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
  badge?: ReactNode;
}) {
  const inner = (
    <>
      {badge !== undefined && badge !== null && <span className="tile-badge">{badge}</span>}
      {icon && <span className="tile-icon">{icon}</span>}
      <span className="tile-title">{title}</span>
      {subtitle && <span className="tile-sub">{subtitle}</span>}
    </>
  );
  return to ? (
    <Link to={to} className={`tile ${className}`}>
      {inner}
    </Link>
  ) : (
    <button className={`tile ${className}`} onClick={onClick}>
      {inner}
    </button>
  );
}

export function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="הוספה">
        +
      </button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(value - 1)} aria-label="הפחתה">
        −
      </button>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}
