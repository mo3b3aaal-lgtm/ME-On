import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Phone,
  MessageCircle,
  Clock,
  BookOpen,
  DollarSign,
  Filter,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  TrendingUp,
  CreditCard,
  School,
  X,
  CheckSquare,
  CheckCheck,
  CalendarCheck2,
  Archive,
  RotateCcw,
  ShieldCheck,
  Edit3,
  Layers,
  ChevronLeft,
  ChevronRight,
  User,
  Bell,
  Settings,
} from 'lucide-react';
import { Student, Group, Attendance, Session, Enrollment, ActiveTab } from '../types';
import { db } from '../utils/storage';
import { StudentAvatar } from './StudentAvatar';
import { getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { ClassyOwlMascot } from './ClassyOwlMascot';

interface StudentsViewProps {
  students: Student[];
  groups: Group[];
  allAttendance?: Attendance[];
  sessions?: Session[];
  onOpenAddStudent: () => void;
  onOpenStudentProfile: (student: Student) => void;
  onOpenEditStudent?: (student: Student) => void;
  onOpenAddPayment?: (student: Student) => void;
  onOpenBulkAddSession?: (selectedStudents: Student[]) => void;
  onDataChanged?: () => void;
  onNavigateToTab?: (tab: ActiveTab) => void;
  onOpenNotificationsModal?: () => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  groups,
  allAttendance = [],
  sessions = [],
  onOpenAddStudent,
  onOpenStudentProfile,
  onOpenEditStudent,
  onOpenAddPayment,
  onOpenBulkAddSession,
  onDataChanged,
  onNavigateToTab,
  onOpenNotificationsModal,
}) => {
  const { t, language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');

  // Sub-tabs: 'active' | 'archived'
  const [activeTabType, setActiveTabType] = useState<'active' | 'archived'>('active');

  // Multi-select mode for bulk session scheduling
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'debtors' | 'private_only'>('all');

  // Quick feedback toast
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  // Distinct Grade levels from existing students
  const gradeLevels = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.gradeLevel).filter(Boolean)));
  }, [students]);

  // Pre-index student groups, enrollments, and balances in a single memoized pass for ultra-fast rendering
  const studentDataMap = useMemo(() => {
    const allEnrs = db.getEnrollments();
    const groupsMap = new Map<string, Group>(groups.map((g) => [g.id, g]));

    const map = new Map<
      string,
      {
        studentGroups: { group: Group; enrollment: Enrollment }[];
        privateEnrollments: { group: Group; enrollment: Enrollment }[];
        enrollmentGroupIds: Set<string>;
        isPrivateOnly: boolean;
        isGroupAndPrivate: boolean;
        balance: number;
      }
    >();

    students.forEach((student) => {
      const sEnrs = allEnrs.filter((e) => e.studentId === student.id && e.status !== 'stopped');
      const sGroups: { group: Group; enrollment: Enrollment }[] = [];
      const sPriv: { group: Group; enrollment: Enrollment }[] = [];
      const grpIds = new Set<string>();

      sEnrs.forEach((enr) => {
        const g = groupsMap.get(enr.groupId);
        if (g) {
          grpIds.add(g.id);
          if (g.type === 'private' || enr.serviceType === 'private') {
            sPriv.push({ group: g, enrollment: enr });
          } else {
            sGroups.push({ group: g, enrollment: enr });
          }
        }
      });

      const fin = db.calculateStudentFinancials(student.id);

      map.set(student.id, {
        studentGroups: sGroups,
        privateEnrollments: sPriv,
        enrollmentGroupIds: grpIds,
        isPrivateOnly: sGroups.length === 0 && sPriv.length > 0,
        isGroupAndPrivate: sGroups.length > 0 && sPriv.length > 0,
        balance: fin.balance,
      });
    });

    return map;
  }, [students, groups]);

  // Counts for active vs archived
  const activeStudentsCount = useMemo(
    () => students.filter((s) => s.status !== 'archived').length,
    [students]
  );
  const archivedStudentsCount = useMemo(
    () => students.filter((s) => s.status === 'archived').length,
    [students]
  );

  // Active students with debts
  const activeDebtorsCount = useMemo(() => {
    return students
      .filter((s) => s.status !== 'archived')
      .filter((s) => {
        const info = studentDataMap.get(s.id);
        return (info?.balance ?? 0) < 0;
      }).length;
  }, [students, studentDataMap]);

  // Active private-only students
  const privateOnlyCount = useMemo(() => {
    return students
      .filter((s) => s.status !== 'archived')
      .filter((s) => {
        const info = studentDataMap.get(s.id);
        return !!info?.isPrivateOnly;
      }).length;
  }, [students, studentDataMap]);

  // Filtered students list
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // 1. Status Filter (Active vs Archived)
      const isArchived = student.status === 'archived';
      if (activeTabType === 'active' && isArchived) return false;
      if (activeTabType === 'archived' && !isArchived) return false;

      // 2. Search Query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesSearch =
          student.name.toLowerCase().includes(q) ||
          (student.phone && student.phone.includes(q)) ||
          (student.parentPhone && student.parentPhone.includes(q)) ||
          (student.parentName && student.parentName.toLowerCase().includes(q)) ||
          (student.school && student.school.toLowerCase().includes(q)) ||
          (student.notes && student.notes.toLowerCase().includes(q));

        if (!matchesSearch) return false;
      }

      // 3. Grade Level Filter
      if (selectedGradeFilter !== 'all' && student.gradeLevel !== selectedGradeFilter) {
        return false;
      }

      const info = studentDataMap.get(student.id);

      // 4. Group Filter
      if (selectedGroupFilter !== 'all') {
        if (!info?.enrollmentGroupIds.has(selectedGroupFilter)) return false;
      }

      // 5. Quick Filters
      if (quickFilter === 'debtors') {
        if ((info?.balance ?? 0) >= 0) return false;
      } else if (quickFilter === 'private_only') {
        if (!info?.isPrivateOnly) return false;
      }

      return true;
    });
  }, [
    students,
    studentDataMap,
    activeTabType,
    searchQuery,
    selectedGradeFilter,
    selectedGroupFilter,
    quickFilter,
  ]);

  // Handle restoring an archived student
  const handleRestore = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    db.restoreStudent(student.id);
    showToast(isEn ? `Student "${student.name}" restored successfully` : `تمت استعادة الطالب "${student.name}" بنجاح وإعادته للقائمة النشطة`);
    if (onDataChanged) {
      onDataChanged();
    }
  };

  // Toggle single student selection
  const toggleSelectStudent = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all visible filtered students
  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredStudents.map((s) => s.id);
    setSelectedStudentIds(new Set(allFilteredIds));
  };

  // Clear selection
  const handleDeselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  // Exit selection mode
  const handleExitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedStudentIds(new Set());
  };

  // Trigger bulk add session
  const handleBulkAddSession = () => {
    if (selectedStudentIds.size === 0 || !onOpenBulkAddSession) return;
    const selectedList = students.filter((s) => selectedStudentIds.has(s.id));
    onOpenBulkAddSession(selectedList);
  };

  const selectedCount = selectedStudentIds.size;
  const isAllFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedStudentIds.has(s.id));

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedGradeFilter !== 'all' ||
    selectedGroupFilter !== 'all' ||
    quickFilter !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedGradeFilter('all');
    setSelectedGroupFilter('all');
    setQuickFilter('all');
  };

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-3.5 sm:p-5 space-y-4 text-[#0F2A4A] pb-32 bg-[#FFFFFF] relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Ambient background glows matching Classy visual identity */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#17375E]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#17375E]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-[#0F2A4A]/6 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <h1 className="text-2xl font-bold font-display text-[#0F2A4A] tracking-tight">
          {t('studentsTitle') || (isEn ? 'Students' : 'الطلاب')}
        </h1>
        <div className="flex items-center gap-2">
          {onOpenNotificationsModal && (
            <button
              type="button"
              onClick={onOpenNotificationsModal}
              className="relative w-10 h-10 rounded-full bg-[#FFFFFF] border border-[#E1EBEC] flex items-center justify-center text-[#0F2A4A] hover:bg-[#DCEDEB] transition-colors cursor-pointer shadow-xs"
              title={t('smartNotifications') || (isEn ? 'Notifications' : 'الإشعارات')}
              aria-label={t('smartNotifications') || (isEn ? 'Notifications' : 'الإشعارات')}
            >
              <Bell className="w-5 h-5 text-[#5F7083]" strokeWidth={1.7} />
            </button>
          )}
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('settings')}
              className="w-10 h-10 rounded-full bg-[#FFFFFF] border border-[#E1EBEC] flex items-center justify-center text-[#0F2A4A] hover:bg-[#DCEDEB] transition-colors cursor-pointer shadow-xs"
              title={t('navSettings') || (isEn ? 'Settings' : 'الإعدادات')}
              aria-label={t('navSettings') || (isEn ? 'Settings' : 'الإعدادات')}
            >
              <Settings className="w-5 h-5 text-[#5F7083]" strokeWidth={1.7} />
            </button>
          )}
        </div>
      </header>

      {/* =========================================================================
          1. Header Section with Signature Classy Executive Gradient Styling
          ========================================================================= */}
      <div className="rounded-[24px] bg-gradient-to-r from-[#17375E] via-[#0F2A4A] to-[#5F7083] p-5 sm:p-6 text-[#FFFFFF] relative overflow-hidden shadow-xl border border-[#E1EBEC]/15">
        {/* Soft internal gradient orbs */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#17375E]/35 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-[#0F2A4A]/30 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#17375E] via-[#0F2A4A] to-[#17375E] p-0.5 shadow-lg shadow-[#17375E]/35 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#17375E] flex items-center justify-center text-[#FFFFFF]">
                <Users className="w-6 h-6 text-[#FFFFFF]" />
              </div>
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#E1EBEC]/90 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#E1EBEC]" />
                  <span>
                    {activeTabType === 'active'
                      ? (isEn ? 'Student Management & Follow-up' : 'إدارة ومتابعة الطلاب')
                      : (isEn ? 'Archived Students Record' : 'أرشيف الطلاب المحفوظ')}
                  </span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#FFFFFF] tracking-tight flex items-center gap-2.5 truncate">
                <span>{t('studentsTitle')}</span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#FFFFFF]/20 text-[#FFFFFF] border border-[#E1EBEC]/25 shadow-xs">
                  {activeTabType === 'active' ? activeStudentsCount : archivedStudentsCount}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#E1EBEC]/85 font-medium truncate">
                {activeTabType === 'active'
                  ? (isEn ? 'Comprehensive student directory, enrollments, attendance, and balances' : 'سجل الطلاب الشامل، الاشتراكات، الحضور، والأرصدة المالية')
                  : (isEn ? 'Archived students with preserved records of attendance, payments, and reports' : 'الطلاب المؤرشفون مع الحفاظ الكامل على الحضور والمدفوعات والتقارير')}
              </p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E1EBEC]/20 justify-end">
            {activeTabType === 'active' && activeStudentsCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (isSelectionMode) {
                    handleExitSelectionMode();
                  } else {
                    setIsSelectionMode(true);
                  }
                }}
                className={`px-3.5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 border cursor-pointer ${
                  isSelectionMode
                    ? 'bg-[#FFFFFF] text-[#0F2A4A] border-[#FFFFFF] shadow-lg'
                    : 'bg-[#FFFFFF]/10 hover:bg-[#FFFFFF]/20 text-[#FFFFFF] border-[#E1EBEC]/25 shadow-xs'
                }`}
                title={isSelectionMode ? (isEn ? 'Cancel selection mode' : 'إلغاء وضع التحديد') : (isEn ? 'Select students to schedule session' : 'تحديد طلاب لجدولة حصة جماعية')}
              >
                <CheckSquare className={`w-4 h-4 ${isSelectionMode ? 'text-[#17375E]' : 'text-[#FFFFFF]'}`} />
                <span>{isSelectionMode ? t('exitSelectionMode') : t('selectStudents')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenAddStudent}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-[#0F2A4A]/40 transition-all active:scale-95 cursor-pointer hover:brightness-105"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>{t('addStudent')}</span>
            </button>
          </div>
        </div>

        {/* Quick Stat Highlights inside Header */}
        <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-[#E1EBEC]/20 text-center">
          <div className="bg-[#FFFFFF]/10 backdrop-blur-md rounded-xl p-2 border border-[#E1EBEC]/15">
            <span className="text-[10px] text-[#E1EBEC]/80 block font-bold">{isEn ? 'Active Students' : 'الطلاب النشطون'}</span>
            <span className="text-base sm:text-lg font-black text-[#FFFFFF]">{activeStudentsCount}</span>
          </div>
          <div className="bg-[#FFFFFF]/10 backdrop-blur-md rounded-xl p-2 border border-[#E1EBEC]/15">
            <span className="text-[10px] text-[#E1EBEC]/80 block font-bold">{isEn ? 'Have Dues' : 'عليهم مستحقات'}</span>
            <span className="text-base sm:text-lg font-black text-[#FFFFFF]">{activeDebtorsCount}</span>
          </div>
          <div className="bg-[#FFFFFF]/10 backdrop-blur-md rounded-xl p-2 border border-[#E1EBEC]/15">
            <span className="text-[10px] text-[#E1EBEC]/80 block font-bold">{isEn ? 'Private Only' : 'دروس خاصة فقط'}</span>
            <span className="text-base sm:text-lg font-black text-[#FFFFFF]">{privateOnlyCount}</span>
          </div>
        </div>
      </div>

      {/* Quick Feedback Toast */}
      {feedbackToast && (
        <div className="p-3.5 rounded-2xl bg-[#0F2A4A] text-[#FFFFFF] text-xs font-bold flex items-center justify-between shadow-lg shadow-[#0F2A4A]/20 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{feedbackToast}</span>
          </div>
          <button onClick={() => setFeedbackToast(null)}>
            <X className="w-4 h-4 text-[#E1EBEC] hover:text-[#FFFFFF]" />
          </button>
        </div>
      )}

      {/* =========================================================================
          2. Active vs Archived Segmented Control
          ========================================================================= */}
      <div className="classy-card p-1.5 flex items-center gap-1.5 bg-[#FFFFFF]">
        <button
          type="button"
          onClick={() => {
            setActiveTabType('active');
            handleExitSelectionMode();
          }}
          className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTabType === 'active'
              ? 'bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] shadow-md shadow-[#0F2A4A]/20'
              : 'text-[#5F7083] hover:text-[#0F2A4A] hover:bg-[#E1EBEC]/25'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{isEn ? 'Active Students' : 'الطلاب النشطون'}</span>
          <span
            className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
              activeTabType === 'active'
                ? 'bg-[#FFFFFF]/20 text-[#FFFFFF]'
                : 'bg-[#E1EBEC]/25 text-[#17375E]'
            }`}
          >
            {activeStudentsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTabType('archived');
            handleExitSelectionMode();
          }}
          className={`flex-1 py-2.5 px-4 text-xs sm:text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTabType === 'archived'
              ? 'bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] shadow-md shadow-[#0F2A4A]/20'
              : 'text-[#5F7083] hover:text-[#0F2A4A] hover:bg-[#E1EBEC]/25'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>{isEn ? 'Archived Students' : 'أرشيف الطلاب'}</span>
          {archivedStudentsCount > 0 && (
            <span
              className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                activeTabType === 'archived'
                  ? 'bg-[#FFFFFF]/20 text-[#FFFFFF]'
                  : 'bg-[#E1EBEC]/25 text-[#0F2A4A] border border-[#E1EBEC]'
              }`}
            >
              {archivedStudentsCount}
            </span>
          )}
        </button>
      </div>

      {/* Selection Mode Toolbar Banner */}
      {isSelectionMode && activeTabType === 'active' && (
        <div className="p-3.5 bg-gradient-to-r from-[#E1EBEC] to-[#FFFFFF] border border-[#17375E]/30 rounded-2xl flex items-center justify-between gap-2 animate-in fade-in duration-150 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-xl bg-[#17375E] text-[#FFFFFF] flex items-center justify-center font-black text-xs shadow-xs">
              {selectedCount}
            </span>
            <span className="font-black text-[#0F2A4A] text-xs sm:text-sm">
              {t('selectedCount', { count: selectedCount.toString() })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isAllFilteredSelected ? handleDeselectAll : handleSelectAllFiltered}
              className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] border border-[#E1EBEC] text-[#17375E] font-bold text-xs hover:bg-[#E1EBEC]/35 transition-colors cursor-pointer shadow-2xs"
            >
              {isAllFilteredSelected ? t('deselectAll') : t('selectAll')}
            </button>
            <button
              type="button"
              onClick={handleExitSelectionMode}
              className="p-1.5 rounded-xl text-[#5F7083] hover:text-[#0F2A4A] hover:bg-[#FFFFFF]/60 transition-colors cursor-pointer"
              title={t('exitSelectionMode')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. Search & Filters Bar
          ========================================================================= */}
      <div className="classy-card p-3.5 sm:p-4 space-y-3 bg-[#FFFFFF]">
        {/* Search Input */}
        <div className="relative">
          <Search
            className={`w-4.5 h-4.5 text-[#5F7083] absolute top-3.5 ${
              isRTL ? 'right-3.5' : 'left-3.5'
            }`}
          />
          <input
            type="text"
            placeholder={
              activeTabType === 'active'
                ? (isEn ? 'Search by name, student phone, parent phone, or school...' : 'البحث بالاسم، رقم هاتف الطالب، رقم ولي الأمر، أو المدرسة...')
                : (isEn ? 'Search archived students by name or phone...' : 'البحث في الطلاب المؤرشفين بالاسم أو رقم الهاتف...')
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-[#E1EBEC]/15 border border-[#E1EBEC] rounded-2xl py-3 text-xs sm:text-sm text-[#0F2A4A] placeholder-[#5F7083]/70 focus:outline-none focus:border-[#17375E] focus:bg-[#FFFFFF] font-medium transition-all shadow-inner ${
              isRTL ? 'pr-11 pl-9' : 'pl-11 pr-9'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-3 text-[#5F7083] hover:text-[#0F2A4A] p-1 rounded-full hover:bg-[#E1EBEC]/35 transition-colors ${
                isRTL ? 'left-3' : 'right-3'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters and Quick Chips */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
          {/* Dropdown Selects */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 text-[#5F7083] text-[11px] font-bold shrink-0">
              <Filter className="w-3.5 h-3.5 text-[#17375E]" />
              <span>{isEn ? 'Filter:' : 'تصفية:'}</span>
            </div>

            <select
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="bg-[#E1EBEC]/15 hover:bg-[#E1EBEC]/35 border border-[#E1EBEC] rounded-xl px-3 py-1.5 text-xs text-[#0F2A4A] font-bold focus:outline-none focus:border-[#17375E] cursor-pointer transition-colors"
            >
              <option value="all">{isEn ? 'All Stages' : 'كل المراحل الدراسية'}</option>
              {gradeLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {getLocalizedStageName(lvl)}
                </option>
              ))}
            </select>

            <select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              className="bg-[#E1EBEC]/15 hover:bg-[#E1EBEC]/35 border border-[#E1EBEC] rounded-xl px-3 py-1.5 text-xs text-[#0F2A4A] font-bold focus:outline-none focus:border-[#17375E] cursor-pointer transition-colors"
            >
              <option value="all">{isEn ? 'All Groups' : 'كل المجموعات'}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <button
              type="button"
              onClick={() => setQuickFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all border cursor-pointer text-xs ${
                quickFilter === 'all'
                  ? 'bg-[#17375E] text-[#FFFFFF] border-[#17375E] shadow-xs'
                  : 'bg-[#E1EBEC]/15 text-[#5F7083] border-[#E1EBEC] hover:bg-[#E1EBEC]/35'
              }`}
            >
              {t('all')}
            </button>

            <button
              type="button"
              onClick={() => setQuickFilter(quickFilter === 'debtors' ? 'all' : 'debtors')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all border cursor-pointer text-xs flex items-center gap-1.5 ${
                quickFilter === 'debtors'
                  ? 'bg-[#0F2A4A] text-[#FFFFFF] border-[#0F2A4A] shadow-sm'
                  : 'bg-[#E1EBEC]/15 text-[#5F7083] border-[#E1EBEC] hover:bg-[#E1EBEC]/25 hover:text-[#0F2A4A] hover:border-[#5F7083]'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>{isEn ? 'Have Dues' : 'عليهم مستحقات'}</span>
              {activeDebtorsCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${quickFilter === 'debtors' ? 'bg-[#FFFFFF]/25 text-[#FFFFFF]' : 'bg-[#0F2A4A]/15 text-[#0F2A4A]'}`}>
                  {activeDebtorsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setQuickFilter(quickFilter === 'private_only' ? 'all' : 'private_only')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all border cursor-pointer text-xs flex items-center gap-1.5 ${
                quickFilter === 'private_only'
                  ? 'bg-[#17375E] text-[#FFFFFF] border-[#17375E] shadow-sm'
                  : 'bg-[#E1EBEC]/15 text-[#5F7083] border-[#E1EBEC] hover:bg-[#E1EBEC]/35 hover:text-[#17375E]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isEn ? 'Private Only' : 'دروس خاصة فقط'}</span>
              {privateOnlyCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${quickFilter === 'private_only' ? 'bg-[#FFFFFF]/25 text-[#FFFFFF]' : 'bg-[#17375E]/15 text-[#17375E]'}`}>
                  {privateOnlyCount}
                </span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 rounded-xl text-xs text-[#5F7083] hover:text-[#0F2A4A] hover:bg-[#E1EBEC]/25 transition-colors cursor-pointer"
                title={t('resetFilters')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. Student Cards List or Premium Empty State
          ========================================================================= */}
      {students.length === 0 ? (
        <div className="classy-card p-8 sm:p-12 text-center space-y-4 flex flex-col items-center justify-center relative overflow-hidden bg-[#FFFFFF]">
          <div className="w-28 h-28 flex items-center justify-center">
            <ClassyOwlMascot size="lg" glow={true} pose="happy" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="font-black text-base sm:text-lg text-[#0F2A4A]">
              {t('noStudentsFound')}
            </h3>
            <p className="text-xs sm:text-sm text-[#5F7083] font-medium leading-relaxed">
              {isEn ? 'Start by adding your first student to track attendance, packages, and collections with ease.' : 'ابدأ بإضافة أول طالب إلى صفوفك التعليمية لمتابعة حضوره، باقاته، وتحصيل مستحقاته بكل سهولة وأناقة.'}
            </p>
          </div>
          <button
            onClick={onOpenAddStudent}
            className="mt-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] font-black text-xs sm:text-sm inline-flex items-center gap-2 shadow-lg shadow-[#0F2A4A]/30 transition-all cursor-pointer active:scale-95 hover:brightness-105"
          >
            <UserPlus className="w-4.5 h-4.5 stroke-[2.5]" />
            <span>+ {t('addStudent')}</span>
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="classy-card p-8 sm:p-12 text-center text-[#5F7083] space-y-3 flex flex-col items-center bg-[#FFFFFF]">
          <div className="w-16 h-16 rounded-3xl bg-[#E1EBEC]/15 border border-[#E1EBEC] flex items-center justify-center shadow-inner">
            {activeTabType === 'archived' ? (
              <Archive className="w-8 h-8 text-[#17375E]" />
            ) : (
              <Search className="w-8 h-8 text-[#0F2A4A]" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-sm sm:text-base text-[#0F2A4A]">
              {activeTabType === 'archived'
                ? (isEn ? 'No matching archived students' : 'لا يوجد طلاب مطابقين في الأرشيف')
                : (isEn ? 'No results match your search' : 'لا توجد نتائج مطابقة لبحثك')}
            </h3>
            <p className="text-xs text-[#5F7083] font-medium">
              {isEn ? 'Try changing search terms or resetting filters' : 'جرّب تغيير كلمات البحث أو إعادة ضبط خيارات التصفية'}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl bg-[#E1EBEC]/25 text-[#17375E] font-bold text-xs hover:bg-[#17375E] hover:text-[#FFFFFF] transition-all cursor-pointer"
            >
              {t('resetFilters')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStudents.map((student) => {
            const data = studentDataMap.get(student.id);
            const studentGroups = data?.studentGroups || [];
            const privateEnrollments = data?.privateEnrollments || [];
            const balance = data?.balance ?? 0;
            const isSelected = selectedStudentIds.has(student.id);
            const isStudentArchived = student.status === 'archived';

            // Calculate student attendance statistics
            const studentAtt = allAttendance.filter((a) => a.studentId === student.id);
            const presentCount = studentAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
            const absentCount = studentAtt.filter(
              (a) => a.status === 'absent' || a.status === 'absent_charged' || a.status === 'absent_free' || a.status === 'excused'
            ).length;
            const attendancePercentage = studentAtt.length > 0 ? Math.round((presentCount / studentAtt.length) * 100) : null;

            const isPrivateOnly = data?.isPrivateOnly || false;
            const isGroupAndPrivate = data?.isGroupAndPrivate || false;

            return (
              <div
                key={student.id}
                onClick={() => {
                  if (isSelectionMode && !isStudentArchived) {
                    toggleSelectStudent(student.id);
                  } else {
                    onOpenStudentProfile(student);
                  }
                }}
                className={`classy-card classy-card-hover p-4 sm:p-4.5 transition-all cursor-pointer space-y-3.5 active:scale-[0.99] relative overflow-hidden group ${
                  isSelected
                    ? 'border-[#17375E] bg-gradient-to-r from-[#E1EBEC]/50 to-[#FFFFFF] ring-2 ring-[#17375E]/40 shadow-md'
                    : isStudentArchived
                    ? 'bg-[#E1EBEC]/15 border-[#E1EBEC] opacity-90'
                    : 'hover:border-[#17375E]/50 bg-[#FFFFFF]'
                }`}
              >
                {/* Top Section: Avatar + Name + Badges + Financial Pill */}
                <div className="flex items-start justify-between gap-3">
                  {/* Left Column: Selection Checkbox + Avatar + Bio */}
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Checkbox for Selection Mode */}
                    {isSelectionMode && !isStudentArchived && (
                      <button
                        type="button"
                        onClick={(e) => toggleSelectStudent(student.id, e)}
                        className={`w-6 h-6 rounded-xl flex items-center justify-center border transition-all shrink-0 mt-2.5 ${
                          isSelected
                            ? 'bg-[#17375E] border-[#17375E] text-[#FFFFFF] shadow-xs'
                            : 'bg-[#FFFFFF] border-[#E1EBEC] text-transparent hover:border-[#17375E]'
                        }`}
                      >
                        <CheckCheck className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    )}

                    {/* Student Avatar */}
                    <div className="shrink-0 pt-0.5">
                      <StudentAvatar student={student} size="md" showFrame={true} showBadge={true} />
                    </div>

                    {/* Student Identity & Meta */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-sm sm:text-base text-[#0F2A4A] truncate group-hover:text-[#17375E] transition-colors">
                          {student.name}
                        </h3>

                        {/* Status Badges */}
                        {isStudentArchived ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#E1EBEC]/25 text-[#0F2A4A] border border-[#0F2A4A]/50 inline-flex items-center gap-1 shadow-2xs">
                            <Archive className="w-3 h-3 text-[#0F2A4A]" />
                            <span>{isEn ? 'Archived Student' : 'طالب مؤرشف'}</span>
                          </span>
                        ) : isPrivateOnly ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#E1EBEC]/15 text-[#0F2A4A] border border-[#E1EBEC] inline-flex items-center gap-1 shadow-2xs">
                            <Zap className="w-3 h-3 text-[#0F2A4A]" />
                            <span>{isEn ? 'Private Only' : 'درس خاص فقط'}</span>
                          </span>
                        ) : isGroupAndPrivate ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#E1EBEC]/25 text-[#17375E] border border-[#E1EBEC] inline-flex items-center gap-1 shadow-2xs">
                            <Layers className="w-3 h-3 text-[#17375E]" />
                            <span>{isEn ? 'Groups + Private' : 'مجموعات + خاص'}</span>
                          </span>
                        ) : null}
                      </div>

                      {/* Stage, School, and Contact details */}
                      <div className="flex items-center gap-2 text-xs text-[#5F7083] font-medium flex-wrap">
                        {student.gradeLevel && (
                          <span className="text-[#0F2A4A] font-bold bg-[#E1EBEC]/15 px-2 py-0.5 rounded-lg border border-[#E1EBEC]">
                            {getLocalizedStageName(student.gradeLevel)}
                          </span>
                        )}

                        {student.school && (
                          <span className="truncate max-w-[140px] text-[#5F7083] flex items-center gap-1">
                            <School className="w-3 h-3 text-[#17375E]" />
                            <span>{student.school}</span>
                          </span>
                        )}

                        {student.phone && (
                          <span dir="ltr" className="font-mono text-[11px] text-[#5F7083] bg-[#E1EBEC]/15 px-1.5 py-0.5 rounded border border-[#E1EBEC]/70">
                            {student.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Financial Badge or Restore Button */}
                  <div className="shrink-0 text-left">
                    {isStudentArchived ? (
                      <button
                        type="button"
                        onClick={(e) => handleRestore(student, e)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#E1EBEC]/65 hover:bg-[#E1EBEC]/35 text-[#0F2A4A] border border-[#17375E]/60 font-black text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                        title={isEn ? 'Restore student to active list' : 'استعادة الطالب وإعادته للقائمة النشطة'}
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#17375E]" />
                        <span>{t('restore')}</span>
                      </button>
                    ) : (
                      <div className="space-y-1 text-left">
                        <span
                          className={`text-xs font-black px-3 py-1 rounded-xl inline-block border ${
                            balance < 0
                              ? 'bg-[#E1EBEC]/15 text-[#0F2A4A] border-[#E1EBEC] shadow-2xs'
                              : balance > 0
                              ? 'bg-[#E1EBEC]/65 text-[#0F2A4A] border-[#17375E]/50 shadow-2xs'
                              : 'bg-[#E1EBEC]/15 text-[#0F2A4A] border-[#E1EBEC]'
                          }`}
                        >
                          {balance < 0
                            ? `${Math.abs(balance)} ${t('currency')} ${t('hasDue')}`
                            : balance > 0
                            ? `+${balance} ${t('currency')} ${t('hasCredit')}`
                            : t('settled')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Middle Row: Enrolled Groups & Private Lessons */}
                {(studentGroups.length > 0 || privateEnrollments.length > 0) && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#E1EBEC]/80">
                    {/* Regular Groups */}
                    {studentGroups.map(({ group, enrollment }) => (
                      <span
                        key={enrollment.id}
                        className="text-[11px] font-bold bg-[#E1EBEC]/15 border border-[#E1EBEC] text-[#0F2A4A] px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: group.accentColor || '#17375E' }}
                        />
                        <span>{group.name}</span>
                        <span className="text-[#5F7083] font-normal">
                          ({enrollment.customPrice || group.defaultPrice || 0} {t('currency')})
                        </span>
                      </span>
                    ))}

                    {/* Private Lessons */}
                    {privateEnrollments.map(({ group, enrollment }) => (
                      <span
                        key={enrollment.id}
                        className="text-[11px] font-bold bg-[#E1EBEC]/15 border border-[#E1EBEC] text-[#0F2A4A] px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs"
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#0F2A4A] shadow-xs" />
                        <span>{isEn ? 'Private Lesson' : 'درس خاص'} {group?.subject ? `(${group.subject})` : ''}</span>
                        <span className="text-[#0F2A4A]/85 font-normal">
                          ({enrollment.customPrice || enrollment.hourlyRate || group?.defaultPrice || 0} {t('currency')})
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Bottom Row: Attendance Summary & Quick Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-[#E1EBEC]/70">
                  {/* Attendance & Stats Mini-Pill */}
                  <div className="flex items-center gap-2 text-xs text-[#5F7083] font-medium flex-wrap">
                    {attendancePercentage !== null ? (
                      <div className="flex items-center gap-1.5 bg-[#E1EBEC]/15 border border-[#E1EBEC] px-2.5 py-1 rounded-xl">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            attendancePercentage >= 85
                              ? 'bg-[#E1EBEC]/650'
                              : attendancePercentage >= 70
                              ? 'bg-[#E1EBEC]/700'
                              : 'bg-[#0F2A4A]'
                          }`}
                        />
                        <span className="font-bold text-[#0F2A4A]">{attendancePercentage}% {isEn ? 'Attendance' : 'حضور'}</span>
                        <span className="text-[#5F7083] text-[11px]">
                          ({presentCount} {isEn ? 'Present' : 'حضور'} • {absentCount} {isEn ? 'Absent' : 'غياب'})
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#5F7083]">{isEn ? 'No sessions recorded yet' : 'لم يتم تسجيل حصص بعد'}</span>
                    )}

                    {/* Parent details if available */}
                    {student.parentName && (
                      <span className="text-[11px] text-[#5F7083] flex items-center gap-1">
                        <User className="w-3 h-3 text-[#17375E]" />
                        <span>{isEn ? 'Parent:' : 'ولي الأمر:'} {student.parentName}</span>
                      </span>
                    )}
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    {/* Quick Phone Call */}
                    {(student.phone || student.parentPhone) && (
                      <a
                        href={`tel:${student.phone || student.parentPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-xl bg-[#E1EBEC]/15 hover:bg-[#E1EBEC]/35 text-[#5F7083] hover:text-[#17375E] border border-[#E1EBEC] transition-all cursor-pointer shadow-2xs"
                        title={isEn ? 'Quick Phone Call' : 'اتصال هاتفي سريع'}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {(student.phone || student.parentPhone) && (
                      <a
                        href={`https://wa.me/${(student.phone || student.parentPhone)?.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-xl bg-[#E1EBEC]/65 hover:bg-[#E1EBEC]/35 text-[#17375E] border border-[#17375E]/50 transition-all cursor-pointer shadow-2xs"
                        title={isEn ? 'WhatsApp Message' : 'مراسلة واتساب'}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* Record Payment Button */}
                    {!isStudentArchived && onOpenAddPayment && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAddPayment(student);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-[#E1EBEC]/15 hover:bg-[#E1EBEC]/35 text-[#0F2A4A] hover:text-[#17375E] border border-[#E1EBEC] text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                        title={isEn ? 'Record payment or fee' : 'تسجيل دفعة أو تحصيل مالي'}
                      >
                        <CreditCard className="w-3.5 h-3.5 text-[#17375E]" />
                        <span>{isEn ? 'Payment' : 'دفعة'}</span>
                      </button>
                    )}

                    {/* Edit Student Button */}
                    {!isStudentArchived && onOpenEditStudent && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEditStudent(student);
                        }}
                        className="p-1.5 rounded-xl bg-[#E1EBEC]/15 hover:bg-[#E1EBEC]/35 text-[#5F7083] hover:text-[#17375E] border border-[#E1EBEC] transition-all cursor-pointer shadow-2xs active:scale-95"
                        title={isEn ? 'Edit student data' : 'تعديل بيانات الطالب'}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* View Full Profile Dossier */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStudentProfile(student);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#17375E] hover:bg-[#0F2A4A] text-[#FFFFFF] text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                    >
                      <span>{t('profile')}</span>
                      <ChevronIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Action Bar when students are selected in bulk mode */}
      {isSelectionMode && selectedCount > 0 && activeTabType === 'active' && (
        <div className="fixed bottom-20 inset-x-0 z-40 max-w-lg mx-auto px-4 pb-2 animate-in slide-in-from-bottom-3 duration-200">
          <div className="bg-[#17375E] text-[#FFFFFF] p-3.5 rounded-2xl shadow-2xl flex items-center justify-between border border-[#0F2A4A]/40">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] flex items-center justify-center font-black text-xs shadow-md">
                {selectedCount}
              </span>
              <span className="font-bold text-xs sm:text-sm">
                {t('selectedCountShort', { count: selectedCount.toString() })}
              </span>
            </div>

            <button
              type="button"
              onClick={handleBulkAddSession}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#17375E] to-[#0F2A4A] text-[#FFFFFF] font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-[#0F2A4A]/40 active:scale-95 transition-all cursor-pointer hover:brightness-105"
            >
              <CalendarCheck2 className="w-4 h-4" />
              <span>{t('addBulkSession')} ({selectedCount})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
