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
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-3.5 sm:p-5 space-y-4 text-[#191A2E] pb-32 bg-[#F5F6FC] relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Ambient background glows matching Classy visual identity */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#7657F6]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-0 w-80 h-80 bg-[#55C7E8]/8 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-[#FF647C]/6 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* =========================================================================
          1. GROUPS HERO HEADER
          ========================================================================= */}
      <div className="rounded-[24px] bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] p-5 sm:p-6 text-white relative overflow-hidden shadow-xl border border-white/10">
        {/* Soft internal gradient orbs */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#7657F6]/35 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-[#FF647C]/30 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#FF647C] via-[#7657F6] to-[#55C7E8] p-0.5 shadow-lg shadow-[#7657F6]/35 shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#17163D] flex items-center justify-center text-white">
                <Layers className="w-6 h-6 text-[#55C7E8]" />
              </div>
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#E8E7FF]/90 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#55C7E8]" />
                  <span>{isEn ? 'Groups & Academic Classes' : 'المجموعات والحصص الدراسية'}</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5 truncate">
                <span>{t('groupsTitle')}</span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/20 shadow-xs">
                  {regularGroups.length}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#E8E7FF]/85 font-medium truncate">
                {isEn
                  ? 'Organize study groups, manage schedules, and track attendance & dues'
                  : 'تنظيم المجموعات الدراسية، متابعة المواعيد، ورصد حضور ومستحقات الطلاب'}
              </p>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/15 justify-end">
            <button
              type="button"
              onClick={onOpenAddGroup}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-[#FF647C]/40 transition-all active:scale-95 cursor-pointer hover:brightness-105"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{t('createGroupBtn')}</span>
            </button>
          </div>
        </div>

        {/* Compact Statistics Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-4 mt-4 border-t border-white/15 text-center">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/10">
            <span className="text-[10px] text-[#E8E7FF]/80 block font-bold">{t('activeGroups')}</span>
            <span className="text-base sm:text-lg font-black text-white">{regularGroups.length}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/10">
            <span className="text-[10px] text-[#E8E7FF]/80 block font-bold">{isEn ? 'Group Students' : 'طلاب المجموعات'}</span>
            <span className="text-base sm:text-lg font-black text-[#55C7E8]">{totalEnrolledStudentsCount}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/10">
            <span className="text-[10px] text-[#E8E7FF]/80 block font-bold">{isEn ? "Today's Classes" : 'حصص اليوم'}</span>
            <span className="text-base sm:text-lg font-black text-[#FF647C]">{groupsWithTodayClass.length}</span>
          </div>
          <div className="hidden sm:block bg-white/10 backdrop-blur-md rounded-xl p-2 border border-white/10">
            <span className="text-[10px] text-[#E8E7FF]/80 block font-bold">{t('privateLessons')}</span>
            <span className="text-base sm:text-lg font-black text-[#E8E7FF]">{privateServices.length}</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. SEARCH & FILTERS
          ========================================================================= */}
      <div className="classy-card p-3.5 sm:p-4 space-y-3 bg-white">
        {/* Search Bar */}
        <div className="relative">
          <Search
            className={`w-4.5 h-4.5 text-[#74778F] absolute top-3.5 ${
              isRTL ? 'right-3.5' : 'left-3.5'
            }`}
          />
          <input
            type="text"
            placeholder={isEn ? 'Search by group name, subject, stage, or location...' : 'البحث باسم المجموعة، المادة، المرحلة، أو مكان الحصة...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-2xl py-3 text-xs sm:text-sm text-[#191A2E] placeholder-[#74778F]/70 focus:outline-none focus:border-[#7657F6] focus:bg-white font-medium transition-all shadow-inner ${
              isRTL ? 'pr-11 pl-9' : 'pl-11 pr-9'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-3 text-[#74778F] hover:text-[#191A2E] p-1 rounded-full hover:bg-[#E8E7FF]/50 transition-colors ${
                isRTL ? 'left-3' : 'right-3'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Segmented Control Tabs */}
        <div className="classy-card p-1 flex items-center gap-1 bg-[#F6F7FC] border-[#E8E7FF]">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`flex-1 py-2 px-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white shadow-sm'
                : 'text-[#74778F] hover:text-[#17163D]'
            }`}
          >
            <span>{t('all')}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${typeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-[#E8E7FF] text-[#7657F6]'}`}>
              {groups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('group')}
            className={`flex-1 py-2 px-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              typeFilter === 'group'
                ? 'bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white shadow-sm'
                : 'text-[#74778F] hover:text-[#17163D]'
            }`}
          >
            <span>{isEn ? 'Groups' : 'مجموعات'}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${typeFilter === 'group' ? 'bg-white/20 text-white' : 'bg-[#E8E7FF] text-[#7657F6]'}`}>
              {regularGroups.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('private')}
            className={`flex-1 py-2 px-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              typeFilter === 'private'
                ? 'bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white shadow-sm'
                : 'text-[#74778F] hover:text-[#17163D]'
            }`}
          >
            <span>{isEn ? 'Private' : 'خاص'}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${typeFilter === 'private' ? 'bg-white/20 text-white' : 'bg-[#FFF1F3] text-[#FF647C]'}`}>
              {privateServices.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTypeFilter('today')}
            className={`flex-1 py-2 px-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              typeFilter === 'today'
                ? 'bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white shadow-sm'
                : 'text-[#74778F] hover:text-[#FF647C]'
            }`}
          >
            <span>{t('today')}</span>
            {groupsWithTodayClass.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${typeFilter === 'today' ? 'bg-white/25 text-white' : 'bg-[#FFF1F3] text-[#FF647C]'}`}>
                {groupsWithTodayClass.length}
              </span>
            )}
          </button>
        </div>

        {/* Dropdown Filters Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[#74778F] text-[11px] font-bold shrink-0">
              <Filter className="w-3.5 h-3.5 text-[#7657F6]" />
              <span>{isEn ? 'Filter:' : 'تصفية:'}</span>
            </div>

            <select
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="bg-[#F6F7FC] hover:bg-[#E8E7FF]/30 border border-[#E8E7FF] rounded-xl px-3 py-1.5 text-xs text-[#191A2E] font-bold focus:outline-none focus:border-[#7657F6] cursor-pointer transition-colors"
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
                className="bg-[#F6F7FC] hover:bg-[#E8E7FF]/30 border border-[#E8E7FF] rounded-xl px-3 py-1.5 text-xs text-[#191A2E] font-bold focus:outline-none focus:border-[#7657F6] cursor-pointer transition-colors"
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
              className="px-3 py-1.5 rounded-xl bg-[#E8E7FF] text-[#7657F6] font-bold text-xs hover:bg-[#7657F6] hover:text-white transition-all cursor-pointer"
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
        <div className="classy-card p-8 sm:p-12 text-center space-y-4 flex flex-col items-center justify-center relative overflow-hidden bg-white">
          <div className="w-28 h-28 flex items-center justify-center">
            <ClassyOwlMascot size="lg" glow={true} pose="teacher" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="font-black text-base sm:text-lg text-[#17163D]">
              {t('noGroupsFound')}
            </h3>
            <p className="text-xs sm:text-sm text-[#74778F] font-medium leading-relaxed">
              {isEn ? 'Start by creating your first group and organize sessions and students easily.' : 'ابدأ بإضافة أول مجموعة ونظّم حصصك وطلابك بسهولة.'}
            </p>
          </div>
          <button
            onClick={onOpenAddGroup}
            className="mt-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white font-black text-xs sm:text-sm inline-flex items-center gap-2 shadow-lg shadow-[#FF647C]/30 transition-all cursor-pointer active:scale-95 hover:brightness-105"
          >
            <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
            <span>+ {t('createGroupBtn')}</span>
          </button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="classy-card p-8 sm:p-12 text-center text-[#74778F] space-y-3 flex flex-col items-center bg-white">
          <div className="w-16 h-16 rounded-3xl bg-[#F6F7FC] border border-[#E8E7FF] flex items-center justify-center shadow-inner">
            <AlertCircle className="w-8 h-8 text-[#FF647C]" />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-sm sm:text-base text-[#17163D]">
              {isEn ? 'No groups match your search' : 'لا توجد مجموعات مطابقة لبحثك'}
            </h3>
            <p className="text-xs text-[#74778F] font-medium">
              {isEn ? 'Try changing your search terms or resetting filters' : 'جرّب تغيير كلمات البحث أو إعادة ضبط خيارات التصفية'}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl bg-[#E8E7FF] text-[#7657F6] font-bold text-xs hover:bg-[#7657F6] hover:text-white transition-all cursor-pointer"
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

            const themeColor = group.accentColor || (isPrivate ? '#FF647C' : '#7657F6');

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
                className="classy-card classy-card-hover p-4 sm:p-5 transition-all cursor-pointer space-y-3.5 active:scale-[0.99] relative overflow-hidden group bg-white hover:border-[#7657F6]/50"
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
                      className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white text-base shadow-md shrink-0 border border-white/20 mt-0.5"
                      style={{ backgroundColor: themeColor }}
                    >
                      {isPrivate ? <Zap className="w-5 h-5 text-white" /> : <Layers className="w-5 h-5 text-white" />}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-sm sm:text-base text-[#17163D] truncate group-hover:text-[#7657F6] transition-colors">
                          {displayTitle}
                        </h3>

                        {/* Dynamic Semantic Session Status Badges */}
                        {todaySession ? (
                          todaySession.status === 'completed' ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{isEn ? 'Recorded Today' : 'تم رصد اليوم'}</span>
                            </span>
                          ) : todaySession.status === 'cancelled' ? (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3] inline-flex items-center gap-1 shadow-2xs">
                              <AlertCircle className="w-3 h-3 text-[#FF647C]" />
                              <span>{isEn ? 'Today Cancelled' : 'حصة اليوم ملغاة'}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 inline-flex items-center gap-1 shadow-2xs animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span>{isEn ? 'Today Scheduled' : 'حصة اليوم مجدولة'}</span>
                            </span>
                          )
                        ) : hasClassToday ? (
                          <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 inline-flex items-center gap-1 shadow-2xs animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>{isEn ? "Today's Class" : 'موعد اليوم'}</span>
                          </span>
                        ) : null}

                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            isPrivate
                              ? 'bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3]'
                              : 'bg-[#E8E7FF] text-[#403B9C] border border-[#D8D5FB]'
                          }`}
                        >
                          {isPrivate ? (isEn ? 'Private' : 'درس خاص') : (isEn ? 'Group' : 'مجموعة دراسية')}
                        </span>
                      </div>

                      {/* Subject and Stage Meta */}
                      <div className="flex items-center gap-2 text-xs text-[#74778F] font-medium flex-wrap">
                        <span className="text-[#191A2E] font-bold bg-[#F6F7FC] px-2 py-0.5 rounded-lg border border-[#E8E7FF]">
                          {group.subject}
                        </span>
                        <span>•</span>
                        <span>{getLocalizedStageName(group.gradeLevel)}</span>
                        {group.roomOrLocation && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[130px] flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#FF647C]" />
                              <span>{group.roomOrLocation}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pricing Badge */}
                  <div className="shrink-0 text-left">
                    <span className="text-xs font-black px-3 py-1 rounded-xl inline-block bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                      {group.defaultPrice} {t('currency')}
                    </span>
                    <span className="text-[10px] text-[#74778F] font-bold block mt-0.5 text-left">
                      {billingLabel}
                    </span>
                  </div>
                </div>

                {/* Dashboard-Inspired Session Schedule Timeline Strip */}
                <div className="bg-[#F6F7FC] p-3 rounded-2xl border border-[#E8E7FF] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#74778F] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#7657F6]" />
                      <span>{isEn ? 'Weekly Schedule:' : 'مواعيد الحصص الأسبوعية:'}</span>
                    </span>
                    <span className="font-black text-[#191A2E] flex items-center gap-1 text-[11px]">
                      <Users className="w-3.5 h-3.5 text-[#7657F6]" />
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
                                ? 'bg-gradient-to-r from-emerald-50/90 to-white border-emerald-300 ring-1 ring-emerald-300/40'
                                : 'bg-white border-[#E8E7FF]'
                            }`}
                          >
                            {/* Day Header with Pulse on Today */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isToday ? 'bg-emerald-500 animate-pulse' : 'bg-[#7657F6]'
                                }`}
                              />
                              <span className={`text-xs font-black ${isToday ? 'text-emerald-950' : 'text-[#17163D]'}`}>
                                {localizedDay}
                              </span>
                              {isToday && (
                                <span className="text-[9px] font-black px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                  {t('today')}
                                </span>
                              )}
                              {dayTimes.length > 1 && (
                                <span className="text-[9px] font-bold text-[#74778F]">
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
                                        ? 'bg-emerald-100 text-emerald-950 border-emerald-300 shadow-2xs'
                                        : 'bg-[#F6F7FC] text-[#191A2E] border-[#E8E7FF] shadow-2xs'
                                    }`}
                                  >
                                    <Clock className={`w-3 h-3 ${isToday ? 'text-emerald-700' : 'text-[#7657F6]'}`} />
                                    <span className="font-mono font-black text-[11px]">
                                      {formatTimeDisplay(time, isRTL)}
                                    </span>
                                    {dayTimes.length > 1 && (
                                      <span
                                        className={`text-[9px] px-1.5 py-0.2 rounded-md font-extrabold ${
                                          isToday
                                            ? 'bg-emerald-200/90 text-emerald-950'
                                            : 'bg-[#E8E7FF] text-[#7657F6]'
                                        }`}
                                      >
                                        {isEn ? `Slot ${tIdx + 1}` : `فترة ${tIdx + 1}`}
                                      </span>
                                    )}
                                  </div>
                                ))
                              ) : group.scheduleTime ? (
                                <div className="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-[#F6F7FC] text-[#191A2E] border border-[#E8E7FF]">
                                  <Clock className="w-3 h-3 text-[#7657F6]" />
                                  <span className="font-mono font-black text-[11px]">
                                    {formatTimeDisplay(group.scheduleTime, isRTL)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-[#74778F]">{isEn ? 'Flexible time' : 'وقت مرن'}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-white border border-[#E8E7FF] text-center text-xs text-[#74778F] font-medium">
                      {isEn ? 'Flexible times by agreement' : 'مواعيد مرنة حسب الاتفاق'}
                    </div>
                  )}
                </div>

                {/* Quick Performance & Financial Health Mini-Bento */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[#F8F9FE] p-2 rounded-xl border border-[#E8E7FF]">
                    <span className="text-[10px] text-[#74778F] block font-bold">{isEn ? 'Completed' : 'الحصص المنفذة'}</span>
                    <strong className="text-xs font-black text-[#17163D]">{groupStats.completedSessions}</strong>
                  </div>
                  <div className="bg-[#F8F9FE] p-2 rounded-xl border border-[#E8E7FF]">
                    <span className="text-[10px] text-[#74778F] block font-bold">{isEn ? 'Attendance' : 'نسبة الالتزام'}</span>
                    <strong
                      className={`text-xs font-black ${
                        groupStats.attendanceRate >= 85
                          ? 'text-emerald-700'
                          : groupStats.attendanceRate >= 70
                          ? 'text-amber-700'
                          : 'text-[#FF647C]'
                      }`}
                    >
                      {groupStats.attendanceRate}%
                    </strong>
                  </div>
                  <div className="bg-[#F8F9FE] p-2 rounded-xl border border-[#E8E7FF]">
                    <span className="text-[10px] text-[#74778F] block font-bold">{isEn ? 'Collected' : 'المحصل'}</span>
                    <strong className="text-xs font-black text-emerald-700">
                      {groupStats.totalRevenue} {t('currency')}
                    </strong>
                  </div>
                </div>

                {/* Bottom Row: Quick Action Bar */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E8E7FF]/80">
                  <div className="flex items-center gap-1.5">
                    {onEditGroup && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditGroup(group);
                        }}
                        className="p-1.5 rounded-xl bg-[#F6F7FC] hover:bg-[#E8E7FF] text-[#74778F] hover:text-[#7657F6] border border-[#E8E7FF] transition-all cursor-pointer shadow-2xs active:scale-95"
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
                        className="px-2.5 py-1.5 rounded-xl bg-[#F6F7FC] hover:bg-[#E8E7FF] text-[#17163D] hover:text-[#7657F6] border border-[#E8E7FF] text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                        title={isEn ? 'Schedule session for this group' : 'جدولة حصة جديدة لهذه المجموعة'}
                      >
                        <CalendarCheck2 className="w-3.5 h-3.5 text-[#55C7E8]" />
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
                    className="px-3.5 py-1.5 rounded-xl bg-[#17163D] hover:bg-[#403B9C] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
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
