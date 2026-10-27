import React, { useState, useEffect, useMemo } from 'react';
import { Session, Group, Student } from '../types';
import { db, getEffectiveSessionPrice, multiplyMoney } from '../utils/storage';
import { useTranslation } from '../utils/i18n';
import { toLocalISODate, parseLocalDateStr } from '../utils/localDate';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon } from './ui/AppIcon';
import { StudentAvatar } from './StudentAvatar';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';

interface AddEditSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSession?: Session | null;
  defaultGroupId?: string;
  defaultDate?: string;
  defaultStudentId?: string;
  isExtraSessionDefault?: boolean;
  allGroups: Group[];
  allStudents?: Student[];
  onSaveComplete: (savedSession: Session) => void;
}

const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const EMPTY_STUDENTS: Student[] = [];

export const AddEditSessionModal: React.FC<AddEditSessionModalProps> = ({
  isOpen,
  onClose,
  editingSession,
  defaultGroupId,
  defaultDate,
  defaultStudentId,
  isExtraSessionDefault = false,
  allGroups,
  allStudents = EMPTY_STUDENTS,
  onSaveComplete,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
  const todayStr = toLocalISODate();

  const [sessionType, setSessionType] = useState<'group' | 'private'>(() => {
    if (editingSession) {
      return editingSession.studentId || !editingSession.groupId ? 'private' : 'group';
    }
    if (defaultStudentId) return 'private';
    return 'group';
  });

  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    return editingSession?.studentId || defaultStudentId || '';
  });
  const [studentSearch, setStudentSearch] = useState('');

  const [groupId, setGroupId] = useState(defaultGroupId || allGroups[0]?.id || '');
  const [title, setTitle] = useState(isEn ? 'Lesson Review & Explanation' : 'حصة مراجعة وشرح درس جديد');
  const [date, setDate] = useState(defaultDate || todayStr);
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('17:30');
  const [sessionNumber, setSessionNumber] = useState<number>(1);
  const [hours, setHours] = useState<number>(1.5);
  const [hourlyRate, setHourlyRate] = useState<number>(100);
  const [pricePerStudent, setPricePerStudent] = useState<number>(100);
  const [status, setStatus] = useState<'scheduled' | 'completed' | 'cancelled'>('scheduled');
  const [isExtraSession, setIsExtraSession] = useState<boolean>(isExtraSessionDefault);
  const [notes, setNotes] = useState('');

  const enrollments = useMemo(() => (isOpen ? db.getEnrollments() : []), [isOpen]);

  // Filter & prioritize students with active private lessons first, with search
  const privateStudentCandidates = useMemo(() => {
    const activeStudents = allStudents.filter((s) => s.status !== 'archived');
    const privateStudentIds = new Set<string>();

    enrollments.forEach((e) => {
      if ((e.serviceType === 'private' || !e.groupId) && e.status !== 'stopped') {
        privateStudentIds.add(e.studentId);
      }
    });

    activeStudents.forEach((s) => {
      if (s.serviceType === 'private' || (s.privateDays && s.privateDays.length > 0)) {
        privateStudentIds.add(s.id);
      }
    });

    // Sort: students with private lessons first, then alphabetically
    const sorted = [...activeStudents].sort((a, b) => {
      const aIsPriv = privateStudentIds.has(a.id) ? 1 : 0;
      const bIsPriv = privateStudentIds.has(b.id) ? 1 : 0;
      if (bIsPriv !== aIsPriv) return bIsPriv - aIsPriv;
      return a.name.localeCompare(b.name);
    });

    if (!studentSearch.trim()) return sorted;
    const q = studentSearch.trim().toLowerCase();
    return sorted.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.phone && s.phone.includes(q)) ||
      (s.parentPhone && s.parentPhone.includes(q)) ||
      (s.gradeLevel && s.gradeLevel.toLowerCase().includes(q))
    );
  }, [allStudents, enrollments, studentSearch, isOpen]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return allStudents.find((s) => s.id === selectedStudentId) || null;
  }, [selectedStudentId, allStudents]);

  const selectedPrivateEnr = useMemo(() => {
    if (!selectedStudentId) return null;
    return enrollments.find(
      (e) => e.studentId === selectedStudentId && (e.serviceType === 'private' || !e.groupId)
    ) || null;
  }, [selectedStudentId, enrollments]);

  const selectedGroup = allGroups.find((g) => g.id === groupId);
  const isHourly = sessionType === 'private'
    ? (selectedPrivateEnr?.billingMode === 'hourly' || selectedPrivateEnr?.billingType === 'hourly')
    : (selectedGroup?.billingMode === 'hourly' || selectedGroup?.billingType === 'hourly');

  // Helper to calculate hours between times
  const calculateHoursFromTimes = (start: string, end: string): number => {
    try {
      if (!start || !end) return 1.5;
      const [startH, startM] = start.split(':').map(Number);
      const [endH, endM] = end.split(':').map(Number);
      const startMin = startH * 60 + startM;
      let endMin = endH * 60 + endM;
      if (endMin < startMin) endMin += 24 * 60; // Next day fallback
      const diffHrs = (endMin - startMin) / 60;
      return Math.round(diffHrs * 100) / 100 > 0 ? Math.round(diffHrs * 100) / 100 : 1.5;
    } catch {
      return 1.5;
    }
  };

  useEffect(() => {
    if (editingSession) {
      const isPriv = !!editingSession.studentId || !editingSession.groupId;
      setSessionType(isPriv ? 'private' : 'group');
      setSelectedStudentId(editingSession.studentId || '');
      setGroupId(editingSession.groupId || allGroups[0]?.id || '');
      setTitle(editingSession.title);
      setDate(editingSession.date);
      setStartTime(editingSession.startTime);
      setEndTime(editingSession.endTime || '');
      setSessionNumber(editingSession.sessionNumber || 1);
      const durHours = editingSession.hours || calculateHoursFromTimes(editingSession.startTime, editingSession.endTime || '');
      setHours(durHours);
      setHourlyRate(editingSession.hourlyRate || editingSession.pricePerStudent || 100);
      setPricePerStudent(editingSession.pricePerStudent || 100);
      setStatus(editingSession.status);
      setIsExtraSession(editingSession.isExtraSession || false);
      setNotes(editingSession.notes || '');
    } else {
      const isPriv = Boolean(defaultStudentId);
      setSessionType(isPriv ? 'private' : 'group');
      setSelectedStudentId(defaultStudentId || '');
      const gId = defaultGroupId || allGroups[0]?.id || '';
      setGroupId(gId);
      const grp = allGroups.find((g) => g.id === gId);

      setDate(defaultDate || todayStr);
      setStartTime('16:00');
      setEndTime('17:30');
      setSessionNumber(1);
      const durHours = 1.5;
      setHours(durHours);
      setIsExtraSession(isExtraSessionDefault);
      setStatus('scheduled');
      setNotes('');
      setStudentSearch('');

      if (isPriv && defaultStudentId) {
        const st = allStudents.find((s) => s.id === defaultStudentId);
        setTitle(isEn ? `Private Lesson - ${st?.name || ''}` : `درس خاص - ${st?.name || ''}`);
        const privEnr = enrollments.find(
          (e) => e.studentId === defaultStudentId && (e.serviceType === 'private' || !e.groupId)
        );
        const rate = privEnr?.hourlyRate || privEnr?.customPrice || 100;
        setHourlyRate(rate);
        setPricePerStudent(rate);
      } else {
        setTitle(isExtraSessionDefault ? (isEn ? 'Extra Session' : 'حصة إضافية') : (isEn ? 'Lesson & Application' : 'حصة شرح وتطبيق'));
        const rate = grp?.hourlyRate || grp?.defaultPrice || 100;
        setHourlyRate(rate);
        const calculatedPrice = (grp?.billingMode === 'hourly' || grp?.billingType === 'hourly')
          ? durHours * rate
          : getEffectiveSessionPrice(null, grp);
        setPricePerStudent(calculatedPrice);
      }
    }
  }, [editingSession, defaultGroupId, defaultDate, defaultStudentId, isExtraSessionDefault, isOpen]);

  // Update hours and price when times change
  const handleTimeChange = (newStart: string, newEnd: string) => {
    setStartTime(newStart);
    setEndTime(newEnd);
    if (isHourly) {
      const calculated = calculateHoursFromTimes(newStart, newEnd);
      setHours(calculated);
      setPricePerStudent(multiplyMoney(calculated, hourlyRate));
    }
  };

  const handleSelectStudent = (st: Student) => {
    setSelectedStudentId(st.id);
    const privEnr = enrollments.find(
      (e) => e.studentId === st.id && (e.serviceType === 'private' || !e.groupId)
    );
    const privIsHourly = privEnr?.billingMode === 'hourly' || privEnr?.billingType === 'hourly';
    const rate = privEnr?.hourlyRate || privEnr?.customPrice || 100;
    setHourlyRate(rate);

    if (privIsHourly) {
      setPricePerStudent(multiplyMoney(hours, rate));
    } else {
      setPricePerStudent(rate);
    }

    if (!editingSession) {
      setTitle(isEn ? `Private Lesson - ${st.name}` : `درس خاص - ${st.name}`);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (sessionType === 'group' && !groupId) return;
    if (sessionType === 'private' && !selectedStudentId) return;
    if (!date) return;

    const parsedDate = parseLocalDateStr(date);
    const dayName = ARABIC_DAYS[parsedDate.getDay()] || 'السبت';
    const month = parsedDate.getMonth() + 1;
    const year = parsedDate.getFullYear();

    const grp = sessionType === 'group' ? allGroups.find((g) => g.id === groupId) : undefined;
    const isPackage = sessionType === 'group' && (grp?.billingMode === 'package' || grp?.billingType === 'package');
    const isHourlyBilling = isHourly;
    const packageSessionsCount = isPackage ? (grp?.packageSessionsCount || 8) : undefined;
    const packageTotalPrice = isPackage ? grp?.defaultPrice : undefined;

    const finalHours = isHourlyBilling ? (Number(hours) || calculateHoursFromTimes(startTime, endTime)) : undefined;
    const finalHourlyRate = isHourlyBilling ? (Number(hourlyRate) || 100) : undefined;
    const effectiveSessionPrice = isHourlyBilling
      ? (finalHours! * finalHourlyRate!)
      : (Number(pricePerStudent) || (grp ? getEffectiveSessionPrice(null, grp) : 100));

    const sessionId = editingSession
      ? editingSession.id
      : `ses_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const savedSession: Session = {
      id: sessionId,
      groupId: sessionType === 'group' ? groupId : '',
      studentId: sessionType === 'private' ? selectedStudentId : undefined,
      enrollmentId: sessionType === 'private' ? (selectedPrivateEnr?.id || undefined) : undefined,
      title: title.trim() || (
        sessionType === 'private'
          ? (isEn ? `Private Lesson - ${selectedStudent?.name || ''}` : `درس خاص - ${selectedStudent?.name || ''}`)
          : (isEn ? 'Class Session' : 'حصة دراسية')
      ),
      date,
      dayName,
      month,
      year,
      startTime,
      endTime,
      sessionNumber: Number(sessionNumber) || 1,
      hours: finalHours,
      hourlyRate: finalHourlyRate,
      pricePerStudent: effectiveSessionPrice,
      sessionCount: 1,
      effectiveSessionPrice,
      totalSessionValue: effectiveSessionPrice,
      packageTotalPrice,
      packageSessionsCount,
      status,
      isHourly: isHourlyBilling,
      isExtraSession: isExtraSession || false,
      notes: notes.trim(),
      createdAt: editingSession ? editingSession.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.saveSession(savedSession);
    triggerSuccessHaptic();
    onSaveComplete(savedSession);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <BottomSheet
      id="add-edit-session"
      isOpen={isOpen}
      onClose={onClose}
      title={
        editingSession
          ? isEn ? 'Edit Session' : 'تعديل بيانات الحصة'
          : sessionType === 'private'
          ? isEn ? 'Schedule Private Session' : 'جدولة درس خاص'
          : isEn ? 'Schedule Group Session' : 'جدولة حصة مجموعة'
      }
      subtitle={
        sessionType === 'private'
          ? isEn ? 'Advance scheduling for an individual private student' : 'جدولة موعد مسبق لطالب فردي في تاريخ وساعة محددة'
          : isEn ? 'Supports multiple sessions on same day, linked to financials' : 'تدعم أكثر من حصة في نفس اليوم ومرتبطة بالسجل المحاسبي'
      }
      headerLeading={
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-line ${
          sessionType === 'private' ? 'bg-[#0F2A4A]/10 text-[#0F2A4A]' : 'bg-mint-soft text-navy'
        }`}>
          <AppIcon name={sessionType === 'private' ? 'sparkles' : 'calendarCheck'} size={20} weight="duotone" />
        </div>
      }
      headerTrailing={
        isExtraSession ? (
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-orange text-white">
            {isEn ? 'Extra' : 'إضافية'}
          </span>
        ) : undefined
      }
      bodyClassName="p-4"
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
            form="add-session-form"
            onClick={() => triggerLightHaptic()}
            className="btn-orange flex-1 cursor-pointer"
          >
            <AppIcon name="check" size={16} weight="bold" />
            <span>
              {editingSession
                ? isEn ? 'Save Changes' : 'حفظ تعديلات الحصة'
                : sessionType === 'private'
                ? isEn ? '+ Schedule Private Session' : '+ جدولة الدرس الخاص'
                : isEn ? '+ Schedule Session' : '+ جدولة الحصة'}
            </span>
          </button>
        </div>
      }
    >
      <form id="add-session-form" onSubmit={handleSubmit} className="space-y-3.5 text-xs text-navy text-start">
        {/* Session Type Selector: Radio Cards with Icon Badges */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              setSessionType('group');
              if (!editingSession && title.startsWith('درس خاص') || title.startsWith('Private Lesson')) {
                const grp = allGroups.find((g) => g.id === groupId);
                setTitle(grp?.name || (isEn ? 'Lesson & Application' : 'حصة شرح وتطبيق'));
              }
            }}
            className={`p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center gap-2.5 ${
              sessionType === 'group'
                ? 'bg-[#17375E]/8 border-[#17375E] ring-1 ring-[#17375E]/30 shadow-2xs'
                : 'bg-page border-line hover:border-[#17375E]/40 text-slate'
            }`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              sessionType === 'group' ? 'bg-[#17375E] text-white shadow-xs' : 'bg-line/40 text-slate'
            }`}>
              <AppIcon name="users" size={16} weight="bold" />
            </div>
            <div className="min-w-0 flex-1">
              <span className={`block text-xs font-black truncate ${
                sessionType === 'group' ? 'text-navy' : 'text-slate'
              }`}>
                {isEn ? 'Group Session' : 'حصة مجموعة'}
              </span>
              <span className="block text-[10px] text-slate font-medium truncate">
                {isEn ? 'Class batch' : 'مجموعة دراسية'}
              </span>
            </div>
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
              sessionType === 'group' ? 'border-[#17375E]' : 'border-line'
            }`}>
              {sessionType === 'group' && <div className="w-2 h-2 rounded-full bg-[#17375E]" />}
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setSessionType('private');
              if (!editingSession && selectedStudent) {
                setTitle(isEn ? `Private Lesson - ${selectedStudent.name}` : `درس خاص - ${selectedStudent.name}`);
              } else if (!editingSession) {
                setTitle(isEn ? 'Private Lesson' : 'درس خاص');
              }
            }}
            className={`p-3 rounded-2xl border text-start transition-all cursor-pointer flex items-center gap-2.5 ${
              sessionType === 'private'
                ? 'bg-[#0F2A4A]/8 border-[#0F2A4A] ring-1 ring-[#0F2A4A]/30 shadow-2xs'
                : 'bg-page border-line hover:border-[#0F2A4A]/40 text-slate'
            }`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              sessionType === 'private' ? 'bg-[#0F2A4A] text-white shadow-xs' : 'bg-line/40 text-slate'
            }`}>
              <AppIcon name="sparkles" size={16} weight="bold" />
            </div>
            <div className="min-w-0 flex-1">
              <span className={`block text-xs font-black truncate ${
                sessionType === 'private' ? 'text-navy' : 'text-slate'
              }`}>
                {isEn ? 'Private Session' : 'درس خاص'}
              </span>
              <span className="block text-[10px] text-slate font-medium truncate">
                {isEn ? 'Individual student' : 'طالب فردي مستقل'}
              </span>
            </div>
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
              sessionType === 'private' ? 'border-[#0F2A4A]' : 'border-line'
            }`}>
              {sessionType === 'private' && <div className="w-2 h-2 rounded-full bg-[#0F2A4A]" />}
            </div>
          </button>
        </div>

        {/* Group Selector Mode */}
        {sessionType === 'group' && (
          <div className="p-3.5 rounded-2xl bg-page border border-line space-y-1.5 shadow-2xs">
            <label className="field-label flex items-center gap-1.5">
              <AppIcon name="book" size={14} className="text-navy" />
              <span>{isEn ? 'Target Group *' : 'المجموعة المستهدفة *'}</span>
            </label>
            <select
              value={groupId}
              onChange={(e) => {
                const gId = e.target.value;
                setGroupId(gId);
                const grp = allGroups.find((g) => g.id === gId);
                if (grp) setPricePerStudent(getEffectiveSessionPrice(null, grp));
              }}
              className="classy-select"
            >
              {allGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.subject} - {g.gradeLevel})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Private Student Selector Mode */}
        {sessionType === 'private' && (
          <div className="space-y-2">
            {selectedStudent ? (
              <div className="p-3.5 rounded-2xl bg-page border border-[#0F2A4A]/30 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <StudentAvatar
                    student={selectedStudent}
                    name={selectedStudent.name}
                    profilePhoto={selectedStudent.profilePhoto}
                    achievementFrame={selectedStudent.achievementFrame}
                    avatarColor={selectedStudent.avatarColor}
                    size="md"
                    showFrame={true}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-xs font-black text-navy truncate">
                        {selectedStudent.name}
                      </strong>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#0F2A4A]/10 text-[#0F2A4A] border border-[#0F2A4A]/20">
                        {isEn ? 'Private Student' : 'طالب درس خاص'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate truncate mt-0.5">
                      {[selectedStudent.gradeLevel, selectedStudent.phone].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedStudentId('')}
                  className="px-2.5 py-1 rounded-xl bg-line/40 hover:bg-line text-navy text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                >
                  {isEn ? 'Change' : 'تغيير الطالب'}
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-page border border-line space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="field-label flex items-center gap-1.5">
                    <AppIcon name="user" size={14} className="text-navy" />
                    <span>{isEn ? 'Select Private Student *' : 'اختر الطالب للدرس الخاص *'}</span>
                  </label>
                  <span className="text-[10px] text-slate font-medium">
                    {isEn ? `${privateStudentCandidates.length} students` : `${privateStudentCandidates.length} طالب`}
                  </span>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder={isEn ? 'Search student by name or phone...' : 'ابحث عن الطالب بالاسم أو رقم الهاتف...'}
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="classy-input text-xs ps-8"
                  />
                  <div className="absolute top-1/2 -translate-y-1/2 start-2.5 text-slate pointer-events-none">
                    <AppIcon name="search" size={13} />
                  </div>
                </div>

                {/* Students List */}
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
                  {privateStudentCandidates.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate">
                      {isEn ? 'No students found.' : 'لم يتم العثور على طلاب مطابقين.'}
                    </div>
                  ) : (
                    privateStudentCandidates.map((st) => {
                      const hasPriv = enrollments.some(
                        (e) => e.studentId === st.id && (e.serviceType === 'private' || !e.groupId) && e.status !== 'stopped'
                      ) || st.serviceType === 'private' || (st.privateDays && st.privateDays.length > 0);

                      return (
                        <div
                          key={st.id}
                          onClick={() => handleSelectStudent(st)}
                          className="p-2 rounded-xl border border-line hover:border-[#0F2A4A]/50 bg-white hover:bg-[#0F2A4A]/5 transition-all cursor-pointer flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <StudentAvatar
                              student={st}
                              name={st.name}
                              profilePhoto={st.profilePhoto}
                              achievementFrame={st.achievementFrame}
                              avatarColor={st.avatarColor}
                              size="sm"
                              showFrame={true}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-navy truncate">{st.name}</span>
                                {hasPriv && (
                                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-[#0F2A4A]/10 text-[#0F2A4A]">
                                    {isEn ? 'Private' : 'درس خاص'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate block truncate">
                                {[st.gradeLevel, st.phone].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-[#0F2A4A] shrink-0">
                            {isEn ? 'Select' : 'اختيار'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Title / Topic */}
        <div className="p-3.5 rounded-2xl bg-page border border-line space-y-1.5 shadow-2xs">
          <label className="field-label flex items-center gap-1.5">
            <AppIcon name="edit" size={14} className="text-navy" />
            <span>{isEn ? 'Topic or Lesson Title *' : 'عنوان أو موضوع الحصة *'}</span>
          </label>
          <input
            type="text"
            required
            placeholder={isEn ? 'e.g. Chapter 1 - Motion Laws & Problems' : 'مثال: الباب الأول - شرح قوانين الحركة وحل مسائل'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="classy-input"
          />
        </div>

        {/* Date & Day */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-page border border-line space-y-1 shadow-2xs">
            <label className="field-label flex items-center gap-1">
              <AppIcon name="calendar" size={13} className="text-navy" />
              <span>{isEn ? 'Date *' : 'تاريخ الحصة *'}</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="classy-input"
            />
          </div>

          <div className="p-3 rounded-2xl bg-page border border-line space-y-1 shadow-2xs">
            <label className="field-label">{isEn ? 'Session #' : 'رقم الحصة التسلسلي'}</label>
            <input
              type="number"
              min={1}
              value={sessionNumber}
              onChange={(e) => setSessionNumber(Number(e.target.value))}
              className="classy-input"
            />
          </div>
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-page border border-line space-y-1 shadow-2xs">
            <label className="field-label flex items-center gap-1">
              <AppIcon name="clock" size={13} className="text-navy" />
              <span>{isEn ? 'Start Time' : 'وقت البدء'}</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => handleTimeChange(e.target.value, endTime)}
              className="classy-input"
            />
          </div>

          <div className="p-3 rounded-2xl bg-page border border-line space-y-1 shadow-2xs">
            <label className="field-label flex items-center gap-1">
              <AppIcon name="clock" size={13} className="text-navy" />
              <span>{isEn ? 'End Time' : 'وقت الانتهاء'}</span>
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => handleTimeChange(startTime, e.target.value)}
              className="classy-input"
            />
          </div>
        </div>

        {/* Status */}
        <div className="p-3.5 rounded-2xl bg-page border border-line space-y-1.5 shadow-2xs">
          <label className="field-label">{isEn ? 'Session Status' : 'حالة الحصة'}</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="classy-select"
          >
            <option value="scheduled">{isEn ? 'Scheduled' : 'مجدولة (قادمة)'}</option>
            <option value="completed">{isEn ? 'Completed' : 'تمت واكتملت'}</option>
            <option value="cancelled">{isEn ? 'Cancelled' : 'ملغاة'}</option>
          </select>
        </div>

        {/* Extra Session Identifier */}
        <div className="p-3.5 rounded-2xl bg-page border border-line shadow-2xs">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="space-y-0.5">
              <span className="font-black text-xs text-navy flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-navy text-white text-[10px] font-black">
                  {isEn ? 'Extra' : 'إضافية'}
                </span>
                {isEn ? 'Extra / Additional Session' : 'حصة إضافية (خارج الجدول المعتاد)'}
              </span>
              <p className="text-[11px] text-slate font-medium">
                {isEn ? 'Marks this session as extra on calendar & reports' : 'تمييز هذه الحصة كحصة إضافية في تقويم الحصص وسجلات المتابعة'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={isExtraSession}
              onChange={(e) => setIsExtraSession(e.target.checked)}
              className="classy-checkbox"
            />
          </label>
        </div>

        {isHourly ? (
          <div className="p-4 rounded-2xl space-y-3 bg-mint-soft border border-line">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-navy">{isEn ? 'Hourly Billing (Group)' : 'حساب الحصة بالساعة (مجموعة بالساعة)'}</span>
              <span className="text-xs font-black text-navy">
                {isEn ? 'Total:' : 'الإجمالي:'} {multiplyMoney(hours, hourlyRate)} {t('currency')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="field-label">{isEn ? 'Duration (Hours)' : 'مدة الحصة (بالساعات)'}</label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  value={hours}
                  onChange={(e) => {
                    const h = Number(e.target.value) || 1;
                    setHours(h);
                    setPricePerStudent(multiplyMoney(h, hourlyRate));
                  }}
                  className="classy-input"
                />
              </div>

              <div>
                <label className="field-label">{isEn ? 'Hourly Rate' : 'سعر الساعة للطالب'}</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={hourlyRate}
                  onChange={(e) => {
                    const rate = Number(e.target.value) || 0;
                    setHourlyRate(rate);
                    setPricePerStudent(multiplyMoney(hours, rate));
                  }}
                  className="classy-input"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
              {[1, 1.5, 2, 2.5, 3].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setHours(val);
                    setPricePerStudent(multiplyMoney(val, hourlyRate));
                  }}
                  className={`chip flex-1 ${hours === val ? 'chip-active' : ''}`}
                >
                  {val} {isEn ? 'h' : 'س'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-page border border-line space-y-1.5 shadow-2xs">
            <label className="field-label flex items-center gap-1">
              <AppIcon name="coins" size={13} className="text-navy" />
              <span>{isEn ? 'Price per Student' : 'سعر الحصة للطالب'}</span>
            </label>
            <input
              type="number"
              step="any"
              min={0}
              value={pricePerStudent}
              onChange={(e) => setPricePerStudent(Number(e.target.value))}
              className="classy-input"
            />
          </div>
        )}

        {/* Notes */}
        <div className="p-3.5 rounded-2xl bg-page border border-line space-y-1.5 shadow-2xs">
          <label className="field-label flex items-center gap-1">
            <AppIcon name="edit" size={13} className="text-navy" />
            <span>{isEn ? 'Notes or Homework' : 'ملاحظات أو واجبات الحصة'}</span>
          </label>
          <textarea
            rows={2}
            placeholder={isEn ? 'Homework: pages 24-28...' : 'الواجب المطلوب: صفحة 24 إلى 28...'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="classy-textarea"
          />
        </div>
      </form>
    </BottomSheet>
  );
};
