import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Layers,
  Clock,
  BookOpen,
  TrendingUp,
  DollarSign,
  Calendar,
  Filter,
  PieChart as PieChartIcon,
  Sparkles,
  Info,
  ChevronRight,
  CheckCircle2,
  Percent,
  Activity,
  BarChart3,
  CalendarDays,
} from 'lucide-react';
import {
  Session,
  Attendance,
  Student,
  Group,
  Enrollment,
  Payment,
  ReportPeriodFilter,
} from '../types';
import { useTranslation } from '../utils/i18n';
import { toLocalISODate, parseLocalDateStr } from '../utils/localDate';
import {
  db,
  roundMoney,
  addMoney,
  subtractMoney,
  multiplyMoney,
  formatMoney,
  formatSessionQuantityDisplay,
  getArabicMonthName,
} from '../utils/storage';

export interface BillingStreamsProgressChartProps {
  sessions: Session[];
  allAttendance: Attendance[];
  students?: Student[];
  groups?: Group[];
  enrollments?: Enrollment[];
  payments?: Payment[];
  periodFilter?: ReportPeriodFilter;
  customStartDate?: string;
  customEndDate?: string;
  compact?: boolean;
}

type ChartMetricMode = 'revenue' | 'volume' | 'shares' | 'cumulative';
type TimeframeOption = 'last_30_days' | 'last_month' | 'this_month' | 'last_60_days' | 'all_time';

interface DailyStreamDataPoint {
  date: string;
  displayDate: string;
  fullDateLabel: string;
  dayName: string;
  // Lesson-based stream
  lessonSessionsCount: number;
  lessonUnits: number; // e.g. 1.5 lessons
  lessonRevenue: number; // EGP
  // Hourly-based stream
  hourlySessionsCount: number;
  hourlyDurationHours: number; // e.g. 2.0 hours
  hourlyRevenue: number; // EGP
  // Combined totals
  totalRevenue: number;
  totalSessionsCount: number;
  // Cumulative progress
  cumulativeLessonRevenue: number;
  cumulativeHourlyRevenue: number;
  cumulativeTotalRevenue: number;
}

