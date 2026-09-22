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
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-[#111827] pb-32 bg-[#F7F8FC]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#111827] tracking-tight">
            {t('studentsTitle')} ({students.length})
          </h1>
          <p className="text-xs text-[#64748B] font-medium mt-0.5">
            {t('studentsSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
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
              className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 border cursor-pointer ${
                isSelectionMode
                  ? 'bg-[#172554] text-white border-[#172554] shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-[#172554] border-[#E2E8F0] shadow-2xs'
              }`}
            >
              <CheckSquare className={`w-3.5 h-3.5 ${isSelectionMode ? 'text-white' : 'text-[#C9A227]'}`} />
              <span>{isSelectionMode ? t('exitSelectionMode') : t('selectStudents')}</span>
            </button>
          )}

          <button
            onClick={onOpenAddStudent}
            className="px-3.5 py-2 rounded-xl royal-btn-primary text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addStudent')}</span>
          </button>
        </div>
      </div>

      {/* Selection Mode Toolbar Banner */}
      {isSelectionMode && (
        <div className="p-3 bg-[#FDF8E7] border border-[#EAD89C] rounded-xl flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#9A7718] text-xs">
              {t('selectedCount', { count: selectedCount.toString() })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={isAllFilteredSelected ? handleDeselectAll : handleSelectAllFiltered}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#EAD89C] text-[#9A7718] font-bold text-[11px] hover:bg-amber-50/50 transition-colors cursor-pointer"
            >
              {isAllFilteredSelected ? t('deselectAll') : t('selectAll')}
            </button>
            <button
              type="button"
              onClick={handleExitSelectionMode}
              className="p-1 rounded-lg text-[#64748B] hover:text-[#111827] transition-colors cursor-pointer"
              title={t('exitSelectionMode')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="neu-card p-3.5 space-y-3">
        <div className="relative">
          <Search className={`w-4 h-4 text-[#64748B] absolute top-3 ${language === 'ar' ? 'right-3.5' : 'left-3.5'}`} />
          <input
            type="text"
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-slate-50 border border-[#E2E8F0] rounded-xl py-2 text-xs text-[#111827] placeholder-[#64748B] focus:outline-none focus:border-[#172554] font-medium transition-colors ${
              language === 'ar' ? 'pr-10 pl-8' : 'pl-10 pr-8'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-2.5 text-[#64748B] hover:text-[#111827] p-0.5 rounded-full ${
                language === 'ar' ? 'left-2.5' : 'right-2.5'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <select
            value={selectedGradeFilter}
            onChange={(e) => setSelectedGradeFilter(e.target.value)}
            className="bg-slate-50 border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-[11px] text-[#111827] font-semibold focus:outline-none focus:border-[#172554] cursor-pointer"
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
            className="bg-slate-50 border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-[11px] text-[#111827] font-semibold focus:outline-none focus:border-[#172554] cursor-pointer"
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
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
              onlyDebtors
                ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                : 'bg-slate-50 text-[#64748B] border-[#E2E8F0] hover:bg-slate-100'
            }`}
          >
            {t('onlyDebtors')}
          </button>
        </div>
      </div>

      {/* Student List */}
      {students.length === 0 ? (
        <div className="neu-card p-8 text-center space-y-2">
          <Users className="w-8 h-8 mx-auto text-[#64748B] opacity-60 mb-1" />
          <h3 className="font-bold text-sm text-[#111827]">{t('noStudentsFound')}</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            {t('studentsSubtitle')}
          </p>
          <button
            onClick={onOpenAddStudent}
            className="mt-3 px-3.5 py-1.5 rounded-xl royal-btn-primary text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addStudent')}</span>
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="neu-card p-8 text-center text-[#64748B] space-y-1">
          <AlertCircle className="w-6 h-6 mx-auto opacity-60 text-[#C9A227]" />
          <p className="font-bold text-[#111827] text-xs">{t('noStudentsFound')}</p>
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
                className={`neu-card neu-card-hover p-3.5 transition-all cursor-pointer space-y-2.5 active:scale-[0.99] ${
                  isSelected
                    ? 'border-[#C9A227] bg-[#FDF8E7]/30 ring-2 ring-[#C9A227]/30'
                    : 'hover:border-[#CBD5E1]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Checkbox (if in selection mode) + Avatar + Name + Grade */}
                  <div className="flex items-center gap-3 min-w-0">
                    {isSelectionMode && (
                      <button
                        type="button"
                        onClick={(e) => toggleSelectStudent(student.id, e)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${
                          isSelected
                            ? 'bg-[#172554] border-[#172554] text-white shadow-2xs'
                            : 'bg-white border-[#CBD5E1] text-transparent hover:border-[#172554]'
                        }`}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <StudentAvatar student={student} size="md" />

                    <div className="min-w-0 space-y-0.5">
                      <h3 className="font-bold text-xs sm:text-sm text-[#111827] truncate">
                        {student.name}
                      </h3>
                      <p className="text-[11px] text-[#64748B] font-medium truncate">
                        {getLocalizedStageName(student.gradeLevel) || '-'}
                        {student.phone ? ` • ${student.phone}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Right: Financial Status Chip */}
                  <div className="shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        fin.balance < 0
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : fin.balance > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-[#64748B]'
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

                {/* Enrolled Groups Badges */}
                {studentGroups.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#E2E8F0]">
                    {studentGroups.map(({ group, enrollment }) => (
                      <span
                        key={enrollment.id}
                        className="text-[10px] font-semibold bg-slate-50 border border-[#E2E8F0] text-[#111827] px-2 py-0.5 rounded-md flex items-center gap-1.5"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: group.accentColor || '#172554' }}
                        />
                        <span>{group.name}</span>
                        <span className="text-[#64748B] font-normal">({enrollment.customPrice} {t('currency')})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Action Bar when students are selected */}
      {isSelectionMode && selectedCount > 0 && (
        <div className="fixed bottom-20 inset-x-0 z-40 max-w-lg mx-auto px-4 pb-2 animate-in slide-in-from-bottom-3 duration-200">
          <div className="bg-[#0F172A] text-white p-3 rounded-2xl shadow-xl flex items-center justify-between border border-[#172554]">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#C9A227] text-[#0F172A] flex items-center justify-center font-bold text-xs">
                {selectedCount}
              </span>
              <span className="font-bold text-xs">
                {t('selectedCountShort', { count: selectedCount.toString() })}
              </span>
            </div>

            <button
              type="button"
              onClick={handleBulkAddSession}
              className="px-3.5 py-1.5 rounded-xl royal-btn-gold font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
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
