import React from 'react';
import { MintCard } from './ui/MintCard';
import { AppIcon, type AppIconName } from './ui/AppIcon';
import { useTranslation } from '../utils/i18n';
import { useModalLayer } from '../contexts/ModalContext';
import { triggerLightHaptic } from '../utils/haptics';
import { useAnimatedPresence } from '../utils/motion';

export interface QuickAddSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordAttendance: () => void;
  onAddStudent: () => void;
  onAddGroup: () => void;
  onAddPayment: () => void;
  onAddSession: () => void;
  onAddPrivateSession: () => void;
}

interface ActionTile {
  id: string;
  label: string;
  icon: AppIconName;
  onClick: () => void;
}

export const QuickAddSheet: React.FC<QuickAddSheetProps> = ({
  isOpen,
  onClose,
  onRecordAttendance,
  onAddStudent,
  onAddGroup,
  onAddPayment,
  onAddSession,
  onAddPrivateSession,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  useModalLayer('quick-add-sheet', isOpen, onClose);
  const { shouldRender, isClosing } = useAnimatedPresence(isOpen);

  if (!shouldRender) return null;

  const actions: ActionTile[] = [
    {
      id: 'record_attendance',
      label: isEn ? 'Record Attendance' : 'رصد الحضور',
      icon: 'calendarCheck',
      onClick: onRecordAttendance,
    },
    {
      id: 'add_student',
      label: isEn ? 'Add Student' : 'إضافة طالب',
      icon: 'student',
      onClick: onAddStudent,
    },
    {
      id: 'add_group',
      label: isEn ? 'Add Group' : 'إضافة مجموعة',
      icon: 'group',
      onClick: onAddGroup,
    },
    {
      id: 'add_payment',
      label: isEn ? 'Add Payment' : 'تسجيل دفعة',
      icon: 'wallet',
      onClick: onAddPayment,
    },
    {
      id: 'add_session',
      label: isEn ? 'Add Session' : 'جدولة حصة',
      icon: 'sessions',
      onClick: onAddSession,
    },
    {
      id: 'add_private',
      label: isEn ? 'Private Session' : 'درس خاص',
      icon: 'clock',
      onClick: onAddPrivateSession,
    },
  ];

  return (
    <div
      role={isClosing ? 'presentation' : 'dialog'}
      aria-modal={isClosing ? undefined : 'true'}
      aria-hidden={isClosing ? 'true' : undefined}
      aria-label={isEn ? 'Quick Actions' : 'إجراءات سريعة'}
      className={`fixed inset-0 z-50 flex flex-col justify-end select-none ${
        isClosing ? 'pointer-events-none' : ''
      }`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-navy/35 ${
          isClosing ? 'animate-backdrop-exit' : 'animate-backdrop-fade'
        }`}
        onClick={isClosing ? undefined : onClose}
      />

      {/* Bottom Sheet Card */}
      <div
        className={`relative z-10 w-full max-w-[440px] mx-auto bg-page border-t border-line rounded-t-[32px] p-5 pb-8 shadow-2xl ${
          isClosing ? 'animate-sheet-exit' : 'animate-sheet-slide-up'
        }`}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div>
            <h3 className="t-title text-navy font-bold text-base">
              {isEn ? 'Quick Actions' : 'إجراءات سريعة'}
            </h3>
            <p className="t-meta text-slate text-xs mt-0.5">
              {isEn ? 'Choose an action to perform' : 'اختر إجراءً سريعاً للبدء فوراً'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-mint-soft text-navy hover:bg-mint flex items-center justify-center transition-colors cursor-pointer"
            title={t('close') || 'إغلاق'}
          >
            <AppIcon name="close" size={18} weight="bold" />
          </button>
        </div>

        {/* 2-column grid of MintCard tiles */}
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, index) => (
            <MintCard
              key={action.id}
              clickable
              onClick={() => {
                triggerLightHaptic();
                onClose();
                action.onClick();
              }}
              style={isClosing ? undefined : { animationDelay: `${index * 20}ms` }}
              className={`${
                isClosing ? '' : 'animate-tile-stagger'
              } flex flex-col items-center justify-center p-4 min-h-[104px] text-center cursor-pointer transition-transform group`}
            >
              <div className="w-12 h-12 rounded-full bg-page shadow-xs flex items-center justify-center text-navy mb-2.5 transition-transform group-hover:scale-105 group-active:scale-95">
                <AppIcon name={action.icon} weight="duotone" size={24} />
              </div>
              <span className="text-xs font-bold text-navy leading-tight truncate max-w-full">
                {action.label}
              </span>
            </MintCard>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickAddSheet;
