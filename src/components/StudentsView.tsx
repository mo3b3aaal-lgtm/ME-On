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
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-3.5 text-[#272D24] pb-32" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#272D24] tracking-tight">
            {t('studentsTitle')} ({students.length})
          </h1>
          <p className="text-xs text-[#878E82] font-medium mt-0.5">
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
              className={`px-3 py-2 rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 border ${
                isSelectionMode
                  ? 'bg-[#EAE6DE] text-[#272D24] border-[#DFD9CE]'
                  : 'bg-white hover:bg-[#F5F2EC] text-[#5F675A] border-[#EAE6DE]'
              }`}
            >
              <CheckSquare className="w-4 h-4 text-[#607B5E]" />
              <span>{isSelectionMode ? t('exitSelectionMode') : t('selectStudents')}</span>
            </button>
          )}

          <button
            onClick={onOpenAddStudent}
            className="px-3 py-2 rounded-2xl bg-[#607B5E] hover:bg-[#50684E] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addStudent')}</span>
          </button>
        </div>
      </div>

      {/* Selection Mode Toolbar Banner */}
      {isSelectionMode && (
        <div className="p-3 bg-[#607B5E]/10 border border-[#607B5E]/25 rounded-2xl flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#272D24] text-xs">
              {t('selectedCount', { count: selectedCount.toString() })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={isAllFilteredSelected ? handleDeselectAll : handleSelectAllFiltered}
              className="px-2.5 py-1 rounded-xl bg-white border border-[#EAE6DE] text-[#272D24] font-bold text-[11px] hover:bg-[#FAF8F5] transition-colors"
            >
              {isAllFilteredSelected ? t('deselectAll') : t('selectAll')}
            </button>
            <button
              type="button"
              onClick={handleExitSelectionMode}
              className="p-1 rounded-xl text-[#878E82] hover:text-[#272D24] transition-colors"
              title={t('exitSelectionMode')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl space-y-2 shadow-xs">
        <div className="relative">
          <Search className={`w-4 h-4 text-[#878E82] absolute top-3 ${language === 'ar' ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-[#FAF8F5] border border-[#EAE6DE] rounded-xl py-2 text-xs text-[#272D24] placeholder-[#878E82] focus:outline-none focus:border-[#607B5E] font-medium ${
              language === 'ar' ? 'pr-9 pl-8' : 'pl-9 pr-8'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-2.5 text-[#878E82] hover:text-[#272D24] p-0.5 rounded-full ${
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
            className="bg-[#FAF8F5] border border-[#EAE6DE] rounded-xl px-2.5 py-1 text-[11px] text-[#272D24] font-medium focus:outline-none"
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
            className="bg-[#FAF8F5] border border-[#EAE6DE] rounded-xl px-2.5 py-1 text-[11px] text-[#272D24] font-medium focus:outline-none"
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
            className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all border ${
              onlyDebtors
                ? 'bg-[#B86B52] text-white border-[#B86B52]'
                : 'bg-[#FAF8F5] text-[#5F675A] border-[#EAE6DE]'
            }`}
          >
            {t('onlyDebtors')}
          </button>
        </div>
      </div>

      {/* Student List */}
      {students.length === 0 ? (
        <div className="p-8 bg-white border border-[#EAE6DE] rounded-2xl text-center space-y-2 shadow-xs">
          <Users className="w-8 h-8 mx-auto text-[#878E82] opacity-40 mb-1" />
          <h3 className="font-bold text-sm text-[#272D24]">{t('noStudentsFound')}</h3>
          <p className="text-xs text-[#878E82] max-w-sm mx-auto">
            {t('studentsSubtitle')}
          </p>
          <button
            onClick={onOpenAddStudent}
            className="mt-3 px-4 py-2 rounded-xl bg-[#607B5E] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addStudent')}</span>
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="p-8 bg-white border border-[#EAE6DE] rounded-2xl text-center text-[#878E82] space-y-1">
          <AlertCircle className="w-7 h-7 mx-auto opacity-40" />
          <p className="font-bold text-[#272D24] text-xs">{t('noStudentsFound')}</p>
        </div>
      ) : (
        <div className="bg-white border border-[#EAE6DE] rounded-2xl shadow-xs divide-y divide-[#EAE6DE]/60 overflow-hidden">
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
                className={`p-3 transition-colors cursor-pointer space-y-2 ${
                  isSelected
                    ? 'bg-[#607B5E]/10'
                    : 'hover:bg-[#FAF8F5]/80 active:bg-[#F5F2EC]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Checkbox (if in selection mode) + Avatar + Name + Grade */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isSelectionMode && (
                      <button
                        type="button"
                        onClick={(e) => toggleSelectStudent(student.id, e)}
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${
                          isSelected
                            ? 'bg-[#607B5E] border-[#607B5E] text-white shadow-xs'
                            : 'bg-white border-[#DFD9CE] text-transparent hover:border-[#607B5E]'
                        }`}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <StudentAvatar student={student} size="md" />

                    <div className="min-w-0">
                      <h3 className="font-bold text-xs text-[#272D24] truncate">
                        {student.name}
                      </h3>
                      <p className="text-[10px] text-[#878E82] font-medium truncate">
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
                          ? 'bg-[#B86B52]/12 text-[#9A543E]'
                          : fin.balance > 0
                          ? 'bg-[#607B5E]/12 text-[#4E664C]'
                          : 'bg-[#F5F2EC] text-[#5F675A]'
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
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#EAE6DE]/50">
                    {studentGroups.map(({ group, enrollment }) => (
                      <span
                        key={enrollment.id}
                        className="text-[10px] font-medium bg-[#FAF8F5] border border-[#EAE6DE]/80 text-[#5F675A] px-2 py-0.5 rounded-md flex items-center gap-1"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: group.accentColor || '#607B5E' }}
                        />
                        <span>{group.name}</span>
                        <span className="text-[#878E82]">({enrollment.customPrice} {t('currency')})</span>
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
        <div className="fixed bottom-16 inset-x-0 z-40 max-w-lg mx-auto px-4 pb-2 animate-in slide-in-from-bottom-3 duration-200">
          <div className="bg-[#272D24] text-white p-3 rounded-2xl shadow-xl flex items-center justify-between border border-[#3E453A]">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#607B5E] flex items-center justify-center font-black text-xs">
                {selectedCount}
              </span>
              <span className="font-bold text-xs">
                {t('selectedCountShort', { count: selectedCount.toString() })}
              </span>
            </div>

            <button
              type="button"
              onClick={handleBulkAddSession}
              className="px-4 py-2 rounded-xl bg-[#607B5E] hover:bg-[#50684E] text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
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
