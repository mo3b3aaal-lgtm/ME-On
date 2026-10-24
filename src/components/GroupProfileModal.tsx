import React, { useState, useMemo } from 'react';
import { Group, Student, Session, Enrollment } from '../types';
import { db, getBillingModeLabel } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { StudentAvatar } from './StudentAvatar';
import { BottomSheet } from './ui/BottomSheet';
import { AppIcon } from './ui/AppIcon';
import { StatusBadge } from './ui/StatusBadge';
import { WhiteCard } from './ui/WhiteCard';
import { MintCard } from './ui/MintCard';
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

  // Load group enrollments and active students
  const enrollments: Enrollment[] = useMemo(() => {
    if (!group) return [];
    return db.getGroupEnrollments(group.id);
  }, [group, isOpen]);

  const enrolledStudents: Student[] = useMemo(() => {
    if (!group) return [];
    const allStudents = db.getStudents();
    const enrolledIds = enrollments.map((e) => e.studentId);
    return allStudents.filter((s) => enrolledIds.includes(s.id) && s.status !== 'archived');
  }, [enrollments, group, isOpen]);

  // Load group sessions
  const groupSessions: Session[] = useMemo(() => {
    if (!group) return [];
    return db.getSessions().filter((s) => s.groupId === group.id).sort((a, b) => b.date.localeCompare(a.date));
  }, [group, isOpen]);

  // Financial summary & Attendance stats
  const stats = useMemo(() => {
    if (!group) {
      return { totalRevenue: 0, completedSessions: 0, attendanceRate: 100, totalDue: 0 };
    }

    let revenue = 0;
    let due = 0;
    enrollments.forEach((enr) => {
      const fin = db.calculateEnrollmentFinancials(enr.id);
      if (fin) {
        revenue += fin.totalPaid || 0;
        due += fin.totalDue || 0;
      }
    });

    const completed = groupSessions.filter((s) => s.status === 'completed').length;

    // Calculate attendance percentage across all sessions
    const allAtt = db.getAttendance();
    const groupSessionIds = new Set(groupSessions.map((s) => s.id));
    const groupAtt = allAtt.filter((a) => groupSessionIds.has(a.sessionId));
    const presentCount = groupAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
    const totalRecords = groupAtt.length;
    const rate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 100;

    return {
      totalRevenue: revenue,
      totalDue: due,
      completedSessions: completed,
      attendanceRate: rate,
    };
  }, [group, enrollments, groupSessions, isOpen]);

  if (!group) return null;

  const isPrivate = group.type === 'private';
  const billingLabel = getBillingModeLabel(group.billingType, group.billingMode);

  const handleUnenrollStudent = (studentId: string, studentName: string) => {
    const confirmed = window.confirm(
      isEn
        ? `Are you sure you want to remove ${studentName} from this group?`
        : `هل أنت متأكد من إلغاء اشتراك الطالب (${studentName}) من هذه المجموعة؟`
    );
    if (confirmed) {
      const enr = enrollments.find((e) => e.studentId === studentId);
      if (enr) {
        db.removeEnrollment(enr.id);
        onDataChanged();
      }
    }
  };

  const handleDeleteGroup = () => {
    const confirmed = window.confirm(
      isEn
        ? `Are you sure you want to delete group "${group.name}"? Past recorded sessions and financials will remain preserved.`
        : `هل أنت متأكد من حذف المجموعة "${group.name}"؟ الحصص المسجلة مسبقاً والماليات ستبقى محفوظة.`
    );
    if (confirmed) {
      db.deleteGroup(group.id);
      onDataChanged();
      onClose();
    }
  };

  return (
    <BottomSheet
      id="group-profile"
      transitionVariant="detail"
      isOpen={isOpen}
      onClose={onClose}
      showHandle={true}
      title={group.name}
      subtitle={`${group.subject} • ${getLocalizedStageName(group.gradeLevel)}${group.roomOrLocation ? ` • ${group.roomOrLocation}` : ''}`}
      headerLeading={
        <div className="w-12 h-12 rounded-2xl bg-mint-soft text-navy flex items-center justify-center shrink-0 border border-line">
          <AppIcon name={isPrivate ? 'zap' : 'groups'} size={24} weight="duotone" />
        </div>
      }
      headerTrailing={
        <StatusBadge
          status={isPrivate ? 'active' : 'pending'}
          label={isPrivate ? (isEn ? 'Private' : 'درس خاص') : (isEn ? 'Study Group' : 'مجموعة دراسية')}
        />
      }
      bodyClassName="p-4"
      maxWidthClass="sm:max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDeleteGroup}
            className="btn-danger px-4 text-xs"
          >
            <AppIcon name="trash" size={14} />
            <span>{t('delete')}</span>
          </button>

          <button
            type="button"
            onClick={() => onEditGroup(group)}
            className="btn-orange px-5 text-xs"
          >
            <AppIcon name="edit" size={14} />
            <span>{isEn ? 'Edit Group' : 'تعديل بيانات المجموعة'}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-xs text-navy text-start">
        {/* Quick Metrics KPI Strip */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2.5 rounded-2xl bg-mint-soft border border-line">
            <p className="text-sm sm:text-base font-black text-navy">{enrolledStudents.length}</p>
            <p className="text-[10px] font-bold text-slate mt-0.5">{isEn ? 'Students' : 'الطلاب'}</p>
          </div>

          <div className="p-2.5 rounded-2xl bg-mint-soft border border-line">
            <p className="text-sm sm:text-base font-black text-navy">{stats.completedSessions}</p>
            <p className="text-[10px] font-bold text-slate mt-0.5">{isEn ? 'Sessions' : 'الحصص'}</p>
          </div>

          <div className="p-2.5 rounded-2xl bg-mint-soft border border-line">
            <p className="text-sm sm:text-base font-black text-navy">{stats.attendanceRate}%</p>
            <p className="text-[10px] font-bold text-slate mt-0.5">{isEn ? 'Attendance' : 'الالتزام'}</p>
          </div>

          <div className="p-2.5 rounded-2xl bg-mint-soft border border-line">
            <p className="text-sm sm:text-base font-black text-navy">{group.defaultPrice} {t('currency')}</p>
            <p className="text-[10px] font-bold text-slate mt-0.5 truncate">{billingLabel}</p>
          </div>
        </div>

        {/* Tabs as Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-line">
          {[
            {
              id: 'students' as const,
              label: isEn ? `Students (${enrolledStudents.length})` : `الطلاب (${enrolledStudents.length})`,
              icon: 'students' as const,
            },
            {
              id: 'sessions' as const,
              label: isEn ? `Sessions (${groupSessions.length})` : `الحصص (${groupSessions.length})`,
              icon: 'calendar' as const,
            },
            {
              id: 'stats' as const,
              label: isEn ? 'Stats & Finance' : 'الأداء والماليات',
              icon: 'invoice' as const,
            },
          ].map((tab) => {
            const isSelected = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`chip ${isSelected ? 'chip-active' : ''}`}
              >
                <AppIcon name={tab.icon} size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: Enrolled Students */}
        {activeSubTab === 'students' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-slate">{isEn ? 'Group Students' : 'قائمة طلاب المجموعة'}</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {enrolledStudents.length > 0 && onOpenBulkAddSession && (
                  <button
                    type="button"
                    onClick={() => onOpenBulkAddSession(enrolledStudents, group.id)}
                    className="btn-soft px-2.5 py-1 text-[11px] flex items-center gap-1"
                  >
                    <AppIcon name="calendarCheck" size={13} />
                    <span>{isEn ? `Bulk (${enrolledStudents.length})` : `جدولة جماعية (${enrolledStudents.length})`}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onAddExistingStudent(group)}
                  className="btn-navy px-2.5 py-1 text-[11px] flex items-center gap-1"
                >
                  <AppIcon name="userCheck" size={13} />
                  <span>{isEn ? 'Add Enrolled' : 'إضافة مسجل'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAddNewStudentToGroup(group)}
                  className="btn-soft px-2.5 py-1 text-[11px] flex items-center gap-1"
                >
                  <AppIcon name="plus" size={13} />
                  <span>{isEn ? 'New Student' : 'طالب جديد'}</span>
                </button>
              </div>
            </div>

            {enrolledStudents.length === 0 ? (
              <WhiteCard className="p-6 text-center space-y-2">
                <AppIcon name="students" size={32} className="mx-auto text-slate opacity-40" />
                <p className="font-black text-navy text-sm">{isEn ? 'No students enrolled in this group yet' : 'لا يوجد طلاب مسجلون في هذه المجموعة بعد'}</p>
                <p className="text-[11px] text-slate max-w-xs mx-auto">
                  {isEn ? 'Add existing students from your directory or register a new student directly.' : 'يمكنك إضافة طلاب مسجلين مسبقاً من قاعدة بياناتك أو إنشاء ملف طالب جديد مباشرة.'}
                </p>
              </WhiteCard>
            ) : (
              <div className="space-y-2">
                {enrolledStudents.map((st) => {
                  const enr = enrollments.find((e) => e.studentId === st.id);
                  return (
                    <MintCard
                      key={st.id}
                      className="p-3 flex items-center justify-between gap-2"
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
                        <div className="min-w-0 space-y-0.5 text-start">
                          <p className="font-black text-navy text-xs truncate">
                            {st.name}
                          </p>
                          <p className="text-[10px] text-slate truncate">
                            {getBillingModeLabel(enr?.billingType, enr?.billingMode)} • {enr?.customPrice || group.defaultPrice} {t('currency')}
                            {st.phone ? ` • ${st.phone}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {st.phone && (
                          <a
                            href={`https://wa.me/${st.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-xl bg-page text-navy hover:bg-mint border border-line transition-colors"
                            title="WhatsApp"
                          >
                            <AppIcon name="message" size={13} />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleUnenrollStudent(st.id, st.name)}
                          className="p-1.5 rounded-xl hover:bg-coral-soft text-slate hover:text-coral transition-colors"
                          title={isEn ? 'Remove from group' : 'إلغاء اشتراك'}
                        >
                          <AppIcon name="close" size={13} />
                        </button>
                      </div>
                    </MintCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Sessions */}
        {activeSubTab === 'sessions' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate">{isEn ? 'Group Sessions Schedule' : 'سجل وجدول حصص المجموعة'}</span>
              <button
                type="button"
                onClick={() => onAddSessionForGroup(group)}
                className="btn-orange px-3 py-1.5 text-xs flex items-center gap-1"
              >
                <AppIcon name="plus" size={13} weight="bold" />
                <span>{isEn ? 'Schedule Session' : 'جدولة حصة جديدة'}</span>
              </button>
            </div>

            {groupSessions.length === 0 ? (
              <WhiteCard className="p-6 text-center space-y-2">
                <AppIcon name="calendar" size={32} className="mx-auto text-slate opacity-40" />
                <p className="font-black text-navy text-sm">{isEn ? 'No sessions scheduled yet' : 'لا توجد حصص مجدولة بعد'}</p>
                <p className="text-[11px] text-slate">
                  {isEn ? 'Schedule upcoming classes to track attendance and automatically update financial balances.' : 'جدول حصصك القادمة لرصد الحضور وتحديث الأرصدة المحاسبية آلياً.'}
                </p>
              </WhiteCard>
            ) : (
              <div className="space-y-2">
                {groupSessions.map((sess) => {
                  const isCompleted = sess.status === 'completed';
                  return (
                    <MintCard
                      key={sess.id}
                      className="p-3 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 space-y-0.5 text-start">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-navy text-xs truncate">
                            {sess.title || (isEn ? 'Class Session' : 'حصة دراسية')}
                          </p>
                          <StatusBadge
                            status={isCompleted ? 'active' : 'pending'}
                            label={isCompleted ? (isEn ? 'Completed' : 'مكتملة') : (isEn ? 'Upcoming' : 'قادمة')}
                          />
                        </div>
                        <p className="text-[11px] text-slate">
                          {sess.dayName} {sess.date} • {sess.startTime}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenAttendanceModal(sess)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all ${
                          isCompleted
                            ? 'bg-page border border-line text-navy hover:bg-mint'
                            : 'btn-orange'
                        }`}
                      >
                        <AppIcon name="calendarCheck" size={13} weight="bold" />
                        <span>{isCompleted ? (isEn ? 'Attendance' : 'سجل الحضور') : (isEn ? 'Take Attendance' : 'رصد الحضور')}</span>
                      </button>
                    </MintCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Stats & Finance */}
        {activeSubTab === 'stats' && (
          <div className="space-y-3">
            <WhiteCard className="p-4 space-y-3">
              <span className="font-black text-navy text-xs block">
                {isEn ? 'Financial Overview for this Group' : 'الملخص المالي للمجموعة'}
              </span>

              <div className="grid grid-cols-2 gap-2.5 text-center">
                <div className="p-3.5 rounded-2xl bg-mint-soft border border-line space-y-1">
                  <span className="text-[10px] text-slate font-bold block">{isEn ? 'Total Expected' : 'إجمالي المستحق'}</span>
                  <strong className="text-base font-black text-navy block">{stats.totalDue} {t('currency')}</strong>
                </div>

                <div className="p-3.5 rounded-2xl bg-mint-soft border border-line space-y-1">
                  <span className="text-[10px] text-navy font-bold block">{isEn ? 'Total Collected' : 'إجمالي المحصل'}</span>
                  <strong className="text-base font-black text-navy block">{stats.totalRevenue} {t('currency')}</strong>
                </div>
              </div>
            </WhiteCard>

            <WhiteCard className="p-4 space-y-2">
              <span className="font-black text-navy text-xs block">
                {isEn ? 'Weekly Schedule' : 'مواعيد المجموعة في الجدول الأسبوعي'}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {group.scheduleDays && group.scheduleDays.length > 0 ? (
                  group.scheduleDays.map((d) => (
                    <span key={d} className="px-2.5 py-1 rounded-full bg-mint-soft border border-line text-xs font-bold text-navy">
                      {getLocalizedWeekdayName(d, isRTL)}
                    </span>
                  ))
                ) : (
                  <span className="text-slate text-xs">{isEn ? 'No days specified' : 'لم يتم تحديد أيام'}</span>
                )}
              </div>
            </WhiteCard>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
