import React, { useEffect } from 'react';
import { AppIcon, type AppIconName } from './AppIcon';
import { useModalLayer, ModalPortal } from '../../contexts/ModalContext';
import { useTranslation } from '../../utils/i18n';

export interface ConfirmDialogProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isConfirming?: boolean;
  icon?: AppIconName;
  zIndex?: number;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  id = 'confirm-dialog',
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isDestructive = true,
  isConfirming = false,
  icon = 'warning',
  zIndex,
}) => {
  const { t, isRTL } = useTranslation();
  const modalLayer = useModalLayer(id, isOpen, onClose);
  const effectiveZIndex = zIndex ?? modalLayer.zIndex;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isConfirming) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isConfirming]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        style={{ zIndex: effectiveZIndex }}
        className="fixed inset-0 flex items-center justify-center p-4 select-none-touch"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-navy-deep/40 backdrop-blur-xs animate-backdrop-fade"
          onClick={() => {
            if (!isConfirming) onClose();
          }}
          aria-hidden="true"
        />

        {/* Centered card: white, radius 28px, shadow-white */}
        <div className="relative z-10 w-full max-w-sm sm:max-w-md mx-auto bg-page rounded-[28px] p-6 shadow-white border border-line text-center space-y-4 animate-pop-in">
          {/* Duotone icon in circle */}
          <div
            className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${
              isDestructive ? 'bg-coral/12 text-coral' : 'bg-mint-soft text-navy'
            }`}
          >
            <AppIcon name={icon} size={28} weight="duotone" />
          </div>

          <div className="space-y-1.5">
            <h3 className="t-card text-navy font-bold text-base leading-snug">
              {title}
            </h3>
            {description && (
              <div className="t-meta text-slate text-xs leading-relaxed max-w-xs mx-auto">
                {description}
              </div>
            )}
          </div>

          {/* Buttons: btn-danger confirm and btn-soft cancel */}
          <div className="flex items-center gap-3 pt-2 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={isConfirming}
              className="btn-soft flex-1"
            >
              {cancelLabel || t('cancel') || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isConfirming}
              className={`${isDestructive ? 'btn-danger' : 'btn-orange'} flex-1`}
            >
              {isConfirming ? (
                <span className="flex items-center justify-center gap-1.5">
                  <AppIcon name="sync" size={16} className="animate-spin" />
                  <span>{confirmLabel || t('confirm') || 'Confirm'}</span>
                </span>
              ) : (
                confirmLabel || t('confirm') || 'Confirm'
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ConfirmDialog;
