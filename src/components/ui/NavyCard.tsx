import React from 'react';

export interface NavyDecorProps {
  className?: string;
}

/**
 * Decorative background circle outlines for NavyCard:
 * 2-3 large circle outlines (stroke rgba(255,255,255,.08), 2px) partially clipped at the corners/behind content.
 */
export const NavyDecor: React.FC<NavyDecorProps> = ({ className = '' }) => {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none select-none absolute inset-0 w-full h-full z-0 ${className}`.trim()}
      viewBox="0 0 400 220"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <circle
        cx="365"
        cy="-20"
        r="110"
        stroke="var(--color-page)"
        strokeOpacity="0.08"
        strokeWidth="2"
      />
      <circle
        cx="365"
        cy="-20"
        r="72"
        stroke="var(--color-page)"
        strokeOpacity="0.08"
        strokeWidth="2"
      />
      <circle
        cx="25"
        cy="235"
        r="96"
        stroke="var(--color-page)"
        strokeOpacity="0.08"
        strokeWidth="2"
      />
    </svg>
  );
};

export interface NavyCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  showDecor?: boolean;
  clickable?: boolean;
}

/**
 * NavyCard: bg navy, white text, radius 28px, padding 20px, shadow-navy, overflow hidden,
 * and a NavyDecor layer partially clipped at the corners/behind the content.
 */
export const NavyCard: React.FC<NavyCardProps> = ({
  children,
  className = '',
  showDecor = true,
  clickable = false,
  onClick,
  ...rest
}) => {
  const isInteractive = clickable || Boolean(onClick);
  const interactiveClasses = isInteractive
    ? 'cursor-pointer active:scale-[0.97] transition-transform duration-150 select-none'
    : '';

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-navy text-page rounded-[var(--radius-hero)] p-5 shadow-navy ${interactiveClasses} ${className}`.trim()}
      {...rest}
    >
      {showDecor && <NavyDecor />}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default NavyCard;
