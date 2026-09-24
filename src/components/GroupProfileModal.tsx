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
} from 'lucide-react';
import { Group, Student, Session, Enrollment } from '../types';
import { db, getBillingModeLabel } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';
import { StudentAvatar } from './StudentAvatar';
import { useModalLayer, ModalPortal } from '../contexts/ModalContext';

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
  const groupSessions = group ? db.getSessions().filter((s) => s.groupId === group.id) : [];
  const stats = group ? db.calculateGroupStats(group.id) : {
    studentCount: 0,
    totalSessions: 0,
    completedSessions: 0,
    attendanceRate: 100,
    totalRevenue: 0,
    totalDue: 0,
    remaining: 0,
  };

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

  return (
    <ModalPortal>
      <div
        style={{ zIndex: modalLayer.zIndex }}
        className="fixed inset-0 bg-[#17163D]/70 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="bg-white border border-[#E8E7FF] rounded-t-[28px] sm:rounded-[28px] max-w-lg w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
          
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#17163D] to-[#403B9C] text-white relative">
            <button
              onClick={onClose}
              className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className={`flex items-center gap-3.5 ${isRTL ? 'pl-10' : 'pr-10'}`}>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-xl shadow-md shrink-0 border border-white/20"
                style={{ backgroundColor: group.accentColor || '#7657F6' }}
              >
                <Layers className="w-7 h-7" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-white tracking-tight">{group.name}</h2>
                  <span className="text-[10px] font-bold bg-white/15 text-white px-2.5 py-0.5 rounded-full border border-white/20">
                    {group.type === 'private' ? t('groupTypePrivate') : t('groupTypeGroup')}
                  </span>
                </div>
                <p className="text-xs text-[#E8E7FF]/80 font-semibold mt-0.5">
                  {group.subject} • {getLocalizedStageName(group.gradeLevel, language)}
                </p>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="p-2.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xs">
                <p className="text-sm font-black text-white">{enrolledStudents.length}</p>
                <p className="text-[10px] font-bold text-[#E8E7FF]/80">{t('enrolledStudentsCount')}</p>
              </div>
              
              <div className="p-2.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xs">
                <p className="text-sm font-black text-[#55C7E8]">{stats.completedSessions}</p>
                <p className="text-[10px] font-bold text-[#E8E7FF]/80">{t('dashTotalSessions')}</p>
              </div>

              <div className="p-2.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xs">
                <p className="text-sm font-black text-[#FF647C]">{group.defaultPrice} {t('currency')}</p>
                <p className="text-[10px] font-bold text-[#E8E7FF]/80 truncate">
                  {group.billingType === 'per_session' ? t('sessionPrice') : group.billingType === 'package' ? t('packagePrice') : t('billingMonthly')}
                </p>
              </div>
            </div>

            {/* Schedule & Location */}
            <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between text-xs text-[#E8E7FF] flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#55C7E8]" />
                <span>
                  {t('scheduleDays')}: <strong>{group.scheduleDays.join('، ') || 'Flexible'}</strong> {group.scheduleTime ? `(${group.scheduleTime})` : ''}
                </span>
              </div>

              {group.roomOrLocation && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#FF647C]" />
                  <span>{group.roomOrLocation}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sub-tab Navigation (Segmented Bar) */}
          <div className="p-2 bg-[#F6F7FC] border-b border-[#E8E7FF]">
            <div className="classy-segment">
              <button
                onClick={() => setActiveSubTab('students')}
                className={`classy-segment-btn ${
                  activeSubTab === 'students' ? 'classy-segment-btn-active' : 'classy-segment-btn-inactive'
                }`}
              >
                {t('groupEnrolledTab')} ({enrolledStudents.length})
              </button>
              <button
                onClick={() => setActiveSubTab('sessions')}
                className={`classy-segment-btn ${
                  activeSubTab === 'sessions' ? 'classy-segment-btn-active' : 'classy-segment-btn-inactive'
                }`}
              >
                {t('groupSessionsTab')} ({groupSessions.length})
              </button>
              <button
                onClick={() => setActiveSubTab('stats')}
                className={`classy-segment-btn ${
                  activeSubTab === 'stats' ? 'classy-segment-btn-active' : 'classy-segment-btn-inactive'
                }`}
              >
                {t('groupStatsTab')}
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-3.5 text-xs text-[#191A2E] bg-[#F6F7FC]">
            
            {/* TAB 1: Enrolled Students */}
            {activeSubTab === 'students' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-[#74778F]">{t('groupStudentsListTitle')}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {enrolledStudents.length > 0 && onOpenBulkAddSession && (
                      <button
                        onClick={() => onOpenBulkAddSession(enrolledStudents, group.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-[#E8E7FF] hover:bg-[#D3D0FB] text-[#7657F6] font-bold text-[11px] flex items-center gap-1 border border-[#E8E7FF] transition-all active:scale-95 cursor-pointer"
                      >
                        <CalendarCheck2 className="w-3.5 h-3.5" />
                        <span>{t('addBulkSessionShort')} ({enrolledStudents.length})</span>
                      </button>
                    )}
                    <button
                      onClick={() => onAddExistingStudent(group)}
                      className="px-2.5 py-1.5 rounded-xl btn-primary text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{t('addExistingStudentAction')}</span>
                    </button>
                    <button
                      onClick={() => onAddNewStudentToGroup(group)}
                      className="px-2.5 py-1.5 rounded-xl btn-secondary text-[#17163D] font-bold text-[11px] flex items-center gap-1 border border-[#E8E7FF] transition-all active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('addNewStudentAction')}</span>
                    </button>
                  </div>
                </div>

                {enrolledStudents.length === 0 ? (
                  <div className="p-6 bg-white rounded-2xl border border-[#E8E7FF] text-center space-y-2.5 shadow-xs">
                    <Users className="w-8 h-8 mx-auto text-[#74778F] opacity-50" />
                    <p className="font-bold text-[#191A2E]">{t('noEnrolledStudentsInGroup')}</p>
                    <p className="text-[11px] text-[#74778F] max-w-xs mx-auto">
                      {t('noEnrolledStudentsInGroupDesc')}
                    </p>
                    <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
                      <button
                        onClick={() => onAddExistingStudent(group)}
                        className="px-3.5 py-2 rounded-2xl btn-primary text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{t('addExistingStudentFromSystem')}</span>
                      </button>
                      <button
                        onClick={() => onAddNewStudentToGroup(group)}
                        className="px-3.5 py-2 rounded-2xl btn-secondary text-[#17163D] font-bold text-xs inline-flex items-center gap-1.5 border border-[#E8E7FF] transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t('addNewStudentAction')}</span>
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
                          className="p-3 rounded-2xl bg-white border border-[#E8E7FF] flex items-center justify-between shadow-xs hover:border-[#7657F6]/40 transition-all"
                        >
                          <div
                            onClick={() => onOpenStudentProfile(st)}
                            className="flex items-center gap-2.5 cursor-pointer flex-1"
                          >
                            <StudentAvatar
                              student={st}
                              size="sm"
                              showFrame={true}
                              className="shrink-0"
                            />
                            <div>
                              <p className="font-bold text-[#191A2E] text-xs hover:text-[#7657F6] transition-colors">
                                {st.name}
                              </p>
                              <p className="text-[10px] text-[#74778F]">
                                {getBillingModeLabel(enr?.billingType, enr?.billingMode)} • {enr?.customPrice || group.defaultPrice} {t('currency')}
                                {st.phone ? ` • ${st.phone}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${stFin.balance < 0 ? 'bg-[#FF647C]/12 text-[#FF647C]' : 'bg-emerald-50 text-emerald-700'}`}>
                              {stFin.balance < 0 ? `${Math.abs(stFin.balance)} ${t('currency')} ${t('hasDue')}` : t('settled')}
                            </span>
                            <button
                              onClick={() => handleRemoveStudentFromGroup(st.id, st.name)}
                              className="p-1.5 text-[#74778F] hover:text-[#FF647C] transition-colors cursor-pointer"
                              title={t('confirmRemoveStudentFromGroup')}
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
                  <span className="font-bold text-[#74778F]">{t('groupSessionsListTitle')}</span>
                  <button
                    onClick={() => onAddSessionForGroup(group)}
                    className="px-2.5 py-1 rounded-xl btn-primary text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('scheduleSessionAction')}</span>
                  </button>
                </div>

                {groupSessions.length === 0 ? (
                  <div className="p-6 bg-white rounded-2xl border border-[#E8E7FF] text-center space-y-2 shadow-xs">
                    <CalendarCheck2 className="w-8 h-8 mx-auto text-[#74778F] opacity-50" />
                    <p className="font-bold text-[#191A2E]">{t('noGroupSessionsFound')}</p>
                    <p className="text-[11px] text-[#74778F]">
                      {t('noGroupSessionsDesc')}
                    </p>
                    <button
                      onClick={() => onAddSessionForGroup(group)}
                      className="px-3 py-1.5 rounded-xl btn-primary text-white font-bold text-xs inline-flex items-center gap-1 mt-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('addSession')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groupSessions.map((ses) => (
                      <div
                        key={ses.id}
                        className="p-3 rounded-2xl bg-white border border-[#E8E7FF] flex items-center justify-between shadow-xs"
                      >
                        <div>
                          <p className="font-bold text-[#191A2E] text-xs">{ses.title || t('navSessions')}</p>
                          <p className="text-[10px] text-[#74778F]">
                            {ses.dayName} • {ses.date} • {ses.startTime || ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onOpenAttendanceModal(ses)}
                            className="px-2.5 py-1 rounded-xl btn-violet text-white font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t('recordAttendanceAction')}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Statistics */}
            {activeSubTab === 'stats' && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-white border border-[#E8E7FF] space-y-3 shadow-xs">
                  <h3 className="font-bold text-[#191A2E] text-xs">{t('groupPerformanceTitle')}</h3>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-3 bg-[#F6F7FC] rounded-2xl border border-[#E8E7FF]">
                      <p className="text-sm font-black text-emerald-600">{stats.attendanceRate}%</p>
                      <p className="text-[10px] text-[#74778F] font-bold">{t('averageAttendanceRateLabel')}</p>
                    </div>
                    <div className="p-3 bg-[#F6F7FC] rounded-2xl border border-[#E8E7FF]">
                      <p className="text-sm font-black text-[#7657F6]">{stats.totalRevenue} {t('currency')}</p>
                      <p className="text-[10px] text-[#74778F] font-bold">{t('totalCollectedRevenueLabel')}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Modal Actions Footer */}
          <div className="p-3.5 bg-white border-t border-[#E8E7FF] flex items-center gap-2">
            <button
              onClick={() => {
                onEditGroup(group);
                onClose();
              }}
              className="flex-1 py-2.5 px-3 rounded-2xl btn-secondary text-[#17163D] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-[#E8E7FF] cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#7657F6]" />
              <span>{t('editGroupAction')}</span>
            </button>

            <button
              onClick={() => {
                onAddSessionForGroup(group);
              }}
              className="flex-1 py-2.5 px-3 rounded-2xl btn-coral text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-[#FF647C]/30 cursor-pointer"
            >
              <CalendarCheck2 className="w-3.5 h-3.5" />
              <span>{t('scheduleSessionAction')}</span>
            </button>

            <button
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
