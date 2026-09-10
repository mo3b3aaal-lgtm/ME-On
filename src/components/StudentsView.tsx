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
  CheckSquare,
  Square,
  CheckCheck,
  CalendarCheck2,
  X,
} from 'lucide-react';
import { Student, Group } from '../types';
import { db } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';
import { StudentAvatar } from './StudentAvatar';
import { useTranslation } from '../utils/i18n';

interface StudentsViewProps {
  students: Student[];
  groups: Group[];
  onOpenAddStudent: () => void;
  onOpenStudentProfile: (student: Student) => void;
  onOpenBulkAddSession?: (students: Student[]) => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  groups,
  onOpenAddStudent,
  onOpenStudentProfile,
  onOpenBulkAddSession,
}) => {
  const { t, language } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [onlyDebtors, setOnlyDebtors] = useState(false);

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

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

  // Toggle single student selection
  const toggleSelectStudent = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all visible filtered students
  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredStudents.map((s) => s.id);
    setSelectedStudentIds(new Set(allFilteredIds));
  };

  // Clear selection
  const handleDeselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  // Exit selection mode
  const handleExitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedStudentIds(new Set());
  };

  // Trigger bulk add session
  const handleBulkAddSession = () => {
    if (selectedStudentIds.size === 0 || !onOpenBulkAddSession) return;
    const selectedList = students.filter((s) => selectedStudentIds.has(s.id));
    onOpenBulkAddSession(selectedList);
  };

  const selectedCount = selectedStudentIds.size;
  const isAllFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedStudentIds.has(s.id));

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-3.5 text-[#2D332A] pb-32" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#2D332A] tracking-tight">
            {t('studentsTitle')} ({students.length})
          </h1>
          <p className="text-xs text-[#8A9187] font-semibold mt-0.5">
            {t('studentsSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Select Mode Toggle Button */}
          {students.length > 0 && (
            <button
              onClick={() => {
                if (isSelectionMode) {
                  handleExitSelectionMode();
                } else {
                  setIsSelectionMode(true);
                }
              }}
              className={`px-3 py-2 rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 border ${
                isSelectionMode
                  ? 'bg-[#E8E2D6] text-[#2D332A] border-[#D4CEBF]'
                  : 'bg-white hover:bg-[#F2ECE1] text-[#6B7567] border-[#E8E2D6]'
              }`}
            >
              <CheckSquare className="w-4 h-4 text-[#748C70]" />
              <span>{isSelectionMode ? t('exitSelectionMode') : t('selectStudents')}</span>
            </button>
          )}

          <button
            onClick={onOpenAddStudent}
            className="px-3 py-2 rounded-2xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addStudent')}</span>
          </button>
        </div>
      </div>

      {/* Selection Mode Toolbar Banner */}
      {isSelectionMode && (
        <div className="p-3 bg-[#748C70]/10 border border-[#748C70]/30 rounded-2xl flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#2D332A] text-xs">
              {t('selectedCount', { count: selectedCount.toString() })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={isAllFilteredSelected ? handleDeselectAll : handleSelectAllFiltered}
              className="px-2.5 py-1 rounded-xl bg-white border border-[#E8E2D6] text-[#2D332A] font-bold text-[11px] hover:bg-[#F9F7F2] transition-colors"
            >
              {isAllFilteredSelected ? t('deselectAll') : t('selectAll')}
            </button>
            <button
              type="button"
              onClick={handleExitSelectionMode}
              className="p-1 rounded-xl text-[#8A9187] hover:text-[#2D332A] transition-colors"
              title={t('exitSelectionMode')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl space-y-2.5 shadow-sm">
        <div className="relative">
          <Search className={`w-4 h-4 text-[#8A9187] absolute top-3 ${language === 'ar' ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl py-2 text-xs text-[#2D332A] placeholder-[#8A9187] focus:outline-none focus:border-[#748C70] font-bold ${
              language === 'ar' ? 'pr-9 pl-8' : 'pl-9 pr-8'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-2.5 text-[#8A9187] hover:text-[#2D332A] p-0.5 rounded-full ${
                language === 'ar' ? 'left-2.5' : 'right-2.5'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <select
            value={selectedGradeFilter}
            onChange={(e) => setSelectedGradeFilter(e.target.value)}
            className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl px-2.5 py-1 text-[11px] text-[#2D332A] font-bold focus:outline-none"
          >
            <option value="all">{t('all')}</option>
            {gradeLevels.map((lvl) => (
              <option key={lvl} value={lvl}>
                {getLocalizedStageName(lvl)}
              </option>
            ))}
          </select>

          <select
            value={selectedGroupFilter}
            onChange={(e) => setSelectedGroupFilter(e.target.value)}
            className="bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl px-2.5 py-1 text-[11px] text-[#2D332A] font-bold focus:outline-none"
          >
            <option value="all">{t('all')}</option>
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
            {t('onlyDebtors')}
          </button>
        </div>
      </div>

      {/* Student List */}
      {students.length === 0 ? (
        <div className="p-8 bg-white border border-[#E8E2D6] rounded-2xl text-center space-y-2 shadow-sm">
          <Users className="w-10 h-10 mx-auto text-[#8A9187] opacity-50 mb-1" />
          <h3 className="font-bold text-sm text-[#2D332A]">{t('noStudentsFound')}</h3>
          <p className="text-xs text-[#8A9187] max-w-sm mx-auto">
            {t('studentsSubtitle')}
          </p>
          <button
            onClick={onOpenAddStudent}
            className="mt-3 px-4 py-2 rounded-xl bg-[#748C70] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addStudent')}</span>
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="p-8 bg-white border border-[#E8E2D6] rounded-2xl text-center text-[#8A9187] space-y-1">
          <AlertCircle className="w-8 h-8 mx-auto opacity-50" />
          <p className="font-bold text-[#2D332A] text-xs">{t('noStudentsFound')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredStudents.map((student) => {
            const studentGroups = db.getStudentGroups(student.id);
            const fin = db.calculateStudentFinancials(student.id);
            const isSelected = selectedStudentIds.has(student.id);

            return (
              <div
                key={student.id}
                onClick={() => {
                  if (isSelectionMode) {
                    toggleSelectStudent(student.id);
                  } else {
                    onOpenStudentProfile(student);
                  }
                }}
                className={`p-3.5 rounded-2xl border shadow-sm transition-all cursor-pointer space-y-2.5 active:scale-[0.99] ${
                  isSelected
                    ? 'bg-[#748C70]/10 border-[#748C70]'
                    : 'bg-white border-[#E8E2D6] hover:border-[#748C70]/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Left: Checkbox (if in selection mode) + Avatar + Name + Grade */}
                  <div className="flex items-center gap-3">
                    {isSelectionMode && (
                      <button
                        type="button"
                        onClick={(e) => toggleSelectStudent(student.id, e)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-[#748C70] border-[#748C70] text-white shadow-xs'
                            : 'bg-white border-[#D4CEBF] text-transparent hover:border-[#748C70]'
                        }`}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <StudentAvatar student={student} size="md" />

                    <div>
                      <h3 className="font-bold text-xs text-[#2D332A] tracking-tight hover:text-[#748C70] transition-colors">
                        {student.name}
                      </h3>
                      <p className="text-[11px] text-[#8A9187] font-semibold">
                        {getLocalizedStageName(student.gradeLevel) || '-'}
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
                        ? `${Math.abs(fin.balance)} ${t('currency')} ${t('hasDue')}`
                        : fin.balance > 0
                        ? `+${fin.balance} ${t('currency')} ${t('hasCredit')}`
                        : t('settled')}
                    </span>
                  </div>
                </div>

                {/* Enrolled Groups Badges (Chips for every group without duplication) */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#E8E2D6]/60">
                  <span className="text-[10px] font-bold text-[#8A9187]">{t('navGroups')}:</span>
                  {studentGroups.length === 0 ? (
                    <span className="text-[10px] text-[#8A9187] italic">-</span>
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
                        <span className="text-[#8A9187]">({enrollment.customPrice} {t('currency')})</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Action Bar when students are selected */}
      {isSelectionMode && selectedCount > 0 && (
        <div className="fixed bottom-16 inset-x-0 z-40 max-w-lg mx-auto px-4 pb-2 animate-in slide-in-from-bottom-3 duration-200">
          <div className="bg-[#2D332A] text-white p-3 rounded-2xl shadow-xl flex items-center justify-between border border-[#434B3E]">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#748C70] flex items-center justify-center font-black text-xs">
                {selectedCount}
              </span>
              <span className="font-bold text-xs">
                {t('selectedCountShort', { count: selectedCount.toString() })}
              </span>
            </div>

            <button
              type="button"
              onClick={handleBulkAddSession}
              className="px-4 py-2 rounded-xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <CalendarCheck2 className="w-4 h-4" />
              <span>{t('addBulkSession')} ({selectedCount})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
