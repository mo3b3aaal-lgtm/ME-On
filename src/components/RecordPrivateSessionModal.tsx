import React, { useState, useRef } from "react";
import { BottomSheet } from "./ui/BottomSheet";
import { Student } from "../types";
import { recordPrivateSessionsForStudent } from "../utils/storage";
import { useCurrentLocalDate } from "../utils/date";

interface RecordPrivateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student | null;
  onSuccess: () => void;
}

export const RecordPrivateSessionModal: React.FC<RecordPrivateSessionModalProps> = ({
  isOpen,
  onClose,
  student,
  onSuccess,
}) => {
  const currentDate = useCurrentLocalDate();
  const [date, setDate] = useState<string>(currentDate);
  const [time, setTime] = useState<string>("17:00");
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState<string>("");

  const isSubmittingRef = useRef<boolean>(false);
  const lastSubmitTimeRef = useRef<number>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    // STEP 2: Re-entry lock (ignore second call within 1500 ms)
    if (isSubmittingRef.current || now - lastSubmitTimeRef.current < 1500) return;
    if (!student) return;

    isSubmittingRef.current = true;
    lastSubmitTimeRef.current = now;

    try {
      recordPrivateSessionsForStudent(student.id, "private", date, time, {
        durationMinutes: duration,
        notes,
        markPresent: true,
      });
      onSuccess();
      onClose();
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1500);
    }
  };

  if (!student) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`تسجيل حصة خاصة - ${student.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
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
            value={time}
            onChange={e => setTime(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">المدة بالدقائق</label>
          <input 
            type="number"
            min={15}
            step={15}
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الحصة</label>
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
          تسجيل وحفظ الحصة
        </button>
      </form>
    </BottomSheet>
  );
};
