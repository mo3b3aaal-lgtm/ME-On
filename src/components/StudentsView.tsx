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
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-3.5 text-slate-900 pb-32" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('studentsTitle')} ({students.length})
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
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
              className={`px-3 py-2 rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 border ${
                isSelectionMode
                  ? 'bg-slate-200 text-slate-900 border-slate-300'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <CheckSquare className="w-4 h-4 text-blue-600" />
              <span>{isSelectionMode ? t('exitSelectionMode') : t('selectStudents')}</span>
            </button>
          )}

          <button
            onClick={onOpenAddStudent}
            className="px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addStudent')}</span>
          </button>
        </div>
      </div>

      {/* Selection Mode Toolbar Banner */}
      {isSelectionMode && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-900 text-xs">
              {t('selectedCount', { count: selectedCount.toString() })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={isAllFilteredSelected ? handleDeselectAll : handleSelectAllFiltered}
              className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-800 font-bold text-[11px] hover:bg-slate-50 transition-colors"
            >
              {isAllFilteredSelected ? t('deselectAll') : t('selectAll')}
            </button>
            <button
              type="button"
              onClick={handleExitSelectionMode}
              className="p-1 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
              title={t('exitSelectionMode')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="p-3 bg-white border border-slate-200/90 rounded-2xl space-y-2 shadow-xs">
        <div className="relative">
          <Search className={`w-4 h-4 text-slate-400 absolute top-3 ${language === 'ar' ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={t('search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-slate-50 border border-slate-200 rounded-xl py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-medium ${
              language === 'ar' ? 'pr-9 pl-8' : 'pl-9 pr-8'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-2.5 text-slate-400 hover:text-slate-700 p-0.5 rounded-full ${
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
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-[11px] text-slate-800 font-medium focus:outline-none"
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
            className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-[11px] text-slate-800 font-medium focus:outline-none"
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
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {t('onlyDebtors')}
          </button>
        </div>
      </div>

      {/* Student List */}
      {students.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200/90 rounded-2xl text-center space-y-2 shadow-xs">
          <Users className="w-8 h-8 mx-auto text-slate-400 opacity-60 mb-1" />
          <h3 className="font-bold text-sm text-slate-900">{t('noStudentsFound')}</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t('studentsSubtitle')}
          </p>
          <button
            onClick={onOpenAddStudent}
            className="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addStudent')}</span>
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200/90 rounded-2xl text-center text-slate-400 space-y-1">
          <AlertCircle className="w-7 h-7 mx-auto opacity-60" />
          <p className="font-bold text-slate-800 text-xs">{t('noStudentsFound')}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs divide-y divide-slate-100 overflow-hidden">
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
                    ? 'bg-blue-50/70'
                    : 'hover:bg-slate-50 active:bg-slate-100/70'
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
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                            : 'bg-white border-slate-300 text-transparent hover:border-blue-500'
                        }`}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <StudentAvatar student={student} size="md" />

                    <div className="min-w-0">
                      <h3 className="font-bold text-xs text-slate-900 truncate">
                        {student.name}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium truncate">
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
                          : 'bg-slate-100 text-slate-600'
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
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                    {studentGroups.map(({ group, enrollment }) => (
                      <span
                        key={enrollment.id}
                        className="text-[10px] font-medium bg-slate-50 border border-slate-200/80 text-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: group.accentColor || '#3B82F6' }}
                        />
                        <span>{group.name}</span>
                        <span className="text-slate-400">({enrollment.customPrice} {t('currency')})</span>
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
          <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl flex items-center justify-between border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-blue-600 flex items-center justify-center font-black text-xs">
                {selectedCount}
              </span>
              <span className="font-bold text-xs">
                {t('selectedCountShort', { count: selectedCount.toString() })}
              </span>
            </div>

            <button
              type="button"
              onClick={handleBulkAddSession}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
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
