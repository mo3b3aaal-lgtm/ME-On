import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { AppIcon } from './ui/AppIcon';
import {
  Session,
  Attendance,
  Student,
  Group,
  Enrollment,
  ReportPeriodFilter,
} from '../types';
import { useTranslation } from '../utils/i18n';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import {
  AttendanceMetricMode,
  AttendanceTimeGrouping,
  AttendanceTrendPoint,
  buildAttendanceTrendsAnalytics,
} from '../utils/attendanceTrends';

export interface AttendanceTrendsChartProps {
  sessions: Session[];
  allAttendance: Attendance[];
  students?: Student[];
  groups?: Group[];
  enrollments?: Enrollment[];
  selectedGroupId?: string;
  selectedStudentId?: string;
  serviceTypeFilter?: 'all' | 'group' | 'private';
  periodFilter?: ReportPeriodFilter;
  selectedSpecificMonth?: number;
  selectedSpecificYear?: number;
  customStartDate?: string;
  customEndDate?: string;
  compact?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: AttendanceTrendPoint }>;
  isRTL: boolean;
  isEn: boolean;
}

const AttendanceLineTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  isRTL,
  isEn,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;

  return (
    <div
      className="bg-page border border-line text-navy p-3.5 rounded-[16px] shadow-white text-xs space-y-2 z-50 min-w-[196px] tabular-nums"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line pb-1.5">
        <span className="font-bold text-navy truncate">{data.fullDateLabel}</span>
        <span className="text-[11px] text-slate shrink-0">
          {data.sessionsCount} {isEn ? (data.sessionsCount === 1 ? 'session' : 'sessions') : 'حصص'}
        </span>
      </div>

      <div className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-navy inline-block rounded-full" />
            <span>{isEn ? 'Attendance Rate' : 'نسبة الحضور'}</span>
          </span>
          <strong className="font-bold text-navy text-sm">{data.rate}%</strong>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-slate flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 border-t-2 border-dashed border-teal inline-block" />
            <span>{isEn ? '3-Pt Consistency Avg' : 'متوسط الانتظام'}</span>
          </span>
          <span className="font-semibold text-teal">{data.rollingAvgRate}%</span>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-line/70">
          <span className="text-slate flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal inline-block" />
            <span>{isEn ? 'Present / Late' : 'حضور / تأخير'}</span>
          </span>
          <span className="font-semibold text-navy">
            {data.attended}{' '}
            <span className="text-[10px] text-slate">
              ({data.present} + {data.late})
            </span>
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-slate flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-coral inline-block" />
            <span>{isEn ? 'Charged Absence' : 'غياب محسوب'}</span>
          </span>
          <span className="font-semibold text-coral">{data.absentCharged}</span>
        </div>

        {data.absentExcused > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange inline-block" />
              <span>{isEn ? 'Excused Absence' : 'غياب معفى'}</span>
            </span>
            <span className="font-semibold text-orange">{data.absentExcused}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-line text-[11px]">
          <span className="text-slate">{isEn ? 'Recorded Total' : 'إجمالي المسجلين'}</span>
          <strong className="text-navy">{data.totalExpected}</strong>
        </div>
      </div>
    </div>
  );
};

