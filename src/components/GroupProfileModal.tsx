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
  onDataChanged,
}) => {
  if (!isOpen || !group) return null;

  const [activeSubTab, setActiveSubTab] = useState<'students' | 'sessions' | 'stats'>('students');

  // Load data
  const enrollments = db.getGroupEnrollments(group.id);
  const enrolledStudents = db.getGroupStudents(group.id);
  const groupSessions = db.getSessions().filter((s) => s.groupId === group.id);
  const stats = db.calculateGroupStats(group.id);

  const handleRemoveStudentFromGroup = (studentId: string, studentName: string) => {
    const enr = enrollments.find((e) => e.studentId === studentId);
    if (!enr) return;
    if (confirm(`هل أنت متأكد من إزالة ${studentName} من هذه المجموعة؟`)) {
      db.removeEnrollment(enr.id);
      onDataChanged();
    }
  };

  const handleDeleteGroup = () => {
    if (confirm(`هل أنت متأكد من حذف مجموعة ${group.name}؟ لن يتم حذف الطلاب من النظام.`)) {
      db.deleteGroup(group.id);
      onDataChanged();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D332A]/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-t-3xl sm:rounded-[32px] max-w-lg w-full mx-auto max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="p-4 bg-white border-b border-[#E8E2D6] relative">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 rounded-full bg-[#F2ECE1] text-[#6B7567] hover:text-[#2D332A] hover:bg-[#EAE5D8] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5 pl-10">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-xl shadow-md shrink-0"
              style={{ backgroundColor: group.accentColor || '#748C70' }}
            >
              <Layers className="w-7 h-7" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#2D332A] tracking-tight">{group.name}</h2>
                <span className="text-[10px] font-bold bg-[#F2ECE1] text-[#6B7567] px-2.5 py-0.5 rounded-full border border-[#E8E2D6]">
                  {group.type === 'private' ? 'درس خاص' : 'مجموعة عامة'}
                </span>
              </div>
              <p className="text-xs text-[#8A9187] font-semibold mt-0.5">
                مادة {group.subject} • {group.gradeLevel}
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div className="p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
              <p className="text-sm font-black text-[#748C70]">{enrolledStudents.length}</p>
              <p className="text-[10px] font-bold text-[#8A9187]">الطلاب المسجلين</p>
            </div>
            
            <div className="p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
              <p className="text-sm font-black text-[#D49B4B]">{stats.completedSessions}</p>
              <p className="text-[10px] font-bold text-[#8A9187]">الحصص المنفذة</p>
            </div>

            <div className="p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E8E2D6]">
              <p className="text-sm font-black text-[#2D332A]">{group.defaultPrice} ج</p>
              <p className="text-[10px] font-bold text-[#8A9187]">
                {group.billingType === 'per_session' ? 'سعر الحصة' : 'الاشتراك الشهري'}
              </p>
            </div>
          </div>

          {/* Schedule & Location */}
          <div className="mt-3 pt-3 border-t border-[#E8E2D6]/60 flex items-center justify-between text-xs text-[#6B7567] flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#748C70]" />
              <span>المواعيد: <strong>{group.scheduleDays.join('، ') || 'مرنة'}</strong> {group.scheduleTime ? `(${group.scheduleTime})` : ''}</span>
            </div>

            {group.roomOrLocation && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#748C70]" />
                <span>{group.roomOrLocation}</span>
              </div>
            )}
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center border-b border-[#E8E2D6] bg-white px-4">
          <button
            onClick={() => setActiveSubTab('students')}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all ${
              activeSubTab === 'students'
                ? 'border-[#748C70] text-[#748C70]'
                : 'border-transparent text-[#8A9187] hover:text-[#2D332A]'
            }`}
          >
            الطلاب المسجلين ({enrolledStudents.length})
          </button>
          <button
            onClick={() => setActiveSubTab('sessions')}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all ${
              activeSubTab === 'sessions'
                ? 'border-[#748C70] text-[#748C70]'
                : 'border-transparent text-[#8A9187] hover:text-[#2D332A]'
            }`}
          >
            الحصص والجدول ({groupSessions.length})
          </button>
          <button
            onClick={() => setActiveSubTab('stats')}
            className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all ${
              activeSubTab === 'stats'
                ? 'border-[#748C70] text-[#748C70]'
                : 'border-transparent text-[#8A9187] hover:text-[#2D332A]'
            }`}
          >
            الإحصائيات والتحصيلات
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 overflow-y-auto android-scrollbar flex-1 space-y-3.5 text-xs text-[#434B3E]">
          
          {/* TAB 1: Enrolled Students */}
          {activeSubTab === 'students' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#6B7567]">قائمة طلاب المجموعة:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onAddExistingStudent(group)}
                    className="px-2.5 py-1.5 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all active:scale-95"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>إضافة طالب موجود</span>
                  </button>
                  <button
                    onClick={() => onAddNewStudentToGroup(group)}
                    className="px-2 py-1.5 rounded-xl bg-[#F2ECE1] hover:bg-[#EAE5D8] text-[#2D332A] font-bold text-[11px] flex items-center gap-1 border border-[#E8E2D6]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>طالب جديد</span>
                  </button>
                </div>
              </div>

              {enrolledStudents.length === 0 ? (
                <div className="p-6 bg-white rounded-2xl border border-[#E8E2D6] text-center space-y-2">
                  <Users className="w-8 h-8 mx-auto text-[#8A9187] opacity-50" />
                  <p className="font-bold text-[#2D332A]">لا يوجد طلاب مسجلين بهذه المجموعة حتى الآن</p>
                  <p className="text-[11px] text-[#8A9187]">
                    يمكنك إضافة طلاب مسجلين مسبقاً في النظام أو تسجيل طلاب جدد فوراً
                  </p>
                  <div className="pt-2 flex items-center justify-center gap-2">
                    <button
                      onClick={() => onAddExistingStudent(group)}
                      className="px-3 py-2 rounded-xl bg-[#748C70] text-white font-bold text-xs inline-flex items-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>إضافة طالب موجود بالسيستم</span>
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
                        className="p-3 rounded-2xl bg-white border border-[#E8E2D6] flex items-center justify-between shadow-sm hover:border-[#748C70]/40 transition-all"
                      >
                        <div
                          onClick={() => onOpenStudentProfile(st)}
                          className="flex items-center gap-2.5 cursor-pointer flex-1"
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0"
                            style={{ backgroundColor: st.avatarColor || '#748C70' }}
                          >
                            {st.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-[#2D332A] text-xs hover:text-[#748C70] transition-colors">
                              {st.name}
                            </p>
                            <p className="text-[10px] text-[#8A9187]">
                              {getBillingModeLabel(enr?.billingType, enr?.billingMode)} • {enr?.customPrice || group.defaultPrice} ج
                              {st.phone ? ` • ${st.phone}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${stFin.balance < 0 ? 'bg-[#C97C5D]/15 text-[#C97C5D]' : 'bg-[#748C70]/15 text-[#748C70]'}`}>
                            {stFin.balance < 0 ? `${Math.abs(stFin.balance)} ج مديونية` : 'خالص'}
                          </span>
                          <button
                            onClick={() => handleRemoveStudentFromGroup(st.id, st.name)}
                            className="p-1.5 text-[#8A9187] hover:text-[#C97C5D] transition-colors"
                            title="إزالة من المجموعة"
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
                <span className="font-bold text-[#6B7567]">حصص المجموعة:</span>
                <button
                  onClick={() => onAddSessionForGroup(group)}
                  className="px-2.5 py-1 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>جدولة حصة جديدة</span>
                </button>
              </div>

              {groupSessions.length === 0 ? (
                <div className="p-6 bg-white rounded-2xl border border-[#E8E2D6] text-center space-y-2">
                  <CalendarCheck2 className="w-8 h-8 mx-auto text-[#8A9187] opacity-50" />
                  <p className="font-bold text-[#2D332A]">لا توجد حصص مجدولة لهذه المجموعة بعد</p>
                  <p className="text-[11px] text-[#8A9187]">
                    يمكنك جدولة حصة بتحديد التاريخ والموعد وموضوع الدرس
                  </p>
                  <button
                    onClick={() => onAddSessionForGroup(group)}
                    className="px-3 py-1.5 rounded-xl bg-[#748C70] text-white font-bold text-xs inline-flex items-center gap-1 mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة حصة</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupSessions.map((ses) => (
                    <div
                      key={ses.id}
                      className="p-3 rounded-2xl bg-white border border-[#E8E2D6] flex items-center justify-between shadow-sm"
                    >
                      <div>
                        <p className="font-bold text-[#2D332A] text-xs">{ses.title || 'حصة دراسية'}</p>
                        <p className="text-[10px] text-[#8A9187]">
                          {ses.dayName} • {ses.date} • الساعة {ses.startTime || 'غير محدد'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onOpenAttendanceModal(ses)}
                          className="px-2.5 py-1 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-[11px] flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>رصد الحضور</span>
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
              <div className="p-4 rounded-2xl bg-white border border-[#E8E2D6] space-y-3 shadow-sm">
                <h3 className="font-bold text-[#2D332A] text-xs">ملخص أداء المجموعة</h3>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-3 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6]">
                    <p className="text-sm font-black text-[#748C70]">{stats.attendanceRate}%</p>
                    <p className="text-[10px] text-[#8A9187] font-bold">متوسط نسبة الحضور</p>
                  </div>
                  <div className="p-3 bg-[#F9F7F2] rounded-xl border border-[#E8E2D6]">
                    <p className="text-sm font-black text-[#D49B4B]">{stats.totalRevenue} ج</p>
                    <p className="text-[10px] text-[#8A9187] font-bold">إجمالي المحصل</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Actions Footer */}
        <div className="p-3.5 bg-white border-t border-[#E8E2D6] flex items-center gap-2">
          <button
            onClick={() => {
              onEditGroup(group);
              onClose();
            }}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#F2ECE1] hover:bg-[#EAE5D8] text-[#2D332A] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-[#E8E2D6]"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>تعديل المجموعة</span>
          </button>

          <button
            onClick={() => {
              onAddSessionForGroup(group);
            }}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <CalendarCheck2 className="w-3.5 h-3.5" />
            <span>جدولة حصة</span>
          </button>

          <button
            onClick={handleDeleteGroup}
            className="p-2.5 rounded-xl bg-[#FCF6F4] hover:bg-[#F8ECE8] text-[#C97C5D] border border-[#C97C5D]/30"
            title="حذف المجموعة"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
