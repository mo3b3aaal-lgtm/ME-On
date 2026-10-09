import React, { useState } from 'react';
import {
  X,
  UserCheck,
  Search,
  Check,
  AlertCircle,
  Plus,
  Percent,
  DollarSign,
  Layers,
  Sparkles,
  Calculator,
  BookOpen,
  Clock,
  Trash2,
} from 'lucide-react';
import { Student, Group, Enrollment, BillingType, BillingMode, PricingModifierType } from '../types';
import { db, calculateCustomEnrollmentPrice, getBillingModeLabel } from '../utils/storage';
import { useTranslation } from '../utils/i18n';
import { getLocalizedStageName } from '../utils/stages';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import {
  CanonicalWeekday,
  normalizeScheduleDays,
  normalizeScheduleTimes,
  normalizeScheduleTimesList,
  getLocalizedWeekdayName,
  getLocalizedSubjectName,
  getLocalizedLocationName,
} from '../utils/schedule';

interface EnrollExistingStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetGroup?: Group | null;
  targetStudent?: Student | null;
  allStudents: Student[];
  allGroups: Group[];
  onEnrollmentComplete: () => void;
}

export const EnrollExistingStudentModal: React.FC<EnrollExistingStudentModalProps> = ({
  isOpen,
  onClose,
  targetGroup,
  targetStudent,
  allStudents,
  allGroups,
  onEnrollmentComplete,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
  const isGroupMode = Boolean(targetGroup);

  // Tab: Group enrollment VS New Independent Private Service
  const [enrollmentKind, setEnrollmentKind] = useState<'group' | 'private_service'>(
    targetGroup?.type === 'private' ? 'private_service' : 'group'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    targetStudent ? [targetStudent.id] : []
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    targetGroup ? targetGroup.id : (allGroups[0]?.id || '')
  );

  // Private direct configuration
  const [privSubject, setPrivSubject] = useState(isEn ? 'Mathematics' : 'رياضيات');
  const [privPrice, setPrivPrice] = useState<number>(150);
  const [privHourlyRate, setPrivHourlyRate] = useState<number>(150);
  const [privBillingMode, setPrivBillingMode] = useState<BillingMode>('prepaid');
  const [privPackageSessions, setPrivPackageSessions] = useState<number>(10);
  const [privPackagePrice, setPrivPackagePrice] = useState<number>(900);
  const [privDays, setPrivDays] = useState<CanonicalWeekday[]>(['saturday']);
  const [privTime, setPrivTime] = useState('16:00');
  const [privTimes, setPrivTimes] = useState<Record<CanonicalWeekday, string[]>>({
    saturday: ['16:00'],
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
  });
  const [privLocation, setPrivLocation] = useState(isEn ? "Student's Home / Online" : 'منزل الطالب / أونلاين');

  const regularGroups = allGroups.filter((g) => g.type !== 'private');
  const selectedGroup = allGroups.find((g) => g.id === selectedGroupId) || targetGroup;

  // Billing system & pricing customization for group enrollment
  const [billingMode, setBillingMode] = useState<BillingMode>(
    (selectedGroup?.billingMode || (selectedGroup?.billingType === 'per_session' ? 'prepaid' : selectedGroup?.billingType)) as BillingMode || 'monthly'
  );
  const [perSessionSubMode, setPerSessionSubMode] = useState<'prepaid' | 'postpaid'>(
    selectedGroup?.billingMode === 'postpaid' || selectedGroup?.billingType === 'postpaid' ? 'postpaid' : 'prepaid'
  );
  const [groupHourlyRate, setGroupHourlyRate] = useState<number>(selectedGroup?.hourlyRate || 150);
  const [pricingType, setPricingType] = useState<PricingModifierType>('same_as_group');
  const [pricingValue, setPricingValue] = useState<number>(0);
  const [baseSessionsPerMonth, setBaseSessionsPerMonth] = useState<number>(
    selectedGroup?.baseSessionsPerMonth || 8
  );
  const [packageSessionsCount, setPackageSessionsCount] = useState<number>(8);

  const basePrice = selectedGroup?.defaultPrice || 0;
  const calculatedFinalPrice = calculateCustomEnrollmentPrice(basePrice, pricingType, pricingValue);

  // Existing enrollments
  const existingEnrollments = db.getEnrollments();

  const filteredStudents = allStudents.filter((student) => {
    const matchesQuery =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.phone && student.phone.includes(searchQuery)) ||
      (student.gradeLevel && student.gradeLevel.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesQuery;
  });

  const isAlreadyEnrolled = (studentId: string, groupId: string) => {
    return existingEnrollments.some(
      (e) => e.studentId === studentId && e.groupId === groupId && e.status !== 'stopped'
    );
  };

  const handleToggleStudent = (studentId: string) => {
    if (selectedStudentIds.includes(studentId)) {
      setSelectedStudentIds(selectedStudentIds.filter((id) => id !== studentId));
    } else {
      setSelectedStudentIds([...selectedStudentIds, studentId]);
    }
  };

  const togglePrivDay = (day: CanonicalWeekday) => {
    if (privDays.includes(day)) {
      if (privDays.length > 1) setPrivDays(privDays.filter((d) => d !== day));
    } else {
      setPrivDays([...privDays, day]);
      if (!privTimes[day] || privTimes[day].length === 0) {
        setPrivTimes((prev) => ({ ...prev, [day]: [privTime || '16:00'] }));
      }
    }
  };

  const handlePrivDayTimeChange = (day: CanonicalWeekday, timeIdx: number, timeVal: string) => {
    setPrivTimes((prev) => {
      const currentList = prev[day] ? [...prev[day]] : ['16:00'];
      currentList[timeIdx] = timeVal;
      return { ...prev, [day]: currentList };
    });
  };

  const handleAddPrivDayTime = (day: CanonicalWeekday) => {
    setPrivTimes((prev) => {
      const currentList = prev[day] ? [...prev[day]] : ['16:00'];
      const lastTime = currentList[currentList.length - 1] || '16:00';
      const [h, m] = lastTime.split(':').map(Number);
      const nextH = !isNaN(h) ? Math.min(23, (h + 3) % 24) : 19;
      const nextTimeStr = `${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
      return { ...prev, [day]: [...currentList, nextTimeStr] };
    });
  };

  const handleRemovePrivDayTime = (day: CanonicalWeekday, timeIdx: number) => {
    setPrivTimes((prev) => {
      const currentList = prev[day] ? [...prev[day]] : ['16:00'];
      if (currentList.length <= 1) return prev;
      const updated = currentList.filter((_, idx) => idx !== timeIdx);
      return { ...prev, [day]: updated };
    });
  };

  const handleSave = () => {
    if (selectedStudentIds.length === 0) return;

    if (enrollmentKind === 'private_service') {
      const isPkg = privBillingMode === 'package';
      const isHr = privBillingMode === 'hourly';

      const cleanPrivTimes: Record<string, string[]> = {};
      privDays.forEach((d) => {
        const list = normalizeScheduleTimesList(privTimes[d] || [privTime || '16:00']);
        cleanPrivTimes[d] = list.length > 0 ? list : ['16:00'];
      });

      const primaryTime = privDays.length > 0 && cleanPrivTimes[privDays[0]]?.[0]
        ? cleanPrivTimes[privDays[0]][0]
        : (privTime.trim() || '16:00');

      for (const studentId of selectedStudentIds) {
        db.createPrivateLessonService(studentId, {
          subject: privSubject.trim() || t('groupTypePrivate'),
          sessionPrice: isPkg ? (Number(privPackagePrice) || 900) : (Number(privPrice) || 100),
          hourlyRate: isHr ? (Number(privHourlyRate) || 150) : undefined,
          billingType: privBillingMode as BillingType,
          billingMode: privBillingMode,
          packageSessionsCount: isPkg ? (Number(privPackageSessions) || 10) : undefined,
          packagePrice: isPkg ? (Number(privPackagePrice) || 900) : undefined,
          scheduleDays: privDays,
          scheduleTime: primaryTime,
          scheduleTimes: cleanPrivTimes,
          roomOrLocation: privLocation,
        });
      }
    } else {
      if (!selectedGroupId) return;

      const resolvedBillingMode: BillingMode = 
        billingMode === 'prepaid' || billingMode === 'postpaid' 
          ? perSessionSubMode 
          : billingMode;

      const resolvedBillingType: BillingType = resolvedBillingMode;

      for (const studentId of selectedStudentIds) {
        db.enrollStudent(studentId, selectedGroupId, {
          serviceType: selectedGroup?.type || 'group',
          billingType: resolvedBillingType,
          billingMode: resolvedBillingMode,
          hourlyRate: resolvedBillingMode === 'hourly' ? (Number(groupHourlyRate) || 150) : undefined,
          pricingType,
          pricingValue,
          customPrice: calculatedFinalPrice,
          baseSessionsPerMonth: resolvedBillingMode === 'monthly' ? baseSessionsPerMonth : undefined,
          packageSessionsCount: resolvedBillingMode === 'package' ? packageSessionsCount : undefined,
          status: 'active',
        });
      }
    }

    onEnrollmentComplete();
    onClose();
  };

  const modalLayer = useModalLayer('enroll-existing-student', isOpen, onClose);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#17375E]/65 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-t-[28px] sm:rounded-[28px] max-w-lg w-full mx-auto max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Signature Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#17375E] via-[#0F2A4A] to-[#5F7083] text-[#FFFFFF] flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#FFFFFF]/15 backdrop-blur-md border border-[#E1EBEC]/25 flex items-center justify-center text-[#FFFFFF] shadow-sm shrink-0">
              <UserCheck className="w-5 h-5 text-[#FFFFFF]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-[#FFFFFF] tracking-tight truncate">
                {isGroupMode ? `${t('enrollExistingStudentTitle')}: ${targetGroup?.name}` : t('enrollExistingStudentTitle')}
              </h2>
              <p className="text-xs text-[#E1EBEC]/85 font-medium truncate">
                {t('enrollExistingStudentSubtitle')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 text-[#FFFFFF] border border-[#E1EBEC]/20 transition-all cursor-pointer relative z-10 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto android-scrollbar flex-1 space-y-4 text-xs text-[#0F2A4A]">
          
          {/* Service Kind Switcher (if not fixed by targetGroup) */}
          {!targetGroup && (
            <div className="classy-card p-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEnrollmentKind('group')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 font-black text-xs cursor-pointer ${
                  enrollmentKind === 'group'
                    ? 'bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] shadow-xs'
                    : 'text-[#5F7083] hover:bg-[#E1EBEC]/25'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{t('groupTypeGroup')}</span>
              </button>

              <button
                type="button"
                onClick={() => setEnrollmentKind('private_service')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 font-black text-xs cursor-pointer ${
                  enrollmentKind === 'private_service'
                    ? 'bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] shadow-xs'
                    : 'text-[#5F7083] hover:bg-[#E1EBEC]/25'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#E1EBEC]" />
                <span>{t('groupTypePrivate')}</span>
              </button>
            </div>
          )}

          {/* Student Picker if in Group Mode or multiple select */}
          {(!targetStudent || isGroupMode) && (
            <div className="classy-card p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="font-black text-xs text-[#0F2A4A]">
                  {t('selectExistingStudentPrompt')} ({selectedStudentIds.length}):
                </label>
                <div className="relative w-44">
                  <Search className={`w-3.5 h-3.5 absolute ${isRTL ? 'right-2.5' : 'left-2.5'} top-2.5 text-[#5F7083]`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search')}
                    className={`w-full ${isRTL ? 'pr-8 pl-2' : 'pl-8 pr-2'} py-1.5 rounded-xl bg-[#E1EBEC]/15 border border-[#E1EBEC] text-[11px] text-[#0F2A4A] focus:outline-none focus:border-[#17375E] focus:bg-[#FFFFFF] font-bold`}
                  />
                </div>
              </div>

              <div className="max-h-44 overflow-y-auto rounded-2xl border border-[#E1EBEC] bg-[#E1EBEC]/15 p-1.5 space-y-1">
                {filteredStudents.length === 0 ? (
                  <p className="p-3 text-center text-[#5F7083] text-[11px] font-bold">{t('noStudentsFound')}</p>
                ) : (
                  filteredStudents.map((st) => {
                    const alreadyEnrolled = enrollmentKind === 'group' && isAlreadyEnrolled(st.id, selectedGroupId);
                    const isSelected = selectedStudentIds.includes(st.id);

                    return (
                      <button
                        key={st.id}
                        type="button"
                        disabled={alreadyEnrolled}
                        onClick={() => handleToggleStudent(st.id)}
                        className={`w-full p-2 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                          alreadyEnrolled
                            ? 'bg-[#E1EBEC]/30 opacity-50 cursor-not-allowed'
                            : isSelected
                            ? 'bg-[#E1EBEC]/60 border border-[#17375E]'
                            : 'bg-[#FFFFFF] hover:bg-[#E1EBEC]/35 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                              isSelected
                                ? 'bg-[#17375E] border-[#17375E] text-[#FFFFFF]'
                                : 'border-[#E1EBEC] bg-[#FFFFFF]'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className={isRTL ? 'text-right' : 'text-left'}>
                            <p className="font-black text-[#0F2A4A] text-xs">{st.name}</p>
                            <p className="text-[10px] text-[#5F7083]">{getLocalizedStageName(st.gradeLevel, language)}</p>
                          </div>
                        </div>

                        {alreadyEnrolled && (
                          <span className="text-[10px] bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC] px-2 py-0.5 rounded-full font-black">
                            {t('alreadyEnrolledInGroup')}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Section 1: When creating Independent Private Service */}
          {enrollmentKind === 'private_service' ? (
            <div className="classy-card p-4 space-y-3.5">
              <div className="flex items-center justify-between text-[#17375E] font-black text-xs">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>{t('privateLessonSetupTitle')}</span>
                </span>
                <span className="text-[10px] bg-[#E1EBEC]/25 px-2.5 py-0.5 rounded-full">{t('groupTypePrivate')}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-[#5F7083] mb-1 font-bold">{t('subjectNameLabel')} *</label>
                  <input
                    type="text"
                    value={privSubject}
                    onChange={(e) => setPrivSubject(e.target.value)}
                    placeholder="Math, Science..."
                    className="classy-input font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#5F7083] mb-1 font-bold">{t('billingType')}</label>
                  <select
                    value={privBillingMode}
                    onChange={(e) => setPrivBillingMode(e.target.value as BillingMode)}
                    className="classy-select font-bold"
                  >
                    <option value="prepaid">{t('billingPrepaid')}</option>
                    <option value="postpaid">{t('billingPostpaid')}</option>
                    <option value="package">{t('billingPackage')}</option>
                    <option value="monthly">{t('billingMonthly')}</option>
                    <option value="hourly">{t('billingHourly')}</option>
                  </select>
                </div>

                {privBillingMode === 'hourly' ? (
                  <div>
                    <label className="block text-[11px] text-[#5F7083] mb-1 font-bold">{t('hourlyRateInputLabel')} *</label>
                    <input
                      type="number"
                      min="0"
                      value={privHourlyRate}
                      onChange={(e) => setPrivHourlyRate(Number(e.target.value))}
                      className="classy-input font-bold"
                    />
                  </div>
                ) : privBillingMode !== 'package' ? (
                  <div>
                    <label className="block text-[11px] text-[#5F7083] mb-1 font-bold">
                      {privBillingMode === 'monthly' ? t('monthlyFeeLabel') : t('perSessionRateLabel')} *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={privPrice}
                      onChange={(e) => setPrivPrice(Number(e.target.value))}
                      className="classy-input font-bold"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] text-[#5F7083] mb-1 font-bold">{t('packageTotalFeeLabel')} *</label>
                    <input
                      type="number"
                      min="0"
                      value={privPackagePrice}
                      onChange={(e) => setPrivPackagePrice(Number(e.target.value))}
                      placeholder="e.g., 900"
                      className="classy-input font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Package Sessions Presets & Count for Private */}
              {privBillingMode === 'package' && (
                <div className="p-3 bg-[#E1EBEC]/15 rounded-2xl border border-[#E1EBEC] space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-[#0F2A4A]">{t('packageSessionsNumberLabel')}</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="1"
                        value={privPackageSessions}
                        onChange={(e) => setPrivPackageSessions(Math.max(1, Number(e.target.value)))}
                        className="w-16 bg-[#FFFFFF] border border-[#E1EBEC] rounded-xl p-1 text-xs font-black text-[#0F2A4A] text-center focus:outline-none focus:border-[#17375E]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[5, 8, 10, 15, 20].map((count) => {
                      const isSel = privPackageSessions === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setPrivPackageSessions(count)}
                          className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            isSel
                              ? 'bg-[#17375E] text-[#FFFFFF] shadow-xs'
                              : 'bg-[#FFFFFF] text-[#5F7083] border border-[#E1EBEC] hover:border-[#17375E]'
                          }`}
                        >
                          {count} {t('navSessions')}
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-2.5 bg-[#E1EBEC]/40 rounded-xl flex items-center justify-between text-xs text-[#0F2A4A] font-black border border-[#E1EBEC]">
                    <span>{t('calculatedEffectivePrice')}</span>
                    <span className="text-sm text-[#0F2A4A]">
                      {privPackageSessions > 0 ? Math.round(privPackagePrice / privPackageSessions) : 0} {t('currency')} / {t('sessionPrice')}
                    </span>
                  </div>
                </div>
              )}

              {/* Schedule days & Per-Day Times */}
              <div className="space-y-2 pt-1 border-t border-[#E1EBEC]">
                <label className="block text-[11px] font-black text-[#0F2A4A]">{t('scheduleDays')}:</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {([
                    { key: 'saturday', labelKey: 'daySat' },
                    { key: 'sunday', labelKey: 'daySun' },
                    { key: 'monday', labelKey: 'dayMon' },
                    { key: 'tuesday', labelKey: 'dayTue' },
                    { key: 'wednesday', labelKey: 'dayWed' },
                    { key: 'thursday', labelKey: 'dayThu' },
                    { key: 'friday', labelKey: 'dayFri' },
                  ] as { key: CanonicalWeekday; labelKey: string }[]).map(({ key, labelKey }) => {
                    const isDayChecked = privDays.includes(key);
                    const localizedName = getLocalizedWeekdayName(key, isRTL);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePrivDay(key)}
                        className={`px-3 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          isDayChecked
                            ? 'bg-[#17375E] text-[#FFFFFF] border-[#17375E]'
                            : 'bg-[#FFFFFF] text-[#5F7083] border-[#E1EBEC]'
                        }`}
                      >
                        {localizedName}
                      </button>
                    );
                  })}
                </div>

                {privDays.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {privDays.map((dayKey) => {
                      const dayTimes = privTimes[dayKey] && privTimes[dayKey].length > 0 ? privTimes[dayKey] : ['16:00'];
                      const localizedDay = getLocalizedWeekdayName(dayKey, isRTL);
                      return (
                        <div
                          key={dayKey}
                          className="p-2.5 rounded-xl bg-[#E1EBEC]/15 border border-[#E1EBEC] space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-[#0F2A4A] flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#17375E]"></span>
                              {localizedDay}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddPrivDayTime(dayKey)}
                              className="text-[10px] font-bold text-[#17375E] hover:text-[#0F2A4A] flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#E1EBEC]/25 hover:bg-[#E1EBEC]/40 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>{isRTL ? 'إضافة موعد آخر' : 'Add another time'}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {dayTimes.map((tVal, tIdx) => (
                              <div
                                key={`${dayKey}_${tIdx}`}
                                className="flex items-center gap-1 bg-[#FFFFFF] border border-[#E1EBEC] rounded-lg px-2.5 py-1 shadow-2xs"
                              >
                                <Clock className="w-3.5 h-3.5 text-[#17375E]" />
                                <input
                                  type="time"
                                  value={tVal}
                                  onChange={(e) => handlePrivDayTimeChange(dayKey, tIdx, e.target.value)}
                                  className="bg-transparent text-xs font-black text-[#0F2A4A] focus:outline-none cursor-pointer"
                                />
                                {dayTimes.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePrivDayTime(dayKey, tIdx)}
                                    className="p-0.5 rounded text-[#5F7083] hover:text-[#0F2A4A] transition-colors ml-0.5 cursor-pointer"
                                    title={isRTL ? 'حذف هذا الموعد' : 'Remove time'}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Group Picker if not fixed */}
              {!targetGroup && (
                <div className="classy-card p-3.5 space-y-1.5">
                  <label className="font-black text-xs text-[#0F2A4A]">{t('selectGroupsPrompt')}</label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => {
                      setSelectedGroupId(e.target.value);
                      const grp = allGroups.find((g) => g.id === e.target.value);
                      if (grp) {
                        const mode = (grp.billingMode || (grp.billingType === 'per_session' ? 'prepaid' : grp.billingType)) as BillingMode;
                        setBillingMode(mode || 'monthly');
                        if (mode === 'prepaid' || mode === 'postpaid') {
                          setPerSessionSubMode(mode);
                        }
                        setBaseSessionsPerMonth(grp.baseSessionsPerMonth || 8);
                      }
                    }}
                    className="w-full classy-select"
                  >
                    {allGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.type === 'private' ? t('groupTypePrivate') : t('groupTypeGroup')}) - {t('defaultPrice')}: {g.defaultPrice} {t('currency')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Billing System Selection */}
              <div className="classy-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-black text-[#0F2A4A] text-xs block">{t('billingMode')}:</label>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#E1EBEC]/25 text-[#0F2A4A]">
                    {billingMode === 'monthly'
                      ? t('billingMonthly')
                      : billingMode === 'package'
                      ? t('billingPackage')
                      : perSessionSubMode === 'prepaid'
                      ? t('billingPrepaid')
                      : t('billingPostpaid')}
                  </span>
                </div>
                
                {/* Primary Billing Categories */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setBillingMode('monthly')}
                    className={`py-2 px-1 rounded-xl text-center font-black text-xs transition-all cursor-pointer ${
                      billingMode === 'monthly'
                        ? 'bg-[#17375E] text-[#FFFFFF] shadow-xs'
                        : 'text-[#5F7083] hover:bg-[#E1EBEC]/35'
                    }`}
                  >
                    {t('billingMonthly')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBillingMode('prepaid');
                    }}
                    className={`py-2 px-1 rounded-xl text-center font-black text-xs transition-all cursor-pointer ${
                      billingMode === 'prepaid' || billingMode === 'postpaid'
                        ? 'bg-[#17375E] text-[#FFFFFF] shadow-xs'
                        : 'text-[#5F7083] hover:bg-[#E1EBEC]/35'
                    }`}
                  >
                    {t('billingPerSession')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setBillingMode('package')}
                    className={`py-2 px-1 rounded-xl text-center font-black text-xs transition-all cursor-pointer ${
                      billingMode === 'package'
                        ? 'bg-[#17375E] text-[#FFFFFF] shadow-xs'
                        : 'text-[#5F7083] hover:bg-[#E1EBEC]/35'
                    }`}
                  >
                    {t('billingPackage')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setBillingMode('hourly')}
                    className={`py-2 px-1 rounded-xl text-center font-black text-xs transition-all cursor-pointer ${
                      billingMode === 'hourly'
                        ? 'bg-[#17375E] text-[#FFFFFF] shadow-xs'
                        : 'text-[#5F7083] hover:bg-[#E1EBEC]/35'
                    }`}
                  >
                    {t('billingHourly')}
                  </button>
                </div>

                {billingMode === 'hourly' && (
                  <div className="flex items-center justify-between pt-1 text-[11px] text-[#5F7083] font-bold">
                    <span>{t('hourlyRateInputLabel')} ({t('currency')} / hr):</span>
                    <input
                      type="number"
                      min="0"
                      value={groupHourlyRate}
                      onChange={(e) => setGroupHourlyRate(Number(e.target.value) || 0)}
                      className="w-24 p-1.5 text-center font-black bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-xl text-xs text-[#0F2A4A]"
                    />
                  </div>
                )}

                {/* Sub-modes for Per Session Billing: Prepaid vs Postpaid */}
                {(billingMode === 'prepaid' || billingMode === 'postpaid') && (
                  <div className="p-3 bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl space-y-2 animate-in fade-in duration-150">
                    <span className="text-[11px] font-black text-[#5F7083] block">
                      {t('billingMode')}:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPerSessionSubMode('prepaid');
                          setBillingMode('prepaid');
                        }}
                        className={`p-2.5 rounded-xl border text-right font-black text-xs transition-all cursor-pointer ${
                          perSessionSubMode === 'prepaid'
                            ? 'bg-[#FFFFFF] border-[#17375E] text-[#0F2A4A] ring-1 ring-[#17375E] shadow-xs'
                            : 'bg-[#FFFFFF]/60 border-[#E1EBEC] text-[#5F7083] hover:bg-[#FFFFFF]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-black text-[#0F2A4A] text-xs">1. {t('billingPrepaid')}</span>
                          <span className="w-2 h-2 rounded-full bg-[#17375E]"></span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPerSessionSubMode('postpaid');
                          setBillingMode('postpaid');
                        }}
                        className={`p-2.5 rounded-xl border text-right font-black text-xs transition-all cursor-pointer ${
                          perSessionSubMode === 'postpaid'
                            ? 'bg-[#FFFFFF] border-[#17375E] text-[#0F2A4A] ring-1 ring-[#17375E] shadow-xs'
                            : 'bg-[#FFFFFF]/60 border-[#E1EBEC] text-[#5F7083] hover:bg-[#FFFFFF]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-black text-[#0F2A4A] text-xs">2. {t('billingPostpaid')}</span>
                          <span className="w-2 h-2 rounded-full bg-[#0F2A4A]"></span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {billingMode === 'monthly' && (
                  <div className="flex items-center justify-between pt-1 text-[11px] text-[#5F7083] font-bold">
                    <span>{t('baseSessionsPerMonth')}:</span>
                    <input
                      type="number"
                      min="1"
                      value={baseSessionsPerMonth}
                      onChange={(e) => setBaseSessionsPerMonth(Math.max(1, Number(e.target.value)))}
                      className="w-16 p-1.5 text-center font-black bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-xl text-xs text-[#0F2A4A]"
                    />
                  </div>
                )}

                {billingMode === 'package' && (
                  <div className="flex items-center justify-between pt-1 text-[11px] text-[#5F7083] font-bold">
                    <span>{t('packageSessionsCount')}:</span>
                    <input
                      type="number"
                      min="1"
                      value={packageSessionsCount}
                      onChange={(e) => setPackageSessionsCount(Math.max(1, Number(e.target.value)))}
                      className="w-16 p-1.5 text-center font-black bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-xl text-xs text-[#0F2A4A]"
                    />
                  </div>
                )}
              </div>

              {/* Customizable Pricing Options */}
              <div className="classy-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-black text-xs text-[#0F2A4A]">{t('pricingCustomizationTitle')}</label>
                  <span className="text-[11px] text-[#5F7083] font-bold">{t('defaultPrice')}: {basePrice} {t('currency')}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setPricingType('same_as_group');
                      setPricingValue(0);
                    }}
                    className={`p-2 rounded-xl border text-center font-black text-[11px] transition-all cursor-pointer ${
                      pricingType === 'same_as_group'
                        ? 'bg-[#17375E] text-[#FFFFFF] border-[#17375E] shadow-xs'
                        : 'text-[#5F7083] hover:bg-[#E1EBEC]/35 border-transparent'
                    }`}
                  >
                    {t('pricingInheritGroup')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPricingType('fixed_discount')}
                    className={`p-2 rounded-xl border text-center font-black text-[11px] transition-all cursor-pointer ${
                      pricingType === 'fixed_discount'
                        ? 'bg-[#17375E] text-[#FFFFFF] border-[#17375E] shadow-xs'
                        : 'text-[#5F7083] hover:bg-[#E1EBEC]/35 border-transparent'
                    }`}
                  >
                    {t('pricingDiscountAmount')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPricingType('percentage_discount')}
                    className={`p-2 rounded-xl border text-center font-black text-[11px] transition-all cursor-pointer ${
                      pricingType === 'percentage_discount'
                        ? 'bg-[#17375E] text-[#FFFFFF] border-[#17375E] shadow-xs'
                        : 'text-[#5F7083] hover:bg-[#E1EBEC]/35 border-transparent'
                    }`}
                  >
                    {t('pricingDiscountPercent')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPricingType('custom_price');
                      if (!pricingValue) setPricingValue(basePrice);
                    }}
                    className={`p-2 rounded-xl border text-center font-black text-[11px] transition-all cursor-pointer ${
                      pricingType === 'custom_price'
                        ? 'bg-[#17375E] text-[#FFFFFF] border-[#17375E] shadow-xs'
                        : 'text-[#5F7083] hover:bg-[#E1EBEC]/35 border-transparent'
                    }`}
                  >
                    {t('pricingCustomFixed')}
                  </button>
                </div>

                {/* Value Input for Modifier */}
                {pricingType !== 'same_as_group' && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-black text-[#5F7083]">
                      {pricingType === 'fixed_discount' && `${t('pricingDiscountAmount')}:`}
                      {pricingType === 'percentage_discount' && `${t('pricingDiscountPercent')}:`}
                      {pricingType === 'custom_price' && `${t('pricingCustomFixed')}:`}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={pricingValue || ''}
                        onChange={(e) => setPricingValue(Math.max(0, Number(e.target.value)))}
                        className="classy-input font-black text-sm"
                      />
                      <span className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-2.5 font-bold text-xs text-[#5F7083]`}>
                        {pricingType.includes('percentage') ? '%' : t('currency')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Permanent Calculation Preview Box */}
                <div className="p-3 bg-[#E1EBEC]/40 rounded-2xl border border-[#E1EBEC] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-[#5F7083] block">{t('calculatedEffectivePrice')}</span>
                  </div>
                  <div className="font-black text-base text-[#17375E]">
                    {calculatedFinalPrice} {t('currency')}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={selectedStudentIds.length === 0 || (enrollmentKind === 'group' && !selectedGroupId)}
              className="btn-primary flex-1"
            >
              <Check className="w-4 h-4" />
              <span>{t('enrollSelectedStudentsBtn')}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
    </ModalPortal>
  );
};
