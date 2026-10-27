import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { NavyCard } from '../ui/NavyCard';
import { MintCard } from '../ui/MintCard';
import { WhiteCard } from '../ui/WhiteCard';
import { useTranslation } from '../../utils/i18n';

/**
 * Circular ring placeholder matching ProgressRing dimensions without fake % text.
 */
const RingPlaceholder: React.FC<{ size: number; stroke: number }> = ({ size, stroke }) => (
  <div
    aria-hidden="true"
    style={{ width: size, height: size, borderWidth: stroke }}
    className="rounded-full border-white/15 flex items-center justify-center shrink-0 select-none pointer-events-none"
  >
    <Skeleton tone="on-navy" className="h-3.5 w-8 rounded-md" />
  </div>
);

/**
 * SessionTimelineSkeleton:
 * Matches SessionTimeline.tsx: w-12 start-time column + min-h-[64px] MintCard
 * with 36px circular avatar, title bar, time range bar, and trailing status pill.
 */
export const SessionTimelineSkeleton: React.FC<{
  count?: number;
  className?: string;
}> = React.memo(({ count = 3, className = '' }) => {
  const { isRTL } = useTranslation();

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className={`space-y-3 ${className}`.trim()}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {Array.from({ length: count }, (_, idx) => (
        <div key={idx} className="relative flex items-center gap-3 select-none">
          <div className="w-12 shrink-0 flex justify-center">
            <Skeleton className="h-3.5 w-9 rounded-md" />
          </div>
          <MintCard className="flex-1 min-h-[64px] p-3.5 flex items-center justify-between gap-3 min-w-0 border border-transparent">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Skeleton variant="circular" tone="on-mint" className="w-9 h-9 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton
                  tone="on-mint"
                  className={`h-4 rounded-md ${idx % 2 === 0 ? 'w-36' : 'w-28'}`}
                />
                <Skeleton tone="on-mint" className="h-3 w-24 rounded-md" />
              </div>
            </div>
            <Skeleton tone="on-mint" className="h-6 w-16 rounded-full shrink-0" />
          </MintCard>
        </div>
      ))}
    </div>
  );
});

SessionTimelineSkeleton.displayName = 'SessionTimelineSkeleton';

/**
 * DashboardContentSkeleton:
 * Matches DashboardView.tsx sections below ScreenHeader:
 * 1) Daily Goal NavyCard (88px ring)
 * 2) Today's Focus 2x2 MintCard grid (min-h-[168px] top row, min-h-[104px] bottom row)
 * 3) Today's Schedule SessionTimeline
 * 4) Today's Session Debts tiles (min-h-[72px])
 */
