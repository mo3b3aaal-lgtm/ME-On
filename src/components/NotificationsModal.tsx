import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Student,
  Group,
  Session,
  Enrollment,
  Attendance,
  NotificationCategory,
  SmartReminderItem,
} from '../types';
import { db } from '../utils/storage';
import {
  clearNotificationHistoryForUser,
  evaluateNotifications,
  getNotificationRevision,
  normalizeNotificationSettings,
  subscribeToNotifications,
} from '../utils/notificationCenter';
import { useTranslation } from '../utils/i18n';
import { triggerLightHaptic } from '../utils/haptics';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon, type AppIconName } from './ui/AppIcon';
import { StatusBadge } from './ui/StatusBadge';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  groups: Group[];
  sessions: Session[];
  enrollments: Enrollment[];
  allAttendance?: Attendance[];
  onOpenAddPayment: (student: Student, enrollmentId?: string) => void;
  onOpenStudentProfile: (student: Student) => void;
  onOpenAttendanceModal: (session: Session) => void;
  onOpenNotificationTarget?: (item: SmartReminderItem) => void;
  onOpenNotificationSettings?: () => void;
  onDataChanged?: () => void;
}

type FilterChipId =
  | 'all'
  | 'unread'
  | NotificationCategory
  | 'resolved';

const PAGE_SIZE = 25;

