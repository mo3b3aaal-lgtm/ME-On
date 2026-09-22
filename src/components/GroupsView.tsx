import React, { useState } from 'react';
import {
  Layers,
  Search,
  Plus,
  Users,
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  AlertCircle,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import { Group, Student } from '../types';
import { db } from '../utils/storage';
import { getLocalizedStageName } from '../utils/stages';
import { useTranslation } from '../utils/i18n';

interface GroupsViewProps {
  groups: Group[];
  allStudents: Student[];
  onOpenAddGroup: () => void;
  onOpenGroupProfile: (group: Group) => void;
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  groups,
  allStudents,
  onOpenAddGroup,
  onOpenGroupProfile,
}) => {
  const { t, isRTL, language } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'group' | 'private'>('all');

  const regularGroups = groups.filter((g) => g.type !== 'private');
  const privateServices = groups.filter((g) => g.type === 'private');

  const filteredGroups = groups.filter((group) => {
    const enrollments = db.getGroupEnrollments(group.id);
    const privateStudent = group.type === 'private' && enrollments[0]
      ? allStudents.find((s) => s.id === enrollments[0].studentId)
      : null;

    const displayName = group.type === 'private' && privateStudent
      ? privateStudent.name
      : group.name;

    const matchesSearch =
      displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.gradeLevel.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (typeFilter !== 'all' && group.type !== typeFilter) return false;

    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-[#111827] pb-28 bg-[#F7F8FC]" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#111827] tracking-tight">
            {t('groupsTitle')} ({regularGroups.length})
          </h1>
          <p className="text-xs text-[#64748B] font-medium mt-0.5">
            {t('groupsSubtitle')}
          </p>
        </div>

        <button
          onClick={onOpenAddGroup}
          className="px-3.5 py-2 rounded-xl royal-btn-primary text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('createGroupBtn')}</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="neu-card p-3.5 space-y-3">
        <div className="relative">
          <Search className={`w-4 h-4 text-[#64748B] absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-3`} />
          <input
            type="text"
            placeholder={t('groupsSearchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-slate-50 border border-[#E2E8F0] rounded-xl ${isRTL ? 'pr-10 pl-8' : 'pl-10 pr-8'} py-2 text-xs text-[#111827] placeholder-[#64748B] focus:outline-none focus:border-[#172554] font-medium transition-colors`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-2.5 text-[#64748B] hover:text-[#111827] p-0.5 rounded-full ${
                isRTL ? 'left-2.5' : 'right-2.5'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setTypeFilter('all')}
            className={`flex-1 py-1.5 rounded-lg text-xs transition-all text-center cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-[#172554] text-white shadow-2xs font-bold'
                : 'text-[#64748B] hover:text-[#111827] font-semibold'
            }`}
          >
            {t('all')} ({groups.length})
          </button>
          <button
            onClick={() => setTypeFilter('group')}
            className={`flex-1 py-1.5 rounded-lg text-xs transition-all text-center cursor-pointer ${
              typeFilter === 'group'
                ? 'bg-[#172554] text-white shadow-2xs font-bold'
                : 'text-[#64748B] hover:text-[#111827] font-semibold'
            }`}
          >
            {t('groupTypeGroup')} ({regularGroups.length})
          </button>
          <button
            onClick={() => setTypeFilter('private')}
            className={`flex-1 py-1.5 rounded-lg text-xs transition-all text-center cursor-pointer ${
              typeFilter === 'private'
                ? 'bg-[#172554] text-white shadow-2xs font-bold'
                : 'text-[#64748B] hover:text-[#111827] font-semibold'
            }`}
          >
            {t('groupTypePrivate')} ({privateServices.length})
          </button>
        </div>
      </div>

      {/* Groups Grid / Cards */}
      {groups.length === 0 ? (
        <div className="neu-card p-8 text-center space-y-2">
          <Layers className="w-8 h-8 mx-auto text-[#64748B] opacity-60 mb-1" />
          <h3 className="font-bold text-sm text-[#111827]">{t('noGroupsRegisteredYet')}</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto">
            {t('createFirstGroupPrompt')}
          </p>
          <button
            onClick={onOpenAddGroup}
            className="mt-3 px-3.5 py-1.5 rounded-xl royal-btn-primary text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('createGroupBtn')}</span>
          </button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="neu-card p-8 text-center text-[#64748B] space-y-1">
          <AlertCircle className="w-6 h-6 mx-auto opacity-60 text-[#C9A227]" />
          <p className="font-bold text-[#111827] text-xs">{t('noMatchingSearchResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredGroups.map((group) => {
            const enrollments = db.getGroupEnrollments(group.id);
            const isPrivate = group.type === 'private';
            const privateStudent = isPrivate && enrollments[0]
              ? allStudents.find((s) => s.id === enrollments[0].studentId)
              : null;

            return (
              <div
                key={group.id}
                onClick={() => onOpenGroupProfile(group)}
                className="neu-card neu-card-hover p-4 hover:border-[#CBD5E1] transition-all cursor-pointer space-y-3 active:scale-[0.99]"
              >
                {/* Card Top: Accent + Title + Type Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: group.accentColor || (isPrivate ? '#C9A227' : '#172554') }}
                    />
                    <div className="min-w-0 space-y-0.5">
                      <h3 className="font-bold text-xs sm:text-sm text-[#111827] truncate">
                        {isPrivate ? (privateStudent ? `خاص — ${privateStudent.name}` : 'درس خاص') : group.name}
                      </h3>
                      <p className="text-[11px] text-[#64748B] font-medium truncate">
                        {group.subject} • {getLocalizedStageName(group.gradeLevel, language)}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                    isPrivate ? 'bg-[#FDF8E7] text-[#9A7718] border border-[#EAD89C]' : 'bg-[#172554]/10 text-[#172554] border border-[#172554]/20'
                  }`}>
                    {isPrivate ? t('groupTypePrivate') : t('groupTypeGroup')}
                  </span>
                </div>

                {/* Pricing & Student Counts Strip */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs border border-[#E2E8F0]">
                  <div>
                    <span className="text-[10px] text-[#64748B] block font-semibold">
                      {isPrivate ? 'نوع الخدمة' : t('enrolledStudentsCount')}
                    </span>
                    <strong className="text-xs font-bold text-[#111827] flex items-center gap-1.5 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-[#172554]" />
                      <span>{isPrivate ? (privateStudent ? privateStudent.name : 'طالب خاص') : `${enrollments.length} ${t('navStudents')}`}</span>
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#64748B] block font-semibold">
                      {group.billingType === 'monthly' ? t('billingMonthly') : group.billingType === 'package' ? t('packagePrice') : group.billingType === 'hourly' ? 'بالساعة' : t('sessionPrice')}
                    </span>
                    <strong className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mt-0.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{group.defaultPrice} {t('currency')}</span>
                    </strong>
                  </div>
                </div>

                {/* Schedule & Location */}
                <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                  <div className="flex items-center gap-1 truncate font-medium">
                    <Calendar className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                    <span className="truncate">{group.scheduleDays.join('، ') || 'Flexible'}</span>
                  </div>

                  {group.scheduleTime && (
                    <div className="flex items-center gap-1 shrink-0 font-bold text-[#111827]">
                      <Clock className="w-3.5 h-3.5 text-[#64748B]" />
                      <span>{group.scheduleTime}</span>
                    </div>
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
