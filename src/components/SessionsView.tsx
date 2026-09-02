import React, { useState } from 'react';
import {
  CalendarCheck2,
  Calendar,
  Clock,
  Plus,
  Users,
  CheckCircle2,
  Filter,
  DollarSign,
  AlertCircle,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Session, Group } from '../types';
import { db } from '../utils/storage';

interface SessionsViewProps {
  sessions: Session[];
  groups: Group[];
  onOpenAddSession: (defaultGroupId?: string) => void;
  onEditSession: (session: Session) => void;
  onOpenAttendanceModal: (session: Session) => void;
  onSessionDeleted: () => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  groups,
  onOpenAddSession,
  onEditSession,
  onOpenAttendanceModal,
  onSessionDeleted,
}) => {
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');

  const handleDelete = (session: Session) => {
    if (confirm(`هل أنت متأكد من حذف حصة "${session.title}"؟`)) {
      db.deleteSession(session.id);
      onSessionDeleted();
    }
  };

  const filteredSessions = sessions.filter((session) => {
    if (selectedGroupFilter !== 'all' && session.groupId !== selectedGroupFilter) return false;
    if (statusFilter !== 'all' && session.status !== statusFilter) return false;
    if (selectedDate && session.date !== selectedDate) return false;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-3.5 text-[#2D332A] pb-24" dir="rtl">
      
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#2D332A] tracking-tight">
            جدول وسجل الحصص ({sessions.length})
          </h1>
          <p className="text-xs text-[#8A9187] font-semibold mt-0.5">
            متابعة الحصص المنفذة والقادمة ورصد الحضور بدقة
          </p>
        </div>

        <button
          onClick={() => onOpenAddSession()}
          className="px-3 py-2 rounded-2xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>جدولة حصة</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl space-y-2.5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          
          <div>
            <label className="block text-[10px] text-[#8A9187] font-bold mb-1">المجموعة</label>
            <select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value)}
              className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl px-2.5 py-1.5 text-xs text-[#2D332A] font-bold focus:outline-none"
            >
              <option value="all">كل المجموعات</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-[#8A9187] font-bold mb-1">حالة الحصة</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl px-2.5 py-1.5 text-xs text-[#2D332A] font-bold focus:outline-none"
            >
              <option value="all">كل الحالات</option>
              <option value="scheduled">مجدولة (قادمة)</option>
              <option value="completed">مكتملة</option>
              <option value="cancelled">ملغاة</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-[#8A9187] font-bold mb-1">تصفية بالتاريخ المحدد</label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl px-2.5 py-1.5 text-xs text-[#2D332A] focus:outline-none"
              />
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="px-2 py-1.5 text-[11px] bg-[#F2ECE1] text-[#6B7567] rounded-xl font-bold"
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="p-8 bg-white border border-[#E8E2D6] rounded-2xl text-center space-y-2 shadow-sm">
          <CalendarCheck2 className="w-10 h-10 mx-auto text-[#8A9187] opacity-50 mb-1" />
          <h3 className="font-bold text-sm text-[#2D332A]">لا توجد حصص مسجلة بعد</h3>
          <p className="text-xs text-[#8A9187] max-w-sm mx-auto">
            قم بجدولة حصتك الأولى لتسجيل الحضور وتحصيل مصاريف الحصة للطلاب المسجلين.
          </p>
          <button
            onClick={() => onOpenAddSession()}
            className="mt-3 px-4 py-2 rounded-xl bg-[#748C70] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>جدولة حصة جديدة الآن</span>
          </button>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="p-8 bg-white border border-[#E8E2D6] rounded-2xl text-center text-[#8A9187] space-y-1">
          <AlertCircle className="w-8 h-8 mx-auto opacity-50" />
          <p className="font-bold text-[#2D332A] text-xs">لا توجد حصص تطابق خيارات التصفية</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredSessions.map((session) => {
            const group = groups.find((g) => g.id === session.groupId);
            const groupStudents = db.getGroupStudents(session.groupId);
            const attendance = db.getSessionAttendance(session.id);
            const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
            const chargedAbsentCount = attendance.filter(
              (a) => a.isCharged || a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)
            ).length;
            const freeAbsentCount = attendance.filter(
              (a) => a.status === 'absent_free' || a.status === 'excused' || a.isCharged === false
            ).length;

            return (
              <div
                key={session.id}
                className={`p-4 bg-white border rounded-2xl shadow-sm transition-all space-y-3 ${
                  session.status === 'cancelled'
                    ? 'border-[#C97C5D]/30 bg-[#C97C5D]/5'
                    : 'border-[#E8E2D6] hover:border-[#748C70]/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: group?.accentColor || '#748C70' }}
                      />
                      <h3 className="font-bold text-xs text-[#2D332A]">{session.title}</h3>
                      <span className="text-[10px] font-bold bg-[#F2ECE1] text-[#6B7567] px-2 py-0.5 rounded-full border border-[#E8E2D6]">
                        {group?.name || 'مجموعة'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-[#8A9187] flex-wrap pt-0.5">
                      <span className="flex items-center gap-1 font-bold text-[#434B3E]">
                        <Calendar className="w-3.5 h-3.5 text-[#748C70]" />
                        <span>{session.dayName} {session.date}</span>
                      </span>

                      {session.startTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#748C70]" />
                          <span>الساعة {session.startTime}</span>
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#748C70]" />
                        <span>{groupStudents.length} طالب مقيد</span>
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                        session.status === 'completed'
                          ? 'bg-[#748C70]/15 text-[#748C70]'
                          : session.status === 'cancelled'
                          ? 'bg-[#C97C5D]/15 text-[#C97C5D]'
                          : 'bg-[#D49B4B]/15 text-[#D49B4B]'
                      }`}
                    >
                      {session.status === 'completed'
                        ? 'مكتملة'
                        : session.status === 'cancelled'
                        ? 'ملغاة'
                        : 'مجدولة'}
                    </span>
                  </div>
                </div>

                {/* Cancelled Notice if applicable */}
                {session.status === 'cancelled' && (
                  <div className="p-2 rounded-xl bg-[#C97C5D]/10 border border-[#C97C5D]/20 text-[#A85B3F] text-[11px] font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>حصة ملغاة بالكامل: لا تُحسب حضوراً، لا تستهلك رصيد حصص، ولا تضيف أي مبالغ مستحقة.</span>
                  </div>
                )}

                {/* Session Homework / Notes if any */}
                {session.notes && (
                  <p className="text-[11px] bg-[#F9F7F2] p-2 rounded-xl text-[#6B7567] border border-[#E8E2D6]">
                    <strong>ملاحظات / واجب:</strong> {session.notes}
                  </p>
                )}

                {/* Action Strip */}
                <div className="flex items-center justify-between pt-2 border-t border-[#E8E2D6]/60">
                  <div className="text-[11px] text-[#8A9187]">
                    {attendance.length > 0 ? (
                      <span className="font-bold text-[#748C70] flex items-center gap-1.5 flex-wrap">
                        <span>تم رصد الحضور:</span>
                        <span className="text-[#748C70]">حاضر: {presentCount}</span>
                        {chargedAbsentCount > 0 && (
                          <span className="text-[#C97C5D]">• محسوبة: {chargedAbsentCount}</span>
                        )}
                        {freeAbsentCount > 0 && (
                          <span className="text-[#8A9187]">• غير محسوبة: {freeAbsentCount}</span>
                        )}
                      </span>
                    ) : (
                      <span>لم يتم رصد الحضور بعد</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenAttendanceModal(session)}
                      className="px-3 py-1.5 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{attendance.length > 0 ? 'تعديل الحضور' : 'رصد الحضور'}</span>
                    </button>

                    <button
                      onClick={() => onEditSession(session)}
                      className="p-1.5 rounded-xl bg-[#F2ECE1] text-[#6B7567] hover:text-[#2D332A] hover:bg-[#EAE5D8]"
                      title="تعديل الحصة"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(session)}
                      className="p-1.5 rounded-xl bg-[#FCF6F4] text-[#C97C5D] hover:bg-[#F8ECE8]"
                      title="حذف الحصة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
