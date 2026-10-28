import React, { useMemo, useState, useEffect } from 'react';
import { ScheduledClassItem, parseTimeToMinutes } from '../utils/schedule';
import { Session, Student, Group, Attendance } from '../types';
import { useTranslation } from '../utils/i18n';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import { StatusBadge } from './ui/StatusBadge';
import { AppIcon } from './ui/AppIcon';
import { StudentAvatar } from './StudentAvatar';
import { MintCard } from './ui/MintCard';
import { EmptyBox } from './illustrations/EmptyBox';
import { db } from '../utils/storage';
import { getStudentFrameCardTheme, FrameCornerWatermark } from '../utils/frameTheme';
import { getStudentProgression } from '../utils/studentProgression';
import { useDelayedLoading } from './ui/Skeleton';
import { SessionTimelineSkeleton } from './skeletons/ClassySkeletons';

export interface SessionTimelineProps {
  items: ScheduledClassItem[];
  sessions?: Session[];
  students?: Student[];
  groups?: Group[];
  allAttendance?: Attendance[];
  selectedDateStr?: string;
  isToday?: boolean;
  isLoading?: boolean;
  onRecordAttendance?: (item: ScheduledClassItem) => void;
  onOpenAttendanceModal?: (session: Session) => void;
  onTapSession?: (item: ScheduledClassItem, matchingSession?: Session) => void;
  onOpenStudentProfile?: (student: Student) => void;
  onOpenGroupProfile?: (group: Group) => void;
  onOpenAddSession?: (defaultGroupId?: string, defaultDate?: string) => void;
  findSessionForScheduleItem: (item: ScheduledClassItem) => Session | undefined;
  className?: string;
}

/**
 * SessionTimeline:
 * Left column with start times (13px slate), session cards in MintCard style
 * (title .t-card, time range 13px, trailing Avatar(s) 36px, small StatusBadge if attendance recorded).
 * For TODAY only: an orange 2px line across the list positioned between sessions according to current time,
 * starting with a hollow 10px circle (2px orange border, white fill), updated every minute.
 * Empty day: EmptyBox illustration + one line + btn-soft "Add session".
 */
const EMPTY_STUDENTS: Student[] = [];
const EMPTY_GROUPS: Group[] = [];

