import React, { useState } from 'react';
import { Student, Group, BillingType, BillingMode, PricingModifierType } from '../types';
import { db, calculateCustomEnrollmentPrice } from '../utils/storage';
import { useTranslation } from '../utils/i18n';
import { getLocalizedStageName } from '../utils/stages';
import { SegmentedControl } from './ui/SegmentedControl';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon } from './ui/AppIcon';
import {
  CanonicalWeekday,
  normalizeScheduleTimesList,
  getLocalizedWeekdayName,
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
  const [baseSessionsPerMonth, setBaseSessionsPerMonth] = useState<number>(selectedGroup?.baseSessionsPerMonth || 8);
  const [packageSessionsCount, setPackageSessionsCount] = useState<number>(selectedGroup?.packageSessionsCount || 8);
  const [pricingType, setPricingType] = useState<any>('standard');
  const [pricingValue, setPricingValue] = useState<number>(0);

  const basePrice = selectedGroup ? selectedGroup.defaultPrice : 0;
  const calculatedFinalPrice = calculateCustomEnrollmentPrice(basePrice, pricingType, pricingValue);

  const handleToggleStudent = (studentId: string) => {
    if (selectedStudentIds.includes(studentId)) {
      setSelectedStudentIds(selectedStudentIds.filter((id) => id !== studentId));
    } else {
      setSelectedStudentIds([...selectedStudentIds, studentId]);
    }
  };

  const isAlreadyEnrolled = (studentId: string, groupId: string) => {
    return db.getStudentEnrollments(studentId).some((e) => e.groupId === groupId && e.status !== 'stopped');
  };

  const filteredStudents = allStudents.filter((st) =>
    st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (st.phone && st.phone.includes(searchQuery))
  );

  const togglePrivDay = (day: CanonicalWeekday) => {
    if (privDays.includes(day)) {
      setPrivDays(privDays.filter((d) => d !== day));
    } else {
      setPrivDays([...privDays, day]);
      if (!privTimes[day] || privTimes[day].length === 0) {
        setPrivTimes((prev) => ({
          ...prev,
          [day]: [privTime || '16:00'],
        }));
      }
    }
  };

  const handleAddTimeToDay = (day: CanonicalWeekday) => {
    setPrivTimes((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), '16:00'],
    }));
  };

  const handleRemoveTimeFromDay = (day: CanonicalWeekday, index: number) => {
    setPrivTimes((prev) => {
      const list = [...(prev[day] || [])];
      list.splice(index, 1);
      return {
        ...prev,
        [day]: list.length > 0 ? list : ['16:00'],
      };
    });
  };

  const handleUpdateTimeForDay = (day: CanonicalWeekday, index: number, newTime: string) => {
    setPrivTimes((prev) => {
      const list = [...(prev[day] || [])];
      list[index] = newTime;
      return {
        ...prev,
        [day]: list,
      };
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

  if (!isOpen) return null;

  return (
    <BottomSheet
      id="enroll-existing-student"
      isOpen={isOpen}
      onClose={onClose}
      title={isGroupMode ? `${t('enrollExistingStudentTitle')}: ${targetGroup?.name}` : t('enrollExistingStudentTitle')}
      subtitle={t('enrollExistingStudentSubtitle')}
      headerLeading={
        <div className="w-10 h-10 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line">
          <AppIcon name="userCheck" size={20} weight="duotone" />
        </div>
      }
      headerTrailing={
        selectedStudentIds.length > 0 ? (
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-mint-soft text-navy border border-line">
            {selectedStudentIds.length} {isEn ? 'Selected' : 'محدد'}
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
            type="button"
            onClick={handleSave}
            disabled={selectedStudentIds.length === 0 || (enrollmentKind === 'group' && !selectedGroupId)}
            className="btn-orange flex-1"
          >
            <AppIcon name="check" size={16} weight="bold" />
            <span>{t('enrollSelectedStudentsBtn')}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-xs text-navy text-start">
        {/* Service Kind Switcher */}
        {!targetGroup && (
          <SegmentedControl<'group' | 'private_service'>
            value={enrollmentKind}
            onChange={(val) => setEnrollmentKind(val)}
            options={[
              { value: 'group', label: t('groupTypeGroup') },
              { value: 'private_service', label: t('groupTypePrivate') },
            ]}
          />
        )}

        {/* Student Picker */}
        {(!targetStudent || isGroupMode) && (
          <div className="p-3.5 rounded-2xl bg-page border border-line space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <label className="field-label mb-0">
                {t('selectExistingStudentPrompt')} ({selectedStudentIds.length}):
              </label>
              <div className="relative w-48">
                <AppIcon
                  name="search"
                  size={14}
                  className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-slate pointer-events-none`}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('search')}
                  className={`classy-input ${isRTL ? 'pr-8 pl-2.5' : 'pl-8 pr-2.5'}`}
                />
              </div>
            </div>

            <div className="max-h-44 overflow-y-auto rounded-2xl border border-line bg-mist p-1.5 space-y-1">
              {filteredStudents.length === 0 ? (
                <p className="p-3 text-center text-slate text-[11px] font-bold">{t('noStudentsFound')}</p>
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
                          ? 'bg-page opacity-50 cursor-not-allowed'
                          : isSelected
                          ? 'bg-mint-soft border border-navy text-navy font-bold shadow-2xs'
                          : 'bg-page hover:bg-mint-soft/50 border border-line'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                            isSelected
                              ? 'bg-navy border-navy text-white'
                              : 'border-line bg-page'
                          }`}
                        >
                          {isSelected && <AppIcon name="check" size={12} weight="bold" />}
                        </div>
                        <div className={isRTL ? 'text-right' : 'text-left'}>
                          <p className="font-black text-navy text-xs">{st.name}</p>
                          <p className="text-[10px] text-slate">{getLocalizedStageName(st.gradeLevel, language)}</p>
                        </div>
                      </div>

                      {alreadyEnrolled && (
                        <span className="text-[10px] bg-mint-soft text-navy border border-line px-2 py-0.5 rounded-full font-black">
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

        {/* Private Service Config */}
        {enrollmentKind === 'private_service' ? (
          <div className="p-4 rounded-2xl bg-page border border-line space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-navy font-black text-xs">
              <span className="flex items-center gap-1.5">
                <AppIcon name="sparkles" size={16} weight="fill" className="text-orange" />
                <span>{t('privateLessonSetupTitle')}</span>
              </span>
              <span className="text-[10px] bg-mint-soft px-2.5 py-0.5 rounded-full border border-line">{t('groupTypePrivate')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="field-label">{t('subjectNameLabel')} *</label>
                <input
                  type="text"
                  value={privSubject}
                  onChange={(e) => setPrivSubject(e.target.value)}
                  placeholder="Math, Science..."
                  className="classy-input"
                />
              </div>

              <div>
                <label className="field-label">{t('billingType')}</label>
                <select
                  value={privBillingMode}
                  onChange={(e) => setPrivBillingMode(e.target.value as BillingMode)}
                  className="classy-select"
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
                  <label className="field-label">{t('hourlyRateInputLabel')} *</label>
                  <input
                    type="number"
                    min="0"
                    value={privHourlyRate}
                    onChange={(e) => setPrivHourlyRate(Number(e.target.value))}
                    className="classy-input"
                  />
                </div>
              ) : privBillingMode !== 'package' ? (
                <div>
                  <label className="field-label">
                    {privBillingMode === 'monthly' ? t('monthlyFeeLabel') : t('perSessionRateLabel')} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={privPrice}
                    onChange={(e) => setPrivPrice(Number(e.target.value))}
                    className="classy-input"
                  />
                </div>
              ) : (
                <div>
                  <label className="field-label">{t('packageTotalFeeLabel')} *</label>
                  <input
                    type="number"
                    min="0"
                    value={privPackagePrice}
                    onChange={(e) => setPrivPackagePrice(Number(e.target.value))}
                    placeholder="e.g., 900"
                    className="classy-input"
                  />
                </div>
              )}
            </div>

            {privBillingMode === 'package' && (
              <div className="p-3 bg-mint-soft rounded-2xl border border-line space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="field-label mb-0">{t('packageSessionsNumberLabel')}</label>
                  <div className="flex items-center gap-1 w-24">
                    <input
                      type="number"
                      min="1"
                      value={privPackageSessions}
                      onChange={(e) => setPrivPackageSessions(Math.max(1, Number(e.target.value)))}
                      className="classy-input text-center"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-navy pt-1 border-t border-line">
                  <span>{t('perSessionRateLabel')}:</span>
                  <span>
                    {privPackageSessions > 0 ? Math.round(privPackagePrice / privPackageSessions) : 0} {t('currency')}
                  </span>
                </div>
              </div>
            )}

            {/* Schedule Days */}
            <div className="space-y-2 pt-1 border-t border-line">
              <label className="field-label">{t('scheduleDays')}:</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as CanonicalWeekday[]).map((key) => {
                  const isDayChecked = privDays.includes(key);
                  const localizedName = getLocalizedWeekdayName(key, isRTL);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => togglePrivDay(key)}
                      className={`chip ${isDayChecked ? 'chip-active' : ''}`}
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
                        className="p-2.5 rounded-xl bg-page border border-line space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-navy flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-navy" />
                            {localizedDay}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddTimeToDay(dayKey)}
                            className="text-[10px] font-bold text-navy hover:underline flex items-center gap-1"
                          >
                            <AppIcon name="plus" size={10} />
                            <span>{isEn ? 'Add Time Slot' : 'إضافة موعد'}</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {dayTimes.map((tm, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <input
                                type="time"
                                value={tm}
                                onChange={(e) => handleUpdateTimeForDay(dayKey, idx, e.target.value)}
                                className="classy-input w-28 text-center"
                              />
                              {dayTimes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTimeFromDay(dayKey, idx)}
                                  className="p-1 rounded-lg hover:bg-coral-soft text-coral transition-colors"
                                >
                                  <AppIcon name="close" size={12} />
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
          /* Group Enrollment Mode */
          <>
            {!targetGroup && (
              <div className="p-3.5 rounded-2xl bg-page border border-line space-y-1.5 shadow-2xs">
                <label className="field-label">{isEn ? 'Select Group:' : 'اختر المجموعة:'}</label>
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
                      {g.name} ({g.type === 'private' ? (isEn ? 'Private' : 'درس خاص') : (isEn ? 'Group' : 'مجموعة')}) - {isEn ? 'Default' : 'الافتراضي'}: {g.defaultPrice} {t('currency')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Billing Mode & Custom Price */}
            <div className="p-4 rounded-2xl bg-page border border-line space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="font-black text-navy text-xs block">{isEn ? 'Billing Mode:' : 'نظام الفوترة:'}</label>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-mint-soft text-navy">
                  {billingMode === 'monthly'
                    ? (isEn ? 'Monthly' : 'شهري')
                    : billingMode === 'package'
                    ? (isEn ? 'Package' : 'باقة')
                    : perSessionSubMode === 'prepaid'
                    ? (isEn ? 'Prepaid' : 'مسبق الدفع')
                    : (isEn ? 'Postpaid' : 'آجل / بالحصة')}
                </span>
              </div>

              {/* Pricing Customization */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-line">
                <div>
                  <label className="field-label">{isEn ? 'Pricing Plan:' : 'نظام التسعير:'}</label>
                  <select
                    value={pricingType}
                    onChange={(e) => setPricingType(e.target.value as PricingModifierType)}
                    className="classy-select"
                  >
                    <option value="standard">{t('pricingInheritGroup')} ({basePrice} {t('currency')})</option>
                    <option value="custom_fixed">{t('pricingCustomFixed')}</option>
                    <option value="discount_percent">{t('pricingDiscountPercent')}</option>
                    <option value="discount_fixed">{t('pricingDiscountAmount')}</option>
                    <option value="scholarship">{isEn ? 'Scholarship / Free' : 'منحة / إعفاء كامل'}</option>
                  </select>
                </div>

                {pricingType !== 'standard' && pricingType !== 'scholarship' && (
                  <div>
                    <label className="field-label">{isEn ? 'Value:' : 'القيمة:'}</label>
                    <input
                      type="number"
                      min="0"
                      value={pricingValue}
                      onChange={(e) => setPricingValue(Number(e.target.value))}
                      className="classy-input"
                    />
                  </div>
                )}
              </div>

              {/* Final Calculated Preview */}
              <div className="p-3 bg-mint-soft rounded-2xl border border-line flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate block">{t('calculatedEffectivePrice')}</span>
                <span className="font-black text-base text-navy">
                  {calculatedFinalPrice} {t('currency')}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
};