export const BillingStreamsProgressChart: React.FC<BillingStreamsProgressChartProps> = ({
  sessions,
  allAttendance,
  students = [],
  groups = [],
  enrollments = [],
  payments = [],
  periodFilter = 'last_month',
  customStartDate,
  customEndDate,
  compact = false,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  // Chart view mode: Revenue comparison, Workload volume (Lessons vs Hours), Proportional share, Cumulative growth
  const [metricMode, setMetricMode] = useState<ChartMetricMode>('revenue');
  // Grouping: Daily or Weekly
  const [timeGrouping, setTimeGrouping] = useState<'daily' | 'weekly'>('daily');
  // Service Type filter: All, Private Only, Group Only
  const [serviceFilter, setServiceFilter] = useState<'all' | 'private' | 'group'>('all');
  // Timeframe override (Default is last_month / last_30_days as requested)
  const [timeframe, setTimeframe] = useState<TimeframeOption>('last_month');
  // Detailed audit table collapse state
  const [showDataTable, setShowDataTable] = useState(false);

  // Helper map of groups and enrollments
  const groupsMap = useMemo(() => {
    const map = new Map<string, Group>();
    groups.forEach((g) => map.set(g.id, g));
    return map;
  }, [groups]);

  const enrollmentsMap = useMemo(() => {
    const map = new Map<string, Enrollment>();
    enrollments.forEach((e) => map.set(e.id, e));
    return map;
  }, [enrollments]);

  // Compute date range for timeframe filter
  const dateRange = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    let start = '';
    let end = '';

    if (timeframe === 'last_month') {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const startD = new Date(lastMonthYear, lastMonth - 1, 1);
      const endD = new Date(lastMonthYear, lastMonth, 0); // Last day of last month
      start = toLocalISODate(startD);
      end = toLocalISODate(endD);
    } else if (timeframe === 'this_month') {
      const startD = new Date(currentYear, currentMonth - 1, 1);
      const endD = new Date(currentYear, currentMonth, 0);
      start = toLocalISODate(startD);
      end = toLocalISODate(now);
    } else if (timeframe === 'last_30_days') {
      const endD = new Date();
      const startD = new Date();
      startD.setDate(startD.getDate() - 29);
      start = toLocalISODate(startD);
      end = toLocalISODate(endD);
    } else if (timeframe === 'last_60_days') {
      const endD = new Date();
      const startD = new Date();
      startD.setDate(startD.getDate() - 59);
      start = toLocalISODate(startD);
      end = toLocalISODate(endD);
    } else {
      // all_time or custom
      if (customStartDate && customEndDate) {
        start = customStartDate;
        end = customEndDate;
      } else {
        start = '2020-01-01';
        end = '2099-12-31';
      }
    }

    return { start, end };
  }, [timeframe, customStartDate, customEndDate]);

  // Process and categorize sessions into Lesson-Based vs Hourly-Based
  const processedStreamData = useMemo(() => {
    const attendanceMap = new Map<string, Attendance[]>();
    allAttendance.forEach((att) => {
      const list = attendanceMap.get(att.sessionId) || [];
      list.push(att);
      attendanceMap.set(att.sessionId, list);
    });

    // 1. Filter sessions by date range and service filter
    const filteredSessions = sessions.filter((sess) => {
      if (sess.date < dateRange.start || sess.date > dateRange.end) return false;
      if (sess.status === 'cancelled') return false;

      const isPrivate = !!sess.studentId || (sess.groupId && groupsMap.get(sess.groupId)?.type === 'private');
      if (serviceFilter === 'private' && !isPrivate) return false;
      if (serviceFilter === 'group' && isPrivate) return false;

      return true;
    });

    // 2. Aggregate by calendar date
    const dailyMap = new Map<
      string,
      {
        lessonSessionsCount: number;
        lessonUnits: number;
        lessonRevenue: number;
        hourlySessionsCount: number;
        hourlyDurationHours: number;
        hourlyRevenue: number;
      }
    >();

    filteredSessions.forEach((sess) => {
      const dateKey = sess.date;
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          lessonSessionsCount: 0,
          lessonUnits: 0,
          lessonRevenue: 0,
          hourlySessionsCount: 0,
          hourlyDurationHours: 0,
          hourlyRevenue: 0,
        });
      }
      const entry = dailyMap.get(dateKey)!;
      const group = sess.groupId ? groupsMap.get(sess.groupId) : undefined;
      const sessAttendances = attendanceMap.get(sess.id) || [];

      // Determine if this session is Hourly-based
      const isHourly =
        sess.isHourly === true ||
        group?.billingType === 'hourly' ||
        group?.billingMode === 'hourly';

      if (isHourly) {
        // HOURLY STREAM
        const rawHours =
          sess.hours !== undefined && sess.hours !== null && Number(sess.hours) > 0
            ? Number(sess.hours)
            : sessAttendances[0]?.hours !== undefined && sessAttendances[0]?.hours !== null && Number(sessAttendances[0]?.hours) > 0
            ? Number(sessAttendances[0]?.hours)
            : 1;

        const duration = roundMoney(rawHours, 2);
        const hourlyRate =
          sess.hourlyRate ||
          group?.hourlyRate ||
          group?.defaultPrice ||
          (sess.price && sess.price > 0 ? sess.price : 100);

        const rev = multiplyMoney(duration, hourlyRate);

        entry.hourlySessionsCount += 1;
        entry.hourlyDurationHours = roundMoney(entry.hourlyDurationHours + duration, 2);
        entry.hourlyRevenue = addMoney(entry.hourlyRevenue, rev);
      } else {
        // LESSON-BASED STREAM
        // Can have fractional units like 1.5 lessons
        let sessionUnits = 1;
        if (sess.sessionUnits !== undefined && sess.sessionUnits !== null && Number(sess.sessionUnits) > 0) {
          sessionUnits = Number(sess.sessionUnits);
        } else if (sessAttendances.length > 0 && sessAttendances[0].sessionUnits !== undefined && sessAttendances[0].sessionUnits !== null) {
          sessionUnits = Number(sessAttendances[0].sessionUnits);
        }

        sessionUnits = roundMoney(sessionUnits, 2);

        // Price per student or session rate
        let sessionRevenue = 0;
        if (sessAttendances.length > 0) {
          sessAttendances.forEach((att) => {
            if (att.status === 'present' || att.status === 'late' || (att.status === 'absent_charged' || att.isCharged)) {
              const u = att.sessionUnits !== undefined && att.sessionUnits !== null ? Number(att.sessionUnits) : sessionUnits;
              const rate = att.sessionPriceSnapshot || sess.price || group?.defaultPrice || 50;
              sessionRevenue = addMoney(sessionRevenue, multiplyMoney(u, rate));
            }
          });
        } else {
          // If no attendances yet, estimate from session rate
          const rate = sess.price || group?.defaultPrice || 50;
          sessionRevenue = multiplyMoney(sessionUnits, rate);
        }

        entry.lessonSessionsCount += 1;
        entry.lessonUnits = roundMoney(entry.lessonUnits + sessionUnits, 2);
        entry.lessonRevenue = addMoney(entry.lessonRevenue, sessionRevenue);
      }
    });

    // 3. Build sorted list across all dates in range
    // Generate dates so chart has smooth progression even on days with 0 sessions
    const sortedDates: string[] = [];
    if (timeframe !== 'all_time') {
      const cur = parseLocalDateStr(dateRange.start);
      const end = parseLocalDateStr(dateRange.end);
      while (cur <= end) {
        sortedDates.push(toLocalISODate(cur));
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      sortedDates.push(...Array.from(dailyMap.keys()).sort());
    }

    let runningLessonRev = 0;
    let runningHourlyRev = 0;
    let runningTotalRev = 0;

    const resultPoints: DailyStreamDataPoint[] = [];

    sortedDates.forEach((dateStr) => {
      const dayData = dailyMap.get(dateStr) || {
        lessonSessionsCount: 0,
        lessonUnits: 0,
        lessonRevenue: 0,
        hourlySessionsCount: 0,
        hourlyDurationHours: 0,
        hourlyRevenue: 0,
      };

      const d = parseLocalDateStr(dateStr);
      const dayIndex = d.getDay();
      const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const englishDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = isEn ? englishDays[dayIndex] : arabicDays[dayIndex];

      const monthName = isEn
        ? d.toLocaleString('en-US', { month: 'short' })
        : getArabicMonthName(d.getMonth() + 1);
      const displayDate = `${d.getDate()} ${monthName}`;
      const fullDateLabel = `${dayName}، ${displayDate}`;

      const totalRev = addMoney(dayData.lessonRevenue, dayData.hourlyRevenue);
      const totalCount = dayData.lessonSessionsCount + dayData.hourlySessionsCount;

      runningLessonRev = addMoney(runningLessonRev, dayData.lessonRevenue);
      runningHourlyRev = addMoney(runningHourlyRev, dayData.hourlyRevenue);
      runningTotalRev = addMoney(runningTotalRev, totalRev);

      resultPoints.push({
        date: dateStr,
        displayDate,
        fullDateLabel,
        dayName,
        lessonSessionsCount: dayData.lessonSessionsCount,
        lessonUnits: dayData.lessonUnits,
        lessonRevenue: dayData.lessonRevenue,
        hourlySessionsCount: dayData.hourlySessionsCount,
        hourlyDurationHours: dayData.hourlyDurationHours,
        hourlyRevenue: dayData.hourlyRevenue,
        totalRevenue: totalRev,
        totalSessionsCount: totalCount,
        cumulativeLessonRevenue: runningLessonRev,
        cumulativeHourlyRevenue: runningHourlyRev,
        cumulativeTotalRevenue: runningTotalRev,
      });
    });

    // 4. Handle Weekly Grouping if selected
    if (timeGrouping === 'weekly') {
      const weeklyBuckets: DailyStreamDataPoint[] = [];
      const chunkSize = 7;
      for (let i = 0; i < resultPoints.length; i += chunkSize) {
        const chunk = resultPoints.slice(i, i + chunkSize);
        if (chunk.length === 0) continue;

        const first = chunk[0];
        const last = chunk[chunk.length - 1];
        const label = `${first.displayDate} - ${last.displayDate}`;

        const wLessonCount = chunk.reduce((sum, c) => sum + c.lessonSessionsCount, 0);
        const wLessonUnits = roundMoney(chunk.reduce((sum, c) => sum + c.lessonUnits, 0), 2);
        const wLessonRev = chunk.reduce((sum, c) => addMoney(sum, c.lessonRevenue), 0);

        const wHourlyCount = chunk.reduce((sum, c) => sum + c.hourlySessionsCount, 0);
        const wHourlyDuration = roundMoney(chunk.reduce((sum, c) => sum + c.hourlyDurationHours, 0), 2);
        const wHourlyRev = chunk.reduce((sum, c) => addMoney(sum, c.hourlyRevenue), 0);

        const wTotalRev = addMoney(wLessonRev, wHourlyRev);
        const wTotalSessions = wLessonCount + wHourlyCount;

        weeklyBuckets.push({
          date: first.date,
          displayDate: label,
          fullDateLabel: `${isEn ? 'Week of' : 'أسبوع'} ${first.displayDate}`,
          dayName: isEn ? `Wk ${Math.floor(i / chunkSize) + 1}` : `أسبوع ${Math.floor(i / chunkSize) + 1}`,
          lessonSessionsCount: wLessonCount,
          lessonUnits: wLessonUnits,
          lessonRevenue: wLessonRev,
          hourlySessionsCount: wHourlyCount,
          hourlyDurationHours: wHourlyDuration,
          hourlyRevenue: wHourlyRev,
          totalRevenue: wTotalRev,
          totalSessionsCount: wTotalSessions,
          cumulativeLessonRevenue: last.cumulativeLessonRevenue,
          cumulativeHourlyRevenue: last.cumulativeHourlyRevenue,
          cumulativeTotalRevenue: last.cumulativeTotalRevenue,
        });
      }
      return weeklyBuckets;
    }

    return resultPoints;
  }, [
    sessions,
    allAttendance,
    groupsMap,
    dateRange,
    serviceFilter,
    timeframe,
    timeGrouping,
    isEn,
  ]);

  // Overall Stream Financial & Volume Totals
  const streamTotals = useMemo(() => {
    let totalLessonRevenue = 0;
    let totalLessonUnits = 0;
    let totalLessonSessions = 0;

    let totalHourlyRevenue = 0;
    let totalHourlyHours = 0;
    let totalHourlySessions = 0;

    processedStreamData.forEach((p) => {
      totalLessonRevenue = addMoney(totalLessonRevenue, p.lessonRevenue);
      totalLessonUnits = roundMoney(totalLessonUnits + p.lessonUnits, 2);
      totalLessonSessions += p.lessonSessionsCount;

      totalHourlyRevenue = addMoney(totalHourlyRevenue, p.hourlyRevenue);
      totalHourlyHours = roundMoney(totalHourlyHours + p.hourlyDurationHours, 2);
      totalHourlySessions += p.hourlySessionsCount;
    });

    const grandTotalRevenue = addMoney(totalLessonRevenue, totalHourlyRevenue);
    const lessonSharePercent =
      grandTotalRevenue > 0 ? Math.round((totalLessonRevenue / grandTotalRevenue) * 100) : 0;
    const hourlySharePercent =
      grandTotalRevenue > 0 ? Math.round((totalHourlyRevenue / grandTotalRevenue) * 100) : 0;

    const avgRevenuePerLesson =
      totalLessonUnits > 0 ? roundMoney(totalLessonRevenue / totalLessonUnits, 1) : 0;
    const avgRevenuePerHour =
      totalHourlyHours > 0 ? roundMoney(totalHourlyRevenue / totalHourlyHours, 1) : 0;

    return {
      totalLessonRevenue,
      totalLessonUnits,
      totalLessonSessions,
      avgRevenuePerLesson,
      totalHourlyRevenue,
      totalHourlyHours,
      totalHourlySessions,
      avgRevenuePerHour,
      grandTotalRevenue,
      lessonSharePercent,
      hourlySharePercent,
    };
  }, [processedStreamData]);

  // Custom bilingual Tooltip
  const CustomStreamTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data: DailyStreamDataPoint = payload[0]?.payload;
    if (!data) return null;

    return (
      <div className="bg-[#F6EFE8] text-[#0F1206] p-3.5 rounded-[14px] shadow-xl border border-[#DDD3C7] min-w-[240px] text-xs space-y-2.5 z-50">
        <div className="flex items-center justify-between border-b border-[#DDD3C7] pb-2">
          <div className="flex items-center gap-1.5 font-black text-sm text-[#0F1206]">
            <Calendar className="w-3.5 h-3.5 text-[#756046]" />
            <span>{data.fullDateLabel}</span>
          </div>
          <span className="text-[10px] bg-[#EDE3D9] px-2 py-0.5 rounded-full font-bold text-[#756046]">
            {data.totalSessionsCount} {isEn ? 'Sessions' : 'حصص'}
          </span>
        </div>

        {/* Lesson-Based Stream Section */}
        <div className="p-2 rounded-xl bg-[#F8F2EC] border border-[#DDD3C7] space-y-1">
          <div className="flex items-center justify-between font-bold text-[#0F1206]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#293828] inline-block" />
              {isEn ? 'Lesson-Based Stream' : 'نظام الحصص (Lessons)'}
            </span>
            <span className="font-black text-[#293828]">
              {formatMoney(data.lessonRevenue)} {t('currency')}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#756046]">
            <span>{isEn ? 'Delivered Lessons:' : 'كمية الحصص:'}</span>
            <span className="font-black text-[#0F1206]">
              {formatSessionQuantityDisplay({ sessionUnits: data.lessonUnits, isHourly: false }, isRTL)}
            </span>
          </div>
        </div>

        {/* Hourly-Based Stream Section */}
        <div className="p-2 rounded-xl bg-[#F8F2EC] border border-[#DDD3C7] space-y-1">
          <div className="flex items-center justify-between font-bold text-[#0F1206]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#764F26] inline-block" />
              {isEn ? 'Hourly-Based Stream' : 'نظام الساعات (Hours)'}
            </span>
            <span className="font-black text-[#764F26]">
              {formatMoney(data.hourlyRevenue)} {t('currency')}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#756046]">
            <span>{isEn ? 'Logged Duration:' : 'ساعات العمل:'}</span>
            <span className="font-black text-[#0F1206]">
              {formatSessionQuantityDisplay({ hours: data.hourlyDurationHours, isHourly: true }, isRTL)}
            </span>
          </div>
        </div>

        {/* Day Total */}
        <div className="flex items-center justify-between pt-1 border-t border-[#DDD3C7] font-black text-xs text-[#0F1206]">
          <span>{isEn ? 'Total Day Revenue:' : 'إجمالي دخل اليوم:'}</span>
          <span className="text-[#293828]">
            {formatMoney(data.totalRevenue)} {t('currency')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="classy-card p-4 bg-[#F8F2EC] space-y-4 shadow-xs border border-[#DDD3C7] overflow-hidden">
      {/* 1. Header & Quick Controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#293828] to-[#0F1206] text-[#F8F2EC] flex items-center justify-center shadow-md shadow-[#293828]/20 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-xs sm:text-sm text-[#0F1206] truncate">
              {isEn ? 'Billing Streams: Lesson-Based vs Hourly' : 'مقارنة التدفق المالي: الحصص مقابل الساعات'}
            </h3>
            <p className="text-[11px] text-[#756046] font-medium truncate">
              {isEn
                ? 'Monitors revenue and workload delivery accurately.'
                : 'متابعة مسارات الدخل مع التمييز بين كمية الحصص وساعات العمل.'}
            </p>
          </div>
        </div>

        {/* Timeframe selector (2-Column Grid) */}
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { key: 'last_month', label: isEn ? 'Last Month' : 'الشهر الماضي' },
            { key: 'last_30_days', label: isEn ? 'Last 30 Days' : 'آخر 30 يوم' },
            { key: 'this_month', label: isEn ? 'This Month' : 'هذا الشهر' },
            { key: 'last_60_days', label: isEn ? 'Last 60 Days' : 'آخر 60 يوم' },
            { key: 'all_time', label: isEn ? 'All Time (Comprehensive)' : 'الكل (شامل)' },
          ].map((tf, idx, arr) => (
            <button
              key={tf.key}
              type="button"
              onClick={() => setTimeframe(tf.key as TimeframeOption)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer text-center truncate ${
                idx === arr.length - 1 ? 'col-span-2' : ''
              } ${
                timeframe === tf.key
                  ? 'bg-[#293828] text-[#F8F2EC] shadow-xs'
                  : 'bg-[#DDD3C7]/15 text-[#756046] border border-[#DDD3C7] hover:bg-[#DDD3C7]/30'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Stream KPI Summary (2x2 Square Bento Grid like Dashboard) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Card 1: Lesson-Based Stream Revenue */}
        <div className="p-3.5 rounded-[22px] bg-gradient-to-br from-[#293828]/8 via-[#F8F2EC] to-[#F8F2EC] border border-[#DDD3C7] shadow-2xs flex flex-col justify-between min-h-[108px] relative overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-[#293828] flex items-center gap-1 truncate">
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{isEn ? 'Lessons Stream' : 'مسار الحصص'}</span>
            </span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#293828] text-[#F8F2EC] shrink-0">
              {streamTotals.lessonSharePercent}%
            </span>
          </div>
          <div className="min-w-0 mt-1">
            <strong className="text-lg sm:text-xl font-black text-[#0F1206] block truncate">
              {formatMoney(streamTotals.totalLessonRevenue)} <span className="text-[10px] font-bold text-[#756046]">{t('currency')}</span>
            </strong>
            <span className="text-[10px] text-[#756046] font-bold block truncate mt-0.5">
              {streamTotals.totalLessonUnits} {isEn ? 'Lessons' : 'حصة'} ({streamTotals.totalLessonSessions} {isEn ? 'Appts' : 'موعد'})
            </span>
          </div>
        </div>

        {/* Card 2: Hourly-Based Stream Revenue */}
        <div className="p-3.5 rounded-[22px] bg-gradient-to-br from-[#DDD3C7]/25 via-[#F8F2EC] to-[#F8F2EC] border border-[#DDD3C7] shadow-2xs flex flex-col justify-between min-h-[108px] relative overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-[#0F1206] flex items-center gap-1 truncate">
              <Clock className="w-3.5 h-3.5 text-[#756046] shrink-0" />
              <span className="truncate">{isEn ? 'Hourly Stream' : 'مسار الساعات'}</span>
            </span>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#756046] text-[#F8F2EC] shrink-0">
              {streamTotals.hourlySharePercent}%
            </span>
          </div>
          <div className="min-w-0 mt-1">
            <strong className="text-lg sm:text-xl font-black text-[#0F1206] block truncate">
              {formatMoney(streamTotals.totalHourlyRevenue)} <span className="text-[10px] font-bold text-[#756046]">{t('currency')}</span>
            </strong>
            <span className="text-[10px] text-[#756046] font-bold block truncate mt-0.5">
              {streamTotals.totalHourlyHours} {isEn ? 'Hours' : 'ساعة'} ({streamTotals.totalHourlySessions} {isEn ? 'Appts' : 'موعد'})
            </span>
          </div>
        </div>

        {/* Card 3: Average Unit / Hour Rate */}
        <div className="p-3.5 rounded-[22px] bg-[#DDD3C7]/15 border border-[#DDD3C7] shadow-2xs flex flex-col justify-between min-h-[108px] relative overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-[#756046] truncate">
              {isEn ? 'Average Rate' : 'متوسط العائد'}
            </span>
            <Activity className="w-3.5 h-3.5 text-[#293828] shrink-0" />
          </div>
          <div className="space-y-1 mt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#756046] text-[10px] font-bold">{isEn ? 'Per Lesson:' : 'للحصة:'}</span>
              <strong className="font-black text-[#293828]">{streamTotals.avgRevenuePerLesson} {t('currency')}</strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#756046] text-[10px] font-bold">{isEn ? 'Per Hour:' : 'للساعة:'}</span>
              <strong className="font-black text-[#0F1206]">{streamTotals.avgRevenuePerHour} {t('currency')}</strong>
            </div>
          </div>
        </div>

        {/* Card 4: Combined Grand Progress KPI */}
        <div className="p-3.5 rounded-[22px] bg-gradient-to-br from-[#293828] to-[#0F1206] text-[#F8F2EC] shadow-2xs flex flex-col justify-between min-h-[108px] relative overflow-hidden">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-[#DDD3C7] flex items-center gap-1 truncate">
              <TrendingUp className="w-3.5 h-3.5 text-[#F8F2EC] shrink-0" />
              <span className="truncate">{isEn ? 'Total Revenue' : 'إجمالي التدفقات'}</span>
            </span>
          </div>
          <div className="min-w-0 mt-1">
            <strong className="text-lg sm:text-xl font-black text-[#F8F2EC] block truncate">
              {formatMoney(streamTotals.grandTotalRevenue)} <span className="text-[10px] font-bold text-[#DDD3C7]">{t('currency')}</span>
            </strong>
            <div className="h-1.5 w-full bg-[#F8F2EC]/20 rounded-full overflow-hidden flex mt-1.5">
              <div
                style={{ width: `${streamTotals.lessonSharePercent}%` }}
                className="bg-[#F8F2EC] h-full transition-all"
              />
              <div
                style={{ width: `${streamTotals.hourlySharePercent}%` }}
                className="bg-[#DDD3C7] h-full transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Metric Mode & Filter Toolbar (2x2 Square Grid) */}
      <div className="p-2.5 rounded-2xl bg-[#DDD3C7]/15 border border-[#DDD3C7] space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setMetricMode('revenue')}
            className={`px-2.5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
              metricMode === 'revenue'
                ? 'bg-[#293828] text-[#F8F2EC] shadow-xs'
                : 'bg-[#F8F2EC] text-[#756046] border border-[#DDD3C7] hover:text-[#0F1206]'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isEn ? 'Revenue (EGP)' : 'المقارنة المالية'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMetricMode('volume')}
            className={`px-2.5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
              metricMode === 'volume'
                ? 'bg-[#293828] text-[#F8F2EC] shadow-xs'
                : 'bg-[#F8F2EC] text-[#756046] border border-[#DDD3C7] hover:text-[#0F1206]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isEn ? 'Workload Volume' : 'حجم النشاط'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMetricMode('cumulative')}
            className={`px-2.5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
              metricMode === 'cumulative'
                ? 'bg-[#293828] text-[#F8F2EC] shadow-xs'
                : 'bg-[#F8F2EC] text-[#756046] border border-[#DDD3C7] hover:text-[#0F1206]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isEn ? 'Cumulative' : 'النمو التراكمي'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMetricMode('shares')}
            className={`px-2.5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
              metricMode === 'shares'
                ? 'bg-[#293828] text-[#F8F2EC] shadow-xs'
                : 'bg-[#F8F2EC] text-[#756046] border border-[#DDD3C7] hover:text-[#0F1206]'
            }`}
          >
            <Percent className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isEn ? 'Proportions' : 'نسب التدفق'}</span>
          </button>
        </div>

        {/* Grouping & Service Toggles */}
        <div className="grid grid-cols-2 gap-1.5">
          {/* Daily vs Weekly */}
          <div className="grid grid-cols-2 bg-[#F8F2EC] p-1 rounded-xl border border-[#DDD3C7]">
            <button
              type="button"
              onClick={() => setTimeGrouping('daily')}
              className={`py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center ${
                timeGrouping === 'daily'
                  ? 'bg-[#293828] text-[#F8F2EC]'
                  : 'text-[#756046] hover:text-[#0F1206]'
              }`}
            >
              {isEn ? 'Daily' : 'يومي'}
            </button>
            <button
              type="button"
              onClick={() => setTimeGrouping('weekly')}
              className={`py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center ${
                timeGrouping === 'weekly'
                  ? 'bg-[#293828] text-[#F8F2EC]'
                  : 'text-[#756046] hover:text-[#0F1206]'
              }`}
            >
              {isEn ? 'Weekly' : 'أسبوعي'}
            </button>
          </div>

          {/* Service filter */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-[#F8F2EC] rounded-xl border border-[#DDD3C7] text-xs font-bold text-[#0F1206] focus:outline-none focus:border-[#293828] cursor-pointer w-full"
          >
            <option value="all">{isEn ? 'All Services' : 'كافة الخدمات'}</option>
            <option value="private">{isEn ? 'Private Only' : 'دروس خاصة فقط'}</option>
            <option value="group">{isEn ? 'Groups Only' : 'مجموعات فقط'}</option>
          </select>
        </div>
      </div>

      {/* 4. The Interactive Recharts Canvas */}
      <div className="h-72 sm:h-80 w-full min-w-0" dir="ltr">
        {processedStreamData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#756046] space-y-2">
            <Info className="w-8 h-8 text-[#293828]" />
            <span className="font-bold text-xs">{isEn ? 'No sessions recorded in this timeframe' : 'لا توجد حصص مرصودة في هذه الفترة'}</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {metricMode === 'revenue' ? (
              // Stacked / Clustered Bar Chart for Revenue in EGP
              <BarChart
                data={processedStreamData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DDD3C7" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#756046', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#DDD3C7' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#756046', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#DDD3C7' }}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip content={<CustomStreamTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 10, fontSize: 12, fontWeight: 700 }}
                  formatter={(value) => {
                    if (value === 'lessonRevenue') return isEn ? 'Lesson Stream (EGP)' : 'مسار الحصص (ج.م)';
                    if (value === 'hourlyRevenue') return isEn ? 'Hourly Stream (EGP)' : 'مسار الساعات (ج.م)';
                    return value;
                  }}
                />
                <Bar
                  dataKey="lessonRevenue"
                  name="lessonRevenue"
                  stackId="a"
                  fill="#293828"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  dataKey="hourlyRevenue"
                  name="hourlyRevenue"
                  stackId="a"
                  fill="#764F26"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            ) : metricMode === 'volume' ? (
              // Dual-Axis Chart: Lessons Count on Left vs Hourly Hours on Right (NEVER MIX UNITS)
              <ComposedChart
                data={processedStreamData}
                margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DDD3C7" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#756046', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#DDD3C7' }}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tick={{ fontSize: 11, fill: '#293828', fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: '#293828' }}
                  unit={isEn ? ' L' : ' ح'}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#764F26', fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: '#764F26' }}
                  unit={isEn ? ' h' : ' س'}
                />
                <Tooltip content={<CustomStreamTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 10, fontSize: 12, fontWeight: 700 }}
                  formatter={(value) => {
                    if (value === 'lessonUnits') return isEn ? 'Lesson Volume (Lessons / حصص)' : 'كمية الحصص المنفذة (حصص)';
                    if (value === 'hourlyDurationHours') return isEn ? 'Hourly Volume (Hours / ساعات)' : 'ساعات العمل المنفذة (ساعات)';
                    return value;
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="lessonUnits"
                  name="lessonUnits"
                  fill="#293828"
                  radius={[6, 6, 0, 0]}
                  barSize={16}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="hourlyDurationHours"
                  name="hourlyDurationHours"
                  stroke="#764F26"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#0F1206', strokeWidth: 2, stroke: '#F8F2EC' }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            ) : metricMode === 'cumulative' ? (
              // Multi-Area Cumulative Progress Chart
              <AreaChart
                data={processedStreamData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradLessonCum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#293828" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#293828" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradHourlyCum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#764F26" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#764F26" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DDD3C7" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#756046', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#DDD3C7' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#756046', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#DDD3C7' }}
                />
                <Tooltip content={<CustomStreamTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 10, fontSize: 12, fontWeight: 700 }}
                  formatter={(value) => {
                    if (value === 'cumulativeLessonRevenue') return isEn ? 'Cum. Lesson Revenue' : 'تراكمي دخل الحصص';
                    if (value === 'cumulativeHourlyRevenue') return isEn ? 'Cum. Hourly Revenue' : 'تراكمي دخل الساعات';
                    if (value === 'cumulativeTotalRevenue') return isEn ? 'Cum. Total Revenue' : 'تراكمي إجمالي الدخل';
                    return value;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeLessonRevenue"
                  name="cumulativeLessonRevenue"
                  stroke="#293828"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradLessonCum)"
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeHourlyRevenue"
                  name="cumulativeHourlyRevenue"
                  stroke="#764F26"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradHourlyCum)"
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeTotalRevenue"
                  name="cumulativeTotalRevenue"
                  stroke="#0F1206"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </AreaChart>
            ) : (
              // 100% Proportional Stacked Area Chart (Shares)
              <AreaChart
                data={processedStreamData.map((d) => {
                  const total = d.totalRevenue > 0 ? d.totalRevenue : 1;
                  return {
                    ...d,
                    lessonShare: Math.round((d.lessonRevenue / total) * 100),
                    hourlyShare: Math.round((d.hourlyRevenue / total) * 100),
                  };
                })}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DDD3C7" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#756046', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#DDD3C7' }}
                />
                <YAxis
                  unit="%"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#756046', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#DDD3C7' }}
                />
                <Tooltip content={<CustomStreamTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 10, fontSize: 12, fontWeight: 700 }}
                  formatter={(value) => {
                    if (value === 'lessonShare') return isEn ? 'Lesson Stream %' : 'نسبة مسار الحصص %';
                    if (value === 'hourlyShare') return isEn ? 'Hourly Stream %' : 'نسبة مسار الساعات %';
                    return value;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="lessonShare"
                  name="lessonShare"
                  stackId="1"
                  stroke="#293828"
                  fill="#293828"
                  fillOpacity={0.85}
                />
                <Area
                  type="monotone"
                  dataKey="hourlyShare"
                  name="hourlyShare"
                  stackId="1"
                  stroke="#764F26"
                  fill="#764F26"
                  fillOpacity={0.85}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* 5. Detailed Breakdown Table Toggle */}
      <div className="pt-2 border-t border-[#DDD3C7]">
        <button
          type="button"
          onClick={() => setShowDataTable(!showDataTable)}
          className="w-full py-2 px-3 rounded-xl bg-[#DDD3C7]/15 hover:bg-[#DDD3C7]/30 text-[#0F1206] text-xs font-black flex items-center justify-between transition-all cursor-pointer border border-[#DDD3C7]"
        >
          <span className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#293828]" />
            <span>{isEn ? 'View Detailed Breakdown Table' : 'عرض جدول التدقيق والتفصيل اليومي'}</span>
          </span>
          <span className="text-[11px] text-[#756046]">
            {showDataTable ? (isEn ? 'Hide Table ▲' : 'إخفاء الجدول ▲') : (isEn ? 'Show Table ▼' : 'إظهار الجدول ▼')}
          </span>
        </button>

        {showDataTable && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-[#DDD3C7]">
            <table className="w-full text-xs text-start">
              <thead className="bg-[#0F1206] text-[#F8F2EC] font-bold">
                <tr>
                  <th className="p-2.5 text-start">{isEn ? 'Date / Period' : 'التاريخ / الفترة'}</th>
                  <th className="p-2.5 text-center text-[#F8F2EC] bg-[#293828]/60">{isEn ? 'Lessons Qty' : 'كمية الحصص'}</th>
                  <th className="p-2.5 text-center text-[#F8F2EC] bg-[#293828]/60">{isEn ? 'Lesson Rev (EGP)' : 'دخل الحصص'}</th>
                  <th className="p-2.5 text-center text-[#DDD3C7] bg-[#756046]/35">{isEn ? 'Hourly Hours' : 'ساعات العمل'}</th>
                  <th className="p-2.5 text-center text-[#DDD3C7] bg-[#756046]/35">{isEn ? 'Hourly Rev (EGP)' : 'دخل الساعات'}</th>
                  <th className="p-2.5 text-center text-[#F8F2EC]">{isEn ? 'Total Rev (EGP)' : 'إجمالي الدخل'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD3C7]/60">
                {processedStreamData
                  .filter((p) => p.totalSessionsCount > 0 || p.totalRevenue > 0)
                  .map((row) => (
                    <tr key={row.date} className="hover:bg-[#DDD3C7]/15 transition-colors">
                      <td className="p-2.5 font-bold text-[#0F1206]">{row.fullDateLabel}</td>
                      <td className="p-2.5 text-center font-black text-[#293828]">
                        {formatSessionQuantityDisplay({ sessionUnits: row.lessonUnits, isHourly: false }, isRTL)}
                      </td>
                      <td className="p-2.5 text-center font-bold text-[#0F1206]">
                        {formatMoney(row.lessonRevenue)}
                      </td>
                      <td className="p-2.5 text-center font-black text-[#756046]">
                        {formatSessionQuantityDisplay({ hours: row.hourlyDurationHours, isHourly: true }, isRTL)}
                      </td>
                      <td className="p-2.5 text-center font-bold text-[#0F1206]">
                        {formatMoney(row.hourlyRevenue)}
                      </td>
                      <td className="p-2.5 text-center font-black text-[#293828]">
                        {formatMoney(row.totalRevenue)} {t('currency')}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
