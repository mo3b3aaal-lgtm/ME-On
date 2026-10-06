import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UserPlus,
  GraduationCap,
  Phone,
  User,
  BookOpen,
  Check,
  Sparkles,
  Layers,
  DollarSign,
  Clock,
  Camera,
  Upload,
  Trash2,
  Award,
  Plus,
} from 'lucide-react';
import { Student, Group, BillingMode, BillingType, AchievementFrame, Enrollment } from '../types';
import { db } from '../utils/storage';
import { compressImage } from '../utils/imageCompressor';
import { StudentAvatar } from './StudentAvatar';
import { AchievementFrameSelector } from './AchievementFrameSelector';
import { GRADE_STAGES, ALL_GRADE_OPTIONS, getStageByGrade, getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
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
  '#6B1E2B', // Burgundy (Antique Brocade)
  '#B68A4C', // Bronze (Antique Brocade)
  '#B56B45', // Copper (Copper Cashmere)
  '#5C4033', // Walnut (Antique Brocade)
  '#69493C', // Warm Walnut (Copper Cashmere)
  '#2F2F2F', // Charcoal (Copper Cashmere)
  '#B6A89C', // Soft Taupe (Antique Brocade)
  '#581822', // Deep Burgundy
];

export const AddEditStudentModal: React.FC<AddEditStudentModalProps> = ({
  isOpen,
  onClose,
  editingStudent,
  defaultGroupId,
  allGroups,
  onSaveComplete,
  zIndex = 50,
}) => {
  const { t, isRTL, language } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentRelation, setParentRelation] = useState<'الأب' | 'الأم' | 'ولي الأمر'>('ولي الأمر');
  
  // Stage & Grade
  const [selectedStageId, setSelectedStageId] = useState<string>('secondary');
  const [gradeLevel, setGradeLevel] = useState<string>('الصف الأول الثانوي');
  
  const [school, setSchool] = useState('');
  const [notes, setNotes] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  
  // Profile Photo & Achievement Frame
  const [profilePhoto, setProfilePhoto] = useState<string | undefined>(undefined);
  const [achievementFrame, setAchievementFrame] = useState<AchievementFrame>('default');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  // Subscription Type Mode for creation
  const [subscriptionMode, setSubscriptionMode] = useState<'none' | 'group' | 'private' | 'both'>('group');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Student Recurring Schedule Slots
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlotItem[]>([
    { id: 'slot_init_1', day: 'saturday', time: '16:00' },
  ]);

  // Private lesson configuration
  const [privateSubject, setPrivateSubject] = useState('رياضيات');
  const [privatePrice, setPrivatePrice] = useState<number>(150);
  const [privateHourlyRate, setPrivateHourlyRate] = useState<number>(150);
  const [privateBillingMode, setPrivateBillingMode] = useState<BillingMode>('prepaid');
  const [privatePackageSessions, setPrivatePackageSessions] = useState<number>(10);
  const [privatePackagePrice, setPrivatePackagePrice] = useState<number>(900);
  const [privateLocation, setPrivateLocation] = useState('منزل الطالب / أونلاين');

  useEffect(() => {
    if (editingStudent) {
      setName(editingStudent.name);
      setPhone(editingStudent.phone || '');
      setParentName(editingStudent.parentName || '');
      setParentPhone(editingStudent.parentPhone || '');
      setParentRelation(editingStudent.parentRelation || 'ولي الأمر');
      setSchool(editingStudent.school || '');
      setNotes(editingStudent.notes || '');
      setAvatarColor(editingStudent.avatarColor || AVATAR_COLORS[0]);
      setProfilePhoto(editingStudent.profilePhoto);
      setAchievementFrame(editingStudent.achievementFrame || 'default');
      
      const stg = getStageByGrade(editingStudent.gradeLevel);
      if (stg) {
        setSelectedStageId(stg);
      }
      setGradeLevel(editingStudent.gradeLevel || 'الصف الأول الثانوي');

      // Fetch existing enrollments
      const enrollments = db.getStudentEnrollments(editingStudent.id);
      const groupEnrs = enrollments.filter((e) => {
        const g = allGroups.find((grp) => grp.id === e.groupId);
        return g && g.type !== 'private' && e.serviceType !== 'private';
      });
      const privEnrs = enrollments.filter((e) => e.serviceType === 'private');

      setSelectedGroupIds(groupEnrs.map((e) => e.groupId));

      // Determine subscription mode
      if (groupEnrs.length > 0 && privEnrs.length > 0) {
        setSubscriptionMode('both');
      } else if (privEnrs.length > 0) {
        setSubscriptionMode('private');
      } else if (groupEnrs.length > 0) {
        setSubscriptionMode('group');
      } else {
        setSubscriptionMode('none');
      }

      // Load private lesson options if any
      if (privEnrs.length > 0) {
        const pEnr = privEnrs[0];
        const pGrp = allGroups.find((g) => g.id === pEnr.groupId);
        if (pGrp) {
          setPrivateSubject(pGrp.subject || 'رياضيات');
          setPrivatePrice(pEnr.customPrice || pGrp.defaultPrice || 150);
          setPrivateHourlyRate(pEnr.hourlyRate || pGrp.hourlyRate || 150);
          setPrivateBillingMode((pEnr.billingMode || pGrp.billingMode || 'prepaid') as BillingMode);
          setPrivatePackageSessions(pEnr.packageSessionsCount || pGrp.packageSessionsCount || 10);
          setPrivatePackagePrice(pEnr.packagePrice || pGrp.defaultPrice || 900);
          setPrivateLocation(pGrp.roomOrLocation || 'منزل الطالب / أونلاين');
        }
      }

      // Load existing schedule slots using effective schedule resolver
      const effective = getStudentEffectiveSchedule(editingStudent, allGroups, enrollments, isRTL);
      const loadedSlots: ScheduleSlotItem[] = [];

      effective.allDaysGrouped.forEach((dayGrp) => {
        dayGrp.items.forEach((itm) => {
          loadedSlots.push({
            id: `slot_${Math.random().toString(36).substr(2, 6)}_${itm.dayKey}_${itm.rawTime}`,
            day: itm.dayKey,
            time: itm.rawTime || '16:00',
          });
        });
      });

      if (loadedSlots.length > 0) {
        setScheduleSlots(loadedSlots);
      } else if (editingStudent.scheduleDays && editingStudent.scheduleDays.length > 0) {
        const normDays = normalizeScheduleDays(editingStudent.scheduleDays);
        const normTimes = normalizeScheduleTimes(editingStudent.scheduleTimes);
        const fallbackSlots: ScheduleSlotItem[] = [];
        normDays.forEach((d) => {
          const times = normTimes[d]?.length ? normTimes[d] : [editingStudent.scheduleTime || '16:00'];
          times.forEach((tStr) => {
            fallbackSlots.push({
              id: `slot_${Math.random().toString(36).substr(2, 6)}_${d}_${tStr}`,
              day: d,
              time: tStr,
            });
          });
        });
        setScheduleSlots(fallbackSlots.length > 0 ? fallbackSlots : [{ id: 'slot_init_1', day: 'saturday', time: '16:00' }]);
      } else {
        setScheduleSlots([{ id: 'slot_init_1', day: 'saturday', time: '16:00' }]);
      }
    } else {
      setName('');
      setPhone('');
      setParentName('');
      setParentPhone('');
      setParentRelation('ولي الأمر');
      setSchool('');
      setNotes('');
      setAvatarColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
      setProfilePhoto(undefined);
      setAchievementFrame('default');
      setSelectedStageId('secondary');
      setGradeLevel('الصف الأول الثانوي');
      
      if (defaultGroupId) {
        setSubscriptionMode('group');
        setSelectedGroupIds([defaultGroupId]);
        const defGrp = allGroups.find((g) => g.id === defaultGroupId);
        if (defGrp && defGrp.scheduleDays && defGrp.scheduleDays.length > 0) {
          const normDays = normalizeScheduleDays(defGrp.scheduleDays);
          const normTimes = normalizeScheduleTimes(defGrp.scheduleTimes);
          const initSlots: ScheduleSlotItem[] = [];
          normDays.forEach((d) => {
            const times = normTimes[d]?.length ? normTimes[d] : [defGrp.scheduleTime || '16:00'];
            times.forEach((tVal) => {
              initSlots.push({
                id: `slot_init_${d}_${tVal}`,
                day: d,
                time: tVal,
              });
            });
          });
          setScheduleSlots(initSlots.length > 0 ? initSlots : [{ id: 'slot_init_1', day: 'saturday', time: '16:00' }]);
        } else {
          setScheduleSlots([{ id: 'slot_init_1', day: 'saturday', time: '16:00' }]);
        }
      } else {
        setSubscriptionMode('group');
        setSelectedGroupIds([]);
        setScheduleSlots([{ id: 'slot_init_1', day: 'saturday', time: '16:00' }]);
      }
    }
  }, [editingStudent, defaultGroupId, allGroups, isOpen, isRTL]);

  // Handle stage change
  const handleStageChange = (stageId: string) => {
    setSelectedStageId(stageId);
    const stage = GRADE_STAGES.find((s) => s.id === stageId);
    if (stage && stage.grades.length > 0) {
      setGradeLevel(stage.grades[0].nameAr);
    }
  };

  // Handle image upload with auto compression
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    try {
      const compressedDataUrl = await compressImage(file, 320, 320, 0.8);
      setProfilePhoto(compressedDataUrl);
    } catch (err) {
      console.error('Failed to compress profile photo:', err);
    } finally {
      setIsCompressingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setProfilePhoto(undefined);
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleAddScheduleSlot = () => {
    setScheduleSlots((prev) => [
      ...prev,
      {
        id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        day: 'saturday',
        time: '16:00',
      },
    ]);
  };

  const handleRemoveScheduleSlot = (slotId: string) => {
    setScheduleSlots((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.id !== slotId);
    });
  };

  const handleSlotDayChange = (slotId: string, day: string) => {
    const canon = normalizeWeekdayKey(day);
    setScheduleSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, day: canon } : s))
    );
  };

  const handleSlotTimeChange = (slotId: string, time: string) => {
    setScheduleSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, time } : s))
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Process schedule slots into canonical days and times map
    const validDaysSet = new Set<string>();
    const validTimesMap: Record<string, string[]> = {
      saturday: [],
      sunday: [],
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
    };

    scheduleSlots.forEach((slot) => {
      const canon = normalizeWeekdayKey(slot.day);
      if (canon && slot.time) {
        validDaysSet.add(canon);
        if (!validTimesMap[canon].includes(slot.time)) {
          validTimesMap[canon].push(slot.time);
        }
      }
    });

    const canonicalDays = CANONICAL_WEEKDAY_KEYS.filter((d) => validDaysSet.has(d));

    const studentData: Student = {
      id: editingStudent ? editingStudent.id : `std_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: name.trim(),
      phone: phone.trim() || undefined,
      parentName: parentName.trim() || undefined,
      parentPhone: parentPhone.trim() || undefined,
      parentRelation: parentRelation || undefined,
      gradeLevel: gradeLevel || 'الصف الأول الثانوي',
      school: school.trim() || undefined,
      notes: notes.trim() || undefined,
      avatarColor,
      profilePhoto,
      achievementFrame,
      scheduleDays: canonicalDays,
      scheduleTimes: validTimesMap,
      scheduleTime: canonicalDays.length > 0 && validTimesMap[canonicalDays[0]]?.[0] ? validTimesMap[canonicalDays[0]][0] : '16:00',
      privateDays: (subscriptionMode === 'private' || subscriptionMode === 'both') ? canonicalDays : undefined,
      privateTimes: (subscriptionMode === 'private' || subscriptionMode === 'both') ? validTimesMap : undefined,
      privateTime: canonicalDays.length > 0 && validTimesMap[canonicalDays[0]]?.[0] ? validTimesMap[canonicalDays[0]][0] : '16:00',
      privateLocation: privateLocation,
      subject: privateSubject || undefined,
      status: editingStudent?.status || 'active',
      createdAt: editingStudent ? editingStudent.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.saveStudent(studentData);

    // Save Enrollments when creating a new student
    if (!editingStudent) {
      // 1. Group Enrollments
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

      // 2. Private Lesson Creation
      if (subscriptionMode === 'private' || subscriptionMode === 'both') {
        db.createPrivateLessonService(studentData.id, {
          subject: privateSubject || 'درس خاص',
          gradeLevel: gradeLevel || 'الصف الأول الثانوي',
          sessionPrice: privateBillingMode === 'hourly' ? privateHourlyRate : privatePrice,
          hourlyRate: privateBillingMode === 'hourly' ? privateHourlyRate : undefined,
          billingType: privateBillingMode as any,
          billingMode: privateBillingMode,
          packageSessionsCount: privateBillingMode === 'package' ? privatePackageSessions : undefined,
          packagePrice: privateBillingMode === 'package' ? privatePackagePrice : undefined,
          scheduleDays: canonicalDays.length > 0 ? canonicalDays : ['saturday'],
          scheduleTime: canonicalDays.length > 0 && validTimesMap[canonicalDays[0]]?.[0] ? validTimesMap[canonicalDays[0]][0] : '16:00',
          scheduleTimes: validTimesMap,
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

      // Sync private lesson group if student has private enrollment
      const privEnr = updatedEnrollments.find((e) => e.serviceType === 'private');
      if (privEnr) {
        const privGroup = allGroups.find((g) => g.id === privEnr.groupId);
        if (privGroup) {
          db.saveGroup({
            ...privGroup,
            subject: privateSubject || privGroup.subject,
            roomOrLocation: privateLocation,
            scheduleDays: canonicalDays.length > 0 ? canonicalDays : privGroup.scheduleDays,
            scheduleTimes: canonicalDays.length > 0 ? validTimesMap : privGroup.scheduleTimes,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    onSaveComplete(studentData);
    onClose();
  };

  const regularGroups = allGroups.filter((g) => g.type !== 'private');
  const currentStage = GRADE_STAGES.find((s) => s.id === selectedStageId) || GRADE_STAGES[2];

  const modalLayer = useModalLayer('add-edit-student', isOpen, onClose);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#6B1E2B]/65 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#FAF7F2] border border-[#EADBC7] rounded-t-[28px] sm:rounded-[28px] max-w-lg w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Modal Signature Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[#EADBC7] bg-gradient-to-r from-[#6B1E2B] via-[#5C4033] to-[#69493C] text-[#FAF7F2] relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2]/15 backdrop-blur-md border border-[#EADBC7]/25 text-[#FAF7F2] flex items-center justify-center shrink-0 shadow-sm">
              <UserPlus className="w-5 h-5 text-[#B68A4C]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-[#FAF7F2] tracking-tight truncate">
                {editingStudent ? t('editStudent') : t('newStudent')}
              </h2>
              <p className="text-xs text-[#EADBC7]/85 font-medium truncate">
                {editingStudent ? 'تحديث وتعديل ملف الطالب واشتراكاته' : t('studentsSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-[#FAF7F2]/10 hover:bg-[#FAF7F2]/20 text-[#FAF7F2] border border-[#EADBC7]/20 transition-all cursor-pointer relative z-10 active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 overflow-y-auto android-scrollbar flex-1 space-y-4 text-xs text-[#2F2F2F]">
          
          {/* SECTION: Profile Photo, Achievement Frame & Avatar Color */}
          <div className="classy-card p-4 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="font-black text-[#2F2F2F] text-xs sm:text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#6B1E2B]" />
                <span>{t('profilePhoto')}</span>
              </label>
              <span className="text-[11px] text-[#69493C] font-medium">{t('photoOptionalTip')}</span>
            </div>

            <div className="flex items-center gap-4">
              {/* Photo Preview with Selected Achievement Frame */}
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

              {/* Upload / Change / Remove Controls */}
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
                    className="px-3.5 py-2 rounded-xl bg-[#6B1E2B] hover:bg-[#5C4033] text-[#FAF7F2] font-black text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#FAF7F2]" />
                    <span>{isCompressingPhoto ? '...' : profilePhoto ? t('changePhotoBtn') : t('uploadPhotoBtn')}</span>
                  </button>

                  {profilePhoto && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-3 py-2 rounded-xl bg-[#F8F2EA] text-[#B56B45] border border-[#B6A89C] hover:bg-[#B56B45] hover:text-[#FAF7F2] font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('removePhotoBtn')}</span>
                    </button>
                  )}
                </div>

                {/* Avatar Color Picker for Fallback */}
                <div className="space-y-1.5 pt-2 border-t border-[#EADBC7]">
                  <span className="text-[11px] text-[#69493C] block font-bold">{t('fallbackColorLabel')}:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                          avatarColor === c ? 'scale-115 border-[#6B1E2B] shadow-sm' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Achievement Frame Selector */}
            <div className="pt-2.5 border-t border-[#EADBC7]">
              <AchievementFrameSelector
                selectedFrame={achievementFrame}
                onSelectFrame={(frame) => setAchievementFrame(frame)}
              />
            </div>
          </div>

          {/* Basic Student Info Card */}
          <div className="classy-card p-4 space-y-3 shadow-sm">
            <div>
              <label className="block text-xs font-black text-[#2F2F2F] mb-1">
                {t('studentName')} *
              </label>
              <div className="relative">
                <User className={`w-4 h-4 text-[#69493C] absolute ${isRTL ? 'right-3' : 'left-3'} top-3.5`} />
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد محمد علي"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-3 text-xs sm:text-sm text-[#2F2F2F] placeholder-[#69493C]/60 focus:outline-none focus:border-[#6B1E2B] focus:bg-[#FAF7F2] font-bold transition-all`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-[#2F2F2F] mb-1">
                  {t('studentPhone')}
                </label>
                <div className="relative">
                  <Phone className={`w-4 h-4 text-[#69493C] absolute ${isRTL ? 'right-3' : 'left-3'} top-3.5`} />
                  <input
                    type="tel"
                    placeholder="010XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-3 text-xs sm:text-sm text-[#2F2F2F] placeholder-[#69493C]/60 focus:outline-none focus:border-[#6B1E2B] focus:bg-[#FAF7F2] font-medium transition-all`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-[#2F2F2F] mb-1">
                  {t('schoolNameLabel')}
                </label>
                <input
                  type="text"
                  placeholder="مثال: مدرسة المتفوقين الثانوية"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="w-full bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl px-3.5 py-3 text-xs sm:text-sm text-[#2F2F2F] placeholder-[#69493C]/60 focus:outline-none focus:border-[#6B1E2B] focus:bg-[#FAF7F2] font-medium transition-all"
                />
              </div>
            </div>
          </div>

          {/* Educational Stage & Grade Level Card */}
          <div className="classy-card p-4 space-y-3 shadow-sm">
            <label className="block text-xs font-black text-[#2F2F2F] flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#6B1E2B]" />
              <span>{t('gradeLevel')}</span>
            </label>

            {/* Stage Selector Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl">
              {GRADE_STAGES.map((stg) => (
                <button
                  key={stg.id}
                  type="button"
                  onClick={() => handleStageChange(stg.id)}
                  className={`py-2 px-1 rounded-xl text-xs font-black transition-all text-center cursor-pointer ${
                    selectedStageId === stg.id
                      ? 'bg-gradient-to-r from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] shadow-xs'
                      : 'text-[#69493C] hover:bg-[#EADBC7]/40'
                  }`}
                >
                  {language === 'ar' ? stg.nameAr : stg.nameEn}
                </button>
              ))}
            </div>

            {/* Specific Grades in Selected Stage */}
            <div className="grid grid-cols-3 gap-2">
              {currentStage.grades.map((grd) => {
                const gradeName = grd.nameAr;
                const isSelected = gradeLevel === gradeName;
                return (
                  <button
                    key={grd.id}
                    type="button"
                    onClick={() => setGradeLevel(gradeName)}
                    className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#6B1E2B] text-[#FAF7F2] border-[#6B1E2B] shadow-sm'
                        : 'bg-[#F8F2EA] text-[#2F2F2F] border-[#EADBC7] hover:bg-[#EADBC7]/40'
                    }`}
                  >
                    {getLocalizedStageName(gradeName, language)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guardian / Parent Card */}
          <div className="classy-card p-4 space-y-3 shadow-sm">
            <label className="block text-xs font-black text-[#2F2F2F] flex items-center gap-2">
              <User className="w-4 h-4 text-[#6B1E2B]" />
              <span>بيانات ولي الأمر والتواصل</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#69493C] mb-1">{t('parentName')}</label>
                <input
                  type="text"
                  placeholder="مثال: محمود علي"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2F2F2F] placeholder-[#69493C]/60 focus:outline-none focus:border-[#6B1E2B] focus:bg-[#FAF7F2] font-medium transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#69493C] mb-1">{t('parentPhone')}</label>
                <input
                  type="tel"
                  placeholder="010XXXXXXXX"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  className="w-full bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2F2F2F] placeholder-[#69493C]/60 focus:outline-none focus:border-[#6B1E2B] focus:bg-[#FAF7F2] font-medium transition-all"
                />
              </div>
            </div>
          </div>

          {/* Subscriptions Card */}
          <div className="classy-card p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-black text-[#2F2F2F] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#6B1E2B]" />
                <span>{t('subscriptionTypeLabel')}</span>
              </label>
              <span className="text-[11px] text-[#69493C] font-bold">{t('flexibleEnrollmentSupport')}</span>
            </div>

            {/* Subscription Type Selector */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl">
              <button
                type="button"
                onClick={() => setSubscriptionMode('group')}
                className={`py-2 px-1 rounded-xl text-xs font-black transition-all text-center cursor-pointer ${
                  subscriptionMode === 'group'
                    ? 'bg-gradient-to-r from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] shadow-xs'
                    : 'text-[#69493C] hover:bg-[#EADBC7]/40'
                }`}
              >
                {t('groupTypeGroup')}
              </button>
              <button
                type="button"
                onClick={() => setSubscriptionMode('private')}
                className={`py-2 px-1 rounded-xl text-xs font-black transition-all text-center cursor-pointer ${
                  subscriptionMode === 'private'
                    ? 'bg-gradient-to-r from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] shadow-xs'
                    : 'text-[#69493C] hover:bg-[#EADBC7]/40'
                }`}
              >
                {t('groupTypePrivate')}
              </button>
              <button
                type="button"
                onClick={() => setSubscriptionMode('both')}
                className={`py-2 px-1 rounded-xl text-xs font-black transition-all text-center cursor-pointer ${
                  subscriptionMode === 'both'
                    ? 'bg-gradient-to-r from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] shadow-xs'
                    : 'text-[#69493C] hover:bg-[#EADBC7]/40'
                }`}
              >
                {t('bothTypes')}
              </button>
              <button
                type="button"
                onClick={() => setSubscriptionMode('none')}
                className={`py-2 px-1 rounded-xl text-xs font-black transition-all text-center cursor-pointer ${
                  subscriptionMode === 'none'
                    ? 'bg-gradient-to-r from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] shadow-xs'
                    : 'text-[#69493C] hover:bg-[#EADBC7]/40'
                }`}
              >
                {t('unassigned')}
              </button>
            </div>

            {/* 1. Group Selection when 'group' or 'both' */}
            {(subscriptionMode === 'group' || subscriptionMode === 'both') && (
              <div className="space-y-2 pt-2 border-t border-[#EADBC7]">
                <span className="text-xs font-bold text-[#2F2F2F] block">
                  {t('selectGroupsPrompt')}:
                </span>

                {regularGroups.length === 0 ? (
                  <p className="text-xs text-[#69493C] p-3 bg-[#F8F2EA] rounded-2xl text-center font-medium">
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
                              ? 'bg-[#EADBC7]/40 border-[#6B1E2B] text-[#2F2F2F]'
                              : 'bg-[#F8F2EA] border-[#EADBC7] text-[#69493C] hover:bg-[#EADBC7]/20'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                                isChecked
                                  ? 'bg-[#6B1E2B] border-[#6B1E2B] text-[#FAF7F2] shadow-xs'
                                  : 'border-[#B6A89C] bg-[#FAF7F2]'
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <span className="font-bold text-xs sm:text-sm text-[#2F2F2F]">{grp.name}</span>
                            <span className="text-[11px] text-[#69493C]">
                              ({grp.subject} • {getLocalizedStageName(grp.gradeLevel, language)})
                            </span>
                          </div>

                          <span className="text-xs font-black text-[#6B1E2B]">
                            {grp.defaultPrice} {t('currency')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 2. Private Lesson Configuration when 'private' or 'both' */}
            {(subscriptionMode === 'private' || subscriptionMode === 'both') && (
              <div className="space-y-2.5 pt-2 border-t border-[#EADBC7]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#B56B45] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>{t('privateLessonSetupTitle')}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-[#69493C] mb-1">{t('subjectNameLabel')} *</label>
                    <input
                      type="text"
                      value={privateSubject}
                      onChange={(e) => setPrivateSubject(e.target.value)}
                      placeholder="مثال: الفيزياء"
                      className="w-full bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl p-2.5 text-xs font-bold text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B] focus:bg-[#FAF7F2]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#69493C] mb-1">{t('billingType')}</label>
                    <select
                      value={privateBillingMode}
                      onChange={(e) => setPrivateBillingMode(e.target.value as BillingMode)}
                      className="w-full bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl p-2.5 text-xs font-bold text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B] focus:bg-[#FAF7F2] cursor-pointer"
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
                      <label className="block text-[11px] font-bold text-[#69493C] mb-1">سعر الساعة *</label>
                      <input
                        type="number"
                        min="0"
                        value={privateHourlyRate}
                        onChange={(e) => setPrivateHourlyRate(Number(e.target.value))}
                        className="w-full bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl p-2.5 text-xs font-bold text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B] focus:bg-[#FAF7F2]"
                      />
                    </div>
                  ) : privateBillingMode !== 'package' ? (
                    <div>
                      <label className="block text-[11px] font-bold text-[#69493C] mb-1">
                        {privateBillingMode === 'monthly' ? 'سعر الاشتراك الشهري' : 'سعر الحصة'} *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={privatePrice}
                        onChange={(e) => setPrivatePrice(Number(e.target.value))}
                        className="w-full bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl p-2.5 text-xs font-bold text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B] focus:bg-[#FAF7F2]"
                      />
                    </div>
                  ) : null}
                </div>

                {privateBillingMode === 'package' && (
                  <div className="grid grid-cols-2 gap-2.5 p-3 bg-[#F8F2EA] border border-[#B68A4C] rounded-2xl">
                    <div>
                      <label className="block text-[11px] font-bold text-[#69493C] mb-1">عدد حصص الباقة *</label>
                      <input
                        type="number"
                        min="1"
                        value={privatePackageSessions}
                        onChange={(e) => setPrivatePackageSessions(Number(e.target.value))}
                        className="w-full bg-[#FAF7F2] border border-[#B68A4C] rounded-xl p-2 text-xs font-bold text-[#2F2F2F] focus:outline-none focus:border-[#B68A4C]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#69493C] mb-1">سعر الباقة الإجمالي *</label>
                      <input
                        type="number"
                        min="0"
                        value={privatePackagePrice}
                        onChange={(e) => setPrivatePackagePrice(Number(e.target.value))}
                        className="w-full bg-[#FAF7F2] border border-[#B68A4C] rounded-xl p-2 text-xs font-bold text-[#2F2F2F] focus:outline-none focus:border-[#B68A4C]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Student Schedule Management Card */}
          <div className="classy-card p-4 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-sm font-black text-[#2F2F2F] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#6B1E2B]" />
                <span>{t('studentSchedule')}</span>
              </label>
              <span className="text-[11px] text-[#69493C] font-bold">
                {scheduleSlots.length} {t('weeklyClassesCount')}
              </span>
            </div>

            {/* Schedule Slot Rows */}
            <div className="space-y-2">
              {scheduleSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="p-2.5 rounded-2xl bg-[#F8F2EA] border border-[#EADBC7] flex items-center gap-2"
                >
                  {/* Day Selector */}
                  <div className="flex-1">
                    <select
                      value={slot.day}
                      onChange={(e) => handleSlotDayChange(slot.id, e.target.value)}
                      className="w-full bg-[#FAF7F2] border border-[#EADBC7] rounded-xl px-2.5 py-2 text-xs font-black text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B] cursor-pointer"
                    >
                      {CANONICAL_WEEKDAY_KEYS.map((dayKey) => (
                        <option key={dayKey} value={dayKey}>
                          {getLocalizedWeekdayName(dayKey, isRTL)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Time Input */}
                  <div className="flex-1">
                    <input
                      type="time"
                      value={slot.time}
                      onChange={(e) => handleSlotTimeChange(slot.id, e.target.value)}
                      className="w-full bg-[#FAF7F2] border border-[#EADBC7] rounded-xl px-2.5 py-2 text-xs font-black text-[#2F2F2F] focus:outline-none focus:border-[#6B1E2B] text-center"
                    />
                  </div>

                  {/* Remove Slot Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveScheduleSlot(slot.id)}
                    disabled={scheduleSlots.length <= 1}
                    className="p-2 rounded-xl bg-[#F8F2EA] hover:bg-[#EADBC7] text-[#B56B45] border border-[#B6A89C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    title={t('removeSlot')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Schedule Button */}
            <button
              type="button"
              onClick={handleAddScheduleSlot}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#6B1E2B]/40 bg-[#EADBC7]/20 hover:bg-[#EADBC7]/40 text-[#6B1E2B] font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addScheduleSlot')}</span>
            </button>
          </div>

          {/* Notes Card */}
          <div className="classy-card p-4 space-y-2 shadow-sm">
            <label className="block text-xs font-black text-[#2F2F2F]">{t('notes')}</label>
            <textarea
              rows={2}
              placeholder={t('notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#F8F2EA] border border-[#EADBC7] rounded-2xl p-3 text-xs sm:text-sm text-[#2F2F2F] placeholder-[#69493C]/60 focus:outline-none focus:border-[#6B1E2B] focus:bg-[#FAF7F2] font-medium transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-2xl border border-[#EADBC7] bg-[#FAF7F2] text-[#69493C] font-black text-xs sm:text-sm hover:bg-[#F8F2EA] transition-all cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#6B1E2B] via-[#5C4033] to-[#69493C] text-[#FAF7F2] font-black text-xs sm:text-sm shadow-lg shadow-[#6B1E2B]/30 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer hover:brightness-105"
            >
              <Check className="w-4 h-4 text-[#B68A4C] stroke-[3]" />
              <span>{editingStudent ? t('saveChanges') : t('save')}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
    </ModalPortal>
  );
};
