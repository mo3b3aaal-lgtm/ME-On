import React, { useState, useMemo } from 'react';
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
  ChevronRight,
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
  getLocalizedWeekdayName,
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
  const isEn = language.startsWith('en');
  const [activeSubTab, setActiveSubTab] = useState<'students' | 'sessions' | 'stats'>('students');

  // Load data (Memoized for instantaneous modal responsiveness)
  const groupId = group?.id;
  const enrollments = useMemo(() => (groupId ? db.getGroupEnrollments(groupId) : []), [groupId]);
  const enrolledStudents = useMemo(() => (groupId ? db.getGroupStudents(groupId) : []), [groupId]);
  const groupSessions = useMemo(
    () => (groupId ? db.getSessions().filter((s) => s.groupId === groupId && s.status !== 'cancelled') : []),
    [groupId]
  );

  const stats = useMemo(
    () =>
      groupId
        ? db.calculateGroupStats(groupId)
        : {
            studentCount: 0,
            totalSessions: 0,
            completedSessions: 0,
            attendanceRate: 100,
            totalRevenue: 0,
            totalDue: 0,
            remaining: 0,
          },
    [groupId]
  );

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
      ? (isEn ? 'Monthly Subscription' : 'اشتراك شهري')
      : group.billingType === 'package'
      ? (isEn ? `Package (${group.packageSessionsCount || 8} sessions)` : `باقة (${group.packageSessionsCount || 8} حصص)`)
      : group.billingType === 'hourly'
      ? (isEn ? 'Hourly Billing' : 'محاسبة بالساعة')
      : (isEn ? 'Per Session' : 'دفع بالحصة');

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

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
                    {isPrivate ? (isEn ? 'Private Lesson' : 'درس خاص') : (isEn ? 'Study Group' : 'مجموعة دراسية')}
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
                <p className="text-[9px] sm:text-[10px] font-bold text-[#E8E7FF]/80">{isEn ? 'Students' : 'الطلاب'}</p>
              </div>

              <div className="p-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
                <p className="text-sm sm:text-base font-black text-[#55C7E8]">{stats.completedSessions}</p>
                <p className="text-[9px] sm:text-[10px] font-bold text-[#E8E7FF]/80">{isEn ? 'Sessions' : 'الحصص'}</p>
              </div>

              <div className="p-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
                <p className="text-sm sm:text-base font-black text-emerald-300">{stats.attendanceRate}%</p>
                <p className="text-[9px] sm:text-[10px] font-bold text-[#E8E7FF]/80">{isEn ? 'Attendance' : 'الالتزام'}</p>
              </div>

              <div className="p-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-xs">
                <p className="text-sm sm:text-base font-black text-[#FF647C]">{group.defaultPrice} {t('currency')}</p>
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
                <span>{isEn ? `Students (${enrolledStudents.length})` : `الطلاب (${enrolledStudents.length})`}</span>
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
                <span>{isEn ? `Sessions (${groupSessions.length})` : `الحصص (${groupSessions.length})`}</span>
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
                <span>{isEn ? 'Stats & Finance' : 'الأداء والماليات'}</span>
              </button>
            </div>
          </div>

          {/* =========================================================================
              3. Content Area
              ========================================================================= */}
          <div className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-3.5 text-xs text-[#191A2E] bg-[#F5F6FC]">
            {/* TAB 1: Enrolled Students */}
            {activeSubTab === 'students' && (
              <div className="space-y-3">
                {/* Actions Bar */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-[#74778F]">{isEn ? 'Group Students' : 'قائمة طلاب المجموعة'}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {enrolledStudents.length > 0 && onOpenBulkAddSession && (
                      <button
                        type="button"
                        onClick={() => onOpenBulkAddSession(enrolledStudents, group.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#E8E7FF] hover:bg-[#D3D0FB] text-[#7657F6] font-bold text-[11px] flex items-center gap-1 border border-[#D8D5FB] transition-all active:scale-95 cursor-pointer shadow-2xs"
                      >
                        <CalendarCheck2 className="w-3.5 h-3.5" />
                        <span>{isEn ? `Bulk Schedule (${enrolledStudents.length})` : `جدولة جماعية (${enrolledStudents.length})`}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onAddExistingStudent(group)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#17163D] hover:bg-[#403B9C] text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Add Enrolled' : 'إضافة طالب مسجل'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddNewStudentToGroup(group)}
                      className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#E8E7FF] text-[#17163D] font-bold text-[11px] flex items-center gap-1 border border-[#E8E7FF] transition-all active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#7657F6]" />
                      <span>{isEn ? 'New Student' : 'طالب جديد'}</span>
                    </button>
                  </div>
                </div>

                {enrolledStudents.length === 0 ? (
                  <div className="p-6 bg-white rounded-2xl border border-[#E8E7FF] text-center space-y-2.5 shadow-xs">
                    <Users className="w-8 h-8 mx-auto text-[#74778F] opacity-40" />
                    <p className="font-black text-[#17163D] text-sm">{isEn ? 'No students enrolled in this group yet' : 'لا يوجد طلاب مسجلون في هذه المجموعة بعد'}</p>
                    <p className="text-[11px] text-[#74778F] max-w-xs mx-auto">
                      {isEn ? 'Add existing students from your directory or register a new student directly.' : 'يمكنك إضافة طلاب مسجلين مسبقاً من قاعدة بياناتك أو إنشاء ملف طالب جديد مباشرة.'}
                    </p>
                    <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onAddExistingStudent(group)}
                        className="px-3.5 py-2 rounded-xl bg-[#17163D] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{isEn ? 'Add Existing Student' : 'إضافة طالب من النظام'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onAddNewStudentToGroup(group)}
                        className="px-3.5 py-2 rounded-xl bg-white text-[#17163D] font-bold text-xs inline-flex items-center gap-1.5 border border-[#E8E7FF] transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-[#7657F6]" />
                        <span>{isEn ? 'Register New Student' : 'تسجيل طالب جديد'}</span>
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
                            {st.phone && (
                              <a
                                href={`https://wa.me/${st.phone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveStudentFromGroup(st.id, st.name)}
                              className="p-1.5 rounded-xl text-[#FF647C] hover:bg-[#FFF1F3] border border-transparent hover:border-[#FECDD3] transition-colors"
                              title={isEn ? 'Remove from group' : 'إلغاء قيد الطالب'}
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

            {/* TAB 2: Sessions */}
            {activeSubTab === 'sessions' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#74778F]">{isEn ? 'Group Sessions' : 'حصص المجموعة'}</span>
                  <button
                    type="button"
                    onClick={() => onAddSessionForGroup(group)}
                    className="px-3 py-1.5 rounded-xl bg-[#17163D] hover:bg-[#403B9C] text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('scheduleSessionBtn')}</span>
                  </button>
                </div>

                {groupSessions.length === 0 ? (
                  <div className="p-6 bg-white rounded-2xl border border-[#E8E7FF] text-center space-y-2 shadow-xs">
                    <Calendar className="w-8 h-8 mx-auto text-[#74778F] opacity-40" />
                    <p className="font-bold text-[#17163D] text-xs">{isEn ? 'No sessions recorded for this group yet' : 'لا توجد حصص مسجلة لهذه المجموعة بعد'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groupSessions.map((session) => (
                      <div
                        key={session.id}
                        className="p-3 bg-white rounded-2xl border border-[#E8E7FF] flex items-center justify-between gap-2 shadow-xs hover:border-[#7657F6]/40 transition-all"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <strong className="font-black text-xs text-[#17163D] block truncate">
                            {session.title}
                          </strong>
                          <span className="text-[11px] text-[#74778F] block">
                            {getLocalizedWeekdayName(session.dayName)} {session.date} • {formatTimeDisplay(session.startTime, isRTL)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenAttendanceModal(session)}
                          className="px-3 py-1.5 rounded-xl bg-[#17163D] text-white font-bold text-xs flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#55C7E8]" />
                          <span>{session.status === 'completed' ? (isEn ? 'Attendance' : 'الحضور') : (isEn ? 'Take Attendance' : 'رصد')}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Stats */}
            {activeSubTab === 'stats' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-white p-3.5 rounded-2xl border border-[#E8E7FF] text-center space-y-1">
                    <span className="text-[10px] text-[#74778F] font-bold block">{isEn ? 'Total Expected Revenue' : 'إجمالي القيمة المستحقة'}</span>
                    <strong className="text-base font-black text-[#17163D] block">{stats.totalDue} {t('currency')}</strong>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 text-center space-y-1">
                    <span className="text-[10px] text-emerald-800 font-bold block">{isEn ? 'Total Collected' : 'إجمالي المحصل'}</span>
                    <strong className="text-base font-black text-emerald-700 block">{stats.totalRevenue} {t('currency')}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-3 bg-white border-t border-[#E8E7FF] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleDeleteGroup}
              className="p-2 rounded-xl text-[#FF647C] hover:bg-[#FFF1F3] border border-transparent hover:border-[#FECDD3] transition-colors"
              title={isEn ? 'Delete group' : 'حذف المجموعة'}
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onEditGroup(group)}
              className="px-4 py-2 rounded-xl bg-[#17163D] hover:bg-[#403B9C] text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{isEn ? 'Edit Group Info' : 'تعديل بيانات المجموعة'}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
