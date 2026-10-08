import React, { useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Trash2,
  X,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  History,
  FileSpreadsheet,
  Check,
} from 'lucide-react';
import { Student } from '../types';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { useTranslation } from '../utils/i18n';

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
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#293828]/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#DDD3C7]/15 rounded-[28px] w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl border border-[#DDD3C7] overflow-hidden">
          
          {/* Signature Header */}
          <div className={`p-4 sm:p-5 text-[#F8F2EC] flex items-center justify-between shrink-0 relative overflow-hidden ${
            selectedMode === 'permanent' && step === 'confirm'
              ? 'bg-gradient-to-r from-[#0F1206] via-[#293828] to-[#293828]'
              : 'bg-gradient-to-r from-[#293828] via-[#0F1206] to-[#756046]'
          }`}>
            <div className="flex items-center gap-3 relative z-10 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#F8F2EC]/15 backdrop-blur-md border border-[#DDD3C7]/25 flex items-center justify-center shadow-sm shrink-0">
                {selectedMode === 'permanent' && step === 'confirm' ? (
                  <ShieldAlert className="w-5 h-5 text-[#F8F2EC]" />
                ) : (
                  <Trash2 className="w-5 h-5 text-[#F8F2EC]" />
                )}
              </div>

              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                  {step === 'select'
                    ? (isEn ? 'Manage & Delete Student' : 'إدارة وحذف الطالب')
                    : (selectedMode === 'archive'
                        ? (isEn ? 'Confirm Student Archiving' : 'تأكيد أرشفة الطالب')
                        : (isEn ? 'Warning: Permanent Deletion' : 'تحذير: حذف نهائي وشامل'))}
                </h2>
                <p className="text-xs text-[#DDD3C7]/85 font-medium truncate">
                  {isEn ? 'Student:' : 'الطالب:'} <span className="font-black text-[#F8F2EC]">{student.name}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="p-2 rounded-2xl bg-[#F8F2EC]/10 hover:bg-[#F8F2EC]/20 text-[#F8F2EC] border border-[#DDD3C7]/20 transition-all cursor-pointer relative z-10 active:scale-95"
              title={t('close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-5 overflow-y-auto android-scrollbar space-y-3.5 text-[#0F1206] text-xs">
            
            {step === 'select' ? (
              <>
                <div className="text-center space-y-1 pb-1">
                  <h3 className="text-sm font-black text-[#0F1206]">
                    {isEn ? 'What would you like to do with this student records?' : 'ماذا تريد أن تفعل بالسجلات الخاصة بهذا الطالب؟'}
                  </h3>
                  <p className="text-xs text-[#756046] font-medium leading-relaxed">
                    {isEn ? 'Choose the appropriate option for managing student history and finances in Classy.' : 'اختر الطريقة المناسبة لإدارة ملف الطالب وحساباته المالية في Classy.'}
                  </p>
                </div>

                {/* Option 2: Archive & Keep Records (RECOMMENDED) */}
                <div
                  onClick={() => handleProceedToConfirm('archive')}
                  className="classy-card p-4 border-2 border-[#293828]/40 bg-gradient-to-br from-[#F8F2EC] to-[#DDD3C7]/30 hover:border-[#293828] hover:shadow-md transition-all cursor-pointer space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#DDD3C7]/25 text-[#293828] flex items-center justify-center shrink-0">
                        <Archive className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-[#0F1206]">
                          {isEn ? 'Archive Student & Preserve Historical Records' : 'حذف الطالب مع الاحتفاظ بسجلاته التاريخية'}
                        </h4>
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#293828] bg-[#DDD3C7]/25 px-2 py-0.5 rounded-lg mt-0.5">
                          <Sparkles className="w-3 h-3" />
                          <span>{isEn ? 'Recommended Accounting Option' : 'الخيار الآمن والموصى به محاسبياً'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#756046] font-medium leading-relaxed">
                    {isEn
                      ? 'Student is hidden from active lists and class enrollments, preserving all past sessions, attendance logs, payments, and financial reports.'
                      : 'يتم إخفاء الطالب من قائمة الطلاب النشطين واشتراكات المجموعات، مع الاحتفاظ الكامل بكافة الحصص السابقة، سجل الحضور، المدفوعات، والكشوفات المحاسبية.'}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] font-black text-[#0F1206] pt-2 border-t border-[#DDD3C7]">
                    <span className="flex items-center gap-1">
                      <History className="w-3.5 h-3.5 text-[#293828]" />
                      <span>{isEn ? 'Sessions & Attendance Preserved' : 'الحصص والغياب محفوظة'}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#293828]" />
                      <span>{isEn ? 'Financial Reports Intact' : 'التقارير المالية سليمة'}</span>
                    </span>
                  </div>
                </div>

                {/* Option 1: Full Permanent Delete */}
                <div
                  onClick={() => handleProceedToConfirm('permanent')}
                  className="classy-card p-4 border border-[#DDD3C7] bg-[#F8F2EC] hover:bg-[#DDD3C7]/25 transition-all cursor-pointer space-y-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#DDD3C7]/15 text-[#0F1206] flex items-center justify-center shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-[#0F1206]">
                        {isEn ? 'Permanently Delete Student and All Records' : 'حذف الطالب وجميع سجلاته نهائياً'}
                      </h4>
                      <span className="inline-block text-[10px] font-black text-[#0F1206] bg-[#DDD3C7]/15 px-2 py-0.5 rounded-lg mt-0.5">
                        {isEn ? 'Permanent & Irreversible' : 'حذف دائم وشامل'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#756046] font-medium leading-relaxed">
                    {isEn
                      ? 'Permanently deletes student profile, private sessions, attendance logs, and payments. These records cannot be recovered or shown in reports.'
                      : 'حذف الطالب وجميع حصصه الخاصة، سجلات الحضور، والمدفوعات المرتبطة به بشكل نهائي. لن يمكن استعادة هذه السجلات أو إدراجها في التقارير.'}
                  </p>
                </div>
              </>
            ) : selectedMode === 'archive' ? (
              /* Confirmation for Option 2 (Archive) */
              <div className="space-y-4 py-1">
                <div className="classy-card p-4 bg-[#DDD3C7]/40 border border-[#DDD3C7] text-[#0F1206] space-y-2.5">
                  <div className="flex items-center gap-2 text-[#293828] font-black text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isEn ? 'What happens with this action?' : 'ماذا سيحدث عند إتمام هذا الإجراء؟'}</span>
                  </div>
                  <ul className={`text-xs space-y-2 text-[#0F1206] font-medium list-disc list-inside leading-relaxed ${isRTL ? 'pr-1' : 'pl-1'}`}>
                    <li>{isEn ? <>Student <strong className="text-[#293828] font-black">{student.name}</strong> will be moved to the <strong>Archived Students</strong> list.</> : <>سيتم نقل الطالب <strong className="text-[#293828] font-black">{student.name}</strong> إلى قسم <strong>الطلاب المؤرشفين</strong>.</>}</li>
                    <li>{isEn ? 'Student will not appear in daily attendance sheets or new class lists.' : 'لن يظهر الطالب في قوائم أخذ الحضور أو تسجيل الحصص الجديدة.'}</li>
                    <li>{isEn ? 'All classes, attendance, and absence history remain fully preserved.' : 'تظل جميع الحصص وسجلات الحضور والغياب محفوظة بالكامل.'}</li>
                    <li>{isEn ? 'All recorded payments remain calculated in financial reports.' : 'تظل جميع المدفوعات والإيرادات المسددة مدرجة في التقارير المحاسبية.'}</li>
                    <li>{isEn ? 'You can restore and reactivate the student anytime with 1 click.' : 'يمكنك استعادة وتنشيط الطالب في أي وقت لاحقاً بنقرة واحدة.'}</li>
                  </ul>
                </div>
              </div>
            ) : (
              /* Confirmation for Option 1 (Permanent Delete Warning) */
              <div className="space-y-4 py-1">
                <div className="classy-card p-4 bg-[#DDD3C7]/15 border border-[#DDD3C7] text-[#293828] space-y-2.5">
                  <div className="flex items-center gap-2 text-[#0F1206] font-black text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{isEn ? 'Confirm Permanent Deletion' : 'تأكيد الحذف النهائي الشامل'}</span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-[#293828]">
                    {isEn
                      ? <>Student <strong className="text-[#293828] font-black">{student.name}</strong> and all linked data will be wiped permanently from database, including:</>
                      : <>سيتم مسح الطالب <strong className="text-[#293828] font-black">{student.name}</strong> وجميع السجلات والبيانات المرتبطة به نهائياً من قاعدة البيانات، بما في ذلك:</>}
                  </p>
                  <ul className={`text-xs space-y-1 text-[#293828] font-black list-disc list-inside ${isRTL ? 'pr-1' : 'pl-1'}`}>
                    <li>{isEn ? 'All past private and group classes' : 'كافة الحصص والدروس الخاصة السابقة'}</li>
                    <li>{isEn ? 'Attendance, absence, and notes records' : 'سجلات الحضور والغياب والملاحظات'}</li>
                    <li>{isEn ? 'Payment history and financial receipts' : 'سجل المدفوعات والإيصالات المالية'}</li>
                    <li>{isEn ? 'Behavior ratings and progress logs' : 'سجلات السلوك والتقييمات'}</li>
                  </ul>
                  <p className="text-xs font-black text-[#0F1206] pt-2 border-t border-[#DDD3C7]">
                    {isEn ? '⚠️ This action is permanent and cannot be undone.' : '⚠️ هذا الإجراء قطعي ولا يمكن التراجع عنه.'}
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-[#F8F2EC] border-t border-[#DDD3C7] flex items-center justify-between gap-2.5">
            {step === 'select' ? (
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary w-full"
              >
                {t('cancel')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  disabled={isProcessing}
                  className="btn-secondary"
                >
                  {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                  <span>{isEn ? 'Change Choice' : 'تغيير الخيار'}</span>
                </button>

                {selectedMode === 'archive' ? (
                  <button
                    type="button"
                    onClick={handleFinalExecute}
                    disabled={isProcessing}
                    className="btn-primary flex-1"
                  >
                    <Archive className="w-4 h-4" />
                    <span>{isProcessing ? (isEn ? 'Archiving...' : 'جاري الأرشفة...') : (isEn ? 'Archive & Keep Records' : 'حذف مع الاحتفاظ بالسجلات')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinalExecute}
                    disabled={isProcessing}
                    className="btn-danger-solid flex-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isProcessing ? (isEn ? 'Deleting...' : 'جاري الحذف...') : (isEn ? 'Confirm Permanent Delete' : 'تأكيد الحذف النهائي')}</span>
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
