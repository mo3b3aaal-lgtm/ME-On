import React, { useState, useRef, useEffect } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { AppIcon } from "./ui/AppIcon";
import { Group, Student, Session, AttendanceRecord } from "../types";
import { db, getDeterministicSessionId } from "../utils/storage";
import { useCurrentLocalDate } from "../utils/date";

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
  const lastSubmitTimeRef = useRef<number>(0);

  const groupStudents = students.filter(s => group?.studentIds.includes(s.id));

  useEffect(() => {
    if (isOpen) {
      isSubmittingRef.current = false;
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
    // STEP 2: Re-entry lock
    if (isSubmittingRef.current || now - lastSubmitTimeRef.current < 1500) return;
    if (!group) return;

    isSubmittingRef.current = true;
    lastSubmitTimeRef.current = now;

    try {
      // Read current sessions fresh from db
      const currentSessions = db.getSessions();
      const detId = getDeterministicSessionId(date, group.id, "group", time);

      let targetSession = currentSessions.find(s => s.id === detId || (s.groupId === group.id && s.date === date && s.startTime === time && s.status !== "cancelled"));

      if (!targetSession) {
        targetSession = db.saveSession({
          id: detId,
          groupId: group.id,
          studentId: "group",
          date,
          startTime: time,
          durationMinutes: group.durationMinutes || 60,
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
      for (const st of groupStudents) {
        const attId = `att_${targetSession.id}_${st.id}`;
        db.saveAttendance({
          id: attId,
          sessionId: targetSession.id,
          studentId: st.id,
          date,
          status: statuses[st.id] || "present",
          sessionUnits: 1,
          hours: (group.durationMinutes || 60) / 60,
          timestamp: nowIso,
        });
      }

      onSuccess();
      onClose();
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
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
