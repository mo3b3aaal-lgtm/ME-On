import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, Payment, PaymentMethod, PaymentTargetType } from '../types';
import {
  db,
  getArabicMonthName,
  getBillingModeLabel,
  getEffectiveSessionPrice,
  roundMoney,
  multiplyMoney,
  calculateCoveredSessions,
  calculateMoneyRemainder,
} from '../utils/storage';
import { useTranslation } from '../utils/i18n';
import { toLocalISODate, parseLocalDateStr } from '../utils/localDate';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon } from './ui/AppIcon';
import { StudentAvatar } from './StudentAvatar';
import { SegmentedControl } from './ui/SegmentedControl';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import {
  buildPaymentReceiptText,
  buildWhatsAppReceiptUrl,
  formatShortReceiptRef,
  getPaymentMethodDisplayLabel,
} from '../utils/paymentReceipt';

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
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
  const todayStr = toLocalISODate();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [studentId, setStudentId] = useState(
    targetStudent ? targetStudent.id : allStudents[0]?.id || ''
  );
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>(
    targetEnrollmentId || ''
  );
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

  // Post-save receipt state & clipboard feedback
  const [savedPayment, setSavedPayment] = useState<Payment | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // Reset transient confirmation states when modal opens
  useEffect(() => {
    if (isOpen) {
      setSavedPayment(null);
      setCopiedReceipt(false);
      setShowReceiptPreview(false);
    }
  }, [isOpen]);

  const teacherProfile = useMemo(() => db.getTeacherProfile(), [isOpen]);

  // Enrollments for selected student (Memoized for fast modal rendering)
  const studentEnrollments = useMemo(
    () => (studentId ? db.getStudentEnrollments(studentId) : []),
    [studentId, savedPayment]
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
      } else if (
        !selectedEnrollmentId ||
        !studentEnrollments.some((e) => e.id === selectedEnrollmentId)
      ) {
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
    [activeEnrollment?.id, savedPayment]
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
  const monthRemaining = Math.max(0, roundMoney(monthTotalRequired - monthPaidSoFar, 2));

  // Auto-switch payment type if monthly is selected vs per_session
  useEffect(() => {
    if (
      activeEnrollment?.billingType === 'monthly' ||
      activeEnrollment?.billingMode === 'monthly'
    ) {
      setPaymentType('specific_month');
    } else {
      setPaymentType('session_count');
    }
  }, [activeEnrollment?.id]);

  // Set default custom amount when month or session count changes
  useEffect(() => {
    if (savedPayment) return;
    if (paymentType === 'specific_month') {
      setCustomAmountInput(monthRemaining > 0 ? monthRemaining : monthTotalRequired);
    } else if (paymentType === 'single_session') {
      setCustomAmountInput(sessionUnitPrice);
    } else if (paymentType === 'session_count') {
      setCustomAmountInput(multiplyMoney(sessionCount, sessionUnitPrice));
    }
  }, [
    paymentType,
    targetMonth,
    targetYear,
    monthRemaining,
    monthTotalRequired,
    sessionCount,
    sessionUnitPrice,
    savedPayment,
  ]);

  // Calculations for custom amount mode
  const coveredSessionsFromCustom =
    sessionUnitPrice > 0 ? calculateCoveredSessions(customAmountInput, sessionUnitPrice) : 0;
  const remainderFromCustom =
    sessionUnitPrice > 0 ? calculateMoneyRemainder(customAmountInput, sessionUnitPrice) : 0;
  const potentialNewFinancialCredit = roundMoney(
    (activeEnrollment?.financialCredit || 0) + remainderFromCustom,
    2
  );
  const potentialAutoConvertedSessions =
    sessionUnitPrice > 0
      ? calculateCoveredSessions(potentialNewFinancialCredit, sessionUnitPrice)
      : 0;

  const selectedStudent = allStudents.find((s) => s.id === studentId) || targetStudent;

  const activeServiceDisplayName = useMemo(() => {
    if (!activeEnrollment) return '';
    if (activeEnrollment.serviceType === 'private') {
      if (activeEnrollment.subject) {
        if (isEn) return activeEnrollment.subject;
        return activeEnrollment.subject.startsWith('درس خاص')
          ? activeEnrollment.subject
          : `درس خاص - ${activeEnrollment.subject}`;
      }
      return isEn ? 'Private Lesson' : 'درس خاص';
    }
    return activeGroup?.name || (isEn ? 'Study Group' : 'مجموعة دراسية');
  }, [activeEnrollment, activeGroup, isEn]);

  // Dynamically construct the formatted WhatsApp receipt summary
  const receiptText = useMemo(() => {
    const effectiveAmount = savedPayment ? savedPayment.amount : Number(customAmountInput) || 0;
    const effectiveDate = savedPayment ? savedPayment.date : date;
    const effectiveMethod = savedPayment ? savedPayment.paymentMethod : paymentMethod;
    const effectiveType = savedPayment ? savedPayment.paymentType : paymentType;
    const effectiveNotes = savedPayment ? savedPayment.notes : notes;
    const effectiveRef = formatShortReceiptRef(
      savedPayment?.id,
      savedPayment ? savedPayment.referenceNumber : referenceNumber
    );

    const sessionsCountForSummary = savedPayment
      ? savedPayment.sessionsPurchased || savedPayment.sessionsCovered || undefined
      : effectiveType === 'single_session'
      ? 1
      : effectiveType === 'session_count'
      ? sessionCount
      : effectiveType === 'custom_amount' && coveredSessionsFromCustom > 0
      ? coveredSessionsFromCustom
      : undefined;

    const projectedMonthRemaining =
      effectiveType === 'specific_month'
        ? savedPayment
          ? monthRemaining
          : Math.max(0, roundMoney(monthRemaining - effectiveAmount, 2))
        : undefined;

    const updatedCredit =
      savedPayment && activeEnrollment ? activeEnrollment.sessionCredit : undefined;

    return buildPaymentReceiptText({
      studentName: selectedStudent?.name || '',
      parentRelation: selectedStudent?.parentRelation,
      date: effectiveDate,
      amount: effectiveAmount,
      currencyLabel: t('currency'),
      paymentType: effectiveType,
      paymentMethod: effectiveMethod,
      serviceName: activeServiceDisplayName,
      serviceType: activeEnrollment?.serviceType,
      targetMonth: savedPayment ? savedPayment.targetMonth ?? targetMonth : targetMonth,
      targetYear: savedPayment ? savedPayment.targetYear ?? targetYear : targetYear,
      sessionsCount: sessionsCountForSummary,
      remainingMonthAmount: projectedMonthRemaining,
      updatedSessionCredit: updatedCredit,
      receiptReference: effectiveRef,
      notes: effectiveNotes,
      teacherName: teacherProfile?.name,
      centerOrSchool: teacherProfile?.centerOrSchool,
      isEn,
    });
  }, [
    savedPayment,
    customAmountInput,
    date,
    paymentMethod,
    paymentType,
    notes,
    referenceNumber,
    sessionCount,
    coveredSessionsFromCustom,
    monthRemaining,
    activeEnrollment,
    selectedStudent?.name,
    selectedStudent?.parentRelation,
    t,
    activeServiceDisplayName,
    targetMonth,
    targetYear,
    teacherProfile?.name,
    teacherProfile?.centerOrSchool,
    isEn,
  ]);

  const recipientPhone = selectedStudent?.parentPhone || selectedStudent?.phone || '';

  const whatsappReceiptUrl = useMemo(
    () => buildWhatsAppReceiptUrl(receiptText, recipientPhone),
    [receiptText, recipientPhone]
  );

  const canShareReceipt = Boolean(
    selectedStudent && (savedPayment ? savedPayment.amount > 0 : customAmountInput > 0)
  );

  const handleCopyReceipt = async () => {
    if (!canShareReceipt) return;
    try {
      await navigator.clipboard.writeText(receiptText);
      triggerLightHaptic();
      setCopiedReceipt(true);
      if (copyTimerRef.current !== null) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => {
        setCopiedReceipt(false);
      }, 2200);
    } catch {
      // Ignore clipboard permission restrictions silently
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !activeEnrollment || customAmountInput <= 0) return;

    let finalSessionsPurchased = 0;
    if (paymentType === 'single_session') finalSessionsPurchased = 1;
    if (paymentType === 'session_count') finalSessionsPurchased = sessionCount;

    const createdPayment = db.recordPayment({
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

    triggerSuccessHaptic();
    onPaymentSaved();
    setSavedPayment(createdPayment);
  };

  if (!isOpen) return null;

  return (
    <BottomSheet
      id="add-payment-sheet"
      isOpen={isOpen}
      onClose={onClose}
      title={
        savedPayment
          ? isEn
            ? 'Payment Recorded'
            : 'تم تسجيل الدفعة بنجاح'
          : isEn
          ? 'Record Payment'
          : 'تسجيل دفعة مالية'
      }
      subtitle={
        selectedStudent
          ? isEn
            ? `Student: ${selectedStudent.name}`
            : `للطالب: ${selectedStudent.name}`
          : isEn
          ? 'Settle subscriptions & renew session credits'
          : 'سداد الاشتراكات وتجديد رصيد الحصص'
      }
      headerLeading={
        selectedStudent ? (
          <StudentAvatar
            student={selectedStudent}
            size="sm"
            showFrame={true}
            className="shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line">
            <AppIcon name="wallet" size={20} weight="fill" />
          </div>
        )
      }
      footer={
        savedPayment ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-soft min-h-[44px] px-5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isEn ? 'Done' : 'إغلاق'}
            </button>
            <a
              href={whatsappReceiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="share-saved-receipt-button"
              onClick={() => triggerLightHaptic()}
              className="btn-orange flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <AppIcon name="whatsapp" size={18} weight="fill" />
              <span>{isEn ? 'Share Receipt' : 'مشاركة الإيصال'}</span>
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              data-tutorial-id="payment-cancel-btn"
              onClick={onClose}
              className="btn-soft flex-1 min-h-[44px] whitespace-nowrap"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              form="add-payment-form"
              onClick={() => triggerLightHaptic()}
              disabled={!studentId || !activeEnrollment || customAmountInput <= 0}
              className="btn-orange flex-1 min-h-[44px] whitespace-nowrap cursor-pointer"
            >
              <AppIcon name="check" size={16} weight="regular" />
              <span>{isEn ? 'Confirm Payment' : 'تأكيد تسجيل الدفعة'}</span>
            </button>
          </div>
        )
      }
    >
      {savedPayment ? (
        <div className="space-y-4 text-xs text-navy tabular-nums">
          {/* Confirmed Transaction Banner */}
          <div className="p-4 rounded-2xl bg-mint-soft border border-line flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-page text-teal flex items-center justify-center shrink-0 border border-line">
                <AppIcon name="checkCircle" size={22} weight="fill" />
              </div>
              <div className="min-w-0">
                <strong className="text-sm font-bold text-navy block truncate">
                  {savedPayment.amount} {t('currency')}
                </strong>
                <span className="text-[11px] text-slate block truncate mt-0.5">
                  {savedPayment.date} · {getPaymentMethodDisplayLabel(savedPayment.paymentMethod, isEn)}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-navy shrink-0">
              {formatShortReceiptRef(savedPayment.id, savedPayment.referenceNumber)}
            </span>
          </div>

          {/* Formatted Receipt Text Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-navy flex items-center gap-1.5">
                <AppIcon name="receipt" size={15} className="text-navy" />
                <span>{isEn ? 'Parent Receipt Summary' : 'ملخص الإيصال الجاهز للمشاركة'}</span>
              </span>
              <button
                type="button"
                onClick={handleCopyReceipt}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-mist hover:bg-mint-soft border border-line text-[11px] font-semibold text-navy inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <AppIcon name={copiedReceipt ? 'check' : 'fileText'} size={13} />
                <span>
                  {copiedReceipt
                    ? isEn
                      ? 'Copied'
                      : 'تم النسخ'
                    : isEn
                    ? 'Copy Text'
                    : 'نسخ النص'}
                </span>
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-mist border border-line text-xs text-navy whitespace-pre-line leading-relaxed select-all">
              {receiptText}
            </div>

            <p className="text-[11px] text-slate px-1">
              {recipientPhone
                ? isEn
                  ? `Recipient WhatsApp: ${recipientPhone}`
                  : `رقم واتساب المستلم: ${recipientPhone}`
                : isEn
                ? 'No parent phone on file — WhatsApp will let you pick the contact.'
                : 'لا يوجد رقم هاتف مسجل — سيتيح لك واتساب اختيار ولي الأمر مباشرة.'}
            </p>
          </div>
        </div>
      ) : (
        /* Scrollable Form Body */
        <form
          id="add-payment-form"
          data-tutorial-id="payment-modal-body"
          onSubmit={handleSubmit}
          className="space-y-4 text-xs text-navy tabular-nums"
        >
          {/* 1. Student Picker (if not fixed) */}
          {!targetStudent && (
            <div className="classy-card p-3.5 space-y-2">
              <label className="font-bold text-xs text-navy flex items-center gap-2">
                <AppIcon name="students" size={16} className="text-navy" />
                <span>{isEn ? 'Select Student:' : 'اختر الطالب المستهدف:'}</span>
              </label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full classy-select"
              >
                {allStudents.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.gradeLevel || (isEn ? 'Unspecified' : 'غير محدد')})
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
                  <span>{isEn ? 'Target Enrollment:' : 'الاشتراك المستهدف للسداد:'}</span>
                </label>
                <span className="text-[10px] text-slate font-bold">
                  {isEn ? 'Independent Ledger' : 'ذمة مالية مستقلة'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {studentEnrollments.map((enr) => {
                  const grp = enr.groupId ? db.getGroupById(enr.groupId) : undefined;
                  const isSelected = enr.id === selectedEnrollmentId;
                  const displayName =
                    enr.serviceType === 'private'
                      ? enr.subject
                        ? enr.subject.startsWith('درس خاص')
                          ? enr.subject
                          : `درس خاص - ${enr.subject}`
                        : isEn
                        ? 'Private Lesson'
                        : 'درس خاص'
                      : grp?.name || (isEn ? 'Group' : 'مجموعة');

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
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-navy text-xs truncate">{displayName}</span>
                        <span className="text-[10px] text-slate font-semibold shrink-0">
                          {enr.serviceType === 'private'
                            ? isEn
                              ? 'Private'
                              : 'درس خاص'
                            : isEn
                            ? 'Group'
                            : 'مجموعة'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-line text-[11px]">
                        <span className="text-slate font-medium">
                          {getBillingModeLabel(enr.billingType, enr.billingMode)}:
                          <strong className="text-navy font-bold ms-1">
                            {enr.customPrice} {t('currency')}
                          </strong>
                        </span>
                        <span className="text-navy font-bold">
                          {isEn
                            ? `Credit: ${enr.sessionCredit || 0}`
                            : `رصيد: ${enr.sessionCredit || 0} حصص`}
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
              <span>
                {isEn
                  ? 'This student has no active enrollments yet. Please enroll them in a group or private service first.'
                  : 'هذا الطالب غير مسجل في أي مجموعة حالياً. يرجى إضافته لمجموعة أولاً.'}
              </span>
            </div>
          )}

          {/* 3. Payment Target Type Selector (4 Types) */}
          <div data-tutorial-id="payment-modal-types" className="classy-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs text-navy flex items-center gap-1.5">
                <AppIcon name="coins" size={16} className="text-navy" />
                <span>{isEn ? 'Payment Type:' : 'نوع السداد:'}</span>
              </label>
              <span className="text-[11px] text-slate font-semibold">
                {isEn
                  ? `Session rate: ${sessionUnitPrice} ${t('currency')}`
                  : `سعر الحصة: ${sessionUnitPrice} ${t('currency')}`}
              </span>
            </div>

            <SegmentedControl<PaymentTargetType>
              value={paymentType}
              onChange={(val) => setPaymentType(val)}
              options={[
                { value: 'specific_month', label: isEn ? 'Month' : 'شهر معين' },
                { value: 'single_session', label: isEn ? '1 Session' : 'حصة واحدة' },
                { value: 'session_count', label: isEn ? 'Sessions' : 'عدد حصص' },
                { value: 'custom_amount', label: isEn ? 'Amount' : 'مبلغ مالي' },
              ]}
            />
          </div>

          {/* --- DETAILS FOR TYPE 1: SPECIFIC MONTH --- */}
          {paymentType === 'specific_month' && (
            <div className="classy-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-navy text-xs">
                  {isEn ? 'Target Month & Year:' : 'حدد الشهر والسنة المستهدفة:'}
                </span>
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
              <div className="p-3 bg-mist rounded-2xl border border-line grid grid-cols-3 gap-2 text-center text-[11px]">
                <div>
                  <p className="text-slate font-semibold">{isEn ? 'Required' : 'قيمة الشهر'}</p>
                  <p className="font-bold text-xs sm:text-sm text-navy mt-0.5">
                    {monthTotalRequired} {t('currency')}
                  </p>
                </div>
                <div>
                  <p className="text-slate font-semibold">{isEn ? 'Paid' : 'المدفوع سابقاً'}</p>
                  <p className="font-bold text-xs sm:text-sm text-navy mt-0.5">
                    {monthPaidSoFar} {t('currency')}
                  </p>
                </div>
                <div>
                  <p className="text-slate font-semibold">{isEn ? 'Remaining' : 'المتبقي'}</p>
                  <p className="font-bold text-xs sm:text-sm text-navy mt-0.5">
                    {monthRemaining} {t('currency')}
                  </p>
                </div>
              </div>

              <div className="text-[11px] text-navy font-medium flex items-center gap-1.5 bg-mint-soft p-2.5 rounded-xl border border-line">
                <AppIcon name="info" size={16} className="text-navy shrink-0" />
                <span>
                  {isEn
                    ? 'Partial installments are supported; you can record part of the month now and settle the rest later.'
                    : 'يدعم النظام الدفع على دفعات؛ يمكنك سداد جزء من المبلغ الآن وإكمال الباقي لاحقاً.'}
                </span>
              </div>
            </div>
          )}

          {/* --- DETAILS FOR TYPE 2: SINGLE SESSION --- */}
          {paymentType === 'single_session' && (
            <div className="classy-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-navy text-xs">
                  {isEn ? 'Single Session Payment:' : 'سداد حصة واحدة:'}
                </span>
                <span className="font-bold text-sm text-navy">
                  {sessionUnitPrice} {t('currency')}
                </span>
              </div>
              <p className="text-[11px] text-slate font-medium">
                {isEn
                  ? '+1 session will be added immediately to the student session credit.'
                  : 'سيتم إضافة +1 حصة فوراً إلى رصيد حصص الطالب.'}
              </p>
            </div>
          )}

          {/* --- DETAILS FOR TYPE 3: SESSION COUNT --- */}
          {paymentType === 'session_count' && (
            <div className="classy-card p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="font-bold text-navy text-xs">
                  {isEn ? 'Number of Sessions:' : 'عدد الحصص المطلوبة:'}
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[4, 8, 10, 12, 16].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setSessionCount(cnt)}
                      className={`chip !px-3 ${sessionCount === cnt ? 'chip-active' : ''}`}
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
                  {sessionCount} {isEn ? 'sessions' : 'حصص'} × {sessionUnitPrice} {t('currency')} =
                </span>
                <span className="font-bold text-sm sm:text-base text-navy">
                  {multiplyMoney(sessionCount, sessionUnitPrice)} {t('currency')}
                </span>
              </div>

              <p className="text-[11px] text-navy font-medium flex items-center gap-1.5 bg-mint-soft p-2 rounded-xl">
                <AppIcon name="checkCircle" size={16} className="text-teal shrink-0" />
                <span>
                  {activeEnrollment?.billingMode === 'postpaid' ||
                  activeEnrollment?.billingType === 'postpaid'
                    ? isEn
                      ? 'Unpaid sessions are settled first, and any surplus is added as session credit.'
                      : 'سيتم تسوية الحصص المستحقة أولاً، والمبلغ الفائض يُضاف كرصيد حصص.'
                    : isEn
                    ? `${sessionCount} sessions will be added to this enrollment credit.`
                    : `سيتم إضافة ${sessionCount} حصص إلى رصيد الطالب في هذا الاشتراك.`}
                </span>
              </p>
            </div>
          )}

          {/* --- DETAILS FOR TYPE 4: CUSTOM AMOUNT --- */}
          {paymentType === 'custom_amount' && (
            <div className="classy-card p-4 space-y-3">
              <label className="font-bold text-navy text-xs block">
                {isEn ? 'Enter Paid Amount:' : 'أدخل المبلغ المدفوع:'}
              </label>

              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.5"
                  value={customAmountInput || ''}
                  onChange={(e) => setCustomAmountInput(Math.max(0, Number(e.target.value)))}
                  placeholder={isEn ? 'e.g. 500 or 250' : 'مثال: 500 أو 250'}
                  className="classy-input text-base font-bold py-3 pr-4 pl-10"
                />
                <span
                  className={`absolute ${
                    isRTL ? 'left-4' : 'right-4'
                  } top-3.5 font-bold text-xs text-slate`}
                >
                  {t('currency')}
                </span>
              </div>

              {/* Dynamic breakdown preview */}
              <div className="p-3 bg-mist rounded-2xl border border-line space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate font-bold">
                    {isEn ? 'Sessions covered by amount:' : 'عدد الحصص التي يغطيها المبلغ:'}
                  </span>
                  <strong className="text-xs sm:text-sm text-navy font-bold">
                    +{coveredSessionsFromCustom} {isEn ? 'sessions' : 'حصص'}
                  </strong>
                </div>

                <div className="flex items-center justify-between border-t border-line pt-1.5">
                  <span className="text-slate font-bold">
                    {isEn ? 'Remaining Financial Credit:' : 'الرصيد المالي المتبقي (Financial Credit):'}
                  </span>
                  <strong className="text-xs text-teal font-bold">
                    {remainderFromCustom} {t('currency')}
                  </strong>
                </div>

                {potentialAutoConvertedSessions > 0 && (
                  <div className="bg-mint-soft p-2 rounded-xl text-navy font-bold flex items-center gap-1.5 border border-line">
                    <AppIcon name="sparkles" size={16} className="text-orange shrink-0" />
                    <span>
                      {isEn
                        ? `Accumulated financial credit automatically converts into +${potentialAutoConvertedSessions} extra session(s).`
                        : `تراكم الرصيد المالي سيتحول تلقائياً إلى +${potentialAutoConvertedSessions} حصة إضافية!`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Amount Confirmation Field */}
          <div className="classy-card p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-xs text-navy">
                {isEn ? 'Total Payment Amount:' : 'المبلغ الإجمالي للدفع:'}
              </label>
              <span className="text-sm sm:text-base font-bold text-navy">
                {customAmountInput} {t('currency')}
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
              <span
                className={`absolute ${
                  isRTL ? 'left-4' : 'right-4'
                } top-2.5 font-bold text-xs text-slate`}
              >
                {t('currency')}
              </span>
            </div>
          </div>

          {/* Payment Method & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="classy-card p-3 space-y-1.5">
              <label className="font-bold text-xs text-navy flex items-center gap-1.5">
                <AppIcon name="creditCard" size={16} className="text-navy" />
                <span>{isEn ? 'Payment Method:' : 'طريقة الدفع:'}</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="classy-select"
              >
                <option value="cash">{isEn ? 'Cash' : 'نقداً (كاش)'}</option>
                <option value="vodafone_cash">
                  {isEn ? 'Vodafone Cash / Wallet' : 'فودافون كاش / محفظة'}
                </option>
                <option value="instapay">{isEn ? 'InstaPay' : 'إنستاباي (InstaPay)'}</option>
                <option value="bank_transfer">
                  {isEn ? 'Bank Transfer' : 'تحويل بنكي'}
                </option>
                <option value="other">{isEn ? 'Other' : 'أخرى'}</option>
              </select>
            </div>

            <div className="classy-card p-3 space-y-1.5">
              <label className="font-bold text-xs text-navy flex items-center gap-1.5">
                <AppIcon name="calendar" size={16} className="text-navy" />
                <span>{isEn ? 'Payment Date:' : 'تاريخ السداد:'}</span>
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
              <span>{isEn ? 'Notes or Reference Number:' : 'ملاحظات أو رقم الإيصال / المعاملة:'}</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isEn
                  ? 'e.g. Monthly installment or transfer reference...'
                  : 'مثال: دفعة من اشتراك الشهر، أو رقم عملية التحويل...'
              }
              className="classy-input"
            />
          </div>

          {/* Summary Indicator */}
          <div className="p-3 rounded-2xl bg-mist border border-line flex items-center justify-between text-xs">
            <span className="text-slate font-bold">
              {isEn ? 'Current Financial Credit:' : 'الرصيد المالي الحالي للاشتراك:'}
            </span>
            <span className="font-bold text-navy">
              {activeEnrollment?.financialCredit || 0} {t('currency')}
            </span>
          </div>

          {/* Dynamic WhatsApp Receipt Summary & Share Action */}
          <div className="classy-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-bold text-xs text-navy block truncate">
                  {isEn ? 'Parent WhatsApp Receipt' : 'إيصال ولي الأمر عبر واتساب'}
                </span>
                <span className="text-[11px] text-slate block truncate mt-0.5">
                  {selectedStudent
                    ? `${selectedStudent.name} · ${date} · ${customAmountInput || 0} ${t('currency')}`
                    : isEn
                    ? 'Select a student to prepare receipt'
                    : 'اختر الطالب لتجهيز نص الإيصال'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowReceiptPreview((prev) => !prev)}
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-mist hover:bg-mint-soft border border-line text-[11px] font-semibold text-slate hover:text-navy inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <AppIcon name={showReceiptPreview ? 'eyeOff' : 'eye'} size={13} />
                <span>
                  {showReceiptPreview
                    ? isEn
                      ? 'Hide Text'
                      : 'إخفاء النص'
                    : isEn
                    ? 'Preview'
                    : 'معاينة النص'}
                </span>
              </button>
            </div>

            {showReceiptPreview && (
              <div className="p-3 rounded-2xl bg-mist border border-line text-[11px] text-navy whitespace-pre-line leading-relaxed select-all">
                {receiptText}
              </div>
            )}

            <div className="flex items-center gap-2 pt-0.5">
              {canShareReceipt ? (
                <a
                  href={whatsappReceiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="share-receipt-button"
                  onClick={() => triggerLightHaptic()}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-full bg-mint-soft hover:bg-mint text-navy font-bold text-xs inline-flex items-center justify-center gap-2 border border-line transition-colors cursor-pointer whitespace-nowrap"
                >
                  <AppIcon name="whatsapp" size={17} weight="fill" className="text-teal" />
                  <span>{isEn ? 'Share Receipt' : 'مشاركة الإيصال'}</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  data-testid="share-receipt-button"
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-full bg-mist text-fog font-bold text-xs inline-flex items-center justify-center gap-2 border border-line opacity-60 cursor-not-allowed whitespace-nowrap"
                >
                  <AppIcon name="whatsapp" size={17} weight="fill" />
                  <span>{isEn ? 'Share Receipt' : 'مشاركة الإيصال'}</span>
                </button>
              )}

              <button
                type="button"
                disabled={!canShareReceipt}
                onClick={handleCopyReceipt}
                title={isEn ? 'Copy receipt text' : 'نسخ نص الإيصال'}
                className="min-h-[44px] px-3.5 py-2 rounded-full bg-page hover:bg-mist border border-line text-navy font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                <AppIcon name={copiedReceipt ? 'check' : 'fileText'} size={15} />
                <span>
                  {copiedReceipt
                    ? isEn
                      ? 'Copied'
                      : 'تم النسخ'
                    : isEn
                    ? 'Copy'
                    : 'نسخ'}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}
    </BottomSheet>
  );
};
