import React, { useState } from 'react';
import { X, Calendar, Clock, BookOpen, Layers, CheckCircle2, Sparkles, Hash, AlignRight } from 'lucide-react';
import { Student, Enrollment, Group } from '../types';
import { db } from '../utils/storage';

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
  if (!isOpen || !student) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  // Get private enrollments for this student
  const allEnrollments = db.getEnrollments();
  const allGroups = db.getGroups();

  const studentPrivateEnrollments = allEnrollments.filter((enr) => {
    if (enr.studentId !== student.id) return false;
    const grp = allGroups.find((g) => g.id === enr.groupId);
    return enr.serviceType === 'private' || grp?.type === 'private';
  });

  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>(() => {
    return studentPrivateEnrollments[0]?.id || '';
  });

  const [date, setDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>(nowTime || '16:00');
  const [sessionCount, setSessionCount] = useState<number>(1);
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

  const isPackage =
    activeEnrollment?.billingMode === 'package' ||
    activeEnrollment?.billingType === 'package' ||
    activeGroup?.billingMode === 'package' ||
    activeGroup?.billingType === 'package';

  const isPrepaid =
    !isPackage && (
      activeEnrollment?.billingMode === 'prepaid' ||
      activeEnrollment?.billingType === 'prepaid' ||
      (activeEnrollment?.billingType === 'per_session' && activeEnrollment?.billingMode !== 'postpaid')
    );

  const isPostpaid =
    !isPackage && (
      activeEnrollment?.billingMode === 'postpaid' ||
      activeEnrollment?.billingType === 'postpaid'
    );

  const packageSessionsCount = isPackage
    ? (activeEnrollment?.packageSessionsCount || activeGroup?.packageSessionsCount || 10)
    : 10;

  const packageTotalPrice = isPackage
    ? (activeEnrollment?.packagePrice ||
       (activeGroup?.billingMode === 'package' || activeGroup?.billingType === 'package' ? groupDefaultPrice(activeGroup) : undefined) ||
       activeEnrollment?.customPrice ||
       1000)
    : 1000;

  function groupDefaultPrice(g?: Group) {
    return g?.defaultPrice;
  }

  // Effective Session Price = Package Total Price ÷ Package Session Count (Never use Package Total Price as session price)
  const effectiveSessionPrice = isPackage && packageSessionsCount > 0
    ? Math.round(packageTotalPrice / packageSessionsCount)
    : (activeEnrollment?.customPrice || activeGroup?.defaultPrice || 100);

  const isCharged = attendanceType === 'present' || attendanceType === 'absent_charged';

  // Total Session Value = Session Count × Effective Session Price (0 if uncharged or cancelled)
  const totalSessionValue = isCharged ? (Number(sessionCount) || 1) * effectiveSessionPrice : 0;

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
        sessionCount: count,
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

  return (
    <div className="fixed inset-0 z-[60] bg-[#2D332A]/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-3xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 bg-white border-b border-[#E8E2D6] relative">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 rounded-full bg-[#F2ECE1] text-[#6B7567] hover:text-[#2D332A] hover:bg-[#EAE5D8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#D49B4B]/15 text-[#9C6615] border border-[#D49B4B]/30 flex items-center justify-center font-bold shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#2D332A]">تسجيل حصة Private</h3>
              <p className="text-[11px] text-[#8A9187] flex items-center gap-1.5 mt-0.5">
                <span>الطالب:</span>
                <strong className="text-[#2D332A]">{student.name}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto android-scrollbar flex-1 text-xs text-[#434B3E]">
          
          {/* If student has multiple private subjects/groups */}
          {studentPrivateEnrollments.length > 1 && (
            <div className="space-y-1">
              <label className="font-bold text-[#2D332A] flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#D49B4B]" />
                <span>اختر خدمة الدرس الخاص:</span>
              </label>
              <select
                value={selectedEnrollmentId}
                onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#E8E2D6] bg-white font-medium focus:ring-2 focus:ring-[#D49B4B] focus:border-transparent outline-hidden"
              >
                {studentPrivateEnrollments.map((enr) => {
                  const grp = allGroups.find((g) => g.id === enr.groupId);
                  return (
                    <option key={enr.id} value={enr.id}>
                      {grp?.name || 'درس خاص'} ({enr.customPrice} ج.م/حصة)
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-[#2D332A] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#748C70]" />
                <span>التاريخ:</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#E8E2D6] bg-white font-medium focus:ring-2 focus:ring-[#748C70] focus:border-transparent outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#2D332A] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#748C70]" />
                <span>الوقت:</span>
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#E8E2D6] bg-white font-medium focus:ring-2 focus:ring-[#748C70] focus:border-transparent outline-hidden"
              />
            </div>
          </div>

          {/* Session Count Field */}
          <div className="space-y-1.5 p-3.5 bg-white rounded-2xl border border-[#D49B4B]/30 bg-[#D49B4B]/5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-[#2D332A] flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-[#D49B4B]" />
                <span>عدد الحصص (Session Count):</span>
              </label>
              <span className="text-[11px] font-bold text-[#9C6615] bg-[#D49B4B]/15 px-2 py-0.5 rounded-full">
                الافتراضي: 1
              </span>
            </div>
            
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSessionCount((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                className="w-10 h-10 rounded-xl bg-white border border-[#E8E2D6] font-black text-base text-[#2D332A] hover:bg-[#F2ECE1] active:scale-95 transition-all flex items-center justify-center shadow-xs"
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
                className="flex-1 p-2.5 text-center text-base font-black rounded-xl border border-[#E8E2D6] bg-white text-[#2D332A] focus:ring-2 focus:ring-[#D49B4B] focus:border-transparent outline-hidden"
              />
              <button
                type="button"
                onClick={() => setSessionCount((prev) => (Number(prev) || 1) + 1)}
                className="w-10 h-10 rounded-xl bg-white border border-[#E8E2D6] font-black text-base text-[#2D332A] hover:bg-[#F2ECE1] active:scale-95 transition-all flex items-center justify-center shadow-xs"
              >
                +
              </button>
            </div>

            {/* Quick Presets for Sessions */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-[#8A9187] font-bold">اختيار سريع:</span>
              {[1, 2, 3, 4].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setSessionCount(cnt)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                    sessionCount === cnt
                      ? 'bg-[#D49B4B] text-white border-[#D49B4B]'
                      : 'bg-white text-[#6B7567] border-[#E8E2D6] hover:bg-[#F9F7F2]'
                  }`}
                >
                  {cnt} {cnt === 1 ? 'حصة' : 'حصص'}
                </button>
              ))}
            </div>
          </div>

          {/* Attendance Status Selection */}
          <div className="space-y-2 p-3.5 bg-white rounded-2xl border border-[#E8E2D6]">
            <label className="font-bold text-[#2D332A] text-xs flex items-center justify-between">
              <span>حالة الحضور والاحتساب:</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isCharged ? 'bg-[#748C70]/15 text-[#748C70]' : 'bg-[#8A9187]/15 text-[#6B7567]'
              }`}>
                {isCharged ? 'محسوبة (تستهلك رصيد أو تضاف للمستحق)' : 'غير محسوبة (لا تؤثر مالياً)'}
              </span>
            </label>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setAttendanceType('present')}
                className={`p-2 rounded-xl text-[11px] font-bold border text-center transition-all flex flex-col items-center gap-0.5 ${
                  attendanceType === 'present'
                    ? 'bg-[#748C70] text-white border-[#748C70] shadow-xs'
                    : 'bg-[#F9F7F2] text-[#2D332A] border-[#E8E2D6] hover:bg-white'
                }`}
              >
                <span>✓ حاضر (مستهلكة)</span>
                <span className={`text-[9px] ${attendanceType === 'present' ? 'text-white/80' : 'text-[#8A9187]'}`}>
                  حضور فعلي
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAttendanceType('absent_charged')}
                className={`p-2 rounded-xl text-[11px] font-bold border text-center transition-all flex flex-col items-center gap-0.5 ${
                  attendanceType === 'absent_charged'
                    ? 'bg-[#C97C5D] text-white border-[#C97C5D] shadow-xs'
                    : 'bg-[#F9F7F2] text-[#2D332A] border-[#E8E2D6] hover:bg-white'
                }`}
              >
                <span>⚠️ غائب (محسوبة)</span>
                <span className={`text-[9px] ${attendanceType === 'absent_charged' ? 'text-white/80' : 'text-[#8A9187]'}`}>
                  غياب بدون عذر
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAttendanceType('absent_free')}
                className={`p-2 rounded-xl text-[11px] font-bold border text-center transition-all flex flex-col items-center gap-0.5 ${
                  attendanceType === 'absent_free'
                    ? 'bg-[#8A9187] text-white border-[#8A9187] shadow-xs'
                    : 'bg-[#F9F7F2] text-[#2D332A] border-[#E8E2D6] hover:bg-white'
                }`}
              >
                <span>ℹ️ غائب (غير محسوبة)</span>
                <span className={`text-[9px] ${attendanceType === 'absent_free' ? 'text-white/80' : 'text-[#8A9187]'}`}>
                  غياب بعذر معفى
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAttendanceType('cancelled')}
                className={`p-2 rounded-xl text-[11px] font-bold border text-center transition-all flex flex-col items-center gap-0.5 ${
                  attendanceType === 'cancelled'
                    ? 'bg-[#434B3E] text-white border-[#434B3E] shadow-xs'
                    : 'bg-[#F9F7F2] text-[#2D332A] border-[#E8E2D6] hover:bg-white'
                }`}
              >
                <span>🚫 حصة ملغاة</span>
                <span className={`text-[9px] ${attendanceType === 'cancelled' ? 'text-white/80' : 'text-[#8A9187]'}`}>
                  إلغاء الحصة مسبقاً
                </span>
              </button>
            </div>

            {/* Absence / Cancellation Reason Selector */}
            {(attendanceType === 'absent_free' || attendanceType === 'cancelled') && (
              <div className="pt-2 border-t border-[#E8E2D6]/60 space-y-1.5 animate-in fade-in duration-150">
                <label className="text-[11px] font-bold text-[#2D332A] block">
                  سبب {attendanceType === 'cancelled' ? 'الإلغاء' : 'الغياب المعفى'}:
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {['الطالب ألغى', 'المدرس ألغى', 'مرض', 'ظرف طارئ', 'سبب آخر'].map((rsn) => (
                    <button
                      key={rsn}
                      type="button"
                      onClick={() => setAbsenceReason(rsn)}
                      className={`py-1 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                        absenceReason === rsn
                          ? 'bg-[#748C70] text-white border-[#748C70]'
                          : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6] hover:bg-white'
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
                    className="w-full p-2 text-xs rounded-xl border border-[#E8E2D6] bg-white font-medium focus:ring-2 focus:ring-[#748C70] outline-hidden mt-1"
                  />
                )}
              </div>
            )}
          </div>

          {/* Pricing & Financial Calculation Preview Card */}
          <div className="p-3.5 bg-white rounded-2xl border border-[#E8E2D6] space-y-2.5">
            {isPackage ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8A9187]">نظام المحاسبة:</span>
                  <span className="font-bold text-[#9C6615] px-2.5 py-0.5 rounded-full bg-[#D49B4B]/15 border border-[#D49B4B]/30">
                    Session Package (باقة حصص)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#F9F7F2] rounded-xl text-xs border border-[#E8E2D6]/60">
                  <div>
                    <span className="text-[#8A9187] block text-[10px] mb-0.5">إجمالي الباقة:</span>
                    <strong className="text-[#2D332A] font-bold text-xs">{packageTotalPrice} جنيه</strong>
                  </div>
                  <div>
                    <span className="text-[#8A9187] block text-[10px] mb-0.5">عدد حصص الباقة:</span>
                    <strong className="text-[#2D332A] font-bold text-xs">{packageSessionsCount} حصص</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[#8A9187]">سعر الحصة الفعلي:</span>
                  <div className="text-right">
                    <strong className="text-[#2D332A] font-bold text-sm text-[#748C70]">{effectiveSessionPrice} جنيه</strong>
                    <span className="text-[10px] text-[#8A9187] block">({packageTotalPrice} ÷ {packageSessionsCount} حصص)</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8A9187]">عدد الحصص المسجلة:</span>
                  <strong className="text-[#2D332A] font-bold">{sessionCount} {sessionCount === 1 ? 'حصة' : 'حصص'}</strong>
                </div>

                <div className="pt-2 border-t border-[#E8E2D6] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-[#2D332A] block">إجمالي قيمة الحصص المسجلة:</span>
                    <span className="text-[10px] text-[#8A9187] font-medium">{sessionCount} × {effectiveSessionPrice} جنيه</span>
                  </div>
                  <span className="text-base font-black text-[#D49B4B]">{totalSessionValue} جنيه</span>
                </div>

                {/* Live Package Balance Impact Note */}
                {finSummary && (
                  <div className="p-2 bg-[#748C70]/10 rounded-xl text-[10px] text-[#60755C] space-y-1">
                    <div className="flex justify-between">
                      <span>رصيد الباقة المتاح حالياً:</span>
                      <strong>{finSummary.sessionCredit} حصص ({finSummary.sessionCredit * effectiveSessionPrice} جنيه)</strong>
                    </div>
                    {finSummary.sessionCredit >= sessionCount ? (
                      <div className="text-[#60755C] font-bold">
                        ✓ سيتم خصم ({sessionCount}) حصص من رصيد الباقة. الرصيد المتبقي سيصبح: <strong>{finSummary.sessionCredit - sessionCount} حصص ({(finSummary.sessionCredit - sessionCount) * effectiveSessionPrice} جنيه)</strong>
                      </div>
                    ) : (
                      <div className="text-[#C97C5D] font-bold">
                        ⚠️ الرصيد المتاح ({finSummary.sessionCredit}) حصص. سيتم استهلاك الرصيد، وتسجيل ({sessionCount - finSummary.sessionCredit}) حصص مستحقة بقيمة <strong>{(sessionCount - finSummary.sessionCredit) * effectiveSessionPrice} جنيه</strong> تضاف إلى المستحق.
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8A9187]">نظام المحاسبة:</span>
                  <span className="font-bold text-[#2D332A] px-2 py-0.5 rounded-md bg-[#F2ECE1]">
                    {isPostpaid ? 'دفع آجل بعد الحصة (Postpaid)' : 'دفع بالحصة مسبق (Prepaid)'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8A9187]">سعر الحصة:</span>
                  <strong className="text-[#2D332A] font-bold">{effectiveSessionPrice} جنيه</strong>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8A9187]">عدد الحصص المسجلة:</span>
                  <strong className="text-[#2D332A] font-bold">{sessionCount} {sessionCount === 1 ? 'حصة' : 'حصص'}</strong>
                </div>

                <div className="pt-2 border-t border-[#E8E2D6] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-[#2D332A] block">إجمالي القيمة:</span>
                    <span className="text-[10px] text-[#8A9187] font-medium">{sessionCount} × {effectiveSessionPrice} جنيه</span>
                  </div>
                  <span className="text-sm font-black text-[#D49B4B]">{totalSessionValue} جنيه</span>
                </div>

                {/* Live Prepaid / Postpaid Impact Note */}
                {isPrepaid && finSummary && (
                  <div className="p-2 bg-[#748C70]/10 rounded-xl text-[10px] text-[#60755C] space-y-1">
                    <div className="flex justify-between">
                      <span>الرصيد المتاح حالياً:</span>
                      <strong>{finSummary.sessionCredit} حصص ({finSummary.sessionCreditValue || finSummary.sessionCredit * effectiveSessionPrice} جنيه)</strong>
                    </div>
                    {finSummary.sessionCredit >= sessionCount ? (
                      <div className="text-[#60755C] font-bold">
                        ✓ سيتم استهلاك ({sessionCount}) حصص من الرصيد. الرصيد المتبقي سيصبح: <strong>{finSummary.sessionCredit - sessionCount} حصص ({(finSummary.sessionCredit - sessionCount) * effectiveSessionPrice} جنيه)</strong>
                      </div>
                    ) : (
                      <div className="text-[#C97C5D] font-bold">
                        ⚠️ الرصيد المتاح ({finSummary.sessionCredit}) حصص. سيتم استهلاك الرصيد بالكامل (0)، وتسجيل ({sessionCount - finSummary.sessionCredit}) حصص مستحقة بقيمة <strong>{(sessionCount - finSummary.sessionCredit) * effectiveSessionPrice} جنيه</strong> تضاف إلى المستحق (Current Due).
                      </div>
                    )}
                  </div>
                )}

                {isPostpaid && (
                  <div className="p-2 bg-[#C97C5D]/10 rounded-xl text-[10px] text-[#C97C5D] font-bold">
                    ✓ نظام آجل: سيتم زيادة الحصص المستحقة (+{sessionCount}) وزيادة المبلغ المستحق بمقدار (+{totalSessionValue} جنيه).
                  </div>
                )}
              </>
            )}
          </div>

          {/* Optional Title */}
          <div className="space-y-1">
            <label className="font-bold text-[#2D332A] flex items-center gap-1.5">
              <AlignRight className="w-3.5 h-3.5 text-[#748C70]" />
              <span>عنوان أو موضوع الحصة (اختياري):</span>
            </label>
            <input
              type="text"
              placeholder="مثال: مراجعة الوحدة الأولى / حل تدريبات"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[#E8E2D6] bg-white font-medium focus:ring-2 focus:ring-[#748C70] focus:border-transparent outline-hidden"
            />
          </div>

          {/* Optional Notes */}
          <div className="space-y-1">
            <label className="font-bold text-[#2D332A] flex items-center gap-1.5">
              <span>ملاحظات الحصة (اختياري):</span>
            </label>
            <textarea
              rows={2}
              placeholder="أي ملاحظات خاصة بأداء الطالب أو الحصة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[#E8E2D6] bg-white font-medium focus:ring-2 focus:ring-[#748C70] focus:border-transparent outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white border border-[#E8E2D6] text-[#6B7567] font-bold hover:bg-[#F2ECE1] transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-2 py-2.5 rounded-xl bg-[#D49B4B] hover:bg-[#B88237] text-white font-bold flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تأكيد تسجيل ({sessionCount}) حصة Private</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
