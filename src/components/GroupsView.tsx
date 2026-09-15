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
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-3.5 text-slate-900 pb-24" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('groupsTitle')} ({regularGroups.length})
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {t('groupsSubtitle')}
          </p>
        </div>

        <button
          onClick={onOpenAddGroup}
          className="px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{t('createGroupBtn')}</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 bg-white border border-slate-200/90 rounded-2xl space-y-2.5 shadow-xs">
        <div className="relative">
          <Search className={`w-4 h-4 text-slate-400 absolute ${isRTL ? 'right-3' : 'left-3'} top-3`} />
          <input
            type="text"
            placeholder={t('groupsSearchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-slate-50 border border-slate-200 rounded-xl ${isRTL ? 'pr-9 pl-8' : 'pl-9 pr-8'} py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-2.5 text-slate-400 hover:text-slate-700 p-0.5 rounded-full ${
                isRTL ? 'left-2.5' : 'right-2.5'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              typeFilter === 'all'
                ? 'bg-blue-600 text-white shadow-2xs font-bold'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {t('all')} ({groups.length})
          </button>
          <button
            onClick={() => setTypeFilter('group')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              typeFilter === 'group'
                ? 'bg-blue-600 text-white shadow-2xs font-bold'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {t('groupTypeGroup')} ({regularGroups.length})
          </button>
          <button
            onClick={() => setTypeFilter('private')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              typeFilter === 'private'
                ? 'bg-blue-600 text-white shadow-2xs font-bold'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {t('groupTypePrivate')} ({privateServices.length})
          </button>
        </div>
      </div>

      {/* Groups Grid / Cards */}
      {groups.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200/90 rounded-2xl text-center space-y-2 shadow-xs">
          <Layers className="w-8 h-8 mx-auto text-slate-400 opacity-60 mb-1" />
          <h3 className="font-bold text-sm text-slate-900">{t('noGroupsRegisteredYet')}</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {t('createFirstGroupPrompt')}
          </p>
          <button
            onClick={onOpenAddGroup}
            className="mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('createGroupBtn')}</span>
          </button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="p-8 bg-white border border-slate-200/90 rounded-2xl text-center text-slate-400 space-y-1">
          <AlertCircle className="w-7 h-7 mx-auto opacity-60" />
          <p className="font-bold text-slate-800 text-xs">{t('noMatchingSearchResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-blue-300 transition-all cursor-pointer space-y-2.5 active:scale-[0.99]"
              >
                {/* Card Top: Accent + Title + Type Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: group.accentColor || (isPrivate ? '#D49B4B' : '#3B82F6') }}
                    />
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs text-slate-900 truncate">
                        {isPrivate ? (privateStudent ? `خاص — ${privateStudent.name}` : 'درس خاص') : group.name}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium truncate">
                        {group.subject} • {getLocalizedStageName(group.gradeLevel, language)}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                    isPrivate ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {isPrivate ? t('groupTypePrivate') : t('groupTypeGroup')}
                  </span>
                </div>

                {/* Pricing & Student Counts Strip */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-xl text-xs border border-slate-100">
                  <div>
                    <span className="text-[9px] text-slate-500 block font-medium">
                      {isPrivate ? 'نوع الخدمة' : t('enrolledStudentsCount')}
                    </span>
                    <strong className="text-xs font-bold text-slate-900 flex items-center gap-1 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isPrivate ? (privateStudent ? privateStudent.name : 'طالب خاص') : `${enrollments.length} ${t('navStudents')}`}</span>
                    </strong>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-500 block font-medium">
                      {group.billingType === 'monthly' ? t('billingMonthly') : group.billingType === 'package' ? t('packagePrice') : group.billingType === 'hourly' ? 'بالساعة' : t('sessionPrice')}
                    </span>
                    <strong className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{group.defaultPrice} {t('currency')}</span>
                    </strong>
                  </div>
                </div>

                {/* Schedule & Location */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1 truncate">
                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{group.scheduleDays.join('، ') || 'Flexible'}</span>
                  </div>

                  {group.scheduleTime && (
                    <div className="flex items-center gap-1 shrink-0 font-medium text-slate-800">
                      <Clock className="w-3 h-3 text-slate-400" />
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
