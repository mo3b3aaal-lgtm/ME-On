import React, { useState, useEffect, useMemo } from 'react';
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
import { useTranslation } from '../utils/i18n';
import { toLocalISODate, parseLocalDateStr } from '../utils/localDate';
import { SegmentedControl } from './ui/SegmentedControl';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon } from './ui/AppIcon';

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

  if (!isOpen) return null;

  return (
    <BottomSheet
      id="add-payment-sheet"
      isOpen={isOpen}
      onClose={onClose}
      title="تسجيل دفعة مالية"
      subtitle={selectedStudent ? `للطالب: ${selectedStudent.name}` : 'سداد الاشتراكات وتجديد رصيد الحصص'}
      headerLeading={
        <div className="w-10 h-10 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line">
          <AppIcon name="wallet" size={20} weight="fill" />
        </div>
      }
      footer={
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-soft flex-1"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            form="add-payment-form"
            disabled={!studentId || !activeEnrollment || customAmountInput <= 0}
            className="btn-orange flex-1"
          >
            <AppIcon name="check" size={16} weight="bold" />
            <span>تأكيد تسجيل الدفعة</span>
          </button>
        </div>
      }
    >
      {/* Scrollable Form Body */}
      <form id="add-payment-form" onSubmit={handleSubmit} className="space-y-4 text-xs text-navy">
          
          {/* 1. Student Picker (if not fixed) */}
          {!targetStudent && (
            <div className="classy-card p-3.5 space-y-2">
              <label className="font-bold text-xs text-navy flex items-center gap-2">
                <AppIcon name="students" size={16} className="text-navy" />
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
                <label className="font-bold text-xs text-navy flex items-center gap-2">
                  <AppIcon name="layers" size={16} className="text-navy" />
                  <span>الاشتراك المستهدف للسداد:</span>
                </label>
                <span className="text-[10px] text-slate font-bold">ذمة مالية مستقلة</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {studentEnrollments.map((enr) => {
                  const grp = enr.groupId ? db.getGroupById(enr.groupId) : undefined;
                  const isSelected = enr.id === selectedEnrollmentId;
                  const displayName = enr.serviceType === 'private'
                    ? (enr.subject ? (enr.subject.startsWith('درس خاص') ? enr.subject : `درس خاص - ${enr.subject}`) : 'درس خاص')
                    : (grp?.name || 'مجموعة');
                  const cardAccent = grp?.accentColor || (enr.serviceType === 'private' ? '#0F2A4A' : '#17375E');
                  return (
                    <button
                      key={enr.id}
                      type="button"
                      onClick={() => setSelectedEnrollmentId(enr.id)}
                      className={`p-3 rounded-2xl border text-start transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-mint-soft border-navy ring-2 ring-navy/20 shadow-sm'
                          : 'bg-page border-line hover:bg-mist'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-navy text-xs truncate">{displayName}</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${cardAccent}18`,
                            color: cardAccent,
                          }}
                        >
                          {enr.serviceType === 'private' ? 'درس خاص' : 'مجموعة'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-line text-[11px]">
                        <span className="text-slate font-medium">
                          {getBillingModeLabel(enr.billingType, enr.billingMode)}:
                          <strong className="text-navy font-bold mr-1">{enr.customPrice} ج</strong>
                        </span>
                        <span className="text-navy font-bold">
                          رصيد: {enr.sessionCredit || 0} حصص
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-coral/10 text-coral rounded-2xl border border-coral/20 flex items-center gap-2 font-bold text-xs">
              <AppIcon name="warning" size={18} className="shrink-0" />
              <span>هذا الطالب غير مسجل في أي مجموعة حالياً. يرجى إضافته لمجموعة أولاً.</span>
            </div>
          )}

          {/* 3. Payment Target Type Selector (4 Types) */}
          <div className="classy-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs text-navy flex items-center gap-1.5">
                <AppIcon name="coins" size={16} className="text-navy" />
                <span>نوع السداد:</span>
              </label>
              <span className="text-[11px] text-navy font-bold bg-mint-soft px-2 py-0.5 rounded-lg">
                سعر الحصة: {sessionUnitPrice} ج.م
              </span>
            </div>

            <SegmentedControl<PaymentTargetType>
              value={paymentType}
              onChange={(val) => setPaymentType(val)}
              options={[
                { value: 'specific_month', label: 'شهر معين' },
                { value: 'single_session', label: 'حصة واحدة' },
                { value: 'session_count', label: 'عدد حصص' },
                { value: 'custom_amount', label: 'مبلغ مالي' },
              ]}
            />
          </div>

          {/* --- DETAILS FOR TYPE 1: SPECIFIC MONTH --- */}
          {paymentType === 'specific_month' && (
            <div className="classy-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-[#0F2A4A] text-xs">حدد الشهر والسنة المستهدفة:</span>
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
              <div className="p-3 bg-[#E1EBEC]/15 rounded-2xl border border-[#E1EBEC] grid grid-cols-3 gap-2 text-center text-[11px]">
                <div>
                  <p className="text-[#5F7083] font-bold">قيمة الشهر</p>
                  <p className="font-black text-xs sm:text-sm text-[#0F2A4A] mt-0.5">{monthTotalRequired} ج</p>
                </div>
                <div>
                  <p className="text-[#5F7083] font-bold">المدفوع سابقاً</p>
                  <p className="font-black text-xs sm:text-sm text-[#17375E] mt-0.5">{monthPaidSoFar} ج</p>
                </div>
                <div>
                  <p className="text-[#5F7083] font-bold">المتبقي</p>
                  <p className={`font-black text-xs sm:text-sm mt-0.5 ${monthRemaining > 0 ? 'text-[#0F2A4A]' : 'text-[#17375E]'}`}>
                    {monthRemaining} ج
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-navy font-medium flex items-center gap-1.5 bg-mint-soft p-2.5 rounded-xl border border-line">
                <AppIcon name="info" size={16} className="text-navy shrink-0" />
                <span>يدعم النظام الدفع على دفعات؛ يمكنك سداد جزء من المبلغ الآن وإكمال الباقي لاحقاً.</span>
              </div>
            </div>
          )}

          {/* --- DETAILS FOR TYPE 2: SINGLE SESSION --- */}
          {paymentType === 'single_session' && (
            <div className="classy-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-navy text-xs">سداد حصة واحدة:</span>
                <span className="font-bold text-sm text-navy">{sessionUnitPrice} ج.م</span>
              </div>
              <p className="text-[11px] text-slate font-medium">
                سيتم إضافة <strong>+١ حصة</strong> فوراً إلى رصيد حصص الطالب.
              </p>
            </div>
          )}

          {/* --- DETAILS FOR TYPE 3: SESSION COUNT --- */}
          {paymentType === 'session_count' && (
            <div className="classy-card p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="font-bold text-navy text-xs">عدد الحصص المطلوبة:</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[4, 8, 10, 12, 16].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setSessionCount(cnt)}
                      className={`chip !px-3 ${
                        sessionCount === cnt ? 'chip-active' : ''
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
                      className="w-14 p-1 text-center font-bold bg-page border border-line rounded-xl text-xs text-navy focus:outline-none focus:border-navy"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-mist rounded-2xl border border-line flex items-center justify-between">
                <span className="text-[11px] text-slate font-bold">
                  {sessionCount} حصص × {sessionUnitPrice} ج.م =
                </span>
                <span className="font-bold text-sm sm:text-base text-navy">
                  {multiplyMoney(sessionCount, sessionUnitPrice)} ج.م
                </span>
              </div>

              <p className="text-[11px] text-navy font-medium flex items-center gap-1.5 bg-mint-soft p-2 rounded-xl">
                <AppIcon name="checkCircle" size={16} className="text-teal shrink-0" />
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
              <label className="font-bold text-navy text-xs block">أدخل المبلغ المدفوع:</label>
              
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.5"
                  value={customAmountInput || ''}
                  onChange={(e) => setCustomAmountInput(Math.max(0, Number(e.target.value)))}
                  placeholder="مثال: 500 أو 250"
                  className="classy-input text-base font-bold py-3 pr-4 pl-10"
                />
                <span className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-3.5 font-bold text-xs text-slate`}>ج.م</span>
              </div>

              {/* Dynamic breakdown preview */}
              <div className="p-3 bg-mist rounded-2xl border border-line space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate font-bold">عدد الحصص التي يغطيها المبلغ:</span>
                  <strong className="text-xs sm:text-sm text-navy font-bold">
                    +{coveredSessionsFromCustom} حصص
                  </strong>
                </div>

                <div className="flex items-center justify-between border-t border-line pt-1.5">
                  <span className="text-slate font-bold">الرصيد المالي المتبقي (Financial Credit):</span>
                  <strong className="text-xs text-teal font-bold">
                    {remainderFromCustom} ج.م
                  </strong>
                </div>

                {potentialAutoConvertedSessions > 0 && (
                  <div className="bg-mint-soft p-2 rounded-xl text-navy font-bold flex items-center gap-1.5 border border-line">
                    <AppIcon name="sparkles" size={16} className="text-orange shrink-0" />
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
              <label className="font-bold text-xs text-navy">المبلغ الإجمالي للدفع:</label>
              <span className="text-sm sm:text-base font-bold text-navy">
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
                className="classy-input font-bold text-sm py-2.5 pr-4 pl-10"
              />
              <span className={`absolute ${isRTL ? 'left-4' : 'right-4'} top-2.5 font-bold text-xs text-slate`}>ج.م</span>
            </div>
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="classy-card p-3 space-y-1.5">
              <label className="font-bold text-xs text-navy flex items-center gap-1.5">
                <AppIcon name="creditCard" size={16} className="text-navy" />
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
              <label className="font-bold text-xs text-navy flex items-center gap-1.5">
                <AppIcon name="calendar" size={16} className="text-navy" />
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
            <label className="font-bold text-xs text-navy flex items-center gap-1.5">
              <AppIcon name="receipt" size={16} className="text-navy" />
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
          <div className="p-3 rounded-2xl bg-mist border border-line flex items-center justify-between text-xs">
            <span className="text-slate font-bold">الرصيد المالي الحالي للاشتراك:</span>
            <span className="font-bold text-navy">
              {(activeEnrollment?.financialCredit || 0)} ج.م (Financial Credit)
            </span>
          </div>
        </form>
    </BottomSheet>
  );
};
