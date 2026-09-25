import React, { useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Trash2,
  X,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  History,
  FileSpreadsheet,
} from 'lucide-react';
import { Student } from '../types';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';

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
        className="fixed inset-0 bg-[#17163D]/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
        dir="rtl"
      >
        <div className="bg-white rounded-[28px] w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl border border-[#E8E7FF] overflow-hidden">
          
          {/* Header */}
          <div className={`p-4 sm:p-5 text-white flex items-center justify-between shrink-0 relative overflow-hidden ${
            selectedMode === 'permanent' && step === 'confirm'
              ? 'bg-gradient-to-l from-[#EF5B6A] to-[#C9334A]'
              : 'bg-gradient-to-l from-[#17163D] via-[#2A2663] to-[#403B9C]'
          }`}>
            <div className="flex items-center gap-3 relative z-10 min-w-0">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner shrink-0 ${
                selectedMode === 'permanent' && step === 'confirm'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#FF647C]/20 text-[#FF647C] border border-[#FF647C]/30'
              }`}>
                {selectedMode === 'permanent' && step === 'confirm' ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </div>

              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                  {step === 'select' ? 'حذف الطالب' : (selectedMode === 'archive' ? 'تأكيد أرشفة الطالب' : 'تحذير: حذف نهائي وشامل')}
                </h2>
                <p className="text-xs text-[#E8E7FF]/80 font-medium truncate">
                  الطالب: <span className="font-bold text-white">{student.name}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer relative z-10 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-6 overflow-y-auto android-scrollbar space-y-4 text-[#191A2E]">
            
            {step === 'select' ? (
              <>
                <div className="text-center space-y-1 pb-1">
                  <h3 className="text-sm font-black text-[#17163D]">
                    ماذا تريد أن تفعل بالسجلات الخاصة بهذا الطالب؟
                  </h3>
                  <p className="text-xs text-[#74778F] font-medium leading-relaxed">
                    اختر الطريقة المناسبة لإدارة سجلات الطالب والبيانات المالية المرتبطة به.
                  </p>
                </div>

                {/* Option 2: Archive & Keep Records (RECOMMENDED) */}
                <div
                  onClick={() => handleProceedToConfirm('archive')}
                  className="p-4 rounded-2xl border-2 border-[#7657F6]/40 bg-gradient-to-br from-[#F5F6FC] to-[#E8E7FF]/30 hover:border-[#7657F6] hover:shadow-md transition-all cursor-pointer space-y-3 relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#7657F6]/15 text-[#7657F6] flex items-center justify-center shrink-0">
                        <Archive className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-[#17163D]">
                          حذف الطالب مع الاحتفاظ بسجلاته التاريخية
                        </h4>
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#7657F6] bg-[#7657F6]/10 px-2 py-0.5 rounded-md mt-0.5">
                          <Sparkles className="w-3 h-3" />
                          <span>الخيار الآمن والموصى به محاسبياً</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#74778F] font-medium leading-relaxed">
                    يتم إخفاء الطالب من قائمة الطلاب النشطين واشتراكات المجموعات، مع <strong>الاحتفاظ الكامل</strong> بكافة الحصص السابقة، سجل الحضور، المدفوعات، الكشوفات والتقارير المالية التاريخية.
                  </p>

                  <div className="flex items-center gap-3 text-[10px] font-bold text-[#403B9C] pt-1 border-t border-[#E8E7FF]">
                    <span className="flex items-center gap-1">
                      <History className="w-3 h-3 text-[#7657F6]" />
                      <span>الحصص والغياب محفوظة</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <FileSpreadsheet className="w-3 h-3 text-[#22A06B]" />
                      <span>التقارير المالية سليمة</span>
                    </span>
                  </div>
                </div>

                {/* Option 1: Full Permanent Delete */}
                <div
                  onClick={() => handleProceedToConfirm('permanent')}
                  className="p-4 rounded-2xl border border-rose-200 bg-white hover:bg-rose-50/40 hover:border-rose-300 transition-all cursor-pointer space-y-2.5 group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                      <Trash2 className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-rose-950">
                        حذف الطالب وجميع سجلاته نهائياً
                      </h4>
                      <span className="inline-block text-[10px] font-bold text-rose-600 bg-rose-100/70 px-2 py-0.5 rounded-md mt-0.5">
                        حذف دائم وشامل
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#74778F] font-medium leading-relaxed">
                    حذف الطالب وجميع حصصه الخاصة، سجلات الحضور، والمدفوعات المرتبطة به بشكل نهائي. لن يمكن استعادة هذه السجلات أو إدراجها في التقارير لاحقاً.
                  </p>
                </div>
              </>
            ) : selectedMode === 'archive' ? (
              /* Confirmation for Option 2 (Archive) */
              <div className="space-y-4 py-1">
                <div className="p-4 rounded-2xl bg-[#E8E7FF]/60 border border-[#7657F6]/30 text-[#17163D] space-y-2">
                  <div className="flex items-center gap-2 text-[#7657F6] font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ماذا سيحدث عند إتمام هذا الإجراء؟</span>
                  </div>
                  <ul className="text-xs space-y-1.5 text-[#191A2E]/90 font-medium list-disc list-inside leading-relaxed pr-1">
                    <li>سيتم نقل الطالب <strong className="text-[#7657F6]">{student.name}</strong> إلى قسم <strong>الطلاب المؤرشفين</strong>.</li>
                    <li>لن يظهر الطالب في قوائم أخذ الحضور أو تسجيل الحصص الجديدة.</li>
                    <li>تظل جميع الحصص القديمة وسجلات الحضور والغياب محفوظة بالكامل.</li>
                    <li>تظل جميع المدفوعات والإيرادات المسددة مدرجة في التقارير المحاسبية.</li>
                    <li>يمكنك <strong>استعادة الطالب</strong> وتنشيطه في أي وقت لاحقاً بنقرة واحدة.</li>
                  </ul>
                </div>
              </div>
            ) : (
              /* Confirmation for Option 1 (Permanent Delete Warning) */
              <div className="space-y-4 py-1">
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-2.5">
                  <div className="flex items-center gap-2 text-rose-700 font-black text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>تأكيد الحذف النهائي الشامل</span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-rose-900">
                    سيتم مسح الطالب <strong className="text-rose-950 font-black">{student.name}</strong> وجميع السجلات والبيانات المرتبطة به نهائياً من قاعدة البيانات، بما في ذلك:
                  </p>
                  <ul className="text-xs space-y-1 text-rose-800 font-bold list-disc list-inside pr-1">
                    <li>كافة الحصص والدروس الخاصة السابقة</li>
                    <li>سجلات الحضور والغياب والملاحظات</li>
                    <li>سجل المدفوعات والإيصالات المالية</li>
                    <li>سجلات السلوك والتقييمات</li>
                  </ul>
                  <p className="text-xs font-black text-rose-600 pt-1 border-t border-rose-200/80">
                    ⚠️ هذا الإجراء قطعي ولا يمكن التراجع عنه.
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-[#F6F7FC] border-t border-[#E8E7FF] flex items-center justify-between gap-2.5">
            {step === 'select' ? (
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 px-4 rounded-2xl bg-white border border-[#E8E7FF] text-[#74778F] hover:text-[#17163D] font-bold text-xs transition-colors cursor-pointer text-center"
              >
                إلغاء
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  disabled={isProcessing}
                  className="py-2.5 px-4 rounded-2xl bg-white border border-[#E8E7FF] text-[#74778F] hover:text-[#17163D] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>تغيير الخيار</span>
                </button>

                {selectedMode === 'archive' ? (
                  <button
                    type="button"
                    onClick={handleFinalExecute}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#7657F6] to-[#403B9C] hover:from-[#6544ea] hover:to-[#353086] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#7657F6]/30 transition-all cursor-pointer active:scale-95"
                  >
                    <Archive className="w-4 h-4" />
                    <span>{isProcessing ? 'جاري الأرشفة...' : 'حذف مع الاحتفاظ بالسجلات'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinalExecute}
                    disabled={isProcessing}
                    className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-[#EF5B6A] to-[#C9334A] hover:from-[#dc4c5b] hover:to-[#b0253b] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/30 transition-all cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isProcessing ? 'جاري الحذف...' : 'تأكيد الحذف النهائي'}</span>
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
