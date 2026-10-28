import React from 'react';
import { AppIcon } from './AppIcon';
import { useTranslation } from '../../utils/i18n';

export interface ScreenHeaderProps {
  /** Screen title (max 2 lines, .t-display navy) */
  title: React.ReactNode;
  /** Optional accent word in orange */
  accentWord?: string;
  /** Whether there are unread notifications (shows a small orange dot on bell) */
  hasUnreadNotifications?: boolean;
  /** Unread notification count (renders compact numeric badge on bell when > 0) */
  unreadCount?: number;
  /** Callback when timetable icon is clicked (opens Fixed Weekly Timetable) */
  onOpenTimetable?: () => void;
  /** Callback when bell icon is clicked */
  onOpenNotifications?: () => void;
  /** Callback when gear icon is clicked (opens Settings) */
  onOpenSettings?: () => void;
  className?: string;
}

/**
 * ScreenHeader:
 * - Start side: title (.t-display navy, max 2 lines, optional accent word in orange)
 * - End side: timetable (AppIcon fill, navy, 26px, immediately adjacent to bell)
 *             bell (AppIcon fill, navy, 26px, no container, orange badge/dot if unread)
 *             gear (AppIcon fill, navy, 26px, no container, opens Settings)
 */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  accentWord,
  hasUnreadNotifications = false,
  unreadCount,
  onOpenTimetable,
  onOpenNotifications,
  onOpenSettings,
  className = '',
}) => {
  const { t, language } = useTranslation();
  const isEn = language.startsWith('en');
  const effectiveUnreadCount = typeof unreadCount === 'number' ? Math.max(0, unreadCount) : 0;
  const showDotOnly = unreadCount === undefined && hasUnreadNotifications;

  return (
    <header
      className={`flex items-center justify-between gap-3 pt-[calc(4px+env(safe-area-inset-top,0px))] select-none ${className}`.trim()}
    >
      {/* Start side: Title (.t-display navy, max 2 lines, optional accent word in orange) */}
      <div className="flex-1 min-w-0 text-start">
        <h1 className="t-display text-navy line-clamp-2">
          {accentWord ? (
            <>
              {title} <span className="text-orange">{accentWord}</span>
            </>
          ) : (
            title
          )}
        </h1>
      </div>

      {/* End side: Timetable, Bell, and Gear (AppIcon fill, navy, 26px, no container) */}
      <div className="flex items-center gap-3.5 shrink-0">
        {onOpenTimetable && (
          <button
            type="button"
            data-testid="header-timetable-btn"
            onClick={onOpenTimetable}
            aria-label={isEn ? 'Fixed Weekly Timetable' : 'الجدول الأسبوعي الثابت'}
            title={isEn ? 'Fixed Weekly Timetable' : 'الجدول الأسبوعي الثابت'}
            className="relative w-11 h-11 text-navy hover:text-navy/80 active:scale-95 transition-transform cursor-pointer flex items-center justify-center"
          >
            <AppIcon name="calendarDays" weight="fill" size={26} />
          </button>
        )}

        {onOpenNotifications && (
          <button
            type="button"
            data-tutorial-id="header-notifications-btn"
            onClick={onOpenNotifications}
            aria-label={
              effectiveUnreadCount > 0
                ? `${t('smartNotifications') || (isEn ? 'Notifications' : 'الإشعارات')} (${effectiveUnreadCount})`
                : t('smartNotifications') || (isEn ? 'Notifications' : 'الإشعارات')
            }
            title={t('smartNotifications') || (isEn ? 'Notifications' : 'الإشعارات')}
            className="relative w-11 h-11 text-navy hover:text-navy/80 active:scale-95 transition-transform cursor-pointer flex items-center justify-center"
          >
            <AppIcon name="bell" weight="fill" size={26} />
            {effectiveUnreadCount > 0 ? (
              <span
                aria-hidden="true"
                className="absolute top-0.5 end-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange text-white text-[10px] font-black leading-none flex items-center justify-center ring-2 ring-page"
              >
                {effectiveUnreadCount > 99 ? '99+' : effectiveUnreadCount}
              </span>
            ) : showDotOnly ? (
              <span
                aria-hidden="true"
                className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-orange ring-2 ring-page"
              />
            ) : null}
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
            data-tutorial-id="header-settings-btn"
            onClick={onOpenSettings}
            aria-label={t('navSettings') || (isEn ? 'Settings' : 'الإعدادات')}
            title={t('navSettings') || (isEn ? 'Settings' : 'الإعدادات')}
            className="relative w-11 h-11 text-navy hover:text-navy/80 active:scale-95 transition-transform cursor-pointer flex items-center justify-center"
          >
            <AppIcon name="settings" weight="fill" size={26} />
          </button>
        )}
      </div>
    </header>
  );
};

export default ScreenHeader;
