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
} from 'lucide-react';
import { Student, Group, Enrollment, BillingType, BillingMode, PricingModifierType } from '../types';
import { db, calculateCustomEnrollmentPrice, getBillingModeLabel } from '../utils/storage';

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
  if (!isOpen) return null;

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
  const [privSubject, setPrivSubject] = useState('رياضيات');
  const [privPrice, setPrivPrice] = useState<number>(150);
  const [privBillingMode, setPrivBillingMode] = useState<BillingMode>('prepaid');
  const [privPackageSessions, setPrivPackageSessions] = useState<number>(10);
  const [privPackagePrice, setPrivPackagePrice] = useState<number>(900);
  const [privDays, setPrivDays] = useState<string[]>(['السبت']);
  const [privTime, setPrivTime] = useState('04:00 م');
  const [privLocation, setPrivLocation] = useState('منزل الطالب / أونلاين');

  const regularGroups = allGroups.filter((g) => g.type !== 'private');
  const selectedGroup = allGroups.find((g) => g.id === selectedGroupId) || targetGroup;

  // Billing system & pricing customization for group enrollment
  const [billingMode, setBillingMode] = useState<BillingMode>(
    (selectedGroup?.billingMode || (selectedGroup?.billingType === 'per_session' ? 'prepaid' : selectedGroup?.billingType)) as BillingMode || 'monthly'
  );
  const [perSessionSubMode, setPerSessionSubMode] = useState<'prepaid' | 'postpaid'>(
    selectedGroup?.billingMode === 'postpaid' || selectedGroup?.billingType === 'postpaid' ? 'postpaid' : 'prepaid'
  );
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

  const togglePrivDay = (day: string) => {
    if (privDays.includes(day)) {
      if (privDays.length > 1) setPrivDays(privDays.filter((d) => d !== day));
    } else {
      setPrivDays([...privDays, day]);
    }
  };

  const handleSave = () => {
    if (selectedStudentIds.length === 0) return;

    if (enrollmentKind === 'private_service') {
      const isPkg = privBillingMode === 'package';
      // Create independent private lesson for each selected student
      for (const studentId of selectedStudentIds) {
        db.createPrivateLessonService(studentId, {
          subject: privSubject.trim() || 'درس خاص',
          sessionPrice: isPkg ? (Number(privPackagePrice) || 900) : (Number(privPrice) || 100),
          billingType: privBillingMode as BillingType,
          billingMode: privBillingMode,
          packageSessionsCount: isPkg ? (Number(privPackageSessions) || 10) : undefined,
          packagePrice: isPkg ? (Number(privPackagePrice) || 900) : undefined,
          scheduleDays: privDays,
          scheduleTime: privTime,
          roomOrLocation: privLocation,
        });
      }
    } else {
      // Standard group enrollment
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

  return (
    <div className="fixed inset-0 z-50 bg-[#2D332A]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-t-3xl sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-[#E8E2D6] bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#748C70] text-white shadow-sm">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2D332A]">
                {isGroupMode ? `تسجيل طلاب في: ${targetGroup?.name}` : 'تسجيل اشتراك جديد لطالب'}
              </h2>
              <p className="text-[11px] text-[#8A9187] font-medium">
                تسكين في مجموعة عامة أو إنشاء خدمة درس خاص مستقل (Private)
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

        {/* Body */}
        <div className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-4 text-xs text-[#434B3E]">
          
          {/* Service Kind Switcher (if not fixed by targetGroup) */}
          {!targetGroup && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-white border border-[#E8E2D6] rounded-2xl shadow-xs text-xs font-bold">
              <button
                type="button"
                onClick={() => setEnrollmentKind('group')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  enrollmentKind === 'group'
                    ? 'bg-[#748C70] text-white shadow-xs'
                    : 'text-[#6B7567] hover:bg-[#F9F7F2]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>تسجيل في مجموعة عامة</span>
              </button>

              <button
                type="button"
                onClick={() => setEnrollmentKind('private_service')}
                className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  enrollmentKind === 'private_service'
                    ? 'bg-[#D49B4B] text-white shadow-xs'
                    : 'text-[#6B7567] hover:bg-[#F9F7F2]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>خدمة درس خاص (Private)</span>
              </button>
            </div>
          )}

          {/* Student Picker if in Group Mode or multiple select */}
          {(!targetStudent || isGroupMode) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-bold text-[#2D332A]">
                  اختر الطلاب المراد إضافتهم ({selectedStudentIds.length} محدد):
                </label>
                <div className="relative w-40">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-[#8A9187]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="بحث عن طالب..."
                    className="w-full pr-8 pl-2 py-1.5 rounded-xl bg-white border border-[#E8E2D6] text-[11px] text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                  />
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto rounded-2xl border border-[#E8E2D6] bg-white p-1.5 space-y-1">
                {filteredStudents.length === 0 ? (
                  <p className="p-3 text-center text-[#8A9187] text-[11px]">لا يوجد طلاب يطابقون البحث</p>
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
                        className={`w-full p-2 rounded-xl flex items-center justify-between text-right transition-all ${
                          alreadyEnrolled
                            ? 'bg-[#E8E2D6]/30 opacity-50 cursor-not-allowed'
                            : isSelected
                            ? 'bg-[#748C70]/15 border border-[#748C70]'
                            : 'hover:bg-[#F9F7F2]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border ${
                              isSelected
                                ? 'bg-[#748C70] border-[#748C70] text-white'
                                : 'border-[#D6CDC2] bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div>
                            <p className="font-bold text-[#2D332A] text-xs">{st.name}</p>
                            <p className="text-[10px] text-[#8A9187]">{st.gradeLevel || 'الصف غير محدد'}</p>
                          </div>
                        </div>

                        {alreadyEnrolled && (
                          <span className="text-[10px] bg-[#C97C5D]/15 text-[#C97C5D] px-2 py-0.5 rounded-full font-bold">
                            مسجل بالفعل
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
            <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center justify-between text-[#9C6615] font-bold text-xs">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>بيانات خدمة الدرس الخاص (Private المستقل):</span>
                </span>
                <span className="text-[10px] bg-[#D49B4B]/20 px-2 py-0.5 rounded-full">حساب منفصل</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] text-[#6B7567] mb-1 font-bold">اسم المادة *</label>
                  <input
                    type="text"
                    value={privSubject}
                    onChange={(e) => setPrivSubject(e.target.value)}
                    placeholder="رياضيات، فيزياء..."
                    className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs text-[#2D332A] font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-[#6B7567] mb-1 font-bold">نظام المحاسبة</label>
                  <select
                    value={privBillingMode}
                    onChange={(e) => setPrivBillingMode(e.target.value as BillingMode)}
                    className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs font-bold text-[#2D332A] focus:outline-none"
                  >
                    <option value="prepaid">دفع بالحصة - مسبق (Prepaid)</option>
                    <option value="postpaid">دفع بالحصة - آجل (Postpaid)</option>
                    <option value="package">باقة حصص (Session Package)</option>
                    <option value="monthly">اشتراك شهري (Monthly)</option>
                  </select>
                </div>

                {privBillingMode !== 'package' ? (
                  <div>
                    <label className="block text-[10px] text-[#6B7567] mb-1 font-bold">
                      {privBillingMode === 'monthly' ? 'الاشتراك الشهري (ج.م) *' : 'سعر الحصة (ج.م) *'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={privPrice}
                      onChange={(e) => setPrivPrice(Number(e.target.value))}
                      className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs font-bold text-[#2D332A] focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] text-[#6B7567] mb-1 font-bold">سعر الباقة الإجمالي (ج.م) *</label>
                    <input
                      type="number"
                      min="0"
                      value={privPackagePrice}
                      onChange={(e) => setPrivPackagePrice(Number(e.target.value))}
                      placeholder="مثال: 900"
                      className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl p-2 text-xs font-bold text-[#2D332A] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Package Sessions Presets & Count for Private */}
              {privBillingMode === 'package' && (
                <div className="p-2.5 bg-[#F9F7F2] rounded-xl border border-[#D49B4B]/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[#2D332A]">عدد حصص الباقة (تحديد مخصص حر):</label>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[#8A9187]">حصص:</span>
                      <input
                        type="number"
                        min="1"
                        value={privPackageSessions}
                        onChange={(e) => setPrivPackageSessions(Math.max(1, Number(e.target.value)))}
                        className="w-16 bg-white border border-[#E8E2D6] rounded-lg p-1 text-xs font-bold text-[#2D332A] text-center focus:outline-none focus:border-[#D49B4B]"
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
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            isSel
                              ? 'bg-[#D49B4B] text-white shadow-xs'
                              : 'bg-white text-[#6B7567] border border-[#E8E2D6] hover:border-[#D49B4B]'
                          }`}
                        >
                          {count} حصص
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-2 bg-[#D49B4B]/10 rounded-lg flex items-center justify-between text-xs text-[#9C6615] font-bold">
                    <span>سعر الحصة الفعلي المحسوب:</span>
                    <span className="text-sm text-[#2D332A]">
                      {privPackageSessions > 0 ? Math.round(privPackagePrice / privPackageSessions) : 0} ج.م / حصة
                    </span>
                  </div>
                </div>
              )}

              {/* Schedule days */}
              <div className="space-y-1.5 pt-1 border-t border-[#E8E2D6]/60">
                <label className="block text-[11px] font-bold text-[#2D332A]">مواعيد الحصص الأسبوعية:</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map((day) => {
                    const isDayChecked = privDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => togglePrivDay(day)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
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
          ) : (
            <>
              {/* Group Picker if not fixed */}
              {!targetGroup && (
                <div className="space-y-1.5">
                  <label className="font-bold text-[#2D332A]">اختر المجموعة المراد التسكين بها:</label>
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
                    className="w-full p-2.5 rounded-2xl bg-white border border-[#E8E2D6] text-xs font-bold text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                  >
                    {allGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.type === 'private' ? 'درس خاص' : 'مجموعة'}) - سعر أساسي: {g.defaultPrice} ج
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Billing System Selection */}
              <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#2D332A] text-xs block">طريقة المحاسبة لهذا الاشتراك (Billing Mode):</label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#748C70]/10 text-[#60755C]">
                    {billingMode === 'monthly'
                      ? 'شهري'
                      : billingMode === 'package'
                      ? 'باقة'
                      : perSessionSubMode === 'prepaid'
                      ? 'بالحصة (مسبق)'
                      : 'بالحصة (بعد الحصة)'}
                  </span>
                </div>
                
                {/* Primary Billing Categories */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingMode('monthly')}
                    className={`py-2 px-2 rounded-xl border text-center font-bold text-xs transition-all ${
                      billingMode === 'monthly'
                        ? 'bg-[#748C70] text-white border-[#748C70] shadow-sm'
                        : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6] hover:bg-[#EAE5D8]'
                    }`}
                  >
                    اشتراك شهري ثابت
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBillingMode('prepaid');
                    }}
                    className={`py-2 px-2 rounded-xl border text-center font-bold text-xs transition-all ${
                      billingMode === 'prepaid' || billingMode === 'postpaid'
                        ? 'bg-[#748C70] text-white border-[#748C70] shadow-sm'
                        : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6] hover:bg-[#EAE5D8]'
                    }`}
                  >
                    نظام الدفع بالحصة
                  </button>

                  <button
                    type="button"
                    onClick={() => setBillingMode('package')}
                    className={`py-2 px-2 rounded-xl border text-center font-bold text-xs transition-all ${
                      billingMode === 'package'
                        ? 'bg-[#748C70] text-white border-[#748C70] shadow-sm'
                        : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6] hover:bg-[#EAE5D8]'
                    }`}
                  >
                    باقة عدد حصص
                  </button>
                </div>

                {/* Sub-modes for Per Session Billing: Prepaid vs Postpaid */}
                {(billingMode === 'prepaid' || billingMode === 'postpaid') && (
                  <div className="p-2.5 bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl space-y-2 animate-in fade-in duration-150">
                    <span className="text-[11px] font-bold text-[#6B7567] block">
                      اختر وضع الدفع بالحصة:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPerSessionSubMode('prepaid');
                          setBillingMode('prepaid');
                        }}
                        className={`p-2 rounded-lg border text-right font-medium text-xs transition-all ${
                          perSessionSubMode === 'prepaid'
                            ? 'bg-white border-[#748C70] text-[#2D332A] ring-1 ring-[#748C70] shadow-xs'
                            : 'bg-white/60 border-[#E8E2D6] text-[#8A9187] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-[#2D332A] text-xs">1. دفع مسبق (Prepaid)</span>
                          <span className="w-2 h-2 rounded-full bg-[#748C70]"></span>
                        </div>
                        <p className="text-[10px] text-[#8A9187] leading-tight">
                          يتم سداد الحصة مقدمًا قبل بدء الحصة (شحن رصيد حصص).
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPerSessionSubMode('postpaid');
                          setBillingMode('postpaid');
                        }}
                        className={`p-2 rounded-lg border text-right font-medium text-xs transition-all ${
                          perSessionSubMode === 'postpaid'
                            ? 'bg-white border-[#748C70] text-[#2D332A] ring-1 ring-[#748C70] shadow-xs'
                            : 'bg-white/60 border-[#E8E2D6] text-[#8A9187] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-[#2D332A] text-xs">2. دفع بعد الحصة (Postpaid)</span>
                          <span className="w-2 h-2 rounded-full bg-[#587B7F]"></span>
                        </div>
                        <p className="text-[10px] text-[#8A9187] leading-tight">
                          يحضر الطالب أولاً ويتم تحصيل قيمة الحصة بعد انتهائها.
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {billingMode === 'monthly' && (
                  <div className="flex items-center justify-between pt-1 text-[11px] text-[#6B7567]">
                    <span>عدد الحصص الأساسي شهرياً:</span>
                    <input
                      type="number"
                      min="1"
                      value={baseSessionsPerMonth}
                      onChange={(e) => setBaseSessionsPerMonth(Math.max(1, Number(e.target.value)))}
                      className="w-16 p-1 text-center font-bold bg-[#F9F7F2] border border-[#E8E2D6] rounded-lg text-xs"
                    />
                  </div>
                )}

                {billingMode === 'package' && (
                  <div className="flex items-center justify-between pt-1 text-[11px] text-[#6B7567]">
                    <span>عدد حصص الباقة:</span>
                    <input
                      type="number"
                      min="1"
                      value={packageSessionsCount}
                      onChange={(e) => setPackageSessionsCount(Math.max(1, Number(e.target.value)))}
                      className="w-16 p-1 text-center font-bold bg-[#F9F7F2] border border-[#E8E2D6] rounded-lg text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Customizable Pricing Options */}
              <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-[#2D332A]">تخصيص السعر لهذا الاشتراك:</label>
                  <span className="text-[11px] text-[#8A9187]">السعر الأساسي: {basePrice} ج.م</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPricingType('same_as_group');
                      setPricingValue(0);
                    }}
                    className={`p-2 rounded-xl border text-center font-bold text-[11px] transition-all ${
                      pricingType === 'same_as_group'
                        ? 'bg-[#748C70] text-white border-[#748C70]'
                        : 'bg-[#F9F7F2] text-[#434B3E] border-[#E8E2D6]'
                    }`}
                  >
                    نفس سعر المجموعة
                  </button>

                  <button
                    type="button"
                    onClick={() => setPricingType('fixed_discount')}
                    className={`p-2 rounded-xl border text-center font-bold text-[11px] transition-all ${
                      pricingType === 'fixed_discount'
                        ? 'bg-[#748C70] text-white border-[#748C70]'
                        : 'bg-[#F9F7F2] text-[#434B3E] border-[#E8E2D6]'
                    }`}
                  >
                    خصم مبلغ ثابت
                  </button>

                  <button
                    type="button"
                    onClick={() => setPricingType('percentage_discount')}
                    className={`p-2 rounded-xl border text-center font-bold text-[11px] transition-all ${
                      pricingType === 'percentage_discount'
                        ? 'bg-[#748C70] text-white border-[#748C70]'
                        : 'bg-[#F9F7F2] text-[#434B3E] border-[#E8E2D6]'
                    }`}
                  >
                    خصم نسبة %
                  </button>

                  <button
                    type="button"
                    onClick={() => setPricingType('fixed_increase')}
                    className={`p-2 rounded-xl border text-center font-bold text-[11px] transition-all ${
                      pricingType === 'fixed_increase'
                        ? 'bg-[#748C70] text-white border-[#748C70]'
                        : 'bg-[#F9F7F2] text-[#434B3E] border-[#E8E2D6]'
                    }`}
                  >
                    زيادة مبلغ ثابت
                  </button>

                  <button
                    type="button"
                    onClick={() => setPricingType('percentage_increase')}
                    className={`p-2 rounded-xl border text-center font-bold text-[11px] transition-all ${
                      pricingType === 'percentage_increase'
                        ? 'bg-[#748C70] text-white border-[#748C70]'
                        : 'bg-[#F9F7F2] text-[#434B3E] border-[#E8E2D6]'
                    }`}
                  >
                    زيادة نسبة %
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPricingType('custom_price');
                      if (!pricingValue) setPricingValue(basePrice);
                    }}
                    className={`p-2 rounded-xl border text-center font-bold text-[11px] transition-all ${
                      pricingType === 'custom_price'
                        ? 'bg-[#748C70] text-white border-[#748C70]'
                        : 'bg-[#F9F7F2] text-[#434B3E] border-[#E8E2D6]'
                    }`}
                  >
                    سعر مخصص بالكامل
                  </button>
                </div>

                {/* Value Input for Modifier */}
                {pricingType !== 'same_as_group' && (
                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-bold text-[#6B7567]">
                      {pricingType === 'fixed_discount' && 'قيمة الخصم بالجنيه:'}
                      {pricingType === 'percentage_discount' && 'نسبة الخصم المئوية (%):'}
                      {pricingType === 'fixed_increase' && 'قيمة الزيادة بالجنيه:'}
                      {pricingType === 'percentage_increase' && 'نسبة الزيادة المئوية (%):'}
                      {pricingType === 'custom_price' && 'السعر المخصص الجديد بالجنيه:'}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={pricingValue || ''}
                        onChange={(e) => setPricingValue(Math.max(0, Number(e.target.value)))}
                        className="w-full p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6] font-bold text-sm text-[#2D332A] focus:outline-none focus:border-[#748C70]"
                      />
                      <span className="absolute left-3 top-2.5 font-bold text-xs text-[#8A9187]">
                        {pricingType.includes('percentage') ? '%' : 'ج.م'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Permanent Calculation Preview Box */}
                <div className="p-3 bg-[#748C70]/10 rounded-xl border border-[#748C70]/30 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-[#6B7567] block">السعر الفعلي المحفوظ لهذا الاشتراك:</span>
                    <span className="text-[10px] text-[#8A9187]">
                      سيبقى هذا السعر محفوظاً وثابتاً حتى لو تم تعديل سعر المجموعة مستقبلاً.
                    </span>
                  </div>
                  <div className="text-left font-black text-base text-[#748C70]">
                    {calculatedFinalPrice} ج.م
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-[#E8E2D6] bg-white text-[#6B7567] font-bold text-xs hover:bg-[#F2ECE1] transition-all"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={selectedStudentIds.length === 0 || (enrollmentKind === 'group' && !selectedGroupId)}
              className="flex-1 py-3 rounded-2xl bg-[#748C70] hover:bg-[#60755C] disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{enrollmentKind === 'private_service' ? 'تأكيد إنشاء اشتراك Private' : 'تأكيد تسجيل الاشتراك'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
