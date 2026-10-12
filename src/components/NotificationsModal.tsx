import React, { useState, useMemo } from 'react';
import {
  Student,
  Group,
  Session,
  Enrollment,
  SmartReminderItem,
} from '../types';
import { db } from '../utils/storage';
import { getSmartReminders } from '../utils/reminders';
import { useTranslation } from '../utils/i18n';
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
  onOpenAddPayment: (student: Student, enrollmentId?: string) => void;
  onOpenStudentProfile: (student: Student) => void;
  onOpenAttendanceModal: (session: Session) => void;
  onDataChanged?: () => void;
}

type TabType = 'active' | 'packages' | 'attendance' | 'resolved';

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  students,
  groups,
  sessions,
  enrollments,
  onOpenAddPayment,
  onOpenStudentProfile,
  onOpenAttendanceModal,
  onDataChanged,
}) => {
  const { t, isRTL, language } = useTranslation();
  const isEn = language.startsWith('en');

  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Compute all notifications (active + resolved)
  const allNotifications = useMemo(() => {
    const attList = db.getAttendance();
    return getSmartReminders(students, groups, sessions, enrollments, attList, true);
  }, [students, groups, sessions, enrollments, isOpen]);

  if (!isOpen) return null;

  const activeCount = allNotifications.filter((n) => n.status === 'active').length;
  const unreadCount = allNotifications.filter((n) => n.status === 'active' && !n.isRead).length;

  const filteredNotifications = allNotifications.filter((item) => {
    if (activeTab === 'active') {
      return item.status === 'active';
    }
    if (activeTab === 'packages') {
      return (
        item.status === 'active' &&
        (item.type === 'package_completed' ||
          item.type === 'package_almost_due' ||
          item.type === 'payment_overdue' ||
          item.type === 'low_credit')
      );
    }
    if (activeTab === 'attendance') {
      return (
        item.status === 'active' &&
        (item.type === 'unrecorded_attendance' || item.type === 'repeated_absence')
      );
    }
    if (activeTab === 'resolved') {
      return item.status === 'resolved' || item.status === 'dismissed';
    }
    return true;
  });

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleToggleRead = (item: SmartReminderItem) => {
    db.markNotificationAsRead(item.id);
    onDataChanged?.();
  };

  const handleMarkAllRead = () => {
    const activeIds = allNotifications.filter((n) => n.status === 'active').map((n) => n.id);
    if (activeIds.length > 0) {
      db.markAllNotificationsAsRead(activeIds);
      showToast(isEn ? 'All notifications marked as read' : 'تم تحديد جميع التنبيهات كمقروءة');
      onDataChanged?.();
    }
  };

  const handleDismiss = (item: SmartReminderItem) => {
    db.dismissNotification(item.id);
    showToast(isEn ? 'Notification dismissed' : 'تم إخفاء التنبيه بنجاح');
    onDataChanged?.();
  };

  const handleQuickPay = (item: SmartReminderItem) => {
    if (item.studentId) {
      const student = students.find((s) => s.id === item.studentId);
      if (student) {
        onClose();
        onOpenAddPayment(student, item.enrollmentId);
      }
    }
  };

  const handleOpenAttendance = (item: SmartReminderItem) => {
    if (item.sessionId) {
      const sess = sessions.find((s) => s.id === item.sessionId);
      if (sess) {
        onClose();
        onOpenAttendanceModal(sess);
      }
    }
  };

  const getWhatsAppUrl = (item: SmartReminderItem) => {
    const phone = item.parentPhone || item.studentPhone;
    if (!phone) return null;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    let msg = '';
    if (isEn) {
      if (item.type === 'package_completed') {
        msg = `Hello, this is a reminder that (${item.studentName}) has completed the allocated session package (${item.packageSize || 8} sessions). Please settle the subscription to renew. Thank you.`;
      } else if (item.type === 'package_almost_due') {
        msg = `Hello, this is a reminder that (${item.studentName}) has ${item.lessonsRemaining === 1 ? '1 session' : `${item.lessonsRemaining} sessions`} remaining in the current package. Best regards.`;
      } else if (item.type === 'payment_overdue') {
        msg = `Hello, this is a friendly reminder regarding the outstanding balance for (${item.studentName}) of ${item.amount || 0} ${t('currency')}. Thank you.`;
      } else if (item.type === 'repeated_absence') {
        msg = `Hello, checking in regarding (${item.studentName}) who has missed the last two classes. We hope everything is well.`;
      } else {
        msg = `Hello, regarding student (${item.studentName}).`;
      }
    } else {
      if (item.type === 'package_completed') {
        msg = `السلام عليكم ورحمة الله، نود إحاطتكم علماً بأن الطالب/ة (${item.studentName}) قد أتم بحمد الله باقة الحصص المحددة (${item.packageSize || 8} حصص). يرجى التكرم بسداد قيمة الاشتراك لتجديد الباقة ومتابعة الحصص القادمة. شكراً لتعاونكم.`;
      } else if (item.type === 'package_almost_due') {
        msg = `السلام عليكم ورحمة الله، نود إحاطتكم علماً بأن الطالب/ة (${item.studentName}) متبقي له ${item.lessonsRemaining === 1 ? 'حصة واحدة' : `${item.lessonsRemaining} حصص`} على اكتمال الباقة الحالية. تحياتنا لكم.`;
      } else if (item.type === 'payment_overdue') {
        msg = `السلام عليكم ورحمة الله، تذكير ودي بشأن المصروفات الدراسية المستحقة للطالب/ة (${item.studentName}) بمبلغ ${item.amount || 0} ${t('currency')}. شكراً لتعاونكم.`;
      } else if (item.type === 'repeated_absence') {
        msg = `السلام عليكم ورحمة الله، نود الاطمئنان على الطالب/ة (${item.studentName}) نظراً لتغيبه عن آخر حصتين دراسيتين. نتمنى له دوام التوفيق والسلامة.`;
      } else {
        msg = `السلام عليكم ورحمة الله، تحياتنا بخصوص الطالب/ة (${item.studentName}).`;
      }
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  const getItemIcon = (type: string): AppIconName => {
    switch (type) {
      case 'package_completed':
      case 'payment_overdue':
        return 'coins';
      case 'package_almost_due':
      case 'low_credit':
        return 'receipt';
      case 'unrecorded_attendance':
        return 'calendar';
      case 'repeated_absence':
        return 'warning';
      default:
        return 'bell';
    }
  };

  return (
    <BottomSheet
      id="notifications"
      isOpen={isOpen}
      onClose={onClose}
      title={t('notifications')}
      subtitle={
        isEn
          ? 'Track packages, dues, overdue payments, and attendance'
          : 'متابعة استحقاق الباقات، الدفعات، ورصد الحضور والغياب'
      }
      headerLeading={
        <div className="w-10 h-10 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line">
          <AppIcon name="bell" size={20} weight="duotone" />
        </div>
      }
      headerTrailing={
        unreadCount > 0 ? (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange text-white shadow-2xs">
            {unreadCount} {isEn ? 'new' : 'جديد'}
          </span>
        ) : undefined
      }
      bodyClassName="p-0"
      maxWidthClass="sm:max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate font-bold">
            {isEn
              ? `Total: ${allNotifications.length} (${activeCount} active)`
              : `الإجمالي: ${allNotifications.length} (${activeCount} نشط)`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-soft px-5 py-2 text-xs"
          >
            {t('close')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col h-full">
        {/* Quick Feedback Toast */}
        {feedback && (
          <div className="px-4 py-2 bg-mint-soft text-navy text-xs font-bold border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AppIcon name="checkCircle" size={16} weight="fill" className="text-navy" />
              <span>{feedback}</span>
            </div>
          </div>
        )}

        {/* Filter Tabs & Mark All Read */}
        <div className="p-3 border-b border-line flex items-center justify-between gap-2 shrink-0 flex-wrap bg-page">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'active' as TabType, label: isEn ? 'Active' : 'النشطة', count: activeCount },
              {
                id: 'packages' as TabType,
                label: isEn ? 'Packages & Dues' : 'الباقات والمستحقات',
                count: allNotifications.filter(
                  (n) =>
                    n.status === 'active' &&
                    (n.type === 'package_completed' ||
                      n.type === 'package_almost_due' ||
                      n.type === 'payment_overdue' ||
                      n.type === 'low_credit')
                ).length,
              },
              {
                id: 'attendance' as TabType,
                label: isEn ? 'Attendance' : 'الحضور والغياب',
                count: allNotifications.filter(
                  (n) =>
                    n.status === 'active' &&
                    (n.type === 'unrecorded_attendance' || n.type === 'repeated_absence')
                ).length,
              },
              {
                id: 'resolved' as TabType,
                label: isEn ? 'Settled' : 'المسددة',
                count: allNotifications.filter((n) => n.status === 'resolved' || n.status === 'dismissed').length,
              },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`chip ${isSelected ? 'chip-active' : ''}`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-mint-soft text-navy'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {unreadCount > 0 && activeTab !== 'resolved' && (
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] font-black text-navy hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <AppIcon name="check" size={14} weight="bold" />
              <span>{isEn ? 'Mark all as read' : 'تحديد الكل كمقروء'}</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-page rounded-3xl border border-line p-6">
              <div className="w-14 h-14 rounded-2xl bg-mint-soft text-navy flex items-center justify-center mx-auto border border-line">
                <AppIcon name="checkCircle" size={28} weight="duotone" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-navy">
                  {activeTab === 'resolved'
                    ? (isEn ? 'No settled notifications yet' : 'لا توجد تنبيهات مسددة أو مكتملة بعد')
                    : (isEn ? 'Great! No pending notifications right now' : 'رائع! لا توجد تنبيهات معلقة حالياً')}
                </h3>
                <p className="text-xs text-slate max-w-sm mx-auto font-medium leading-relaxed">
                  {activeTab === 'resolved'
                    ? (isEn ? 'When packages and payments are settled, completed records will appear here.' : 'عند سداد الباقات والمستحقات، ستظهر سجلات التسوية المكتملة هنا.')
                    : (isEn ? 'All student enrollments, session packages, and attendance logs are up to date.' : 'جميع اشتراكات الطلاب وباقات الحصص وحالات الحضور محدثة ومنتظمة.')}
                </p>
              </div>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const targetStudent = item.studentId ? students.find((s) => s.id === item.studentId) : null;
              const isResolved = item.status === 'resolved';
              const isDismissed = item.status === 'dismissed';
              const isHigh = item.priority === 'high' && !isResolved;
              const isAlmostDue = item.type === 'package_almost_due';
              const isUnread = !item.isRead && !isResolved && !isDismissed;
              const waUrl = getWhatsAppUrl(item);
              const iconName = getItemIcon(item.type);

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all space-y-2.5 relative ${
                    isResolved
                      ? 'bg-mist border-line opacity-85'
                      : isDismissed
                      ? 'bg-page border-line opacity-75'
                      : isHigh
                      ? 'bg-coral-soft/40 border-coral/30 shadow-2xs'
                      : isAlmostDue
                      ? 'bg-mint-soft/50 border-mint shadow-2xs'
                      : 'bg-page border-line shadow-2xs'
                  }`}
                >
                  {/* Top row with duotone AppIcon in a mint-soft circle, title, slate time, unread orange dot */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Duotone AppIcon in a mint-soft circle */}
                      <div className="w-10 h-10 rounded-full bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line relative">
                        <AppIcon name={iconName} size={20} weight="duotone" />
                        {/* Unread: small orange dot */}
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
                                : isHigh
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

                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate">
                          {item.groupName && (
                            <span className="font-bold text-navy">
                              {item.groupName}
                            </span>
                          )}
                          {item.date && (
                            <span className="t-meta text-slate">
                              {item.date}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleRead(item)}
                        className="p-1.5 rounded-xl hover:bg-mint-soft text-slate hover:text-navy transition-all cursor-pointer"
                        title={item.isRead ? (isEn ? 'Mark as unread' : 'تحديد كغير مقروء') : (isEn ? 'Mark as read' : 'تحديد كمقروء')}
                      >
                        <AppIcon name="check" size={14} weight="bold" />
                      </button>
                      {!isResolved && !isDismissed && (
                        <button
                          type="button"
                          onClick={() => handleDismiss(item)}
                          className="p-1.5 rounded-xl hover:bg-coral-soft text-slate hover:text-coral transition-all cursor-pointer"
                          title={isEn ? 'Dismiss notification' : 'إخفاء التنبيه'}
                        >
                          <AppIcon name="archive" size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-line flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {targetStudent && (
                        <button
                          type="button"
                          onClick={() => {
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
                          rel="noreferrer"
                          className="btn-soft px-3 py-1 text-[11px] flex items-center gap-1"
                        >
                          <AppIcon name="message" size={13} />
                          <span>{isEn ? 'WhatsApp' : 'واتساب'}</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.actionType === 'add_payment' && targetStudent && !isResolved && (
                        <button
                          type="button"
                          onClick={() => handleQuickPay(item)}
                          className="btn-orange px-3.5 py-1 text-[11px]"
                        >
                          <AppIcon name="coins" size={13} weight="bold" />
                          <span>{t('recordPayment')}</span>
                        </button>
                      )}

                      {item.actionType === 'record_attendance' && item.sessionId && !isResolved && (
                        <button
                          type="button"
                          onClick={() => handleOpenAttendance(item)}
                          className="btn-orange px-3.5 py-1 text-[11px]"
                        >
                          <AppIcon name="calendarCheck" size={13} weight="bold" />
                          <span>{isEn ? 'Take Attendance' : 'رصد الحضور'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
