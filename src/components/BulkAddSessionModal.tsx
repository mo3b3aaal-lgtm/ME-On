import React, { useState, useEffect, useId } from 'react';
import {
  X,
  CalendarCheck2,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Info,
  Check,
  Plus,
  Minus,
  CheckCheck,
} from 'lucide-react';
import {
  Student,
  Group,
  BulkStudentSessionTarget,
  BulkCreateSessionsParams,
  BulkCreateSessionsResult,
  BillingMode,
} from '../types';
import { db, getBillingModeLabel, getEffectiveSessionPrice } from '../utils/storage';
import { StudentAvatar } from './StudentAvatar';
import { useTranslation } from '../utils/i18n';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';

interface BulkAddSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStudents: Student[];
  preselectedGroupId?: string;
  allGroups: Group[];
  onSuccess: (result: BulkCreateSessionsResult) => void;
}

export const BulkAddSessionModal: React.FC<BulkAddSessionModalProps> = ({
  isOpen,
  onClose,
  selectedStudents,
  preselectedGroupId,
  allGroups,
  onSuccess,
}) => {
  const { t, isRTL, language } = useTranslation();
  const todayStr = new Date().toISOString().split('T')[0];

  // Steps: form -> confirm -> result
  const [step, setStep] = useState<'form' | 'confirm' | 'result'>('form');

  // Parameters
  const [sessionCount, setSessionCount] = useState<number>(1);
  const [date, setDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>('16:00');
  const [title, setTitle] = useState<string>('حصة شرح وتطبيق');
  const [notes, setNotes] = useState<string>('');
  const [hourlyDuration, setHourlyDuration] = useState<number>(1.5);

  // Per-student chosen enrollment mapping: studentId -> { groupId, enrollmentId, hourlyRate }
  const [studentTargets, setStudentTargets] = useState<
    Record<string, { groupId: string; enrollmentId: string; customHourlyRate?: number }>
  >({});

  // Submission & Idempotency state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [batchResult, setBatchResult] = useState<BulkCreateSessionsResult | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Initialize targets when modal opens or selectedStudents change
  useEffect(() => {
    if (!isOpen) return;

    setStep('form');
    setIsSubmitting(false);
    setBatchResult(null);
    setIdempotencyKey(`bulk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    setDate(todayStr);

    const initialTargets: Record<string, { groupId: string; enrollmentId: string; customHourlyRate?: number }> = {};

    selectedStudents.forEach((st) => {
      const enrollments = db.getStudentEnrollments(st.id).filter((e) => e.status !== 'stopped');

      if (preselectedGroupId) {
        const matchingEnr = enrollments.find((e) => e.groupId === preselectedGroupId);
        if (matchingEnr) {
          initialTargets[st.id] = {
            groupId: preselectedGroupId,
            enrollmentId: matchingEnr.id,
            customHourlyRate: matchingEnr.hourlyRate || matchingEnr.customPrice,
          };
          return;
        }
      }

      if (enrollments.length > 0) {
        const firstEnr = enrollments[0];
        initialTargets[st.id] = {
          groupId: firstEnr.groupId,
          enrollmentId: firstEnr.id,
          customHourlyRate: firstEnr.hourlyRate || firstEnr.customPrice,
        };
      }
    });

    setStudentTargets(initialTargets);
  }, [isOpen, selectedStudents, preselectedGroupId]);

  if (!isOpen) return null;

  // Check if any selected student is on hourly billing
  const hasHourlyStudents = selectedStudents.some((st) => {
    const target = studentTargets[st.id];
    if (!target) return false;
    const enr = db.getEnrollmentById(target.enrollmentId);
    const grp = db.getGroupById(target.groupId);
    return (
      enr?.billingMode === 'hourly' ||
      enr?.billingType === 'hourly' ||
      grp?.billingMode === 'hourly' ||
      grp?.billingType === 'hourly'
    );
  });

  // Calculate total sessions
  const totalSessionsToCreate = selectedStudents.length * sessionCount;

  // Validate that all students have an active enrollment target
  const unassignedStudents = selectedStudents.filter((st) => !studentTargets[st.id]?.enrollmentId);
  const isValidToProceed = selectedStudents.length > 0 && unassignedStudents.length === 0 && sessionCount >= 1 && date;

  // Handle Target Enrollment Change for a student
  const handleEnrollmentChange = (studentId: string, enrollmentId: string) => {
    const enr = db.getEnrollmentById(enrollmentId);
    if (!enr) return;
    setStudentTargets((prev) => ({
      ...prev,
      [studentId]: {
        groupId: enr.groupId,
        enrollmentId: enr.id,
        customHourlyRate: enr.hourlyRate || enr.customPrice,
      },
    }));
  };

  // Perform Creation
  const handleExecuteBulkCreation = () => {
    if (isSubmitting) return; // Prevent double-execution
    setIsSubmitting(true);

    try {
      const targetsList: BulkStudentSessionTarget[] = selectedStudents.map((st) => {
        const tgt = studentTargets[st.id];
        const enr = db.getEnrollmentById(tgt.enrollmentId);
        const grp = db.getGroupById(tgt.groupId);
        const isHourly =
          enr?.billingMode === 'hourly' ||
          enr?.billingType === 'hourly' ||
          grp?.billingMode === 'hourly' ||
          grp?.billingType === 'hourly';

        return {
          studentId: st.id,
          enrollmentId: tgt.enrollmentId,
          groupId: tgt.groupId,
          hours: isHourly ? (Number(hourlyDuration) > 0 ? Number(hourlyDuration) : 1) : undefined,
          hourlyRate: isHourly ? (tgt.customHourlyRate || enr?.hourlyRate || grp?.hourlyRate || 100) : undefined,
        };
      });

      const params: BulkCreateSessionsParams = {
        students: targetsList,
        sessionCount,
        date,
        startTime,
        title: title.trim() || t('navSessions'),
        notes: notes.trim(),
        status: 'completed',
        attendanceStatus: 'present',
        isCharged: true,
        idempotencyKey,
      };

      const res = db.recordBulkSessionsForStudents(params);
      setBatchResult(res);
      setStep('result');
      onSuccess(res);
    } catch (err) {
      console.error('Bulk creation error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalLayer = useModalLayer('bulk-add-session', isOpen, onClose);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#2D332A]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-t-3xl sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[94vh] flex flex-col overflow-hidden shadow-2xl relative">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-[#E8E2D6] bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#748C70] text-white shadow-sm">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#2D332A] tracking-tight">
                {t('addBulkSessionTitle')}
              </h2>
              <p className="text-[11px] text-[#8A9187] font-semibold">
                {selectedStudents.length} {t('studentsCountBadge')} • {sessionCount} {sessionCount === 1 ? 'حصة' : 'حصص'}{' '}
                ({totalSessionsToCreate} {t('summaryTotalSessions')})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[#F2ECE1] text-[#6B7567] hover:text-[#2D332A] hover:bg-[#EAE5D8] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: Main Configuration Form */}
        {step === 'form' && (
          <div className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-4 text-xs text-[#434B3E]">
            
            {/* Quick Summary Badge */}
            <div className="p-3 bg-[#748C70]/10 border border-[#748C70]/30 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#748C70]" />
                <span className="font-bold text-[#2D332A] text-xs">
                  {t('selectedCount', { count: selectedStudents.length.toString() })}
                </span>
              </div>
              <span className="text-[11px] font-bold bg-[#748C70] text-white px-2.5 py-0.5 rounded-xl shadow-xs">
                {totalSessionsToCreate} {t('totalSessionsToCreate')}
              </span>
            </div>

            {/* Sessions Count Counter & Quick Chips */}
            <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-2.5 shadow-sm">
              <label className="block font-bold text-[#6B7567] text-xs">
                {t('sessionsCountPerStudent')} *
              </label>

              <div className="flex items-center gap-3">
                <div className="flex items-center border border-[#E8E2D6] rounded-xl bg-[#F9F7F2] p-1">
                  <button
                    type="button"
                    onClick={() => setSessionCount((c) => Math.max(1, c - 1))}
                    className="p-1.5 rounded-lg bg-white text-[#2D332A] hover:bg-[#F2ECE1] border border-[#E8E2D6] transition-colors active:scale-95"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-12 text-center font-black text-sm text-[#2D332A]">
                    {sessionCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSessionCount((c) => c + 1)}
                    className="p-1.5 rounded-lg bg-white text-[#2D332A] hover:bg-[#F2ECE1] border border-[#E8E2D6] transition-colors active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Number Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSessionCount(num)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        sessionCount === num
                          ? 'bg-[#748C70] text-white shadow-xs'
                          : 'bg-[#F2ECE1] text-[#6B7567] hover:bg-[#EAE5D8]'
                      }`}
                    >
                      {num} {num === 1 ? 'حصة' : 'حصص'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Date & Start Time */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl space-y-1 shadow-sm">
                <label className="block font-bold text-[#6B7567] text-[11px]">{t('sessionDate')} *</label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs font-bold text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                  />
                </div>
              </div>

              <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl space-y-1 shadow-sm">
                <label className="block font-bold text-[#6B7567] text-[11px]">{t('sessionStartTime')}</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs font-bold text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
              </div>
            </div>

            {/* Session Title / Subject */}
            <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl space-y-1.5 shadow-sm">
              <label className="block font-bold text-[#6B7567] text-[11px]">
                {t('sessionTitleInput')}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: مراجعة شاملة وحل تمارين"
                className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] font-bold focus:outline-none focus:border-[#748C70]"
              />
            </div>

            {/* Hourly Rate Duration & Calculation Section */}
            {hasHourlyStudents && (
              <div className="p-3.5 bg-[#D49B4B]/10 border border-[#D49B4B]/30 rounded-2xl space-y-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#D49B4B]" />
                  <h4 className="font-bold text-[#2D332A] text-xs">{t('hourlyDurationLabel')}</h4>
                </div>
                <p className="text-[11px] text-[#6B7567]">{t('hourlyNote')}</p>

                <div className="flex items-center gap-2 flex-wrap">
                  {[1, 1.5, 2, 2.5, 3].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setHourlyDuration(hrs)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        hourlyDuration === hrs
                          ? 'bg-[#D49B4B] text-white shadow-xs'
                          : 'bg-white text-[#6B7567] border border-[#E8E2D6]'
                      }`}
                    >
                      {hrs} {hrs === 1 ? 'ساعة' : 'ساعات'}
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.25"
                      min="0.5"
                      max="10"
                      value={hourlyDuration}
                      onChange={(e) => setHourlyDuration(Number(e.target.value) || 1)}
                      className="w-16 bg-white border border-[#E8E2D6] rounded-xl p-1.5 text-xs font-bold text-center text-[#2D332A]"
                    />
                    <span className="text-[11px] font-bold text-[#8A9187]">ساعة</span>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Students & Enrollment Configuration List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#6B7567] text-xs">
                  {t('selectedStudents')} ({selectedStudents.length}):
                </span>
                <span className="text-[10px] text-[#8A9187]">
                  {preselectedGroupId ? t('allSelectedStudentsInSameGroup') : t('multiGroupSelectionNote')}
                </span>
              </div>

              {selectedStudents.map((st) => {
                const enrollments = db.getStudentEnrollments(st.id).filter((e) => e.status !== 'stopped');
                const target = studentTargets[st.id];
                const currentEnr = enrollments.find((e) => e.id === target?.enrollmentId);
                const currentGroup = currentEnr ? db.getGroupById(currentEnr.groupId) : undefined;
                const isHourly =
                  currentEnr?.billingMode === 'hourly' ||
                  currentEnr?.billingType === 'hourly' ||
                  currentGroup?.billingMode === 'hourly' ||
                  currentGroup?.billingType === 'hourly';

                const rate = isHourly
                  ? (target?.customHourlyRate || currentEnr?.hourlyRate || currentEnr?.customPrice || currentGroup?.hourlyRate || currentGroup?.defaultPrice || 100)
                  : (currentEnr?.customPrice || currentGroup?.defaultPrice || 100);

                const sessionPrice = isHourly ? hourlyDuration * rate : rate;

                return (
                  <div
                    key={st.id}
                    className="p-3 bg-white border border-[#E8E2D6] rounded-2xl space-y-2 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <StudentAvatar student={st} size="sm" showFrame={true} className="shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-[#2D332A] text-xs truncate">{st.name}</p>
                          <p className="text-[10px] text-[#8A9187]">
                            {currentEnr
                              ? getBillingModeLabel(currentEnr.billingType, currentEnr.billingMode)
                              : t('noEnrollmentWarning')}
                          </p>
                        </div>
                      </div>

                      {/* Financial info per student */}
                      <div className="text-end shrink-0">
                        <span className="text-[11px] font-black text-[#748C70]">
                          {isHourly
                            ? `${sessionPrice} ${t('currency')} (${hourlyDuration} س × ${rate})`
                            : `${sessionPrice} ${t('currency')}`}
                        </span>
                        {sessionCount > 1 && (
                          <p className="text-[10px] font-bold text-[#8A9187]">
                            إجمالي: {sessionPrice * sessionCount} {t('currency')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Enrollment selector if student has multiple active enrollments */}
                    {enrollments.length > 1 && !preselectedGroupId && (
                      <div className="pt-1.5 border-t border-[#E8E2D6]/60 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#8A9187] shrink-0">
                          {t('chooseGroupForStudent')}:
                        </span>
                        <select
                          value={target?.enrollmentId || ''}
                          onChange={(e) => handleEnrollmentChange(st.id, e.target.value)}
                          className="flex-1 bg-[#F9F7F2] border border-[#E8E2D6] rounded-lg px-2 py-1 text-[11px] text-[#2D332A] font-bold focus:outline-none"
                        >
                          {enrollments.map((e) => {
                            const grp = db.getGroupById(e.groupId);
                            return (
                              <option key={e.id} value={e.id}>
                                {grp?.name || 'مجموعة'} ({getBillingModeLabel(e.billingType, e.billingMode)} - {e.customPrice} {t('currency')})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    {/* Warning if not enrolled */}
                    {enrollments.length === 0 && (
                      <div className="p-2 bg-[#C97C5D]/10 border border-[#C97C5D]/30 rounded-xl flex items-center gap-1.5 text-[10px] text-[#C97C5D] font-bold">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('noEnrollmentWarning')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Notes */}
            <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl space-y-1 shadow-sm">
              <label className="block font-bold text-[#6B7567] text-[11px]">{t('notes')}</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات اختيارية..."
                className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none"
              />
            </div>

          </div>
        )}

        {/* STEP 2: Confirmation Summary Screen */}
        {step === 'confirm' && (
          <div className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-3.5 text-xs text-[#434B3E]">
            
            <div className="p-4 bg-white border border-[#E8E2D6] rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-[#748C70]">
                <Info className="w-5 h-5" />
                <h3 className="font-bold text-sm text-[#2D332A]">{t('confirmBulkCreation')}</h3>
              </div>
              <p className="text-[11px] text-[#8A9187] font-semibold">
                {t('confirmBulkCreationDesc')}
              </p>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E8E2D6]/60">
                <div className="p-2.5 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6]">
                  <p className="text-[10px] text-[#8A9187] font-bold">{t('summaryStudentsCount')}</p>
                  <p className="text-sm font-black text-[#2D332A]">{selectedStudents.length} طلاب</p>
                </div>
                <div className="p-2.5 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6]">
                  <p className="text-[10px] text-[#8A9187] font-bold">{t('summarySessionsPerStudent')}</p>
                  <p className="text-sm font-black text-[#748C70]">{sessionCount} حصص</p>
                </div>
                <div className="p-2.5 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6]">
                  <p className="text-[10px] text-[#8A9187] font-bold">{t('summaryTotalSessions')}</p>
                  <p className="text-sm font-black text-[#D49B4B]">{totalSessionsToCreate} حصة</p>
                </div>
                <div className="p-2.5 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6]">
                  <p className="text-[10px] text-[#8A9187] font-bold">{t('summaryTargetDate')}</p>
                  <p className="text-xs font-bold text-[#2D332A]">{date}</p>
                </div>
              </div>
            </div>

            {/* Individual Breakdown List */}
            <div className="space-y-2">
              <span className="font-bold text-[#6B7567] text-xs">{t('billingSummary')}:</span>
              {selectedStudents.map((st) => {
                const tgt = studentTargets[st.id];
                const enr = db.getEnrollmentById(tgt?.enrollmentId);
                const grp = db.getGroupById(tgt?.groupId);
                const isHourly =
                  enr?.billingMode === 'hourly' ||
                  enr?.billingType === 'hourly' ||
                  grp?.billingMode === 'hourly' ||
                  grp?.billingType === 'hourly';

                const rate = isHourly
                  ? (tgt?.customHourlyRate || enr?.hourlyRate || enr?.customPrice || grp?.hourlyRate || grp?.defaultPrice || 100)
                  : (enr?.customPrice || grp?.defaultPrice || 100);

                const effectivePrice = isHourly ? hourlyDuration * rate : rate;

                return (
                  <div
                    key={st.id}
                    className="p-2.5 bg-white border border-[#E8E2D6] rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <StudentAvatar student={st} size="sm" showFrame={false} />
                      <div>
                        <p className="font-bold text-[#2D332A] text-xs">{st.name}</p>
                        <p className="text-[10px] text-[#8A9187]">
                          {grp?.name} • {getBillingModeLabel(enr?.billingType, enr?.billingMode)}
                        </p>
                      </div>
                    </div>

                    <div className="text-end">
                      <span className="font-bold text-[#2D332A] text-xs">
                        +{sessionCount} حصص
                      </span>
                      <p className="text-[10px] text-[#748C70] font-bold">
                        {effectivePrice * sessionCount} {t('currency')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* STEP 3: Result Summary Screen */}
        {step === 'result' && batchResult && (
          <div className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-4 text-xs text-[#434B3E]">
            
            <div className="p-5 bg-white border border-[#E8E2D6] rounded-3xl text-center space-y-2.5 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-[#748C70]/15 text-[#748C70] mx-auto flex items-center justify-center">
                <CheckCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-[#2D332A]">{t('bulkAddSuccess')}</h3>
              <p className="text-xs text-[#6B7567] max-w-xs mx-auto">
                {t('bulkAddSuccessDesc', {
                  total: batchResult.totalCreated.toString(),
                  students: batchResult.studentCount.toString(),
                  perStudent: batchResult.sessionsPerStudent.toString(),
                })}
              </p>
            </div>

            {/* Results Details List */}
            <div className="space-y-2">
              <span className="font-bold text-[#6B7567] text-xs">{t('details')}:</span>
              {batchResult.results.map((item) => (
                <div
                  key={item.studentId}
                  className={`p-3 rounded-2xl border flex items-center justify-between ${
                    item.success
                      ? 'bg-white border-[#E8E2D6]'
                      : 'bg-[#C97C5D]/10 border-[#C97C5D]/30'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#2D332A] text-xs">{item.studentName}</span>
                      <span className="text-[10px] text-[#8A9187]">({item.groupName})</span>
                    </div>
                    <p className="text-[10px] text-[#8A9187]">
                      {getBillingModeLabel(item.billingMode)} • {item.chargedAmountPerSession} {t('currency')} / حصة
                    </p>
                  </div>

                  <div className="text-end">
                    {item.success ? (
                      <span className="text-[11px] font-bold text-[#748C70] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>+{item.sessionsCreated} حصص</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-[#C97C5D]">
                        {item.error || 'فشل'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* Footer Actions */}
        <div className="p-3.5 bg-white border-t border-[#E8E2D6] flex items-center gap-2">
          {step === 'form' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#F2ECE1] hover:bg-[#EAE5D8] text-[#2D332A] text-xs font-bold transition-colors border border-[#E8E2D6]"
              >
                {t('cancel')}
              </button>

              <button
                type="button"
                disabled={!isValidToProceed}
                onClick={() => setStep('confirm')}
                className="flex-2 py-2.5 px-4 rounded-xl bg-[#748C70] hover:bg-[#5E755A] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
              >
                <span>مراجعة وتأكيد ({totalSessionsToCreate} حصة)</span>
                {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setStep('form')}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#F2ECE1] hover:bg-[#EAE5D8] text-[#2D332A] text-xs font-bold transition-colors border border-[#E8E2D6]"
              >
                {t('backToEdit')}
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleExecuteBulkCreation}
                className="flex-2 py-2.5 px-4 rounded-xl bg-[#748C70] hover:bg-[#5E755A] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
              >
                {isSubmitting ? (
                  <span>{t('creatingSessions')}</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد إنشاء {totalSessionsToCreate} حصة</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 'result' && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{t('done')}</span>
            </button>
          )}
        </div>

      </div>
    </div>
    </ModalPortal>
  );
};
