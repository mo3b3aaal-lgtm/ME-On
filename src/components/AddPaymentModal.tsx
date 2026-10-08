import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  DollarSign,
  Calendar,
  CalendarDays,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Coins,
  CreditCard,
  Wallet,
  ArrowRightLeft,
  Info,
  Users,
  Check,
  Receipt,
  ArrowDownCircle,
} from 'lucide-react';
import { Student, Payment, PaymentMethod, PaymentTargetType, Enrollment } from '../types';
import {
  db,
  getArabicMonthName,
  getBillingModeLabel,
  getEffectiveSessionPrice,
  roundMoney,
  multiplyMoney,
  divideMoney,
  calculateCoveredSessions,
  calculateMoneyRemainder,
} from '../utils/storage';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { useTranslation } from '../utils/i18n';
import { toLocalISODate, parseLocalDateStr } from '../utils/localDate';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetStudent?: Student | null;
  targetEnrollmentId?: string;
  allStudents: Student[];
  onPaymentSaved: () => void;
}

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  targetStudent,
  targetEnrollmentId,
  allStudents,
  onPaymentSaved,
}) => {
  const { t, isRTL } = useTranslation();
  const todayStr = toLocalISODate();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [studentId, setStudentId] = useState(targetStudent ? targetStudent.id : allStudents[0]?.id || '');
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>(targetEnrollmentId || '');
  const [paymentType, setPaymentType] = useState<PaymentTargetType>('specific_month');

  // Month payment state
  const [targetMonth, setTargetMonth] = useState<number>(currentMonth);
  const [targetYear, setTargetYear] = useState<number>(currentYear);

  // Session count state
  const [sessionCount, setSessionCount] = useState<number>(8);

  // Custom amount state
  const [customAmountInput, setCustomAmountInput] = useState<number>(100);

  // Common payment details
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState(todayStr);
  const [notes, setNotes] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');

  // Enrollments for selected student (Memoized for fast modal rendering)
  const studentEnrollments = useMemo(
    () => (studentId ? db.getStudentEnrollments(studentId) : []),
    [studentId]
  );

  useEffect(() => {
    if (targetStudent) {
      setStudentId(targetStudent.id);
    } else if (allStudents.length > 0 && !studentId) {
      setStudentId(allStudents[0].id);
    }
  }, [targetStudent, allStudents, isOpen]);

  useEffect(() => {
    if (studentEnrollments.length > 0) {
      if (targetEnrollmentId && studentEnrollments.some((e) => e.id === targetEnrollmentId)) {
        setSelectedEnrollmentId(targetEnrollmentId);
      } else if (!selectedEnrollmentId || !studentEnrollments.some((e) => e.id === selectedEnrollmentId)) {
        setSelectedEnrollmentId(studentEnrollments[0].id);
      }
    } else {
      setSelectedEnrollmentId('');
    }
  }, [studentId, studentEnrollments, targetEnrollmentId, selectedEnrollmentId]);

  const activeEnrollment = useMemo(
    () => studentEnrollments.find((e) => e.id === selectedEnrollmentId) || studentEnrollments[0],
    [studentEnrollments, selectedEnrollmentId]
  );

  const activeGroup = useMemo(
    () => (activeEnrollment ? db.getGroupById(activeEnrollment.groupId) : undefined),
    [activeEnrollment?.groupId]
  );

  const enrollmentSummary = useMemo(
    () => (activeEnrollment ? db.calculateEnrollmentFinancials(activeEnrollment.id) : undefined),
    [activeEnrollment?.id]
  );

  // Unit session price for active enrollment
  const sessionUnitPrice = getEffectiveSessionPrice(activeEnrollment, activeGroup);

  // Monthly breakdown for selected month
  const selectedMonthItem = enrollmentSummary?.monthlyLedger.find(
    (m) => m.month === targetMonth && m.year === targetYear
  );

  const monthTotalRequired = selectedMonthItem
    ? selectedMonthItem.totalRequired
    : activeEnrollment?.customPrice || 0;
  const monthPaidSoFar = selectedMonthItem ? selectedMonthItem.totalPaid : 0;
  const monthRemaining = Math.max(0, monthTotalRequired - monthPaidSoFar);

  // Auto-switch payment type if monthly is selected vs per_session
  useEffect(() => {
    if (activeEnrollment?.billingType === 'monthly' || activeEnrollment?.billingMode === 'monthly') {
      setPaymentType('specific_month');
    } else {
      setPaymentType('session_count');
    }
  }, [activeEnrollment?.id]);

  // Set default custom amount when month or session count changes
  useEffect(() => {
    if (paymentType === 'specific_month') {
      setCustomAmountInput(monthRemaining > 0 ? monthRemaining : monthTotalRequired);
    } else if (paymentType === 'single_session') {
      setCustomAmountInput(sessionUnitPrice);
    } else if (paymentType === 'session_count') {
      setCustomAmountInput(multiplyMoney(sessionCount, sessionUnitPrice));
    }
  }, [paymentType, targetMonth, targetYear, monthRemaining, monthTotalRequired, sessionCount, sessionUnitPrice]);

  // Calculations for custom amount mode
  const coveredSessionsFromCustom = sessionUnitPrice > 0 ? calculateCoveredSessions(customAmountInput, sessionUnitPrice) : 0;
  const remainderFromCustom = sessionUnitPrice > 0 ? calculateMoneyRemainder(customAmountInput, sessionUnitPrice) : 0;
  const potentialNewFinancialCredit = roundMoney((activeEnrollment?.financialCredit || 0) + remainderFromCustom, 2);
  const potentialAutoConvertedSessions =
    sessionUnitPrice > 0 ? calculateCoveredSessions(potentialNewFinancialCredit, sessionUnitPrice) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !activeEnrollment || customAmountInput <= 0) return;

    let finalSessionsPurchased = 0;
    if (paymentType === 'single_session') finalSessionsPurchased = 1;
    if (paymentType === 'session_count') finalSessionsPurchased = sessionCount;

    db.recordPayment({
      studentId,
      enrollmentId: activeEnrollment.id,
      groupId: activeEnrollment.groupId,
      amount: Number(customAmountInput),
      paymentType,
      targetMonth: paymentType === 'specific_month' ? targetMonth : undefined,
      targetYear: paymentType === 'specific_month' ? targetYear : undefined,
      sessionsPurchased: finalSessionsPurchased,
      paymentMethod,
      date,
      month: parseLocalDateStr(date).getMonth() + 1,
      year: parseLocalDateStr(date).getFullYear(),
      notes: notes.trim(),
      referenceNumber: referenceNumber.trim(),
    });

    onPaymentSaved();
    onClose();
  };

  const selectedStudent = allStudents.find((s) => s.id === studentId) || targetStudent;
  const modalLayer = useModalLayer('add-payment', isOpen, onClose);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#293828]/65 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#DDD3C7]/15 border border-[#DDD3C7] rounded-t-[28px] sm:rounded-[28px] max-w-lg w-full mx-auto max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Signature Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#293828] via-[#0F1206] to-[#756046] text-[#F8F2EC] flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#F8F2EC]/15 backdrop-blur-md border border-[#DDD3C7]/25 text-[#F8F2EC] flex items-center justify-center shrink-0 shadow-sm">
              <DollarSign className="w-5 h-5 text-[#F8F2EC]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-[#F8F2EC] tracking-tight truncate">
                تسجيل دفعة مالية
              </h2>
              <p className="text-xs text-[#DDD3C7]/85 font-medium truncate">
                {selectedStudent ? `للطالب: ${selectedStudent.name}` : 'سداد الاشتراكات وتجديد رصيد الحصص'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-[#F8F2EC]/10 hover:bg-[#F8F2EC]/20 text-[#F8F2EC] border border-[#DDD3C7]/20 transition-all cursor-pointer relative z-10 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="add-payment-form" onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto overscroll-contain android-scrollbar flex-1 space-y-4 text-xs text-[#0F1206]">
          
          {/* 1. Student Picker (if not fixed) */}
          {!targetStudent && (
            <div className="classy-card p-3.5 space-y-2">
              <label className="font-black text-xs text-[#0F1206] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#293828]" />
                <span>اختر الطالب المستهدف:</span>
              </label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full classy-select"
              >
                {allStudents.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.gradeLevel || 'غير محدد'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 2. Enrollment / Group Picker */}
          {studentEnrollments.length > 0 ? (
            <div className="classy-card p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="font-black text-xs text-[#0F1206] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#293828]" />
                  <span>الاشتراك المستهدف للسداد:</span>
                </label>
                <span className="text-[10px] text-[#756046] font-bold">ذمة مالية مستقلة</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {studentEnrollments.map((enr) => {
                  const grp = db.getGroupById(enr.groupId);
                  const isSelected = enr.id === selectedEnrollmentId;
                  return (
                    <button
                      key={enr.id}
                      type="button"
                      onClick={() => setSelectedEnrollmentId(enr.id)}
                      className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-[#DDD3C7]/40 border-[#293828] ring-2 ring-[#293828]/20 shadow-sm'
                          : 'bg-[#DDD3C7]/15 border-[#DDD3C7] hover:bg-[#F8F2EC]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-[#0F1206] text-xs truncate">{grp?.name || 'مجموعة'}</span>
                        <span
                          className="text-[10px] font-black px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${grp?.accentColor || '#293828'}18`,
                            color: grp?.accentColor || '#293828',
                          }}
                        >
                          {enr.serviceType === 'private' ? 'درس خاص' : 'مجموعة'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#DDD3C7] text-[11px]">
                        <span className="text-[#756046] font-medium">
                          {getBillingModeLabel(enr.billingType, enr.billingMode)}:
                          <strong className="text-[#0F1206] font-bold mr-1">{enr.customPrice} ج</strong>
                        </span>
                        <span className="text-[#293828] font-black">
                          رصيد: {enr.sessionCredit || 0} حصص
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#DDD3C7]/15 text-[#0F1206] rounded-2xl border border-[#DDD3C7] flex items-center gap-2 font-bold text-xs">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>هذا الطالب غير مسجل في أي مجموعة حالياً. يرجى إضافته لمجموعة أولاً.</span>
            </div>
          )}

          {/* 3. Payment Target Type Selector (4 Types) */}
          <div className="classy-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-black text-xs text-[#0F1206] flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-[#293828]" />
                <span>نوع السداد:</span>
              </label>
              <span className="text-[11px] text-[#293828] font-black bg-[#DDD3C7]/25 px-2 py-0.5 rounded-lg">
                سعر الحصة: {sessionUnitPrice} ج.م
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#DDD3C7]/15 border border-[#DDD3C7] rounded-2xl">
              <button
                type="button"
                onClick={() => setPaymentType('specific_month')}
                className={`py-2 px-1 rounded-xl text-center font-black transition-all text-xs cursor-pointer ${
                  paymentType === 'specific_month'
                    ? 'bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] shadow-xs'
                    : 'text-[#756046] hover:bg-[#DDD3C7]/35'
                }`}
              >
                شهر معين
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('single_session')}
                className={`py-2 px-1 rounded-xl text-center font-black transition-all text-xs cursor-pointer ${
                  paymentType === 'single_session'
                    ? 'bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] shadow-xs'
                    : 'text-[#756046] hover:bg-[#DDD3C7]/35'
                }`}
              >
                حصة واحدة
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('session_count')}
                className={`py-2 px-1 rounded-xl text-center font-black transition-all text-xs cursor-pointer ${
                  paymentType === 'session_count'
                    ? 'bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] shadow-xs'
                    : 'text-[#756046] hover:bg-[#DDD3C7]/35'
                }`}
              >
                عدد حصص
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('custom_amount')}
                className={`py-2 px-1 rounded-xl text-center font-black transition-all text-xs cursor-pointer ${
                  paymentType === 'custom_amount'
                    ? 'bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] shadow-xs'
                    : 'text-[#756046] hover:bg-[#DDD3C7]/35'
                }`}
              >
                مبلغ مالي
              </button>
            </div>
          </div>

          {/* --- DETAILS FOR TYPE 1: SPECIFIC MONTH --- */}
          {paymentType === 'specific_month' && (
            <div className="classy-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-[#0F1206] text-xs">حدد الشهر والسنة المستهدفة:</span>
                <div className="flex items-center gap-2">
                  <select
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(Number(e.target.value))}
                    className="classy-select py-1.5 px-2.5 font-bold text-xs"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {getArabicMonthName(m)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={targetYear}
                    onChange={(e) => setTargetYear(Number(e.target.value))}
                    className="classy-select py-1.5 px-2.5 font-bold text-xs"
                  >
                    {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Month Financial Status Card */}
              <div className="p-3 bg-[#DDD3C7]/15 rounded-2xl border border-[#DDD3C7] grid grid-cols-3 gap-2 text-center text-[11px]">
                <div>
                  <p className="text-[#756046] font-bold">قيمة الشهر</p>
                  <p className="font-black text-xs sm:text-sm text-[#0F1206] mt-0.5">{monthTotalRequired} ج</p>
                </div>
                <div>
                  <p className="text-[#756046] font-bold">المدفوع سابقاً</p>
                  <p className="font-black text-xs sm:text-sm text-[#293828] mt-0.5">{monthPaidSoFar} ج</p>
                </div>
                <div>
                  <p className="text-[#756046] font-bold">المتبقي</p>
                  <p className={`font-black text-xs sm:text-sm mt-0.5 ${monthRemaining > 0 ? 'text-[#0F1206]' : 'text-[#293828]'}`}>
                    {monthRemaining} ج
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-[#293828] font-medium flex items-center gap-1.5 bg-[#DDD3C7]/40 p-2.5 rounded-xl border border-[#DDD3C7]">
                <Info className="w-4 h-4 text-[#293828] shrink-0" />
                <span>يدعم النظام الدفع على دفعات؛ يمكنك سداد جزء من المبلغ الآن وإكمال الباقي لاحقاً.</span>
              </div>
            </div>
          )}

          {/* --- DETAILS FOR TYPE 2: SINGLE SESSION --- */}
          {paymentType === 'single_session' && (
            <div className="classy-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-[#0F1206] text-xs">سداد حصة واحدة:</span>
                <span className="font-black text-sm text-[#293828]">{sessionUnitPrice} ج.م</span>
              </div>
              <p className="text-[11px] text-[#756046] font-medium">
                سيتم إضافة <strong>+١ حصة</strong> فوراً إلى رصيد حصص الطالب.
              </p>
            </div>
          )}

          {/* --- DETAILS FOR TYPE 3: SESSION COUNT --- */}
          {paymentType === 'session_count' && (
            <div className="classy-card p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="font-black text-[#0F1206] text-xs">عدد الحصص المطلوبة:</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[4, 8, 10, 12, 16].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setSessionCount(cnt)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        sessionCount === cnt
                          ? 'bg-[#293828] text-[#F8F2EC] border-[#293828] shadow-xs'
                          : 'bg-[#DDD3C7]/15 text-[#756046] border-[#DDD3C7] hover:bg-[#DDD3C7]/35'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      value={sessionCount}
                      onChange={(e) => setSessionCount(Math.max(1, Number(e.target.value)))}
                      className="w-14 p-1 text-center font-black bg-[#DDD3C7]/15 border border-[#DDD3C7] rounded-xl text-xs text-[#0F1206] focus:outline-none focus:border-[#293828]"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#DDD3C7]/15 rounded-2xl border border-[#DDD3C7] flex items-center justify-between">
                <span className="text-[11px] text-[#756046] font-bold">
                  {sessionCount} حصص × {sessionUnitPrice} ج.م =
                </span>
                <span className="font-black text-sm sm:text-base text-[#0F1206]">
                  {multiplyMoney(sessionCount, sessionUnitPrice)} ج.م
                </span>
              </div>

              <p className="text-[11px] text-[#0F1206] font-medium flex items-center gap-1.5 bg-[#DDD3C7]/30 p-2 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-[#293828] shrink-0" />
                <span>
                  {activeEnrollment?.billingMode === 'postpaid' || activeEnrollment?.billingType === 'postpaid'
                    ? `سيتم تسوية الحصص المستحقة أولاً، والمبلغ الفائض يُضاف كرصيد حصص.`
                    : `سيتم إضافة ${sessionCount} حصص إلى رصيد الطالب في هذا الاشتراك.`}
                </span>
              </p>
            </div>
          )}

          {/* --- DETAILS FOR TYPE 4: CUSTOM AMOUNT --- */}
          {paymentType === 'custom_amount' && (
            <div className="classy-card p-4 space-y-3">
              <label className="font-black text-[#0F1206] text-xs block">أدخل المبلغ المدفوع:</label>
              
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.5"
                  value={customAmountInput || ''}
                  onChange={(e) => setCustomAmountInput(Math.max(0, Number(e.target.value)))}
                  placeholder="مثال: 500 أو 250"
                  className="classy-input text-base font-black py-3 pr-4 pl-10"
                />
                <span className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-3.5 font-bold text-xs text-[#756046]`}>ج.م</span>
              </div>

              {/* Dynamic breakdown preview */}
              <div className="p-3 bg-[#DDD3C7]/15 rounded-2xl border border-[#DDD3C7] space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#756046] font-bold">عدد الحصص التي يغطيها المبلغ:</span>
                  <strong className="text-xs sm:text-sm text-[#293828] font-black">
                    +{coveredSessionsFromCustom} حصص
                  </strong>
                </div>

                <div className="flex items-center justify-between border-t border-[#DDD3C7] pt-1.5">
                  <span className="text-[#756046] font-bold">الرصيد المالي المتبقي (Financial Credit):</span>
                  <strong className="text-xs text-[#0F1206] font-black">
                    {remainderFromCustom} ج.م
                  </strong>
                </div>

                {potentialAutoConvertedSessions > 0 && (
                  <div className="bg-[#DDD3C7]/50 p-2 rounded-xl text-[#0F1206] font-bold flex items-center gap-1.5 border border-[#DDD3C7]">
                    <Sparkles className="w-4 h-4 text-[#293828] shrink-0" />
                    <span>
                      تراكم الرصيد المالي سيتحول تلقائياً إلى +{potentialAutoConvertedSessions} حصة إضافية!
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Amount Confirmation Field */}
          <div className="classy-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-black text-xs text-[#0F1206]">المبلغ الإجمالي للدفع:</label>
              <span className="text-sm sm:text-base font-black text-[#293828]">
                {customAmountInput} ج.م
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                required
                min="0.5"
                value={customAmountInput || ''}
                onChange={(e) => setCustomAmountInput(Math.max(0, Number(e.target.value)))}
                className="classy-input font-black text-sm py-2.5 pr-4 pl-10"
              />
              <span className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-2.5 font-bold text-xs text-[#756046]`}>ج.م</span>
            </div>
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="classy-card p-3 space-y-1.5">
              <label className="font-black text-xs text-[#0F1206] flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#293828]" />
                <span>طريقة الدفع:</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="classy-select"
              >
                <option value="cash">نقداً (كاش)</option>
                <option value="vodafone_cash">فودافون كاش / محفظة</option>
                <option value="instapay">إنستاباي (InstaPay)</option>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="other">أخرى</option>
              </select>
            </div>

            <div className="classy-card p-3 space-y-1.5">
              <label className="font-black text-xs text-[#0F1206] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#293828]" />
                <span>تاريخ السداد:</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="classy-input font-bold"
              />
            </div>
          </div>

          {/* Notes & Reference */}
          <div className="classy-card p-3 space-y-1.5">
            <label className="font-black text-xs text-[#0F1206] flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-[#293828]" />
              <span>ملاحظات أو رقم الإيصال / المعاملة:</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: دفعة من اشتراك الشهر، أو رقم عملية التحويل..."
              className="classy-input"
            />
          </div>

          {/* Summary Indicator */}
          <div className="p-3 rounded-2xl bg-[#DDD3C7]/40 border border-[#DDD3C7] flex items-center justify-between text-xs">
            <span className="text-[#756046] font-bold">الرصيد المالي الحالي للاشتراك:</span>
            <span className="font-black text-[#0F1206]">
              {(activeEnrollment?.financialCredit || 0)} ج.م (Financial Credit)
            </span>
          </div>

        </form>

        {/* Pinned Action Footer */}
        <div className="p-4 bg-[#F8F2EC] border-t border-[#DDD3C7] flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            form="add-payment-form"
            disabled={!studentId || !activeEnrollment || customAmountInput <= 0}
            className="btn-primary flex-1"
          >
            <Check className="w-4 h-4" />
            <span>تأكيد تسجيل الدفعة</span>
          </button>
        </div>

      </div>
    </div>
    </ModalPortal>
  );
};
