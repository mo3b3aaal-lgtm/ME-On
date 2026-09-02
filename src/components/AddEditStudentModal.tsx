import React, { useState, useEffect } from 'react';
import { X, UserPlus, GraduationCap, Phone, User, BookOpen, Check, Sparkles, Layers, DollarSign, Clock } from 'lucide-react';
import { Student, Group, BillingMode, BillingType } from '../types';
import { db } from '../utils/storage';

interface AddEditStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingStudent?: Student | null;
  allGroups: Group[];
  onSaveComplete: (savedStudent: Student) => void;
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

const GRADE_LEVELS = [
  'الصف الأول الإعدادي',
  'الصف الثاني الإعدادي',
  'الصف الثالث الإعدادي',
  'الصف الأول الثانوي',
  'الصف الثاني الثانوي',
  'الصف الثالث الثانوي',
  'الصف الرابع الابتدائي',
  'الصف الخامس الابتدائي',
  'الصف السادس الابتدائي',
  'أخرى',
];

export const AddEditStudentModal: React.FC<AddEditStudentModalProps> = ({
  isOpen,
  onClose,
  editingStudent,
  allGroups,
  onSaveComplete,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentRelation, setParentRelation] = useState<'الأب' | 'الأم' | 'ولي الأمر'>('ولي الأمر');
  const [gradeLevel, setGradeLevel] = useState(GRADE_LEVELS[3]);
  const [school, setSchool] = useState('');
  const [notes, setNotes] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  // Subscription Type Mode for creation
  const [subscriptionMode, setSubscriptionMode] = useState<'none' | 'group' | 'private' | 'both'>('group');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Private lesson configuration
  const [privateSubject, setPrivateSubject] = useState('رياضيات');
  const [privatePrice, setPrivatePrice] = useState<number>(150);
  const [privateBillingMode, setPrivateBillingMode] = useState<BillingMode>('prepaid');
  const [privatePackageSessions, setPrivatePackageSessions] = useState<number>(10);
  const [privatePackagePrice, setPrivatePackagePrice] = useState<number>(900);
  const [privateDays, setPrivateDays] = useState<string[]>(['السبت']);
  const [privateTime, setPrivateTime] = useState('04:00 م');
  const [privateLocation, setPrivateLocation] = useState('منزل الطالب / أونلاين');

  useEffect(() => {
    if (editingStudent) {
      setName(editingStudent.name);
      setPhone(editingStudent.phone || '');
      setParentName(editingStudent.parentName || '');
      setParentPhone(editingStudent.parentPhone || '');
      setParentRelation(editingStudent.parentRelation || 'ولي الأمر');
      setGradeLevel(editingStudent.gradeLevel || GRADE_LEVELS[3]);
      setSchool(editingStudent.school || '');
      setNotes(editingStudent.notes || '');
      setAvatarColor(editingStudent.avatarColor || AVATAR_COLORS[0]);

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
      setGradeLevel(GRADE_LEVELS[3]);
      setSchool('');
      setNotes('');
      setAvatarColor(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
      const regular = allGroups.filter((g) => g.type !== 'private');
      setSelectedGroupIds(regular.length > 0 ? [regular[0].id] : []);
      setSubscriptionMode(regular.length > 0 ? 'group' : 'private');
      setPrivateSubject('رياضيات');
      setPrivatePrice(150);
      setPrivateBillingMode('prepaid');
      setPrivateDays(['السبت']);
      setPrivateTime('04:00 م');
      setPrivateLocation('منزل الطالب / أونلاين');
    }
  }, [editingStudent, isOpen, allGroups.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const studentId = editingStudent
      ? editingStudent.id
      : `st_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

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
        db.createPrivateLessonService(studentId, {
          subject: privateSubject.trim() || 'درس خاص',
          gradeLevel,
          sessionPrice: isPkg ? (Number(privatePackagePrice) || 900) : (Number(privatePrice) || 100),
          billingType: privateBillingMode as BillingType,
          billingMode: privateBillingMode,
          packageSessionsCount: isPkg ? (Number(privatePackageSessions) || 10) : undefined,
          packagePrice: isPkg ? (Number(privatePackagePrice) || 900) : undefined,
          scheduleDays: privateDays,
          scheduleTime: privateTime,
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
    }
  };

  const regularGroups = allGroups.filter((g) => g.type !== 'private');

  return (
    <div className="fixed inset-0 z-50 bg-[#2D332A]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-t-3xl sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-[#E8E2D6] bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#748C70] text-white shadow-sm">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2D332A]">
                {editingStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
              </h2>
              <p className="text-[11px] text-[#8A9187]">
                تسجيل بيانات الطالب والاشتراك في المجموعات أو الدروس الخاصة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-[#F2ECE1] text-[#6B7567] hover:text-[#2D332A] hover:bg-[#EAE5D8]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-3.5 text-xs text-[#434B3E]">
          
          {/* Basic Student Info Card */}
          <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-2.5 shadow-sm">
            <h3 className="font-bold text-[#2D332A] text-xs flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#748C70]" />
              <span>البيانات الأساسية للطالب</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-[#8A9187] mb-1">اسم الطالب رباعي *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: يوسف أحمد محمد"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#8A9187] mb-1">رقم هاتف الطالب (واتساب)</label>
                <input
                  type="tel"
                  placeholder="010XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#8A9187] mb-1">المرحلة / الصف الدراسي</label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                >
                  {GRADE_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#8A9187] mb-1">المدرسة (اختياري)</label>
                <input
                  type="text"
                  placeholder="اسم المدرسة..."
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                />
              </div>
            </div>
          </div>

          {/* Parent Info Card */}
          <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-2.5 shadow-sm">
            <h3 className="font-bold text-[#2D332A] text-xs flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#748C70]" />
              <span>بيانات ولي الأمر</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] text-[#8A9187] mb-1">اسم ولي الأمر</label>
                <input
                  type="text"
                  placeholder="مثال: أحمد محمد علي"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#8A9187] mb-1">صلة القرابة</label>
                <select
                  value={parentRelation}
                  onChange={(e) => setParentRelation(e.target.value as any)}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none"
                >
                  <option value="الأب">الأب</option>
                  <option value="الأم">الأم</option>
                  <option value="ولي الأمر">ولي الأمر</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#8A9187] mb-1">هاتف ولي الأمر (واتساب)</label>
                <input
                  type="tel"
                  placeholder="011XXXXXXXX"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Subscription Service Selection (Group vs Private vs Both) */}
          {!editingStudent && (
            <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#2D332A] text-xs flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#748C70]" />
                  <span>تسكين الطالب ونوع الاشتراك:</span>
                </h3>
                <span className="text-[10px] text-[#748C70] font-bold">حسابات منفصلة تماماً</span>
              </div>

              {/* Service Tabs */}
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6] text-center text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setSubscriptionMode('group')}
                  className={`py-1.5 px-1 rounded-lg transition-all ${
                    subscriptionMode === 'group'
                      ? 'bg-white text-[#2D332A] shadow-xs'
                      : 'text-[#6B7567] hover:text-[#2D332A]'
                  }`}
                >
                  مجموعة فقط
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriptionMode('private')}
                  className={`py-1.5 px-1 rounded-lg transition-all ${
                    subscriptionMode === 'private'
                      ? 'bg-white text-[#D49B4B] shadow-xs'
                      : 'text-[#6B7567] hover:text-[#2D332A]'
                  }`}
                >
                  Private فقط
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriptionMode('both')}
                  className={`py-1.5 px-1 rounded-lg transition-all ${
                    subscriptionMode === 'both'
                      ? 'bg-white text-[#748C70] shadow-xs'
                      : 'text-[#6B7567] hover:text-[#2D332A]'
                  }`}
                >
                  مجموعة + Private
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriptionMode('none')}
                  className={`py-1.5 px-1 rounded-lg transition-all ${
                    subscriptionMode === 'none'
                      ? 'bg-white text-[#6B7567] shadow-xs'
                      : 'text-[#6B7567] hover:text-[#2D332A]'
                  }`}
                >
                  بدون اشتراك
                </button>
              </div>

              {/* Group selection if Mode has Group */}
              {(subscriptionMode === 'group' || subscriptionMode === 'both') && (
                <div className="space-y-2 pt-1 border-t border-[#E8E2D6]/60">
                  <span className="text-[11px] font-bold text-[#2D332A] flex items-center justify-between">
                    <span>اختر المجموعات العامة:</span>
                    <span className="text-[10px] text-[#8A9187]">{selectedGroupIds.length} محددة</span>
                  </span>

                  {regularGroups.length === 0 ? (
                    <p className="text-[10px] text-[#8A9187] p-2 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6]">
                      لا توجد مجموعات عامة مسجلة بعد. يمكنك إنشاء مجموعة لاحقاً.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                      {regularGroups.map((g) => {
                        const isChecked = selectedGroupIds.includes(g.id);
                        return (
                          <div
                            key={g.id}
                            onClick={() => toggleGroup(g.id)}
                            className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-[#748C70]/10 border-[#748C70]'
                                : 'bg-[#F9F7F2] border-[#E8E2D6] hover:border-[#748C70]/40'
                            }`}
                          >
                            <div className="truncate">
                              <p className="font-bold text-[#2D332A] text-xs truncate">{g.name}</p>
                              <p className="text-[10px] text-[#8A9187] truncate">
                                {g.subject} • {g.billingType === 'per_session' ? 'بالحصة' : 'شهري'} ({g.defaultPrice} ج)
                              </p>
                            </div>
                            <div
                              className={`w-4 h-4 rounded-md flex items-center justify-center border shrink-0 ${
                                isChecked
                                  ? 'bg-[#748C70] border-[#748C70] text-white'
                                  : 'border-[#E8E2D6] bg-white text-transparent'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Private lesson instant config if Mode has Private */}
              {(subscriptionMode === 'private' || subscriptionMode === 'both') && (
                <div className="space-y-2.5 p-2.5 bg-[#D49B4B]/10 border border-[#D49B4B]/30 rounded-xl">
                  <div className="flex items-center justify-between text-[#9C6615] font-bold text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>إعداد خدمة الدرس الخاص (Private المستقل):</span>
                    </span>
                    <span className="text-[9px] bg-[#D49B4B]/20 px-2 py-0.5 rounded-full">حساب منفصل</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#6B7567] mb-1">المادة</label>
                      <input
                        type="text"
                        value={privateSubject}
                        onChange={(e) => setPrivateSubject(e.target.value)}
                        placeholder="رياضيات، فيزياء..."
                        className="w-full bg-white border border-[#E8E2D6] rounded-xl p-1.5 text-xs text-[#2D332A] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#6B7567] mb-1">نظام المحاسبة</label>
                      <select
                        value={privateBillingMode}
                        onChange={(e) => setPrivateBillingMode(e.target.value as BillingMode)}
                        className="w-full bg-white border border-[#E8E2D6] rounded-xl p-1.5 text-xs font-bold text-[#2D332A] focus:outline-none"
                      >
                        <option value="prepaid">دفع بالحصة - مسبق (Prepaid)</option>
                        <option value="postpaid">دفع بالحصة - آجل (Postpaid)</option>
                        <option value="package">باقة حصص (Session Package)</option>
                        <option value="monthly">اشتراك شهري (Monthly)</option>
                      </select>
                    </div>

                    {privateBillingMode !== 'package' ? (
                      <div>
                        <label className="block text-[10px] text-[#6B7567] mb-1">
                          {privateBillingMode === 'monthly' ? 'الاشتراك الشهري (ج.م) *' : 'سعر الحصة (ج.م) *'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={privatePrice}
                          onChange={(e) => setPrivatePrice(Number(e.target.value))}
                          className="w-full bg-white border border-[#E8E2D6] rounded-xl p-1.5 text-xs font-bold text-[#2D332A] focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] text-[#6B7567] mb-1">سعر الباقة الإجمالي (ج.م) *</label>
                        <input
                          type="number"
                          min="0"
                          value={privatePackagePrice}
                          onChange={(e) => setPrivatePackagePrice(Number(e.target.value))}
                          placeholder="مثال: 900"
                          className="w-full bg-white border border-[#E8E2D6] rounded-xl p-1.5 text-xs font-bold text-[#2D332A] focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* If Package selected: show session count presets and custom input */}
                  {privateBillingMode === 'package' && (
                    <div className="p-2.5 bg-white rounded-xl border border-[#D49B4B]/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-[#2D332A]">عدد حصص الباقة (تحديد مخصص حر):</label>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[#8A9187]">حصص:</span>
                          <input
                            type="number"
                            min="1"
                            value={privatePackageSessions}
                            onChange={(e) => setPrivatePackageSessions(Math.max(1, Number(e.target.value)))}
                            className="w-16 bg-[#F9F7F2] border border-[#E8E2D6] rounded-lg p-1 text-xs font-bold text-[#2D332A] text-center focus:outline-none focus:border-[#D49B4B]"
                          />
                        </div>
                      </div>

                      {/* Quick preset buttons: 5, 8, 10, 15, 20 */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[5, 8, 10, 15, 20].map((count) => {
                          const isSel = privatePackageSessions === count;
                          return (
                            <button
                              key={count}
                              type="button"
                              onClick={() => setPrivatePackageSessions(count)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                isSel
                                  ? 'bg-[#D49B4B] text-white shadow-xs'
                                  : 'bg-[#F9F7F2] text-[#6B7567] border border-[#E8E2D6] hover:border-[#D49B4B]'
                              }`}
                            >
                              {count} حصص
                            </button>
                          );
                        })}
                      </div>

                      {/* Effective unit rate live calculation */}
                      <div className="p-2 bg-[#D49B4B]/10 rounded-lg flex items-center justify-between text-xs text-[#9C6615] font-bold">
                        <span>سعر الحصة الفعلي المحسوب:</span>
                        <span className="text-sm text-[#2D332A]">
                          {privatePackageSessions > 0 ? Math.round(privatePackagePrice / privatePackageSessions) : 0} ج.م / حصة
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Schedule days */}
                  <div className="space-y-1">
                    <label className="block text-[10px] text-[#6B7567]">مواعيد الحصة الأسبوعية:</label>
                    <div className="flex items-center gap-1 flex-wrap">
                      {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((day) => {
                        const isDayChecked = privateDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => togglePrivateDay(day)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                              isDayChecked
                                ? 'bg-[#D49B4B] text-white border-[#D49B4B]'
                                : 'bg-white text-[#6B7567] border-[#E8E2D6]'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Color & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block font-bold text-[#6B7567] mb-1.5">لون الأفاتار</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {AVATAR_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setAvatarColor(col)}
                    className={`w-6 h-6 rounded-full transition-transform ${
                      avatarColor === col ? 'ring-2 ring-[#2D332A] scale-110' : 'opacity-80'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-[#6B7567] mb-1">ملاحظات إضافية</label>
              <input
                type="text"
                placeholder="مستوى الطالب، نقاط القوة أو الضعف..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-white border border-[#E8E2D6] rounded-xl p-2.5 text-xs text-[#2D332A] focus:outline-none focus:border-[#748C70]"
              />
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs shadow-sm transition-all active:scale-[0.99]"
            >
              {editingStudent ? 'حفظ التعديلات' : 'إضافة الطالب'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