export const DashboardContentSkeleton: React.FC = React.memo(() => {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      {/* 1. Today's Progress NavyCard */}
      <NavyCard className="relative">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2.5">
            <div className="space-y-2">
              <Skeleton tone="on-navy" className="h-4 w-32 rounded-md" />
              <Skeleton tone="on-navy" className="h-3.5 w-44 rounded-md" />
            </div>
            <Skeleton tone="on-navy" className="h-7 w-28 rounded-xl" />
          </div>
          <RingPlaceholder size={88} stroke={10} />
        </div>
      </NavyCard>

      {/* 2. Today's Focus 2x2 MintCards */}
      <div className="space-y-3 pt-1">
        <Skeleton className="h-5 w-28 rounded-md" />
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((idx) => (
            <MintCard
              key={`focus-top-${idx}`}
              className="min-h-[168px] flex flex-col justify-between p-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <Skeleton variant="circular" tone="on-mint" className="w-9 h-9 shrink-0" />
                  <Skeleton tone="on-mint" className="h-4 w-20 rounded-md" />
                </div>
                <Skeleton tone="on-mint" className="h-3 w-16 rounded-md" />
              </div>
              <div className="flex justify-end">
                <Skeleton tone="on-mint" className="h-12 w-16 rounded-2xl" />
              </div>
            </MintCard>
          ))}
          {[0, 1].map((idx) => (
            <MintCard
              key={`focus-btm-${idx}`}
              className="min-h-[104px] flex flex-col justify-between p-3.5"
            >
              <Skeleton tone="on-mint" className="h-3.5 w-24 rounded-md" />
              <div className="space-y-1.5">
                <Skeleton tone="on-mint" className="h-5 w-16 rounded-md" />
                <Skeleton tone="on-mint" className="h-2.5 w-14 rounded-md" />
              </div>
            </MintCard>
          ))}
        </div>
      </div>

      {/* 3. Today's Schedule */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
        <SessionTimelineSkeleton count={3} />
      </div>

      {/* 4. Today's Session Debts */}
      <div className="space-y-3 pt-1">
        <Skeleton className="h-5 w-36 rounded-md" />
        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1].map((idx) => (
            <div
              key={`debt-${idx}`}
              className="p-3 rounded-2xl bg-mint-soft border border-line min-h-[72px] flex flex-col justify-center space-y-2"
            >
              <Skeleton tone="on-mint" className="h-3.5 w-24 rounded-md" />
              <Skeleton tone="on-mint" className="h-4 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

DashboardContentSkeleton.displayName = 'DashboardContentSkeleton';

/**
 * StudentCardsSkeleton:
 * Matches StudentsView.tsx card structure:
 * rounded-[var(--radius-card)] p-4, 48px circular avatar, name bar, meta bar,
 * trailing StatusBadge capsule, and secondary group/action strip.
 */
export const StudentCardsSkeleton: React.FC<{ count?: number }> = React.memo(({ count = 4 }) => {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-3">
      {Array.from({ length: count }, (_, idx) => {
        const isFeatured = idx === 0;
        const cardSurface = isFeatured
          ? 'bg-mint border-mint shadow-mint'
          : 'bg-mint-soft border-line shadow-white';

        return (
          <div
            key={idx}
            className={`rounded-[var(--radius-card)] p-4 border ${cardSurface}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Skeleton variant="circular" tone="on-mint" className="w-12 h-12 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton
                    tone="on-mint"
                    className={`h-4 rounded-md ${idx % 2 === 0 ? 'w-36' : 'w-28'}`}
                  />
                  <Skeleton tone="on-mint" className="h-3 w-44 max-w-full rounded-md" />
                </div>
              </div>
              <Skeleton tone="on-mint" className="h-6 w-16 rounded-full shrink-0" />
            </div>

            <div className="mt-3 pt-2.5 border-t border-navy/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Skeleton tone="on-mint" className="h-5 w-20 rounded-full" />
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton variant="circular" tone="on-mint" className="w-7 h-7" />
                <Skeleton variant="circular" tone="on-mint" className="w-7 h-7" />
                <Skeleton tone="on-mint" className="h-6 w-14 rounded-full" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

StudentCardsSkeleton.displayName = 'StudentCardsSkeleton';

/**
 * GroupCardsSkeleton:
 * Matches GroupsView.tsx card structure:
 * rounded-[var(--radius-card)] p-4, title + subject capsule, student count line,
 * end-aligned price/billing block, schedule day pills row, and bottom action row.
 */
export const GroupCardsSkeleton: React.FC<{ count?: number }> = React.memo(({ count = 3 }) => {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-3">
      {Array.from({ length: count }, (_, idx) => {
        const isFeatured = idx === 0;
        const cardSurface = isFeatured
          ? 'bg-mint border-mint shadow-mint'
          : 'bg-mint-soft border-line shadow-white';

        return (
          <div
            key={idx}
            className={`rounded-[var(--radius-card)] p-4 border ${cardSurface}`}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton
                    tone="on-mint"
                    className={`h-4 rounded-md ${idx % 2 === 0 ? 'w-36' : 'w-32'}`}
                  />
                  <Skeleton tone="on-mint" className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton tone="on-mint" className="h-3.5 w-28 rounded-md" />
              </div>
              <div className="shrink-0 flex flex-col items-end space-y-1.5">
                <Skeleton tone="on-mint" className="h-4 w-16 rounded-md" />
                <Skeleton tone="on-mint" className="h-3 w-12 rounded-md" />
              </div>
            </div>

            {/* Schedule pills row */}
            <div className="mt-3 pt-2.5 border-t border-navy/10 flex items-center gap-1.5 flex-wrap">
              <Skeleton tone="on-mint" className="h-6 w-24 rounded-full" />
              <Skeleton tone="on-mint" className="h-6 w-24 rounded-full" />
            </div>

            {/* Trailing actions row */}
            <div className="mt-3 pt-2.5 border-t border-navy/10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Skeleton tone="on-mint" className="h-6 w-16 rounded-full" />
                <Skeleton tone="on-mint" className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton tone="on-mint" className="h-4 w-14 rounded-md" />
            </div>
          </div>
        );
      })}
    </div>
  );
});

GroupCardsSkeleton.displayName = 'GroupCardsSkeleton';

/**
 * StudentsScreenSkeleton:
 * Full-page Suspense fallback for StudentsView (preserves Students vs Groups segment layout).
 */
export const StudentsScreenSkeleton: React.FC<{ segment?: 'students' | 'groups' }> = React.memo(
  ({ segment = 'students' }) => {
    const { isRTL } = useTranslation();

    return (
      <div
        aria-busy="true"
        className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 px-5 py-4 space-y-4 pb-32 bg-page"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header row */}
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-7 w-28 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton variant="circular" className="w-10 h-10" />
            <Skeleton variant="circular" className="w-10 h-10" />
          </div>
        </div>

        {/* Segmented control + Add button */}
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-11 flex-1 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full shrink-0" />
        </div>

        {/* Search pill */}
        <div className="h-[52px] bg-page border border-line rounded-full shadow-white flex items-center px-4 gap-3">
          <Skeleton variant="circular" className="w-5 h-5 shrink-0" />
          <Skeleton className="h-3.5 w-48 rounded-md" />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 overflow-hidden">
          <Skeleton className="h-8 w-16 rounded-full shrink-0" />
          <Skeleton className="h-8 w-24 rounded-full shrink-0" />
          <Skeleton className="h-8 w-24 rounded-full shrink-0" />
        </div>

        {segment === 'groups' ? <GroupCardsSkeleton count={3} /> : <StudentCardsSkeleton count={4} />}
      </div>
    );
  }
);

StudentsScreenSkeleton.displayName = 'StudentsScreenSkeleton';

/**
 * SessionsScreenSkeleton:
 * Full-page Suspense fallback for SessionsView (Header + NavyCalendar week strip + SessionTimeline).
 */
export const SessionsScreenSkeleton: React.FC = React.memo(() => {
  const { isRTL } = useTranslation();

  return (
    <div
      aria-busy="true"
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 px-5 py-4 space-y-4 pb-32 bg-page"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-7 w-28 rounded-lg" />
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" className="w-10 h-10" />
          <Skeleton variant="circular" className="w-10 h-10" />
        </div>
      </div>

      {/* NavyCalendar Card placeholder */}
      <NavyCard className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton tone="on-navy" className="h-5 w-32 rounded-md" />
          <div className="flex items-center gap-2">
            <Skeleton tone="on-navy" className="h-8 w-20 rounded-full" />
            <Skeleton tone="on-navy" className="h-8 w-8 rounded-full" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 pt-1">
          {Array.from({ length: 7 }, (_, idx) => (
            <div
              key={idx}
              className="py-2.5 rounded-2xl bg-white/6 flex flex-col items-center gap-2"
            >
              <Skeleton tone="on-navy" className="h-2.5 w-6 rounded-sm" />
              <Skeleton variant="circular" tone="on-navy" className="w-7 h-7" />
            </div>
          ))}
        </div>
      </NavyCard>

      {/* Selected date heading + timeline */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton variant="circular" className="w-8 h-8" />
        </div>
        <SessionTimelineSkeleton count={3} />
      </div>
    </div>
  );
});

SessionsScreenSkeleton.displayName = 'SessionsScreenSkeleton';

/**
 * ReportChartSkeleton:
 * Matches BillingStreamsProgressChart & AttendanceTrendsChart internal structure
 * (control bar + 2x2 summary tiles + h-72 sm:h-80 chart canvas) with ZERO fake numbers.
 */
export const ReportChartSkeleton: React.FC<{ compact?: boolean }> = React.memo(
  ({ compact = false }) => {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-3.5">
        {/* Metric toggle bar */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-8 w-36 rounded-xl" />
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>

        {/* 2x2 indicator tiles */}
        {!compact && (
          <div className="grid grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="bg-mist p-3.5 rounded-2xl border border-line min-h-[82px] flex flex-col justify-between"
              >
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
            ))}
          </div>
        )}

        {/* Chart area matching h-72 sm:h-80 */}
        <div className="h-72 sm:h-80 w-full rounded-2xl bg-mist/60 border border-line p-4 flex flex-col justify-between">
          <div className="space-y-6 flex-1 flex flex-col justify-around">
            <div className="border-b border-dashed border-line w-full" />
            <div className="border-b border-dashed border-line w-full" />
            <div className="border-b border-dashed border-line w-full" />
            <div className="border-b border-line w-full" />
          </div>
          <div className="flex items-center justify-between pt-3 px-2">
            <Skeleton className="h-2.5 w-10 rounded-sm" />
            <Skeleton className="h-2.5 w-10 rounded-sm" />
            <Skeleton className="h-2.5 w-10 rounded-sm" />
            <Skeleton className="h-2.5 w-10 rounded-sm" />
          </div>
        </div>
      </div>
    );
  }
);

ReportChartSkeleton.displayName = 'ReportChartSkeleton';

/**
 * ReportsContentSkeleton:
 * Matches ReportsView.tsx below ScreenHeader when report data is genuinely loading.
 * Uses zero fake values or misleading sample statistics.
 */
export const ReportsContentSkeleton: React.FC = React.memo(() => {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      {/* Top Revenue NavyCard */}
      <NavyCard className="relative">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2.5">
            <Skeleton tone="on-navy" className="h-3.5 w-28 rounded-md" />
            <div className="space-y-2">
              <Skeleton tone="on-navy" className="h-3 w-24 rounded-md" />
              <Skeleton tone="on-navy" className="h-7 w-36 rounded-lg" />
            </div>
            <Skeleton tone="on-navy" className="h-3.5 w-32 rounded-md" />
          </div>
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <RingPlaceholder size={80} stroke={9} />
            <Skeleton tone="on-navy" className="h-2.5 w-16 rounded-sm" />
          </div>
        </div>
      </NavyCard>

      {/* Main SegmentedControl */}
      <Skeleton className="h-11 w-full rounded-full" />

      {/* Period Filter Chips */}
      <div className="flex items-center gap-2 overflow-hidden">
        <Skeleton className="h-8 w-20 rounded-full shrink-0" />
        <Skeleton className="h-8 w-20 rounded-full shrink-0" />
        <Skeleton className="h-8 w-20 rounded-full shrink-0" />
        <Skeleton className="h-8 w-16 rounded-full shrink-0" />
      </div>

      {/* 2x2 KPI MintCards */}
      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((idx) => (
          <MintCard
            key={idx}
            className="flex flex-col justify-between min-h-[104px]"
          >
            <div className="flex items-center justify-between gap-2">
              <Skeleton tone="on-mint" className="h-3.5 w-20 rounded-md" />
              <Skeleton variant="circular" tone="on-mint" className="w-8 h-8 shrink-0" />
            </div>
            <div className="space-y-1.5">
              <Skeleton tone="on-mint" className="h-6 w-24 rounded-md" />
              <Skeleton tone="on-mint" className="h-3 w-16 rounded-md" />
            </div>
          </MintCard>
        ))}
      </div>

      {/* Ledger / Chart Card */}
      <WhiteCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-3.5 w-20 rounded-md" />
        </div>
        <div className="divide-y divide-line">
          {[0, 1, 2].map((rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-3 py-3 items-center gap-3">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <div className="flex justify-end">
                <Skeleton className="h-3.5 w-16 rounded-md" />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-3.5 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </WhiteCard>
    </div>
  );
});

ReportsContentSkeleton.displayName = 'ReportsContentSkeleton';

/**
 * ReportsScreenSkeleton:
 * Full-page Suspense fallback for ReportsView.
 */
export const ReportsScreenSkeleton: React.FC = React.memo(() => {
  const { isRTL } = useTranslation();

  return (
    <div
      aria-busy="true"
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 px-5 py-4 space-y-4 pb-32 bg-page"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-7 w-28 rounded-lg" />
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" className="w-10 h-10" />
          <Skeleton variant="circular" className="w-10 h-10" />
        </div>
      </div>
      <ReportsContentSkeleton />
    </div>
  );
});

ReportsScreenSkeleton.displayName = 'ReportsScreenSkeleton';

/**
 * SettingsSyncStatusSkeleton:
 * Subtle inline placeholder exclusively for asynchronous Cloud Sync / Backup restore state.
 */
export const SettingsSyncStatusSkeleton: React.FC = React.memo(() => (
  <div aria-busy="true" className="pt-1">
    <Skeleton tone="on-mint" className="h-3.5 w-44 max-w-full rounded-md" />
  </div>
));

SettingsSyncStatusSkeleton.displayName = 'SettingsSyncStatusSkeleton';

/**
 * SettingsAsyncFallback:
 * Minimal Suspense fallback for SettingsView that never fakes static form/toggle skeletons;
 * renders only the top title bar and the async Cloud Sync status card placeholder.
 */
export const SettingsAsyncFallback: React.FC = React.memo(() => {
  const { isRTL, language, t } = useTranslation();
  const isEn = language.startsWith('en');

  return (
    <div
      aria-busy="true"
      className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 px-5 py-4 space-y-6 pb-32 bg-page"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <header className="flex items-center justify-between gap-3 pt-1 select-none">
        <h1 className="t-display text-navy">
          {t('settingsTitle') || (isEn ? 'Settings' : 'الإعدادات')}
        </h1>
        <Skeleton className="h-8 w-24 rounded-full" />
      </header>

      <MintCard className="bg-mint-soft p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Skeleton variant="circular" tone="on-mint" className="w-10 h-10 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton tone="on-mint" className="h-4 w-32 rounded-md" />
              <Skeleton tone="on-mint" className="h-3 w-44 max-w-full rounded-md" />
            </div>
          </div>
          <Skeleton tone="on-mint" className="h-9 w-24 rounded-full shrink-0" />
        </div>
      </MintCard>
    </div>
  );
});

SettingsAsyncFallback.displayName = 'SettingsAsyncFallback';

/**
 * LessonStudioRosterSkeleton:
 * Compact, layout-matched placeholder for Lesson Studio student rows ONLY when
 * student roster data is genuinely loading asynchronously.
 */
export const LessonStudioRosterSkeleton: React.FC<{ count?: number }> = React.memo(
  ({ count = 3 }) => (
    <div aria-busy="true" aria-live="polite" className="space-y-2.5">
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={idx}
          className="p-3.5 rounded-2xl bg-page border border-line shadow-sm space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Skeleton variant="circular" className="w-9 h-9 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-28 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-lg" />
              </div>
            </div>
            <Skeleton className="h-7 w-20 rounded-xl shrink-0" />
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
            <Skeleton className="h-10 rounded-[18px]" />
            <Skeleton className="h-10 rounded-[18px]" />
            <Skeleton className="h-10 rounded-[18px]" />
          </div>
        </div>
      ))}
    </div>
  )
);

LessonStudioRosterSkeleton.displayName = 'LessonStudioRosterSkeleton';

/**
 * SheetSuspenseShell:
 * Lightweight visual bottom-sheet shell used ONLY when a lazy detail/studio modal chunk
 * takes >95ms to download over a slow network. Uses no modal-stack side effects.
 */
const SheetSuspenseShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isRTL } = useTranslation();

  return (
    <div
      aria-busy="true"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-navy/35 pointer-events-none"
    >
      <div className="w-full sm:max-w-lg bg-page rounded-t-[var(--radius-sheet)] sm:rounded-[var(--radius-sheet)] border border-line shadow-2xl overflow-hidden max-h-[88dvh] flex flex-col">
        <div className="w-10 h-1 rounded-full bg-line mx-auto mt-3" />
        <div className="px-5 py-3.5 border-b border-line flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Skeleton className="w-10 h-10 rounded-2xl shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-3 w-48 max-w-full rounded-md" />
            </div>
          </div>
          <Skeleton variant="circular" className="w-8 h-8 shrink-0" />
        </div>
        <div className="p-4 space-y-3 overflow-hidden">{children}</div>
      </div>
    </div>
  );
};

export const LessonStudioSheetSkeleton: React.FC = React.memo(() => (
  <SheetSuspenseShell>
    <LessonStudioRosterSkeleton count={3} />
  </SheetSuspenseShell>
));

LessonStudioSheetSkeleton.displayName = 'LessonStudioSheetSkeleton';

export const ProfileSheetSkeleton: React.FC = React.memo(() => (
  <SheetSuspenseShell>
    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-mint-soft border border-line">
      <Skeleton variant="circular" tone="on-mint" className="w-14 h-14 shrink-0" />
      <div className="space-y-2 flex-1">
        <Skeleton tone="on-mint" className="h-4 w-36 rounded-md" />
        <Skeleton tone="on-mint" className="h-3 w-28 rounded-md" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <MintCard className="min-h-[88px] p-3.5 flex flex-col justify-between">
        <Skeleton tone="on-mint" className="h-3 w-20 rounded-md" />
        <Skeleton tone="on-mint" className="h-5 w-20 rounded-md" />
      </MintCard>
      <MintCard className="min-h-[88px] p-3.5 flex flex-col justify-between">
        <Skeleton tone="on-mint" className="h-3 w-20 rounded-md" />
        <Skeleton tone="on-mint" className="h-5 w-20 rounded-md" />
      </MintCard>
    </div>
    <SessionTimelineSkeleton count={2} />
  </SheetSuspenseShell>
));

ProfileSheetSkeleton.displayName = 'ProfileSheetSkeleton';

/**
 * NetworkDiagnosticsSkeleton:
 * Matches NetworkDiagnosticsModal status card + 6 metric tiles during initial live check.
 */
export const NetworkDiagnosticsSkeleton: React.FC = React.memo(() => (
  <div aria-busy="true" className="space-y-4 text-xs">
    <div className="p-4 rounded-2xl border border-line bg-mint-soft flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Skeleton variant="circular" tone="on-mint" className="w-6 h-6 shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton tone="on-mint" className="h-4 w-48 max-w-full rounded-md" />
          <Skeleton tone="on-mint" className="h-3 w-36 max-w-full rounded-md" />
        </div>
      </div>
      <Skeleton tone="on-mint" className="h-6 w-14 rounded-xl shrink-0" />
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {Array.from({ length: 6 }, (_, idx) => (
        <div key={idx} className="p-3 rounded-2xl bg-page border border-line space-y-2">
          <Skeleton className="h-3 w-20 rounded-md" />
          <Skeleton className="h-3.5 w-24 rounded-md" />
        </div>
      ))}
    </div>
  </div>
));

NetworkDiagnosticsSkeleton.displayName = 'NetworkDiagnosticsSkeleton';
