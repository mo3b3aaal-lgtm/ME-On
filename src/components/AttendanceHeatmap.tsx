import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { AppIcon } from './ui/AppIcon';
import {
  Session,
  Attendance,
  Student,
  Group,
  Enrollment,
} from '../types';
import { useTranslation } from '../utils/i18n';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import {
  HIGH_ABSENCE_THRESHOLD_PERCENT,
  HeatmapDayCell,
  HeatmapSeasonalMonthStat,
  HeatmapSpotlightMode,
  HeatmapWindowMode,
  buildAttendanceHeatmapAnalytics,
  extractAvailableHeatmapYears,
  pickInitialHeatmapYear,
} from '../utils/attendanceHeatmap';

export interface AttendanceHeatmapProps {
  sessions: Session[];
  allAttendance: Attendance[];
  students?: Student[];
  groups?: Group[];
  enrollments?: Enrollment[];
  selectedGroupId?: string;
  selectedStudentId?: string;
  serviceTypeFilter?: 'all' | 'group' | 'private';
  preferredYear?: number;
  compact?: boolean;
}

interface DayTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: HeatmapDayCell }>;
  isRTL: boolean;
  isEn: boolean;
}

const HeatmapDayTooltip: React.FC<DayTooltipProps> = ({
  active,
  payload,
  isRTL,
  isEn,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const cell = payload[0].payload;

  return (
    <div
      className="bg-page border border-line text-navy p-3 rounded-[16px] shadow-white text-xs space-y-1.5 z-50 min-w-[192px] pointer-events-none tabular-nums"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line pb-1.5">
        <span className="font-bold text-navy truncate">
          {cell.weekdayFullLabel} · {cell.displayDate}
        </span>
      </div>

      {cell.totalExpected === 0 ? (
        <p className="text-[11px] text-slate pt-0.5">
          {cell.isFuture
            ? isEn
              ? 'Upcoming date — no attendance recorded yet'
              : 'تاريخ قادم — لم يُسجل حضور بعد'
            : isEn
            ? 'No recorded attendance on this day'
            : 'لا توجد حصص مرصودة في هذا اليوم'}
        </p>
      ) : (
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate">
              {isEn ? 'Absence Rate' : 'نسبة الغياب'}
            </span>
            <strong
              className={`font-bold text-sm ${
                cell.isHighAbsence
                  ? 'text-coral'
                  : (cell.absenceRate ?? 0) > 15
                  ? 'text-orange'
                  : 'text-teal'
              }`}
            >
              {cell.absenceRate}%
            </strong>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-slate">
              {isEn ? 'Attendance Rate' : 'نسبة الحضور'}
            </span>
            <span className="font-semibold text-navy">{cell.attendanceRate}%</span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 border-t border-line/70 text-[11px]">
            <span className="text-slate">
              {isEn ? 'Present / Late' : 'حضور / تأخير'}
            </span>
            <span className="font-semibold text-teal">
              {cell.attended} ({cell.present} + {cell.late})
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-slate">
              {isEn ? 'Absences (Charged · Excused)' : 'الغياب (محسوب · معفى)'}
            </span>
            <span className="font-semibold text-coral">
              {cell.absentTotal} ({cell.absentCharged} · {cell.absentExcused})
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1 border-t border-line text-[11px]">
            <span className="text-slate">
              {isEn ? 'Sessions Recorded' : 'عدد الحصص المرصودة'}
            </span>
            <strong className="text-navy">{cell.sessionsCount}</strong>
          </div>
        </div>
      )}
    </div>
  );
};

interface SeasonalBarTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: HeatmapSeasonalMonthStat }>;
  isRTL: boolean;
  isEn: boolean;
}

