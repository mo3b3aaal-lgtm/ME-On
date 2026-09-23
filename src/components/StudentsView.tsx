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
  Sparkles,
} from 'lucide-react';
import { Student, Group } from '../types';
import { db } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';
import { StudentAvatar } from './StudentAvatar';
import { useTranslation } from '../utils/i18n';
import { ClassyOwlMascot } from './ClassyOwlMascot';

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
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-[#14152C] pb-32 bg-[#F4F3FA]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[#14152C] tracking-tight flex items-center gap-2">
            <span>{t('studentsTitle')}</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#EDE8FF] text-[#7B61FF]">
              {students.length}
            </span>
          </h1>
          <p className="text-xs text-[#727494] font-medium mt-0.5">
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
              className={`px-3 py-2 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 border cursor-pointer ${
                isSelectionMode
                  ? 'bg-[#1E1F3D] text-white border-[#1E1F3D] shadow-md'
                  : 'bg-white hover:bg-[#F4F3FA] text-[#14152C] border-[#E8E4F5] shadow-xs'
              }`}
            >
              <CheckSquare className={`w-3.5 h-3.5 ${isSelectionMode ? 'text-[#FF758C]' : 'text-[#7B61FF]'}`} />
              <span>{isSelectionMode ? t('exitSelectionMode') : t('selectStudents')}</span>
            </button>
          )}

          <button
            onClick={onOpenAddStudent}
            className="px-3.5 py-2 rounded-2xl btn-coral text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#FF5E62]/30 transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addStudent')}</span>
          </button>
        </div>
      </div>

      {/* Selection Mode Toolbar Banner */}
      {isSelectionMode && (
        <div className="p-3 bg-[#FFF5E5] border border-[#FFE2A8] rounded-2xl flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#B45309] text-xs">
              {t('selectedCount', { count: selectedCount.toString() })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={isAllFilteredSelected ? handleDeselectAll : handleSelectAllFiltered}
              className="px-2.5 py-1 rounded-xl bg-white border border-[#FFE2A8] text-[#B45309] font-bold text-[11px] hover:bg-[#FFF5E5] transition-colors cursor-pointer"
            >
              {isAllFilteredSelected ? t('deselectAll') : t('selectAll')}
            </button>
            <button
              type="button"
              onClick={handleExitSelectionMode}
              className="p-1 rounded-xl text-[#727494] hover:text-[#14152C] transition-colors cursor-pointer"
              title={t('exitSelectionMode')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="classy-card p-3.5 space-y-3">
        <div className="relative">
          <Search className={`w-4 h-4 text-[#727494] absolute top-3.5 ${language === 'ar' ? 'right-3.5' : 'left-3.5'}`} />
          <input
            type="text"
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl py-2.5 text-xs text-[#14152C] placeholder-[#9A9CB8] focus:outline-none focus:border-[#7B61FF] font-medium transition-colors ${
              language === 'ar' ? 'pr-10 pl-8' : 'pl-10 pr-8'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-2.5 text-[#727494] hover:text-[#14152C] p-1 rounded-full ${
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
            className="bg-[#F4F3FA] border border-[#E8E4F5] rounded-xl px-2.5 py-1.5 text-[11px] text-[#14152C] font-bold focus:outline-none focus:border-[#7B61FF] cursor-pointer"
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
            className="bg-[#F4F3FA] border border-[#E8E4F5] rounded-xl px-2.5 py-1.5 text-[11px] text-[#14152C] font-bold focus:outline-none focus:border-[#7B61FF] cursor-pointer"
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
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border cursor-pointer ${
              onlyDebtors
                ? 'bg-[#FF5E62] text-white border-[#FF5E62] shadow-xs'
                : 'bg-[#F4F3FA] text-[#727494] border-[#E8E4F5] hover:bg-[#ECEAF6]'
            }`}
          >
            {t('onlyDebtors')}
          </button>
        </div>
      </div>

      {/* Student List */}
      {students.length === 0 ? (
        <div className="classy-card p-8 text-center space-y-3 flex flex-col items-center">
          <div className="w-20 h-20 rounded-3xl bg-[#EDE8FF] flex items-center justify-center p-2 shadow-inner">
            <ClassyOwlMascot size="sm" glow={false} pose="happy" />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-sm text-[#14152C]">{t('noStudentsFound')}</h3>
            <p className="text-xs text-[#727494] max-w-sm mx-auto font-medium">
              {t('studentsSubtitle')}
            </p>
          </div>
          <button
            onClick={onOpenAddStudent}
            className="mt-2 px-4 py-2 rounded-2xl btn-coral text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md shadow-[#FF5E62]/30 transition-all cursor-pointer active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addStudent')}</span>
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="classy-card p-8 text-center text-[#727494] space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-[#FFAA2C]" />
          <p className="font-bold text-[#14152C] text-xs">{t('noStudentsFound')}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
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
                className={`classy-card classy-card-hover p-3.5 transition-all cursor-pointer space-y-2.5 active:scale-[0.99] ${
                  isSelected
                    ? 'border-[#7B61FF] bg-[#EDE8FF]/30 ring-2 ring-[#7B61FF]/40'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Checkbox (if in selection mode) + Avatar + Name + Grade */}
                  <div className="flex items-center gap-3 min-w-0">
                    {isSelectionMode && (
                      <button
                        type="button"
                        onClick={(e) => toggleSelectStudent(student.id, e)}
                        className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                          isSelected
                            ? 'bg-[#7B61FF] border-[#7B61FF] text-white shadow-2xs'
                            : 'bg-white border-[#E8E4F5] text-transparent hover:border-[#7B61FF]'
                        }`}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <StudentAvatar student={student} size="md" />

                    <div className="min-w-0 space-y-0.5">
                      <h3 className="font-bold text-xs sm:text-sm text-[#14152C] truncate">
                        {student.name}
                      </h3>
                      <p className="text-[11px] text-[#727494] font-medium truncate">
                        {getLocalizedStageName(student.gradeLevel) || '-'}
                        {student.phone ? ` • ${student.phone}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Right: Financial Status Chip */}
                  <div className="shrink-0">
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-xl ${
                        fin.balance < 0
                          ? 'bg-[#FFEBEB] text-[#FF5E62] border border-[#FFD6D6]'
                          : fin.balance > 0
                          ? 'bg-[#E0F7EF] text-emerald-700 border border-emerald-200'
                          : 'bg-[#F4F3FA] text-[#727494]'
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
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#E8E4F5]">
                    {studentGroups.map(({ group, enrollment }) => (
                      <span
                        key={enrollment.id}
                        className="text-[10px] font-bold bg-[#F4F3FA] border border-[#E8E4F5] text-[#14152C] px-2 py-0.5 rounded-lg flex items-center gap-1.5"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: group.accentColor || '#7B61FF' }}
                        />
                        <span>{group.name}</span>
                        <span className="text-[#727494] font-normal">({enrollment.customPrice} {t('currency')})</span>
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
          <div className="bg-[#1E1F3D] text-white p-3 rounded-2xl shadow-xl flex items-center justify-between border border-[#2D2F57]">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#FF5E62] to-[#FF758C] text-white flex items-center justify-center font-black text-xs shadow-md">
                {selectedCount}
              </span>
              <span className="font-bold text-xs">
                {t('selectedCountShort', { count: selectedCount.toString() })}
              </span>
            </div>

            <button
              type="button"
              onClick={handleBulkAddSession}
              className="px-3.5 py-2 rounded-xl btn-coral text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#FF5E62]/30 active:scale-95 transition-all cursor-pointer"
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
