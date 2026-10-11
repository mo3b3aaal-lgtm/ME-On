import React, { useEffect, useRef } from 'react';
import { AppIcon } from './AppIcon';
import { useModalLayer, ModalPortal } from '../../contexts/ModalContext';
import { useTranslation } from '../../utils/i18n';

export interface BottomSheetAction {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}

export interface BottomSheetProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerLeading?: React.ReactNode;
  headerTrailing?: React.ReactNode;
  showHandle?: boolean;
  showClose?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  primaryAction?: BottomSheetAction;
  secondaryAction?: BottomSheetAction;
  maxWidthClass?: string;
  zIndex?: number;
  className?: string;
  bodyClassName?: string;
  ariaLabel?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  id = 'bottom-sheet',
  isOpen,
  onClose,
  title,
  subtitle,
  headerLeading,
  headerTrailing,
  showHandle = true,
  showClose = true,
  children,
  footer,
  primaryAction,
  secondaryAction,
  maxWidthClass = 'sm:max-w-lg',
  zIndex,
  className = '',
  bodyClassName = 'p-5',
  ariaLabel,
}) => {
  const { t, isRTL } = useTranslation();
  const modalLayer = useModalLayer(id, isOpen, onClose);
  const effectiveZIndex = zIndex ?? modalLayer.zIndex;
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasHeader = Boolean(title || subtitle || headerLeading || headerTrailing || showClose);
  const hasActions = Boolean(primaryAction || secondaryAction || footer);

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : ariaLabel}
        style={{ zIndex: effectiveZIndex }}
        className="fixed inset-0 flex flex-col justify-end sm:justify-center sm:p-4 select-none-touch"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Backdrop: navy-deep/40 with light blur */}
        <div
          className="fixed inset-0 bg-navy-deep/40 backdrop-blur-xs animate-backdrop-fade"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Bottom Sheet Card:
            slides up from bottom, bg white, top radius 32px, max-height 92vh with internal scroll.
            On wide screens: centered, max-w-lg, radius 32px */}
        <div
          ref={sheetRef}
          className={`relative z-10 w-full ${maxWidthClass} mx-auto bg-page rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col shadow-2xl border border-line overflow-hidden animate-sheet-slide-up pb-[env(safe-area-inset-bottom,0px)] ${className}`}
        >
          {/* Drag handle: 40x4 mint */}
          {showHandle && (
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1 bg-mint rounded-full" />
            </div>
          )}

          {/* Header */}
          {hasHeader && (
            <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {headerLeading}
                <div className="min-w-0 flex-1 text-start">
                  {title && (
                    <h3 className="t-title text-navy font-bold text-base truncate">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className="t-meta text-slate text-xs truncate mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {headerTrailing}
                {showClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-10 h-10 rounded-full bg-mint-soft text-navy hover:bg-mint flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title={t('close') || 'Close'}
                    aria-label={t('close') || 'Close'}
                  >
                    <AppIcon name="close" size={20} weight="bold" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Internal scrollable content */}
          <div className={`flex-1 overflow-y-auto ${bodyClassName}`}>
            {children}
          </div>

          {/* Sticky footer (1px line top) */}
          {hasActions && (
            <div className="px-5 py-4 border-t border-line bg-page shrink-0">
              {footer ? (
                footer
              ) : (
                <div className="flex items-center gap-3">
                  {secondaryAction && (
                    <button
                      type={secondaryAction.type || 'button'}
                      onClick={secondaryAction.onClick}
                      disabled={secondaryAction.disabled}
                      className={`btn-soft ${primaryAction ? 'flex-1' : 'w-full'} ${secondaryAction.className || ''}`}
                    >
                      {secondaryAction.label}
                    </button>
                  )}
                  {primaryAction && (
                    <button
                      type={primaryAction.type || 'button'}
                      onClick={primaryAction.onClick}
                      disabled={primaryAction.disabled || primaryAction.loading}
                      className={`btn-orange ${secondaryAction ? 'flex-1' : 'w-full'} ${primaryAction.className || ''}`}
                    >
                      {primaryAction.label}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};

export default BottomSheet;
