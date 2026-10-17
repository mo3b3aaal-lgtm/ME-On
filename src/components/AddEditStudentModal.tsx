import React, { useState, useEffect, useRef } from 'react';
import { Student, Group, BillingMode, BillingType, AchievementFrame, Enrollment } from '../types';
import { db } from '../utils/storage';
import { compressImage } from '../utils/imageCompressor';
import { StudentAvatar } from './StudentAvatar';
import { AchievementFrameSelector } from './AchievementFrameSelector';
import { GRADE_STAGES, ALL_GRADE_OPTIONS, getStageByGrade, getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { SegmentedControl } from './ui/SegmentedControl';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon } from './ui/AppIcon';
import {
  CANONICAL_WEEKDAY_KEYS,
  normalizeWeekdayKey,
  normalizeScheduleDays,
  normalizeScheduleTimes,
  getLocalizedWeekdayName,
  getStudentEffectiveSchedule,
} from '../utils/schedule';

interface AddEditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingStudent?: Student | null;
  defaultGroupId?: string;
  allGroups: Group[];
  onSaveComplete: (savedStudent: Student) => void;
  zIndex?: number;
}

interface ScheduleSlotItem {
  id: string;
  day: string; // canonical key, e.g. 'monday', 'saturday'
  time: string; // e.g. '16:00'
}

const AVATAR_COLORS = [
  'navy',
  'teal',
  'slate',
];