const SessionTimelineComponent: React.FC<SessionTimelineProps> = ({
  items,
  students = EMPTY_STUDENTS,
  groups = EMPTY_GROUPS,
  allAttendance = [],
  selectedDateStr,
  isToday: controlledIsToday,
  isLoading = false,
  findSessionForScheduleItem,
  onRecordAttendance,
  onOpenAttendanceModal,
  onTapSession,
  onOpenStudentProfile,
  onOpenGroupProfile,
  onOpenAddSession,
  className = '',
}) => {
  const { isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
  const { now, todayStr } = useCurrentLocalDate();

  const isToday = controlledIsToday !== undefined ? controlledIsToday : selectedDateStr === todayStr;

  // Memoized student map for O(1) in-memory lookups without hitting synchronous storage repeatedly
  const studentsMap = useMemo(() => {
    const map = new Map<string, Student>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const effectiveDateStr = selectedDateStr || todayStr;

  // Memoized group students map for fast in-memory lookups on the target date
  const groupStudentsMap = useMemo(() => {
    const map = new Map<string, Student[]>();
    groups.forEach((g) => {
      map.set(g.id, db.getGroupStudents(g.id, effectiveDateStr));
    });
    return map;
  }, [groups, students, effectiveDateStr]);

  // Current time in minutes for "Now" line positioning, updated every minute
  const [currentMinutes, setCurrentMinutes] = useState(() => {
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    if (!isToday) return;
    const updateTime = () => {
      const d = new Date();
      setCurrentMinutes(d.getHours() * 60 + d.getMinutes());
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [isToday, now]);

  // Sort items chronologically
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const minA = a.sortMinutes !== undefined ? a.sortMinutes : parseTimeToMinutes(a.rawTime || a.time);
      const minB = b.sortMinutes !== undefined ? b.sortMinutes : parseTimeToMinutes(b.rawTime || b.time);
      return minA - minB;
    });
  }, [items]);

  // Determine where the orange "Now" line should appear
  const nowIndicatorIndex = useMemo(() => {
    if (!isToday) return -1;
    for (let i = 0; i < sortedItems.length; i++) {
      const it = sortedItems[i];
      const itMinutes = it.sortMinutes !== undefined ? it.sortMinutes : parseTimeToMinutes(it.rawTime || it.time);
      if (currentMinutes < itMinutes) {
        return i;
      }
    }
    return sortedItems.length;
  }, [isToday, sortedItems, currentMinutes]);

  const showSkeleton = useDelayedLoading(Boolean(isLoading) && sortedItems.length === 0, 90);

  if (showSkeleton) {
    return <SessionTimelineSkeleton count={3} className={className} />;
  }

  // Empty state
  if (sortedItems.length === 0) {
    return (
      <div
        className={`bg-page border border-line rounded-[var(--radius-card)] p-8 flex flex-col items-center text-center space-y-3 relative overflow-hidden shadow-xs ${className}`.trim()}
      >
        <div className="w-28 h-20 flex items-center justify-center">
          <EmptyBox className="w-full h-full object-contain" />
        </div>
        <p className="text-sm font-semibold text-slate">
          {isEn ? 'No sessions scheduled for this day' : 'لا توجد حصص مجدولة لهذا اليوم'}
        </p>
        {onOpenAddSession && (
          <button
            type="button"
            onClick={() => onOpenAddSession(undefined, selectedDateStr || todayStr)}
            className="btn-orange px-4 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
          >
            <AppIcon name="plus" weight="bold" size={14} />
            <span>{isEn ? 'Add session' : 'إضافة حصة'}</span>
          </button>
        )}
      </div>
    );
  }

  const renderNowLine = () => (
    <div className="relative flex items-center my-1 select-none pointer-events-none">
      <div className="w-12 shrink-0 flex items-center justify-end pe-1">
        {/* Hollow 10px circle: 2px orange border, white fill */}
        <div className="w-2.5 h-2.5 rounded-full border-2 border-orange bg-page shrink-0 z-10" />
      </div>
      {/* Orange 2px line across the list */}
      <div className="flex-1 h-[2px] bg-orange ms-2" />
    </div>
  );

  return (
    <div className={`space-y-3 ${className}`.trim()} dir={isRTL ? 'rtl' : 'ltr'}>
      {sortedItems.map((item, index) => {
        const matchingSession = findSessionForScheduleItem(item);
        const isCompleted = matchingSession?.status === 'completed';
        const isCancelled = matchingSession?.status === 'cancelled';
        const hasAttendance = matchingSession
          ? (allAttendance && allAttendance.length > 0
              ? allAttendance.some((a) => a.sessionId === matchingSession.id)
              : db.getSessionAttendance(matchingSession.id).length > 0)
          : false;

        // Group or student details for trailing avatars
        const effectiveStudentId = item.studentId || matchingSession?.studentId || '';
        const isPrivate = item.isPrivate || Boolean(effectiveStudentId);
        const privateStudent = isPrivate
          ? (effectiveStudentId
              ? (studentsMap.get(effectiveStudentId) || item.student || db.getStudentById(effectiveStudentId))
              : null) || item.student
          : null;

        // Subtle frame-inspired card theme & live progression derived from student's level and behavior
        const privateProgression = isPrivate && privateStudent
          ? getStudentProgression(privateStudent)
          : null;
        const frameTheme = isPrivate && privateStudent
          ? getStudentFrameCardTheme(privateStudent)
          : null;

        const groupStudents = !isPrivate && item.groupId
          ? (groupStudentsMap.get(item.groupId) || db.getGroupStudents(item.groupId, effectiveDateStr))
          : [];

        const title = isPrivate
          ? item.studentName || privateStudent?.name || (isEn ? 'Private Lesson' : 'درس خاص')
          : item.groupName;

        const startTime = item.time?.split(' - ')[0] || item.rawTime || '';
        const timeRange = item.time || (item.rawTime ? `${item.rawTime}` : '');

        const showNowBeforeThis = isToday && nowIndicatorIndex === index;
        const isStaggerEnabled = sortedItems.length <= 50;
        const staggerDelay = isStaggerEnabled && index < 8 ? `${index * 18}ms` : undefined;

        return (
          <React.Fragment key={item.id}>
            {showNowBeforeThis && (
              <div key={`now-${item.id}`} className="w-full">
                {renderNowLine()}
              </div>
            )}

            <div key={`row-${item.id}`} className="relative flex items-center gap-3 select-none">
              {/* Left column: start times (13px slate) */}
              <div className="w-12 shrink-0 text-center text-[13px] font-medium text-slate">
                {startTime}
              </div>

              {/* Session card in MintCard style */}
              <MintCard
                key={item.id}
                clickable
                style={{ animationDelay: staggerDelay }}
                onClick={() => {
                  if (onTapSession) {
                    onTapSession(item, matchingSession);
                  } else if (isPrivate) {
                    onRecordAttendance?.(item);
                  } else if (matchingSession) {
                    onOpenAttendanceModal?.(matchingSession);
                  } else if (onRecordAttendance) {
                    onRecordAttendance(item);
                  }
                }}
                className={`flex-1 min-h-[64px] p-3.5 flex items-center justify-between gap-3 min-w-0 group cursor-pointer relative overflow-hidden transition-all duration-150 ${
                  isStaggerEnabled ? 'animate-tile-stagger' : ''
                } ${
                  frameTheme
                    ? `${frameTheme.cardBgClass} ${frameTheme.cardBorderClass}`
                    : 'border border-transparent shadow-mint'
                }`}
              >
                {/* Subtle frame corner watermark */}
                {frameTheme && (
                  <FrameCornerWatermark patternType={frameTheme.patternType} />
                )}

                {/* Content: Student Avatar beside title & time range */}
                <div className="relative z-10 flex items-center gap-3 min-w-0 flex-1">
                  {/* Student Avatar with selected achievement frame (beside student name) */}
                  {isPrivate ? (
                    <div
                      className="shrink-0 transition-transform duration-300 group-hover:scale-108 hover:scale-115 cursor-pointer gaming-frame-interactive"
                      onClick={(e) => {
                        if (privateStudent && onOpenStudentProfile) {
                          e.stopPropagation();
                          onOpenStudentProfile(privateStudent);
                        }
                      }}
                      title={privateStudent?.name || title}
                    >
                      <StudentAvatar
                        student={privateStudent}
                        name={privateStudent?.name || item.studentName || title}
                        profilePhoto={privateStudent?.profilePhoto}
                        avatarColor={privateStudent?.avatarColor}
                        size="sm"
                        showFrame={true}
                        className="shrink-0"
                      />
                    </div>
                  ) : groupStudents.length > 0 ? (
                    <div className="flex items-center -space-x-2 rtl:space-x-reverse shrink-0">
                      {groupStudents.slice(0, 3).map((st) => (
                        <div
                          key={st.id}
                          className="transition-transform duration-300 group-hover:scale-108 hover:scale-115 cursor-pointer gaming-frame-interactive"
                          onClick={(e) => {
                            if (onOpenStudentProfile) {
                              e.stopPropagation();
                              onOpenStudentProfile(st);
                            }
                          }}
                          title={st.name}
                        >
                          <StudentAvatar
                            student={st}
                            size="sm"
                            showFrame={true}
                            className="shrink-0"
                          />
                        </div>
                      ))}
                      {groupStudents.length > 3 && (
                        <span className="w-7 h-7 rounded-full bg-page border border-line text-navy text-[11px] font-bold flex items-center justify-center shadow-xs tabular-nums">
                          +{groupStudents.length - 3}
                        </span>
                      )}
                    </div>
                  ) : null}

                  {/* Title & Time Range */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <h4 className="t-card text-navy font-bold truncate">
                        {title}
                      </h4>
                    </div>

                    <p className="text-[13px] text-slate font-medium truncate tabular-nums">
                      {timeRange}
                      {privateProgression && (
                        <span>
                          {' · '}
                          {isEn
                            ? privateProgression.frameDef.shortLabelEn
                            : privateProgression.frameDef.shortLabelAr}
                        </span>
                      )}
                      {item.location && <span> · {item.location}</span>}
                    </p>
                  </div>
                </div>

                {/* Trailing: Small StatusBadge if attendance recorded or scheduled */}
                <div className="relative z-10 shrink-0 flex items-center gap-2">
                  {(hasAttendance || isCompleted || isCancelled) && (
                    <StatusBadge
                      status={isCompleted ? 'completed' : isCancelled ? 'cancelled' : 'scheduled'}
                      label={
                        isCompleted
                          ? (isEn ? 'Completed' : 'مكتملة')
                          : isCancelled
                          ? (isEn ? 'Cancelled' : 'ملغاة')
                          : (isEn ? 'Recorded' : 'مسجلة')
                      }
                    />
                  )}
                </div>
              </MintCard>
            </div>
          </React.Fragment>
        );
      })}

      {/* If "Now" is after all sessions today */}
      {isToday && nowIndicatorIndex === sortedItems.length && (
        <div key="now-line-end" className="w-full">
          {renderNowLine()}
        </div>
      )}
    </div>
  );
};

export const SessionTimeline = React.memo(SessionTimelineComponent);
export default SessionTimeline;
