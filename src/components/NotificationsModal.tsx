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
      showToast('تم تحديد جميع التنبيهات كمقروءة');
      onDataChanged?.();
    }
  };

  const handleDismiss = (item: SmartReminderItem) => {
    db.dismissNotification(item.id);
    showToast('تم إخفاء التنبيه بنجاح');
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
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div
      className="fixed inset-0 bg-[#17163D]/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
      dir="rtl"
    >
      <div className="bg-white rounded-[28px] w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl border border-[#E8E7FF] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-l from-[#17163D] via-[#17163D] to-[#2E2050] text-white flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-2xl bg-[#E8E7FF]/20 border border-[#E8E7FF]/30 flex items-center justify-center text-[#E8E7FF] shadow-inner">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">مركز التنبيهات والإشعارات</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FF647C] text-white shadow-md shadow-[#FF647C]/40 animate-pulse">
                    {unreadCount} جديد
                  </span>
                )}
              </div>
              <p className="text-xs text-[#9A9CB8] font-medium">
                متابعة استحقاق الباقات، الدفعات، ورصد الحضور والغياب
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer relative z-10"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Feedback Toast */}
        {feedback && (
          <div className="px-4 py-2 bg-[#E0F7EF] text-emerald-800 text-xs font-bold border-b border-emerald-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{feedback}</span>
            </div>
          </div>
        )}

        {/* Filter Tabs & Mark All Read */}
        <div className="p-3 bg-[#F6F7FC] border-b border-[#E8E7FF] flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'active' as TabType, label: 'النشطة', count: activeCount },
              {
                id: 'packages' as TabType,
                label: 'الباقات والمستحقات',
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
                label: 'الحضور والغياب',
                count: allNotifications.filter(
                  (n) =>
                    n.status === 'active' &&
                    (n.type === 'unrecorded_attendance' || n.type === 'repeated_absence')
                ).length,
              },
              {
                id: 'resolved' as TabType,
                label: 'المسددة والمكتملة',
                count: allNotifications.filter((n) => n.status === 'resolved' || n.status === 'dismissed').length,
              },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#17163D] text-white shadow-md'
                      : 'bg-white text-[#74778F] hover:bg-slate-100 border border-[#E8E7FF]'
                  }`}
                >
                  <span className="font-bold">{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#E8E7FF] text-[#7657F6]'
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
              className="text-[11px] font-bold text-[#7657F6] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>تحديد الكل كمقروء</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 android-scrollbar">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  {activeTab === 'resolved'
                    ? 'لا توجد تنبيهات مسددة أو مكتملة بعد'
                    : 'رائع! لا توجد تنبيهات معلقة حالياً'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {activeTab === 'resolved'
                    ? 'عند سداد الباقات والمستحقات، ستظهر سجلات التسوية المكتملة هنا'
                    : 'جميع اشتراكات الطلاب وباقات الحصص وحالات الحضور محدثة ومنتظمة'}
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
                      ? 'bg-emerald-50/40 border-emerald-200 opacity-90'
                      : isDismissed
                      ? 'bg-slate-50 border-slate-200 opacity-75'
                      : isHigh
                      ? 'bg-rose-50/60 border-rose-200 shadow-xs'
                      : isAlmostDue
                      ? 'bg-amber-50/60 border-amber-200 shadow-xs'
                      : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  {/* Top line badge & status */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span
                          className="w-2 h-2 rounded-full bg-rose-500 shrink-0"
                          title="غير مقروء"
                        />
                      )}
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-lg font-bold inline-flex items-center gap-1 ${
                          isResolved
                            ? 'bg-emerald-100 text-emerald-800'
                            : isHigh
                            ? 'bg-rose-100 text-rose-800'
                            : isAlmostDue
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {isResolved ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : isHigh ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        <span>{item.badge}</span>
                      </span>

                      {item.groupName && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          {item.groupName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <button
                        onClick={() => handleToggleRead(item)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-all cursor-pointer"
                        title={item.isRead ? 'تحديد كغير مقروء' : 'تحديد كمقروء'}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {!isResolved && !isDismissed && (
                        <button
                          onClick={() => handleDismiss(item)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                          title="إخفاء التنبيه"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Body text */}
                  <div>
                    <h4
                      className={`text-xs sm:text-sm font-bold ${
                        isResolved
                          ? 'text-emerald-950 line-through opacity-80'
                          : isUnread
                          ? 'text-slate-900'
                          : 'text-slate-800'
                      }`}
                    >
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-600 font-medium mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {targetStudent && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenStudentProfile(targetStudent);
                          }}
                          className="px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                        >
                          الملف الشخصي
                        </button>
                      )}

                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>واتساب ولي الأمر</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.actionType === 'add_payment' && targetStudent && !isResolved && (
                        <button
                          onClick={() => handleQuickPay(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-700 text-white text-[11px] font-bold hover:bg-emerald-800 transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>تسجيل السداد</span>
                        </button>
                      )}

                      {item.actionType === 'record_attendance' && item.sessionId && !isResolved && (
                        <button
                          onClick={() => handleOpenAttendance(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#172554] text-white text-[11px] font-bold hover:bg-[#0F172A] transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <CalendarCheck2 className="w-3.5 h-3.5" />
                          <span>رصد الحضور</span>
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
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            إجمالي التنبيهات: {allNotifications.length} ({activeCount} نشط)
          </span>
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
