import React, { useState, useMemo } from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  UserCheck,
  MessageCircle,
  Phone,
  Eye,
  Check,
  Filter,
  Trash2,
  CalendarCheck2,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Archive,
} from 'lucide-react';
import {
  Student,
  Group,
  Session,
  Enrollment,
  Payment,
  SmartReminderItem,
  NotificationType,
} from '../types';
import { db } from '../utils/storage';
import { getSmartReminders } from '../utils/reminders';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import { useTranslation } from '../utils/i18n';

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

  const modalLayer = useModalLayer('notifications', isOpen, onClose);

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
        return;
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
        msg = `السلام عليكم ورحمة الله، تذكير ودي بشأن المصروفات الدراسية المستحقة للطالب/ة (${item.studentName}) بمبلغ ${item.amount || 0} ج.م. شكراً لتعاونكم.`;
      } else if (item.type === 'repeated_absence') {
        msg = `السلام عليكم ورحمة الله، نود الاطمئنان على الطالب/ة (${item.studentName}) نظراً لتغيبه عن آخر حصتين دراسيتين. نتمنى له دوام التوفيق والسلامة.`;
      } else {
        msg = `السلام عليكم ورحمة الله، تحياتنا بخصوص الطالب/ة (${item.studentName}).`;
      }
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#293828]/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-[#DDD3C7]/15 rounded-[28px] w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl border border-[#DDD3C7] overflow-hidden">
        
        {/* Signature Classy Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#293828] via-[#0F1206] to-[#756046] text-[#F8F2EC] flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#F8F2EC]/15 backdrop-blur-md border border-[#DDD3C7]/25 flex items-center justify-center text-[#F8F2EC] shadow-sm shrink-0">
              <Bell className="w-5 h-5 text-[#F8F2EC]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-[#F8F2EC] tracking-tight">{t('notifications')}</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#0F1206] text-[#F8F2EC] shadow-md shadow-[#0F1206]/40 animate-pulse">
                    {unreadCount} {isEn ? 'new' : 'جديد'}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#DDD3C7]/85 font-medium truncate">
                {isEn ? 'Track packages, dues, overdue payments, and attendance' : 'متابعة استحقاق الباقات، الدفعات، ورصد الحضور والغياب'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-[#F8F2EC]/10 hover:bg-[#F8F2EC]/20 text-[#F8F2EC] border border-[#DDD3C7]/20 transition-all cursor-pointer relative z-10 active:scale-95"
            title={t('close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Feedback Toast */}
        {feedback && (
          <div className="px-4 py-2.5 bg-[#DDD3C7]/15 text-[#0F1206] text-xs font-black border-b border-[#293828] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#DDD3C7]" />
              <span>{feedback}</span>
            </div>
          </div>
        )}

        {/* Filter Tabs & Mark All Read */}
        <div className="p-3 bg-[#F8F2EC] border-b border-[#DDD3C7] flex items-center justify-between gap-2 shrink-0 flex-wrap">
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
                label: isEn ? 'Settled & Completed' : 'المسددة والمكتملة',
                count: allNotifications.filter((n) => n.status === 'resolved' || n.status === 'dismissed').length,
              },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#293828] text-[#F8F2EC] shadow-xs'
                      : 'bg-[#DDD3C7]/15 text-[#756046] hover:bg-[#DDD3C7]/35 border border-[#DDD3C7]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isSelected ? 'bg-[#F8F2EC]/20 text-[#F8F2EC]' : 'bg-[#DDD3C7]/25 text-[#293828]'
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
              className="text-[11px] font-black text-[#293828] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isEn ? 'Mark all as read' : 'تحديد الكل كمقروء'}</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 android-scrollbar">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-[#F8F2EC] rounded-3xl border border-[#DDD3C7] p-6 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-[#DDD3C7]/15 text-[#293828] flex items-center justify-center mx-auto border border-[#293828]">
                <CheckCircle2 className="w-7 h-7 text-[#293828]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-[#0F1206]">
                  {activeTab === 'resolved'
                    ? (isEn ? 'No settled notifications yet' : 'لا توجد تنبيهات مسددة أو مكتملة بعد')
                    : (isEn ? 'Great! No pending notifications right now' : 'رائع! لا توجد تنبيهات معلقة حالياً')}
                </h3>
                <p className="text-xs text-[#756046] max-w-sm mx-auto font-medium leading-relaxed">
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

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all space-y-2.5 relative ${
                    isResolved
                      ? 'bg-[#DDD3C7]/15 border-[#293828] opacity-90'
                      : isDismissed
                      ? 'bg-[#F8F2EC]/60 border-[#DDD3C7] opacity-75'
                      : isHigh
                      ? 'bg-[#DDD3C7]/15 border-[#DDD3C7] shadow-xs'
                      : isAlmostDue
                      ? 'bg-[#DDD3C7]/15 border-[#293828] shadow-xs'
                      : 'bg-[#F8F2EC] border-[#DDD3C7] shadow-xs'
                  }`}
                >
                  {/* Top line badge & status */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span
                          className="w-2 h-2 rounded-full bg-[#0F1206] shrink-0 animate-pulse"
                          title={isEn ? 'Unread' : 'غير مقروء'}
                        />
                      )}
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-lg font-black inline-flex items-center gap-1 ${
                          isResolved
                            ? 'bg-[#DDD3C7]/15 text-[#0F1206] border border-[#293828]'
                            : isHigh
                            ? 'bg-[#DDD3C7]/15 text-[#0F1206] border border-[#DDD3C7]'
                            : isAlmostDue
                            ? 'bg-[#DDD3C7]/15 text-[#0F1206] border border-[#293828]'
                            : 'bg-[#DDD3C7]/25 text-[#0F1206] border border-[#DDD3C7]'
                        }`}
                      >
                        {isResolved ? (
                          <CheckCircle2 className="w-3 h-3 text-[#293828]" />
                        ) : isHigh ? (
                          <AlertTriangle className="w-3 h-3 text-[#0F1206]" />
                        ) : (
                          <Clock className="w-3 h-3 text-[#293828]" />
                        )}
                        <span>{item.badge}</span>
                      </span>

                      {item.groupName && (
                        <span className="text-[10px] text-[#756046] font-bold">
                          {item.groupName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-[#756046]">
                      <button
                        onClick={() => handleToggleRead(item)}
                        className="p-1.5 rounded-lg hover:bg-[#DDD3C7]/35 text-[#756046] transition-all cursor-pointer"
                        title={item.isRead ? (isEn ? 'Mark as unread' : 'تحديد كغير مقروء') : (isEn ? 'Mark as read' : 'تحديد كمقروء')}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {!isResolved && !isDismissed && (
                        <button
                          onClick={() => handleDismiss(item)}
                          className="p-1.5 rounded-lg hover:bg-[#DDD3C7]/25 text-[#756046] hover:text-[#0F1206] transition-all cursor-pointer"
                          title={isEn ? 'Dismiss notification' : 'إخفاء التنبيه'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body text */}
                  <div>
                    <h4
                      className={`text-xs sm:text-sm font-black ${
                        isResolved
                          ? 'text-[#0F1206] line-through opacity-80'
                          : isUnread
                          ? 'text-[#0F1206]'
                          : 'text-[#0F1206]'
                      }`}
                    >
                      {item.title}
                    </h4>
                    <p className="text-xs text-[#756046] font-medium mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-[#DDD3C7]/70 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {targetStudent && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenStudentProfile(targetStudent);
                          }}
                          className="px-3 py-1 rounded-xl bg-[#F8F2EC] border border-[#DDD3C7] text-[11px] font-black text-[#0F1206] hover:bg-[#DDD3C7]/25 transition-all cursor-pointer"
                        >
                          {isEn ? 'Profile' : 'الملف الشخصي'}
                        </button>
                      )}

                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 rounded-xl bg-[#DDD3C7]/15 text-[#0F1206] border border-[#293828] text-[11px] font-black hover:bg-[#0F1206] hover:text-[#F8F2EC] transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{isEn ? 'WhatsApp Parent' : 'واتساب ولي الأمر'}</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.actionType === 'add_payment' && targetStudent && !isResolved && (
                        <button
                          onClick={() => handleQuickPay(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#293828] to-[#0F1206] text-[#F8F2EC] text-[11px] font-black hover:brightness-105 transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <DollarSign className="w-3.5 h-3.5 text-[#F8F2EC]" />
                          <span>{t('recordPayment')}</span>
                        </button>
                      )}

                      {item.actionType === 'record_attendance' && item.sessionId && !isResolved && (
                        <button
                          onClick={() => handleOpenAttendance(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#293828] via-[#0F1206] to-[#756046] text-[#F8F2EC] text-[11px] font-black hover:brightness-105 transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <CalendarCheck2 className="w-3.5 h-3.5 text-[#F8F2EC]" />
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

        {/* Footer */}
        <div className="p-3.5 bg-[#F8F2EC] border-t border-[#DDD3C7] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#756046] font-bold">
            {isEn ? `Total Notifications: ${allNotifications.length} (${activeCount} active)` : `إجمالي التنبيهات: ${allNotifications.length} (${activeCount} نشط)`}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-[#293828] hover:bg-[#0F1206] text-[#F8F2EC] text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
};
