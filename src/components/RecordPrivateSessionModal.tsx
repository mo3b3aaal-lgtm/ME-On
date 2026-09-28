import React, { useState } from 'react';
import { X, Calendar, Clock, BookOpen, Layers, CheckCircle2, Sparkles, Hash, AlignRight, Timer, Check } from 'lucide-react';
import { Student, Enrollment, Group } from '../types';
import { db, roundMoney, multiplyMoney, divideMoney } from '../utils/storage';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { useTranslation } from '../utils/i18n';

interface RecordPrivateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onSaveComplete: () => void;
}

export const RecordPrivateSessionModal: React.FC<RecordPrivateSessionModalProps> = ({
  isOpen,
  onClose,
  student,
  onSaveComplete,
}) => {
  const { t, isRTL } = useTranslation();
  const todayStr = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  // Get private enrollments for this student
  const allEnrollments = db.getEnrollments();
  const allGroups = db.getGroups();

  const studentPrivateEnrollments = student ? allEnrollments.filter((enr) => {
    if (enr.studentId !== student.id) return false;
    const grp = allGroups.find((g) => g.id === enr.groupId);
    return enr.serviceType === 'private' || grp?.type === 'private';
  }) : [];

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>(() => {
    return studentPrivateEnrollments[0]?.id || '';
  });

  const [date, setDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>(nowTime || '16:00');
  const [sessionCount, setSessionCount] = useState<number>(1);
  const [hours, setHours] = useState<number>(1.5);
  const [attendanceType, setAttendanceType] = useState<'present' | 'absent_charged' | 'absent_free' | 'cancelled'>('present');
  const [absenceReason, setAbsenceReason] = useState<string>('الطالب ألغى');
  const [customReason, setCustomReason] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Active private enrollment info
  const activeEnrollment = studentPrivateEnrollments.find((e) => e.id === selectedEnrollmentId) || studentPrivateEnrollments[0];
  const activeGroup = activeEnrollment ? allGroups.find((g) => g.id === activeEnrollment.groupId) : undefined;
  const finSummary = activeEnrollment ? db.calculateEnrollmentFinancials(activeEnrollment.id) : undefined;

  const isHourly =
    activeEnrollment?.billingMode === 'hourly' ||
    activeEnrollment?.billingType === 'hourly' ||
    activeGroup?.billingMode === 'hourly' ||
    activeGroup?.billingType === 'hourly';

  const hourlyRate = activeEnrollment?.hourlyRate || activeGroup?.hourlyRate || activeEnrollment?.customPrice || 150;

  const isPackage =
    !isHourly && (
      activeEnrollment?.billingMode === 'package' ||
      activeEnrollment?.billingType === 'package' ||
      activeGroup?.billingMode === 'package' ||
      activeGroup?.billingType === 'package'
    );

  const isPrepaid =
    !isHourly &&
    !isPackage && (
      activeEnrollment?.billingMode === 'prepaid' ||
      activeEnrollment?.billingType === 'prepaid' ||
      (activeEnrollment?.billingType === 'per_session' && activeEnrollment?.billingMode !== 'postpaid')
    );

  const isPostpaid =
    !isHourly &&
    !isPackage && (
      activeEnrollment?.billingMode === 'postpaid' ||
      activeEnrollment?.billingType === 'postpaid'
    );

  const packageSessionsCount = isPackage
    ? (activeEnrollment?.packageSessionsCount || activeGroup?.packageSessionsCount || 10)
    : 10;

  const packageTotalPrice = isPackage
    ? (activeEnrollment?.packagePrice ||
       (activeGroup?.billingMode === 'package' || activeGroup?.billingType === 'package' ? activeGroup.defaultPrice : undefined) ||
       activeEnrollment?.customPrice ||
       1000)
    : 1000;

  // Effective Session Price
  const effectiveSessionPrice = isHourly
    ? multiplyMoney(hours, hourlyRate)
    : isPackage && packageSessionsCount > 0
    ? divideMoney(packageTotalPrice, packageSessionsCount)
    : (activeEnrollment?.customPrice || activeGroup?.defaultPrice || 100);

  const isCharged = attendanceType === 'present' || attendanceType === 'absent_charged';

  // Total Session Value
  const totalSessionValue = isCharged
    ? isHourly
      ? multiplyMoney(hours, hourlyRate)
      : multiplyMoney(Number(sessionCount) || 1, effectiveSessionPrice)
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    const count = Math.max(1, Math.floor(Number(sessionCount) || 1));
    setIsSubmitting(true);

    try {
      // Find or create private service group if none exists
      let targetGroupId = activeGroup?.id;
      let targetEnrollmentId = activeEnrollment?.id;

      if (!targetGroupId || !targetEnrollmentId) {
        const created = db.createPrivateLessonService(student.id, {
          subject: 'مادة الدرس الخاص',
          sessionPrice: 100,
          billingType: 'prepaid',
          billingMode: 'prepaid',
        });
        targetGroupId = created.group.id;
        targetEnrollmentId = created.enrollment.id;
      }

      const finalReason = attendanceType === 'absent_free' || attendanceType === 'cancelled'
        ? (absenceReason === 'سبب آخر' ? (customReason.trim() || 'سبب آخر') : absenceReason)
        : undefined;

      db.recordPrivateSessionsForStudent({
        studentId: student.id,
        enrollmentId: targetEnrollmentId,
        groupId: targetGroupId,
        date: date || todayStr,
        startTime: startTime || '16:00',
        sessionCount: isHourly ? 1 : count,
        hours: isHourly ? hours : undefined,
        hourlyRate: isHourly ? hourlyRate : undefined,
        attendanceStatus: attendanceType,
        isCharged,
        absenceReason: finalReason,
        sessionStatus: attendanceType === 'cancelled' ? 'cancelled' : 'completed',
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSaveComplete();
      onClose();
    } catch (err) {
      console.error('Error recording private sessions:', err);
      alert('حدث خطأ أثناء تسجيل الحصص. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalLayer = useModalLayer('record-private-session', isOpen && !!student, onClose);

  if (!isOpen || !student) return null;

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#17163D]/65 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#F6F7FC] border border-[#E8E7FF] rounded-t-[28px] sm:rounded-[28px] max-w-lg w-full mx-auto max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Signature Classy Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] text-white flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5 text-[#55C7E8]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                تسجيل حصة Private
              </h2>
              <p className="text-xs text-[#E8E7FF]/85 font-medium truncate">
                الطالب: <strong className="text-white font-black">{student.name}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer relative z-10 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto android-scrollbar flex-1 text-xs text-[#191A2E]">
          
          {/* If student has multiple private subjects/groups */}
          {studentPrivateEnrollments.length > 1 && (
            <div className="classy-card p-3.5 space-y-1.5">
              <label className="font-black text-xs text-[#17163D] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#7657F6]" />
                <span>اختر المادة / الاشتراك الخاص:</span>
              </label>
              <select
                value={selectedEnrollmentId}
                onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                className="w-full classy-select"
              >
                {studentPrivateEnrollments.map((enr) => {
                  const grp = allGroups.find((g) => g.id === enr.groupId);
                  return (
                    <option key={enr.id} value={enr.id}>
                      {grp?.name || 'درس خاص'} ({enr.billingMode === 'hourly' ? 'بالساعة' : enr.billingMode === 'package' ? 'باقة' : enr.billingMode === 'postpaid' ? 'آجل' : 'مسبق'})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="classy-card p-3 space-y-1">
              <label className="font-black text-xs text-[#17163D] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#7657F6]" />
                <span>التاريخ:</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="classy-input font-bold"
              />
            </div>

            <div className="classy-card p-3 space-y-1">
              <label className="font-black text-xs text-[#17163D] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#7657F6]" />
                <span>وقت البدء:</span>
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="classy-input font-bold"
              />
            </div>
          </div>

          {/* Duration in Hours (If Hourly) OR Session Count */}
          {isHourly ? (
            <div className="classy-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-black text-[#17163D] text-xs flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-[#7657F6]" />
                  <span>مدة الحصة بالساعات:</span>
                </label>
                <span className="text-xs font-black text-[#7657F6]">
                  {hours} {hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتان' : 'ساعة'}
                  {Math.round((hours % 1) * 60) > 0 ? ` (${Math.floor(hours)} س و ${Math.round((hours % 1) * 60)} د)` : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHours((prev) => Math.max(0.25, Number((prev - 0.25).toFixed(2))))}
                  className="w-10 h-10 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-black text-base text-[#17163D] hover:bg-[#E8E7FF] active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  required
                  value={hours}
                  onChange={(e) => setHours(Math.max(0.25, parseFloat(e.target.value) || 1))}
                  className="classy-input flex-1 text-center font-black text-base"
                />
                <button
                  type="button"
                  onClick={() => setHours((prev) => Number((prev + 0.25).toFixed(2)))}
                  className="w-10 h-10 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-black text-base text-[#17163D] hover:bg-[#E8E7FF] active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Quick presets for hours */}
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <span className="text-[11px] text-[#74778F] font-bold">خيارات سريعة:</span>
                {[
                  { val: 1, label: '1 س' },
                  { val: 1.5, label: '1.5 س (1:30)' },
                  { val: 2, label: '2 س' },
                  { val: 2.5, label: '2.5 س (2:30)' },
                  { val: 3, label: '3 س' },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setHours(preset.val)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      hours === preset.val
                        ? 'bg-[#7657F6] text-white border-[#7657F6] shadow-xs'
                        : 'bg-[#F6F7FC] text-[#74778F] border-[#E8E7FF] hover:bg-[#E8E7FF]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="classy-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-black text-[#17163D] text-xs flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-[#7657F6]" />
                  <span>عدد الحصص المسجلة:</span>
                </label>
                <span className="text-[11px] font-bold text-[#74778F]">حصة واحدة أو أكثر</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSessionCount((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                  className="w-10 h-10 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-black text-base text-[#17163D] hover:bg-[#E8E7FF] active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={sessionCount}
                  onChange={(e) => setSessionCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="classy-input flex-1 text-center font-black text-base"
                />
                <button
                  type="button"
                  onClick={() => setSessionCount((prev) => (Number(prev) || 1) + 1)}
                  className="w-10 h-10 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] font-black text-base text-[#17163D] hover:bg-[#E8E7FF] active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Quick Presets for Sessions */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[11px] text-[#74778F] font-bold">اختيار سريع:</span>
                {[1, 2, 3, 4].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setSessionCount(cnt)}
                    className={`px-3 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      sessionCount === cnt
                        ? 'bg-[#7657F6] text-white border-[#7657F6] shadow-xs'
                        : 'bg-[#F6F7FC] text-[#74778F] border-[#E8E7FF] hover:bg-[#E8E7FF]'
                    }`}
                  >
                    {cnt} {cnt === 1 ? 'حصة' : 'حصص'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Attendance Status Selection */}
          <div className="classy-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-black text-[#17163D] text-xs">حالة الحضور والاحتساب:</span>
              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                isCharged ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]' : 'bg-[#F6F7FC] text-[#74778F] border border-[#E8E7FF]'
              }`}>
                {isCharged ? 'محسوبة (تستهلك رصيد)' : 'غير محسوبة (معفية)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAttendanceType('present')}
                className={`p-2.5 rounded-2xl text-xs font-black border text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  attendanceType === 'present'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-[#F6F7FC] text-[#191A2E] border-[#E8E7FF] hover:bg-[#E8E7FF]/40'
                }`}
              >
                <span>✓ حاضر (مستهلكة)</span>
                <span className={`text-[10px] ${attendanceType === 'present' ? 'text-white/85' : 'text-[#74778F]'}`}>
                  حضور فعلي
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAttendanceType('absent_charged')}
                className={`p-2.5 rounded-2xl text-xs font-black border text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  attendanceType === 'absent_charged'
                    ? 'bg-[#FF647C] text-white border-[#FF647C] shadow-sm'
                    : 'bg-[#F6F7FC] text-[#191A2E] border-[#E8E7FF] hover:bg-[#FFF1F3]'
                }`}
              >
                <span>⚠️ غائب (محسوبة)</span>
                <span className={`text-[10px] ${attendanceType === 'absent_charged' ? 'text-white/85' : 'text-[#74778F]'}`}>
                  غياب بدون عذر
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAttendanceType('absent_free')}
                className={`p-2.5 rounded-2xl text-xs font-black border text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  attendanceType === 'absent_free'
                    ? 'bg-[#17163D] text-white border-[#17163D] shadow-sm'
                    : 'bg-[#F6F7FC] text-[#191A2E] border-[#E8E7FF] hover:bg-[#E8E7FF]/40'
                }`}
              >
                <span>ℹ️ غائب (غير محسوبة)</span>
                <span className={`text-[10px] ${attendanceType === 'absent_free' ? 'text-white/85' : 'text-[#74778F]'}`}>
                  غياب بعذر معفى
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAttendanceType('cancelled')}
                className={`p-2.5 rounded-2xl text-xs font-black border text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  attendanceType === 'cancelled'
                    ? 'bg-[#403B9C] text-white border-[#403B9C] shadow-sm'
                    : 'bg-[#F6F7FC] text-[#191A2E] border-[#E8E7FF] hover:bg-[#E8E7FF]/40'
                }`}
              >
                <span>🚫 حصة ملغاة</span>
                <span className={`text-[10px] ${attendanceType === 'cancelled' ? 'text-white/85' : 'text-[#74778F]'}`}>
                  إلغاء مسبق
                </span>
              </button>
            </div>

            {/* Absence / Cancellation Reason Selector */}
            {(attendanceType === 'absent_free' || attendanceType === 'cancelled') && (
              <div className="pt-2 border-t border-[#E8E7FF] space-y-2 animate-in fade-in duration-150">
                <label className="text-[11px] font-black text-[#17163D] block">
                  سبب {attendanceType === 'cancelled' ? 'الإلغاء' : 'الغياب المعفى'}:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['الطالب ألغى', 'المدرس ألغى', 'مرض', 'ظرف طارئ', 'سبب آخر'].map((rsn) => (
                    <button
                      key={rsn}
                      type="button"
                      onClick={() => setAbsenceReason(rsn)}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
                        absenceReason === rsn
                          ? 'bg-[#17163D] text-white border-[#17163D] shadow-xs'
                          : 'bg-[#F6F7FC] text-[#191A2E] border-[#E8E7FF] hover:bg-[#E8E7FF]/40'
                      }`}
                    >
                      {rsn}
                    </button>
                  ))}
                </div>
                {absenceReason === 'سبب آخر' && (
                  <input
                    type="text"
                    placeholder="اكتب سبب الإلغاء أو الغياب..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="classy-input mt-1"
                  />
                )}
              </div>
            )}
          </div>

          {/* Pricing & Financial Calculation Preview Card */}
          <div className="classy-card p-4 space-y-3">
            {isHourly ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#74778F] font-bold">نظام المحاسبة:</span>
                  <span className="font-black text-[#7657F6] px-2.5 py-0.5 rounded-full bg-[#E8E7FF]">
                    محاسبة بالساعة (Hourly)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#74778F] font-bold">سعر الساعة:</span>
                  <strong className="text-[#191A2E] font-black">{hourlyRate} ج.م / ساعة</strong>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#74778F] font-bold">مدة الحصة:</span>
                  <strong className="text-[#191A2E] font-black">{hours} ساعة</strong>
                </div>

                <div className="pt-2 border-t border-[#E8E7FF] flex items-center justify-between">
                  <div>
                    <span className="font-black text-xs text-[#17163D] block">إجمالي قيمة الحصة:</span>
                    <span className="text-[10px] text-[#74778F] font-medium">{hours} ساعة × {hourlyRate} ج.م</span>
                  </div>
                  <span className="text-base font-black text-[#7657F6]">{totalSessionValue} ج.م</span>
                </div>
              </>
            ) : isPackage ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#74778F] font-bold">نظام المحاسبة:</span>
                  <span className="font-black text-[#7657F6] px-2.5 py-0.5 rounded-full bg-[#E8E7FF]">
                    باقة حصص (Package)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#F6F7FC] rounded-2xl text-xs border border-[#E8E7FF]">
                  <div>
                    <span className="text-[#74778F] font-bold block text-[10px] mb-0.5">إجمالي الباقة:</span>
                    <strong className="text-[#191A2E] font-black text-xs">{packageTotalPrice} ج.م</strong>
                  </div>
                  <div>
                    <span className="text-[#74778F] font-bold block text-[10px] mb-0.5">عدد حصص الباقة:</span>
                    <strong className="text-[#191A2E] font-black text-xs">{packageSessionsCount} حصص</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[#74778F] font-bold">سعر الحصة الفعلي:</span>
                  <strong className="text-[#191A2E] font-black text-sm text-emerald-600">{effectiveSessionPrice} ج.م</strong>
                </div>

                <div className="pt-2 border-t border-[#E8E7FF] flex items-center justify-between">
                  <div>
                    <span className="font-black text-xs text-[#17163D] block">إجمالي قيمة الحصص:</span>
                    <span className="text-[10px] text-[#74778F] font-medium">{sessionCount} × {effectiveSessionPrice} ج.م</span>
                  </div>
                  <span className="text-base font-black text-[#7657F6]">{totalSessionValue} ج.م</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#74778F] font-bold">نظام المحاسبة:</span>
                  <span className="font-black text-[#17163D] px-2 py-0.5 rounded-lg bg-[#F6F7FC]">
                    {isPostpaid ? 'دفع آجل (Postpaid)' : 'دفع مسبق (Prepaid)'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#74778F] font-bold">سعر الحصة:</span>
                  <strong className="text-[#191A2E] font-black">{effectiveSessionPrice} ج.م</strong>
                </div>

                <div className="pt-2 border-t border-[#E8E7FF] flex items-center justify-between">
                  <div>
                    <span className="font-black text-xs text-[#17163D] block">إجمالي القيمة:</span>
                    <span className="text-[10px] text-[#74778F] font-medium">{sessionCount} × {effectiveSessionPrice} ج.م</span>
                  </div>
                  <span className="text-sm font-black text-[#7657F6]">{totalSessionValue} ج.م</span>
                </div>
              </>
            )}
          </div>

          {/* Optional Title */}
          <div className="classy-card p-3.5 space-y-1.5">
            <label className="font-black text-xs text-[#17163D] flex items-center gap-1.5">
              <AlignRight className="w-3.5 h-3.5 text-[#7657F6]" />
              <span>عنوان أو موضوع الحصة (اختياري):</span>
            </label>
            <input
              type="text"
              placeholder="مثال: مراجعة الوحدة الأولى / حل تدريبات"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="classy-input"
            />
          </div>

          {/* Optional Notes */}
          <div className="classy-card p-3.5 space-y-1.5">
            <label className="font-black text-xs text-[#17163D]">
              ملاحظات الحصة (اختياري):
            </label>
            <textarea
              rows={2}
              placeholder="أي ملاحظات خاصة بأداء الطالب أو الحصة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="classy-textarea"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-[#E8E7FF] bg-white text-[#74778F] font-black text-xs hover:bg-[#F6F7FC] transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#7657F6]/30 active:scale-95 transition-all disabled:opacity-50 cursor-pointer hover:brightness-105"
            >
              <Check className="w-4 h-4 text-[#55C7E8] stroke-[3]" />
              <span>{isHourly ? `تأكيد تسجيل (${hours} س) Private` : `تأكيد تسجيل (${sessionCount}) حصة Private`}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
    </ModalPortal>
  );
};
