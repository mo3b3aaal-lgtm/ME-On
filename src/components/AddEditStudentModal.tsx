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
} from 'lucide-react';
import { Student, Group, BillingMode, BillingType, AchievementFrame } from '../types';
import { db } from '../utils/storage';
import { compressImage } from '../utils/imageCompressor';
import { StudentAvatar } from './StudentAvatar';
import { AchievementFrameSelector } from './AchievementFrameSelector';
import { GRADE_STAGES, ALL_GRADE_OPTIONS, getStageByGrade, getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';

interface AddEditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingStudent?: Student | null;
  defaultGroupId?: string;
  allGroups: Group[];
  onSaveComplete: (savedStudent: Student) => void;
  zIndex?: number;
}

const AVATAR_COLORS = [
  '#748C70', // Sage green
  '#D49B4B', // Warm gold
  '#C97C5D', // Terracotta
  '#5E755A', // Deep olive
  '#8C6D53', // Warm brown
  '#5C788A', // Slate blue
  '#7E6B8F', // Dusty purple
  '#8C847B', // Soft taupe
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

  // Private lesson configuration
  const [privateSubject, setPrivateSubject] = useState('رياضيات');
  const [privatePrice, setPrivatePrice] = useState<number>(150);
  const [privateHourlyRate, setPrivateHourlyRate] = useState<number>(150);
  const [privateBillingMode, setPrivateBillingMode] = useState<BillingMode>('prepaid');
  const [privatePackageSessions, setPrivatePackageSessions] = useState<number>(10);
  const [privatePackagePrice, setPrivatePackagePrice] = useState<number>(900);
  const [privateDays, setPrivateDays] = useState<string[]>(['السبت']);
  const [privateTime, setPrivateTime] = useState('16:00');
  const [privateTimes, setPrivateTimes] = useState<Record<string, string>>({ 'السبت': '16:00' });
  const [privateLocation, setPrivateLocation] = useState('منزل الطالب / أونلاين');

  useEffect(() => {
    if (editingStudent) {
      setName(editingStudent.name);
      setPhone(editingStudent.phone || '');
      setParentName(editingStudent.parentName || '');
      setParentPhone(editingStudent.parentPhone || '');
      setParentRelation(editingStudent.parentRelation || 'ولي الأمر');
      
      const currentGrade = editingStudent.gradeLevel || 'الصف الأول الثانوي';
      setGradeLevel(currentGrade);
      const matchedStageId = getStageByGrade(currentGrade);
      if (matchedStageId) {
        setSelectedStageId(matchedStageId);
      }

      setSchool(editingStudent.school || '');
      setNotes(editingStudent.notes || '');
      setAvatarColor(editingStudent.avatarColor || AVATAR_COLORS[0]);
      setProfilePhoto(editingStudent.profilePhoto);
      setAchievementFrame(editingStudent.achievementFrame || 'default');

      // Load current enrollments
      const currentEnrs = db.getStudentEnrollments(editingStudent.id);
      setSelectedGroupIds(currentEnrs.map((e) => e.groupId));

      const sType = db.getStudentServiceType(editingStudent.id);
      if (sType === 'both') setSubscriptionMode('both');
      else if (sType === 'private_only') setSubscriptionMode('private');
      else if (sType === 'group_only') setSubscriptionMode('group');
      else setSubscriptionMode('none');
    } else {
      setName('');
      setPhone('');
      setParentName('');
      setParentPhone('');
      setParentRelation('ولي الأمر');
      setSelectedStageId('secondary');
      setGradeLevel('الصف الأول الثانوي');
      setSchool('');
      setNotes('');
      setAvatarColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
      setProfilePhoto(undefined);
      setAchievementFrame('default');
      
      const regular = allGroups.filter((g) => g.type !== 'private');
      if (defaultGroupId) {
        setSelectedGroupIds([defaultGroupId]);
        setSubscriptionMode('group');
      } else {
        setSelectedGroupIds(regular.length > 0 ? [regular[0].id] : []);
        setSubscriptionMode(regular.length > 0 ? 'group' : 'private');
      }

      setPrivateSubject('رياضيات');
      setPrivatePrice(150);
      setPrivateHourlyRate(150);
      setPrivateBillingMode('prepaid');
      setPrivateDays(['السبت']);
      setPrivateTime('04:00 م');
      setPrivateLocation('منزل الطالب / أونلاين');
    }
  }, [editingStudent, isOpen, allGroups.length, defaultGroupId]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingPhoto(true);
      const compressedBase64 = await compressImage(file, 240, 240, 0.8);
      setProfilePhoto(compressedBase64);
    } catch (err) {
      console.error('Failed to compress image:', err);
      alert('Could not compress photo, please try another image');
    } finally {
      setIsCompressingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    setProfilePhoto(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStageChange = (stageId: string) => {
    setSelectedStageId(stageId);
    const stage = GRADE_STAGES.find((s) => s.id === stageId);
    if (stage && stage.grades.length > 0) {
      setGradeLevel(stage.grades[0]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const studentId = editingStudent
      ? editingStudent.id
      : `stu_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const savedStudent: Student = {
      id: studentId,
      name: name.trim(),
      phone: phone.trim(),
      parentName: parentName.trim(),
      parentPhone: parentPhone.trim(),
      parentRelation,
      gradeLevel,
      school: school.trim(),
      notes: notes.trim(),
      status: editingStudent ? editingStudent.status : 'active',
      avatarColor,
      profilePhoto,
      achievementFrame,
      createdAt: editingStudent ? editingStudent.createdAt : new Date().toISOString(),
    };

    db.saveStudent(savedStudent);

    // If new student or updating:
    if (!editingStudent) {
      // 1. Group enrollments
      if (subscriptionMode === 'group' || subscriptionMode === 'both') {
        for (const gId of selectedGroupIds) {
          db.enrollStudent(studentId, gId);
        }
      }

      // 2. Private lesson creation & enrollment
      if (subscriptionMode === 'private' || subscriptionMode === 'both') {
        const isPkg = privateBillingMode === 'package';
        const isHourly = privateBillingMode === 'hourly';
        db.createPrivateLessonService(studentId, {
          subject: privateSubject.trim() || t('groupTypePrivate'),
          gradeLevel,
          sessionPrice: isPkg
            ? (Number(privatePackagePrice) || 900)
            : isHourly
            ? (Number(privateHourlyRate) || 150)
            : (Number(privatePrice) || 100),
          hourlyRate: isHourly ? (Number(privateHourlyRate) || 150) : undefined,
          billingType: privateBillingMode as BillingType,
          billingMode: privateBillingMode,
          packageSessionsCount: isPkg ? (Number(privatePackageSessions) || 10) : undefined,
          packagePrice: isPkg ? (Number(privatePackagePrice) || 900) : undefined,
          scheduleDays: privateDays,
          scheduleTime: privateTime || (privateDays.length > 0 ? privateTimes[privateDays[0]] || '' : ''),
          scheduleTimes: privateTimes,
          roomOrLocation: privateLocation,
        });
      }
    } else {
      // If editing student, sync selected groups if changed
      if (subscriptionMode === 'group' || subscriptionMode === 'both') {
        for (const gId of selectedGroupIds) {
          db.enrollStudent(studentId, gId);
        }
      }
    }

    onSaveComplete(savedStudent);
    onClose();
  };

  const toggleGroup = (groupId: string) => {
    if (selectedGroupIds.includes(groupId)) {
      setSelectedGroupIds(selectedGroupIds.filter((id) => id !== groupId));
    } else {
      setSelectedGroupIds([...selectedGroupIds, groupId]);
    }
  };

  const togglePrivateDay = (day: string) => {
    if (privateDays.includes(day)) {
      if (privateDays.length > 1) {
        setPrivateDays(privateDays.filter((d) => d !== day));
      }
    } else {
      setPrivateDays([...privateDays, day]);
      if (!privateTimes[day]) {
        setPrivateTimes((prev) => ({ ...prev, [day]: privateTime || '16:00' }));
      }
    }
  };

  const handlePrivateDayTimeChange = (day: string, timeVal: string) => {
    setPrivateTimes((prev) => ({ ...prev, [day]: timeVal }));
    if (privateDays[0] === day || !privateTime) {
      setPrivateTime(timeVal);
    }
  };

  const regularGroups = allGroups.filter((g) => g.type !== 'private');
  const currentStage = GRADE_STAGES.find((s) => s.id === selectedStageId) || GRADE_STAGES[2];

  const modalLayer = useModalLayer('add-edit-student', isOpen, onClose);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#2D332A]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-t-3xl sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Modal Header */}
        <div className="p-4 flex items-center justify-between border-b border-[#E8E2D6] bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#748C70] text-white shadow-sm">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2D332A]">
                {editingStudent ? t('editStudent') : t('newStudent')}
              </h2>
              <p className="text-[11px] text-[#8A9187] font-medium">
                {editingStudent ? t('editStudent') : t('studentsSubtitle')}
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

        {/* Modal Form Content */}
        <form onSubmit={handleSave} className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-4 text-xs text-[#434B3E]">
          
          {/* SECTION: Profile Photo, Achievement Frame & Avatar Color */}
          <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="font-bold text-[#2D332A] text-xs flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#748C70]" />
                <span>{t('profilePhoto')}</span>
              </label>
              <span className="text-[10px] text-[#8A9187]">{t('photoOptionalTip')}</span>
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

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCompressingPhoto}
                    className="px-3 py-1.5 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isCompressingPhoto ? '...' : profilePhoto ? t('changePhotoBtn') : t('uploadPhotoBtn')}</span>
                  </button>

                  {profilePhoto && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-2.5 py-1.5 rounded-xl bg-[#FCF6F4] text-[#C97C5D] border border-[#C97C5D]/30 hover:bg-[#F8ECE8] font-bold text-xs flex items-center gap-1 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('removePhotoBtn')}</span>
                    </button>
                  )}
                </div>

                {/* Avatar Color Picker for Fallback */}
                <div className="space-y-1 pt-1 border-t border-[#E8E2D6]/60">
                  <span className="text-[10px] text-[#8A9187] block font-semibold">{t('fallbackColorLabel')}:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAvatarColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-transform ${
                          avatarColor === c ? 'scale-110 border-[#2D332A]' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Achievement Frame Selector */}
            <div className="pt-2 border-t border-[#E8E2D6]/60">
              <AchievementFrameSelector
                selectedFrame={achievementFrame}
                onSelectFrame={(frame) => setAchievementFrame(frame)}
              />
            </div>
          </div>

          {/* Basic Student Info Card */}
          <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-3 shadow-sm">
            <div>
              <label className="block text-xs font-bold text-[#2D332A] mb-1">
                {t('studentName')} *
              </label>
              <div className="relative">
                <User className={`w-4 h-4 text-[#8A9187] absolute ${isRTL ? 'right-3' : 'left-3'} top-3`} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Ahmed Mohamed"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2.5 text-xs text-[#2D332A] placeholder-[#8A9187] focus:outline-none focus:border-[#748C70] font-medium`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#2D332A] mb-1">
                  {t('studentPhone')}
                </label>
                <div className="relative">
                  <Phone className={`w-4 h-4 text-[#8A9187] absolute ${isRTL ? 'right-3' : 'left-3'} top-3`} />
                  <input
                    type="tel"
                    placeholder="010XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={`w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2.5 text-xs text-[#2D332A] placeholder-[#8A9187] focus:outline-none focus:border-[#748C70] font-medium`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2D332A] mb-1">
                  {t('schoolNameLabel')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alexandria Language School"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl px-3 py-2.5 text-xs text-[#2D332A] placeholder-[#8A9187] focus:outline-none focus:border-[#748C70] font-medium"
                />
              </div>
            </div>
          </div>

          {/* Educational Stage & Grade Level Card */}
          <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-3 shadow-sm">
            <label className="block text-xs font-bold text-[#2D332A] flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-[#748C70]" />
              <span>{t('gradeLevel')}</span>
            </label>

            {/* Stage Selector Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl">
              {GRADE_STAGES.map((stg) => (
                <button
                  key={stg.id}
                  type="button"
                  onClick={() => handleStageChange(stg.id)}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                    selectedStageId === stg.id
                      ? 'bg-[#748C70] text-white shadow-xs'
                      : 'text-[#6B7567] hover:bg-[#EAE5D8]'
                  }`}
                >
                  {language === 'ar' ? stg.nameAr : stg.nameEn}
                </button>
              ))}
            </div>

            {/* Specific Grades in Selected Stage */}
            <div className="grid grid-cols-3 gap-1.5">
              {currentStage.grades.map((grd) => {
                const gradeName = grd.nameAr;
                const isSelected = gradeLevel === gradeName;
                return (
                  <button
                    key={grd.id}
                    type="button"
                    onClick={() => setGradeLevel(gradeName)}
                    className={`p-2 rounded-xl border text-center font-bold text-xs transition-all ${
                      isSelected
                        ? 'bg-[#748C70] text-white border-[#748C70] shadow-xs'
                        : 'bg-[#F9F7F2] text-[#434B3E] border-[#E8E2D6] hover:bg-[#EAE5D8]'
                    }`}
                  >
                    {getLocalizedStageName(gradeName, language)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Guardian / Parent Card */}
          <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-3 shadow-sm">
            <label className="block text-xs font-bold text-[#2D332A] flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#748C70]" />
              <span>{t('parentName')}</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#6B7567] mb-1">{t('parentName')}</label>
                <input
                  type="text"
                  placeholder="e.g. Mohamed Ali"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl px-3 py-2 text-xs text-[#2D332A] placeholder-[#8A9187] focus:outline-none focus:border-[#748C70]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#6B7567] mb-1">{t('parentPhone')}</label>
                <input
                  type="tel"
                  placeholder="010XXXXXXXX"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl px-3 py-2 text-xs text-[#2D332A] placeholder-[#8A9187] focus:outline-none focus:border-[#748C70]"
                />
              </div>
            </div>
          </div>

          {/* Subscriptions Card */}
          <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#2D332A] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#748C70]" />
                <span>{t('subscriptionTypeLabel')}</span>
              </label>
              <span className="text-[10px] text-[#8A9187] font-semibold">{t('flexibleEnrollmentSupport')}</span>
            </div>

            {/* Subscription Type Selector */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl">
              <button
                type="button"
                onClick={() => setSubscriptionMode('group')}
                className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                  subscriptionMode === 'group'
                    ? 'bg-[#748C70] text-white shadow-xs'
                    : 'text-[#6B7567] hover:bg-[#EAE5D8]'
                }`}
              >
                {t('groupTypeGroup')}
              </button>
              <button
                type="button"
                onClick={() => setSubscriptionMode('private')}
                className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                  subscriptionMode === 'private'
                    ? 'bg-[#748C70] text-white shadow-xs'
                    : 'text-[#6B7567] hover:bg-[#EAE5D8]'
                }`}
              >
                {t('groupTypePrivate')}
              </button>
              <button
                type="button"
                onClick={() => setSubscriptionMode('both')}
                className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                  subscriptionMode === 'both'
                    ? 'bg-[#748C70] text-white shadow-xs'
                    : 'text-[#6B7567] hover:bg-[#EAE5D8]'
                }`}
              >
                {t('bothTypes')}
              </button>
              <button
                type="button"
                onClick={() => setSubscriptionMode('none')}
                className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all text-center ${
                  subscriptionMode === 'none'
                    ? 'bg-[#748C70] text-white shadow-xs'
                    : 'text-[#6B7567] hover:bg-[#EAE5D8]'
                }`}
              >
                {t('unassigned')}
              </button>
            </div>

            {/* 1. Group Selection when 'group' or 'both' */}
            {(subscriptionMode === 'group' || subscriptionMode === 'both') && (
              <div className="space-y-2 pt-2 border-t border-[#E8E2D6]/60">
                <span className="text-[11px] font-bold text-[#6B7567] block">
                  {t('selectGroupsPrompt')}:
                </span>

                {regularGroups.length === 0 ? (
                  <p className="text-xs text-[#8A9187] p-3 bg-[#F9F7F2] rounded-xl text-center">
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
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-[#748C70]/10 border-[#748C70] text-[#2D332A]'
                              : 'bg-[#F9F7F2] border-[#E8E2D6] text-[#6B7567] hover:bg-[#EAE5D8]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border ${
                                isChecked
                                  ? 'bg-[#748C70] border-[#748C70] text-white'
                                  : 'border-[#D6CDC2] bg-white'
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3" />}
                            </div>
                            <span className="font-bold text-xs">{grp.name}</span>
                            <span className="text-[10px] text-[#8A9187]">
                              ({grp.subject} • {getLocalizedStageName(grp.gradeLevel, language)})
                            </span>
                          </div>

                          <span className="text-[11px] font-bold text-[#748C70]">
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
              <div className="space-y-2.5 pt-2 border-t border-[#E8E2D6]/60">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#D49B4B] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t('privateLessonSetupTitle')}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#6B7567] mb-0.5">{t('subjectNameLabel')} *</label>
                    <input
                      type="text"
                      value={privateSubject}
                      onChange={(e) => setPrivateSubject(e.target.value)}
                      placeholder="e.g. Physics"
                      className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs font-bold text-[#2D332A] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-[#6B7567] mb-0.5">{t('billingType')}</label>
                    <select
                      value={privateBillingMode}
                      onChange={(e) => setPrivateBillingMode(e.target.value as BillingMode)}
                      className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs font-bold text-[#2D332A] focus:outline-none"
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
                      <label className="block text-[10px] text-[#6B7567] mb-0.5">{t('hourlyRateInputLabel')} *</label>
                      <input
                        type="number"
                        min="0"
                        value={privateHourlyRate}
                        onChange={(e) => setPrivateHourlyRate(Number(e.target.value))}
                        className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs font-bold text-[#2D332A] focus:outline-none"
                      />
                    </div>
                  ) : privateBillingMode !== 'package' ? (
                    <div>
                      <label className="block text-[10px] text-[#6B7567] mb-0.5">
                        {privateBillingMode === 'monthly' ? t('monthlyFeeLabel') : t('perSessionRateLabel')} *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={privatePrice}
                        onChange={(e) => setPrivatePrice(Number(e.target.value))}
                        className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs font-bold text-[#2D332A] focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] text-[#6B7567] mb-0.5 font-bold">
                        {isRTL ? 'إجمالي سعر الباقة (ج.م) *' : 'Package Total Price *'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={privatePackagePrice}
                        onChange={(e) => setPrivatePackagePrice(Number(e.target.value))}
                        placeholder="e.g. 900"
                        className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs font-bold text-[#2D332A] focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Package Sessions Count & Calculated Session Price */}
                {privateBillingMode === 'package' && (
                  <div className="p-2.5 bg-[#F9F7F2] rounded-xl border border-[#D49B4B]/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-[#2D332A]">{t('packageSessionsNumberLabel')}:</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          value={privatePackageSessions}
                          onChange={(e) => setPrivatePackageSessions(Math.max(1, Number(e.target.value)))}
                          className="w-16 bg-white border border-[#E8E2D6] rounded-lg p-1 text-xs font-bold text-[#2D332A] text-center focus:outline-none focus:border-[#D49B4B]"
                        />
                        <span className="text-xs font-bold text-[#6B7567]">{isRTL ? 'حصة' : 'sessions'}</span>
                      </div>
                    </div>

                    <div className="p-2 bg-[#D49B4B]/10 rounded-lg flex items-center justify-between text-xs text-[#9C6615] font-bold">
                      <span>{isRTL ? 'سعر الحصة الفعلي المحسوب:' : 'Calculated Price Per Session:'}</span>
                      <span className="text-xs font-black text-[#2D332A]">
                        {privatePackageSessions > 0 ? (Math.round((privatePackagePrice / privatePackageSessions) * 100) / 100) : 0} {t('currency')} / {isRTL ? 'حصة' : 'session'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Days & Per-Day Time */}
                <div className="space-y-2 pt-1 border-t border-[#E8E2D6]/70">
                  <label className="block text-[10px] font-bold text-[#6B7567]">{t('scheduleDays')}:</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { key: 'السبت', label: t('daySat') },
                      { key: 'الأحد', label: t('daySun') },
                      { key: 'الاثنين', label: t('dayMon') },
                      { key: 'الثلاثاء', label: t('dayTue') },
                      { key: 'الأربعاء', label: t('dayWed') },
                      { key: 'الخميس', label: t('dayThu') },
                      { key: 'الجمعة', label: t('dayFri') },
                    ].map(({ key, label }) => {
                      const isDayChecked = privateDays.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => togglePrivateDay(key)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-bold border transition-all ${
                            isDayChecked
                              ? 'bg-[#D49B4B] text-white border-[#D49B4B]'
                              : 'bg-white text-[#6B7567] border-[#E8E2D6]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Individual Time Inputs per Day */}
                  {privateDays.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {privateDays.map((day) => {
                        const dayTime = privateTimes[day] || privateTime || '16:00';
                        return (
                          <div
                            key={day}
                            className="flex items-center justify-between p-1.5 rounded-lg bg-[#F9F7F2] border border-[#E8E2D6]"
                          >
                            <span className="text-[11px] font-bold text-[#2D332A] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D49B4B]"></span>
                              {day}
                            </span>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#8A9187]" />
                              <input
                                type="time"
                                value={dayTime}
                                onChange={(e) => handlePrivateDayTimeChange(day, e.target.value)}
                                className="bg-white border border-[#E8E2D6] rounded px-1.5 py-0.5 text-xs font-bold text-[#2D332A] focus:outline-none focus:border-[#D49B4B]"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes Card */}
          <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-1 shadow-sm">
            <label className="block text-xs font-bold text-[#2D332A] mb-1">{t('notes')}</label>
            <textarea
              rows={2}
              placeholder={t('notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] placeholder-[#8A9187] focus:outline-none focus:border-[#748C70]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-[#E8E2D6] bg-white text-[#6B7567] font-bold text-xs hover:bg-[#F2ECE1] transition-all"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-2xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{editingStudent ? t('saveChanges') : t('save')}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
    </ModalPortal>
  );
};
