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
  /** Callback when bell icon is clicked */
  onOpenNotifications?: () => void;
  /** Callback when gear icon is clicked (opens Settings) */
  onOpenSettings?: () => void;
  className?: string;
}

/**
 * ScreenHeader:
 * - Start side: title (.t-display navy, max 2 lines, optional accent word in orange)
 * - End side: bell (AppIcon fill, navy, 26px, no container, orange dot if unread)
 *             gear (AppIcon fill, navy, 26px, no container, opens Settings)
 */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  accentWord,
  hasUnreadNotifications = false,
  onOpenNotifications,
  onOpenSettings,
  className = '',
}) => {
  const { t, language } = useTranslation();
  const isEn = language.startsWith('en');

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

      {/* End side: Bell and Gear (AppIcon fill, navy, 26px, no container) */}
      <div className="flex items-center gap-3.5 shrink-0">
        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label={t('smartNotifications') || (isEn ? 'Notifications' : 'الإشعارات')}
            title={t('smartNotifications') || (isEn ? 'Notifications' : 'الإشعارات')}
            className="relative w-11 h-11 text-navy hover:text-navy/80 active:scale-95 transition-transform cursor-pointer flex items-center justify-center"
          >
            <AppIcon name="bell" weight="fill" size={26} />
            {hasUnreadNotifications && (
              <span
                aria-hidden="true"
                className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-orange ring-2 ring-page"
              />
            )}
          </button>
        )}

        {onOpenSettings && (
          <button
            type="button"
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
