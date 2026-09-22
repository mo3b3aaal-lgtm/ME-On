import React, { useState } from 'react';
import { X, Calendar, Clock, BookOpen, Layers, CheckCircle2, Sparkles, Hash, AlignRight, Timer } from 'lucide-react';
import { Student, Enrollment, Group } from '../types';
import { db, roundMoney, multiplyMoney, divideMoney } from '../utils/storage';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';

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
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200"
        dir="rtl"
      >
        <div className="bg-[#F7F8FC] border border-slate-200 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-l from-[#0F172A] via-[#172554] to-[#1E293B] text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#C9A227]/20 text-[#E0C35A] border border-[#C9A227]/30 flex items-center justify-center font-bold shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">تسجيل حصة Private</h3>
              <p className="text-[11px] text-slate-300 flex items-center gap-1.5 mt-0.5">
                <span>الطالب:</span>
                <strong className="text-white font-bold">{student.name}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto android-scrollbar flex-1 text-xs text-slate-700">
          
          {/* If student has multiple private subjects/groups */}
          {studentPrivateEnrollments.length > 1 && (
            <div className="space-y-1">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#C9A227]" />
                <span>اختر المادة / الاشتراك الخاص:</span>
              </label>
              <select
                value={selectedEnrollmentId}
                onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 focus:ring-2 focus:ring-[#C9A227] outline-hidden cursor-pointer"
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
            <div className="space-y-1">
              <label className="font-bold text-slate-800 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#172554]" />
                <span>التاريخ:</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-xs focus:ring-2 focus:ring-[#172554] outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-800 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#172554]" />
                <span>وقت البدء:</span>
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-xs focus:ring-2 focus:ring-[#172554] outline-hidden"
              />
            </div>
          </div>

          {/* Duration in Hours (If Hourly) OR Session Count */}
          {isHourly ? (
            <div className="space-y-2.5 p-3.5 bg-white rounded-2xl border border-amber-200 shadow-xs">
              <label className="font-bold text-slate-900 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-amber-800">
                  <Timer className="w-4 h-4" />
                  <span>مدة الحصة بالساعات:</span>
                </span>
                <span className="text-xs font-black text-[#C9A227]">
                  {hours} {hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتان' : 'ساعة'}
                  {Math.round((hours % 1) * 60) > 0 ? ` (${Math.floor(hours)} س و ${Math.round((hours % 1) * 60)} د)` : ''}
                </span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHours((prev) => Math.max(0.25, Number((prev - 0.25).toFixed(2))))}
                  className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 font-black text-base text-slate-800 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
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
                  className="flex-1 p-2.5 text-center text-base font-black rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-[#C9A227] outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setHours((prev) => Number((prev + 0.25).toFixed(2)))}
                  className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 font-black text-base text-slate-800 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Quick presets for hours */}
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <span className="text-[10px] text-slate-400 font-bold">خيارات سريعة:</span>
                {[
                  { val: 1, label: '1 ساعة' },
                  { val: 1.5, label: '1.5 ساعة (1:30)' },
                  { val: 2, label: '2 ساعة' },
                  { val: 2.25, label: '2.25 س (2:15)' },
                  { val: 2.5, label: '2.5 ساعة (2:30)' },
                  { val: 3, label: '3 ساعات' },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setHours(preset.val)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      hours === preset.val
                        ? 'bg-[#C9A227] text-white border-[#C9A227]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-3 bg-white rounded-2xl border border-slate-200">
              <label className="font-bold text-slate-900 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-[#C9A227]" />
                  <span>عدد الحصص المسجلة:</span>
                </span>
                <span className="text-[11px] font-bold text-slate-400">حصة واحدة أو أكثر</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSessionCount((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                  className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 font-black text-base text-slate-800 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
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
                  className="flex-1 p-2.5 text-center text-base font-black rounded-xl border border-slate-200 bg-white text-slate-900 focus:ring-2 focus:ring-[#C9A227] outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setSessionCount((prev) => (Number(prev) || 1) + 1)}
                  className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 font-black text-base text-slate-800 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center shadow-xs cursor-pointer"
                >
                  +
                </button>
              </div>

              {/* Quick Presets for Sessions */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-bold">اختيار سريع:</span>
                {[1, 2, 3, 4].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setSessionCount(cnt)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      sessionCount === cnt
                        ? 'bg-[#C9A227] text-white border-[#C9A227]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {cnt} {cnt === 1 ? 'حصة' : 'حصص'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Attendance Status Selection */}
          <div className="space-y-2 p-3.5 bg-white rounded-2xl border border-slate-200">
            <label className="font-bold text-slate-900 text-xs flex items-center justify-between">
              <span>حالة الحضور والاحتساب:</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isCharged ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {isCharged ? 'محسوبة (تستهلك رصيد أو تضاف للمستحق)' : 'غير محسوبة (لا تؤثر مالياً)'}
              </span>
            </label>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setAttendanceType('present')}
                className={`p-2 rounded-xl text-[11px] font-bold border text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  attendanceType === 'present'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-white'
                }`}
              >
                <span>✓ حاضر (مستهلكة)</span>
                <span className={`text-[9px] ${attendanceType === 'present' ? 'text-white/80' : 'text-slate-400'}`}>
                  حضور فعلي
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAttendanceType('absent_charged')}
                className={`p-2 rounded-xl text-[11px] font-bold border text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  attendanceType === 'absent_charged'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-white'
                }`}
              >
                <span>⚠️ غائب (محسوبة)</span>
                <span className={`text-[9px] ${attendanceType === 'absent_charged' ? 'text-white/80' : 'text-slate-400'}`}>
                  غياب بدون عذر
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAttendanceType('absent_free')}
                className={`p-2 rounded-xl text-[11px] font-bold border text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  attendanceType === 'absent_free'
                    ? 'bg-slate-700 text-white border-slate-700 shadow-xs'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-white'
                }`}
              >
                <span>ℹ️ غائب (غير محسوبة)</span>
                <span className={`text-[9px] ${attendanceType === 'absent_free' ? 'text-white/80' : 'text-slate-400'}`}>
                  غياب بعذر معفى
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAttendanceType('cancelled')}
                className={`p-2 rounded-xl text-[11px] font-bold border text-center transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  attendanceType === 'cancelled'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-white'
                }`}
              >
                <span>🚫 حصة ملغاة</span>
                <span className={`text-[9px] ${attendanceType === 'cancelled' ? 'text-white/80' : 'text-slate-400'}`}>
                  إلغاء الحصة مسبقاً
                </span>
              </button>
            </div>

            {/* Absence / Cancellation Reason Selector */}
            {(attendanceType === 'absent_free' || attendanceType === 'cancelled') && (
              <div className="pt-2 border-t border-slate-200 space-y-1.5 animate-in fade-in duration-150">
                <label className="text-[11px] font-bold text-slate-900 block">
                  سبب {attendanceType === 'cancelled' ? 'الإلغاء' : 'الغياب المعفى'}:
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {['الطالب ألغى', 'المدرس ألغى', 'مرض', 'ظرف طارئ', 'سبب آخر'].map((rsn) => (
                    <button
                      key={rsn}
                      type="button"
                      onClick={() => setAbsenceReason(rsn)}
                      className={`py-1 px-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        absenceReason === rsn
                          ? 'bg-[#172554] text-white border-[#172554]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
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
                    className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-[#172554] outline-hidden mt-1"
                  />
                )}
              </div>
            )}
          </div>

          {/* Pricing & Financial Calculation Preview Card */}
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-2.5">
            {isHourly ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">نظام المحاسبة:</span>
                  <span className="font-bold text-amber-800 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-200">
                    Hourly Billing (محاسبة بالساعة)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">سعر الساعة:</span>
                  <strong className="text-slate-900 font-bold">{hourlyRate} جنيه / ساعة</strong>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">مدة الحصة:</span>
                  <strong className="text-slate-900 font-bold">{hours} ساعة</strong>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">إجمالي قيمة الحصة:</span>
                    <span className="text-[10px] text-slate-500 font-medium">{hours} ساعة × {hourlyRate} جنيه</span>
                  </div>
                  <span className="text-base font-black text-[#C9A227]">{totalSessionValue} جنيه</span>
                </div>

                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[10px] text-emerald-800 font-bold">
                  ✓ سيتم إضافة {totalSessionValue} جنيه إلى إجمالي المستحق للمادة، ويتم تسجيل {hours} ساعة حضور.
                </div>
              </>
            ) : isPackage ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">نظام المحاسبة:</span>
                  <span className="font-bold text-amber-800 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-200">
                    Session Package (باقة حصص)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl text-xs border border-slate-200">
                  <div>
                    <span className="text-slate-500 block text-[10px] mb-0.5">إجمالي الباقة:</span>
                    <strong className="text-slate-900 font-bold text-xs">{packageTotalPrice} جنيه</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] mb-0.5">عدد حصص الباقة:</span>
                    <strong className="text-slate-900 font-bold text-xs">{packageSessionsCount} حصص</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">سعر الحصة الفعلي:</span>
                  <div className="text-right">
                    <strong className="text-slate-900 font-bold text-sm text-emerald-700">{effectiveSessionPrice} جنيه</strong>
                    <span className="text-[10px] text-slate-400 block">({packageTotalPrice} ÷ {packageSessionsCount} حصص)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">عدد الحصص المسجلة:</span>
                  <strong className="text-slate-900 font-bold">{sessionCount} {sessionCount === 1 ? 'حصة' : 'حصص'}</strong>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">إجمالي قيمة الحصص المسجلة:</span>
                    <span className="text-[10px] text-slate-500 font-medium">{sessionCount} × {effectiveSessionPrice} جنيه</span>
                  </div>
                  <span className="text-base font-black text-[#C9A227]">{totalSessionValue} جنيه</span>
                </div>

                {/* Live Package Balance Impact Note */}
                {finSummary && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[10px] text-emerald-800 space-y-1">
                    <div className="flex justify-between">
                      <span>رصيد الباقة المتاح حالياً:</span>
                      <strong>{finSummary.sessionCredit} حصص ({multiplyMoney(finSummary.sessionCredit, effectiveSessionPrice)} جنيه)</strong>
                    </div>
                    {finSummary.sessionCredit >= sessionCount ? (
                      <div className="text-emerald-800 font-bold">
                        ✓ سيتم خصم ({sessionCount}) حصص من رصيد الباقة. الرصيد المتبقي سيصبح: <strong>{finSummary.sessionCredit - sessionCount} حصص ({multiplyMoney(finSummary.sessionCredit - sessionCount, effectiveSessionPrice)} جنيه)</strong>
                      </div>
                    ) : (
                      <div className="text-rose-700 font-bold">
                        ⚠️ الرصيد المتاح ({finSummary.sessionCredit}) حصص. سيتم استهلاك الرصيد، وتسجيل ({sessionCount - finSummary.sessionCredit}) حصص مستحقة بقيمة <strong>{multiplyMoney(sessionCount - finSummary.sessionCredit, effectiveSessionPrice)} جنيه</strong> تضاف إلى المستحق.
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">نظام المحاسبة:</span>
                  <span className="font-bold text-slate-800 px-2 py-0.5 rounded-md bg-slate-100">
                    {isPostpaid ? 'دفع آجل بعد الحصة (Postpaid)' : 'دفع بالحصة مسبق (Prepaid)'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">سعر الحصة:</span>
                  <strong className="text-slate-900 font-bold">{effectiveSessionPrice} جنيه</strong>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">عدد الحصص المسجلة:</span>
                  <strong className="text-slate-900 font-bold">{sessionCount} {sessionCount === 1 ? 'حصة' : 'حصص'}</strong>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">إجمالي القيمة:</span>
                    <span className="text-[10px] text-slate-500 font-medium">{sessionCount} × {effectiveSessionPrice} جنيه</span>
                  </div>
                  <span className="text-sm font-black text-[#C9A227]">{totalSessionValue} جنيه</span>
                </div>

                {isPrepaid && finSummary && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[10px] text-emerald-800 space-y-1">
                    <div className="flex justify-between">
                      <span>الرصيد المتاح حالياً:</span>
                      <strong>{finSummary.sessionCredit} حصص ({finSummary.sessionCreditValue || multiplyMoney(finSummary.sessionCredit, effectiveSessionPrice)} جنيه)</strong>
                    </div>
                    {finSummary.sessionCredit >= sessionCount ? (
                      <div className="text-emerald-800 font-bold">
                        ✓ سيتم استهلاك ({sessionCount}) حصص من الرصيد. الرصيد المتبقي سيصبح: <strong>{finSummary.sessionCredit - sessionCount} حصص ({multiplyMoney(finSummary.sessionCredit - sessionCount, effectiveSessionPrice)} جنيه)</strong>
                      </div>
                    ) : (
                      <div className="text-rose-700 font-bold">
                        ⚠️ الرصيد المتاح ({finSummary.sessionCredit}) حصص. سيتم استهلاك الرصيد بالكامل (0)، وتسجيل ({sessionCount - finSummary.sessionCredit}) حصص مستحقة بقيمة <strong>{multiplyMoney(sessionCount - finSummary.sessionCredit, effectiveSessionPrice)} جنيه</strong> تضاف إلى المستحق (Current Due).
                      </div>
                    )}
                  </div>
                )}

                {isPostpaid && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-[10px] text-rose-800 font-bold">
                    ✓ نظام آجل: سيتم زيادة الحصص المستحقة (+{sessionCount}) وزيادة المبلغ المستحق بمقدار (+{totalSessionValue} جنيه).
                  </div>
                )}
              </>
            )}
          </div>

          {/* Optional Title */}
          <div className="space-y-1">
            <label className="font-bold text-slate-800 flex items-center gap-1.5">
              <AlignRight className="w-3.5 h-3.5 text-[#172554]" />
              <span>عنوان أو موضوع الحصة (اختياري):</span>
            </label>
            <input
              type="text"
              placeholder="مثال: مراجعة الوحدة الأولى / حل تدريبات"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-[#172554] outline-hidden"
            />
          </div>

          {/* Optional Notes */}
          <div className="space-y-1">
            <label className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>ملاحظات الحصة (اختياري):</span>
            </label>
            <textarea
              rows={2}
              placeholder="أي ملاحظات خاصة بأداء الطالب أو الحصة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-[#172554] outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-2.5 rounded-xl bg-[#C9A227] hover:bg-[#B88237] text-white font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isHourly ? `تأكيد تسجيل (${hours} ساعة) Private` : `تأكيد تسجيل (${sessionCount}) حصة Private`}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
    </ModalPortal>
  );
};
