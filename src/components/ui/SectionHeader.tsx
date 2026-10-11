import React from 'react';
import { AppIcon } from './AppIcon';
import { useTranslation } from '../../utils/i18n';

export interface SectionHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  seeAllLabel?: React.ReactNode;
  actionLabel?: React.ReactNode;
  onSeeAll?: () => void;
  onAction?: () => void;
  rightSlot?: React.ReactNode;
  className?: string;
}

/**
 * SectionHeader: title (.t-title navy) on the start side and an optional
 * "See all" link (13px/500 slate with chevron) on the end side.
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  seeAllLabel,
  actionLabel,
  onSeeAll,
  onAction,
  rightSlot,
  className = '',
}) => {
  const { language } = useTranslation();
  const isEn = language.startsWith('en');

  const handleAction = onSeeAll || onAction;
  const label = seeAllLabel ?? actionLabel ?? (isEn ? 'See all' : 'عرض الكل');

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`.trim()}>
      <div className="min-w-0">
        <h2 className="t-title text-navy truncate">{title}</h2>
        {subtitle && (
          <p className="t-meta text-slate truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      {rightSlot ? (
        <div className="shrink-0 flex items-center gap-2">{rightSlot}</div>
      ) : handleAction ? (
        <button
          type="button"
          onClick={handleAction}
          className="text-[13px] font-medium text-slate hover:text-navy inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0 select-none"
        >
          <span>{label}</span>
          <AppIcon name="chevronEnd" size={14} weight="regular" mirrorRtl />
        </button>
      ) : null}
    </div>
  );
};

export default SectionHeader;
