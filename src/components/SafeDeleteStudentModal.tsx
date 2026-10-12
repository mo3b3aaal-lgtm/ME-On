import React, { useState } from 'react';
import { Student } from '../types';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { useTranslation } from '../utils/i18n';
import { AppIcon } from './ui/AppIcon';

interface SafeDeleteStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onConfirmArchive: (student: Student) => void;
  onConfirmPermanentDelete: (student: Student) => void;
}

export const SafeDeleteStudentModal: React.FC<SafeDeleteStudentModalProps> = ({
  isOpen,
  onClose,
  student,
  onConfirmArchive,
  onConfirmPermanentDelete,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  const [selectedMode, setSelectedMode] = useState<'archive' | 'permanent' | null>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClose = () => {
    if (isProcessing) return;
    setStep('select');
    setSelectedMode(null);
    onClose();
  };

  const modalLayer = useModalLayer('safe-delete-student', isOpen && !!student, handleClose);

  if (!isOpen || !student) return null;

  const handleProceedToConfirm = (mode: 'archive' | 'permanent') => {
    setSelectedMode(mode);
    setStep('confirm');
  };

  const handleFinalExecute = async () => {
    if (!student || !selectedMode) return;
    setIsProcessing(true);
    try {
      if (selectedMode === 'archive') {
        onConfirmArchive(student);
      } else {
        onConfirmPermanentDelete(student);
      }
      handleClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-navy-deep/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-backdrop-fade select-none-touch"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Small centered card (white, radius 28px, shadow-white) */}
        <div className="bg-page rounded-[28px] w-full max-w-md flex flex-col shadow-white border border-line overflow-hidden animate-pop-in">
          {/* Header */}
          <div className="p-5 border-b border-line flex items-center justify-between shrink-0 bg-page">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-line ${
                  selectedMode === 'permanent' && step === 'confirm'
                    ? 'bg-coral-soft text-coral'
                    : 'bg-mint-soft text-navy'
                }`}
              >
                {selectedMode === 'permanent' && step === 'confirm' ? (
                  <AppIcon name="warning" size={20} weight="fill" />
                ) : (
                  <AppIcon name="trash" size={20} weight="bold" />
                )}
              </div>

              <div className="min-w-0 text-start">
                <h2 className="t-title text-navy font-bold text-base truncate">
                  {step === 'select'
                    ? isEn
                      ? 'Manage & Delete Student'
                      : 'إدارة وحذف الطالب'
                    : selectedMode === 'archive'
                    ? isEn
                      ? 'Confirm Student Archiving'
                      : 'تأكيد أرشفة الطالب'
                    : isEn
                    ? 'Warning: Permanent Deletion'
                    : 'تحذير: حذف نهائي وشامل'}
                </h2>
                <p className="t-meta text-slate text-xs truncate mt-0.5">
                  {isEn ? 'Student:' : 'الطالب:'}{' '}
                  <span className="font-bold text-navy">{student.name}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="w-11 h-11 rounded-full bg-mint-soft text-navy hover:bg-mint flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title={t('close') || 'Close'}
            >
              <AppIcon name="close" size={18} weight="bold" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 overflow-y-auto space-y-3.5 text-navy text-xs">
            {step === 'select' ? (
              <>
                <div className="text-center space-y-1 pb-1">
                  <h3 className="text-sm font-black text-navy">
                    {isEn
                      ? 'What would you like to do with this student records?'
                      : 'ماذا تريد أن تفعل بالسجلات الخاصة بهذا الطالب؟'}
                  </h3>
                  <p className="text-xs text-slate font-medium leading-relaxed">
                    {isEn
                      ? 'Choose the appropriate option for managing student history and finances.'
                      : 'اختر الطريقة المناسبة لإدارة ملف الطالب وحساباته المالية.'}
                  </p>
                </div>

                {/* Option 1: Archive & Keep Records (RECOMMENDED) */}
                <div
                  onClick={() => handleProceedToConfirm('archive')}
                  className="p-4 rounded-[18px] border-2 border-mint bg-mint-soft/50 hover:bg-mint-soft transition-all cursor-pointer space-y-2.5 text-start"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-mint text-navy flex items-center justify-center shrink-0">
                        <AppIcon name="archive" size={18} weight="bold" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-navy">
                          {isEn
                            ? 'Archive Student & Preserve Records'
                            : 'أرشفة الطالب مع الاحتفاظ بالسجلات'}
                        </h4>
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-navy bg-mint px-2 py-0.5 rounded-full mt-0.5">
                          <AppIcon name="sparkles" size={12} weight="fill" />
                          <span>
                            {isEn ? 'Recommended Option' : 'الخيار الآمن والموصى به'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate font-medium leading-relaxed">
                    {isEn
                      ? 'Student is hidden from active lists, preserving past sessions, attendance logs, payments, and financial reports.'
                      : 'يتم إخفاء الطالب من قائمة الطلاب النشطين، مع الاحتفاظ بالحفظ الكامل لكافة الحصص السابقة، سجل الحضور، والتقارير المالية.'}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] font-bold text-navy pt-2 border-t border-line">
                    <span className="flex items-center gap-1">
                      <AppIcon name="calendarCheck" size={13} />
                      <span>{isEn ? 'Sessions Preserved' : 'الحصص والغياب محفوظة'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <AppIcon name="invoice" size={13} />
                      <span>{isEn ? 'Finances Intact' : 'التقارير المالية سليمة'}</span>
                    </span>
                  </div>
                </div>

                {/* Option 2: Full Permanent Delete */}
                <div
                  onClick={() => handleProceedToConfirm('permanent')}
                  className="p-4 rounded-[18px] border border-line bg-page hover:bg-mist transition-all cursor-pointer space-y-2 text-start"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-coral-soft text-coral flex items-center justify-center shrink-0">
                      <AppIcon name="trash" size={18} weight="bold" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-navy">
                        {isEn
                          ? 'Permanently Delete Student and All Records'
                          : 'حذف الطالب وجميع سجلاته نهائياً'}
                      </h4>
                      <span className="inline-block text-[10px] font-bold text-coral bg-coral-soft px-2 py-0.5 rounded-full mt-0.5">
                        {isEn ? 'Permanent & Irreversible' : 'حذف دائم وغير قابل للتراجع'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate font-medium leading-relaxed">
                    {isEn
                      ? 'Permanently deletes student profile, private sessions, attendance logs, and payments. Cannot be recovered.'
                      : 'حذف الطالب وجميع حصصه وسجلاته ومدفوعاته بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.'}
                  </p>
                </div>
              </>
            ) : selectedMode === 'archive' ? (
              /* Confirmation for Archive */
              <div className="space-y-3.5 py-1 text-start">
                <div className="p-4 rounded-2xl bg-mint-soft border border-mint text-navy space-y-2">
                  <div className="flex items-center gap-2 text-navy font-black text-xs">
                    <AppIcon name="checkCircle" size={16} weight="fill" />
                    <span>
                      {isEn ? 'What happens with this action?' : 'ماذا سيحدث عند إتمام هذا الإجراء؟'}
                    </span>
                  </div>
                  <ul className="text-xs space-y-1.5 text-navy font-medium list-disc list-inside leading-relaxed ps-1">
                    <li>
                      {isEn ? (
                        <>Student will be moved to <strong>Archived Students</strong>.</>
                      ) : (
                        <>سيتم نقل الطالب إلى قائمة <strong>الطلاب المؤرشفين</strong>.</>
                      )}
                    </li>
                    <li>
                      {isEn
                        ? 'All classes, attendance, and dues remain safely recorded.'
                        : 'تظل جميع الحصص وسجلات الحضور والغياب والمستحقات محفوظة بالكامل.'}
                    </li>
                    <li>
                      {isEn
                        ? 'You can restore and reactivate the student anytime.'
                        : 'يمكنك استعادة وتنشيط الطالب في أي وقت لاحقاً.'}
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              /* Confirmation for Permanent Delete */
              <div className="space-y-3.5 py-1 text-start">
                <div className="p-4 rounded-2xl bg-coral-soft border border-coral/30 text-coral space-y-2">
                  <div className="flex items-center gap-2 font-black text-xs">
                    <AppIcon name="warning" size={16} weight="fill" />
                    <span>
                      {isEn ? 'Confirm Permanent Deletion' : 'تأكيد الحذف النهائي الشامل'}
                    </span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-navy">
                    {isEn ? (
                      <>
                        Student <strong className="text-coral">{student.name}</strong> and all linked data will be wiped permanently:
                      </>
                    ) : (
                      <>
                        سيتم مسح الطالب <strong className="text-coral">{student.name}</strong> وجميع السجلات والبيانات المرتبطة به نهائياً:
                      </>
                    )}
                  </p>
                  <ul className="text-xs space-y-1 text-navy font-bold list-disc list-inside ps-1">
                    <li>{isEn ? 'Past private and group sessions' : 'كافة الحصص المسجلة'}</li>
                    <li>{isEn ? 'Attendance, absence, and logs' : 'سجلات الحضور والغياب'}</li>
                    <li>{isEn ? 'Payment history and receipts' : 'سجل المدفوعات والإيصالات'}</li>
                  </ul>
                  <p className="text-xs font-black text-coral pt-2 border-t border-coral/20">
                    {isEn ? 'This action is permanent and cannot be undone.' : 'هذا الإجراء قطعي ولا يمكن التراجع عنه.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions: btn-danger confirm and btn-soft cancel */}
          <div className="p-4 border-t border-line bg-page flex items-center justify-between gap-3">
            {step === 'select' ? (
              <button
                type="button"
                onClick={handleClose}
                className="btn-soft w-full"
              >
                {t('cancel')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  disabled={isProcessing}
                  className="btn-soft px-4"
                >
                  <AppIcon name="chevronStart" size={14} />
                  <span>{isEn ? 'Back' : 'رجوع'}</span>
                </button>

                {selectedMode === 'archive' ? (
                  <button
                    type="button"
                    onClick={handleFinalExecute}
                    disabled={isProcessing}
                    className="btn-orange flex-1"
                  >
                    <AppIcon name="archive" size={15} weight="bold" />
                    <span>
                      {isProcessing
                        ? isEn ? 'Archiving...' : 'جاري الأرشفة...'
                        : isEn ? 'Archive Student' : 'أرشفة الطالب'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinalExecute}
                    disabled={isProcessing}
                    className="btn-danger flex-1"
                  >
                    <AppIcon name="trash" size={15} weight="bold" />
                    <span>
                      {isProcessing
                        ? isEn ? 'Deleting...' : 'جاري الحذف...'
                        : isEn ? 'Delete Permanently' : 'حذف نهائي'}
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
