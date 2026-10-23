import React, { useState, useMemo, useEffect } from 'react';
import { StatusBadge } from './ui/StatusBadge';
import { ScreenHeader } from './ui/ScreenHeader';
import { Student, Group, Attendance, Session, Enrollment, ActiveTab, Payment } from '../types';
import { db } from '../utils/storage';
import { Avatar } from './ui/Avatar';
import { StudentAvatar } from './StudentAvatar';
import { getStudentFrameCardTheme, FrameCornerWatermark } from '../utils/frameTheme';
import { getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { AppIcon } from './ui/AppIcon';
import { SegmentedControl } from './ui/SegmentedControl';
import { GroupsView } from './GroupsView';
import { StudentsTrio, EmptyBox } from './illustrations';
import { Toast } from './ui/Toast';

interface StudentsViewProps {
  students: Student[];
  groups: Group[];
  allAttendance?: Attendance[];
  sessions?: Session[];
  payments?: Payment[];
  activeSegment?: 'students' | 'groups';
  onSegmentChange?: (segment: 'students' | 'groups') => void;
  onOpenAddStudent: () => void;
  onOpenStudentProfile: (student: Student) => void;
  onOpenEditStudent?: (student: Student) => void;
  onOpenAddPayment?: (student?: Student, enrollmentId?: string) => void;
  onOpenAddSession?: (defaultGroupId?: string, defaultDate?: string) => void;
  onOpenAttendanceModal?: (session: Session) => void;
  onOpenBulkAddSession?: (selectedStudents: Student[]) => void;
  onOpenAddGroup?: () => void;
  onEditGroup?: (group: Group) => void;
  onOpenGroupProfile?: (group: Group) => void;
  onDataChanged?: () => void;
  onNavigateToTab?: (tab: ActiveTab) => void;
  onOpenNotificationsModal?: () => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  groups,
  allAttendance = [],
  sessions = [],
  payments = [],
  activeSegment = 'students',
  onSegmentChange,
  onOpenAddStudent,
  onOpenStudentProfile,
  onOpenEditStudent,
  onOpenAddPayment,
  onOpenAddSession,
  onOpenAttendanceModal,
  onOpenBulkAddSession,
  onOpenAddGroup,
  onEditGroup,
  onOpenGroupProfile,
  onDataChanged,
  onNavigateToTab,
  onOpenNotificationsModal,
}) => {
  const { t, language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');

  // Segmented control state between 'students' and 'groups'
  const [selectedSegment, setSelectedSegment] = useState<'students' | 'groups'>(activeSegment);

  useEffect(() => {
    setSelectedSegment(activeSegment);
  }, [activeSegment]);

  const handleSegmentChange = (seg: 'students' | 'groups') => {
    setSelectedSegment(seg);
    onSegmentChange?.(seg);
  };

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
        privateEnrollments: { group?: Group; enrollment: Enrollment }[];
        enrollmentGroupIds: Set<string>;
        isPrivateOnly: boolean;
        isGroupAndPrivate: boolean;
        balance: number;
      }
    >();

    students.forEach((student) => {
      const sEnrs = allEnrs.filter((e) => e.studentId === student.id && e.status !== 'stopped');
      const sGroups: { group: Group; enrollment: Enrollment }[] = [];
      const sPriv: { group?: Group; enrollment: Enrollment }[] = [];
      const grpIds = new Set<string>();

      sEnrs.forEach((enr) => {
        if (enr.serviceType === 'private') {
          const g = enr.groupId ? groupsMap.get(enr.groupId) : undefined;
          sPriv.push({ group: g, enrollment: enr });
        } else {
          const g = enr.groupId ? groupsMap.get(enr.groupId) : undefined;
          if (g && g.type !== 'private') {
            grpIds.add(g.id);
            sGroups.push({ group: g, enrollment: enr });
          }
        }
      });

      const hasDirectPrivate = (student.privateDays && student.privateDays.length > 0) || student.serviceType === 'private';
      const hasPrivate = sPriv.length > 0 || hasDirectPrivate;
      const hasGroup = sGroups.length > 0;

      const fin = db.calculateStudentFinancials(student.id);

      map.set(student.id, {
        studentGroups: sGroups,
        privateEnrollments: sPriv,
        enrollmentGroupIds: grpIds,
        isPrivateOnly: !hasGroup && hasPrivate,
        isGroupAndPrivate: hasGroup && hasPrivate,
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
    showToast(
      isEn
        ? `Student "${student.name}" restored successfully`
        : `تمت استعادة الطالب "${student.name}" بنجاح وإعادته للقائمة النشطة`
    );
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

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar px-5 py-4 space-y-4 text-ink pb-32 bg-page relative"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Screen Header */}
      <ScreenHeader
        title={
          selectedSegment === 'groups'
            ? (t('navGroups') || (isEn ? 'Groups' : 'المجموعات'))
            : (t('studentsTitle') || (isEn ? 'Students' : 'الطلاب'))
        }
        onOpenNotifications={onOpenNotificationsModal}
        onOpenSettings={onNavigateToTab ? () => onNavigateToTab('settings') : undefined}
      />

      {/* 1. Header SegmentedControl (Students | Groups) + Add Action at the end of header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <SegmentedControl<'students' | 'groups'>
            value={selectedSegment}
            onChange={handleSegmentChange}
            options={[
              {
                value: 'students',
                icon: <AppIcon name="students" weight="duotone" size={16} />,
                label: isEn ? 'Students' : 'الطلاب',
              },
              {
                value: 'groups',
                icon: <AppIcon name="group" weight="duotone" size={16} />,
                label: isEn ? 'Groups' : 'المجموعات',
              },
            ]}
          />
        </div>

        {selectedSegment === 'students' ? (
          <button
            type="button"
            onClick={onOpenAddStudent}
            className="btn-orange shrink-0 !h-10 !min-h-10 !px-3.5 !text-xs !font-bold flex items-center gap-1.5 shadow-orange"
          >
            <AppIcon name="plus" weight="fill" size={14} />
            <span>{isEn ? '+ Add student' : '+ إضافة طالب'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAddGroup}
            className="btn-orange shrink-0 !h-10 !min-h-10 !px-3.5 !text-xs !font-bold flex items-center gap-1.5 shadow-orange"
          >
            <AppIcon name="plus" weight="fill" size={14} />
            <span>{isEn ? '+ Add group' : '+ إضافة مجموعة'}</span>
          </button>
        )}
      </div>

      {/* When Groups segment is selected, render GroupsView content */}
      {selectedSegment === 'groups' ? (
        <div key="groups-segment" className="pt-1 motion-groups-enter">
          <GroupsView
            groups={groups}
            allStudents={students}
            sessions={sessions}
            payments={payments}
            onOpenAddGroup={onOpenAddGroup || (() => {})}
            onOpenGroupProfile={onOpenGroupProfile || (() => {})}
            onEditGroup={onEditGroup}
            onOpenAddSession={onOpenAddSession}
            onOpenAddStudent={onOpenAddStudent}
            onOpenAddPayment={onOpenAddPayment}
            onOpenAttendanceModal={onOpenAttendanceModal}
            onOpenStudentProfile={onOpenStudentProfile}
            onOpenBulkAddSession={onOpenBulkAddSession}
            onDataChanged={onDataChanged}
            onNavigateToTab={onNavigateToTab}
            onOpenNotificationsModal={onOpenNotificationsModal}
          />
        </div>
      ) : (
        <div key="students-segment" className="space-y-4 motion-students-enter">
          {/* Quick Feedback Toast */}
          <Toast
            isOpen={Boolean(feedbackToast)}
            message={feedbackToast || ''}
            type="success"
            onClose={() => setFeedbackToast(null)}
          />

          {/* Sub-Segment: Active vs Archived Students */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <SegmentedControl<'active' | 'archived'>
                value={activeTabType}
                onChange={(val) => {
                  setActiveTabType(val);
                  handleExitSelectionMode();
                }}
                options={[
                  {
                    value: 'active',
                    icon: <AppIcon name="students" weight="duotone" size={14} />,
                    label: (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{isEn ? 'Active' : 'النشطون'}</span>
                        <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-navy/10 text-navy">
                          {activeStudentsCount}
                        </span>
                      </span>
                    ),
                  },
                  {
                    value: 'archived',
                    icon: <AppIcon name="archive" weight="duotone" size={14} />,
                    label: (
                      <span className="inline-flex items-center gap-1.5">
                        <span>{isEn ? 'Archived' : 'الأرشيف'}</span>
                        {archivedStudentsCount > 0 && (
                          <span className="text-[11px] font-bold px-1.5 py-0.2 rounded-full bg-navy/10 text-navy">
                            {archivedStudentsCount}
                          </span>
                        )}
                      </span>
                    ),
                  },
                ]}
              />
            </div>

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
                className={`px-3 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                  isSelectionMode
                    ? 'bg-navy text-page border-navy shadow-navy'
                    : 'bg-page text-navy border-line shadow-white hover:bg-mist'
                }`}
                title={
                  isSelectionMode
                    ? (isEn ? 'Cancel selection' : 'إلغاء التحديد')
                    : (isEn ? 'Select students' : 'تحديد طلاب')
                }
              >
                <AppIcon
                  name="checkSquare"
                  weight={isSelectionMode ? 'fill' : 'regular'}
                  size={14}
                  className={isSelectionMode ? 'text-page' : 'text-navy'}
                />
                <span className="hidden sm:inline">
                  {isSelectionMode ? t('exitSelectionMode') : t('selectStudents')}
                </span>
              </button>
            )}
          </div>

          {/* Selection Mode Toolbar Banner */}
          {isSelectionMode && activeTabType === 'active' && (
            <div className="p-3 bg-mint-soft border border-mint rounded-2xl flex items-center justify-between gap-2 shadow-white">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-navy text-page flex items-center justify-center font-bold text-xs shadow-xs">
                  {selectedCount}
                </span>
                <span className="font-bold text-navy text-xs sm:text-sm">
                  {t('selectedCount', { count: selectedCount.toString() })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={isAllFilteredSelected ? handleDeselectAll : handleSelectAllFiltered}
                  className="px-3 py-1.5 rounded-full bg-page border border-line text-navy font-bold text-xs hover:bg-mist transition-colors cursor-pointer shadow-white"
                >
                  {isAllFilteredSelected ? t('deselectAll') : t('selectAll')}
                </button>
                <button
                  type="button"
                  onClick={handleExitSelectionMode}
                  className="p-1.5 rounded-full text-slate hover:text-navy hover:bg-page transition-colors cursor-pointer"
                  title={t('exitSelectionMode')}
                >
                  <AppIcon name="close" weight="regular" size={14} />
                </button>
              </div>
            </div>
          )}

          {/* 2. Search Pill (height 52px, white, 1px line, shadow-white, AppIcon search start side) */}
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
                activeTabType === 'active'
                  ? (isEn
                      ? 'Search by name, student phone, parent phone, or school...'
                      : 'البحث بالاسم، رقم هاتف الطالب، رقم ولي الأمر، أو المدرسة...')
                  : (isEn
                      ? 'Search archived students by name or phone...'
                      : 'البحث في الطلاب المؤرشفين بالاسم أو رقم الهاتف...')
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

          {/* Horizontally scrollable row of chips (.chip/.chip-active) wired to existing filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar snap-x">
            {/* Quick Filter: All */}
            <button
              type="button"
              onClick={() => setQuickFilter('all')}
              className={`chip snap-start ${quickFilter === 'all' && selectedGradeFilter === 'all' && selectedGroupFilter === 'all' ? 'chip-active' : ''}`}
            >
              <span>{t('all')}</span>
            </button>

            {/* Quick Filter: Have Dues */}
            <button
              type="button"
              onClick={() => setQuickFilter(quickFilter === 'debtors' ? 'all' : 'debtors')}
              className={`chip snap-start ${quickFilter === 'debtors' ? 'chip-active' : ''}`}
            >
              <AppIcon name="wallet" weight="duotone" size={14} />
              <span>{isEn ? 'Have Dues' : 'عليهم مستحقات'}</span>
              {activeDebtorsCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-current/15">
                  {activeDebtorsCount}
                </span>
              )}
            </button>

            {/* Quick Filter: Private Only */}
            <button
              type="button"
              onClick={() => setQuickFilter(quickFilter === 'private_only' ? 'all' : 'private_only')}
              className={`chip snap-start ${quickFilter === 'private_only' ? 'chip-active' : ''}`}
            >
              <AppIcon name="zap" weight="duotone" size={14} />
              <span>{isEn ? 'Private Only' : 'دروس خاصة فقط'}</span>
              {privateOnlyCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-current/15">
                  {privateOnlyCount}
                </span>
              )}
            </button>

            {/* Grade level chips */}
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

            {/* Group filter chips */}
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGroupFilter(selectedGroupFilter === g.id ? 'all' : g.id)}
                className={`chip snap-start ${selectedGroupFilter === g.id ? 'chip-active' : ''}`}
              >
                <AppIcon name="group" weight="duotone" size={14} />
                <span>{g.name}</span>
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

          {/* 3. Student Cards List or Empty State */}
          {students.length === 0 ? (
            /* Empty State 1: No students at all */
            <div className="bg-mint-soft border border-mint rounded-[var(--radius-card)] p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-white">
              <div className="w-40 h-32 flex items-center justify-center">
                <StudentsTrio className="w-full h-full" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="t-card text-navy font-bold text-base sm:text-lg">
                  {t('noStudentsFound')}
                </h3>
                <p className="t-meta text-slate text-xs sm:text-sm">
                  {isEn
                    ? 'Start by adding your first student to track attendance, packages, and collections with ease.'
                    : 'ابدأ بإضافة أول طالب إلى صفوفك التعليمية لمتابعة حضوره، باقاته، وتحصيل مستحقاته بكل سهولة.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenAddStudent}
                className="btn-orange mt-2 flex items-center gap-2"
              >
                <AppIcon name="plus" weight="fill" size={16} />
                <span>{t('addStudent')}</span>
              </button>
            </div>
          ) : filteredStudents.length === 0 ? (
            /* Empty State 2: No search/filter matches */
            <div className="bg-mint-soft border border-mint rounded-[var(--radius-card)] p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-white">
              <div className="w-36 h-28 flex items-center justify-center">
                <EmptyBox className="w-full h-full" />
              </div>
              <div className="space-y-1">
                <h3 className="t-card text-navy font-bold text-base">
                  {activeTabType === 'archived'
                    ? (isEn ? 'No matching archived students' : 'لا يوجد طلاب مطابقين في الأرشيف')
                    : (isEn ? 'No results match your search' : 'لا توجد نتائج مطابقة لبحثك')}
                </h3>
                <p className="t-meta text-slate text-xs">
                  {isEn
                    ? 'Try changing search terms or resetting filters'
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
                  onClick={onOpenAddStudent}
                  className="btn-orange mt-2 flex items-center gap-2"
                >
                  <AppIcon name="plus" weight="fill" size={16} />
                  <span>{t('addStudent')}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStudents.map((student, index) => {
                const data = studentDataMap.get(student.id);
                const studentGroups = data?.studentGroups || [];
                const privateEnrollments = data?.privateEnrollments || [];
                const balance = data?.balance ?? 0;
                const isSelected = selectedStudentIds.has(student.id);
                const isStudentArchived = student.status === 'archived';

                // Frame theme derived directly from the student's existing achievement frame assignment
                const frameTheme = getStudentFrameCardTheme(student.achievementFrame);
                const hasAchievementFrame = Boolean(frameTheme);

                // Featured / first card gets solid mint #B9DAD6, others get mint-soft
                // When an achievement frame is assigned, derive subtle themed background & border
                const isFeatured = index === 0 || isSelected;
                const bgClass = hasAchievementFrame
                  ? `${frameTheme.cardBgClass} ${frameTheme.cardBorderClass}`
                  : isFeatured
                  ? 'bg-mint border-mint shadow-mint'
                  : 'bg-mint-soft border-line shadow-white';

                // Stagger delay for top 8 items: 120Hz-ready fade-up staggered 18ms, disabled for lists over 50
                const isStaggerEnabled = filteredStudents.length <= 50;
                const staggerDelay = isStaggerEnabled && index < 8 ? `${index * 18}ms` : undefined;

                // Meta line: group/private, billing type
                const serviceLabel = data?.isPrivateOnly
                  ? (isEn ? 'Private' : 'درس خاص')
                  : data?.isGroupAndPrivate
                  ? (isEn ? 'Group & Private' : 'مجموعة وخاص')
                  : studentGroups.length > 0
                  ? (isEn ? 'Group' : 'مجموعة')
                  : (isEn ? 'Student' : 'طالب');

                const primaryGroup = studentGroups[0]?.group || privateEnrollments[0]?.group;
                const resolvedBillingType =
                  primaryGroup?.billingType ||
                  privateEnrollments[0]?.enrollment?.billingType ||
                  privateEnrollments[0]?.enrollment?.billingMode;
                const billingLabel = resolvedBillingType
                  ? resolvedBillingType === 'monthly'
                    ? (isEn ? 'Monthly' : 'شهري')
                    : resolvedBillingType === 'package'
                    ? (isEn ? 'Package' : 'باقة')
                    : resolvedBillingType === 'hourly'
                    ? (isEn ? 'Hourly' : 'بالساعة')
                    : (isEn ? 'Per session' : 'بالحصة')
                  : null;

                const metaText = [
                  serviceLabel,
                  billingLabel,
                  student.gradeLevel ? getLocalizedStageName(student.gradeLevel) : null,
                ]
                  .filter(Boolean)
                  .join(' • ');

                // Financial or archived StatusBadge
                const badgeStatus = isStudentArchived
                  ? 'archived'
                  : balance < 0
                  ? 'has_due'
                  : balance > 0
                  ? 'has_credit'
                  : 'settled';

                const badgeLabel = isStudentArchived
                  ? (isEn ? 'Archived' : 'مؤرشف')
                  : balance < 0
                  ? `${Math.abs(balance)} ${t('currency')}`
                  : balance > 0
                  ? `+${balance} ${t('currency')}`
                  : t('settled');

                return (
                  <div
                    key={student.id}
                    style={{ animationDelay: staggerDelay }}
                    onClick={() => {
                      if (isSelectionMode && !isStudentArchived) {
                        toggleSelectStudent(student.id);
                      } else {
                        onOpenStudentProfile(student);
                      }
                    }}
                    className={`relative overflow-hidden rounded-[var(--radius-card)] p-4 border text-navy transition-transform duration-120 ease-out cursor-pointer select-none active:scale-[0.985] will-change-transform ${
                      isStaggerEnabled ? 'animate-tile-stagger' : ''
                    } ${bgClass} ${
                      isStudentArchived ? 'opacity-70' : ''
                    } ${isSelected ? 'ring-2 ring-navy' : ''}`}
                  >
                    {/* Subtle frame corner watermark */}
                    {frameTheme && (
                      <FrameCornerWatermark patternType={frameTheme.patternType} />
                    )}

                    <div className="relative z-10 flex items-center justify-between gap-3">
                      {/* Start: Selection Checkbox (if in mode) + 48px Avatar + Name + Meta line */}
                      <div className="flex items-center gap-3 min-w-0">
                        {isSelectionMode && !isStudentArchived && (
                          <button
                            type="button"
                            onClick={(e) => toggleSelectStudent(student.id, e)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                              isSelected
                                ? 'bg-navy border-navy text-page'
                                : 'bg-page border-line text-transparent hover:border-navy'
                            }`}
                          >
                            <AppIcon name="check" weight="bold" size={14} className="text-page" />
                          </button>
                        )}

                        {/* Avatar with Achievement Frame if present, or standard 48px Avatar */}
                        {hasAchievementFrame ? (
                          <div className="shrink-0 gaming-frame-interactive transition-transform hover:scale-105">
                            <StudentAvatar
                              student={student}
                              name={student.name}
                              profilePhoto={student.profilePhoto}
                              avatarColor={student.avatarColor}
                              achievementFrame={student.achievementFrame}
                              size="md"
                              showFrame={true}
                              className="shrink-0"
                            />
                          </div>
                        ) : (
                          <Avatar
                            size={48}
                            name={student.name}
                            profilePhoto={student.profilePhoto}
                            className="shrink-0"
                          />
                        )}

                        {/* Name .t-card + Optional Tier Badge + Meta line 13px */}
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <h3 className="t-card text-navy truncate font-semibold">
                              {student.name}
                            </h3>
                            {frameTheme && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${frameTheme.pillClass} shrink-0 select-none`}
                                title={isEn ? frameTheme.nameEn : frameTheme.nameAr}
                              >
                                <span>{frameTheme.icon}</span>
                                <span>{isEn ? frameTheme.tierEn : frameTheme.tierAr}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-[13px] text-slate truncate font-normal">
                            {metaText}
                          </p>
                        </div>
                      </div>

                      {/* End: Trailing StatusBadge + chevron (mirrored in RTL) or restore button */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isStudentArchived ? (
                          <button
                            type="button"
                            onClick={(e) => handleRestore(student, e)}
                            className="px-3 py-1 rounded-full bg-page border border-line text-navy text-xs font-semibold flex items-center gap-1 shadow-white hover:bg-mist transition-colors"
                            title={isEn ? 'Restore student' : 'استعادة الطالب'}
                          >
                            <AppIcon name="restore" weight="regular" size={14} />
                            <span>{t('restore')}</span>
                          </button>
                        ) : (
                          <StatusBadge status={badgeStatus} label={badgeLabel} />
                        )}

                        <AppIcon
                          name="chevronEnd"
                          weight="regular"
                          size={16}
                          className="text-slate"
                        />
                      </div>
                    </div>

                    {/* Secondary Row: groups pills & quick contact buttons */}
                    {(studentGroups.length > 0 || student.phone || student.parentPhone) && (
                      <div className="relative z-10 mt-3 pt-2.5 border-t border-navy/10 flex items-center justify-between gap-2 flex-wrap text-xs">
                        {/* Group chips */}
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          {studentGroups.map(({ group }) => (
                            <span
                              key={group.id}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-page text-navy border border-line text-[11px] font-medium shadow-white"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: group.accentColor || 'var(--color-navy)' }}
                              />
                              <span className="truncate max-w-[120px]">{group.name}</span>
                            </span>
                          ))}
                        </div>

                        {/* Quick phone & whatsapp actions */}
                        <div className="flex items-center gap-1.5 ms-auto shrink-0">
                          {(student.phone || student.parentPhone) && (
                            <a
                              href={`tel:${student.phone || student.parentPhone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="w-7 h-7 rounded-full bg-page border border-line flex items-center justify-center text-slate hover:text-navy shadow-white transition-colors"
                              title={isEn ? 'Call' : 'اتصال'}
                            >
                              <AppIcon name="phone" weight="regular" size={13} />
                            </a>
                          )}
                          {(student.phone || student.parentPhone) && (
                            <a
                              href={`https://wa.me/${(student.phone || student.parentPhone)?.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-7 h-7 rounded-full bg-page border border-line flex items-center justify-center text-teal hover:text-navy shadow-white transition-colors"
                              title={isEn ? 'WhatsApp' : 'واتساب'}
                            >
                              <AppIcon name="whatsapp" weight="fill" size={14} />
                            </a>
                          )}
                          {!isStudentArchived && onOpenAddPayment && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenAddPayment(student);
                              }}
                              className="px-2.5 py-1 rounded-full bg-page border border-line text-navy text-[11px] font-semibold flex items-center gap-1 shadow-white hover:bg-mist transition-colors"
                            >
                              <AppIcon name="wallet" weight="duotone" size={12} />
                              <span>{isEn ? 'Payment' : 'دفعة'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Floating Bottom Action Bar when students are selected in bulk mode */}
          {isSelectionMode && selectedCount > 0 && activeTabType === 'active' && (
            <div className="fixed bottom-20 inset-x-0 z-40 max-w-lg mx-auto px-4 pb-2 animate-in slide-in-from-bottom-3 duration-200">
              <div className="bg-navy text-page p-3.5 rounded-2xl shadow-navy flex items-center justify-between border border-line/20">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-orange text-page flex items-center justify-center font-bold text-xs shadow-orange">
                    {selectedCount}
                  </span>
                  <span className="font-bold text-xs sm:text-sm text-page">
                    {t('selectedCountShort', { count: selectedCount.toString() })}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleBulkAddSession}
                  className="btn-orange !h-10 !min-h-10 !px-4 !text-xs font-bold flex items-center gap-1.5 shadow-orange"
                >
                  <AppIcon name="calendarCheck" weight="fill" size={16} />
                  <span>{t('addBulkSession')} ({selectedCount})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentsView;
