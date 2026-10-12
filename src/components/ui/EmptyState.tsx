import React from 'react';
import { EmptyBox } from '../illustrations/EmptyBox';
import { AppIcon, type AppIconName } from './AppIcon';

export interface EmptyStateProps {
  illustration?: React.ReactNode;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: AppIconName;
  className?: string;
}

/**
 * Empty states: illustrations from task 8 + one line + btn-orange where an action exists.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  illustration,
  message,
  actionLabel,
  onAction,
  actionIcon,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 max-w-sm mx-auto select-none space-y-4 ${className}`.trim()}
    >
      <div className="w-40 max-w-full mx-auto flex items-center justify-center text-navy/40">
        {illustration ?? <EmptyBox />}
      </div>

      <p className="t-meta text-slate text-sm font-medium leading-relaxed">
        {message}
      </p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="btn-orange inline-flex items-center gap-2"
        >
          {actionIcon && <AppIcon name={actionIcon} size={16} weight="bold" />}
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};

export default EmptyState;