export const AttendanceTrendsChart: React.FC<AttendanceTrendsChartProps> = ({
  sessions,
  allAttendance,
  students = [],
  groups = [],
  enrollments = [],
  selectedGroupId,
  selectedStudentId,
  serviceTypeFilter,
  periodFilter,
  selectedSpecificMonth,
  selectedSpecificYear,
  customStartDate,
  customEndDate,
  compact = false,
}) => {
  const resolvedServiceFilter: 'all' | 'group' | 'private' = serviceTypeFilter ?? 'all';
  const resolvedPeriodFilter: ReportPeriodFilter = periodFilter ?? 'this_month';

  const { isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
  const { now: today, todayStr } = useCurrentLocalDate();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const [metricMode, setMetricMode] = useState<AttendanceMetricMode>('rate');
  const [timeGrouping, setTimeGrouping] = useState<AttendanceTimeGrouping>('session');
  const [internalGroupId, setInternalGroupId] = useState<string>('all');
  const [internalStudentId, setInternalStudentId] = useState<string>('all');

  useEffect(() => {
    if (selectedGroupId) {
      setInternalGroupId('all');
      setInternalStudentId('all');
    }
  }, [selectedGroupId]);

  useEffect(() => {
    if (selectedStudentId) {
      setInternalStudentId('all');
    }
  }, [selectedStudentId]);

  const effectiveGroupId =
    selectedGroupId && selectedGroupId !== 'all' ? selectedGroupId : internalGroupId;
  const effectiveStudentId =
    selectedStudentId && selectedStudentId !== 'all' ? selectedStudentId : internalStudentId;

  // Filter group options according to resolvedServiceFilter
  const selectableGroups = useMemo(() => {
    return groups.filter((g) => {
      if (resolvedServiceFilter === 'private') return g.type === 'private';
      if (resolvedServiceFilter === 'group') return g.type !== 'private';
      return true;
    });
  }, [groups, resolvedServiceFilter]);

  // Filter student options according to active group (when a group is selected)
  const selectableStudents = useMemo(() => {
    const activeStudents = students.filter((st) => st.status !== 'archived');
    if (!effectiveGroupId || effectiveGroupId === 'all') {
      return activeStudents;
    }
    const enrolledIds = new Set(
      enrollments
        .filter((e) => e.groupId === effectiveGroupId && e.status !== 'stopped')
        .map((e) => e.studentId)
    );
    if (enrolledIds.size === 0) return activeStudents;
    return activeStudents.filter((st) => enrolledIds.has(st.id));
  }, [students, enrollments, effectiveGroupId]);

  // Reset internal student selection if no longer in selectableStudents
  useEffect(() => {
    if (
      internalStudentId !== 'all' &&
      !selectableStudents.some((st) => st.id === internalStudentId)
    ) {
      setInternalStudentId('all');
    }
  }, [internalStudentId, selectableStudents]);

  // 1. Primary Line Chart Data (respects effectiveStudentId & effectiveGroupId)
  const analytics = useMemo(
    () =>
      buildAttendanceTrendsAnalytics({
        sessions,
        allAttendance,
        students,
        groups,
        enrollments,
        selectedGroupId: effectiveGroupId,
        selectedStudentId: effectiveStudentId,
        serviceTypeFilter: resolvedServiceFilter,
        periodFilter: resolvedPeriodFilter,
        todayStr,
        currentMonth,
        currentYear,
        selectedSpecificMonth,
        selectedSpecificYear,
        customStartDate,
        customEndDate,
        timeGrouping,
        isEn,
      }),
    [
      sessions,
      allAttendance,
      students,
      groups,
      enrollments,
      effectiveGroupId,
      effectiveStudentId,
      resolvedServiceFilter,
      resolvedPeriodFilter,
      todayStr,
      currentMonth,
      currentYear,
      selectedSpecificMonth,
      selectedSpecificYear,
      customStartDate,
      customEndDate,
      timeGrouping,
      isEn,
    ]
  );

  // 2. Cohort-level Student Consistency Roster (for multi-student drill-down when !compact and !selectedStudentId)
  const cohortStudentRows = useMemo(() => {
    if (compact || selectedStudentId) return [];
    if (effectiveStudentId === 'all') return analytics.studentRows;
    return buildAttendanceTrendsAnalytics({
      sessions,
      allAttendance,
      students,
      groups,
      enrollments,
      selectedGroupId: effectiveGroupId,
      selectedStudentId: 'all',
      serviceTypeFilter: resolvedServiceFilter,
      periodFilter: resolvedPeriodFilter,
      todayStr,
      currentMonth,
      currentYear,
      selectedSpecificMonth,
      selectedSpecificYear,
      customStartDate,
      customEndDate,
      timeGrouping,
      isEn,
    }).studentRows;
  }, [
    compact,
    selectedStudentId,
    effectiveStudentId,
    analytics.studentRows,
    sessions,
    allAttendance,
    students,
    groups,
    enrollments,
    effectiveGroupId,
    resolvedServiceFilter,
    resolvedPeriodFilter,
    todayStr,
    currentMonth,
    currentYear,
    selectedSpecificMonth,
    selectedSpecificYear,
    customStartDate,
    customEndDate,
    timeGrouping,
    isEn,
  ]);

  const { points: filteredData, summary: stats } = analytics;

  const focusedStudentObj = useMemo(() => {
    if (!effectiveStudentId || effectiveStudentId === 'all') return null;
    return students.find((s) => s.id === effectiveStudentId) || null;
  }, [students, effectiveStudentId]);

  const bucketUnitLabel =
    timeGrouping === 'monthly'
      ? isEn
        ? 'months'
        : 'أشهر'
      : timeGrouping === 'weekly'
      ? isEn
        ? 'weeks'
        : 'أسابيع'
      : isEn
      ? 'dates'
      : 'أيام حصص';

  const rateColorClass =
    stats.overallRate >= 85
      ? 'text-teal'
      : stats.overallRate >= 70
      ? 'text-orange'
      : 'text-coral';

  const showGroupSelector = !selectedGroupId && selectableGroups.length > 1;
  const showStudentSelector = !selectedStudentId && selectableStudents.length > 0;

  return (
    <div
      data-testid="attendance-trends-line-chart"
      className="space-y-3.5 text-navy"
    >
      {/* 1. Scope & Timeframe Controls */}
      <div className="space-y-2">
        {(showGroupSelector || showStudentSelector) && (
          <div
            className={`grid gap-2 ${
              showGroupSelector && showStudentSelector ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {showGroupSelector && (
              <select
                aria-label={isEn ? 'Filter by group' : 'تصفية حسب المجموعة'}
                value={internalGroupId}
                onChange={(e) => setInternalGroupId(e.target.value)}
                className="w-full min-h-[40px] bg-mist hover:bg-mint-soft/50 border border-line rounded-xl px-3 py-1.5 text-xs text-navy font-semibold focus:outline-none focus:border-navy cursor-pointer transition-colors"
              >
                <option value="all">
                  {isEn ? 'All Groups & Services' : 'كافة المجموعات والخدمات'}
                </option>
                {selectableGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}

            {showStudentSelector && (
              <div className="flex items-center gap-1.5">
                <select
                  aria-label={isEn ? 'Filter by student' : 'تصفية حسب الطالب'}
                  value={internalStudentId}
                  onChange={(e) => setInternalStudentId(e.target.value)}
                  className="w-full min-h-[40px] bg-mist hover:bg-mint-soft/50 border border-line rounded-xl px-3 py-1.5 text-xs text-navy font-semibold focus:outline-none focus:border-navy cursor-pointer transition-colors"
                >
                  <option value="all">
                    {isEn
                      ? `All Students (${selectableStudents.length})`
                      : `جميع الطلاب (${selectableStudents.length})`}
                  </option>
                  {selectableStudents.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
                {internalStudentId !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setInternalStudentId('all')}
                    title={isEn ? 'Show all students' : 'عرض جميع الطلاب'}
                    className="min-h-[40px] px-2.5 rounded-xl bg-mist hover:bg-mint-soft border border-line text-slate hover:text-navy text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <AppIcon name="close" size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bucketing & Series Mode Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="grid grid-cols-3 bg-mist p-1 rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setTimeGrouping('session')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
                timeGrouping === 'session'
                  ? 'bg-navy text-page shadow-2xs'
                  : 'text-slate hover:text-navy'
              }`}
            >
              {isEn ? 'Daily' : 'يومي'}
            </button>
            <button
              type="button"
              onClick={() => setTimeGrouping('weekly')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
                timeGrouping === 'weekly'
                  ? 'bg-navy text-page shadow-2xs'
                  : 'text-slate hover:text-navy'
              }`}
            >
              {isEn ? 'Weekly' : 'أسبوعي'}
            </button>
            <button
              type="button"
              onClick={() => setTimeGrouping('monthly')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
                timeGrouping === 'monthly'
                  ? 'bg-navy text-page shadow-2xs'
                  : 'text-slate hover:text-navy'
              }`}
            >
              {isEn ? 'Monthly' : 'شهري'}
            </button>
          </div>

          <div className="grid grid-cols-3 bg-mist p-1 rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setMetricMode('rate')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
                metricMode === 'rate'
                  ? 'bg-navy text-page shadow-2xs'
                  : 'text-slate hover:text-navy'
              }`}
            >
              {isEn ? 'Rate %' : 'النسبة %'}
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('counts')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
                metricMode === 'counts'
                  ? 'bg-navy text-page shadow-2xs'
                  : 'text-slate hover:text-navy'
              }`}
            >
              {isEn ? 'Counts' : 'الأعداد'}
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('all')}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
                metricMode === 'all'
                  ? 'bg-navy text-page shadow-2xs'
                  : 'text-slate hover:text-navy'
              }`}
            >
              {isEn ? 'Combined' : 'مزدوج'}
            </button>
          </div>
        </div>

        {/* Unboxed Contextual Metadata Line */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate tabular-nums px-0.5">
          <span className="truncate">
            {focusedStudentObj
              ? isEn
                ? `Focused: ${focusedStudentObj.name}`
                : `الطالب المحدد: ${focusedStudentObj.name}`
              : isEn
              ? 'Cohort consistency trajectory'
              : 'مسار انتظام الحضور عبر الزمن'}
            {' · '}
            {filteredData.length} {bucketUnitLabel}
          </span>
          {filteredData.length > 0 && (
            <span className="shrink-0 font-medium text-navy">
              {stats.stabilityBand === 'consistent'
                ? isEn
                  ? 'Steady ≥85%'
                  : 'التزام منتظم'
                : stats.stabilityBand === 'moderate'
                ? isEn
                  ? 'Moderate 70–84%'
                  : 'التزام متوسط'
                : isEn
                ? 'Needs Follow-up <70%'
                : 'يحتاج متابعة'}
            </span>
          )}
        </div>
      </div>

      {/* 2. Consistency KPI Summary */}
      {filteredData.length > 0 &&
        (compact ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 bg-mist rounded-[18px] border border-line divide-y sm:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse divide-line tabular-nums">
            <div className="p-3 flex flex-col justify-between">
              <span className="text-[11px] text-slate truncate">
                {isEn ? 'Commitment Rate' : 'معدل الالتزام'}
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <strong className={`text-base font-bold ${rateColorClass}`}>
                  {stats.overallRate}%
                </strong>
                {stats.trendDelta !== 0 && (
                  <span
                    className={`text-[10px] font-semibold inline-flex items-center gap-0.5 ${
                      stats.trendDelta > 0 ? 'text-teal' : 'text-coral'
                    }`}
                  >
                    <AppIcon
                      name={stats.trendDelta > 0 ? 'trendUp' : 'trendDown'}
                      size={11}
                    />
                    {stats.trendDelta > 0 ? `+${stats.trendDelta}%` : `${stats.trendDelta}%`}
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 flex flex-col justify-between">
              <span className="text-[11px] text-slate truncate">
                {isEn ? 'Steady Periods (≥85%)' : 'فترات منتظمة (≥85%)'}
              </span>
              <strong className="text-base font-bold text-navy mt-1">
                {stats.consistentBucketsCount}/{stats.totalBucketsCount}{' '}
                <span className="text-[11px] font-normal text-slate">
                  ({stats.consistentBucketsRatio}%)
                </span>
              </strong>
            </div>

            <div className="p-3 flex flex-col justify-between">
              <span className="text-[11px] text-slate truncate">
                {isEn ? 'Current Streak' : 'سلسلة الانتظام'}
              </span>
              <strong className="text-base font-bold text-teal mt-1">
                {stats.currentStreak}{' '}
                <span className="text-[11px] font-normal text-slate">
                  {focusedStudentObj
                    ? isEn
                      ? 'lessons'
                      : 'حصص'
                    : isEn
                    ? 'periods'
                    : 'فترات'}
                </span>
              </strong>
            </div>

            <div className="p-3 flex flex-col justify-between">
              <span className="text-[11px] text-slate truncate">
                {isEn ? 'Present · Absent' : 'حضور · غياب'}
              </span>
              <strong className="text-base font-bold text-navy mt-1">
                <span className="text-teal">{stats.totalAttended}</span>
                <span className="text-slate font-normal"> · </span>
                <span className="text-coral">{stats.totalAbsent}</span>
              </strong>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 tabular-nums">
            <div className="bg-mist p-3.5 rounded-2xl border border-line flex flex-col justify-between min-h-[84px]">
              <div className="flex items-center justify-between text-slate text-[11px] font-medium">
                <span className="truncate">{isEn ? 'Commitment Rate' : 'متوسط الالتزام'}</span>
                <AppIcon name="award" size={14} className="text-navy shrink-0" />
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <strong className={`text-lg font-bold ${rateColorClass}`}>
                  {stats.overallRate}%
                </strong>
                {stats.trendDelta !== 0 && (
                  <span
                    className={`text-[11px] font-semibold inline-flex items-center gap-0.5 ${
                      stats.trendDelta > 0 ? 'text-teal' : 'text-coral'
                    }`}
                  >
                    <AppIcon
                      name={stats.trendDelta > 0 ? 'trendUp' : 'trendDown'}
                      size={12}
                    />
                    <span>
                      {stats.trendDelta > 0 ? `+${stats.trendDelta}%` : `${stats.trendDelta}%`}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <div className="bg-mist p-3.5 rounded-2xl border border-line flex flex-col justify-between min-h-[84px]">
              <div className="flex items-center justify-between text-slate text-[11px] font-medium">
                <span className="truncate">
                  {isEn ? 'Consistency (≥85%)' : 'ثبات الحضور (≥85%)'}
                </span>
                <AppIcon name="activity" size={14} className="text-teal shrink-0" />
              </div>
              <strong className="text-lg font-bold text-navy block truncate mt-1">
                {stats.consistentBucketsRatio}%{' '}
                <span className="text-[11px] text-slate font-normal">
                  · {stats.consistentBucketsCount}/{stats.totalBucketsCount}
                </span>
              </strong>
            </div>

            <div className="bg-mist p-3.5 rounded-2xl border border-line flex flex-col justify-between min-h-[84px]">
              <div className="flex items-center justify-between text-slate text-[11px] font-medium">
                <span className="truncate">
                  {isEn ? 'Current Streak' : 'سلسلة الانتظام المتتالية'}
                </span>
                <AppIcon name="flame" size={14} className="text-orange shrink-0" />
              </div>
              <strong className="text-lg font-bold text-teal block truncate mt-1">
                {stats.currentStreak}{' '}
                <span className="text-[11px] text-slate font-normal">
                  {focusedStudentObj
                    ? isEn
                      ? 'consecutive lessons'
                      : 'حصص متتالية'
                    : isEn
                    ? `periods (best ${stats.longestStreak})`
                    : `فترات (الأطول ${stats.longestStreak})`}
                </span>
              </strong>
            </div>

            <div className="bg-mist p-3.5 rounded-2xl border border-line flex flex-col justify-between min-h-[84px]">
              <div className="flex items-center justify-between text-slate text-[11px] font-medium">
                <span className="truncate">
                  {isEn ? 'Presences vs Absences' : 'إجمالي الحضور والغياب'}
                </span>
                <AppIcon name="checkCircle" size={14} className="text-navy shrink-0" />
              </div>
              <strong className="text-lg font-bold text-navy block truncate mt-1">
                <span className="text-teal">{stats.totalAttended}</span>
                <span className="text-xs text-slate font-normal"> / </span>
                <span className="text-coral">{stats.totalAbsent}</span>{' '}
                <span className="text-[11px] text-slate font-normal">
                  {isEn ? 'absences' : 'غياب'}
                </span>
              </strong>
            </div>
          </div>
        ))}

      {/* 3. Recharts LineChart Visualization */}
      {filteredData.length === 0 ? (
        <div className="p-8 sm:p-10 text-center text-slate space-y-2.5 flex flex-col items-center justify-center bg-mist rounded-2xl border border-line">
          <div className="w-11 h-11 rounded-2xl bg-page flex items-center justify-center text-navy border border-line">
            <AppIcon name="activity" size={22} />
          </div>
          <div className="space-y-1 max-w-sm">
            <h4 className="font-semibold text-sm text-navy">
              {isEn
                ? 'No recorded attendance in this period'
                : 'لا توجد سجلات حضور مرصودة في هذه الفترة'}
            </h4>
            <p className="text-xs text-slate">
              {isEn
                ? 'Mark student attendance in your sessions or widen the timeframe chip above to view the consistency line chart.'
                : 'سجّل حضور الطلاب في الحصص أو اختر فترة زمنية أوسع بالأعلى لعرض منحنى انتظام الحضور.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="w-full h-72 sm:h-80 pt-1 select-none tabular-nums">
            <ResponsiveContainer width="100%" height="100%">
              {metricMode === 'rate' ? (
                <LineChart
                  data={filteredData}
                  margin={{ top: 10, right: 12, left: isRTL ? 12 : -18, bottom: 2 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-line)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="displayLabel"
                    stroke="var(--color-slate)"
                    fontSize={11}
                    tick={{ fill: 'var(--color-slate)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-line)' }}
                    minTickGap={16}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 85, 100]}
                    stroke="var(--color-slate)"
                    fontSize={11}
                    tick={{ fill: 'var(--color-slate)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-line)' }}
                    tickFormatter={(val) => `${val}%`}
                    orientation={isRTL ? 'right' : 'left'}
                  />
                  <Tooltip
                    content={<AttendanceLineTooltip isRTL={isRTL} isEn={isEn} />}
                  />
                  <ReferenceLine
                    y={85}
                    stroke="var(--color-teal)"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="rollingAvgRate"
                    name={isEn ? '3-Pt Consistency Avg' : 'متوسط الانتظام المتحرك'}
                    stroke="var(--color-teal)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--color-teal)', stroke: 'var(--color-page)', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    name={isEn ? 'Attendance Rate %' : 'نسبة الحضور %'}
                    stroke="var(--color-navy)"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: 'var(--color-navy)',
                      stroke: 'var(--color-page)',
                      strokeWidth: 1.5,
                    }}
                    activeDot={{
                      r: 6,
                      fill: 'var(--color-orange)',
                      stroke: 'var(--color-page)',
                      strokeWidth: 2.5,
                    }}
                  />
                </LineChart>
              ) : metricMode === 'counts' ? (
                <LineChart
                  data={filteredData}
                  margin={{ top: 10, right: 12, left: isRTL ? 12 : -18, bottom: 2 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-line)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="displayLabel"
                    stroke="var(--color-slate)"
                    fontSize={11}
                    tick={{ fill: 'var(--color-slate)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-line)' }}
                    minTickGap={16}
                  />
                  <YAxis
                    stroke="var(--color-slate)"
                    fontSize={11}
                    tick={{ fill: 'var(--color-slate)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-line)' }}
                    orientation={isRTL ? 'right' : 'left'}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={<AttendanceLineTooltip isRTL={isRTL} isEn={isEn} />}
                  />
                  <Line
                    type="monotone"
                    dataKey="attended"
                    name={isEn ? 'Present / Late' : 'حضور / تأخير'}
                    stroke="var(--color-teal)"
                    strokeWidth={2.75}
                    dot={{
                      r: 4,
                      fill: 'var(--color-teal)',
                      stroke: 'var(--color-page)',
                      strokeWidth: 1.5,
                    }}
                    activeDot={{ r: 6, fill: 'var(--color-teal)', stroke: 'var(--color-page)', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="absentCharged"
                    name={isEn ? 'Charged Absence' : 'غياب محسوب'}
                    stroke="var(--color-coral)"
                    strokeWidth={2.5}
                    dot={{
                      r: 3.5,
                      fill: 'var(--color-coral)',
                      stroke: 'var(--color-page)',
                      strokeWidth: 1.5,
                    }}
                    activeDot={{ r: 6, fill: 'var(--color-coral)', stroke: 'var(--color-page)', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="absentExcused"
                    name={isEn ? 'Excused Absence' : 'غياب معفى'}
                    stroke="var(--color-orange)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3, fill: 'var(--color-orange)' }}
                  />
                </LineChart>
              ) : (
                <LineChart
                  data={filteredData}
                  margin={{ top: 10, right: 8, left: -12, bottom: 2 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-line)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="displayLabel"
                    stroke="var(--color-slate)"
                    fontSize={11}
                    tick={{ fill: 'var(--color-slate)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-line)' }}
                    minTickGap={16}
                  />
                  <YAxis
                    yAxisId="rate"
                    domain={[0, 100]}
                    stroke="var(--color-slate)"
                    fontSize={11}
                    tick={{ fill: 'var(--color-slate)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-line)' }}
                    tickFormatter={(val) => `${val}%`}
                    orientation={isRTL ? 'right' : 'left'}
                  />
                  <YAxis
                    yAxisId="count"
                    stroke="var(--color-slate)"
                    fontSize={11}
                    tick={{ fill: 'var(--color-slate)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-line)' }}
                    orientation={isRTL ? 'left' : 'right'}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={<AttendanceLineTooltip isRTL={isRTL} isEn={isEn} />}
                  />
                  <ReferenceLine
                    yAxisId="rate"
                    y={85}
                    stroke="var(--color-teal)"
                    strokeDasharray="4 4"
                    strokeWidth={1.25}
                  />
                  <Line
                    yAxisId="rate"
                    type="monotone"
                    dataKey="rate"
                    name={isEn ? 'Attendance Rate %' : 'نسبة الحضور %'}
                    stroke="var(--color-navy)"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: 'var(--color-navy)',
                      stroke: 'var(--color-page)',
                      strokeWidth: 1.5,
                    }}
                    activeDot={{ r: 6, fill: 'var(--color-orange)', stroke: 'var(--color-page)', strokeWidth: 2 }}
                  />
                  <Line
                    yAxisId="count"
                    type="monotone"
                    dataKey="attended"
                    name={isEn ? 'Present / Late' : 'عدد الحاضرين'}
                    stroke="var(--color-teal)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'var(--color-teal)' }}
                  />
                  <Line
                    yAxisId="count"
                    type="monotone"
                    dataKey="absentTotal"
                    name={isEn ? 'Total Absences' : 'إجمالي الغياب'}
                    stroke="var(--color-coral)"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={{ r: 3, fill: 'var(--color-coral)' }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Custom Tailwind Series Legend (Zero inline styles) */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-line text-[11px] text-slate flex-wrap">
            {metricMode === 'rate' ? (
              <div className="flex items-center gap-4 flex-wrap">
                <span className="inline-flex items-center gap-1.5 font-medium text-navy">
                  <span className="w-3.5 h-0.5 bg-navy rounded-full inline-block" />
                  <span>{isEn ? 'Attendance Rate %' : 'نسبة الحضور %'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-teal">
                  <span className="w-3.5 border-t-2 border-dashed border-teal inline-block" />
                  <span>{isEn ? 'Moving Consistency Avg' : 'متوسط الانتظام المتحرك'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal/70 inline-block" />
                  <span>{isEn ? '85% Target Benchmark' : 'خط الهدف المرجعي 85%'}</span>
                </span>
              </div>
            ) : metricMode === 'counts' ? (
              <div className="flex items-center gap-4 flex-wrap">
                <span className="inline-flex items-center gap-1.5 font-medium text-navy">
                  <span className="w-3 h-0.5 bg-teal rounded-full inline-block" />
                  <span>{isEn ? 'Present / Late' : 'حضور / تأخير'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-navy">
                  <span className="w-3 h-0.5 bg-coral rounded-full inline-block" />
                  <span>{isEn ? 'Charged Absence' : 'غياب محسوب'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 border-t-2 border-dashed border-orange inline-block" />
                  <span>{isEn ? 'Excused Absence' : 'غياب معفى'}</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-4 flex-wrap">
                <span className="inline-flex items-center gap-1.5 font-medium text-navy">
                  <span className="w-3.5 h-0.5 bg-navy rounded-full inline-block" />
                  <span>{isEn ? 'Rate %' : 'النسبة %'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-teal">
                  <span className="w-3 h-0.5 bg-teal rounded-full inline-block" />
                  <span>{isEn ? 'Present Count' : 'عدد الحاضرين'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-coral">
                  <span className="w-3 border-t-2 border-dashed border-coral inline-block" />
                  <span>{isEn ? 'Absences' : 'الغياب'}</span>
                </span>
              </div>
            )}

            {stats.peakDate && (
              <span className="tabular-nums text-slate">
                {isEn
                  ? `Peak ${stats.peakRate}% (${stats.peakDate}) · Low ${stats.lowestRate}%`
                  : `الأعلى ${stats.peakRate}% (${stats.peakDate}) · الأدنى ${stats.lowestRate}%`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 4. Interactive Per-Student Consistency Breakdown (shown in expanded Attendance Trends view) */}
      {!compact && !selectedStudentId && cohortStudentRows.length > 0 && (
        <div className="pt-3 border-t border-line space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-navy">
                {isEn
                  ? 'Student Consistency Breakdown'
                  : 'تفصيل انتظام الطلاب عبر الحصص'}
              </h4>
              <p className="text-[11px] text-slate">
                {isEn
                  ? 'Select a student row to plot their individual attendance line chart'
                  : 'اضغط على أي طالب لعرض منحنى انتظامه الفردي على الرسم البياني'}
              </p>
            </div>
            {internalStudentId !== 'all' && (
              <button
                type="button"
                onClick={() => setInternalStudentId('all')}
                className="text-xs font-semibold text-teal hover:text-navy transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isEn ? 'Reset Filter' : 'عرض الكل'}
              </button>
            )}
          </div>

          <div className="divide-y divide-line max-h-64 overflow-y-auto">
            {cohortStudentRows.slice(0, 12).map((row) => {
              const isSelected = internalStudentId === row.studentId;
              const rowRateClass =
                row.consistencyBand === 'consistent'
                  ? 'text-teal'
                  : row.consistencyBand === 'moderate'
                  ? 'text-orange'
                  : 'text-coral';

              return (
                <button
                  key={row.studentId}
                  type="button"
                  onClick={() =>
                    setInternalStudentId(isSelected ? 'all' : row.studentId)
                  }
                  className={`w-full py-2.5 px-2 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer rounded-lg tabular-nums ${
                    isSelected ? 'bg-mint-soft/70' : 'hover:bg-mist'
                  }`}
                >
                  <div className="min-w-0 text-start">
                    <span className="font-semibold text-navy block truncate">
                      {row.studentName}
                    </span>
                    <span className="text-[11px] text-slate block truncate mt-0.5">
                      {isEn
                        ? `${row.attended}/${row.totalExpected} attended · ${row.absentTotal} absent · Streak ${row.currentStreak}`
                        : `حضر ${row.attended} من ${row.totalExpected} · غياب ${row.absentTotal} · سلسلة ${row.currentStreak}`}
                    </span>
                  </div>

                  <div className="text-end shrink-0">
                    <strong className={`text-sm font-bold block ${rowRateClass}`}>
                      {row.rate}%
                    </strong>
                    <span className="text-[10px] text-slate block">
                      {row.consistencyBand === 'consistent'
                        ? isEn
                          ? 'Steady'
                          : 'منتظم'
                        : row.consistencyBand === 'moderate'
                        ? isEn
                          ? 'Moderate'
                          : 'متوسط'
                        : isEn
                        ? 'Follow-up'
                        : 'متابعة'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
