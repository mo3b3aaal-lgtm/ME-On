import {
  Student,
  Group,
  Session,
  Enrollment,
  Attendance,
  SmartReminderItem,
  NotificationSettings,
} from '../types';
import { evaluateNotifications } from './notificationCenter';

export { type SmartReminderItem, type SmartReminderItem as AppNotification } from '../types';

/**
 * Backward-compatible Smart Reminder & Notification Generator
 * Delegates to the centralized user-scoped notification engine in notificationCenter.ts
 */
export function getSmartReminders(
  students: Student[],
  groups: Group[],
  sessions: Session[],
  enrollments: Enrollment[],
  attendanceList: Attendance[],
  includeResolved: boolean = false,
  customSettings?: NotificationSettings,
  lang?: string
): SmartReminderItem[] {
  return evaluateNotifications({
    students,
    groups,
    sessions,
    enrollments,
    attendanceList,
    includeResolved,
    customSettings,
    lang,
  });
}
