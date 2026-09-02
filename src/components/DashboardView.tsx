import React from 'react';
import {
  Users,
  Layers,
  CalendarCheck2,
  DollarSign,
  UserPlus,
  Plus,
  ArrowUpRight,
  Clock,
  MapPin,
  CheckCircle2,
  Calendar,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { Student, Group, Session, Payment, TeacherProfile } from '../types';
import { db } from '../utils/storage';

interface DashboardViewProps {
  students: Student[];
  groups: Group[];
  sessions: Session[];
  payments: Payment[];
  teacherProfile: TeacherProfile;
  onOpenAddStudent: () => void;
  onOpenAddGroup: () => void;
  onOpenAddSession: () => void;
  onOpenAddPayment: () => void;
  onOpenStudentProfile: (student: Student) => void;
  onOpenGroupProfile: (group: Group) => void;
  onOpenAttendanceModal: (session: Session) => void;
  onNavigateToTab: (tab: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  students,
  groups,
  sessions,
  payments,
  teacherProfile,
  onOpenAddStudent,
  onOpenAddGroup,
  onOpenAddSession,
  onOpenAddPayment,
  onOpenStudentProfile,
  onOpenGroupProfile,
  onOpenAttendanceModal,
  onNavigateToTab,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Filter today's sessions (supports multiple sessions per day)
  const todaySessions = sessions.filter((s) => s.date === todayStr);

  // Month revenues
  const monthPayments = payments.filter((p) => p.month === currentMonth && p.year === currentYear);
  const totalMonthRevenue = monthPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  // Total system attendance rate
  const allAttendance = db.getAttendance();
  const presentRecords = allAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const overallAttendanceRate = allAttendance.length > 0 ? Math.round((presentRecords / allAttendance.length) * 100) : 100;

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-[#2D332A] pb-24" dir="rtl">
      
      {/* Teacher Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#2D332A] tracking-tight">
            مرحباً، {teacherProfile.name || 'أستاذنا الفاضل'}
          </h1>
          <p className="text-xs text-[#8A9187] font-semibold mt-0.5">
            {teacherProfile.subject} • {teacherProfile.centerOrSchool || 'إدارة المدرس'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-white border border-[#E8E2D6] px-3 py-1.5 rounded-2xl shadow-sm">
          <Calendar className="w-4 h-4 text-[#748C70]" />
          <span className="text-xs font-bold text-[#434B3E]">
            {new Date().toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>
      </div>

      {/* 4 Core Metric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        
        {/* Metric 1: Students */}
        <div
          onClick={() => onNavigateToTab('students')}
          className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#748C70]/50 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-[#748C70]">
            <Users className="w-5 h-5" />
            <ArrowUpRight className="w-3.5 h-3.5 text-[#8A9187]" />
          </div>
          <p className="text-2xl font-black text-[#2D332A] mt-1">{students.length}</p>
          <p className="text-[11px] font-bold text-[#8A9187]">إجمالي الطلاب</p>
        </div>

        {/* Metric 2: Groups */}
        <div
          onClick={() => onNavigateToTab('groups')}
          className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#748C70]/50 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-[#D49B4B]">
            <Layers className="w-5 h-5" />
            <ArrowUpRight className="w-3.5 h-3.5 text-[#8A9187]" />
          </div>
          <p className="text-2xl font-black text-[#2D332A] mt-1">{groups.length}</p>
          <p className="text-[11px] font-bold text-[#8A9187]">المجموعات والدروس</p>
        </div>

        {/* Metric 3: Today's Sessions */}
        <div
          onClick={() => onNavigateToTab('sessions')}
          className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#748C70]/50 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-[#5C788A]">
            <CalendarCheck2 className="w-5 h-5" />
            <span className="text-[10px] bg-[#5C788A]/15 text-[#5C788A] px-1.5 py-0.5 rounded-md font-bold">
              اليوم
            </span>
          </div>
          <p className="text-2xl font-black text-[#2D332A] mt-1">{todaySessions.length}</p>
          <p className="text-[11px] font-bold text-[#8A9187]">حصص اليوم</p>
        </div>

        {/* Metric 4: Monthly Revenue */}
        <div
          onClick={() => onNavigateToTab('reports')}
          className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#748C70]/50 transition-all cursor-pointer space-y-1"
        >
          <div className="flex items-center justify-between text-[#748C70]">
            <DollarSign className="w-5 h-5" />
            <TrendingUp className="w-3.5 h-3.5 text-[#748C70]" />
          </div>
          <p className="text-2xl font-black text-[#2D332A] mt-1">{totalMonthRevenue} <span className="text-xs font-bold text-[#8A9187]">ج</span></p>
          <p className="text-[11px] font-bold text-[#8A9187]">تحصيلات الشهر</p>
        </div>

      </div>

      {/* Quick Action Buttons Grid */}
      <div className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm space-y-2.5">
        <h2 className="text-xs font-bold text-[#6B7567]">إجراءات سريعة</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={onOpenAddStudent}
            className="p-2.5 rounded-xl bg-[#F9F7F2] hover:bg-[#F2ECE1] border border-[#E8E2D6] flex items-center gap-2 text-xs font-bold text-[#2D332A] transition-all active:scale-95"
          >
            <div className="p-1.5 rounded-lg bg-[#748C70] text-white">
              <UserPlus className="w-4 h-4" />
            </div>
            <span>إضافة طالب</span>
          </button>

          <button
            onClick={onOpenAddGroup}
            className="p-2.5 rounded-xl bg-[#F9F7F2] hover:bg-[#F2ECE1] border border-[#E8E2D6] flex items-center gap-2 text-xs font-bold text-[#2D332A] transition-all active:scale-95"
          >
            <div className="p-1.5 rounded-lg bg-[#D49B4B] text-white">
              <Layers className="w-4 h-4" />
            </div>
            <span>إنشاء مجموعة</span>
          </button>

          <button
            onClick={onOpenAddSession}
            className="p-2.5 rounded-xl bg-[#F9F7F2] hover:bg-[#F2ECE1] border border-[#E8E2D6] flex items-center gap-2 text-xs font-bold text-[#2D332A] transition-all active:scale-95"
          >
            <div className="p-1.5 rounded-lg bg-[#5C788A] text-white">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
            <span>جدولة حصة</span>
          </button>

          <button
            onClick={onOpenAddPayment}
            className="p-2.5 rounded-xl bg-[#F9F7F2] hover:bg-[#F2ECE1] border border-[#E8E2D6] flex items-center gap-2 text-xs font-bold text-[#2D332A] transition-all active:scale-95"
          >
            <div className="p-1.5 rounded-lg bg-[#748C70] text-white">
              <DollarSign className="w-4 h-4" />
            </div>
            <span>تسجيل دفعة</span>
          </button>
        </div>
      </div>

      {/* Today's Scheduled Sessions Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#2D332A] flex items-center gap-1.5">
            <CalendarCheck2 className="w-4 h-4 text-[#748C70]" />
            <span>جدول حصص اليوم ({todaySessions.length})</span>
          </h2>
          <button
            onClick={onOpenAddSession}
            className="text-[11px] font-bold text-[#748C70] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة حصة اليوم</span>
          </button>
        </div>

        {todaySessions.length === 0 ? (
          <div className="p-6 bg-white border border-[#E8E2D6] rounded-2xl text-center space-y-1.5 shadow-sm">
            <CalendarCheck2 className="w-8 h-8 mx-auto text-[#8A9187] opacity-50" />
            <p className="font-bold text-[#2D332A] text-xs">لا توجد حصص مجدولة لليوم</p>
            <p className="text-[11px] text-[#8A9187]">
              يمكنك جدولة حصة الآن لأي مجموعة من المجموعات
            </p>
            <button
              onClick={onOpenAddSession}
              className="mt-2 px-3 py-1.5 rounded-xl bg-[#748C70] text-white font-bold text-xs inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>جدولة حصة جديدة</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {todaySessions.map((session) => {
              const group = groups.find((g) => g.id === session.groupId);
              const groupStudents = db.getGroupStudents(session.groupId);
              const attendance = db.getSessionAttendance(session.id);
              const isRecorded = attendance.length > 0 || session.status === 'completed';

              return (
                <div
                  key={session.id}
                  className="p-3.5 rounded-2xl bg-white border border-[#E8E2D6] flex items-center justify-between shadow-sm hover:border-[#748C70]/50 transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: group?.accentColor || '#748C70' }}
                      />
                      <h3 className="font-bold text-xs text-[#2D332A]">{session.title}</h3>
                      <span className="text-[10px] bg-[#F2ECE1] text-[#6B7567] px-2 py-0.5 rounded-full font-bold">
                        {group?.name || 'مجموعة'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[#8A9187]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#748C70]" />
                        <span>الساعة {session.startTime || 'غير محدد'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-[#748C70]" />
                        <span>{groupStudents.length} طلاب</span>
                      </span>
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={() => onOpenAttendanceModal(session)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-sm ${
                        isRecorded
                          ? 'bg-[#748C70]/15 text-[#748C70] hover:bg-[#748C70]/25'
                          : 'bg-[#748C70] text-white hover:bg-[#5E755A]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isRecorded ? 'تعديل الحضور' : 'رصد الحضور'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Groups Overview */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#2D332A] flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#D49B4B]" />
            <span>المجموعات الدراسية النشطة</span>
          </h2>
          <button
            onClick={() => onNavigateToTab('groups')}
            className="text-[11px] font-bold text-[#748C70] hover:underline"
          >
            عرض الكل ({groups.length})
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="p-6 bg-white border border-[#E8E2D6] rounded-2xl text-center space-y-1.5 shadow-sm">
            <Layers className="w-8 h-8 mx-auto text-[#8A9187] opacity-50" />
            <p className="font-bold text-[#2D332A] text-xs">لا توجد مجموعات بعد</p>
            <p className="text-[11px] text-[#8A9187]">
              ابدأ بإنشاء مجموعتك الأولى لتنظيم الطلاب والحصص
            </p>
            <button
              onClick={onOpenAddGroup}
              className="mt-2 px-3 py-1.5 rounded-xl bg-[#D49B4B] text-white font-bold text-xs inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إنشاء مجموعة جديدة</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {groups.slice(0, 4).map((group) => {
              const count = db.getGroupEnrollments(group.id).length;
              return (
                <div
                  key={group.id}
                  onClick={() => onOpenGroupProfile(group)}
                  className="p-3 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#748C70]/50 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0"
                      style={{ backgroundColor: group.accentColor || '#748C70' }}
                    >
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#2D332A]">{group.name}</h4>
                      <p className="text-[10px] text-[#8A9187]">
                        {group.subject} • {group.gradeLevel}
                      </p>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-xs font-black text-[#748C70]">{count} طالب</span>
                    <p className="text-[10px] text-[#8A9187]">
                      {group.billingType === 'per_session' ? 'بالحصة' : 'شهري'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
