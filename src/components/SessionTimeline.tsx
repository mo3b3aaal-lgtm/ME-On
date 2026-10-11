import React, { useMemo, useState, useEffect } from 'react';
import { ScheduledClassItem, parseTimeToMinutes } from '../utils/schedule';
import { Session, Student, Group, Attendance } from '../types';
import { useTranslation } from '../utils/i18n';
import { useCurrentLocalDate } from '../utils/useCurrentLocalDate';
import { StatusBadge } from './ui/StatusBadge';
import { AppIcon } from './ui/AppIcon';
import { Avatar } from './ui/Avatar';
import { MintCard } from './ui/MintCard';
import { EmptyBox } from './illustrations/EmptyBox';
import { db } from '../utils/storage';

export interface SessionTimelineProps {
  items: ScheduledClassItem[];
  sessions?: Session[];
  students?: Student[];
  groups?: Group[];
  allAttendance?: Attendance[];
  selectedDateStr?: string;
  isToday?: boolean;
  onRecordAttendance?: (item: ScheduledClassItem) => void;
  onOpenAttendanceModal?: (session: Session) => void;
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
export const SessionTimeline: React.FC<SessionTimelineProps> = ({
  items,
  students = [],
  groups = [],
  selectedDateStr,
  isToday: controlledIsToday,
  findSessionForScheduleItem,
  onRecordAttendance,
  onOpenAttendanceModal,
  onOpenAddSession,
  className = '',
}) => {
  const { isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');
  const { now, todayStr } = useCurrentLocalDate();

  const isToday = controlledIsToday !== undefined ? controlledIsToday : selectedDateStr === todayStr;

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
            className="btn-soft px-4 py-2 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
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
          ? db.getSessionAttendance(matchingSession.id).length > 0
          : false;

        // Group or student details for trailing avatars
        const isPrivate = item.isPrivate || Boolean(item.studentId);
        const privateStudent = isPrivate
          ? students.find((s) => s.id === item.studentId) || item.student
          : null;

        const groupStudents = !isPrivate && item.groupId
          ? db.getGroupStudents(item.groupId)
          : [];

        const title = isPrivate
          ? item.studentName || privateStudent?.name || (isEn ? 'Private Lesson' : 'درس خاص')
          : item.groupName;

        const startTime = item.time?.split(' - ')[0] || item.rawTime || '';
        const timeRange = item.time || (item.rawTime ? `${item.rawTime}` : '');

        const showNowBeforeThis = isToday && nowIndicatorIndex === index;

        return (
          <React.Fragment key={item.id}>
            {showNowBeforeThis && renderNowLine()}

            <div className="relative flex items-center gap-3 select-none">
              {/* Left column: start times (13px slate) */}
              <div className="w-12 shrink-0 text-center text-[13px] font-medium text-slate">
                {startTime}
              </div>

              {/* Session card in MintCard style */}
              <MintCard
                clickable
                onClick={() => {
                  if (matchingSession) {
                    onOpenAttendanceModal?.(matchingSession);
                  } else if (onRecordAttendance) {
                    onRecordAttendance(item);
                  }
                }}
                className="flex-1 p-3.5 flex items-center justify-between gap-3 min-w-0"
              >
                {/* Content: title .t-card & time range 13px */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.accentColor || 'var(--color-navy)' }}
                    />
                    <h4 className="t-card text-navy font-bold truncate">
                      {title}
                    </h4>
                  </div>

                  <p className="text-[13px] text-slate font-medium truncate">
                    {timeRange}
                    {item.location && <span> • {item.location}</span>}
                  </p>
                </div>

                {/* Trailing: Trailing Avatar(s) 36px & small StatusBadge */}
                <div className="shrink-0 flex items-center gap-2">
                  {/* Trailing Avatar(s) 36px */}
                  {isPrivate ? (
                    <Avatar
                      size={36}
                      name={title}
                      profilePhoto={privateStudent?.profilePhoto}
                      className="shadow-2xs"
                    />
                  ) : groupStudents.length > 0 ? (
                    <div className="flex items-center -space-x-2 rtl:space-x-reverse shrink-0">
                      {groupStudents.slice(0, 3).map((st) => (
                        <Avatar
                          key={st.id}
                          size={36}
                          name={st.name}
                          profilePhoto={st.profilePhoto}
                          className="shadow-2xs"
                        />
                      ))}
                      {groupStudents.length > 3 && (
                        <span className="w-7 h-7 rounded-full bg-page border border-line text-navy text-[11px] font-bold flex items-center justify-center shadow-xs">
                          +{groupStudents.length - 3}
                        </span>
                      )}
                    </div>
                  ) : null}

                  {/* Small StatusBadge if attendance recorded or scheduled */}
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
      {isToday && nowIndicatorIndex === sortedItems.length && renderNowLine()}
    </div>
  );
};

export default SessionTimeline;
