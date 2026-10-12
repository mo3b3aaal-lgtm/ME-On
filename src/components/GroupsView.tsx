import React, { useState, useMemo } from 'react';
import { Group, Student, Session, Payment, ActiveTab } from '../types';
import { db } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import { AppIcon } from './ui/AppIcon';
import { StatusBadge } from './ui/StatusBadge';
import { EmptyBox } from './illustrations';
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
  onNavigateToTab?: (tab: ActiveTab) => void;
  onOpenNotificationsModal?: () => void;
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
  onNavigateToTab,
  onOpenNotificationsModal,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
  const { todayStr } = useCurrentLocalDate();
  const todayArabicDay = useMemo(() => getArabicDayForDate(todayStr), [todayStr]);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'group' | 'private' | 'today'>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');

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
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* 1. Search Pill (height 52px, white, 1px line, shadow-white, AppIcon search on start side) */}
      <div className="relative h-[52px] bg-page border border-line rounded-full shadow-white flex items-center px-4 gap-3">
        <AppIcon
          name="search"
          weight="duotone"
          size={20}
          className="text-slate shrink-0"
        />
        <input
          type="text"
          placeholder={
            isEn
              ? 'Search by group name, subject, stage, or location...'
              : 'البحث باسم المجموعة، المادة، المرحلة، أو المكان...'
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-navy placeholder:text-fog text-sm font-medium"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-slate hover:text-navy p-1 rounded-full hover:bg-mist transition-colors shrink-0"
          >
            <AppIcon name="close" weight="regular" size={14} />
          </button>
        )}
      </div>

      {/* Horizontally scrollable row of chips (.chip/.chip-active) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar snap-x">
        {/* Quick type chips */}
        <button
          type="button"
          onClick={() => setTypeFilter('all')}
          className={`chip snap-start ${typeFilter === 'all' && selectedGradeFilter === 'all' && selectedSubjectFilter === 'all' ? 'chip-active' : ''}`}
        >
          <span>{t('all')}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-current/15">
            {groups.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter(typeFilter === 'group' ? 'all' : 'group')}
          className={`chip snap-start ${typeFilter === 'group' ? 'chip-active' : ''}`}
        >
          <AppIcon name="group" weight="duotone" size={14} />
          <span>{isEn ? 'Groups' : 'مجموعات'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-current/15">
            {regularGroups.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter(typeFilter === 'private' ? 'all' : 'private')}
          className={`chip snap-start ${typeFilter === 'private' ? 'chip-active' : ''}`}
        >
          <AppIcon name="zap" weight="duotone" size={14} />
          <span>{isEn ? 'Private' : 'خاص'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-current/15">
            {privateServices.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter(typeFilter === 'today' ? 'all' : 'today')}
          className={`chip snap-start ${typeFilter === 'today' ? 'chip-active' : ''}`}
        >
          <AppIcon name="calendar" weight="duotone" size={14} />
          <span>{t('today')}</span>
          {groupsWithTodayClass.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-current/15">
              {groupsWithTodayClass.length}
            </span>
          )}
        </button>

        {/* Grade filters */}
        {gradeLevels.map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => setSelectedGradeFilter(selectedGradeFilter === lvl ? 'all' : lvl)}
            className={`chip snap-start ${selectedGradeFilter === lvl ? 'chip-active' : ''}`}
          >
            <AppIcon name="school" weight="duotone" size={14} />
            <span>{getLocalizedStageName(lvl)}</span>
          </button>
        ))}

        {/* Subject filters */}
        {subjects.map((sub) => (
          <button
            key={sub}
            type="button"
            onClick={() => setSelectedSubjectFilter(selectedSubjectFilter === sub ? 'all' : sub)}
            className={`chip snap-start ${selectedSubjectFilter === sub ? 'chip-active' : ''}`}
          >
            <AppIcon name="book" weight="duotone" size={14} />
            <span>{sub}</span>
          </button>
        ))}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="chip snap-start !text-slate hover:!text-navy !bg-mist"
            title={t('resetFilters')}
          >
            <AppIcon name="close" weight="regular" size={12} />
            <span>{t('resetFilters')}</span>
          </button>
        )}
      </div>

      {/* 2. Group Cards List or Empty State */}
      {groups.length === 0 ? (
        <div className="bg-mint-soft border border-mint rounded-[var(--radius-card)] p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-white">
          <div className="w-36 h-28 flex items-center justify-center">
            <EmptyBox className="w-full h-full" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="t-card text-navy font-bold text-base sm:text-lg">
              {t('noGroupsFound')}
            </h3>
            <p className="t-meta text-slate text-xs sm:text-sm">
              {isEn
                ? 'Start by creating your first group and organize sessions and students easily.'
                : 'ابدأ بإضافة أول مجموعة ونظّم حصصك وطلابك بسهولة.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAddGroup}
            className="btn-orange mt-2 flex items-center gap-2"
          >
            <AppIcon name="plus" weight="fill" size={16} />
            <span>{t('createGroupBtn')}</span>
          </button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-mint-soft border border-mint rounded-[var(--radius-card)] p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-white">
          <div className="w-36 h-28 flex items-center justify-center">
            <EmptyBox className="w-full h-full" />
          </div>
          <div className="space-y-1">
            <h3 className="t-card text-navy font-bold text-base">
              {isEn ? 'No groups match your search' : 'لا توجد مجموعات مطابقة لبحثك'}
            </h3>
            <p className="t-meta text-slate text-xs">
              {isEn
                ? 'Try changing your search terms or resetting filters'
                : 'جرّب تغيير كلمات البحث أو إعادة ضبط خيارات التصفية'}
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn-orange mt-2 flex items-center gap-2"
            >
              <AppIcon name="close" weight="regular" size={14} />
              <span>{t('resetFilters')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAddGroup}
              className="btn-orange mt-2 flex items-center gap-2"
            >
              <AppIcon name="plus" weight="fill" size={16} />
              <span>{t('createGroupBtn')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group, index) => {
            const gData = groupDataMap.get(group.id);
            const enrollments = gData?.enrollments || [];
            const isPrivate = group.type === 'private';
            const privateStudent = gData?.privateStudent || null;

            // First item gets mint background, others get mint-soft
            const isFeatured = index === 0;
            const bgClass = isFeatured
              ? 'bg-mint border-mint shadow-mint'
              : 'bg-mint-soft border-line shadow-white';

            // Stagger animation up to 8 items, disabled for lists over 50
            const isStaggerEnabled = filteredGroups.length <= 50;
            const staggerDelay = isStaggerEnabled && index < 8 ? `${index * 35}ms` : undefined;

            const displayTitle = isPrivate
              ? privateStudent
                ? `${isEn ? 'Private — ' : 'درس خاص — '}${privateStudent.name}`
                : isEn
                ? 'Private Lesson'
                : 'درس خاص'
              : group.name;

            // Billing label
            const billingLabel =
              group.billingType === 'monthly'
                ? (isEn ? 'Monthly' : 'شهري')
                : group.billingType === 'package'
                ? (isEn ? `Package (${group.packageSessionsCount || 8})` : `باقة (${group.packageSessionsCount || 8})`)
                : group.billingType === 'hourly'
                ? (isEn ? 'Hourly' : 'بالساعة')
                : (isEn ? 'Per session' : 'بالحصة');

            // Collect schedule days formatted as white pills
            const scheduleDays = group.scheduleDays || [];

            return (
              <div
                key={group.id}
                style={{ animationDelay: staggerDelay }}
                onClick={() => onOpenGroupProfile(group)}
                className={`rounded-[var(--radius-card)] p-4 border text-navy transition-all duration-150 cursor-pointer select-none active:scale-[0.97] ${
                  isStaggerEnabled ? 'animate-fade-up' : ''
                } ${bgClass}`}
              >
                {/* Header: Name .t-card + student count with AppIcon students + price line */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="t-card text-navy font-semibold truncate">
                        {displayTitle}
                      </h3>
                      {group.subject && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-page/70 text-navy border border-line">
                          {group.subject}
                        </span>
                      )}
                      {group.gradeLevel && (
                        <span className="text-[11px] text-slate">
                          {getLocalizedStageName(group.gradeLevel)}
                        </span>
                      )}
                    </div>

                    {/* Student count with AppIcon students */}
                    <div className="flex items-center gap-1.5 text-[13px] text-slate">
                      <AppIcon name="students" weight="duotone" size={15} className="text-navy" />
                      <span className="font-medium text-navy">
                        {isPrivate
                          ? privateStudent
                            ? privateStudent.name
                            : isEn
                            ? 'Private Student'
                            : 'طالب خاص'
                          : isEn
                          ? `${enrollments.length} students`
                          : `${enrollments.length} طلاب مسجلين`}
                      </span>
                      {group.roomOrLocation && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[140px]">{group.roomOrLocation}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Price line */}
                  <div className="shrink-0 text-end">
                    <div className="text-base font-bold text-navy leading-tight">
                      {group.defaultPrice} {t('currency')}
                    </div>
                    <span className="text-[11px] text-slate font-medium block">
                      {billingLabel}
                    </span>
                  </div>
                </div>

                {/* Schedule chips (white pills, 12px) */}
                {scheduleDays.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-navy/10 flex items-center gap-1.5 flex-wrap">
                    {scheduleDays.map((day) => {
                      const dayTimes = getTimesForDayInGroup(group, day);
                      const isToday = getWeekdayIndex(day) === getWeekdayIndex(todayArabicDay);
                      const localizedDay = getLocalizedWeekdayName(day);

                      return (
                        <span
                          key={day}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-page text-navy text-[12px] font-medium border shadow-white ${
                            isToday ? 'border-orange ring-1 ring-orange/30' : 'border-line'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isToday ? 'bg-orange' : 'bg-navy'
                            }`}
                          />
                          <span className="font-bold">{localizedDay}</span>
                          {dayTimes.length > 0 ? (
                            <span className="text-slate text-[11px] font-mono">
                              {dayTimes.map((tVal) => formatTimeDisplay(tVal, isRTL)).join(', ')}
                            </span>
                          ) : group.scheduleTime ? (
                            <span className="text-slate text-[11px] font-mono">
                              {formatTimeDisplay(group.scheduleTime, isRTL)}
                            </span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Trailing actions row */}
                <div className="mt-3 pt-2.5 border-t border-navy/10 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    {onEditGroup && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditGroup(group);
                        }}
                        className="px-2.5 py-1 rounded-full bg-page border border-line text-slate hover:text-navy text-[11px] font-semibold flex items-center gap-1 shadow-white hover:bg-mist transition-colors"
                        title={isEn ? 'Edit group' : 'تعديل المجموعة'}
                      >
                        <AppIcon name="edit" weight="regular" size={13} />
                        <span>{t('edit')}</span>
                      </button>
                    )}

                    {onOpenAddSession && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenAddSession(group.id);
                        }}
                        className="px-2.5 py-1 rounded-full bg-page border border-line text-navy text-[11px] font-semibold flex items-center gap-1 shadow-white hover:bg-mist transition-colors"
                        title={isEn ? 'Add session' : 'إضافة حصة'}
                      >
                        <AppIcon name="calendarCheck" weight="duotone" size={13} />
                        <span>{t('scheduleSessionBtn')}</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-slate text-xs font-semibold">
                    <span>{t('profile')}</span>
                    <AppIcon name="chevronEnd" weight="regular" size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GroupsView;
