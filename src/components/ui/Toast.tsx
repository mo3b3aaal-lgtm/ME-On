import React, { useEffect } from 'react';
import { AppIcon, type AppIconName } from './AppIcon';
import { useTranslation } from '../../utils/i18n';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastProps {
  isOpen: boolean;
  message: string;
  type?: ToastType;
  onClose?: () => void;
  autoCloseMs?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Toast: bg navy, white text, radius 18px, shadow-navy,
 * small colored icon (teal/orange/coral), positioned above the floating nav, slide-up in 250ms.
 */
export const Toast: React.FC<ToastProps> = ({
  isOpen,
  message,
  type = 'success',
  onClose,
  autoCloseMs = 3000,
  action,
}) => {
  const { isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  useEffect(() => {
    if (!isOpen || !onClose || !autoCloseMs) return;
    const timer = setTimeout(() => {
      onClose();
    }, autoCloseMs);
    return () => clearTimeout(timer);
  }, [isOpen, onClose, autoCloseMs]);

  if (!isOpen) return null;

  const iconName: AppIconName = {
    success: 'check' as AppIconName,
    warning: 'warning' as AppIconName,
    error: 'warning' as AppIconName,
    info: 'info' as AppIconName,
  }[type];

  const iconColorClass = {
    success: 'text-teal',
    warning: 'text-orange',
    error: 'text-coral',
    info: 'text-mint',
  }[type];

  return (
    <div
      role="status"
      aria-live="polite"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed bottom-24 inset-x-4 max-w-md mx-auto z-50 pointer-events-none select-none"
    >
      <div className="pointer-events-auto bg-navy text-white px-4 py-3 rounded-[18px] shadow-navy border border-white/10 flex items-center justify-between gap-3 animate-toast-slide-up">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`shrink-0 ${iconColorClass}`}>
            <AppIcon name={iconName} size={18} weight="bold" />
          </div>
          <span className="text-xs sm:text-sm font-semibold truncate leading-tight">
            {message}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="text-xs font-bold text-orange hover:text-orange-deep px-2 py-1 rounded-lg cursor-pointer"
            >
              {action.label}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label={isEn ? 'Close' : 'إغلاق'}
            >
              <AppIcon name="close" size={14} weight="bold" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Toast;