const SeasonalMonthTooltip: React.FC<SeasonalBarTooltipProps> = ({
  active,
  payload,
  isRTL,
  isEn,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;

  return (
    <div
      className="bg-page border border-line text-navy p-3 rounded-[16px] shadow-white text-xs space-y-1.5 z-50 min-w-[180px] pointer-events-none tabular-nums"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="font-bold text-navy border-b border-line pb-1">
        {item.label} {item.year}
      </div>
      {!item.hasData ? (
        <p className="text-[11px] text-slate">
          {isEn ? 'No recorded sessions in this month' : 'لا توجد حصص مرصودة في هذا الشهر'}
        </p>
      ) : (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate">{isEn ? 'Absence Rate' : 'معدل الغياب'}</span>
            <strong
              className={`font-bold ${
                item.absenceRate >= HIGH_ABSENCE_THRESHOLD_PERCENT
                  ? 'text-coral'
                  : item.absenceRate > 15
                  ? 'text-orange'
                  : 'text-teal'
              }`}
            >
              {item.absenceRate}%
            </strong>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate">{isEn ? 'Attendance Rate' : 'معدل الحضور'}</span>
            <span className="font-semibold text-navy">{item.attendanceRate}%</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px] pt-1 border-t border-line">
            <span className="text-slate">
              {isEn ? 'High-Absence Days' : 'أيام غياب مرتفع'}
            </span>
            <strong className="text-coral">{item.highAbsenceDaysCount}</strong>
          </div>
        </div>
      )}
    </div>
  );
};

