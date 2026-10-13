import React, { useState, useRef, useEffect } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { Session, Group } from "../types";
import { db, getDeterministicSessionId } from "../utils/storage";
import { useCurrentLocalDate } from "../utils/date";

interface AddEditSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToEdit?: Session | null;
  groups: Group[];
  onSuccess: () => void;
}

export const AddEditSessionModal: React.FC<AddEditSessionModalProps> = ({
  isOpen,
  onClose,
  sessionToEdit,
  groups,
  onSuccess,
}) => {
  const currentDate = useCurrentLocalDate();
  const [groupId, setGroupId] = useState<string>("");
  const [date, setDate] = useState<string>(currentDate);
  const [startTime, setStartTime] = useState<string>("15:00");
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [title, setTitle] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const isSubmittingRef = useRef<boolean>(false);
  const lastSubmitTimeRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      if (sessionToEdit) {
        setGroupId(sessionToEdit.groupId);
        setDate(sessionToEdit.date);
        setStartTime(sessionToEdit.startTime);
        setDurationMinutes(sessionToEdit.hours ? Math.round(sessionToEdit.hours * 60) : 60);
        setTitle(sessionToEdit.title || "");
        setNotes(sessionToEdit.notes || "");
      } else {
        setGroupId(groups[0]?.id || "general");
        setDate(currentDate);
        setStartTime("15:00");
        setDurationMinutes(60);
        setTitle("");
        setNotes("");
      }
    }
  }, [isOpen, sessionToEdit, groups, currentDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    // STEP 2: Re-entry lock
    if (isSubmittingRef.current || now - lastSubmitTimeRef.current < 1500) return;

    isSubmittingRef.current = true;
    lastSubmitTimeRef.current = now;

    try {
      const sessionId = sessionToEdit?.id || getDeterministicSessionId(date, groupId, "group", startTime);
      const parts = date.split('-').map(Number);
      const year = parts[0] || new Date().getFullYear();
      const month = parts[1] || new Date().getMonth() + 1;
      const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const d = new Date(year, month - 1, parts[2] || 1);
      const dayName = !isNaN(d.getTime()) ? dayNames[d.getDay()] : "السبت";

      db.saveSession({
        ...(sessionToEdit || {}),
        id: sessionId,
        groupId,
        studentId: sessionToEdit?.studentId || "group",
        date,
        dayName,
        month,
        year,
        startTime,
        hours: durationMinutes / 60,
        title: title || "حصة دراسية",
        notes,
        status: sessionToEdit?.status || "scheduled",
        createdAt: sessionToEdit?.createdAt || new Date().toISOString(),
      });

      onSuccess();
      onClose();
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1500);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={sessionToEdit ? "تعديل موعد الحصة" : "إضافة موعد حصة جديد"}>
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">المجموعة / الصف</label>
          <select 
            value={groupId} 
            onChange={e => setGroupId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800"
          >
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">العنوان</label>
          <input 
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="مثال: مراجعة الوحدة الأولى"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ</label>
            <input 
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">الوقت</label>
            <input 
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">المدة بالدقائق</label>
          <input 
            type="number"
            min={15}
            step={15}
            value={durationMinutes}
            onChange={e => setDurationMinutes(Number(e.target.value))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات</label>
          <textarea 
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800"
            rows={2}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmittingRef.current}
          className="w-full py-3.5 bg-[#0F2A4A] text-white font-bold rounded-xl hover:bg-[#17375E] transition-all disabled:opacity-50"
        >
          {sessionToEdit ? "حفظ التعديلات" : "إنشاء الحصة"}
        </button>
      </form>
    </BottomSheet>
  );
};
