import React, { useState } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Layers,
  Phone,
  Filter,
  DollarSign,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Student, Group } from '../types';
import { db } from '../utils/storage';

interface StudentsViewProps {
  students: Student[];
  groups: Group[];
  onOpenAddStudent: () => void;
  onOpenStudentProfile: (student: Student) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  groups,
  onOpenAddStudent,
  onOpenStudentProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [onlyDebtors, setOnlyDebtors] = useState(false);

  // Collect distinct grade levels
  const gradeLevels = Array.from(
    new Set(students.map((s) => s.gradeLevel).filter(Boolean))
  ) as string[];

  // Filter students
  const filteredStudents = students.filter((student) => {
    // Text search
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.phone && student.phone.includes(searchQuery)) ||
      (student.parentPhone && student.parentPhone.includes(searchQuery)) ||
      (student.parentName && student.parentName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // Grade filter
    if (selectedGradeFilter !== 'all' && student.gradeLevel !== selectedGradeFilter) {
      return false;
    }

    // Group filter
    if (selectedGroupFilter !== 'all') {
      const enrs = db.getStudentEnrollments(student.id);
      const isEnrolled = enrs.some((e) => e.groupId === selectedGroupFilter && e.status !== 'stopped');
      if (!isEnrolled) return false;
    }

    // Debt filter
    if (onlyDebtors) {
      const fin = db.calculateStudentFinancials(student.id);
      if (fin.balance >= 0) return false;
    }

    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-3.5 text-[#2D332A] pb-24" dir="rtl">
      
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#2D332A] tracking-tight">
            دليل الطلاب ({students.length})
          </h1>
          <p className="text-xs text-[#8A9187] font-semibold mt-0.5">
            إدارة الطلاب والاشتراكات والمواقف المالية
          </p>
        </div>

        <button
          onClick={onOpenAddStudent}
          className="px-3 py-2 rounded-2xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة طالب</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl space-y-2.5 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-[#8A9187] absolute right-3 top-3" />
          <input
            type="text"
            placeholder="ابحث باسم الطالب، ولي الأمر، أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl pr-9 pl-3 py-2 text-xs text-[#2D332A] placeholder-[#8A9187] focus:outline-none focus:border-[#748C70]"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <select
            value={selectedGradeFilter}
            onChange={(e) => setSelectedGradeFilter(e.target.value)}
            className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl px-2.5 py-1 text-[11px] text-[#2D332A] font-bold focus:outline-none"
          >
            <option value="all">كل المراحل الدراسية</option>
            {gradeLevels.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>

          <select
            value={selectedGroupFilter}
            onChange={(e) => setSelectedGroupFilter(e.target.value)}
            className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl px-2.5 py-1 text-[11px] text-[#2D332A] font-bold focus:outline-none"
          >
            <option value="all">كل المجموعات</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyDebtors(!onlyDebtors)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all border ${
              onlyDebtors
                ? 'bg-[#C97C5D] text-white border-[#C97C5D]'
                : 'bg-[#F9F7F2] text-[#6B7567] border-[#E8E2D6]'
            }`}
          >
            عليهم مديونية فقط
          </button>
        </div>
      </div>

      {/* Student List */}
      {students.length === 0 ? (
        <div className="p-8 bg-white border border-[#E8E2D6] rounded-2xl text-center space-y-2 shadow-sm">
          <Users className="w-10 h-10 mx-auto text-[#8A9187] opacity-50 mb-1" />
          <h3 className="font-bold text-sm text-[#2D332A]">لا يوجد طلاب مسجلين حتى الآن</h3>
          <p className="text-xs text-[#8A9187] max-w-sm mx-auto">
            قم بإضافة طالبك الأول لحفظ بياناته وتسكينه في مجموعاتك الدراسية وحساب مدفوعاته بدقة.
          </p>
          <button
            onClick={onOpenAddStudent}
            className="mt-3 px-4 py-2 rounded-xl bg-[#748C70] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة طالب جديد الآن</span>
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="p-8 bg-white border border-[#E8E2D6] rounded-2xl text-center text-[#8A9187] space-y-1">
          <AlertCircle className="w-8 h-8 mx-auto opacity-50" />
          <p className="font-bold text-[#2D332A] text-xs">لا يوجد طلاب يطابقون خيارات البحث</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredStudents.map((student) => {
            const studentGroups = db.getStudentGroups(student.id);
            const fin = db.calculateStudentFinancials(student.id);

            return (
              <div
                key={student.id}
                onClick={() => onOpenStudentProfile(student)}
                className="p-3.5 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#748C70]/60 transition-all cursor-pointer space-y-2.5 active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  
                  {/* Left: Avatar + Name + Grade */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shrink-0"
                      style={{ backgroundColor: student.avatarColor || '#748C70' }}
                    >
                      {student.name.charAt(0)}
                    </div>

                    <div>
                      <h3 className="font-bold text-xs text-[#2D332A] tracking-tight hover:text-[#748C70] transition-colors">
                        {student.name}
                      </h3>
                      <p className="text-[11px] text-[#8A9187] font-semibold">
                        {student.gradeLevel || 'الصف غير محدد'}
                        {student.phone ? ` • ${student.phone}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Right: Financial Status Chip */}
                  <div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                        fin.balance < 0
                          ? 'bg-[#C97C5D]/15 text-[#C97C5D]'
                          : fin.balance > 0
                          ? 'bg-[#748C70]/15 text-[#748C70]'
                          : 'bg-[#F2ECE1] text-[#6B7567]'
                      }`}
                    >
                      {fin.balance < 0
                        ? `${Math.abs(fin.balance)} ج مديونية`
                        : fin.balance > 0
                        ? `+${fin.balance} ج رصيد`
                        : 'خالص الحساب'}
                    </span>
                  </div>

                </div>

                {/* Enrolled Groups Badges (Chips for every group without duplication) */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#E8E2D6]/60">
                  <span className="text-[10px] font-bold text-[#8A9187]">المجموعات:</span>
                  {studentGroups.length === 0 ? (
                    <span className="text-[10px] text-[#8A9187] italic">غير مقيد بمجموعة</span>
                  ) : (
                    studentGroups.map(({ group, enrollment }) => (
                      <span
                        key={enrollment.id}
                        className="text-[10px] font-bold bg-[#F9F7F2] border border-[#E8E2D6] text-[#434B3E] px-2 py-0.5 rounded-lg flex items-center gap-1"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: group.accentColor || '#748C70' }}
                        />
                        <span>{group.name}</span>
                        <span className="text-[#8A9187]">({enrollment.customPrice}ج)</span>
                      </span>
                    ))
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
