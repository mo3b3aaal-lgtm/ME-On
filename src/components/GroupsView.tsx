import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  Plus,
  Users,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  AlertCircle,
  Sparkles,
  UserPlus,
  X,
  CheckCircle2,
  CalendarCheck2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Filter,
  Zap,
  Activity,
  ArrowUpRight,
  School,
  BookOpen,
} from 'lucide-react';
import { Group, Student, Session, Payment } from '../types';
import { db } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { ClassyOwlMascot } from './ClassyOwlMascot';
import {
  getArabicDayForDate,
  getTimesForDayInGroup,
  formatTimeDisplay,
  getWeekdayIndex,
  getLocalizedWeekdayName,
} from '../utils/schedule';

interface GroupsViewProps {
  groups: Group[];
  allStudents: Student[];
  sessions?: Session[];
  payments?: Payment[];
  onOpenAddGroup: () => void;
  onOpenGroupProfile: (group: Group) => void;
  onEditGroup?: (group: Group) => void;
  onOpenAddSession?: (defaultGroupId?: string, defaultDate?: string) => void;
  onOpenAddStudent?: () => void;
  onOpenAddPayment?: (student?: Student, enrollmentId?: string) => void;
  onOpenAttendanceModal?: (session: Session) => void;
  onOpenStudentProfile?: (student: Student) => void;
  onOpenBulkAddSession?: (students: Student[], groupId?: string) => void;
  onDataChanged?: () => void;
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  groups,
  allStudents,
  sessions = [],
  payments = [],
  onOpenAddGroup,
  onOpenGroupProfile,
  onEditGroup,
  onOpenAddSession,
  onOpenAddStudent,
  onOpenAddPayment,
  onOpenAttendanceModal,
  onOpenStudentProfile,
  onOpenBulkAddSession,
  onDataChanged,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'group' | 'private' | 'today'>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayArabicDay = useMemo(() => getArabicDayForDate(new Date()), []);

  const regularGroups = useMemo(() => groups.filter((g) => g.type !== 'private'), [groups]);
  const privateServices = useMemo(() => groups.filter((g) => g.type === 'private'), [groups]);

  // Pre-index group enrollments, private students, and statistics in a single memoized pass
  const groupDataMap = useMemo(() => {
    const allEnrs = db.getEnrollments();
    const studentsMap = new Map<string, Student>(allStudents.map((s) => [s.id, s]));

    const map = new Map<
      string,
      {
        enrollments: typeof allEnrs;
        privateStudent: Student | null;
        stats: {
          studentCount: number;
          totalSessions: number;
          completedSessions: number;
          attendanceRate: number;
          totalRevenue: number;
          totalDue: number;
          remaining: number;
        };
      }
    >();

    groups.forEach((group) => {
      const enrs = allEnrs.filter((e) => e.groupId === group.id && e.status !== 'stopped');
      const isPrivate = group.type === 'private';
      const privStu = isPrivate && enrs[0] ? studentsMap.get(enrs[0].studentId) || null : null;
      const stats = db.calculateGroupStats(group.id);

      map.set(group.id, {
        enrollments: enrs,
        privateStudent: privStu,
        stats,
      });
    });

    return map;
  }, [groups, allStudents, sessions, payments]);

  // Compute all enrollments across regular groups
  const totalEnrolledStudentsCount = useMemo(() => {
    const studentIds = new Set<string>();
    regularGroups.forEach((g) => {
      const gData = groupDataMap.get(g.id);
      gData?.enrollments.forEach((e) => {
        studentIds.add(e.studentId);
      });
    });
    return studentIds.size;
  }, [regularGroups, groupDataMap]);

  // Compute groups that have sessions scheduled or recurring today
  const groupsWithTodayClass = useMemo(() => {
    return groups.filter((g) => {
      // 1. Direct session record today
      const hasDirectSessionToday = sessions.some(
        (s) => s.groupId === g.id && s.date === todayStr && s.status !== 'cancelled'
      );
      if (hasDirectSessionToday) return true;

      // 2. Schedule recurring day match
      const todayIdx = getWeekdayIndex(todayArabicDay);
      const isScheduledToday = (g.scheduleDays || []).some((day) => {
        return getWeekdayIndex(day) === todayIdx;
      });
      return isScheduledToday;
    });
  }, [groups, sessions, todayStr, todayArabicDay]);

