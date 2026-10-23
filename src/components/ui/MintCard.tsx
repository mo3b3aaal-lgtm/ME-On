import React from 'react';

export interface MintCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  clickable?: boolean;
}

/**
 * MintCard: bg mint, radius 22px, padding 16px, shadow-mint, navy text;
 * pressed state scale .97 when clickable.
 */
export const MintCard: React.FC<MintCardProps> = ({
  children,
  className = '',
  clickable = false,
  onClick,
  ...rest
}) => {
  const isInteractive = clickable || Boolean(onClick);
  const interactiveClasses = isInteractive
    ? 'cursor-pointer active:scale-[0.985] transition-transform duration-120 ease-out select-none will-change-transform'
    : '';

  const hasExplicitBg = className.includes('bg-');
  const defaultBgClasses = hasExplicitBg ? '' : 'bg-mint shadow-mint';

  return (
    <div
      onClick={onClick}
      role={isInteractive && !rest.role ? 'button' : rest.role}
      tabIndex={isInteractive && rest.tabIndex === undefined ? 0 : rest.tabIndex}
      onKeyDown={(e) => {
        if (isInteractive && onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
        rest.onKeyDown?.(e);
      }}
      className={`${defaultBgClasses} text-navy rounded-[var(--radius-card)] p-4 ${interactiveClasses} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
};

export default MintCard;
