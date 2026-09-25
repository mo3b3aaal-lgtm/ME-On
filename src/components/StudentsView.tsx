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
  Archive,
  RotateCcw,
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
  onDataChanged?: () => void;
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  groups,
  onOpenAddStudent,
  onOpenStudentProfile,
  onOpenBulkAddSession,
  onDataChanged,
}) => {
  const { t, language } = useTranslation();
  const [activeTabType, setActiveTabType] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [onlyDebtors, setOnlyDebtors] = useState(false);

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  const activeStudentsCount = students.filter((s) => s.status !== 'archived').length;
  const archivedStudentsCount = students.filter((s) => s.status === 'archived').length;

  // Collect distinct grade levels
  const gradeLevels = Array.from(
    new Set(students.map((s) => s.gradeLevel).filter(Boolean))
  ) as string[];

  // Filter students based on active/archived tab and search
  const filteredStudents = students.filter((student) => {
    // 1. Tab filter (active vs archived)
    if (activeTabType === 'active' && student.status === 'archived') {
      return false;
    }
    if (activeTabType === 'archived' && student.status !== 'archived') {
      return false;
    }

    // 2. Text search
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (student.phone && student.phone.includes(searchQuery)) ||
      (student.parentPhone && student.parentPhone.includes(searchQuery)) ||
      (student.parentName && student.parentName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // 3. Grade filter
    if (selectedGradeFilter !== 'all' && student.gradeLevel !== selectedGradeFilter) {
      return false;
    }

    // 4. Group filter
    if (selectedGroupFilter !== 'all') {
      const enrs = db.getStudentEnrollments(student.id);
      const isEnrolled = enrs.some((e) => e.groupId === selectedGroupFilter && e.status !== 'stopped');
      if (!isEnrolled) return false;
    }

    // 5. Debt filter
    if (onlyDebtors) {
      const fin = db.calculateStudentFinancials(student.id);
      if (fin.balance >= 0) return false;
    }

    return true;
  });

  // Handle restoring an archived student
  const handleRestore = (studentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    db.restoreStudent(studentId);
    if (onDataChanged) {
      onDataChanged();
    }
  };

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
    <div className="flex-1 overflow-y-auto overflow-x-hidden max-w-full w-full min-w-0 android-scrollbar p-4 space-y-4 text-[#191A2E] pb-32 bg-[#F6F7FC]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#17163D] tracking-tight flex items-center gap-2">
            <span>{t('studentsTitle')}</span>
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-[#E8E7FF] text-[#7657F6]">
              {activeTabType === 'active' ? activeStudentsCount : archivedStudentsCount}
            </span>
          </h1>
          <p className="text-xs text-[#74778F] font-medium mt-0.5">
            {activeTabType === 'active' ? t('studentsSubtitle') : 'الطلاب المحذوفون مع الاحتفاظ بسجلاتهم التاريخية'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Select Mode Toggle Button */}
          {activeTabType === 'active' && activeStudentsCount > 0 && (
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
                  ? 'bg-[#17163D] text-white border-[#17163D] shadow-md shadow-[#17163D]/20'
                  : 'bg-white hover:bg-[#E8E7FF]/40 text-[#17163D] border-[#E8E7FF] shadow-xs'
              }`}
            >
              <CheckSquare className={`w-3.5 h-3.5 ${isSelectionMode ? 'text-[#FF647C]' : 'text-[#7657F6]'}`} />
              <span>{isSelectionMode ? t('exitSelectionMode') : t('selectStudents')}</span>
            </button>
          )}

          <button
            onClick={onOpenAddStudent}
            className="px-3.5 py-2 rounded-2xl btn-coral text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#FF647C]/30 transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addStudent')}</span>
          </button>
        </div>
      </div>

      {/* Active vs Archived Segmented Control */}
      <div className="classy-segment p-1 flex items-center">
        <button
          type="button"
          onClick={() => {
            setActiveTabType('active');
            handleExitSelectionMode();
          }}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTabType === 'active'
              ? 'classy-segment-btn-active shadow-xs'
              : 'classy-segment-btn-inactive'
          }`}
        >
          <span>الطلاب النشطون</span>
          <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
            activeTabType === 'active' ? 'bg-[#7657F6]/15 text-[#7657F6]' : 'bg-slate-200/80 text-slate-600'
          }`}>
            {activeStudentsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTabType('archived');
            handleExitSelectionMode();
          }}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTabType === 'archived'
              ? 'classy-segment-btn-active shadow-xs'
              : 'classy-segment-btn-inactive'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>الطلاب المؤرشفون</span>
          {archivedStudentsCount > 0 && (
            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
              activeTabType === 'archived' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200/80 text-slate-600'
            }`}>
              {archivedStudentsCount}
            </span>
          )}
        </button>
      </div>

      {/* Selection Mode Toolbar Banner */}
      {isSelectionMode && activeTabType === 'active' && (
        <div className="p-3 bg-[#E8E7FF]/60 border border-[#7657F6]/30 rounded-2xl flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#403B9C] text-xs">
              {t('selectedCount', { count: selectedCount.toString() })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={isAllFilteredSelected ? handleDeselectAll : handleSelectAllFiltered}
              className="px-2.5 py-1 rounded-xl bg-white border border-[#E8E7FF] text-[#7657F6] font-bold text-[11px] hover:bg-[#E8E7FF] transition-colors cursor-pointer"
            >
              {isAllFilteredSelected ? t('deselectAll') : t('selectAll')}
            </button>
            <button
              type="button"
              onClick={handleExitSelectionMode}
              className="p-1 rounded-xl text-[#74778F] hover:text-[#17163D] transition-colors cursor-pointer"
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
          <Search className={`w-4 h-4 text-[#74778F] absolute top-3.5 ${language === 'ar' ? 'right-3.5' : 'left-3.5'}`} />
          <input
            type="text"
            placeholder={activeTabType === 'active' ? t('search') : 'البحث في الطلاب المؤرشفين بالاسم أو الهاتف...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-[#F6F7FC] border border-[#E8E7FF] rounded-2xl py-2.5 text-xs text-[#191A2E] placeholder-[#74778F]/60 focus:outline-none focus:border-[#7657F6] font-medium transition-colors ${
              language === 'ar' ? 'pr-10 pl-8' : 'pl-10 pr-8'
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-2.5 text-[#74778F] hover:text-[#191A2E] p-1 rounded-full ${
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
            className="bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl px-2.5 py-1.5 text-[11px] text-[#191A2E] font-bold focus:outline-none focus:border-[#7657F6] cursor-pointer"
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
            className="bg-[#F6F7FC] border border-[#E8E7FF] rounded-xl px-2.5 py-1.5 text-[11px] text-[#191A2E] font-bold focus:outline-none focus:border-[#7657F6] cursor-pointer"
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
                ? 'bg-[#FF647C] text-white border-[#FF647C] shadow-xs'
                : 'bg-[#F6F7FC] text-[#74778F] border-[#E8E7FF] hover:bg-[#E8E7FF]/40'
            }`}
          >
            {t('onlyDebtors')}
          </button>
        </div>
      </div>

      {/* Student List */}
      {students.length === 0 ? (
        <div className="classy-card p-8 text-center space-y-3 flex flex-col items-center">
          <div className="w-20 h-20 rounded-3xl bg-[#E8E7FF] flex items-center justify-center p-2 shadow-inner">
            <ClassyOwlMascot size="sm" glow={false} pose="happy" />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-sm text-[#17163D]">{t('noStudentsFound')}</h3>
            <p className="text-xs text-[#74778F] max-w-sm mx-auto font-medium">
              {t('studentsSubtitle')}
            </p>
          </div>
          <button
            onClick={onOpenAddStudent}
            className="mt-2 px-4 py-2 rounded-2xl btn-coral text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md shadow-[#FF647C]/30 transition-all cursor-pointer active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addStudent')}</span>
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="classy-card p-8 text-center text-[#74778F] space-y-2">
          {activeTabType === 'archived' ? (
            <Archive className="w-8 h-8 mx-auto text-[#7657F6]" />
          ) : (
            <AlertCircle className="w-8 h-8 mx-auto text-[#FF647C]" />
          )}
          <p className="font-bold text-[#17163D] text-xs">
            {activeTabType === 'archived' ? 'لا يوجد طلاب مطابقين في الأرشيف' : t('noStudentsFound')}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredStudents.map((student) => {
            const studentGroups = db.getStudentGroups(student.id);
            const privateEnrollments = db.getStudentPrivateEnrollments(student.id);
            const fin = db.calculateStudentFinancials(student.id);
            const isSelected = selectedStudentIds.has(student.id);
            const isStudentArchived = student.status === 'archived';

            return (
              <div
                key={student.id}
                onClick={() => {
                  if (isSelectionMode && !isStudentArchived) {
                    toggleSelectStudent(student.id);
                  } else {
                    onOpenStudentProfile(student);
                  }
                }}
                className={`classy-card classy-card-hover p-3.5 transition-all cursor-pointer space-y-2.5 active:scale-[0.99] ${
                  isSelected
                    ? 'border-[#7657F6] bg-[#E8E7FF]/40 ring-2 ring-[#7657F6]/40'
                    : isStudentArchived
                    ? 'bg-slate-50/80 border-slate-200'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Checkbox (if in selection mode) + Avatar + Name + Grade */}
                  <div className="flex items-center gap-3 min-w-0">
                    {isSelectionMode && !isStudentArchived && (
                      <button
                        type="button"
                        onClick={(e) => toggleSelectStudent(student.id, e)}
                        className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                          isSelected
                            ? 'bg-[#7657F6] border-[#7657F6] text-white shadow-2xs'
                            : 'bg-white border-[#E8E7FF] text-transparent hover:border-[#7657F6]'
                        }`}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <StudentAvatar student={student} size="md" />

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-xs sm:text-sm text-[#191A2E] truncate">
                          {student.name}
                        </h3>
                        {isStudentArchived && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                            <Archive className="w-3 h-3 text-amber-700" />
                            <span>مؤرشف</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#74778F] font-medium truncate">
                        {getLocalizedStageName(student.gradeLevel) || '-'}
                        {student.phone ? ` • ${student.phone}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions or Financial Status */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isStudentArchived ? (
                      <button
                        type="button"
                        onClick={(e) => handleRestore(student.id, e)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                        title="استعادة الطالب وإعادته للقائمة النشطة"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                        <span>استعادة</span>
                      </button>
                    ) : (
                      <span
                        className={`text-[10px] font-black px-2.5 py-1 rounded-xl ${
                          fin.balance < 0
                            ? 'bg-[#FF647C]/10 text-[#FF647C] border border-[#FF647C]/25'
                            : fin.balance > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-[#E8E7FF]/60 text-[#403B9C]'
                        }`}
                      >
                        {fin.balance < 0
                          ? `${Math.abs(fin.balance)} ${t('currency')} ${t('hasDue')}`
                          : fin.balance > 0
                          ? `+${fin.balance} ${t('currency')} ${t('hasCredit')}`
                          : t('settled')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Enrolled Groups or Private Badges */}
                {(studentGroups.length > 0 || privateEnrollments.length > 0) && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#E8E7FF]">
                    {studentGroups.map(({ group, enrollment }) => (
                      <span
                        key={enrollment.id}
                        className="text-[10px] font-bold bg-[#F6F7FC] border border-[#E8E7FF] text-[#191A2E] px-2 py-0.5 rounded-lg flex items-center gap-1.5"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: group.accentColor || '#7657F6' }}
                        />
                        <span>{group.name}</span>
                        <span className="text-[#74778F] font-normal">({enrollment.customPrice} {t('currency')})</span>
                      </span>
                    ))}
                    {privateEnrollments.map(({ group, enrollment }) => (
                      <span
                        key={enrollment.id}
                        className="text-[10px] font-bold bg-[#FFF1F3] border border-[#FECDD3] text-[#FF647C] px-2 py-0.5 rounded-lg flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0 bg-[#FF647C] shadow-xs" />
                        <span>درس خاص {group?.subject ? `(${group.subject})` : ''}</span>
                        <span className="text-[#FF647C]/80 font-normal">({enrollment.customPrice || enrollment.hourlyRate || group?.defaultPrice || 0} {t('currency')})</span>
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
      {isSelectionMode && selectedCount > 0 && activeTabType === 'active' && (
        <div className="fixed bottom-20 inset-x-0 z-40 max-w-lg mx-auto px-4 pb-2 animate-in slide-in-from-bottom-3 duration-200">
          <div className="bg-[#17163D] text-white p-3 rounded-2xl shadow-xl flex items-center justify-between border border-[#403B9C]/40">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#FF647C] to-[#7657F6] text-white flex items-center justify-center font-black text-xs shadow-md">
                {selectedCount}
              </span>
              <span className="font-bold text-xs">
                {t('selectedCountShort', { count: selectedCount.toString() })}
              </span>
            </div>

            <button
              type="button"
              onClick={handleBulkAddSession}
              className="px-3.5 py-2 rounded-xl btn-coral text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#FF647C]/30 active:scale-95 transition-all cursor-pointer"
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
