import React, { useState, useRef, useEffect } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { AppIcon } from "./ui/AppIcon";
import { Group, Student, Session, Attendance } from "../types";
import { db, getDeterministicSessionId } from "../utils/storage";
import { useCurrentLocalDate } from "../utils/date";
import { parseLocalDateStr } from "../utils/localDate";

interface RecordAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group | null;
  students: Student[];
  onSuccess: () => void;
}

export const RecordAttendanceModal: React.FC<RecordAttendanceModalProps> = ({
  isOpen,
  onClose,
  group,
  students,
  onSuccess,
}) => {
  const currentDate = useCurrentLocalDate();
  const [date, setDate] = useState<string>(currentDate);
  const [time, setTime] = useState<string>("16:00");
  const [statuses, setStatuses] = useState<Record<string, "present" | "absent" | "late" | "excused">>({});
  const isSubmittingRef = useRef<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const lastSubmitTimeRef = useRef<number>(0);

  const enrollments = db.getEnrollments();
  const groupEnrollments = enrollments.filter(
    (e) => e.groupId === group?.id && e.status !== "stopped"
  );
  const groupStudents = students.filter((s) => groupEnrollments.some((e) => e.studentId === s.id));

  useEffect(() => {
    if (isOpen) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      const initial: Record<string, "present" | "absent" | "late" | "excused"> = {};
      groupStudents.forEach(s => {
        initial[s.id] = "present";
      });
      setStatuses(initial);
      if (group?.scheduleTime) setTime(group.scheduleTime);
    }
  }, [isOpen, group]);

  const handleStatusChange = (studentId: string, status: "present" | "absent" | "late" | "excused") => {
    setStatuses(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = () => {
    const now = Date.now();
    // STEP 2 & 3: Re-entry lock (ignore second call within 1500 ms)
    if (isSubmittingRef.current || now - lastSubmitTimeRef.current < 1500) return;
    if (!group) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    lastSubmitTimeRef.current = now;

    try {
      // Read current sessions fresh from db
      const currentSessions = db.getSessions();
      const detId = getDeterministicSessionId(date, group.id, "group", time);

      let targetSession = currentSessions.find(
        (s) => s.id === detId || (s.groupId === group.id && s.date === date && s.startTime === time && s.status !== "cancelled")
      );

      const dateObj = parseLocalDateStr(date);
      const month = !isNaN(dateObj.getTime()) ? dateObj.getMonth() + 1 : new Date().getMonth() + 1;
      const year = !isNaN(dateObj.getTime()) ? dateObj.getFullYear() : new Date().getFullYear();
      const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const dayName = !isNaN(dateObj.getTime()) ? dayNames[dateObj.getDay()] : "السبت";

      if (!targetSession) {
        targetSession = db.saveSession({
          id: detId,
          groupId: group.id,
          studentId: "group",
          date,
          dayName,
          month,
          year,
          startTime: time,
          title: `حصة ${group.name}`,
          status: "completed",
          sessionUnits: 1,
          createdAt: new Date().toISOString(),
        });
      } else {
        targetSession = db.saveSession({
          ...targetSession,
          status: "completed",
        });
      }

      // Record attendance
      const nowIso = new Date().toISOString();
      const attendanceBatch: Attendance[] = groupStudents.map((st) => {
        const enr = groupEnrollments.find((e) => e.studentId === st.id);
        const attId = `att_${targetSession!.id}_${st.id}`;
        return {
          id: attId,
          sessionId: targetSession!.id,
          studentId: st.id,
          enrollmentId: enr?.id,
          status: statuses[st.id] || "present",
          sessionUnits: 1,
          recordedAt: nowIso,
        };
      });

      db.saveAttendanceBatch(targetSession.id, attendanceBatch);

      onSuccess();
      onClose();
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }, 1500);
    }
  };

  if (!group) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`تسجيل حضور - ${group.name}`} size="lg">
      <div className="space-y-4 text-right">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ</label>
            <input 
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الوقت</label>
            <input 
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800"
            />
          </div>
        </div>

        <div className="space-y-2 mt-4">
          <label className="block text-xs font-bold text-slate-700">قائمة الطلاب ({groupStudents.length})</label>
          <div className="space-y-2 max-h-[45vh] overflow-y-auto">
            {groupStudents.map(student => (
              <div key={student.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-sm font-bold text-slate-800">{student.name}</span>
                <div className="flex gap-1">
                  {(["present", "late", "absent", "excused"] as const).map(st => {
                    const isSelected = statuses[student.id] === st;
                    const labels = {
                      present: "حاضر",
                      late: "متأخر",
                      absent: "غائب",
                      excused: "معذور",
                    };
                    const colors = {
                      present: isSelected ? "bg-emerald-600 text-white" : "bg-white text-emerald-700 border-emerald-200",
                      late: isSelected ? "bg-amber-500 text-white" : "bg-white text-amber-700 border-amber-200",
                      absent: isSelected ? "bg-rose-500 text-white" : "bg-white text-rose-700 border-rose-200",
                      excused: isSelected ? "bg-slate-500 text-white" : "bg-white text-slate-700 border-slate-200",
                    };
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusChange(student.id, st)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold transition-all ${colors[st]}`}
                      >
                        {labels[st]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmittingRef.current}
          className="w-full py-3.5 bg-[#0F2A4A] text-white font-bold rounded-xl hover:bg-[#17375E] transition-all disabled:opacity-50 mt-4"
        >
          حفظ الحضور
        </button>
      </div>
    </BottomSheet>
  );
};
