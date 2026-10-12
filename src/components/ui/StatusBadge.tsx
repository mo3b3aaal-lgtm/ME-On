import React from 'react';
import { AppIcon, type AppIconName } from './AppIcon';

export type StatusBadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

/**
 * Single mapping object from all existing application statuses to the 4 Harbor Mint StatusBadge variants.
 * Does NOT change any status values or labels.
 */
export const STATUS_VARIANT_MAP: Record<string, StatusBadgeVariant> = {
  // Attendance statuses
  present: 'success',
  late: 'warning',
  absent_charged: 'danger',
  absent: 'danger',
  absent_free: 'neutral',
  excused: 'neutral',
  not_recorded: 'neutral',
  'not recorded': 'neutral',
  unrecorded: 'neutral',

  // Session statuses
  completed: 'success',
  scheduled: 'warning',
  incomplete: 'warning',
  cancelled: 'neutral',

  // Payment & Billing statuses
  paid: 'success',
  fully_paid: 'success',
  settled: 'success',
  has_credit: 'success',
  partial: 'warning',
  partially_paid: 'warning',
  package_nearly_used: 'warning',
  'package nearly used': 'warning',
  nearly_used: 'warning',
  low_credit: 'warning',
  unpaid: 'danger',
  overdue: 'danger',
  has_due: 'danger',
  zero_credit: 'danger',
  depleted: 'danger',
  default: 'neutral',

  // Student & Enrollment statuses
  active: 'success',
  paused: 'warning',
  stopped: 'danger',
  archived: 'neutral',
  inactive: 'neutral',

  // Behavior categories
  positive: 'success',
  needs_improvement: 'danger',
  neutral: 'neutral',

  // Credit log types
  purchase: 'success',
  refund: 'warning',
  consumption: 'neutral',
  adjustment: 'neutral',

  // Notification & System / Network statuses
  resolved: 'success',
  dismissed: 'neutral',
  online: 'success',
  synced: 'success',
  connected: 'success',
  SUCCESS_HEALTHY: 'success',
  syncing: 'warning',
  pending: 'warning',
  HTTP_ERROR: 'warning',
  offline: 'danger',
  error: 'danger',
  NETWORK_EXCEPTION: 'danger',
  idle: 'neutral',
};

export function getStatusVariant(
  status?: string | null,
  fallback: StatusBadgeVariant = 'neutral'
): StatusBadgeVariant {
  if (!status) return fallback;
  const direct = STATUS_VARIANT_MAP[status];
  if (direct) return direct;
  const normalized = status.trim().toLowerCase();
  return STATUS_VARIANT_MAP[normalized] || fallback;
}

const VARIANT_CONFIG: Record<
  StatusBadgeVariant,
  {
    className: string;
    icon: AppIconName;
    iconWeight: 'fill' | 'regular';
  }
> = {
  success: {
    className: 'bg-teal/12 text-teal',
    icon: 'check',
    iconWeight: 'regular',
  },
  warning: {
    className: 'bg-orange/15 text-orange-deep',
    icon: 'clock',
    iconWeight: 'fill',
  },
  danger: {
    className: 'bg-coral/12 text-coral',
    icon: 'warning',
    iconWeight: 'fill',
  },
  neutral: {
    className: 'bg-mint-soft text-slate',
    icon: 'minus',
    iconWeight: 'regular',
  },
};

export interface StatusBadgeProps {
  /** Existing status value (e.g. 'present', 'late', 'absent_charged', 'paid', 'unpaid', 'overdue', 'archived'...) */
  status?: string | null;
  /** Optional explicit variant override ('success' | 'warning' | 'danger' | 'neutral') */
  variant?: StatusBadgeVariant;
  /** Label text to display (preserves existing localized labels) */
  label?: React.ReactNode;
  children?: React.ReactNode;
  /** Optional custom icon name override (defaults to variant's semantic icon: check, clock, warning, minus) */
  iconName?: AppIconName;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  title?: string;
}

/**
 * StatusBadge:
 * - Pill 11px/600, icon 12px + text, never color-only.
 * - Variants:
 *   - success: teal text on teal/12 bg, check
 *   - warning: orange-deep on orange/15, clock
 *   - danger: coral on coral/12, warning
 *   - neutral: slate on mint-soft, minus
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  label,
  children,
  iconName,
  className = '',
  onClick,
  title,
}) => {
  const resolvedVariant = variant ?? getStatusVariant(status, 'neutral');
  const config = VARIANT_CONFIG[resolvedVariant];
  const finalIcon = iconName ?? config.icon;
  const content = children ?? label ?? status;

  const baseClasses = `inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap shrink-0 select-none ${config.className} ${
    onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''
  } ${className}`.trim();

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={baseClasses}
      >
        <AppIcon name={finalIcon} size={12} weight={config.iconWeight} />
        <span>{content}</span>
      </button>
    );
  }

  return (
    <span title={title} className={baseClasses}>
      <AppIcon name={finalIcon} size={12} weight={config.iconWeight} />
      <span>{content}</span>
    </span>
  );
};

export default StatusBadge;