export const AttendanceHeatmap: React.FC<AttendanceHeatmapProps> = ({
  sessions,
  allAttendance,
  students = [],
  groups = [],
  enrollments = [],
  selectedGroupId,
  selectedStudentId,
  serviceTypeFilter,
  preferredYear,
  compact = false,
}) => {
  const resolvedServiceFilter: 'all' | 'group' | 'private' = serviceTypeFilter ?? 'all';

  const { isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
  const { now: today, todayStr } = useCurrentLocalDate();
  const currentYear = today.getFullYear();

  const availableYears = useMemo(
    () => extractAvailableHeatmapYears(sessions, currentYear),
    [sessions, currentYear]
  );

  const [windowMode, setWindowMode] = useState<HeatmapWindowMode>('calendar_year');
  const [targetYear, setTargetYear] = useState<number>(() =>
    pickInitialHeatmapYear(sessions, allAttendance, currentYear, preferredYear)
  );
  const [spotlightMode, setSpotlightMode] = useState<HeatmapSpotlightMode>('all');
  const [internalGroupId, setInternalGroupId] = useState<string>('all');
  const [internalStudentId, setInternalStudentId] = useState<string>('all');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync preferredYear when parent switches specific year filter
  useEffect(() => {
    if (preferredYear && Number.isFinite(preferredYear)) {
      setTargetYear(preferredYear);
    }
  }, [preferredYear]);

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

  const selectableGroups = useMemo(() => {
    return groups.filter((g) => {
      if (resolvedServiceFilter === 'private') return g.type === 'private';
      if (resolvedServiceFilter === 'group') return g.type !== 'private';
      return true;
    });
  }, [groups, resolvedServiceFilter]);

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

  useEffect(() => {
    if (
      internalStudentId !== 'all' &&
      !selectableStudents.some((st) => st.id === internalStudentId)
    ) {
      setInternalStudentId('all');
    }
  }, [internalStudentId, selectableStudents]);

  const heatmap = useMemo(
    () =>
      buildAttendanceHeatmapAnalytics({
        sessions,
        allAttendance,
        students,
        groups,
        enrollments,
        selectedGroupId: effectiveGroupId,
        selectedStudentId: effectiveStudentId,
        serviceTypeFilter: resolvedServiceFilter,
        windowMode,
        targetYear,
        todayStr,
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
      windowMode,
      targetYear,
      todayStr,
      isEn,
    ]
  );

  const {
    cells,
    maxWeekIndex,
    monthTicks,
    weekdayLabels,
    monthlySeasonality,
    weekdayPatterns,
    highAbsenceDays,
    summary,
  } = heatmap;

  // Clear selected date if outside current window
  useEffect(() => {
    if (selectedDateKey && !cells.some((c) => c.dateKey === selectedDateKey)) {
      setSelectedDateKey(null);
    }
  }, [cells, selectedDateKey]);

  const selectedCell = useMemo(
    () => (selectedDateKey ? cells.find((c) => c.dateKey === selectedDateKey) || null : null),
    [cells, selectedDateKey]
  );

  const monthTickIndices = useMemo(
    () => monthTicks.map((t) => t.weekIndex),
    [monthTicks]
  );

  const monthTickMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of monthTicks) {
      map.set(t.weekIndex, t.label);
    }
    return map;
  }, [monthTicks]);

  const weekdayTickMap = useMemo(() => {
    const map = new Map<number, string>();
    // Label alternate rows (Sat, Mon, Wed, Fri) for crisp vertical legibility
    for (const wd of weekdayLabels) {
      if (wd.row === 0 || wd.row === 2 || wd.row === 4 || wd.row === 6) {
        map.set(wd.row, wd.shortLabel);
      } else {
        map.set(wd.row, '');
      }
    }
    return map;
  }, [weekdayLabels]);

  const handleSelectDay = useCallback((cell: HeatmapDayCell) => {
    setSelectedDateKey((prev) => (prev === cell.dateKey ? null : cell.dateKey));
  }, []);

  // Custom SVG tile renderer for Recharts <Scatter>
  const renderHeatmapCell = useCallback(
    (props: any): React.ReactElement<SVGElement> => {
      const cx = Number(props?.cx);
      const cy = Number(props?.cy);
      const cell = props?.payload as HeatmapDayCell | undefined;

      if (!cell || !Number.isFinite(cx) || !Number.isFinite(cy)) {
        return <g />;
      }

      const size = 10.5;
      const half = size / 2;
      const isSelected = selectedDateKey === cell.dateKey;
      const isDimmed =
        spotlightMode === 'high_absence' && !cell.isHighAbsence;

      let fill = 'var(--color-mist)';
      let stroke = 'var(--color-line)';
      let strokeWidth = 0.75;
      let fillOpacity = cell.isFuture ? 0.45 : 1;

      if (cell.intensityBand === 'optimal') {
        fill = 'var(--color-teal)';
        stroke = 'var(--color-teal)';
        strokeWidth = 0.5;
      } else if (cell.intensityBand === 'steady') {
        fill = 'var(--color-mint)';
        stroke = 'var(--color-teal)';
        strokeWidth = 0.65;
      } else if (cell.intensityBand === 'moderate_dip') {
        fill = 'var(--color-orange)';
        stroke = 'var(--color-orange-deep)';
        strokeWidth = 0.65;
      } else if (cell.intensityBand === 'high_absence') {
        fill = 'var(--color-coral)';
        stroke = 'var(--color-coral)';
        strokeWidth = 0.9;
      }

      if (isDimmed) {
        fillOpacity = 0.2;
      }

      return (
        <g
          className="cursor-pointer"
          onClick={() => handleSelectDay(cell)}
        >
          {/* Expanded invisible touch hit area */}
          <rect
            x={cx - 6.5}
            y={cy - 6.5}
            width={13}
            height={13}
            fill="transparent"
          />
          <rect
            x={cx - half}
            y={cy - half}
            width={size}
            height={size}
            rx={2.5}
            ry={2.5}
            fill={fill}
            fillOpacity={fillOpacity}
            stroke={stroke}
            strokeOpacity={isDimmed ? 0.25 : 0.85}
            strokeWidth={strokeWidth}
          />
          {/* Non-hue-only marker dot inside High-Absence cells for color-blind accessibility */}
          {cell.isHighAbsence && (
            <circle
              cx={cx}
              cy={cy}
              r={1.65}
              fill="var(--color-page)"
              pointerEvents="none"
            />
          )}
          {/* Selected or Today focus frame */}
          {isSelected ? (
            <rect
              x={cx - half - 1.5}
              y={cy - half - 1.5}
              width={size + 3}
              height={size + 3}
              rx={3.5}
              ry={3.5}
              fill="none"
              stroke="var(--color-navy)"
              strokeWidth={1.75}
              pointerEvents="none"
            />
          ) : cell.isToday ? (
            <rect
              x={cx - half - 1}
              y={cy - half - 1}
              width={size + 2}
              height={size + 2}
              rx={3}
              ry={3}
              fill="none"
              stroke="var(--color-navy)"
              strokeOpacity={0.55}
              strokeWidth={1}
              pointerEvents="none"
            />
          ) : null}
        </g>
      );
    },
    [selectedDateKey, spotlightMode, handleSelectDay]
  );

  const canStepPrevYear = targetYear > Math.min(currentYear - 4, availableYears[0] ?? currentYear - 2);
  const canStepNextYear = targetYear < Math.max(currentYear + 1, availableYears[availableYears.length - 1] ?? currentYear);

  const showGroupSelector = !selectedGroupId && selectableGroups.length > 1 && !compact;
  const showStudentSelector = !selectedStudentId && selectableStudents.length > 0 && !compact;

  return (
    <div
      data-testid="attendance-calendar-heatmap"
      className="space-y-3.5 text-navy tabular-nums"
    >
      {/* 1. Top Control Strip: Year / Rolling 12M + High-Absence Spotlight */}
      <div className="space-y-2">
        {(showGroupSelector || showStudentSelector) && (
          <div
            className={`grid gap-2 ${
              showGroupSelector && showStudentSelector ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {showGroupSelector && (
              <select
                aria-label={isEn ? 'Filter heatmap by group' : 'تصفية الخريطة حسب المجموعة'}
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
              <select
                aria-label={isEn ? 'Filter heatmap by student' : 'تصفية الخريطة حسب الطالب'}
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
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Calendar Year Stepper vs Rolling 365d Toggle */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="inline-flex items-center bg-mist p-1 rounded-xl border border-line">
              <button
                type="button"
                onClick={() => setWindowMode('calendar_year')}
                className={`py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  windowMode === 'calendar_year'
                    ? 'bg-navy text-page shadow-2xs'
                    : 'text-slate hover:text-navy'
                }`}
              >
                {isEn ? 'Calendar Year' : 'سنة تقويمية'}
              </button>
              <button
                type="button"
                onClick={() => setWindowMode('rolling_365')}
                className={`py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  windowMode === 'rolling_365'
                    ? 'bg-navy text-page shadow-2xs'
                    : 'text-slate hover:text-navy'
                }`}
              >
                {isEn ? 'Rolling 12M' : 'آخر 12 شهراً'}
              </button>
            </div>

            {windowMode === 'calendar_year' && (
              <div className="inline-flex items-center bg-mist p-1 rounded-xl border border-line gap-0.5">
                <button
                  type="button"
                  disabled={!canStepPrevYear}
                  onClick={() => setTargetYear((y) => y - 1)}
                  aria-label={isEn ? 'Previous year' : 'السنة السابقة'}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-navy hover:bg-page disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                >
                  <AppIcon name="chevronStart" size={14} />
                </button>
                <span className="px-2 text-xs font-bold text-navy whitespace-nowrap shrink-0">
                  {targetYear}
                </span>
                <button
                  type="button"
                  disabled={!canStepNextYear}
                  onClick={() => setTargetYear((y) => y + 1)}
                  aria-label={isEn ? 'Next year' : 'السنة التالية'}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-navy hover:bg-page disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                >
                  <AppIcon name="chevronEnd" size={14} />
                </button>
              </div>
            )}
          </div>

          {/* High-Absence Spotlight Toggle */}
          <button
            type="button"
            data-testid="heatmap-high-absence-toggle"
            onClick={() =>
              setSpotlightMode((prev) =>
                prev === 'high_absence' ? 'all' : 'high_absence'
              )
            }
            className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              spotlightMode === 'high_absence'
                ? 'bg-coral text-page border-coral'
                : 'bg-mist hover:bg-mint-soft/60 text-navy border-line'
            }`}
          >
            <AppIcon
              name="warning"
              size={13}
              weight={spotlightMode === 'high_absence' ? 'fill' : 'regular'}
              className={spotlightMode === 'high_absence' ? 'text-page' : 'text-coral'}
            />
            <span>
              {isEn
                ? `High Absence Days (${summary.highAbsenceDaysCount})`
                : `أيام الغياب المرتفع (${summary.highAbsenceDaysCount})`}
            </span>
          </button>
        </div>

        {/* Unboxed Seasonal & Consistency Metadata Line */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate flex-wrap px-0.5">
          <span>
            {isEn
              ? `${summary.activeSessionDays} active lesson days · ${summary.overallAttendanceRate}% annual attendance · ${summary.overallAbsenceRate}% absence`
              : `${summary.activeSessionDays} يوم دراسي مرصود · ${summary.overallAttendanceRate}% حضور سنوي · ${summary.overallAbsenceRate}% غياب`}
          </span>
          {summary.worstSeasonalMonth && (
            <span className="font-medium text-navy">
              {isEn
                ? `Seasonal dip: ${summary.worstSeasonalMonth.shortLabel} (${summary.worstSeasonalMonth.absenceRate}% absence)`
                : `أعلى غياب موسمي: ${summary.worstSeasonalMonth.shortLabel} (${summary.worstSeasonalMonth.absenceRate}% غياب)`}
              {summary.highestAbsenceWeekday
                ? isEn
                  ? ` · ${summary.highestAbsenceWeekday.fullLabel}s (${summary.highestAbsenceWeekday.absenceRate}%)`
                  : ` · يوم ${summary.highestAbsenceWeekday.fullLabel} (${summary.highestAbsenceWeekday.absenceRate}%)`
                : ''}
            </span>
          )}
        </div>
      </div>

      {/* 2. Summary KPI Strip */}
      {summary.activeSessionDays > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 bg-mist rounded-[18px] border border-line divide-y sm:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse divide-line">
          <div className="p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate truncate">
              {isEn ? 'Active Lesson Days' : 'أيام الدراسة الفعلية'}
            </span>
            <strong className="text-base font-bold text-navy mt-1">
              {summary.activeSessionDays}{' '}
              <span className="text-[11px] font-normal text-slate">
                / {summary.totalCalendarDays}
              </span>
            </strong>
          </div>

          <div className="p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate truncate">
              {isEn ? 'High Absence (≥30%)' : 'غياب مرتفع (≥30%)'}
            </span>
            <strong
              className={`text-base font-bold mt-1 ${
                summary.highAbsenceDaysCount > 0 ? 'text-coral' : 'text-teal'
              }`}
            >
              {summary.highAbsenceDaysCount}{' '}
              <span className="text-[11px] font-normal text-slate">
                {isEn ? 'days' : 'أيام'}
              </span>
            </strong>
          </div>

          <div className="p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate truncate">
              {isEn ? 'Zero-Absence Days' : 'أيام التزام كامل (100%)'}
            </span>
            <strong className="text-base font-bold text-teal mt-1">
              {summary.zeroAbsenceDaysCount}{' '}
              <span className="text-[11px] font-normal text-slate">
                {isEn ? 'days' : 'أيام'}
              </span>
            </strong>
          </div>

          <div className="p-3 flex flex-col justify-between">
            <span className="text-[11px] text-slate truncate">
              {isEn ? 'Peak Seasonal Dip' : 'ذروة التراجع الموسمي'}
            </span>
            <strong className="text-base font-bold text-navy mt-1 truncate">
              {summary.worstSeasonalMonth ? (
                <>
                  {summary.worstSeasonalMonth.shortLabel}{' '}
                  <span className="text-xs font-semibold text-coral">
                    ({summary.worstSeasonalMonth.absenceRate}%)
                  </span>
                </>
              ) : (
                <span className="text-teal text-sm">
                  {isEn ? 'None (0%)' : 'لا يوجد (0%)'}
                </span>
              )}
            </strong>
          </div>
        </div>
      )}

      {/* 3. Recharts 53-Week × 7-Day Calendar Year Heatmap */}
      <div className="space-y-2.5">
        <div
          ref={scrollContainerRef}
          className="w-full overflow-x-auto pb-1 android-scrollbar rounded-2xl bg-page border border-line p-2.5 sm:p-3"
        >
          <div className="min-w-[680px] w-full h-[132px] select-none">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{
                  top: 4,
                  right: isRTL ? 4 : 8,
                  bottom: 4,
                  left: isRTL ? 8 : 4,
                }}
              >
                <XAxis
                  type="number"
                  dataKey="weekIndex"
                  domain={[-0.5, maxWeekIndex + 0.5]}
                  ticks={monthTickIndices}
                  tickFormatter={(val) => monthTickMap.get(Number(val)) || ''}
                  orientation="top"
                  reversed={isRTL}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                  height={22}
                  tick={{ fill: 'var(--color-slate)', fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="weekdayRow"
                  domain={[-0.5, 6.5]}
                  ticks={[0, 1, 2, 3, 4, 5, 6]}
                  tickFormatter={(val) => weekdayTickMap.get(Number(val)) || ''}
                  reversed={true}
                  orientation={isRTL ? 'right' : 'left'}
                  interval={0}
                  axisLine={false}
                  tickLine={false}
                  width={isRTL ? 42 : 32}
                  tick={{ fill: 'var(--color-slate)', fontSize: 10 }}
                />
                <ZAxis type="number" range={[100, 100]} />
                <Tooltip
                  content={<HeatmapDayTooltip isRTL={isRTL} isEn={isEn} />}
                  cursor={false}
                  isAnimationActive={false}
                />
                <Scatter
                  data={cells}
                  isAnimationActive={false}
                  shape={renderHeatmapCell}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Empty State Guidance Banner when selected year has 0 recorded sessions */}
        {summary.activeSessionDays === 0 && (
          <div className="p-3.5 rounded-2xl bg-mist border border-line flex items-center justify-between gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <AppIcon name="calendarDays" size={18} className="text-slate shrink-0" />
              <span className="text-slate">
                {isEn
                  ? `No attendance recorded in ${
                      windowMode === 'calendar_year' ? targetYear : 'the trailing 12 months'
                    } yet. Mark session attendance or switch years to inspect historical patterns.`
                  : `لا توجد سجلات حضور مرصودة في ${
                      windowMode === 'calendar_year' ? `سنة ${targetYear}` : 'آخر 12 شهراً'
                    } بعد. رصد الحضور في الحصص سيُظهر أنماط الالتزام وأيام الغياب المرتفع تلقائياً.`}
              </span>
            </div>
            {windowMode === 'calendar_year' && (
              <button
                type="button"
                onClick={() => setWindowMode('rolling_365')}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-page hover:bg-mint-soft border border-line text-navy font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isEn ? 'Try Rolling 12M' : 'عرض آخر 12 شهراً'}
              </button>
            )}
          </div>
        )}

        {/* Color & Accessibility Scale Legend */}
        <div className="flex items-center justify-between gap-3 pt-1 text-[11px] text-slate flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-mist border border-line inline-block" />
              <span>{isEn ? 'No lesson' : 'بدون حصة'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-teal inline-block" />
              <span>{isEn ? '0% Absence' : '0% غياب'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-mint border border-teal/50 inline-block" />
              <span>{isEn ? '1–15% Low' : '1–15% منخفض'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-orange inline-block" />
              <span>{isEn ? '16–29% Dip' : '16–29% تراجع'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-navy">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-coral inline-flex items-center justify-center">
                <span className="w-1 h-1 rounded-full bg-page inline-block" />
              </span>
              <span>{isEn ? '≥30% High Absence' : '≥30% غياب مرتفع'}</span>
            </span>
          </div>

          <span className="text-[11px] text-slate">
            {isEn ? 'Tap any square to inspect day' : 'اضغط على أي مربع لتفاصيل اليوم'}
          </span>
        </div>

        {/* Interactive Selected Day Inspector Bar */}
        {selectedCell && (
          <div
            data-testid="heatmap-selected-day-inspector"
            className="p-3.5 rounded-2xl bg-mist border border-line flex items-center justify-between gap-3 flex-wrap text-xs"
          >
            <div className="space-y-0.5 min-w-0">
              <div className="font-bold text-navy">
                {selectedCell.weekdayFullLabel} · {selectedCell.displayDate}
              </div>
              {selectedCell.totalExpected === 0 ? (
                <p className="text-[11px] text-slate">
                  {isEn
                    ? 'No attendance records logged on this date.'
                    : 'لا توجد سجلات حضور مسجلة في هذا التاريخ.'}
                </p>
              ) : (
                <p className="text-[11px] text-slate">
                  {isEn
                    ? `${selectedCell.sessionsCount} session(s) · Present/Late: ${selectedCell.attended} · Absent: ${selectedCell.absentTotal} (${selectedCell.absentCharged} charged, ${selectedCell.absentExcused} excused)`
                    : `${selectedCell.sessionsCount} حصة · حضور/تأخير: ${selectedCell.attended} · غياب: ${selectedCell.absentTotal} (${selectedCell.absentCharged} محسوب، ${selectedCell.absentExcused} معفى)`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2.5 ms-auto shrink-0">
              {selectedCell.absenceRate !== null && (
                <div className="text-end">
                  <strong
                    className={`text-sm font-bold block ${
                      selectedCell.isHighAbsence
                        ? 'text-coral'
                        : selectedCell.absenceRate > 15
                        ? 'text-orange'
                        : 'text-teal'
                    }`}
                  >
                    {isEn
                      ? `${selectedCell.absenceRate}% Absence`
                      : `${selectedCell.absenceRate}% غياب`}
                  </strong>
                  <span className="text-[10px] text-slate block">
                    {isEn
                      ? `${selectedCell.attendanceRate}% Attendance`
                      : `${selectedCell.attendanceRate}% حضور`}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSelectedDateKey(null)}
                aria-label={isEn ? 'Close day details' : 'إغلاق تفاصيل اليوم'}
                className="w-8 h-8 rounded-xl bg-page hover:bg-mint-soft border border-line flex items-center justify-center text-slate hover:text-navy transition-colors cursor-pointer shrink-0"
              >
                <AppIcon name="close" size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Expanded Analytics: Monthly Seasonal Dip Chart, Weekday Consistency & High-Absence Days Log */}
      {!compact && summary.activeSessionDays > 0 && (
        <div className="pt-3 border-t border-line space-y-4">
          {/* 4A. 12-Month Seasonal Absence Rate BarChart */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h4 className="text-xs font-bold text-navy">
                  {isEn
                    ? 'Seasonal Absence Rate by Month'
                    : 'معدل الغياب الموسمي حسب الأشهر'}
                </h4>
                <p className="text-[11px] text-slate">
                  {isEn
                    ? 'Identifies exam periods, holidays, or seasonal dips exceeding the 30% alert line'
                    : 'يكشف مواسم الامتحانات أو الإجازات والأشهر التي يرتفع فيها الغياب فوق خط 30%'}
                </p>
              </div>
            </div>

            <div className="w-full h-44 pt-1 select-none">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlySeasonality}
                  margin={{ top: 8, right: 8, left: isRTL ? 8 : -20, bottom: 2 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-line)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="shortLabel"
                    stroke="var(--color-slate)"
                    fontSize={10}
                    tick={{ fill: 'var(--color-slate)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-line)' }}
                    reversed={isRTL}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 15, 30, 50, 75, 100]}
                    stroke="var(--color-slate)"
                    fontSize={10}
                    tick={{ fill: 'var(--color-slate)', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-line)' }}
                    tickFormatter={(v) => `${v}%`}
                    orientation={isRTL ? 'right' : 'left'}
                  />
                  <Tooltip
                    content={<SeasonalMonthTooltip isRTL={isRTL} isEn={isEn} />}
                  />
                  <ReferenceLine
                    y={HIGH_ABSENCE_THRESHOLD_PERCENT}
                    stroke="var(--color-coral)"
                    strokeDasharray="4 4"
                    strokeWidth={1.25}
                  />
                  <Bar
                    dataKey="absenceRate"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                  >
                    {monthlySeasonality.map((entry) => {
                      const fill = !entry.hasData
                        ? 'var(--color-mist)'
                        : entry.absenceRate >= HIGH_ABSENCE_THRESHOLD_PERCENT
                        ? 'var(--color-coral)'
                        : entry.absenceRate > 15
                        ? 'var(--color-orange)'
                        : 'var(--color-teal)';
                      return <Cell key={entry.key} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 4B. Weekday Consistency Strip (Sat – Fri) */}
          <div className="space-y-2 pt-2 border-t border-line">
            <h4 className="text-xs font-bold text-navy">
              {isEn ? 'Absence Pattern by Day of Week' : 'نمط الغياب حسب أيام الأسبوع'}
            </h4>
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {weekdayPatterns.map((wd) => {
                const hasWdData = wd.absenceRate !== null;
                const toneClass = !hasWdData
                  ? 'text-fog'
                  : wd.absenceRate! >= HIGH_ABSENCE_THRESHOLD_PERCENT
                  ? 'text-coral'
                  : wd.absenceRate! > 15
                  ? 'text-orange'
                  : 'text-teal';

                return (
                  <div
                    key={wd.weekdayRow}
                    className="p-2 rounded-xl bg-mist border border-line flex flex-col items-center justify-between min-h-[60px]"
                  >
                    <span className="text-[10px] text-slate font-medium truncate max-w-full">
                      {wd.shortLabel}
                    </span>
                    <strong className={`text-xs font-bold mt-1 ${toneClass}`}>
                      {hasWdData ? `${wd.absenceRate}%` : '—'}
                    </strong>
                    <span className="text-[9px] text-slate mt-0.5">
                      {hasWdData
                        ? isEn
                          ? `${wd.activeDaysCount}d`
                          : `${wd.activeDaysCount}ي`
                        : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4C. High-Absence Alert Days Log (clickable to focus cell on heatmap) */}
          {highAbsenceDays.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-line">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-navy">
                    {isEn
                      ? `High-Absence Alert Days (${highAbsenceDays.length})`
                      : `سجل أيام الغياب المرتفع (${highAbsenceDays.length})`}
                  </h4>
                  <p className="text-[11px] text-slate">
                    {isEn
                      ? 'Days with ≥30% student absence — select a row to highlight on the calendar'
                      : 'الأيام التي بلغت فيها نسبة الغياب 30% فأكثر — اضغط لتحديد اليوم على الخريطة'}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-line max-h-56 overflow-y-auto">
                {highAbsenceDays.slice(0, 10).map((day) => {
                  const isFocused = selectedDateKey === day.dateKey;
                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => handleSelectDay(day)}
                      className={`w-full py-2.5 px-2 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer rounded-lg ${
                        isFocused ? 'bg-mint-soft/70' : 'hover:bg-mist'
                      }`}
                    >
                      <div className="min-w-0 text-start">
                        <span className="font-semibold text-navy block truncate">
                          {day.weekdayFullLabel} · {day.displayDate}
                        </span>
                        <span className="text-[11px] text-slate block truncate mt-0.5">
                          {isEn
                            ? `${day.absentTotal} of ${day.totalExpected} absent · ${day.sessionsCount} session(s)`
                            : `غياب ${day.absentTotal} من أصل ${day.totalExpected} · ${day.sessionsCount} حصة`}
                        </span>
                      </div>

                      <div className="text-end shrink-0">
                        <strong className="text-sm font-bold text-coral block">
                          {day.absenceRate}%
                        </strong>
                        <span className="text-[10px] text-slate block">
                          {isEn ? 'absence' : 'نسبة الغياب'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
