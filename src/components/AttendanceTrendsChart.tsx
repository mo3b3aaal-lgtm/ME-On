import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Layers,
  Activity,
  Award,
  Filter,
} from 'lucide-react';
import { Session, Attendance, Student, Group, ReportPeriodFilter } from '../types';
import { useTranslation } from '../utils/i18n';
import { getArabicMonthName } from '../utils/storage';

export interface AttendanceTrendsChartProps {
  sessions: Session[];
  allAttendance: Attendance[];
  students?: Student[];
  groups?: Group[];
  selectedGroupId?: string;
  selectedStudentId?: string;
  periodFilter?: ReportPeriodFilter;
  customStartDate?: string;
  customEndDate?: string;
  compact?: boolean;
}

type MetricMode = 'rate' | 'counts' | 'all';
type TimeGrouping = 'session' | 'weekly' | 'monthly';

interface AttendanceDataPoint {
  id: string;
  dateKey: string;
  displayLabel: string;
  fullDateLabel: string;
  attended: number; // Present + Late
  present: number;
  late: number;
  absentCharged: number;
  absentExcused: number;
  absentTotal: number;
  totalExpected: number;
  rate: number; // 0 - 100
  sessionsCount: number;
}

export const AttendanceTrendsChart: React.FC<AttendanceTrendsChartProps> = ({
  sessions,
  allAttendance,
  students = [],
  groups = [],
  selectedGroupId,
  selectedStudentId,
  periodFilter = 'this_month',
  customStartDate,
  customEndDate,
  compact = false,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  // Chart configuration states
  const [metricMode, setMetricMode] = useState<MetricMode>('rate');
  const [timeGrouping, setTimeGrouping] = useState<TimeGrouping>('session');
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>(selectedGroupId || 'all');

  // Filter sessions based on period, group, and student
  const filteredData = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    const d7Str = d7.toISOString().split('T')[0];

    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // 1. Filter sessions
    const relevantSessions = sessions.filter((s) => {
      // Group filter
      const targetGroup = activeGroupFilter !== 'all' ? activeGroupFilter : selectedGroupId;
      if (targetGroup && targetGroup !== 'all' && s.groupId !== targetGroup) {
        return false;
      }

      // Student filter for private sessions
      if (selectedStudentId && s.studentId && s.studentId !== selectedStudentId) {
        return false;
      }

      // Period filter
      if (periodFilter === 'all_time') return true;
      if (periodFilter === 'today') return s.date === todayStr;
      if (periodFilter === 'last_7_days') return s.date >= d7Str && s.date <= todayStr;
      if (periodFilter === 'this_month') return s.month === currentMonth && s.year === currentYear;
      if (periodFilter === 'last_month') return s.month === lastMonth && s.year === lastMonthYear;
      if (periodFilter === 'custom_range' && customStartDate && customEndDate) {
        return s.date >= customStartDate && s.date <= customEndDate;
      }

      return true;
    });

    const relevantSessionIds = new Set(relevantSessions.map((s) => s.id));

    // 2. Filter attendance
    const relevantAttendance = allAttendance.filter((a) => {
      if (!relevantSessionIds.has(a.sessionId)) return false;
      if (selectedStudentId && a.studentId !== selectedStudentId) return false;
      return true;
    });

    // 3. Map attendance by session ID
    const attendanceBySession = new Map<string, Attendance[]>();
    relevantAttendance.forEach((att) => {
      const list = attendanceBySession.get(att.sessionId) || [];
      list.push(att);
      attendanceBySession.set(att.sessionId, list);
    });

    // Sort sessions chronologically ascending
    const sortedSessions = [...relevantSessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // 4. Time Bucketing
    if (timeGrouping === 'monthly') {
      // Group by YYYY-MM
      const monthlyBuckets = new Map<string, { sessions: Session[]; attendance: Attendance[] }>();
      sortedSessions.forEach((ses) => {
        const key = `${ses.year}-${String(ses.month).padStart(2, '0')}`;
        const b = monthlyBuckets.get(key) || { sessions: [], attendance: [] };
        b.sessions.push(ses);
        const atts = attendanceBySession.get(ses.id) || [];
        b.attendance.push(...atts);
        monthlyBuckets.set(key, b);
      });

      const points: AttendanceDataPoint[] = [];
      monthlyBuckets.forEach((bucket, key) => {
        const [y, mStr] = key.split('-');
        const m = Number(mStr);
        const present = bucket.attendance.filter((a) => a.status === 'present').length;
        const late = bucket.attendance.filter((a) => a.status === 'late').length;
        const absentCharged = bucket.attendance.filter(
          (a) => a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)
        ).length;
        const absentExcused = bucket.attendance.filter(
          (a) => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false
        ).length;

        const attended = present + late;
        const absentTotal = absentCharged + absentExcused;
        const totalExpected = attended + absentTotal;
        const rate = totalExpected > 0 ? Math.round((attended / totalExpected) * 100) : 100;

        const monthName = isEn ? new Date(Number(y), m - 1, 1).toLocaleString('en', { month: 'short' }) : getArabicMonthName(m);

        points.push({
          id: `point_month_${key}`,
          dateKey: key,
          displayLabel: `${monthName} ${y}`,
          fullDateLabel: `${monthName} ${y}`,
          attended,
          present,
          late,
          absentCharged,
          absentExcused,
          absentTotal,
          totalExpected,
          rate,
          sessionsCount: bucket.sessions.length,
        });
      });

      return points;
    }

    if (timeGrouping === 'weekly') {
      // Group by ISO Week or 7-day windows
      const weeklyBuckets = new Map<string, { sessions: Session[]; attendance: Attendance[] }>();
      sortedSessions.forEach((ses) => {
        const d = new Date(ses.date);
        // Compute start of week (Saturday or Sunday based on region)
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 6 ? 0 : -1); // Saturday base
        const startOfWeek = new Date(d.setDate(diff));
        const key = startOfWeek.toISOString().split('T')[0];

        const b = weeklyBuckets.get(key) || { sessions: [], attendance: [] };
        b.sessions.push(ses);
        const atts = attendanceBySession.get(ses.id) || [];
        b.attendance.push(...atts);
        weeklyBuckets.set(key, b);
      });

      const points: AttendanceDataPoint[] = [];
      weeklyBuckets.forEach((bucket, key) => {
        const present = bucket.attendance.filter((a) => a.status === 'present').length;
        const late = bucket.attendance.filter((a) => a.status === 'late').length;
        const absentCharged = bucket.attendance.filter(
          (a) => a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)
        ).length;
        const absentExcused = bucket.attendance.filter(
          (a) => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false
        ).length;

        const attended = present + late;
        const absentTotal = absentCharged + absentExcused;
        const totalExpected = attended + absentTotal;
        const rate = totalExpected > 0 ? Math.round((attended / totalExpected) * 100) : 100;

        const dateObj = new Date(key);
        const dayNum = dateObj.getDate();
        const mNum = dateObj.getMonth() + 1;
        const mShort = isEn ? dateObj.toLocaleString('en', { month: 'short' }) : getArabicMonthName(mNum);

        points.push({
          id: `point_week_${key}`,
          dateKey: key,
          displayLabel: `${dayNum} ${mShort}`,
          fullDateLabel: isEn ? `Week of ${key}` : `أسبوع ${key}`,
          attended,
          present,
          late,
          absentCharged,
          absentExcused,
          absentTotal,
          totalExpected,
          rate,
          sessionsCount: bucket.sessions.length,
        });
      });

      return points;
    }

    // Default: Group by Session Date
    const dailyBuckets = new Map<string, { sessions: Session[]; attendance: Attendance[] }>();
    sortedSessions.forEach((ses) => {
      const key = ses.date;
      const b = dailyBuckets.get(key) || { sessions: [], attendance: [] };
      b.sessions.push(ses);
      const atts = attendanceBySession.get(ses.id) || [];
      b.attendance.push(...atts);
      dailyBuckets.set(key, b);
    });

    const points: AttendanceDataPoint[] = [];
    dailyBuckets.forEach((bucket, key) => {
      const present = bucket.attendance.filter((a) => a.status === 'present').length;
      const late = bucket.attendance.filter((a) => a.status === 'late').length;
      const absentCharged = bucket.attendance.filter(
        (a) => a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)
      ).length;
      const absentExcused = bucket.attendance.filter(
        (a) => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false
      ).length;

      const attended = present + late;
      const absentTotal = absentCharged + absentExcused;
      const totalExpected = attended + absentTotal;
      const rate = totalExpected > 0 ? Math.round((attended / totalExpected) * 100) : 100;

      const parts = key.split('-');
      const mNum = Number(parts[1]);
      const dNum = Number(parts[2]);
      const mShort = isEn ? new Date(Number(parts[0]), mNum - 1, dNum).toLocaleString('en', { month: 'short' }) : getArabicMonthName(mNum);

      points.push({
        id: `point_day_${key}`,
        dateKey: key,
        displayLabel: `${dNum} ${mShort}`,
        fullDateLabel: key,
        attended,
        present,
        late,
        absentCharged,
        absentExcused,
        absentTotal,
        totalExpected,
        rate,
        sessionsCount: bucket.sessions.length,
      });
    });

    return points;
  }, [
    sessions,
    allAttendance,
    selectedGroupId,
    selectedStudentId,
    activeGroupFilter,
    periodFilter,
    customStartDate,
    customEndDate,
    timeGrouping,
    isEn,
  ]);

  // Aggregate summary metrics across all points
  const stats = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        avgRate: 100,
        totalAttended: 0,
        totalAbsent: 0,
        totalExpected: 0,
        peakRate: 100,
        peakDate: '',
        trendDelta: 0,
      };
    }

    let sumRate = 0;
    let totalAttended = 0;
    let totalAbsent = 0;
    let totalExpected = 0;
    let peakRate = 0;
    let peakDate = '';

    filteredData.forEach((p) => {
      sumRate += p.rate;
      totalAttended += p.attended;
      totalAbsent += p.absentTotal;
      totalExpected += p.totalExpected;

      if (p.rate >= peakRate) {
        peakRate = p.rate;
        peakDate = p.displayLabel;
      }
    });

    const avgRate = Math.round(sumRate / filteredData.length);

    // Compute trend delta (last 2 points)
    let trendDelta = 0;
    if (filteredData.length >= 2) {
      const last = filteredData[filteredData.length - 1].rate;
      const prev = filteredData[filteredData.length - 2].rate;
      trendDelta = last - prev;
    }

    return {
      avgRate,
      totalAttended,
      totalAbsent,
      totalExpected,
      peakRate,
      peakDate,
      trendDelta,
    };
  }, [filteredData]);

  // Custom Luxury Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: AttendanceDataPoint = payload[0].payload;
      return (
        <div
          className="bg-[#5C4033]/95 backdrop-blur-md text-[#FAF7F2] p-3.5 rounded-2xl shadow-2xl border border-[#B68A4C]/40 text-xs space-y-2 z-50 min-w-[180px]"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#EADBC7]/20 pb-1.5">
            <span className="font-black text-sm text-[#B68A4C]">{data.fullDateLabel}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EADBC7]/20 text-[#F8F2EA] font-bold">
              {data.sessionsCount} {isEn ? 'sessions' : 'حصص'}
            </span>
          </div>

          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#EADBC7]/90 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#B68A4C]" />
                <span>{isEn ? 'Commitment Rate:' : 'نسبة الحضور:'}</span>
              </span>
              <strong className="font-black text-[#B68A4C] text-sm">{data.rate}%</strong>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[#EADBC7]/90 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#B56B45]" />
                <span>{isEn ? 'Present / Late:' : 'حضور / تأخير:'}</span>
              </span>
              <span className="font-bold text-[#FAF7F2]">
                {data.attended} <span className="text-[10px] text-[#EADBC7]/75">({data.present} + {data.late})</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[#EADBC7]/90 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#6B1E2B]" />
                <span>{isEn ? 'Charged Absence:' : 'غياب محسوب:'}</span>
              </span>
              <span className="font-bold text-[#EADBC7]">{data.absentCharged}</span>
            </div>

            {data.absentExcused > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[#EADBC7]/90 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#B6A89C]" />
                  <span>{isEn ? 'Excused Absence:' : 'غياب معفى:'}</span>
                </span>
                <span className="font-bold text-[#EADBC7]">{data.absentExcused}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#EADBC7]/15 text-[11px]">
              <span className="text-[#EADBC7]/75">{isEn ? 'Total Expected:' : 'إجمالي الطلاب:'}</span>
              <strong className="text-[#FAF7F2]">{data.totalExpected}</strong>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="classy-card p-4 bg-[#FAF7F2] space-y-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-[#B68A4C]/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* 1. Header with Title & Controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6B1E2B] via-[#B56B45] to-[#B68A4C] p-0.5 shadow-md shadow-[#5C4033]/20 shrink-0">
            <div className="w-full h-full rounded-[14px] bg-[#5C4033] flex items-center justify-center text-[#FAF7F2]">
              <Activity className="w-5 h-5 text-[#B68A4C]" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs sm:text-sm font-black text-[#2F2F2F] truncate">
                {isEn ? 'Student Attendance Trends' : 'مؤشرات ومنحنيات التزام الطلاب'}
              </h3>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#EADBC7] text-[#5C4033] border border-[#B6A89C] shrink-0">
                {filteredData.length} {timeGrouping === 'monthly' ? (isEn ? 'Months' : 'أشهر') : timeGrouping === 'weekly' ? (isEn ? 'Weeks' : 'أسابيع') : (isEn ? 'Sessions' : 'حصص')}
              </span>
            </div>
            <p className="text-[11px] text-[#69493C] font-medium truncate">
              {isEn ? 'Visual historical analysis of attendance rates and commitment' : 'تحليل بياني زمني لمعدلات الحضور ونسبة التزام الطلاب'}
            </p>
          </div>
        </div>

        {/* View Controls & Toggles */}
        <div className="space-y-2">
          {/* Group Filter Dropdown (if multiple groups available) */}
          {groups.length > 1 && !selectedGroupId && (
            <select
              value={activeGroupFilter}
              onChange={(e) => setActiveGroupFilter(e.target.value)}
              className="w-full bg-[#F8F2EA] hover:bg-[#EADBC7]/60 border border-[#B6A89C] rounded-xl px-2.5 py-2 text-xs text-[#2F2F2F] font-bold focus:outline-none focus:border-[#B68A4C] cursor-pointer transition-colors"
            >
              <option value="all">{isEn ? 'All Groups & Services' : 'كافة المجموعات والخدمات'}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            {/* Grouping Selector */}
            <div className="grid grid-cols-3 bg-[#EADBC7]/60 p-1 rounded-xl border border-[#B6A89C]/60">
              <button
                type="button"
                onClick={() => setTimeGrouping('session')}
                className={`py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center truncate ${
                  timeGrouping === 'session'
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] shadow-2xs'
                    : 'text-[#69493C] hover:text-[#2F2F2F]'
                }`}
              >
                {isEn ? 'Daily' : 'يومي'}
              </button>
              <button
                type="button"
                onClick={() => setTimeGrouping('weekly')}
                className={`py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center truncate ${
                  timeGrouping === 'weekly'
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] shadow-2xs'
                    : 'text-[#69493C] hover:text-[#2F2F2F]'
                }`}
              >
                {isEn ? 'Weekly' : 'أسبوعي'}
              </button>
              <button
                type="button"
                onClick={() => setTimeGrouping('monthly')}
                className={`py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center truncate ${
                  timeGrouping === 'monthly'
                    ? 'bg-[#6B1E2B] text-[#FAF7F2] shadow-2xs'
                    : 'text-[#69493C] hover:text-[#2F2F2F]'
                }`}
              >
                {isEn ? 'Monthly' : 'شهري'}
              </button>
            </div>

            {/* Metric Mode Selector */}
            <div className="grid grid-cols-3 bg-[#EADBC7]/60 p-1 rounded-xl border border-[#B6A89C]/60">
              <button
                type="button"
                onClick={() => setMetricMode('rate')}
                className={`py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center truncate ${
                  metricMode === 'rate'
                    ? 'bg-gradient-to-r from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] shadow-2xs'
                    : 'text-[#69493C] hover:text-[#2F2F2F]'
                }`}
              >
                {isEn ? 'Rate %' : 'النسبة %'}
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('counts')}
                className={`py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center truncate ${
                  metricMode === 'counts'
                    ? 'bg-gradient-to-r from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] shadow-2xs'
                    : 'text-[#69493C] hover:text-[#2F2F2F]'
                }`}
              >
                {isEn ? 'Counts' : 'الأعداد'}
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('all')}
                className={`py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center truncate ${
                  metricMode === 'all'
                    ? 'bg-gradient-to-r from-[#6B1E2B] to-[#5C4033] text-[#FAF7F2] shadow-2xs'
                    : 'text-[#69493C] hover:text-[#2F2F2F]'
                }`}
              >
                {isEn ? 'Both' : 'شامل'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Key Trend Indicators (2x2 Square Bento Grid like Dashboard) */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        <div className="bg-[#F8F2EA] p-3.5 rounded-2xl border border-[#EADBC7] flex flex-col justify-between min-h-[86px]">
          <div className="flex items-center justify-between text-[#69493C] text-[11px] font-bold">
            <span className="truncate">{isEn ? 'Average Rate' : 'متوسط الالتزام'}</span>
            <Award className="w-3.5 h-3.5 text-[#B68A4C] shrink-0" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <strong className={`text-lg font-black ${stats.avgRate >= 85 ? 'text-[#5C4033]' : stats.avgRate >= 70 ? 'text-[#B56B45]' : 'text-[#6B1E2B]'}`}>
              {stats.avgRate}%
            </strong>
            {stats.trendDelta !== 0 && (
              <span
                className={`text-[10px] font-bold flex items-center gap-0.5 ${
                  stats.trendDelta > 0 ? 'text-[#5C4033]' : 'text-[#6B1E2B]'
                }`}
              >
                {stats.trendDelta > 0 ? (
                  <TrendingUp className="w-3 h-3 text-[#B68A4C]" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-[#6B1E2B]" />
                )}
                <span>{stats.trendDelta > 0 ? `+${stats.trendDelta}%` : `${stats.trendDelta}%`}</span>
              </span>
            )}
          </div>
        </div>

        <div className="bg-[#F8F2EA] p-3.5 rounded-2xl border border-[#EADBC7] flex flex-col justify-between min-h-[86px]">
          <div className="flex items-center justify-between text-[#69493C] text-[11px] font-bold">
            <span className="truncate">{isEn ? 'Total Attendances' : 'إجمالي الحضور'}</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#B68A4C] shrink-0" />
          </div>
          <strong className="text-lg font-black text-[#5C4033] block truncate mt-1">
            {stats.totalAttended} <span className="text-[10px] text-[#69493C] font-medium">{isEn ? 'students' : 'طالب'}</span>
          </strong>
        </div>

        <div className="bg-[#F8F2EA] p-3.5 rounded-2xl border border-[#EADBC7] flex flex-col justify-between min-h-[86px]">
          <div className="flex items-center justify-between text-[#69493C] text-[11px] font-bold">
            <span className="truncate">{isEn ? 'Total Absences' : 'إجمالي الغياب'}</span>
            <XCircle className="w-3.5 h-3.5 text-[#6B1E2B] shrink-0" />
          </div>
          <strong className="text-lg font-black text-[#6B1E2B] block truncate mt-1">
            {stats.totalAbsent} <span className="text-[10px] text-[#69493C] font-medium">{isEn ? 'times' : 'حالة'}</span>
          </strong>
        </div>

        <div className="bg-[#F8F2EA] p-3.5 rounded-2xl border border-[#EADBC7] flex flex-col justify-between min-h-[86px]">
          <div className="flex items-center justify-between text-[#69493C] text-[11px] font-bold">
            <span className="truncate">{isEn ? 'Peak Attendance' : 'أعلى نسبة حضور'}</span>
            <Sparkles className="w-3.5 h-3.5 text-[#B56B45] shrink-0" />
          </div>
          <strong className="text-lg font-black text-[#2F2F2F] block truncate mt-1">
            {stats.peakRate}% <span className="text-[10px] text-[#69493C] font-medium">({stats.peakDate || (isEn ? 'Latest' : 'المسجل')})</span>
          </strong>
        </div>
      </div>

      {/* 3. Recharts Line / Area Chart Visualization */}
      {filteredData.length === 0 ? (
        <div className="p-8 sm:p-12 text-center text-[#69493C] space-y-3 flex flex-col items-center justify-center bg-[#F8F2EA] rounded-2xl border border-[#EADBC7]">
          <div className="w-12 h-12 rounded-2xl bg-[#FAF7F2] flex items-center justify-center text-[#6B1E2B] shadow-xs border border-[#EADBC7]">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-sm text-[#2F2F2F]">{isEn ? 'No attendance records for this timeframe' : 'لا توجد بيانات حضور مسجلة في هذا النطاق'}</h4>
            <p className="text-xs text-[#69493C]">{isEn ? 'Record attendance in your sessions to generate live trendline analytics.' : 'قم بتسجيل حضور وغياب الحصص لتوليد المنحنيات البيانية التفاعلية.'}</p>
          </div>
        </div>
      ) : (
        <div className="w-full h-72 sm:h-80 pt-2 select-none">
          <ResponsiveContainer width="100%" height="100%">
            {metricMode === 'rate' ? (
              <AreaChart
                data={filteredData}
                margin={{ top: 10, right: 10, left: isRTL ? 10 : -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6B1E2B" stopOpacity={0.38} />
                    <stop offset="95%" stopColor="#B68A4C" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EADBC7" vertical={false} />
                <XAxis
                  dataKey="displayLabel"
                  stroke="#69493C"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#B6A89C' }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#69493C"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#B6A89C' }}
                  tickFormatter={(val) => `${val}%`}
                  orientation={isRTL ? 'right' : 'left'}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={85}
                  stroke="#B68A4C"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: isEn ? '85% Target' : 'الهدف 85%',
                    fill: '#5C4033',
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  name={isEn ? 'Attendance Rate' : 'نسبة الحضور'}
                  stroke="#6B1E2B"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#rateGradient)"
                  activeDot={{ r: 6, fill: '#6B1E2B', stroke: '#B68A4C', strokeWidth: 3 }}
                />
              </AreaChart>
            ) : metricMode === 'counts' ? (
              <LineChart
                data={filteredData}
                margin={{ top: 10, right: 10, left: isRTL ? 10 : -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EADBC7" vertical={false} />
                <XAxis
                  dataKey="displayLabel"
                  stroke="#69493C"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#B6A89C' }}
                />
                <YAxis
                  stroke="#69493C"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#B6A89C' }}
                  orientation={isRTL ? 'right' : 'left'}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                  formatter={(value) => <span className="text-[#2F2F2F] font-bold">{value}</span>}
                />
                <Line
                  type="monotone"
                  dataKey="attended"
                  name={isEn ? 'Present / Late' : 'حضور / تأخير'}
                  stroke="#B68A4C"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#B68A4C' }}
                  activeDot={{ r: 6, stroke: '#B68A4C', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="absentCharged"
                  name={isEn ? 'Charged Absence' : 'غياب محسوب'}
                  stroke="#6B1E2B"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#6B1E2B' }}
                  activeDot={{ r: 6, stroke: '#6B1E2B', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="absentExcused"
                  name={isEn ? 'Excused Absence' : 'غياب معفى'}
                  stroke="#B56B45"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#B56B45' }}
                />
                <Line
                  type="monotone"
                  dataKey="totalExpected"
                  name={isEn ? 'Total Expected' : 'إجمالي المقيدين'}
                  stroke="#5C4033"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  dot={false}
                />
              </LineChart>
            ) : (
              <LineChart
                data={filteredData}
                margin={{ top: 10, right: 10, left: isRTL ? 10 : -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EADBC7" vertical={false} />
                <XAxis
                  dataKey="displayLabel"
                  stroke="#69493C"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#B6A89C' }}
                />
                <YAxis
                  yAxisId="left"
                  domain={[0, 100]}
                  stroke="#6B1E2B"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#B6A89C' }}
                  tickFormatter={(val) => `${val}%`}
                  orientation={isRTL ? 'right' : 'left'}
                />
                <YAxis
                  yAxisId="right"
                  stroke="#B68A4C"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#B6A89C' }}
                  orientation={isRTL ? 'left' : 'right'}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                  formatter={(value) => <span className="text-[#2F2F2F] font-bold">{value}</span>}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="rate"
                  name={isEn ? 'Attendance Rate %' : 'نسبة الالتزام %'}
                  stroke="#6B1E2B"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#6B1E2B' }}
                  activeDot={{ r: 6, stroke: '#B68A4C', strokeWidth: 2 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="attended"
                  name={isEn ? 'Present Count' : 'عدد الحاضرين'}
                  stroke="#B68A4C"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#B68A4C' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="absentTotal"
                  name={isEn ? 'Total Absences' : 'إجمالي الغياب'}
                  stroke="#B56B45"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#B56B45' }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* 4. Legend & Info Footer */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#EADBC7] text-[11px] text-[#69493C] flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B68A4C] inline-block" />
            <span>{isEn ? '≥85% Optimal Attendance' : '≥85% معدل حضور ممتاز'}</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B56B45] inline-block" />
            <span>{isEn ? '70-84% Moderate Commitment' : '70-84% التزام متوسط'}</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[#6B1E2B] inline-block" />
            <span>{isEn ? '<70% Needs Follow-up' : '<70% بحاجة لمتابعة عاجلة'}</span>
          </span>
        </div>

        <span className="text-[10px] font-bold bg-[#F8F2EA] px-2 py-0.5 rounded-lg border border-[#EADBC7]">
          {isEn ? 'Interactive Charts powered by Recharts' : 'رسوم بيانية تفاعلية مدعومة بـ Recharts'}
        </span>
      </div>
    </div>
  );
};
