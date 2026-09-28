import React, { useState } from 'react';
import {
  X,
  Layers,
  Users,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  CalendarCheck2,
  UserPlus,
  CheckCircle2,
  BookOpen,
  TrendingUp,
  CreditCard,
  Phone,
  MessageCircle,
  Zap,
  Sparkles,
  School,
  Wallet,
  Activity,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react';
import { Group, Student, Session, Enrollment } from '../types';
import { db, getBillingModeLabel } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { StudentAvatar } from './StudentAvatar';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';
import {
  getTimesForDayInGroup,
  formatTimeDisplay,
  getArabicDayForDate,
  getWeekdayIndex,
} from '../utils/schedule';

interface GroupProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group | null;
  onEditGroup: (group: Group) => void;
  onAddExistingStudent: (group: Group) => void;
  onAddNewStudentToGroup: (group: Group) => void;
  onAddSessionForGroup: (group: Group) => void;
  onOpenAttendanceModal: (session: Session) => void;
  onOpenStudentProfile: (student: Student) => void;
  onOpenBulkAddSession?: (students: Student[], groupId?: string) => void;
  onDataChanged: () => void;
}

export const GroupProfileModal: React.FC<GroupProfileModalProps> = ({
  isOpen,
  onClose,
  group,
  onEditGroup,
  onAddExistingStudent,
  onAddNewStudentToGroup,
  onAddSessionForGroup,
  onOpenAttendanceModal,
  onOpenStudentProfile,
  onOpenBulkAddSession,
  onDataChanged,
}) => {
  const { t, isRTL, language } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<'students' | 'sessions' | 'stats'>('students');

  // Load data
  const enrollments = group ? db.getGroupEnrollments(group.id) : [];
  const enrolledStudents = group ? db.getGroupStudents(group.id) : [];
  const groupSessions = group
    ? db.getSessions().filter((s) => s.groupId === group.id && s.status !== 'cancelled')
    : [];

  const stats = group
    ? db.calculateGroupStats(group.id)
    : {
        studentCount: 0,
        totalSessions: 0,
        completedSessions: 0,
        attendanceRate: 100,
        totalRevenue: 0,
        totalDue: 0,
        remaining: 0,
      };

  const isPrivate = group?.type === 'private';
  const themeColor = group?.accentColor || (isPrivate ? '#FF647C' : '#7657F6');

  const todayArabicDay = getArabicDayForDate(new Date());

  const handleRemoveStudentFromGroup = (studentId: string, studentName: string) => {
    if (!group) return;
    const enr = enrollments.find((e) => e.studentId === studentId);
    if (!enr) return;
    if (confirm(t('confirmRemoveStudentFromGroup') + ` (${studentName})`)) {
      db.removeEnrollment(enr.id);
      onDataChanged();
    }
  };

  const handleDeleteGroup = () => {
    if (!group) return;
    if (confirm(t('confirmDeleteGroup') + ` (${group.name})`)) {
      db.deleteGroup(group.id);
      onDataChanged();
      onClose();
    }
  };

  const modalLayer = useModalLayer('group-profile', isOpen && !!group, onClose);

  if (!isOpen || !group) return null;

  // Format billing mode label
  const billingLabel =
    group.billingType === 'monthly'
      ? 'اشتراك شهري'
      : group.billingType === 'package'
      ? `باقة (${group.packageSessionsCount || 8} حصص)`
      : group.billingType === 'hourly'
      ? 'محاسبة بالساعة'
      : 'دفع بالحصة';

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#17163D]/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-white border border-[#E8E7FF] rounded-t-[28px] sm:rounded-[28px] max-w-lg w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
          
          {/* =========================================================================
              1. Hero Header Section
              ========================================================================= */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#17163D] via-[#403B9C] to-[#7657F6] text-white relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute -top-10 -right-10 w-44 h-44 bg-[#7657F6]/30 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-[#FF647C]/25 rounded-full blur-2xl pointer-events-none" />

            <button
              onClick={onClose}
              className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer z-10`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className={`flex items-start gap-3.5 relative z-10 ${isRTL ? 'pl-10' : 'pr-10'}`}>
              <div
                className="w-13 h-13 rounded-2xl flex items-center justify-center font-bold text-white text-xl shadow-lg shrink-0 border border-white/20 mt-0.5"
                style={{ backgroundColor: themeColor }}
              >
                {isPrivate ? <Zap className="w-6 h-6 text-white" /> : <Layers className="w-6 h-6 text-white" />}
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-white tracking-tight truncate">{group.name}</h2>
                  <span className="text-[10px] font-black bg-white/20 text-white px-2.5 py-0.5 rounded-full border border-white/20 shadow-xs">
                    {isPrivate ? 'درس خاص' : 'مجموعة دراسية'}
                  </span>
                </div>
                <p className="text-xs text-[#E8E7FF]/90 font-medium truncate">
                  {group.subject} • {getLocalizedStageName(group.gradeLevel)}
                  {group.roomOrLocation ? ` • ${group.roomOrLocation}` : ''}
                </p>
              </div>
            </div>

            {/* Quick Metrics Bento Strip */}
            <div className="grid grid-cols-4 gap-2 mt-4 text-center relative z-10">
              <div className="p-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
                <p className="text-sm sm:text-base font-black text-white">{enrolledStudents.length}</p>
                <p className="text-[9px] sm:text-[10px] font-bold text-[#E8E7FF]/80">الطلاب</p>
              </div>

              <div className="p-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
                <p className="text-sm sm:text-base font-black text-[#55C7E8]">{stats.completedSessions}</p>
                <p className="text-[9px] sm:text-[10px] font-bold text-[#E8E7FF]/80">الحصص</p>
              </div>

              <div className="p-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
                <p className="text-sm sm:text-base font-black text-emerald-300">{stats.attendanceRate}%</p>
                <p className="text-[9px] sm:text-[10px] font-bold text-[#E8E7FF]/80">الالتزام</p>
              </div>

              <div className="p-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
                <p className="text-sm sm:text-base font-black text-[#FF647C]">{group.defaultPrice} ج.م</p>
                <p className="text-[9px] sm:text-[10px] font-bold text-[#E8E7FF]/80 truncate">{billingLabel}</p>
              </div>
            </div>
          </div>

          {/* =========================================================================
              2. Sub-tab Navigation (Segmented Pill Bar)
              ========================================================================= */}
          <div className="p-2 bg-[#F6F7FC] border-b border-[#E8E7FF]">
            <div className="classy-card p-1 flex items-center gap-1 bg-white border-[#E8E7FF]">
              <button
                type="button"
                onClick={() => setActiveSubTab('students')}
                className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'students'
                    ? 'bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white shadow-sm'
                    : 'text-[#74778F] hover:text-[#17163D]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>الطلاب ({enrolledStudents.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('sessions')}
                className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'sessions'
                    ? 'bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white shadow-sm'
                    : 'text-[#74778F] hover:text-[#17163D]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>الحصص ({groupSessions.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('stats')}
                className={`flex-1 py-2 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeSubTab === 'stats'
                    ? 'bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white shadow-sm'
                    : 'text-[#74778F] hover:text-[#17163D]'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>الأداء والماليات</span>
              </button>
            </div>
          </div>

          {/* =========================================================================
              3. Content Area
              ========================================================================= */}
          <div className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-3.5 text-xs text-[#191A2E] bg-[#F6F7FC]">
            
            {/* TAB 1: Enrolled Students */}
            {activeSubTab === 'students' && (
              <div className="space-y-3">
                {/* Actions Bar */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-[#74778F]">قائمة طلاب المجموعة</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {enrolledStudents.length > 0 && onOpenBulkAddSession && (
                      <button
                        type="button"
                        onClick={() => onOpenBulkAddSession(enrolledStudents, group.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#E8E7FF] hover:bg-[#D3D0FB] text-[#7657F6] font-bold text-[11px] flex items-center gap-1 border border-[#D8D5FB] transition-all active:scale-95 cursor-pointer shadow-2xs"
                      >
                        <CalendarCheck2 className="w-3.5 h-3.5" />
                        <span>جدولة جماعية ({enrolledStudents.length})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onAddExistingStudent(group)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#17163D] hover:bg-[#403B9C] text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>إضافة طالب مسجل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddNewStudentToGroup(group)}
                      className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#E8E7FF] text-[#17163D] font-bold text-[11px] flex items-center gap-1 border border-[#E8E7FF] transition-all active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#7657F6]" />
                      <span>طالب جديد</span>
                    </button>
                  </div>
                </div>

                {enrolledStudents.length === 0 ? (
                  <div className="p-6 bg-white rounded-2xl border border-[#E8E7FF] text-center space-y-2.5 shadow-xs">
                    <Users className="w-8 h-8 mx-auto text-[#74778F] opacity-40" />
                    <p className="font-black text-[#17163D] text-sm">لا يوجد طلاب مسجلون في هذه المجموعة بعد</p>
                    <p className="text-[11px] text-[#74778F] max-w-xs mx-auto">
                      يمكنك إضافة طلاب مسجلين مسبقاً من قاعدة بياناتك أو إنشاء ملف طالب جديد مباشرة.
                    </p>
                    <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onAddExistingStudent(group)}
                        className="px-3.5 py-2 rounded-xl bg-[#17163D] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>إضافة طالب من النظام</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onAddNewStudentToGroup(group)}
                        className="px-3.5 py-2 rounded-xl bg-white text-[#17163D] font-bold text-xs inline-flex items-center gap-1.5 border border-[#E8E7FF] transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-[#7657F6]" />
                        <span>تسجيل طالب جديد</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {enrolledStudents.map((st) => {
                      const enr = enrollments.find((e) => e.studentId === st.id);
                      const stFin = db.calculateStudentFinancials(st.id);

                      return (
                        <div
                          key={st.id}
                          className="p-3 rounded-2xl bg-white border border-[#E8E7FF] flex items-center justify-between shadow-xs hover:border-[#7657F6]/40 transition-all gap-2"
                        >
                          <div
                            onClick={() => onOpenStudentProfile(st)}
                            className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1"
                          >
                            <StudentAvatar
                              student={st}
                              size="sm"
                              showFrame={true}
                              className="shrink-0"
                            />
                            <div className="min-w-0 space-y-0.5">
                              <p className="font-black text-[#17163D] text-xs hover:text-[#7657F6] transition-colors truncate">
                                {st.name}
                              </p>
                              <p className="text-[10px] text-[#74778F] truncate">
                                {getBillingModeLabel(enr?.billingType, enr?.billingMode)} • {enr?.customPrice || group.defaultPrice} {t('currency')}
                                {st.phone ? ` • ${st.phone}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Phone / WhatsApp Quick links */}
                            {st.phone && (
                              <a
                                href={`https://wa.me/${st.phone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 transition-colors"
                                title="مراسلة واتساب"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}

                            {/* Financial status badge */}
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                                stFin.balance < 0
                                  ? 'bg-[#FFF1F3] text-[#FF647C] border-[#FECDD3]'
                                  : stFin.balance > 0
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-[#F6F7FC] text-[#403B9C] border-[#E8E7FF]'
                              }`}
                            >
                              {stFin.balance < 0
                                ? `${Math.abs(stFin.balance)} ج.م مديونية`
                                : stFin.balance > 0
                                ? `+${stFin.balance} ج.م رصيد`
                                : 'خالص'}
                            </span>

                            {/* Remove student button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveStudentFromGroup(st.id, st.name)}
                              className="p-1.5 text-[#74778F] hover:text-[#FF647C] hover:bg-[#FFF1F3] rounded-lg transition-colors cursor-pointer"
                              title="إزالة الطالب من المجموعة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Schedule & Sessions */}
            {activeSubTab === 'sessions' && (
              <div className="space-y-3">
                {/* Weekly Schedule Overview Card */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#E8E7FF] space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-[#17163D] flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#7657F6]" />
                      <span>جدول المواعيد الأسبوعي:</span>
                    </span>
                    {group.roomOrLocation && (
                      <span className="text-[11px] text-[#74778F] flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#FF647C]" />
                        <span>{group.roomOrLocation}</span>
                      </span>
                    )}
                  </div>

                  {group.scheduleDays && group.scheduleDays.length > 0 ? (
                    <div className="space-y-1.5 pt-0.5">
                      {group.scheduleDays.map((day) => {
                        const dayTimes = getTimesForDayInGroup(group, day);
                        const isToday = getWeekdayIndex(day) === getWeekdayIndex(todayArabicDay);

                        return (
                          <div
                            key={day}
                            className={`p-2.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs ${
                              isToday
                                ? 'bg-gradient-to-r from-emerald-50/90 to-white border-emerald-300 ring-1 ring-emerald-300/40'
                                : 'bg-[#F6F7FC] border-[#E8E7FF]'
                            }`}
                          >
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isToday ? 'bg-emerald-500 animate-pulse' : 'bg-[#7657F6]'
                                }`}
                              />
                              <span className={`text-xs font-black ${isToday ? 'text-emerald-950' : 'text-[#17163D]'}`}>
                                {day}
                              </span>
                              {isToday && (
                                <span className="text-[9px] font-black px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                  اليوم
                                </span>
                              )}
                              {dayTimes.length > 1 && (
                                <span className="text-[9px] font-bold text-[#74778F]">
                                  ({dayTimes.length} فترات)
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              {dayTimes.length > 0 ? (
                                dayTimes.map((time, tIdx) => (
                                  <div
                                    key={tIdx}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all ${
                                      isToday
                                        ? 'bg-emerald-100 text-emerald-950 border-emerald-300 shadow-2xs'
                                        : 'bg-white text-[#191A2E] border-[#E8E7FF] shadow-2xs'
                                    }`}
                                  >
                                    <Clock className={`w-3 h-3 ${isToday ? 'text-emerald-700' : 'text-[#7657F6]'}`} />
                                    <span className="font-mono font-black text-[11px]">
                                      {formatTimeDisplay(time, isRTL)}
                                    </span>
                                    {dayTimes.length > 1 && (
                                      <span
                                        className={`text-[9px] px-1.5 py-0.2 rounded-md font-extrabold ${
                                          isToday
                                            ? 'bg-emerald-200/90 text-emerald-950'
                                            : 'bg-[#E8E7FF] text-[#7657F6]'
                                        }`}
                                      >
                                        فترة {tIdx + 1}
                                      </span>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <span className="font-mono text-[11px]">{formatTimeDisplay(group.scheduleTime, isRTL)}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[#74778F]">مواعيد مرنة حسب الاتفاق</p>
                  )}
                </div>

                {/* Sessions Header & List */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#74778F]">سجل الحصص المنفذة والمجدولة</span>
                  <button
                    type="button"
                    onClick={() => onAddSessionForGroup(group)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#17163D] hover:bg-[#403B9C] text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>جدولة حصة جديدة</span>
                  </button>
                </div>

                {groupSessions.length === 0 ? (
                  <div className="p-6 bg-white rounded-2xl border border-[#E8E7FF] text-center space-y-2 shadow-xs">
                    <CalendarCheck2 className="w-8 h-8 mx-auto text-[#74778F] opacity-40" />
                    <p className="font-black text-[#17163D] text-sm">لا توجد حصص مسجلة لهذه المجموعة بعد</p>
                    <p className="text-[11px] text-[#74778F]">
                      ابدأ بإضافة أول حصة لتسجيل الحضور وتحصيل الاشتراكات تلقائياً.
                    </p>
                    <button
                      type="button"
                      onClick={() => onAddSessionForGroup(group)}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white font-bold text-xs inline-flex items-center gap-1.5 mt-1 cursor-pointer shadow-md shadow-[#FF647C]/30"
                    >
                      <Plus className="w-4 h-4" />
                      <span>جدولة أول حصة</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groupSessions.map((ses) => (
                      <div
                        key={ses.id}
                        className="p-3 rounded-2xl bg-white border border-[#E8E7FF] flex items-center justify-between shadow-xs hover:border-[#7657F6]/40 transition-all gap-2"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-[#17163D] text-xs truncate">{ses.title || 'حصة دراسية'}</p>
                            
                            {/* Semantic Status Badge */}
                            {ses.status === 'completed' ? (
                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>مكتملة</span>
                              </span>
                            ) : ses.status === 'cancelled' ? (
                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-[#FFF1F3] text-[#FF647C] border border-[#FECDD3] inline-flex items-center gap-1 shadow-2xs">
                                <AlertCircle className="w-3 h-3 text-[#FF647C]" />
                                <span>ملغاة</span>
                              </span>
                            ) : (
                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 inline-flex items-center gap-1 shadow-2xs">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>مجدولة</span>
                              </span>
                            )}
                          </div>

                          <p className="text-[10px] text-[#74778F]">
                            {ses.dayName} • {ses.date} {ses.startTime ? `• ${formatTimeDisplay(ses.startTime, isRTL)}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onOpenAttendanceModal(ses)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all ${
                              ses.status === 'completed'
                                ? 'bg-[#17163D] hover:bg-[#403B9C] text-white'
                                : 'bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white shadow-md shadow-[#FF647C]/20'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#55C7E8]" />
                            <span>{ses.status === 'completed' ? 'تعديل الحضور' : 'رصد الحضور'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Performance & Financial Statistics */}
            {activeSubTab === 'stats' && (
              <div className="space-y-3">
                {/* Financial Summary Bento */}
                <div className="p-4 rounded-2xl bg-white border border-[#E8E7FF] space-y-3.5 shadow-xs">
                  <h3 className="font-black text-[#17163D] text-xs flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-[#7657F6]" />
                    <span>الموقف المالي والإيرادات</span>
                  </h3>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 bg-[#F8F9FE] rounded-2xl border border-[#E8E7FF]">
                      <p className="text-sm sm:text-base font-black text-[#17163D]">{stats.totalDue} ج.م</p>
                      <p className="text-[10px] text-[#74778F] font-bold mt-0.5">إجمالي المطلوب</p>
                    </div>

                    <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200">
                      <p className="text-sm sm:text-base font-black text-emerald-700">{stats.totalRevenue} ج.م</p>
                      <p className="text-[10px] text-emerald-800 font-bold mt-0.5">تم التحصيل</p>
                    </div>

                    <div className="p-3 bg-[#FFF1F3] rounded-2xl border border-[#FECDD3]">
                      <p className="text-sm sm:text-base font-black text-[#FF647C]">{stats.remaining} ج.م</p>
                      <p className="text-[10px] text-[#FF647C] font-bold mt-0.5">المتبقي</p>
                    </div>
                  </div>

                  {/* Collection Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] font-bold text-[#74778F]">
                      <span>نسبة التحصيل</span>
                      <span className="text-[#17163D] font-black">
                        {stats.totalDue > 0 ? Math.round((stats.totalRevenue / stats.totalDue) * 100) : 100}%
                      </span>
                    </div>
                    <div className="w-full bg-[#E8E7FF] h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#7657F6] to-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${stats.totalDue > 0 ? Math.min(100, Math.round((stats.totalRevenue / stats.totalDue) * 100)) : 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Attendance Performance Card */}
                <div className="p-4 rounded-2xl bg-white border border-[#E8E7FF] space-y-3 shadow-xs">
                  <h3 className="font-black text-[#17163D] text-xs flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>معدل الحضور والالتزام</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-3 bg-[#F8F9FE] rounded-2xl border border-[#E8E7FF]">
                      <p className="text-base sm:text-lg font-black text-emerald-600">{stats.attendanceRate}%</p>
                      <p className="text-[10px] text-[#74778F] font-bold mt-0.5">متوسط نسبة الحضور</p>
                    </div>

                    <div className="p-3 bg-[#F8F9FE] rounded-2xl border border-[#E8E7FF]">
                      <p className="text-base sm:text-lg font-black text-[#7657F6]">{stats.completedSessions}</p>
                      <p className="text-[10px] text-[#74778F] font-bold mt-0.5">الحصص المكتملة</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* =========================================================================
              4. Modal Actions Footer
              ========================================================================= */}
          <div className="p-3.5 bg-white border-t border-[#E8E7FF] flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onEditGroup(group);
                onClose();
              }}
              className="flex-1 py-2.5 px-3 rounded-2xl bg-[#F6F7FC] hover:bg-[#E8E7FF] text-[#17163D] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-[#E8E7FF] cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#7657F6]" />
              <span>{t('editGroupAction')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onAddSessionForGroup(group);
              }}
              className="flex-1 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-[#FF647C] to-[#7657F6] text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#FF647C]/30 cursor-pointer active:scale-95"
            >
              <CalendarCheck2 className="w-3.5 h-3.5" />
              <span>{t('scheduleSessionAction')}</span>
            </button>

            <button
              type="button"
              onClick={handleDeleteGroup}
              className="p-2.5 rounded-2xl bg-[#FFF1F3] hover:bg-[#FFE4E6] text-[#FF647C] border border-[#FECDD3] cursor-pointer transition-colors"
              title={t('deleteGroupAction')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
};