  // Collect distinct grade levels & subjects for dropdown filters
  const gradeLevels = useMemo(
    () => Array.from(new Set(groups.map((g) => g.gradeLevel).filter(Boolean))),
    [groups]
  );
  const subjects = useMemo(
    () => Array.from(new Set(groups.map((g) => g.subject).filter(Boolean))),
    [groups]
  );

  // Filter groups
  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      const isPrivate = group.type === 'private';
      const gData = groupDataMap.get(group.id);
      const privateStudent = gData?.privateStudent || null;

      const displayName = isPrivate && privateStudent ? privateStudent.name : group.name;

      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesSearch =
          displayName.toLowerCase().includes(q) ||
          group.name.toLowerCase().includes(q) ||
          group.subject.toLowerCase().includes(q) ||
          group.gradeLevel.toLowerCase().includes(q) ||
          (group.roomOrLocation && group.roomOrLocation.toLowerCase().includes(q));

        if (!matchesSearch) return false;
      }

      // 2. Tab Filter
      if (typeFilter === 'group' && group.type !== 'group') return false;
      if (typeFilter === 'private' && group.type !== 'private') return false;
      if (typeFilter === 'today') {
        const isTodayGroup = groupsWithTodayClass.some((g) => g.id === group.id);
        if (!isTodayGroup) return false;
      }

      // 3. Grade Filter
      if (selectedGradeFilter !== 'all' && group.gradeLevel !== selectedGradeFilter) {
        return false;
      }

      // 4. Subject Filter
      if (selectedSubjectFilter !== 'all' && group.subject !== selectedSubjectFilter) {
        return false;
      }

      return true;
    });
  }, [
    groups,
    groupDataMap,
    searchQuery,
    typeFilter,
    selectedGradeFilter,
    selectedSubjectFilter,
    groupsWithTodayClass,
  ]);

  const hasActiveFilters =
    searchQuery !== '' ||
    typeFilter !== 'all' ||
    selectedGradeFilter !== 'all' ||
    selectedSubjectFilter !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setSelectedGradeFilter('all');
    setSelectedSubjectFilter('all');
  };

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-3.5 sm:p-5 space-y-4 text-[#16324F] pb-32 bg-[#FFFFFF] relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Ambient background glows matching Classy visual identity */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#0A3D62]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#0A3D62]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-[#16324F]/6 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* =========================================================================
          1. GROUPS HERO HEADER
          ========================================================================= */}
      <div className="rounded-[24px] bg-gradient-to-r from-[#0A3D62] via-[#16324F] to-[#6F7882] p-5 sm:p-6 text-[#FFFFFF] relative overflow-hidden shadow-xl border border-[#C7CDD3]/15">
        {/* Soft internal gradient orbs */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#0A3D62]/35 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-[#16324F]/30 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#0A3D62] via-[#16324F] to-[#0A3D62] p-0.5 shadow-lg shadow-[#0A3D62]/35 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#0A3D62] flex items-center justify-center text-[#FFFFFF]">
                <Layers className="w-6 h-6 text-[#FFFFFF]" />
              </div>
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#C7CDD3]/90 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C7CDD3]" />
                  <span>{isEn ? 'Groups & Academic Classes' : 'المجموعات والحصص الدراسية'}</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#FFFFFF] tracking-tight flex items-center gap-2.5 truncate">
                <span>{t('groupsTitle')}</span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#FFFFFF]/20 text-[#FFFFFF] border border-[#C7CDD3]/25 shadow-xs">
                  {regularGroups.length}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#C7CDD3]/85 font-medium truncate">
                {isEn
                  ? 'Organize study groups, manage schedules, and track attendance & dues'
                  : 'تنظيم المجموعات الدراسية، متابعة المواعيد، ورصد حضور ومستحقات الطلاب'}
              </p>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#C7CDD3]/20 justify-end">
            <button
              type="button"
              onClick={onOpenAddGroup}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-[#16324F]/40 transition-all active:scale-95 cursor-pointer hover:brightness-105"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{t('createGroupBtn')}</span>
            </button>
          </div>
        </div>

        {/* Compact Statistics Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-4 mt-4 border-t border-[#C7CDD3]/20 text-center">
          <div className="bg-[#FFFFFF]/10 backdrop-blur-md rounded-xl p-2 border border-[#C7CDD3]/15">
            <span className="text-[10px] text-[#C7CDD3]/80 block font-bold">{t('activeGroups')}</span>
            <span className="text-base sm:text-lg font-black text-[#FFFFFF]">{regularGroups.length}</span>
          </div>
          <div className="bg-[#FFFFFF]/10 backdrop-blur-md rounded-xl p-2 border border-[#C7CDD3]/15">
            <span className="text-[10px] text-[#C7CDD3]/80 block font-bold">{isEn ? 'Group Students' : 'طلاب المجموعات'}</span>
            <span className="text-base sm:text-lg font-black text-[#FFFFFF]">{totalEnrolledStudentsCount}</span>
          </div>
          <div className="bg-[#FFFFFF]/10 backdrop-blur-md rounded-xl p-2 border border-[#C7CDD3]/15">
            <span className="text-[10px] text-[#C7CDD3]/80 block font-bold">{isEn ? "Today's Classes" : 'حصص اليوم'}</span>
            <span className="text-base sm:text-lg font-black text-[#FFFFFF]">{groupsWithTodayClass.length}</span>
          </div>
          <div className="hidden sm:block bg-[#FFFFFF]/10 backdrop-blur-md rounded-xl p-2 border border-[#C7CDD3]/15">
            <span className="text-[10px] text-[#C7CDD3]/80 block font-bold">{t('privateLessons')}</span>
            <span className="text-base sm:text-lg font-black text-[#C7CDD3]">{privateServices.length}</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. SEARCH & FILTERS
          ========================================================================= */}
      <div className="classy-card p-3.5 sm:p-4 space-y-3 bg-[#FFFFFF]">
        {/* Search Bar */}
        <div className="relative">
          <Search
            className={`w-4.5 h-4.5 text-[#6F7882] absolute top-3.5 ${
              isRTL ? 'right-3.5' : 'left-3.5'
            }`}
          />
          <input
            type="text"
            placeholder={isEn ? 'Search by group name, subject, stage, or location...' : 'البحث باسم المجموعة، المادة، المرحلة، أو مكان الحصة...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-[#C7CDD3]/15 border border-[#C7CDD3] rounded-2xl py-3 text-xs sm:text-sm text-[#16324F] placeholder-[#6F7882]/70 focus:outline-none focus:border-[#0A3D62] focus:bg-[#FFFFFF] font-medium transition-all shadow-inner ${
              isRTL ? 'pr-11 pl-9' : 'pl-11 pr-9'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-3 text-[#6F7882] hover:text-[#16324F] p-1 rounded-full hover:bg-[#C7CDD3]/35 transition-colors ${
                isRTL ? 'left-3' : 'right-3'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Segmented Control Tabs */}
        <div className="classy-card p-1 flex items-center gap-1 bg-[#C7CDD3]/15 border-[#C7CDD3]">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`flex-1 py-2 px-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] shadow-sm'
                : 'text-[#6F7882] hover:text-[#16324F]'
            }`}
          >
            <span>{t('all')}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${typeFilter === 'all' ? 'bg-[#FFFFFF]/20 text-[#FFFFFF]' : 'bg-[#C7CDD3]/25 text-[#0A3D62]'}`}>
              {groups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('group')}
            className={`flex-1 py-2 px-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              typeFilter === 'group'
                ? 'bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] shadow-sm'
                : 'text-[#6F7882] hover:text-[#16324F]'
            }`}
          >
            <span>{isEn ? 'Groups' : 'مجموعات'}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${typeFilter === 'group' ? 'bg-[#FFFFFF]/20 text-[#FFFFFF]' : 'bg-[#C7CDD3]/25 text-[#0A3D62]'}`}>
              {regularGroups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('private')}
            className={`flex-1 py-2 px-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              typeFilter === 'private'
                ? 'bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] shadow-sm'
                : 'text-[#6F7882] hover:text-[#16324F]'
            }`}
          >
            <span>{isEn ? 'Private' : 'خاص'}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${typeFilter === 'private' ? 'bg-[#FFFFFF]/20 text-[#FFFFFF]' : 'bg-[#C7CDD3]/15 text-[#16324F]'}`}>
              {privateServices.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('today')}
            className={`flex-1 py-2 px-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              typeFilter === 'today'
                ? 'bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] shadow-sm'
                : 'text-[#6F7882] hover:text-[#16324F]'
            }`}
          >
            <span>{t('today')}</span>
            {groupsWithTodayClass.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${typeFilter === 'today' ? 'bg-[#FFFFFF]/25 text-[#FFFFFF]' : 'bg-[#C7CDD3]/15 text-[#16324F]'}`}>
                {groupsWithTodayClass.length}
              </span>
            )}
          </button>
        </div>

        {/* Dropdown Filters Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[#6F7882] text-[11px] font-bold shrink-0">
              <Filter className="w-3.5 h-3.5 text-[#0A3D62]" />
              <span>{isEn ? 'Filter:' : 'تصفية:'}</span>
            </div>

            <select
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 border border-[#C7CDD3] rounded-xl px-3 py-1.5 text-xs text-[#16324F] font-bold focus:outline-none focus:border-[#0A3D62] cursor-pointer transition-colors"
            >
              <option value="all">{isEn ? 'All Stages' : 'كل المراحل الدراسية'}</option>
              {gradeLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {getLocalizedStageName(lvl)}
                </option>
              ))}
            </select>

            {subjects.length > 1 && (
              <select
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 border border-[#C7CDD3] rounded-xl px-3 py-1.5 text-xs text-[#16324F] font-bold focus:outline-none focus:border-[#0A3D62] cursor-pointer transition-colors"
              >
                <option value="all">{isEn ? 'All Subjects' : 'كل المواد'}</option>
                {subjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-xl bg-[#C7CDD3]/25 text-[#0A3D62] font-bold text-xs hover:bg-[#0A3D62] hover:text-[#FFFFFF] transition-all cursor-pointer"
            >
              {t('resetFilters')}
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          3. GROUP CARDS (Bento Grid)
          ========================================================================= */}
      {groups.length === 0 ? (
        <div className="classy-card p-8 sm:p-12 text-center space-y-4 flex flex-col items-center justify-center relative overflow-hidden bg-[#FFFFFF]">
          <div className="w-28 h-28 flex items-center justify-center">
            <ClassyOwlMascot size="lg" glow={true} pose="teacher" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="font-black text-base sm:text-lg text-[#16324F]">
              {t('noGroupsFound')}
            </h3>
            <p className="text-xs sm:text-sm text-[#6F7882] font-medium leading-relaxed">
              {isEn ? 'Start by creating your first group and organize sessions and students easily.' : 'ابدأ بإضافة أول مجموعة ونظّم حصصك وطلابك بسهولة.'}
            </p>
          </div>
          <button
            onClick={onOpenAddGroup}
            className="mt-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#0A3D62] to-[#16324F] text-[#FFFFFF] font-black text-xs sm:text-sm inline-flex items-center gap-2 shadow-lg shadow-[#16324F]/30 transition-all cursor-pointer active:scale-95 hover:brightness-105"
          >
            <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
            <span>+ {t('createGroupBtn')}</span>
          </button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="classy-card p-8 sm:p-12 text-center text-[#6F7882] space-y-3 flex flex-col items-center bg-[#FFFFFF]">
          <div className="w-16 h-16 rounded-3xl bg-[#C7CDD3]/15 border border-[#C7CDD3] flex items-center justify-center shadow-inner">
            <AlertCircle className="w-8 h-8 text-[#16324F]" />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-sm sm:text-base text-[#16324F]">
              {isEn ? 'No groups match your search' : 'لا توجد مجموعات مطابقة لبحثك'}
            </h3>
            <p className="text-xs text-[#6F7882] font-medium">
              {isEn ? 'Try changing your search terms or resetting filters' : 'جرّب تغيير كلمات البحث أو إعادة ضبط خيارات التصفية'}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl bg-[#C7CDD3]/25 text-[#0A3D62] font-bold text-xs hover:bg-[#0A3D62] hover:text-[#FFFFFF] transition-all cursor-pointer"
            >
              {t('resetFilters')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredGroups.map((group) => {
            const gData = groupDataMap.get(group.id);
            const enrollments = gData?.enrollments || [];
            const isPrivate = group.type === 'private';
            const privateStudent = gData?.privateStudent || null;
            const groupStats = gData?.stats || {
              studentCount: 0,
              totalSessions: 0,
              completedSessions: 0,
              attendanceRate: 100,
              totalRevenue: 0,
              totalDue: 0,
              remaining: 0,
            };
            const groupSessions = sessions.filter((s) => s.groupId === group.id && s.status !== 'cancelled');

            // Check if group has a class today
            const todaySession = sessions.find((s) => s.groupId === group.id && s.date === todayStr);
            const hasClassToday = groupsWithTodayClass.some((g) => g.id === group.id);

            const displayTitle = isPrivate
              ? (privateStudent ? `${isEn ? 'Private Lesson — ' : 'درس خاص — '}${privateStudent.name}` : (isEn ? 'Private Lesson' : 'درس خاص'))
              : group.name;

            const themeColor = group.accentColor || (isPrivate ? '#16324F' : '#0A3D62');

            // Format billing label
            const billingLabel =
              group.billingType === 'monthly'
                ? (isEn ? 'Monthly' : 'شهري')
                : group.billingType === 'package'
                ? (isEn ? `Package (${group.packageSessionsCount || 8} sessions)` : `باقة (${group.packageSessionsCount || 8} حصص)`)
                : group.billingType === 'hourly'
                ? (isEn ? 'Hourly Billing' : 'محاسبة بالساعة')
                : (isEn ? 'Per Session' : 'دفع بالحصة');

            const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

            return (
              <div
                key={group.id}
                onClick={() => onOpenGroupProfile(group)}
                className="classy-card classy-card-hover p-4 sm:p-5 transition-all cursor-pointer space-y-3.5 active:scale-[0.99] relative overflow-hidden group bg-[#FFFFFF] hover:border-[#0A3D62]/50"
              >
                {/* Decorative Top Accent Line */}
                <div
                  className="absolute top-0 inset-x-0 h-1.5 transition-all group-hover:h-2"
                  style={{ backgroundColor: themeColor }}
                />

                {/* Card Top: Group Name + Badges */}
                <div className="flex items-start justify-between gap-3 pt-1">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Glowing Group Icon */}
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-[#FFFFFF] text-base shadow-md shrink-0 border border-[#C7CDD3]/25 mt-0.5"
                      style={{ backgroundColor: themeColor }}
                    >
                      {isPrivate ? <Zap className="w-5 h-5 text-[#FFFFFF]" /> : <Layers className="w-5 h-5 text-[#FFFFFF]" />}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-sm sm:text-base text-[#16324F] truncate group-hover:text-[#0A3D62] transition-colors">
                          {displayTitle}
                        </h3>

                        {/* Dynamic Semantic Session Status Badges */}
                        {todaySession ? (
                          todaySession.status === 'completed' ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#C7CDD3]/65 text-[#16324F] border border-[#0A3D62]/60 inline-flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-[#0A3D62]" />
                              <span>{isEn ? 'Recorded Today' : 'تم رصد اليوم'}</span>
                            </span>
                          ) : todaySession.status === 'cancelled' ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3] inline-flex items-center gap-1 shadow-2xs">
                              <AlertCircle className="w-3 h-3 text-[#16324F]" />
                              <span>{isEn ? 'Today Cancelled' : 'حصة اليوم ملغاة'}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#C7CDD3]/70 text-[#16324F] border border-[#16324F]/50 inline-flex items-center gap-1 shadow-2xs animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#C7CDD3]/700" />
                              <span>{isEn ? 'Today Scheduled' : 'حصة اليوم مجدولة'}</span>
                            </span>
                          )
                        ) : hasClassToday ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#C7CDD3]/70 text-[#16324F] border border-[#16324F]/50 inline-flex items-center gap-1 shadow-2xs animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#C7CDD3]/700" />
                            <span>{isEn ? "Today's Class" : 'موعد اليوم'}</span>
                          </span>
                        ) : null}

                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            isPrivate
                              ? 'bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]'
                              : 'bg-[#C7CDD3]/25 text-[#16324F] border border-[#C7CDD3]'
                          }`}
                        >
                          {isPrivate ? (isEn ? 'Private' : 'درس خاص') : (isEn ? 'Group' : 'مجموعة دراسية')}
                        </span>
                      </div>

                      {/* Subject and Stage Meta */}
                      <div className="flex items-center gap-2 text-xs text-[#6F7882] font-medium flex-wrap">
                        <span className="text-[#16324F] font-bold bg-[#C7CDD3]/15 px-2 py-0.5 rounded-lg border border-[#C7CDD3]">
                          {group.subject}
                        </span>
                        <span>•</span>
                        <span>{getLocalizedStageName(group.gradeLevel)}</span>
                        {group.roomOrLocation && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[130px] flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#16324F]" />
                              <span>{group.roomOrLocation}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pricing Badge */}
                  <div className="shrink-0 text-left">
                    <span className="text-xs font-black px-3 py-1 rounded-xl inline-block bg-[#C7CDD3]/65 text-[#16324F] border border-[#0A3D62]/50 shadow-2xs">
                      {group.defaultPrice} {t('currency')}
                    </span>
                    <span className="text-[10px] text-[#6F7882] font-bold block mt-0.5 text-left">
                      {billingLabel}
                    </span>
                  </div>
                </div>

                {/* Dashboard-Inspired Session Schedule Timeline Strip */}
                <div className="bg-[#C7CDD3]/15 p-3 rounded-2xl border border-[#C7CDD3] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#6F7882] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#0A3D62]" />
                      <span>{isEn ? 'Weekly Schedule:' : 'مواعيد الحصص الأسبوعية:'}</span>
                    </span>
                    <span className="font-black text-[#16324F] flex items-center gap-1 text-[11px]">
                      <Users className="w-3.5 h-3.5 text-[#0A3D62]" />
                      <span>
                        {isPrivate
                          ? (privateStudent ? privateStudent.name : (isEn ? 'Private Student' : 'طالب خاص'))
                          : (isEn ? `${enrollments.length} Enrolled` : `${enrollments.length} طلاب مسجلين`)}
                      </span>
                    </span>
                  </div>

                  {/* Multiple Session Times Timeline Entries */}
                  {group.scheduleDays && group.scheduleDays.length > 0 ? (
                    <div className="space-y-1.5">
                      {group.scheduleDays.map((day) => {
                        const dayTimes = getTimesForDayInGroup(group, day);
                        const isToday = getWeekdayIndex(day) === getWeekdayIndex(todayArabicDay);
                        const localizedDay = getLocalizedWeekdayName(day);

                        return (
                          <div
                            key={day}
                            className={`p-2 sm:p-2.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs ${
                              isToday
                                ? 'bg-gradient-to-r from-[#FFFFFF] to-[#FFFFFF] border-[#0A3D62]/60 ring-1 ring-[#0A3D62]/40'
                                : 'bg-[#FFFFFF] border-[#C7CDD3]'
                            }`}
                          >
                            {/* Day Header with Pulse on Today */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isToday ? 'bg-[#C7CDD3]/650 animate-pulse' : 'bg-[#0A3D62]'
                                }`}
                              />
                              <span className={`text-xs font-black ${isToday ? 'text-[#16324F]' : 'text-[#16324F]'}`}>
                                {localizedDay}
                              </span>
                              {isToday && (
                                <span className="text-[9px] font-black px-2 py-0.2 rounded-full bg-[#C7CDD3]/25 text-[#16324F] border border-[#0A3D62]/60 shadow-2xs">
                                  {t('today')}
                                </span>
                              )}
                              {dayTimes.length > 1 && (
                                <span className="text-[9px] font-bold text-[#6F7882]">
                                  {isEn ? `(${dayTimes.length} slots)` : `(${dayTimes.length} فترات)`}
                                </span>
                              )}
                            </div>

                            {/* Session Times Slot Entries */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {dayTimes.length > 0 ? (
                                dayTimes.map((time, tIdx) => (
                                  <div
                                    key={tIdx}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                                      isToday
                                        ? 'bg-[#C7CDD3]/25 text-[#16324F] border-[#0A3D62]/60 shadow-2xs'
                                        : 'bg-[#C7CDD3]/15 text-[#16324F] border-[#C7CDD3] shadow-2xs'
                                    }`}
                                  >
                                    <Clock className={`w-3 h-3 ${isToday ? 'text-[#16324F]' : 'text-[#0A3D62]'}`} />
                                    <span className="font-mono font-black text-[11px]">
                                      {formatTimeDisplay(time, isRTL)}
                                    </span>
                                    {dayTimes.length > 1 && (
                                      <span
                                        className={`text-[9px] px-1.5 py-0.2 rounded-md font-extrabold ${
                                          isToday
                                            ? 'bg-[#C7CDD3]/25 text-[#16324F]'
                                            : 'bg-[#C7CDD3]/25 text-[#0A3D62]'
                                        }`}
                                      >
                                        {isEn ? `Slot ${tIdx + 1}` : `فترة ${tIdx + 1}`}
                                      </span>
                                    )}
                                  </div>
                                ))
                              ) : group.scheduleTime ? (
                                <div className="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-[#C7CDD3]/15 text-[#16324F] border border-[#C7CDD3]">
                                  <Clock className="w-3 h-3 text-[#0A3D62]" />
                                  <span className="font-mono font-black text-[11px]">
                                    {formatTimeDisplay(group.scheduleTime, isRTL)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-[#6F7882]">{isEn ? 'Flexible time' : 'وقت مرن'}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-[#FFFFFF] border border-[#C7CDD3] text-center text-xs text-[#6F7882] font-medium">
                      {isEn ? 'Flexible times by agreement' : 'مواعيد مرنة حسب الاتفاق'}
                    </div>
                  )}
                </div>

                {/* Quick Performance & Financial Health Mini-Bento */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#FFFFFF] p-2 rounded-xl border border-[#C7CDD3]">
                    <span className="text-[10px] text-[#6F7882] block font-bold">{isEn ? 'Completed' : 'الحصص المنفذة'}</span>
                    <strong className="text-xs font-black text-[#16324F]">{groupStats.completedSessions}</strong>
                  </div>
                  <div className="bg-[#FFFFFF] p-2 rounded-xl border border-[#C7CDD3]">
                    <span className="text-[10px] text-[#6F7882] block font-bold">{isEn ? 'Attendance' : 'نسبة الالتزام'}</span>
                    <strong
                      className={`text-xs font-black ${
                        groupStats.attendanceRate >= 85
                          ? 'text-[#16324F]'
                          : groupStats.attendanceRate >= 70
                          ? 'text-[#16324F]'
                          : 'text-[#16324F]'
                      }`}
                    >
                      {groupStats.attendanceRate}%
                    </strong>
                  </div>
                  <div className="bg-[#FFFFFF] p-2 rounded-xl border border-[#C7CDD3]">
                    <span className="text-[10px] text-[#6F7882] block font-bold">{isEn ? 'Collected' : 'المحصل'}</span>
                    <strong className="text-xs font-black text-[#16324F]">
                      {groupStats.totalRevenue} {t('currency')}
                    </strong>
                  </div>
                </div>

                {/* Bottom Row: Quick Action Bar */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#C7CDD3]/80">
                  <div className="flex items-center gap-1.5">
                    {onEditGroup && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditGroup(group);
                        }}
                        className="p-1.5 rounded-xl bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 text-[#6F7882] hover:text-[#0A3D62] border border-[#C7CDD3] transition-all cursor-pointer shadow-2xs active:scale-95"
                        title={isEn ? 'Edit group information' : 'تعديل بيانات المجموعة'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onOpenAddSession && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAddSession(group.id);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-[#C7CDD3]/15 hover:bg-[#C7CDD3]/35 text-[#16324F] hover:text-[#0A3D62] border border-[#C7CDD3] text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                        title={isEn ? 'Schedule session for this group' : 'جدولة حصة جديدة لهذه المجموعة'}
                      >
                        <CalendarCheck2 className="w-3.5 h-3.5 text-[#0A3D62]" />
                        <span>{t('scheduleSessionBtn')}</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenGroupProfile(group);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0A3D62] hover:bg-[#16324F] text-[#FFFFFF] text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                  >
                    <span>{isEn ? 'Group Details' : 'تفاصيل المجموعة'}</span>
                    <ChevronIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
