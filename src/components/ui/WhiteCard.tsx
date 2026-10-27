import React from 'react';

export interface WhiteCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  noPadding?: boolean;
  clickable?: boolean;
}

/**
 * WhiteCard: bg white, 1px line border, radius 22px, shadow-white.
 */
export const WhiteCard: React.FC<WhiteCardProps> = ({
  children,
  className = '',
  noPadding = false,
  clickable = false,
  onClick,
  ...rest
}) => {
  const isInteractive = clickable || Boolean(onClick);
  const interactiveClasses = isInteractive
    ? 'cursor-pointer active:scale-[0.99] transition-transform duration-150'
    : '';
  const paddingClass = noPadding ? '' : 'p-4';

  return (
    <div
      onClick={onClick}
      className={`white-card bg-page border border-line rounded-[var(--radius-card)] shadow-white text-navy ${paddingClass} ${interactiveClasses} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
};

export default WhiteCard;