export const AddEditStudentModal: React.FC<AddEditStudentModalProps> = ({
  isOpen,
  onClose,
  editingStudent,
  defaultGroupId,
  allGroups,
  onSaveComplete,
  zIndex,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [school, setSchool] = useState('');
  const [gradeLevel, setGradeLevel] = useState('الصف الأول الثانوي');
  const [selectedStageId, setSelectedStageId] = useState<string>('secondary');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [avatarColor, setAvatarColor] = useState('navy');
  const [profilePhoto, setProfilePhoto] = useState<string | undefined>(undefined);
  const [achievementFrame, setAchievementFrame] = useState<AchievementFrame | undefined>('none');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [notes, setNotes] = useState('');

  // Subscriptions & Groups selection
  const [subscriptionMode, setSubscriptionMode] = useState<'group' | 'private' | 'both' | 'none'>('group');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Private lesson configuration
  const [privateSubject, setPrivateSubject] = useState('الرياضيات');
  const [privatePrice, setPrivatePrice] = useState<number>(100);
  const [privateHourlyRate, setPrivateHourlyRate] = useState<number>(150);
  const [privateBillingMode, setPrivateBillingMode] = useState<BillingMode>('prepaid');
  const [privatePackageSessions, setPrivatePackageSessions] = useState<number>(8);
  const [privatePackagePrice, setPrivatePackagePrice] = useState<number>(800);
  const [privateLocation, setPrivateLocation] = useState('منزل الطالب');

  // Student specific schedule slots
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlotItem[]>([
    { id: '1', day: 'saturday', time: '16:00' },
  ]);

  useEffect(() => {
    if (editingStudent) {
      setName(editingStudent.name);
      setPhone(editingStudent.phone || '');
      setSchool(editingStudent.school || '');
      setGradeLevel(editingStudent.gradeLevel || 'الصف الأول الثانوي');
      const stage = getStageByGrade(editingStudent.gradeLevel || 'الصف الأول الثانوي');
      setSelectedStageId(stage || 'secondary');
      setParentName(editingStudent.parentName || '');
      setParentPhone(editingStudent.parentPhone || '');
      setAvatarColor(editingStudent.avatarColor || 'navy');
      setProfilePhoto(editingStudent.profilePhoto);
      setAchievementFrame(editingStudent.achievementFrame || 'none');
      setNotes(editingStudent.notes || '');

      // Load enrolled groups & check private enrollments
      const enrollments = db.getStudentEnrollments(editingStudent.id);
      const regularGroupIds: string[] = [];
      let hasPrivate = false;

      enrollments.forEach((enr) => {
        const group = enr.groupId ? allGroups.find((g) => g.id === enr.groupId) : undefined;
        if (enr.serviceType === 'private' || group?.type === 'private') {
          hasPrivate = true;
          if (enr.customPrice) setPrivatePrice(enr.customPrice);
          if (enr.hourlyRate) setPrivateHourlyRate(enr.hourlyRate);
          if (enr.billingMode) setPrivateBillingMode(enr.billingMode);
          if (enr.packageSessionsCount) setPrivatePackageSessions(enr.packageSessionsCount);
          if (enr.subject || group?.subject) setPrivateSubject(enr.subject || group?.subject || '');
          if (enr.roomOrLocation || group?.roomOrLocation) setPrivateLocation(enr.roomOrLocation || group?.roomOrLocation || '');
        } else if (enr.groupId) {
          regularGroupIds.push(enr.groupId);
        }
      });

      if (!hasPrivate && (editingStudent.serviceType === 'private' || (editingStudent.privateDays && editingStudent.privateDays.length > 0))) {
        hasPrivate = true;
        if (editingStudent.subject) setPrivateSubject(editingStudent.subject);
        if (editingStudent.privateLocation) setPrivateLocation(editingStudent.privateLocation);
      }

      setSelectedGroupIds(regularGroupIds);

      if (hasPrivate && regularGroupIds.length > 0) {
        setSubscriptionMode('both');
      } else if (hasPrivate) {
        setSubscriptionMode('private');
      } else if (regularGroupIds.length > 0) {
        setSubscriptionMode('group');
      } else {
        setSubscriptionMode('none');
      }

      // Schedule slots initialization
      if (editingStudent.scheduleDays && editingStudent.scheduleDays.length > 0) {
        const normDays = normalizeScheduleDays(editingStudent.scheduleDays);
        const normTimes = normalizeScheduleTimes(
          editingStudent.scheduleTimes,
          editingStudent.scheduleTime || '16:00',
          normDays
        );
        const items: ScheduleSlotItem[] = [];
        normDays.forEach((dayKey, idx) => {
          const times = normTimes[dayKey] || ['16:00'];
          times.forEach((tm, tmIdx) => {
            items.push({
              id: `${idx}_${tmIdx}`,
              day: dayKey,
              time: tm,
            });
          });
        });
        setScheduleSlots(items.length > 0 ? items : [{ id: '1', day: 'saturday', time: '16:00' }]);
      } else {
        setScheduleSlots([{ id: '1', day: 'saturday', time: '16:00' }]);
      }
    } else {
      setName('');
      setPhone('');
      setSchool('');
      setGradeLevel('الصف الأول الثانوي');
      setSelectedStageId('secondary');
      setParentName('');
      setParentPhone('');
      setAvatarColor('navy');
      setProfilePhoto(undefined);
      setAchievementFrame('none');
      setNotes('');
      setSubscriptionMode(defaultGroupId ? 'group' : 'group');
      setSelectedGroupIds(defaultGroupId ? [defaultGroupId] : []);
      setPrivateSubject('الرياضيات');
      setPrivatePrice(100);
      setPrivateHourlyRate(150);
      setPrivateBillingMode('prepaid');
      setPrivatePackageSessions(8);
      setPrivatePackagePrice(800);
      setPrivateLocation('منزل الطالب');
      setScheduleSlots([{ id: '1', day: 'saturday', time: '16:00' }]);
    }
  }, [editingStudent, defaultGroupId, allGroups, isOpen]);

  const handleStageChange = (stageId: string) => {
    setSelectedStageId(stageId);
    const stage = GRADE_STAGES.find((s) => s.id === stageId);
    if (stage && stage.grades.length > 0) {
      setGradeLevel(stage.grades[0].nameAr);
    }
  };

  const toggleGroup = (groupId: string) => {
    if (selectedGroupIds.includes(groupId)) {
      setSelectedGroupIds(selectedGroupIds.filter((id) => id !== groupId));
    } else {
      setSelectedGroupIds([...selectedGroupIds, groupId]);
    }
  };

  const handleAddScheduleSlot = () => {
    const newId = String(Date.now());
    const lastSlot = scheduleSlots[scheduleSlots.length - 1];
    setScheduleSlots([...scheduleSlots, { id: newId, day: lastSlot ? lastSlot.day : 'monday', time: '16:00' }]);
  };

  const handleRemoveScheduleSlot = (id: string) => {
    if (scheduleSlots.length <= 1) return;
    setScheduleSlots(scheduleSlots.filter((s) => s.id !== id));
  };

  const handleSlotDayChange = (id: string, newDay: string) => {
    setScheduleSlots(
      scheduleSlots.map((s) => (s.id === id ? { ...s, day: normalizeWeekdayKey(newDay) } : s))
    );
  };

  const handleSlotTimeChange = (id: string, newTime: string) => {
    setScheduleSlots(scheduleSlots.map((s) => (s.id === id ? { ...s, time: newTime } : s)));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    try {
      const compressedDataUrl = await compressImage(file, 256, 256, 0.8);
      setProfilePhoto(compressedDataUrl);
    } catch (err) {
      console.error('Failed to compress profile photo:', err);
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setProfilePhoto(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;

    const studentId = editingStudent
      ? editingStudent.id
      : `st_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Build canonical schedule days & times map
    const canonicalDays: string[] = [];
    const validTimesMap: Record<string, string[]> = {};

    scheduleSlots.forEach((slot) => {
      const dayKey = normalizeWeekdayKey(slot.day);
      if (!canonicalDays.includes(dayKey)) {
        canonicalDays.push(dayKey);
      }
      if (!validTimesMap[dayKey]) {
        validTimesMap[dayKey] = [];
      }
      if (!validTimesMap[dayKey].includes(slot.time)) {
        validTimesMap[dayKey].push(slot.time);
      }
    });

    const primaryScheduleTime = scheduleSlots[0]?.time || '16:00';

    const studentData: Student = {
      id: studentId,
      name: name.trim(),
      phone: phone.trim() || undefined,
      school: school.trim() || undefined,
      gradeLevel: gradeLevel || 'الصف الأول الثانوي',
      parentName: parentName.trim() || undefined,
      parentPhone: parentPhone.trim() || undefined,
      avatarColor,
      profilePhoto,
      achievementFrame: achievementFrame || 'none',
      notes: notes.trim() || undefined,
      scheduleDays: canonicalDays,
      scheduleTime: primaryScheduleTime,
      scheduleTimes: validTimesMap,
      status: editingStudent ? editingStudent.status : 'active',
      createdAt: editingStudent ? editingStudent.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save Student Record
    db.saveStudent(studentData);

    // Sync Enrollments
    if (!editingStudent) {
      // 1. Group enrollments
      if (subscriptionMode === 'group' || subscriptionMode === 'both') {
        selectedGroupIds.forEach((groupId) => {
          const group = allGroups.find((g) => g.id === groupId);
          const defaultPrice = group ? group.defaultPrice : 0;
          const billingType = group ? group.billingType : 'monthly';
          db.enrollStudent(studentData.id, groupId, {
            serviceType: 'group',
            billingType,
            billingMode: group?.billingMode || (billingType as any),
            customPrice: defaultPrice,
            scheduleDays: canonicalDays.length > 0 ? canonicalDays : undefined,
            scheduleTimes: canonicalDays.length > 0 ? validTimesMap : undefined,
            status: 'active',
          });
        });
      }

      // 2. Private Lesson Service
      if (subscriptionMode === 'private' || subscriptionMode === 'both') {
        db.createPrivateLessonService(studentData.id, {
          subject: privateSubject.trim() || 'درس خاص',
          sessionPrice: privateBillingMode === 'package' ? (privatePackagePrice || 800) : (privatePrice || 100),
          hourlyRate: privateBillingMode === 'hourly' ? (privateHourlyRate || 150) : undefined,
          billingType: privateBillingMode as BillingType,
          billingMode: privateBillingMode,
          packageSessionsCount: privateBillingMode === 'package' ? (privatePackageSessions || 8) : undefined,
          packagePrice: privateBillingMode === 'package' ? (privatePackagePrice || 800) : undefined,
          scheduleDays: canonicalDays.length > 0 ? canonicalDays : ['saturday'],
          scheduleTime: primaryScheduleTime,
          scheduleTimes: canonicalDays.length > 0 ? validTimesMap : undefined,
          roomOrLocation: privateLocation,
        });
      }
    } else {
      // If editing, sync group enrollments
      const currentEnrollments = db.getStudentEnrollments(studentData.id);
      const currentGroupEnrs = currentEnrollments.filter((e) => {
        const g = allGroups.find((grp) => grp.id === e.groupId);
        return g && g.type !== 'private' && e.serviceType !== 'private';
      });
      const currentGroupIds = currentGroupEnrs.map((e) => e.groupId);

      // Add newly selected groups
      selectedGroupIds.forEach((groupId) => {
        if (!currentGroupIds.includes(groupId)) {
          const group = allGroups.find((g) => g.id === groupId);
          const defaultPrice = group ? group.defaultPrice : 0;
          const billingType = group ? group.billingType : 'monthly';
          db.enrollStudent(studentData.id, groupId, {
            serviceType: 'group',
            billingType,
            billingMode: group?.billingMode || (billingType as any),
            customPrice: defaultPrice,
            scheduleDays: canonicalDays.length > 0 ? canonicalDays : undefined,
            scheduleTimes: canonicalDays.length > 0 ? validTimesMap : undefined,
            status: 'active',
          });
        }
      });

      // Remove unselected groups
      currentGroupEnrs.forEach((enr) => {
        if (!selectedGroupIds.includes(enr.groupId)) {
          db.removeEnrollment(enr.id);
        }
      });

      // Update remaining active enrollments with the updated student schedule
      const updatedEnrollments = db.getStudentEnrollments(studentData.id);
      updatedEnrollments.forEach((enr) => {
        if (canonicalDays.length > 0) {
          db.updateEnrollment({
            ...enr,
            scheduleDays: canonicalDays,
            scheduleTimes: validTimesMap,
            updatedAt: new Date().toISOString(),
          });
        }
      });

      // Sync private lesson enrollment if student has private enrollment or selected private mode
      const privEnr = updatedEnrollments.find((e) => e.serviceType === 'private');
      if (subscriptionMode === 'private' || subscriptionMode === 'both') {
        if (privEnr) {
          db.updateEnrollment({
            ...privEnr,
            subject: privateSubject || privEnr.subject,
            roomOrLocation: privateLocation,
            customPrice: privateBillingMode === 'package' ? (privatePackagePrice || 800) : (privatePrice || 100),
            hourlyRate: privateBillingMode === 'hourly' ? (privateHourlyRate || 150) : undefined,
            billingType: privateBillingMode as BillingType,
            billingMode: privateBillingMode,
            packageSessionsCount: privateBillingMode === 'package' ? (privatePackageSessions || 8) : undefined,
            packagePrice: privateBillingMode === 'package' ? (privatePackagePrice || 800) : undefined,
            scheduleDays: canonicalDays.length > 0 ? canonicalDays : privEnr.scheduleDays,
            scheduleTimes: canonicalDays.length > 0 ? validTimesMap : privEnr.scheduleTimes,
            updatedAt: new Date().toISOString(),
          });
        } else {
          db.createPrivateLessonService(studentData.id, {
            subject: privateSubject.trim() || 'درس خاص',
            sessionPrice: privateBillingMode === 'package' ? (privatePackagePrice || 800) : (privatePrice || 100),
            hourlyRate: privateBillingMode === 'hourly' ? (privateHourlyRate || 150) : undefined,
            billingType: privateBillingMode as BillingType,
            billingMode: privateBillingMode,
            packageSessionsCount: privateBillingMode === 'package' ? (privatePackageSessions || 8) : undefined,
            packagePrice: privateBillingMode === 'package' ? (privatePackagePrice || 800) : undefined,
            scheduleDays: canonicalDays.length > 0 ? canonicalDays : ['saturday'],
            scheduleTime: primaryScheduleTime,
            scheduleTimes: canonicalDays.length > 0 ? validTimesMap : undefined,
            roomOrLocation: privateLocation,
          });
        }
      } else if (subscriptionMode === 'group' && privEnr) {
        db.removeEnrollment(privEnr.id);
      }
    }

    onSaveComplete(studentData);
    onClose();
  };

  const regularGroups = allGroups.filter((g) => g.type !== 'private');
  const currentStage = GRADE_STAGES.find((s) => s.id === selectedStageId) || GRADE_STAGES[2];

  if (!isOpen) return null;

  return (
    <BottomSheet
      id="add-edit-student"
      isOpen={isOpen}
      onClose={onClose}
      zIndex={zIndex}
      title={editingStudent ? t('editStudent') : t('newStudent')}
      subtitle={editingStudent ? (isEn ? 'Update student profile & courses' : 'تحديث وتعديل ملف الطالب واشتراكاته') : t('studentsSubtitle')}
      headerLeading={
        <div className="w-10 h-10 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line">
          <AppIcon name="student" size={20} weight="duotone" />
        </div>
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
            form="add-student-form"
            className="btn-orange flex-1"
          >
            <AppIcon name="check" size={16} weight="bold" />
            <span>{editingStudent ? t('saveChanges') : t('save')}</span>
          </button>
        </div>
      }
    >
      <form id="add-student-form" onSubmit={handleSave} className="space-y-4 text-xs text-navy text-start">
        {/* Profile Photo & Frame */}
        <div className="p-4 rounded-2xl bg-page border border-line space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="font-black text-navy text-xs sm:text-sm flex items-center gap-2">
              <AppIcon name="edit" size={14} className="text-navy" />
              <span>{t('profilePhoto')}</span>
            </label>
            <span className="text-[11px] text-slate font-medium">{t('photoOptionalTip')}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative shrink-0 flex items-center justify-center p-2">
              <StudentAvatar
                student={{
                  id: 'temp',
                  name: name || t('newStudent'),
                  avatarColor,
                  profilePhoto,
                  achievementFrame,
                } as Student}
                size="xl"
                showFrame={true}
              />
            </div>

            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCompressingPhoto}
                  className="btn-navy px-3.5 py-2 text-xs flex items-center gap-1.5"
                >
                  <AppIcon name="plus" size={14} weight="bold" />
                  <span>{isCompressingPhoto ? '...' : profilePhoto ? t('changePhotoBtn') : t('uploadPhotoBtn')}</span>
                </button>

                {profilePhoto && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="btn-soft px-3 py-2 text-xs flex items-center gap-1"
                  >
                    <AppIcon name="trash" size={14} />
                    <span>{t('removePhotoBtn')}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2.5 border-t border-line">
            <AchievementFrameSelector
              selectedFrame={achievementFrame}
              onSelectFrame={(frame) => setAchievementFrame(frame)}
            />
          </div>
        </div>

        {/* Basic Student Info */}
        <div className="p-4 rounded-2xl bg-page border border-line space-y-3 shadow-2xs">
          <div>
            <label className="field-label flex items-center gap-1.5">
              <AppIcon name="student" size={13} className="text-navy" />
              <span>{t('studentName')} *</span>
            </label>
            <input
              type="text"
              required
              placeholder={isEn ? 'e.g. Ahmed Mohamed Ali' : 'مثال: أحمد محمد علي'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="classy-input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label flex items-center gap-1.5">
                <AppIcon name="phone" size={13} className="text-navy" />
                <span>{t('studentPhone')}</span>
              </label>
              <input
                type="tel"
                placeholder="010XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="classy-input"
              />
            </div>

            <div>
              <label className="field-label">{t('schoolNameLabel')}</label>
              <input
                type="text"
                placeholder={isEn ? 'e.g. High School for Excellence' : 'مثال: مدرسة المتفوقين الثانوية'}
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="classy-input"
              />
            </div>
          </div>
        </div>

        {/* Educational Stage & Grade */}
        <div className="p-4 rounded-2xl bg-page border border-line space-y-3 shadow-2xs">
          <label className="field-label flex items-center gap-2">
            <AppIcon name="graduation" size={14} className="text-navy" />
            <span>{t('gradeLevel')}</span>
          </label>

          <SegmentedControl<string>
            value={selectedStageId}
            onChange={(val) => handleStageChange(val)}
            options={GRADE_STAGES.map((stg) => ({
              value: stg.id,
              label: language === 'ar' ? stg.nameAr : stg.nameEn,
            }))}
          />

          <div className="grid grid-cols-3 gap-2">
            {currentStage.grades.map((grd) => {
              const gradeName = grd.nameAr;
              const isSelected = gradeLevel === gradeName;
              return (
                <button
                  key={grd.id}
                  type="button"
                  onClick={() => setGradeLevel(gradeName)}
                  className={`chip w-full ${isSelected ? 'chip-active' : ''}`}
                >
                  {getLocalizedStageName(gradeName, language)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Guardian / Parent */}
        <div className="p-4 rounded-2xl bg-page border border-line space-y-3 shadow-2xs">
          <label className="field-label flex items-center gap-2">
            <AppIcon name="phone" size={14} className="text-navy" />
            <span>{isEn ? 'Parent / Contact Details' : 'بيانات ولي الأمر والتواصل'}</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="field-label">{t('parentName')}</label>
              <input
                type="text"
                placeholder={isEn ? 'e.g. Mahmoud Ali' : 'مثال: محمود علي'}
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="classy-input"
              />
            </div>

            <div>
              <label className="field-label">{t('parentPhone')}</label>
              <input
                type="tel"
                placeholder="010XXXXXXXX"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                className="classy-input"
              />
            </div>
          </div>
        </div>

        {/* Subscriptions Card */}
        <div className="p-4 rounded-2xl bg-page border border-line space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-black text-navy flex items-center gap-2">
              <AppIcon name="groups" size={14} className="text-navy" />
              <span>{t('subscriptionTypeLabel')}</span>
            </label>
            <span className="text-[11px] text-slate font-bold">{t('flexibleEnrollmentSupport')}</span>
          </div>

          <SegmentedControl<'group' | 'private' | 'both' | 'none'>
            value={subscriptionMode}
            onChange={(val) => setSubscriptionMode(val)}
            options={[
              { value: 'group', label: t('groupTypeGroup') },
              { value: 'private', label: t('groupTypePrivate') },
              { value: 'both', label: t('bothTypes') },
              { value: 'none', label: t('unassigned') },
            ]}
          />

          {(subscriptionMode === 'group' || subscriptionMode === 'both') && (
            <div className="space-y-2 pt-2 border-t border-line">
              <span className="text-xs font-bold text-navy block">
                {t('selectGroupsPrompt')}:
              </span>

              {regularGroups.length === 0 ? (
                <p className="text-xs text-slate p-3 bg-mist rounded-2xl text-center font-medium">
                  {t('noGroupsRegisteredYet')}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {regularGroups.map((grp) => {
                    const isChecked = selectedGroupIds.includes(grp.id);
                    return (
                      <div
                        key={grp.id}
                        onClick={() => toggleGroup(grp.id)}
                        className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-mint-soft border-navy text-navy font-bold shadow-2xs'
                            : 'bg-page border-line text-slate hover:bg-mist'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                              isChecked
                                ? 'bg-navy border-navy text-white shadow-2xs'
                                : 'border-line bg-page'
                            }`}
                          >
                            {isChecked && <AppIcon name="check" size={12} weight="bold" />}
                          </div>
                          <span className="font-bold text-xs sm:text-sm text-navy">{grp.name}</span>
                          <span className="text-[11px] text-slate">
                            ({grp.subject} • {getLocalizedStageName(grp.gradeLevel, language)})
                          </span>
                        </div>

                        <span className="text-xs font-black text-navy">
                          {grp.defaultPrice} {t('currency')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {(subscriptionMode === 'private' || subscriptionMode === 'both') && (
            <div className="space-y-2.5 pt-2 border-t border-line">
              <span className="text-xs font-black text-navy flex items-center gap-1.5">
                <AppIcon name="sparkles" size={14} weight="fill" className="text-orange" />
                <span>{t('privateLessonSetupTitle')}</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="field-label">{t('subjectNameLabel')} *</label>
                  <input
                    type="text"
                    value={privateSubject}
                    onChange={(e) => setPrivateSubject(e.target.value)}
                    placeholder={isEn ? 'Physics, Math...' : 'مثال: الفيزياء'}
                    className="classy-input"
                  />
                </div>

                <div>
                  <label className="field-label">{t('billingType')}</label>
                  <select
                    value={privateBillingMode}
                    onChange={(e) => setPrivateBillingMode(e.target.value as BillingMode)}
                    className="classy-select cursor-pointer"
                  >
                    <option value="prepaid">{t('billingPrepaid')}</option>
                    <option value="postpaid">{t('billingPostpaid')}</option>
                    <option value="package">{t('billingPackage')}</option>
                    <option value="monthly">{t('billingMonthly')}</option>
                    <option value="hourly">{t('billingHourly')}</option>
                  </select>
                </div>

                {privateBillingMode === 'hourly' ? (
                  <div>
                    <label className="field-label">{isEn ? 'Hourly Rate *' : 'سعر الساعة *'}</label>
                    <input
                      type="number"
                      min="0"
                      value={privateHourlyRate}
                      onChange={(e) => setPrivateHourlyRate(Number(e.target.value))}
                      className="classy-input"
                    />
                  </div>
                ) : privateBillingMode !== 'package' ? (
                  <div>
                    <label className="field-label">
                      {privateBillingMode === 'monthly' ? (isEn ? 'Monthly Fee *' : 'سعر الاشتراك الشهري *') : (isEn ? 'Session Price *' : 'سعر الحصة *')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={privatePrice}
                      onChange={(e) => setPrivatePrice(Number(e.target.value))}
                      className="classy-input"
                    />
                  </div>
                ) : null}
              </div>

              {privateBillingMode === 'package' && (
                <div className="grid grid-cols-2 gap-2.5 p-3 bg-mint-soft border border-line rounded-2xl">
                  <div>
                    <label className="field-label">{isEn ? 'Package Sessions *' : 'عدد حصص الباقة *'}</label>
                    <input
                      type="number"
                      min="1"
                      value={privatePackageSessions}
                      onChange={(e) => setPrivatePackageSessions(Number(e.target.value))}
                      className="classy-input"
                    />
                  </div>
                  <div>
                    <label className="field-label">{isEn ? 'Package Total Price *' : 'سعر الباقة الإجمالي *'}</label>
                    <input
                      type="number"
                      min="0"
                      value={privatePackagePrice}
                      onChange={(e) => setPrivatePackagePrice(Number(e.target.value))}
                      className="classy-input"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Schedule Slots */}
        <div className="p-4 rounded-2xl bg-page border border-line space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="text-xs sm:text-sm font-black text-navy flex items-center gap-2">
              <AppIcon name="clock" size={14} className="text-navy" />
              <span>{t('studentSchedule')}</span>
            </label>
            <span className="text-[11px] text-slate font-bold">
              {scheduleSlots.length} {t('weeklyClassesCount')}
            </span>
          </div>

          <div className="space-y-2">
            {scheduleSlots.map((slot) => (
              <div
                key={slot.id}
                className="p-2.5 rounded-2xl bg-mist border border-line flex items-center gap-2"
              >
                <div className="flex-1">
                  <select
                    value={slot.day}
                    onChange={(e) => handleSlotDayChange(slot.id, e.target.value)}
                    className="w-full bg-page border border-line rounded-xl px-2.5 py-2 text-xs font-black text-navy focus:outline-none focus:border-navy cursor-pointer"
                  >
                    {CANONICAL_WEEKDAY_KEYS.map((dayKey) => (
                      <option key={dayKey} value={dayKey}>
                        {getLocalizedWeekdayName(dayKey, isRTL)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <input
                    type="time"
                    value={slot.time}
                    onChange={(e) => handleSlotTimeChange(slot.id, e.target.value)}
                    className="w-full bg-page border border-line rounded-xl px-2.5 py-2 text-xs font-black text-navy focus:outline-none focus:border-navy text-center"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveScheduleSlot(slot.id)}
                  disabled={scheduleSlots.length <= 1}
                  className="p-2 rounded-xl bg-page hover:bg-coral-soft text-navy hover:text-coral border border-line transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  title={t('removeSlot')}
                >
                  <AppIcon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddScheduleSlot}
            className="w-full py-2.5 px-3 rounded-xl border border-dashed border-navy/40 bg-mint-soft hover:bg-mint text-navy font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <AppIcon name="plus" size={14} weight="bold" />
            <span>{t('addScheduleSlot')}</span>
          </button>
        </div>

        {/* Notes */}
        <div className="p-4 rounded-2xl bg-page border border-line space-y-2 shadow-2xs">
          <label className="field-label flex items-center gap-1.5">
            <AppIcon name="edit" size={13} className="text-navy" />
            <span>{t('notes')}</span>
          </label>
          <textarea
            rows={2}
            placeholder={t('notesPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="classy-textarea"
          />
        </div>
      </form>
    </BottomSheet>
  );
};
