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
      start = startD.toISOString().split('T')[0];
      end = endD.toISOString().split('T')[0];
    } else if (timeframe === 'this_month') {
      const startD = new Date(currentYear, currentMonth - 1, 1);
      const endD = new Date(currentYear, currentMonth, 0);
      start = startD.toISOString().split('T')[0];
      end = now.toISOString().split('T')[0];
    } else if (timeframe === 'last_30_days') {
      const endD = new Date();
      const startD = new Date();
      startD.setDate(startD.getDate() - 29);
      start = startD.toISOString().split('T')[0];
      end = endD.toISOString().split('T')[0];
    } else if (timeframe === 'last_60_days') {
      const endD = new Date();
      const startD = new Date();
      startD.setDate(startD.getDate() - 59);
      start = startD.toISOString().split('T')[0];
      end = endD.toISOString().split('T')[0];
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
      const cur = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      while (cur <= end) {
        sortedDates.push(cur.toISOString().split('T')[0]);
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

      const d = new Date(dateStr);
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
      <div className="bg-[#17163D] text-white p-3.5 rounded-2xl shadow-xl border border-[#302D70] min-w-[240px] text-xs space-y-2.5 z-50">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-1.5 font-black text-sm">
            <Calendar className="w-3.5 h-3.5 text-[#55C7E8]" />
            <span>{data.fullDateLabel}</span>
          </div>
          <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-bold">
            {data.totalSessionsCount} {isEn ? 'Sessions' : 'حصص'}
          </span>
        </div>

        {/* Lesson-Based Stream Section */}
        <div className="p-2 rounded-xl bg-[#7657F6]/20 border border-[#7657F6]/40 space-y-1">
          <div className="flex items-center justify-between font-bold text-[#E8E7FF]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#7657F6] inline-block" />
              {isEn ? 'Lesson-Based Stream' : 'نظام الحصص (Lessons)'}
            </span>
            <span className="font-black text-white">
              {formatMoney(data.lessonRevenue)} {t('currency')}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/80">
            <span>{isEn ? 'Delivered Lessons:' : 'كمية الحصص:'}</span>
            <span className="font-black text-[#55C7E8]">
              {formatSessionQuantityDisplay({ sessionUnits: data.lessonUnits, isHourly: false }, isRTL)}
            </span>
          </div>
        </div>

        {/* Hourly-Based Stream Section */}
        <div className="p-2 rounded-xl bg-[#55C7E8]/20 border border-[#55C7E8]/40 space-y-1">
          <div className="flex items-center justify-between font-bold text-[#E0F7FE]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#55C7E8] inline-block" />
              {isEn ? 'Hourly-Based Stream' : 'نظام الساعات (Hours)'}
            </span>
            <span className="font-black text-white">
              {formatMoney(data.hourlyRevenue)} {t('currency')}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/80">
            <span>{isEn ? 'Logged Duration:' : 'ساعات العمل:'}</span>
            <span className="font-black text-[#55C7E8]">
              {formatSessionQuantityDisplay({ hours: data.hourlyDurationHours, isHourly: true }, isRTL)}
            </span>
          </div>
        </div>

        {/* Day Total */}
        <div className="flex items-center justify-between pt-1 border-t border-white/10 font-black text-xs text-emerald-400">
          <span>{isEn ? 'Total Day Revenue:' : 'إجمالي دخل اليوم:'}</span>
          <span>
            {formatMoney(data.totalRevenue)} {t('currency')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="classy-card p-4 sm:p-5 bg-white space-y-4 shadow-xs border border-[#E8E7FF]">
      {/* 1. Header & Quick Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#7657F6] to-[#55C7E8] text-white flex items-center justify-center shadow-md shadow-[#7657F6]/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm sm:text-base text-[#17163D] flex items-center gap-2">
              <span>{isEn ? 'Billing Streams: Lesson-Based vs Hourly Progress' : 'مقارنة التدفق المالي: نظام الحصص مقابل نظام الساعات'}</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#E8E7FF] text-[#7657F6]">
                Recharts
              </span>
            </h3>
            <p className="text-[11px] text-[#74778F] font-medium">
              {isEn
                ? 'Monitors revenue and workload delivery without confusing lesson units with hourly duration.'
                : 'متابعة مسارات الدخل وساعات العمل الفعلية مع التمييز الصارم بين كمية الحصص وساعات المحاسبة.'}
            </p>
          </div>
        </div>

        {/* Timeframe selector (Default: Last Month / Last 30 Days) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: 'last_month', label: isEn ? 'Last Month' : 'الشهر الماضي' },
            { key: 'last_30_days', label: isEn ? 'Last 30 Days' : 'آخر 30 يوم' },
            { key: 'this_month', label: isEn ? 'This Month' : 'هذا الشهر' },
            { key: 'last_60_days', label: isEn ? 'Last 60 Days' : 'آخر 60 يوم' },
            { key: 'all_time', label: isEn ? 'All Time' : 'الكل' },
          ].map((tf) => (
            <button
              key={tf.key}
              type="button"
              onClick={() => setTimeframe(tf.key as TimeframeOption)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                timeframe === tf.key
                  ? 'bg-[#17163D] text-white shadow-xs'
                  : 'bg-[#F6F7FC] text-[#74778F] border border-[#E8E7FF] hover:bg-[#E8E7FF]'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Stream KPI Summary Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Lesson-Based Stream KPI */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#7657F6]/10 via-white to-white border border-[#7657F6]/30 shadow-2xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#7657F6] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              {isEn ? 'Lesson-Based Stream' : 'مسار نظام الحصص'}
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#7657F6] text-white">
              {streamTotals.lessonSharePercent}% {isEn ? 'Share' : 'من الدخل'}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div>
              <strong className="text-xl sm:text-2xl font-black text-[#17163D] block">
                {formatMoney(streamTotals.totalLessonRevenue)} <span className="text-xs font-bold text-[#74778F]">{t('currency')}</span>
              </strong>
              <span className="text-[11px] text-[#74778F] font-medium block">
                {streamTotals.totalLessonUnits} {isEn ? (streamTotals.totalLessonUnits === 1 ? 'Lesson' : 'Lessons') : (streamTotals.totalLessonUnits === 1 ? 'حصة' : 'حصص')} ({streamTotals.totalLessonSessions} {isEn ? 'Sessions' : 'جلسة'})
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#74778F] block font-bold">{isEn ? 'Avg / Lesson' : 'متوسط الحصة'}</span>
              <span className="text-xs font-black text-[#7657F6]">
                {streamTotals.avgRevenuePerLesson} {t('currency')}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#7657F6]/20 flex items-center justify-between text-[10px] text-[#74778F]">
            <span>{isEn ? 'Includes: Packages, Prepaid, Postpaid' : 'يشمل: باقات، دفع مسبق، لاحق'}</span>
            <span className="font-bold text-[#17163D]">✓ {isEn ? 'Discrete units' : 'كميات محددة'}</span>
          </div>
        </div>

        {/* Hourly-Based Stream KPI */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#55C7E8]/10 via-white to-white border border-[#55C7E8]/40 shadow-2xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#0284C7] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {isEn ? 'Hourly-Based Stream' : 'مسار المحاسبة بالساعة'}
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#0284C7] text-white">
              {streamTotals.hourlySharePercent}% {isEn ? 'Share' : 'من الدخل'}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <div>
              <strong className="text-xl sm:text-2xl font-black text-[#17163D] block">
                {formatMoney(streamTotals.totalHourlyRevenue)} <span className="text-xs font-bold text-[#74778F]">{t('currency')}</span>
              </strong>
              <span className="text-[11px] text-[#74778F] font-medium block">
                {streamTotals.totalHourlyHours} {isEn ? (streamTotals.totalHourlyHours === 1 ? 'Hour' : 'Hours') : (streamTotals.totalHourlyHours === 1 ? 'ساعة' : 'ساعات')} ({streamTotals.totalHourlySessions} {isEn ? 'Sessions' : 'جلسة'})
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#74778F] block font-bold">{isEn ? 'Avg / Hour' : 'متوسط الساعة'}</span>
              <span className="text-xs font-black text-[#0284C7]">
                {streamTotals.avgRevenuePerHour} {t('currency')}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#55C7E8]/30 flex items-center justify-between text-[10px] text-[#74778F]">
            <span>{isEn ? 'Includes: Hourly Private & Groups' : 'يشمل: الدروس بالساعة ومجموعات الساعات'}</span>
            <span className="font-bold text-[#17163D]">✓ {isEn ? 'Real duration' : 'مدة زمنية دقيقة'}</span>
          </div>
        </div>

        {/* Combined Grand Progress KPI */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#17163D] to-[#2B276B] text-white shadow-2xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#55C7E8] flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              {isEn ? 'Total Billing Streams Revenue' : 'إجمالي التدفقات المالية'}
            </span>
            <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
              {processedStreamData.length} {timeGrouping === 'weekly' ? (isEn ? 'weeks' : 'أسابيع') : (isEn ? 'days' : 'أيام')}
            </span>
          </div>

          <div>
            <strong className="text-xl sm:text-2xl font-black text-white block">
              {formatMoney(streamTotals.grandTotalRevenue)} <span className="text-xs font-bold text-white/70">{t('currency')}</span>
            </strong>
          </div>

          {/* Contribution Progress Bar */}
          <div className="space-y-1 pt-1">
            <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${streamTotals.lessonSharePercent}%` }}
                className="bg-[#7657F6] h-full transition-all"
                title={`Lessons: ${streamTotals.lessonSharePercent}%`}
              />
              <div
                style={{ width: `${streamTotals.hourlySharePercent}%` }}
                className="bg-[#55C7E8] h-full transition-all"
                title={`Hourly: ${streamTotals.hourlySharePercent}%`}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/80 font-bold">
              <span>🟣 {isEn ? 'Lessons' : 'حصص'}: {streamTotals.lessonSharePercent}%</span>
              <span>🔵 {isEn ? 'Hourly' : 'ساعات'}: {streamTotals.hourlySharePercent}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Metric Mode & Filter Toolbar */}
      <div className="p-2.5 rounded-xl bg-[#F6F7FC] border border-[#E8E7FF] flex items-center justify-between flex-wrap gap-2">
        {/* Metric Modes */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[11px] font-bold text-[#74778F] px-1">{isEn ? 'Display Metric:' : 'نوع الرسم:'}</span>
          <button
            type="button"
            onClick={() => setMetricMode('revenue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              metricMode === 'revenue'
                ? 'bg-[#17163D] text-white shadow-xs'
                : 'text-[#74778F] hover:bg-[#E8E7FF] hover:text-[#17163D]'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isEn ? 'Revenue (EGP)' : 'المقارنة المالية (ج.م)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMetricMode('volume')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              metricMode === 'volume'
                ? 'bg-[#17163D] text-white shadow-xs'
                : 'text-[#74778F] hover:bg-[#E8E7FF] hover:text-[#17163D]'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-[#55C7E8]" />
            <span>{isEn ? 'Workload Volume (Lessons vs Hours)' : 'حجم النشاط (حصص vs ساعات)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMetricMode('cumulative')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              metricMode === 'cumulative'
                ? 'bg-[#17163D] text-white shadow-xs'
                : 'text-[#74778F] hover:bg-[#E8E7FF] hover:text-[#17163D]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#7657F6]" />
            <span>{isEn ? 'Cumulative Growth' : 'النمو التراكمي'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMetricMode('shares')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              metricMode === 'shares'
                ? 'bg-[#17163D] text-white shadow-xs'
                : 'text-[#74778F] hover:bg-[#E8E7FF] hover:text-[#17163D]'
            }`}
          >
            <Percent className="w-3.5 h-3.5 text-amber-500" />
            <span>{isEn ? 'Stream Proportions' : 'نسب التدفق'}</span>
          </button>
        </div>

        {/* Grouping & Service Toggles */}
        <div className="flex items-center gap-2">
          {/* Daily vs Weekly */}
          <div className="flex items-center bg-white p-1 rounded-lg border border-[#E8E7FF]">
            <button
              type="button"
              onClick={() => setTimeGrouping('daily')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                timeGrouping === 'daily'
                  ? 'bg-[#17163D] text-white'
                  : 'text-[#74778F] hover:text-[#17163D]'
              }`}
            >
              {isEn ? 'Daily' : 'يومي'}
            </button>
            <button
              type="button"
              onClick={() => setTimeGrouping('weekly')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                timeGrouping === 'weekly'
                  ? 'bg-[#17163D] text-white'
                  : 'text-[#74778F] hover:text-[#17163D]'
              }`}
            >
              {isEn ? 'Weekly' : 'أسبوعي'}
            </button>
          </div>

          {/* Service filter */}
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-white rounded-lg border border-[#E8E7FF] text-xs font-bold text-[#17163D] focus:outline-none focus:border-[#7657F6] cursor-pointer"
          >
            <option value="all">{isEn ? 'All Services' : 'كافة الخدمات'}</option>
            <option value="private">{isEn ? 'Private Lessons Only' : 'دروس خاصة فقط'}</option>
            <option value="group">{isEn ? 'Groups Only' : 'مجموعات فقط'}</option>
          </select>
        </div>
      </div>

      {/* 4. The Interactive Recharts Canvas */}
      <div className="h-72 sm:h-80 w-full min-w-0" dir="ltr">
        {processedStreamData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#74778F] space-y-2">
            <Info className="w-8 h-8 text-[#7657F6]/50" />
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F2F9" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#74778F', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#E8E7FF' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#74778F', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#E8E7FF' }}
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
                  fill="#7657F6"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  dataKey="hourlyRevenue"
                  name="hourlyRevenue"
                  stackId="a"
                  fill="#55C7E8"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            ) : metricMode === 'volume' ? (
              // Dual-Axis Chart: Lessons Count on Left vs Hourly Hours on Right (NEVER MIX UNITS)
              <ComposedChart
                data={processedStreamData}
                margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F2F9" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#74778F', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#E8E7FF' }}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tick={{ fontSize: 11, fill: '#7657F6', fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: '#7657F6' }}
                  unit={isEn ? ' L' : ' ح'}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#0284C7', fontWeight: 700 }}
                  tickLine={false}
                  axisLine={{ stroke: '#55C7E8' }}
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
                  fill="#7657F6"
                  radius={[6, 6, 0, 0]}
                  barSize={16}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="hourlyDurationHours"
                  name="hourlyDurationHours"
                  stroke="#55C7E8"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#0284C7', strokeWidth: 2, stroke: '#fff' }}
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
                    <stop offset="5%" stopColor="#7657F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#7657F6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradHourlyCum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#55C7E8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#55C7E8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F2F9" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#74778F', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#E8E7FF' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#74778F', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#E8E7FF' }}
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
                  stroke="#7657F6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradLessonCum)"
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeHourlyRevenue"
                  name="cumulativeHourlyRevenue"
                  stroke="#55C7E8"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#gradHourlyCum)"
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeTotalRevenue"
                  name="cumulativeTotalRevenue"
                  stroke="#17163D"
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F2F9" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 11, fill: '#74778F', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#E8E7FF' }}
                />
                <YAxis
                  unit="%"
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#74778F', fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: '#E8E7FF' }}
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
                  stroke="#7657F6"
                  fill="#7657F6"
                  fillOpacity={0.8}
                />
                <Area
                  type="monotone"
                  dataKey="hourlyShare"
                  name="hourlyShare"
                  stackId="1"
                  stroke="#55C7E8"
                  fill="#55C7E8"
                  fillOpacity={0.8}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* 5. Detailed Breakdown Table Toggle */}
      <div className="pt-2 border-t border-[#E8E7FF]">
        <button
          type="button"
          onClick={() => setShowDataTable(!showDataTable)}
          className="w-full py-2 px-3 rounded-xl bg-[#F6F7FC] hover:bg-[#E8E7FF] text-[#17163D] text-xs font-black flex items-center justify-between transition-all cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#7657F6]" />
            <span>{isEn ? 'View Detailed Breakdown Table' : 'عرض جدول التدقيق والتفصيل اليومي'}</span>
          </span>
          <span className="text-[11px] text-[#74778F]">
            {showDataTable ? (isEn ? 'Hide Table ▲' : 'إخفاء الجدول ▲') : (isEn ? 'Show Table ▼' : 'إظهار الجدول ▼')}
          </span>
        </button>

        {showDataTable && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-[#E8E7FF]">
            <table className="w-full text-xs text-start">
              <thead className="bg-[#17163D] text-white font-bold">
                <tr>
                  <th className="p-2.5 text-start">{isEn ? 'Date / Period' : 'التاريخ / الفترة'}</th>
                  <th className="p-2.5 text-center text-[#E8E7FF] bg-[#7657F6]/30">{isEn ? 'Lessons Qty' : 'كمية الحصص'}</th>
                  <th className="p-2.5 text-center text-[#E8E7FF] bg-[#7657F6]/30">{isEn ? 'Lesson Rev (EGP)' : 'دخل الحصص'}</th>
                  <th className="p-2.5 text-center text-[#E0F7FE] bg-[#55C7E8]/30">{isEn ? 'Hourly Hours' : 'ساعات العمل'}</th>
                  <th className="p-2.5 text-center text-[#E0F7FE] bg-[#55C7E8]/30">{isEn ? 'Hourly Rev (EGP)' : 'دخل الساعات'}</th>
                  <th className="p-2.5 text-center text-emerald-300">{isEn ? 'Total Rev (EGP)' : 'إجمالي الدخل'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E7FF]">
                {processedStreamData
                  .filter((p) => p.totalSessionsCount > 0 || p.totalRevenue > 0)
                  .map((row) => (
                    <tr key={row.date} className="hover:bg-[#F6F7FC] transition-colors">
                      <td className="p-2.5 font-bold text-[#17163D]">{row.fullDateLabel}</td>
                      <td className="p-2.5 text-center font-black text-[#7657F6]">
                        {formatSessionQuantityDisplay({ sessionUnits: row.lessonUnits, isHourly: false }, isRTL)}
                      </td>
                      <td className="p-2.5 text-center font-bold text-[#17163D]">
                        {formatMoney(row.lessonRevenue)}
                      </td>
                      <td className="p-2.5 text-center font-black text-[#0284C7]">
                        {formatSessionQuantityDisplay({ hours: row.hourlyDurationHours, isHourly: true }, isRTL)}
                      </td>
                      <td className="p-2.5 text-center font-bold text-[#17163D]">
                        {formatMoney(row.hourlyRevenue)}
                      </td>
                      <td className="p-2.5 text-center font-black text-emerald-700">
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
