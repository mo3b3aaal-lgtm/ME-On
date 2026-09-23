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
import { ClassyOwlMascot } from './ClassyOwlMascot';

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
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-4 text-[#14152C] pb-28 bg-[#F4F3FA]" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-[#14152C] tracking-tight flex items-center gap-2">
            <span>{t('groupsTitle')}</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#EDE8FF] text-[#7B61FF]">
              {regularGroups.length}
            </span>
          </h1>
          <p className="text-xs text-[#727494] font-medium mt-0.5">
            {t('groupsSubtitle')}
          </p>
        </div>

        <button
          onClick={onOpenAddGroup}
          className="px-3.5 py-2 rounded-2xl btn-coral text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#FF5E62]/30 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('createGroupBtn')}</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="classy-card p-3.5 space-y-3">
        <div className="relative">
          <Search className={`w-4 h-4 text-[#727494] absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-3.5`} />
          <input
            type="text"
            placeholder={t('groupsSearchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-[#F4F3FA] border border-[#E8E4F5] rounded-2xl ${isRTL ? 'pr-10 pl-8' : 'pl-10 pr-8'} py-2.5 text-xs text-[#14152C] placeholder-[#9A9CB8] focus:outline-none focus:border-[#7B61FF] font-medium transition-colors`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-2.5 text-[#727494] hover:text-[#14152C] p-1 rounded-full ${
                isRTL ? 'left-2.5' : 'right-2.5'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-[#F4F3FA] p-1 rounded-2xl border border-[#E8E4F5]">
          <button
            onClick={() => setTypeFilter('all')}
            className={`flex-1 py-1.5 rounded-xl text-xs transition-all text-center cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-white text-[#14152C] shadow-sm font-black'
                : 'text-[#727494] hover:text-[#14152C] font-semibold'
            }`}
          >
            {t('all')} ({groups.length})
          </button>
          <button
            onClick={() => setTypeFilter('group')}
            className={`flex-1 py-1.5 rounded-xl text-xs transition-all text-center cursor-pointer ${
              typeFilter === 'group'
                ? 'bg-white text-[#7B61FF] shadow-sm font-black'
                : 'text-[#727494] hover:text-[#14152C] font-semibold'
            }`}
          >
            {t('groupTypeGroup')} ({regularGroups.length})
          </button>
          <button
            onClick={() => setTypeFilter('private')}
            className={`flex-1 py-1.5 rounded-xl text-xs transition-all text-center cursor-pointer ${
              typeFilter === 'private'
                ? 'bg-white text-[#FFAA2C] shadow-sm font-black'
                : 'text-[#727494] hover:text-[#14152C] font-semibold'
            }`}
          >
            {t('groupTypePrivate')} ({privateServices.length})
          </button>
        </div>
      </div>

      {/* Groups Grid / Cards */}
      {groups.length === 0 ? (
        <div className="classy-card p-8 text-center space-y-3 flex flex-col items-center">
          <div className="w-20 h-20 rounded-3xl bg-[#FFF5E5] flex items-center justify-center p-2 shadow-inner">
            <ClassyOwlMascot size="sm" glow={false} pose="teacher" />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-sm text-[#14152C]">{t('noGroupsRegisteredYet')}</h3>
            <p className="text-xs text-[#727494] max-w-sm mx-auto font-medium">
              {t('createFirstGroupPrompt')}
            </p>
          </div>
          <button
            onClick={onOpenAddGroup}
            className="mt-2 px-4 py-2 rounded-2xl btn-coral text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md shadow-[#FF5E62]/30 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t('createGroupBtn')}</span>
          </button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="classy-card p-8 text-center text-[#727494] space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto text-[#FFAA2C]" />
          <p className="font-bold text-[#14152C] text-xs">{t('noMatchingSearchResults')}</p>
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
                className="classy-card classy-card-hover p-4 transition-all cursor-pointer space-y-3 active:scale-[0.99]"
              >
                {/* Card Top: Accent + Title + Type Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: group.accentColor || (isPrivate ? '#FFAA2C' : '#7B61FF') }}
                    />
                    <div className="min-w-0 space-y-0.5">
                      <h3 className="font-bold text-xs sm:text-sm text-[#14152C] truncate">
                        {isPrivate ? (privateStudent ? `خاص — ${privateStudent.name}` : 'درس خاص') : group.name}
                      </h3>
                      <p className="text-[11px] text-[#727494] font-medium truncate">
                        {group.subject} • {getLocalizedStageName(group.gradeLevel, language)}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full shrink-0 ${
                    isPrivate ? 'bg-[#FFF5E5] text-[#FFAA2C] border border-[#FFE8C2]' : 'bg-[#EDE8FF] text-[#7B61FF]'
                  }`}>
                    {isPrivate ? t('groupTypePrivate') : t('groupTypeGroup')}
                  </span>
                </div>

                {/* Pricing & Student Counts Strip */}
                <div className="grid grid-cols-2 gap-2 bg-[#F4F3FA] p-2.5 rounded-2xl text-xs border border-[#E8E4F5]">
                  <div>
                    <span className="text-[10px] text-[#727494] block font-semibold">
                      {isPrivate ? 'نوع الخدمة' : t('enrolledStudentsCount')}
                    </span>
                    <strong className="text-xs font-black text-[#14152C] flex items-center gap-1.5 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-[#7B61FF]" />
                      <span>{isPrivate ? (privateStudent ? privateStudent.name : 'طالب خاص') : `${enrollments.length} ${t('navStudents')}`}</span>
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#727494] block font-semibold">
                      {group.billingType === 'monthly' ? t('billingMonthly') : group.billingType === 'package' ? t('packagePrice') : group.billingType === 'hourly' ? 'بالساعة' : t('sessionPrice')}
                    </span>
                    <strong className="text-xs font-black text-emerald-700 flex items-center gap-1.5 mt-0.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{group.defaultPrice} {t('currency')}</span>
                    </strong>
                  </div>
                </div>

                {/* Schedule & Location */}
                <div className="flex items-center justify-between text-[11px] text-[#727494] pt-1 border-t border-[#E8E4F5]">
                  <div className="flex items-center gap-1 truncate font-medium">
                    <Calendar className="w-3.5 h-3.5 text-[#727494] shrink-0" />
                    <span className="truncate">{group.scheduleDays.join('، ') || 'Flexible'}</span>
                  </div>

                  {group.scheduleTime && (
                    <div className="flex items-center gap-1 shrink-0 font-black text-[#14152C]">
                      <Clock className="w-3.5 h-3.5 text-[#727494]" />
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