function formatNotificationTimestamp(isoString: string | undefined, isEn: boolean): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';

  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) {
    return isEn ? 'Just now' : 'الآن';
  }
  if (diffMin < 60) {
    return isEn ? `${diffMin}m ago` : `منذ ${diffMin} د`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return isEn ? `${diffHours}h ago` : `منذ ${diffHours} س`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return isEn ? `${diffDays}d ago` : `منذ ${diffDays} ي`;
  }

  return d.toLocaleDateString(isEn ? 'en-GB' : 'ar-EG', {
    month: 'short',
    day: 'numeric',
  });
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  students,
  groups,
  sessions,
  enrollments,
  allAttendance,
  onOpenAddPayment,
  onOpenStudentProfile,
  onOpenAttendanceModal,
  onOpenNotificationTarget,
  onOpenNotificationSettings,
  onDataChanged,
}) => {
  const { t, language } = useTranslation();
  const isEn = language.startsWith('en');

  const [activeFilter, setActiveFilter] = useState<FilterChipId>('all');
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_SIZE);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);
  const [notifRev, setNotifRev] = useState<number>(() => getNotificationRevision());
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setConfirmClear(false);
      setVisibleLimit(PAGE_SIZE);
      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
        setFeedback(null);
      }
      return;
    }

    setNotifRev(getNotificationRevision());
    const unsub = subscribeToNotifications(() => {
      setNotifRev(getNotificationRevision());
    });

    return () => {
      unsub();
      if (feedbackTimerRef.current !== null) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, [isOpen]);

  const settings = useMemo(
    () => normalizeNotificationSettings(db.getNotificationSettings()),
    [notifRev, isOpen]
  );

  // Evaluate all notifications (active + resolved/dismissed)
  const allNotifications = useMemo(() => {
    if (!isOpen) return [];
    const attList = allAttendance ?? db.getAttendance();
    return evaluateNotifications({
      students,
      groups,
      sessions,
      enrollments,
      attendanceList: attList,
      includeResolved: true,
      lang: language,
    });
  }, [students, groups, sessions, enrollments, allAttendance, isOpen, notifRev, language]);

  if (!isOpen) return null;

  const activeItems = allNotifications.filter((n) => n.status === 'active');
  const activeCount = activeItems.length;
  const unreadCount = activeItems.filter((n) => !n.isRead).length;
  const resolvedItemsCount = allNotifications.filter(
    (n) => n.status === 'resolved' || n.status === 'dismissed'
  ).length;

  const countByCategory = (cat: NotificationCategory) =>
    activeItems.filter((n) => n.category === cat).length;

  const filterChips: { id: FilterChipId; label: string; count: number }[] = [
    { id: 'all', label: isEn ? 'Active' : 'النشطة', count: activeCount },
    ...(unreadCount > 0
      ? [{ id: 'unread' as FilterChipId, label: isEn ? 'Unread' : 'غير مقروءة', count: unreadCount }]
      : []),
    {
      id: 'lesson_reminders',
      label: isEn ? 'Lessons' : 'الحصص',
      count: countByCategory('lesson_reminders'),
    },
    {
      id: 'attendance',
      label: isEn ? 'Attendance' : 'الحضور',
      count: countByCategory('attendance'),
    },
    {
      id: 'financial',
      label: isEn ? 'Financial' : 'المالية',
      count: countByCategory('financial'),
    },
    {
      id: 'packages',
      label: isEn ? 'Packages' : 'الباقات',
      count: countByCategory('packages'),
    },
    {
      id: 'follow_ups',
      label: isEn ? 'Follow-ups' : 'المتابعة',
      count: countByCategory('follow_ups'),
    },
    {
      id: 'sync_backup',
      label: isEn ? 'Sync' : 'المزامنة',
      count: countByCategory('sync_backup'),
    },
    ...(countByCategory('system') > 0
      ? [{ id: 'system' as FilterChipId, label: isEn ? 'System' : 'النظام', count: countByCategory('system') }]
      : []),
    {
      id: 'resolved',
      label: isEn ? 'History' : 'السجل المكتمل',
      count: resolvedItemsCount,
    },
  ];

  const filteredNotifications = allNotifications.filter((item) => {
    if (activeFilter === 'all') {
      return item.status === 'active';
    }
    if (activeFilter === 'unread') {
      return item.status === 'active' && !item.isRead;
    }
    if (activeFilter === 'resolved') {
      return item.status === 'resolved' || item.status === 'dismissed';
    }
    return item.status === 'active' && item.category === activeFilter;
  });

  const paginatedNotifications = filteredNotifications.slice(0, visibleLimit);
  const hasMore = filteredNotifications.length > visibleLimit;

  const showInlineFeedback = (msg: string) => {
    if (feedbackTimerRef.current !== null) {
      clearTimeout(feedbackTimerRef.current);
    }
    setFeedback(msg);
    feedbackTimerRef.current = setTimeout(() => {
      feedbackTimerRef.current = null;
      setFeedback(null);
    }, 3000);
  };

  const handleToggleRead = (e: React.MouseEvent, item: SmartReminderItem) => {
    e.stopPropagation();
    triggerLightHaptic();
    db.markNotificationAsRead(item.id);
    onDataChanged?.();
  };

  const handleMarkAllRead = () => {
    triggerLightHaptic();
    const activeUnreadIds = activeItems.filter((n) => !n.isRead).map((n) => n.id);
    if (activeUnreadIds.length > 0) {
      db.markAllNotificationsAsRead(activeUnreadIds);
      showInlineFeedback(
        isEn ? 'All notifications marked as read.' : 'تم تحديد جميع التنبيهات كمقروءة.'
      );
      onDataChanged?.();
    }
  };

  const handleDismiss = (e: React.MouseEvent, item: SmartReminderItem) => {
    e.stopPropagation();
    triggerLightHaptic();
    db.dismissNotification(item.id);
    showInlineFeedback(isEn ? 'Notification dismissed.' : 'تم إخفاء التنبيه.');
    onDataChanged?.();
  };

  const handleConfirmClearHistory = () => {
    triggerLightHaptic();
    clearNotificationHistoryForUser();
    setConfirmClear(false);
    showInlineFeedback(isEn ? 'Notification history cleared.' : 'تم مسح سجل الإشعارات.');
    onDataChanged?.();
  };

  const handleNavigateItem = (item: SmartReminderItem) => {
    triggerLightHaptic();
    if (!item.isRead && item.status === 'active') {
      db.markNotificationAsRead(item.id);
    }

    if (onOpenNotificationTarget) {
      onClose();
      onOpenNotificationTarget(item);
      return;
    }

    // Legacy fallback handlers if parent didn't pass centralized router
    if (item.actionType === 'add_payment' && item.studentId) {
      const student = students.find((s) => s.id === item.studentId);
      if (student) {
        onClose();
        onOpenAddPayment(student, item.enrollmentId);
        return;
      }
    }
    if (item.actionType === 'record_attendance' && item.sessionId) {
      const sess = sessions.find((s) => s.id === item.sessionId);
      if (sess) {
        onClose();
        onOpenAttendanceModal(sess);
        return;
      }
    }
    if (item.studentId) {
      const student = students.find((s) => s.id === item.studentId);
      if (student) {
        onClose();
        onOpenStudentProfile(student);
      }
    }
  };

  const getWhatsAppUrl = (item: SmartReminderItem) => {
    const phone = item.parentPhone || item.studentPhone;
    if (!phone) return null;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return null;

    let msg = '';
    if (isEn) {
      if (item.type === 'package_completed' || item.type === 'finished_package') {
        msg = `Hello, this is a reminder that (${item.studentName}) has completed the allocated session package (${item.packageSize || 8} sessions). Please settle the subscription to renew. Thank you.`;
      } else if (item.type === 'package_almost_due' || item.type === 'package_one_remaining') {
        msg = `Hello, this is a reminder that (${item.studentName}) has ${item.lessonsRemaining === 1 ? '1 session' : `${item.lessonsRemaining} sessions`} remaining in the current package. Best regards.`;
      } else if (
        item.type === 'payment_overdue' ||
        item.type === 'balance_threshold_exceeded' ||
        item.type === 'today_lesson_debt'
      ) {
        msg = `Hello, this is a friendly reminder regarding the outstanding balance for (${item.studentName}) of ${item.amount || 0} ${t('currency')}. Thank you.`;
      } else if (item.type === 'repeated_absence' || item.type === 'student_absent') {
        msg = `Hello, checking in regarding (${item.studentName}) following the recent missed lesson. We hope everything is well.`;
      } else {
        msg = `Hello, regarding student (${item.studentName}).`;
      }
    } else {
      if (item.type === 'package_completed' || item.type === 'finished_package') {
        msg = `السلام عليكم ورحمة الله، نود إحاطتكم علماً بأن الطالب/ة (${item.studentName}) قد أتم بحمد الله باقة الحصص المحددة (${item.packageSize || 8} حصص). يرجى التكرم بسداد قيمة الاشتراك لتجديد الباقة ومتابعة الحصص القادمة. شكراً لتعاونكم.`;
      } else if (item.type === 'package_almost_due' || item.type === 'package_one_remaining') {
        msg = `السلام عليكم ورحمة الله، نود إحاطتكم علماً بأن الطالب/ة (${item.studentName}) متبقي له ${item.lessonsRemaining === 1 ? 'حصة واحدة' : `${item.lessonsRemaining} حصص`} على اكتمال الباقة الحالية. تحياتنا لكم.`;
      } else if (
        item.type === 'payment_overdue' ||
        item.type === 'balance_threshold_exceeded' ||
        item.type === 'today_lesson_debt'
      ) {
        msg = `السلام عليكم ورحمة الله، تذكير ودي بشأن المصروفات الدراسية المستحقة للطالب/ة (${item.studentName}) بمبلغ ${item.amount || 0} ${t('currency')}. شكراً لتعاونكم.`;
      } else if (item.type === 'repeated_absence' || item.type === 'student_absent') {
        msg = `السلام عليكم ورحمة الله، نود الاطمئنان على الطالب/ة (${item.studentName}) نظراً لتغيبه عن الحصة الدراسية. نتمنى له دوام التوفيق والسلامة.`;
      } else {
        msg = `السلام عليكم ورحمة الله، تحياتنا بخصوص الطالب/ة (${item.studentName}).`;
      }
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  const getItemIcon = (item: SmartReminderItem): AppIconName => {
    switch (item.type) {
      case 'upcoming_class':
      case 'day_of_lesson_summary':
        return 'clock';
      case 'package_completed':
      case 'finished_package':
      case 'payment_overdue':
      case 'balance_threshold_exceeded':
      case 'today_lesson_debt':
      case 'payment_recorded':
        return 'coins';
      case 'package_almost_due':
      case 'package_one_remaining':
      case 'low_credit':
        return 'receipt';
      case 'unrecorded_attendance':
      case 'post_lesson_completion':
        return 'calendarCheck';
      case 'student_absent':
      case 'repeated_absence':
        return 'warning';
      case 'financial_follow_up':
      case 'incomplete_record':
        return 'fileText';
      case 'sync_failed':
        return 'wifiOff';
      case 'sync_restored':
      case 'backup_completed':
        return 'cloudCheck';
      case 'backup_failed':
      case 'restore_failed':
      case 'permission_denied':
        return 'shieldWarning';
      default:
        return 'bell';
    }
  };

  const getPrimaryActionLabel = (item: SmartReminderItem): { label: string; icon: AppIconName } | null => {
    if (item.status === 'resolved') return null;
    switch (item.actionType) {
      case 'add_payment':
        return { label: t('recordPayment'), icon: 'coins' };
      case 'open_private_session':
        return {
          label: isEn ? 'Record Private Lesson' : 'تسجيل الدرس الخاص',
          icon: 'calendarCheck',
        };
      case 'record_attendance':
        return {
          label: isEn ? 'Take Attendance' : 'رصد الحضور',
          icon: 'calendarCheck',
        };
      case 'open_permissions':
        return {
          label: isEn ? 'Enable Permission' : 'تفعيل الصلاحية',
          icon: 'shieldCheck',
        };
      case 'open_settings':
        return {
          label: isEn ? 'Open Settings' : 'فتح الإعدادات',
          icon: 'settings',
        };
      case 'open_session':
        return {
          label: isEn ? 'Open Schedule' : 'فتح الحصص',
          icon: 'sessions',
        };
      default:
        return null;
    }
  };

  return (
    <BottomSheet
      id="notifications"
      isOpen={isOpen}
      onClose={onClose}
      title={t('notifCenterTitle')}
      subtitle={t('notifCenterSubtitle')}
      headerLeading={
        <div className="w-10 h-10 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line">
          <AppIcon name="bell" size={20} weight="duotone" />
        </div>
      }
      headerTrailing={
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange text-white shadow-2xs">
              {unreadCount} {isEn ? 'new' : 'جديد'}
            </span>
          )}
          {onOpenNotificationSettings && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNotificationSettings();
              }}
              aria-label={t('navSettings')}
              title={t('navSettings')}
              className="w-8 h-8 rounded-xl bg-mint-soft text-navy flex items-center justify-center hover:bg-mint transition-colors cursor-pointer"
            >
              <AppIcon name="settings" size={16} weight="duotone" />
            </button>
          )}
        </div>
      }
      bodyClassName="p-0"
      maxWidthClass="sm:max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate font-bold">
              {isEn
                ? `${activeCount} active · ${resolvedItemsCount} history`
                : `${activeCount} نشط · ${resolvedItemsCount} بالسجل`}
            </span>

            {allNotifications.length > 0 && !confirmClear && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="text-[11px] font-bold text-coral hover:underline cursor-pointer px-1.5"
              >
                {isEn ? 'Clear History' : 'مسح السجل'}
              </button>
            )}

            {confirmClear && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleConfirmClearHistory}
                  className="px-2.5 py-1 rounded-lg bg-coral text-white text-[11px] font-bold cursor-pointer"
                >
                  {isEn ? 'Confirm' : 'تأكيد'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1 rounded-lg bg-mint-soft text-navy text-[11px] font-bold cursor-pointer"
                >
                  {t('cancel')}
                </button>
              </div>
            )}
          </div>

          <button type="button" onClick={onClose} className="btn-soft px-5 py-2 text-xs">
            {t('close')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col h-full">
        {/* Quick Feedback Banner */}
        {feedback && (
          <div className="px-4 py-2 bg-mint-soft text-navy text-xs font-bold border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AppIcon name="checkCircle" size={16} weight="fill" className="text-navy" />
              <span>{feedback}</span>
            </div>
          </div>
        )}

        {/* Filter Chips & Mark All Read */}
        <div className="p-3 border-b border-line space-y-2 shrink-0 bg-page">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
              {filterChips.map((chip) => {
                const isSelected = activeFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setActiveFilter(chip.id);
                      setVisibleLimit(PAGE_SIZE);
                    }}
                    className={`chip shrink-0 ${isSelected ? 'chip-active' : ''}`}
                  >
                    <span>{chip.label}</span>
                    {chip.count > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-mint-soft text-navy'
                        }`}
                      >
                        {chip.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {unreadCount > 0 && activeFilter !== 'resolved' && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-black text-navy hover:underline flex items-center gap-1 shrink-0 cursor-pointer ps-1"
              >
                <AppIcon name="checkAll" size={14} weight="duotone" />
                <span>{isEn ? 'Read all' : 'قراءة الكل'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {!settings.enableNotifications || !settings.enableInAppNotifications ? (
            <div className="text-center py-12 space-y-3 bg-page rounded-3xl border border-line p-6">
              <div className="w-14 h-14 rounded-2xl bg-mint-soft text-navy flex items-center justify-center mx-auto border border-line">
                <AppIcon name="bell" size={28} weight="duotone" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-navy">
                  {isEn ? 'In-App Notifications Paused' : 'تنبيهات داخل التطبيق متوقفة حالياً'}
                </h3>
                <p className="text-xs text-slate max-w-sm mx-auto font-medium leading-relaxed">
                  {isEn
                    ? 'You can re-enable notifications anytime from Settings.'
                    : 'يمكنك إعادة تفعيل الإشعارات في أي وقت من شاشة الإعدادات.'}
                </p>
              </div>
              {onOpenNotificationSettings && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenNotificationSettings();
                  }}
                  className="btn-navy px-4 py-2 text-xs mx-auto"
                >
                  {isEn ? 'Notification Settings' : 'إعدادات الإشعارات'}
                </button>
              )}
            </div>
          ) : paginatedNotifications.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-page rounded-3xl border border-line p-6">
              <div className="w-14 h-14 rounded-2xl bg-mint-soft text-navy flex items-center justify-center mx-auto border border-line">
                <AppIcon name="checkCircle" size={28} weight="duotone" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-navy">
                  {activeFilter === 'resolved'
                    ? (isEn ? 'No completed history items yet' : 'لا توجد إشعارات مكتملة أو مؤرشفة بعد')
                    : (isEn ? 'All Caught Up!' : 'كل شيء منظم ومحدث!')}
                </h3>
                <p className="text-xs text-slate max-w-sm mx-auto font-medium leading-relaxed">
                  {activeFilter === 'resolved'
                    ? (isEn
                        ? 'Settled packages, resolved alerts, and dismissed items will appear here.'
                        : 'ستظهر هنا الباقات المسددة والتنبيهات المكتملة أو المخفاة.')
                    : (isEn
                        ? 'No pending alerts in this category right now.'
                        : 'لا توجد تنبيهات معلقة في هذا القسم حالياً.')}
                </p>
              </div>
            </div>
          ) : (
            <>
              {paginatedNotifications.map((item) => {
                const targetStudent = item.studentId
                  ? students.find((s) => s.id === item.studentId)
                  : null;
                const isResolved = item.status === 'resolved';
                const isDismissed = item.status === 'dismissed';
                const isUrgent =
                  (item.priority === 'critical' || item.priority === 'high') && !isResolved;
                const isAlmostDue =
                  item.type === 'package_almost_due' || item.type === 'one_session_remaining';
                const isUnread = !item.isRead && !isResolved && !isDismissed;
                const waUrl = getWhatsAppUrl(item);
                const iconName = getItemIcon(item);
                const primaryAction = getPrimaryActionLabel(item);
                const relativeTime = formatNotificationTimestamp(item.createdAt, isEn);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNavigateItem(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNavigateItem(item);
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all space-y-2.5 relative cursor-pointer ${
                      isResolved
                        ? 'bg-mist border-line opacity-85'
                        : isDismissed
                        ? 'bg-page border-line opacity-75'
                        : isUrgent
                        ? 'bg-coral-soft/40 border-coral/30 shadow-2xs hover:border-coral/50'
                        : isAlmostDue
                        ? 'bg-mint-soft/50 border-mint shadow-2xs hover:border-navy/30'
                        : 'bg-page border-line shadow-2xs hover:border-navy/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line relative">
                          <AppIcon name={iconName} size={20} weight="duotone" />
                          {isUnread && (
                            <span
                              className="absolute -top-0.5 -end-0.5 w-2.5 h-2.5 rounded-full bg-orange ring-2 ring-page"
                              title={isEn ? 'Unread' : 'غير مقروء'}
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 text-start">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4
                              className={`text-xs sm:text-sm font-black text-navy ${
                                isResolved ? 'line-through opacity-75' : ''
                              }`}
                            >
                              {item.title}
                            </h4>
                            <StatusBadge
                              status={
                                isResolved
                                  ? 'resolved'
                                  : isUrgent
                                  ? 'overdue'
                                  : isAlmostDue
                                  ? 'package_nearly_used'
                                  : 'pending'
                              }
                              label={item.badge}
                            />
                          </div>

                          <p className="text-xs text-slate font-medium mt-1 leading-relaxed">
                            {item.description}
                          </p>

                          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate flex-wrap">
                            {item.isPrivate ? (
                              <span className="font-bold text-navy">
                                {isEn ? 'Private Lesson' : 'درس خاص'}
                              </span>
                            ) : item.groupName ? (
                              <span className="font-bold text-navy">{item.groupName}</span>
                            ) : null}

                            {item.date && <span className="t-meta text-slate">{item.date}</span>}
                            {relativeTime && (
                              <span className="text-[10px] text-slate/80 font-semibold">
                                • {relativeTime}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleToggleRead(e, item)}
                          className="p-1.5 rounded-xl hover:bg-mint-soft text-slate hover:text-navy transition-all cursor-pointer"
                          title={
                            item.isRead
                              ? (isEn ? 'Mark as unread' : 'تحديد كغير مقروء')
                              : (isEn ? 'Mark as read' : 'تحديد كمقروء')
                          }
                        >
                          <AppIcon name="check" size={14} weight="regular" />
                        </button>
                        {!isResolved && !isDismissed && (
                          <button
                            type="button"
                            onClick={(e) => handleDismiss(e, item)}
                            className="p-1.5 rounded-xl hover:bg-coral-soft text-slate hover:text-coral transition-all cursor-pointer"
                            title={isEn ? 'Dismiss notification' : 'إخفاء التنبيه'}
                          >
                            <AppIcon name="archive" size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action Bar */}
                    {(targetStudent || waUrl || primaryAction) && (
                      <div className="pt-2 border-t border-line flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          {targetStudent && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                                onOpenStudentProfile(targetStudent);
                              }}
                              className="btn-soft px-3 py-1 text-[11px]"
                            >
                              {isEn ? 'Profile' : 'الملف الشخصي'}
                            </button>
                          )}

                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="btn-soft px-3 py-1 text-[11px] flex items-center gap-1"
                            >
                              <AppIcon name="message" size={13} />
                              <span>{isEn ? 'WhatsApp' : 'واتساب'}</span>
                            </a>
                          )}
                        </div>

                        {primaryAction && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavigateItem(item);
                            }}
                            className="btn-orange px-3.5 py-1 text-[11px] flex items-center gap-1"
                          >
                            <AppIcon name={primaryAction.icon} size={13} weight="fill" />
                            <span>{primaryAction.label}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {hasMore && (
                <button
                  type="button"
                  onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                  className="btn-soft w-full py-2.5 text-xs font-bold"
                >
                  {isEn
                    ? `Show More (${filteredNotifications.length - visibleLimit} remaining)`
                    : `عرض المزيد (متبقي ${filteredNotifications.length - visibleLimit})`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
