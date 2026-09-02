import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Student, Payment, PaymentMethod, PaymentTargetType, Enrollment } from '../types';
import { db, getArabicMonthName, getBillingModeLabel, getEffectiveSessionPrice } from '../utils/storage';

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
  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];
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

  // Enrollments for selected student
  const studentEnrollments = db.getStudentEnrollments(studentId);

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
  }, [studentId, studentEnrollments.length]);

  const activeEnrollment = studentEnrollments.find((e) => e.id === selectedEnrollmentId) || studentEnrollments[0];
  const activeGroup = activeEnrollment ? db.getGroupById(activeEnrollment.groupId) : undefined;
  const enrollmentSummary = activeEnrollment ? db.calculateEnrollmentFinancials(activeEnrollment.id) : undefined;

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
      setCustomAmountInput(sessionCount * sessionUnitPrice);
    }
  }, [paymentType, targetMonth, targetYear, monthRemaining, monthTotalRequired, sessionCount, sessionUnitPrice]);

  // Calculations for custom amount mode
  const coveredSessionsFromCustom = sessionUnitPrice > 0 ? Math.floor(customAmountInput / sessionUnitPrice) : 0;
  const remainderFromCustom = sessionUnitPrice > 0 ? customAmountInput % sessionUnitPrice : 0;
  const potentialNewFinancialCredit = (activeEnrollment?.financialCredit || 0) + remainderFromCustom;
  const potentialAutoConvertedSessions =
    sessionUnitPrice > 0 ? Math.floor(potentialNewFinancialCredit / sessionUnitPrice) : 0;

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
      month: new Date(date).getMonth() + 1,
      year: new Date(date).getFullYear(),
      notes: notes.trim(),
      referenceNumber: referenceNumber.trim(),
    });

    onPaymentSaved();
    onClose();
  };

  const selectedStudent = allStudents.find((s) => s.id === studentId) || targetStudent;

  return (
    <div className="fixed inset-0 z-50 bg-[#2D332A]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-t-3xl sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-[#E8E2D6] bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#748C70] text-white shadow-sm">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2D332A]">
                تسجيل دفعة مالية جديدة
              </h2>
              <p className="text-[11px] text-[#8A9187] font-medium">
                سداد الاشتراكات الشهرية أو شراء باقات ورصيد الحصص
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-[#F2ECE1] text-[#6B7567] hover:text-[#2D332A] hover:bg-[#EAE5D8] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-4 text-xs text-[#434B3E]">
          
          {/* 1. Student Picker (if not fixed) */}
          {!targetStudent && (
            <div className="space-y-1.5">
              <label className="font-bold text-[#2D332A] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#748C70]" />
                <span>اختر الطالب:</span>
              </label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full p-2.5 rounded-2xl bg-white border border-[#E8E2D6] text-xs font-bold text-[#2D332A] focus:outline-none focus:border-[#748C70]"
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
            <div className="space-y-1.5">
              <label className="font-bold text-[#2D332A] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#748C70]" />
                  <span>المجموعة أو الدرس المراد السداد له:</span>
                </span>
                <span className="text-[10px] text-[#8A9187]">حساب مالي مستقل لكل اشتراك</span>
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {studentEnrollments.map((enr) => {
                  const grp = db.getGroupById(enr.groupId);
                  const isSelected = enr.id === selectedEnrollmentId;
                  return (
                    <button
                      key={enr.id}
                      type="button"
                      onClick={() => setSelectedEnrollmentId(enr.id)}
                      className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-white border-[#748C70] shadow-md ring-2 ring-[#748C70]/20'
                          : 'bg-white/60 border-[#E8E2D6] hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#2D332A] text-xs">{grp?.name || 'مجموعة'}</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${grp?.accentColor || '#748C70'}15`,
                            color: grp?.accentColor || '#748C70',
                          }}
                        >
                          {enr.serviceType === 'private' ? 'درس خاص' : 'مجموعة'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#E8E2D6]/60 text-[11px]">
                        <span className="text-[#8A9187]">
                          {getBillingModeLabel(enr.billingType, enr.billingMode)}:
                          <strong className="text-[#2D332A] mr-1">{enr.customPrice} ج</strong>
                        </span>
                        <span className="text-[#748C70] font-bold">
                          رصيد: {enr.sessionCredit || 0} حصص
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#C97C5D]/10 text-[#C97C5D] rounded-2xl border border-[#C97C5D]/30 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>هذا الطالب غير مسجل في أي مجموعة حالياً. يرجى إضافته لمجموعة أولاً.</span>
            </div>
          )}

          {/* 3. Payment Target Type Selector (4 Types) */}
          <div className="space-y-1.5 pt-1">
            <label className="font-bold text-[#2D332A] flex items-center justify-between">
              <span>نوع السداد:</span>
              <span className="text-[10px] text-[#748C70] font-bold">
                سعر الحصة التقديري: {sessionUnitPrice} ج.م
              </span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setPaymentType('specific_month')}
                className={`py-2 px-1.5 rounded-xl text-center border font-bold transition-all text-[11px] ${
                  paymentType === 'specific_month'
                    ? 'bg-[#748C70] text-white border-[#748C70] shadow-sm'
                    : 'bg-white text-[#6B7567] border-[#E8E2D6] hover:bg-[#F2ECE1]'
                }`}
              >
                ١. شهر معين
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('single_session')}
                className={`py-2 px-1.5 rounded-xl text-center border font-bold transition-all text-[11px] ${
                  paymentType === 'single_session'
                    ? 'bg-[#748C70] text-white border-[#748C70] shadow-sm'
                    : 'bg-white text-[#6B7567] border-[#E8E2D6] hover:bg-[#F2ECE1]'
                }`}
              >
                ٢. حصة واحدة
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('session_count')}
                className={`py-2 px-1.5 rounded-xl text-center border font-bold transition-all text-[11px] ${
                  paymentType === 'session_count'
                    ? 'bg-[#748C70] text-white border-[#748C70] shadow-sm'
                    : 'bg-white text-[#6B7567] border-[#E8E2D6] hover:bg-[#F2ECE1]'
                }`}
              >
                ٣. عدد حصص
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('custom_amount')}
                className={`py-2 px-1.5 rounded-xl text-center border font-bold transition-all text-[11px] ${
                  paymentType === 'custom_amount'
                    ? 'bg-[#748C70] text-white border-[#748C70] shadow-sm'
                    : 'bg-white text-[#6B7567] border-[#E8E2D6] hover:bg-[#F2ECE1]'
                }`}
              >
                ٤. مبلغ مالي
              </button>
            </div>
          </div>

          {/* --- DETAILS FOR TYPE 1: SPECIFIC MONTH --- */}
          {paymentType === 'specific_month' && (
            <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#2D332A]">حدد الشهر والسنة:</span>
                <div className="flex items-center gap-2">
                  <select
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(Number(e.target.value))}
                    className="p-1.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6] font-bold text-xs"
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
                    className="p-1.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6] font-bold text-xs"
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
              <div className="p-3 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6] grid grid-cols-3 gap-2 text-center text-[11px]">
                <div>
                  <p className="text-[#8A9187]">قيمة الشهر</p>
                  <p className="font-bold text-sm text-[#2D332A] mt-0.5">{monthTotalRequired} ج</p>
                </div>
                <div>
                  <p className="text-[#8A9187]">المدفوع سابقاً</p>
                  <p className="font-bold text-sm text-[#748C70] mt-0.5">{monthPaidSoFar} ج</p>
                </div>
                <div>
                  <p className="text-[#8A9187]">المتبقي</p>
                  <p className={`font-bold text-sm mt-0.5 ${monthRemaining > 0 ? 'text-[#C97C5D]' : 'text-[#748C70]'}`}>
                    {monthRemaining} ج
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-[#6B7567] flex items-center gap-1.5 bg-[#748C70]/10 p-2 rounded-xl border border-[#748C70]/20">
                <Info className="w-4 h-4 text-[#748C70] shrink-0" />
                <span>يدعم النظام الدفع على دفعات؛ يمكنك سداد جزء من المبلغ الآن وإكمال الباقي لاحقاً.</span>
              </div>
            </div>
          )}

          {/* --- DETAILS FOR TYPE 2: SINGLE SESSION --- */}
          {paymentType === 'single_session' && (
            <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#2D332A]">سداد حصة واحدة:</span>
                <span className="font-bold text-sm text-[#748C70]">{sessionUnitPrice} ج.م</span>
              </div>
              <p className="text-[11px] text-[#6B7567]">
                سيتم خصم المبلغ وإضافة <strong>+١ حصة</strong> فوراً إلى رصيد حصص الطالب.
              </p>
            </div>
          )}

          {/* --- DETAILS FOR TYPE 3: SESSION COUNT --- */}
          {paymentType === 'session_count' && (
            <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="font-bold text-[#2D332A] text-xs">عدد الحصص المطلوبة:</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[5, 8, 10, 15, 20].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setSessionCount(cnt)}
                      className={`px-2 py-1 rounded-xl text-xs font-bold border transition-all ${
                        sessionCount === cnt
                          ? 'bg-[#748C70] text-white border-[#748C70] shadow-xs'
                          : 'bg-[#F9F7F2] text-[#434B3E] border-[#E8E2D6] hover:bg-[#F2ECE1]'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#8A9187]">مخصص:</span>
                    <input
                      type="number"
                      min="1"
                      value={sessionCount}
                      onChange={(e) => setSessionCount(Math.max(1, Number(e.target.value)))}
                      className="w-14 p-1 text-center font-bold bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6] flex items-center justify-between">
                <span className="text-[11px] text-[#6B7567]">
                  {sessionCount} حصص × {sessionUnitPrice} ج.م =
                </span>
                <span className="font-bold text-base text-[#2D332A]">
                  {sessionCount * sessionUnitPrice} ج.م
                </span>
              </div>

              <p className="text-[11px] text-[#748C70] font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {activeEnrollment?.billingMode === 'postpaid' || activeEnrollment?.billingType === 'postpaid'
                    ? `سيتم تسوية الحصص المستحقة أولاً، والمبلغ الفائض يُضاف كرصيد حصص (Session Credit).`
                    : `سيتم إضافة ${sessionCount} حصص إلى رصيد الطالب في هذا الاشتراك.`}
                </span>
              </p>
            </div>
          )}

          {/* --- DETAILS FOR TYPE 4: CUSTOM AMOUNT --- */}
          {paymentType === 'custom_amount' && (
            <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-3 shadow-sm">
              <label className="font-bold text-[#2D332A] block">أدخل المبلغ المدفوع:</label>
              
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  value={customAmountInput || ''}
                  onChange={(e) => setCustomAmountInput(Math.max(0, Number(e.target.value)))}
                  placeholder="مثال: 500 أو 250"
                  className="w-full p-3 rounded-2xl bg-[#F9F7F2] border border-[#E8E2D6] text-base font-bold text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
                <span className="absolute left-3 top-3.5 font-bold text-xs text-[#8A9187]">ج.م</span>
              </div>

              {/* Dynamic breakdown preview */}
              <div className="p-3 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6] space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7567]">عدد الحصص التي يغطيها المبلغ:</span>
                  <strong className="text-sm text-[#748C70] font-bold">
                    +{coveredSessionsFromCustom} حصص
                  </strong>
                </div>

                <div className="flex items-center justify-between border-t border-[#E8E2D6]/60 pt-1.5">
                  <span className="text-[#6B7567]">الرصيد المالي المتبقي (Financial Credit):</span>
                  <strong className="text-xs text-[#C97C5D] font-bold">
                    {remainderFromCustom} ج.م
                  </strong>
                </div>

                {potentialAutoConvertedSessions > 0 && (
                  <div className="bg-[#748C70]/10 p-2 rounded-lg text-[#748C70] font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>
                      تراكم الرصيد المالي السابق سيتحول تلقائياً إلى +{potentialAutoConvertedSessions} حصة إضافية!
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Amount Confirmation Field */}
          <div className="space-y-1.5">
            <label className="font-bold text-[#2D332A] flex items-center justify-between">
              <span>المبلغ الإجمالي للتسديد:</span>
              <span className="text-sm font-black text-[#748C70]">
                {customAmountInput} ج.م
              </span>
            </label>
            <div className="relative">
              <input
                type="number"
                required
                min="1"
                value={customAmountInput || ''}
                onChange={(e) => setCustomAmountInput(Math.max(0, Number(e.target.value)))}
                className="w-full p-2.5 rounded-2xl bg-white border border-[#E8E2D6] font-bold text-sm text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              />
              <span className="absolute left-3 top-2.5 font-bold text-xs text-[#8A9187]">ج.م</span>
            </div>
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-[#2D332A]">طريقة الدفع:</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full p-2.5 rounded-2xl bg-white border border-[#E8E2D6] text-xs font-bold text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              >
                <option value="cash">نقداً (كاش)</option>
                <option value="vodafone_cash">فودافون كاش</option>
                <option value="instapay">إنستاباي (InstaPay)</option>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="other">أخرى</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-[#2D332A]">تاريخ السداد:</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 rounded-2xl bg-white border border-[#E8E2D6] text-xs font-bold text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              />
            </div>
          </div>

          {/* Notes & Reference */}
          <div className="space-y-1.5">
            <label className="font-bold text-[#2D332A]">ملاحظات أو رقم الإيصال / المعاملة:</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: دفعة أولى من اشتراك شهر أغسطس، أو رقم عملية إنستاباي..."
              className="w-full p-2.5 rounded-2xl bg-white border border-[#E8E2D6] text-xs text-[#2D332A] placeholder-[#8A9187]/60 focus:outline-none focus:border-[#748C70]"
            />
          </div>

          {/* Summary Footer */}
          <div className="p-3 rounded-2xl bg-[#E8E2D6]/40 border border-[#E8E2D6] flex items-center justify-between text-xs">
            <span className="text-[#6B7567]">الرصيد المالي الحالي للاشتراك:</span>
            <span className="font-bold text-[#748C70]">
              {(activeEnrollment?.financialCredit || 0)} ج.م (محفوظ كـ Financial Credit)
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-[#E8E2D6] bg-white text-[#6B7567] font-bold text-xs hover:bg-[#F2ECE1] transition-all"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!studentId || !activeEnrollment || customAmountInput <= 0}
              className="flex-1 py-3 rounded-2xl bg-[#748C70] hover:bg-[#60755C] disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>تأكيد تسجيل الدفعة</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
