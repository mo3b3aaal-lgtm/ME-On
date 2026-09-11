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

  const filteredGroups = groups.filter((group) => {
    const matchesSearch =
      group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.gradeLevel.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (typeFilter !== 'all' && group.type !== typeFilter) return false;

    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-3.5 text-[#272D24] pb-24" dir={isRTL ? 'rtl' : 'ltr'}>
      
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#272D24] tracking-tight">
            {t('groupsTitle')} ({groups.length})
          </h1>
          <p className="text-xs text-[#878E82] font-medium mt-0.5">
            {t('groupsSubtitle')}
          </p>
        </div>

        <button
          onClick={onOpenAddGroup}
          className="px-3 py-2 rounded-2xl bg-[#607B5E] hover:bg-[#50684E] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{t('createGroupBtn')}</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 bg-white border border-[#EAE6DE] rounded-2xl space-y-2.5 shadow-xs">
        <div className="relative">
          <Search className={`w-4 h-4 text-[#878E82] absolute ${isRTL ? 'right-3' : 'left-3'} top-3`} />
          <input
            type="text"
            placeholder={t('groupsSearchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full bg-[#FAF8F5] border border-[#EAE6DE] rounded-xl ${isRTL ? 'pr-9 pl-8' : 'pl-9 pr-8'} py-2 text-xs text-[#272D24] placeholder-[#878E82] focus:outline-none focus:border-[#607B5E]`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className={`absolute top-2.5 text-[#878E82] hover:text-[#272D24] p-0.5 rounded-full ${
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
                ? 'bg-[#607B5E] text-white shadow-xs font-bold'
                : 'bg-[#FAF8F5] text-[#5F675A] border border-[#EAE6DE] hover:bg-[#F5F2EC]'
            }`}
          >
            {t('all')} ({groups.length})
          </button>
          <button
            onClick={() => setTypeFilter('group')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              typeFilter === 'group'
                ? 'bg-[#607B5E] text-white shadow-xs font-bold'
                : 'bg-[#FAF8F5] text-[#5F675A] border border-[#EAE6DE] hover:bg-[#F5F2EC]'
            }`}
          >
            {t('groupTypeGroup')}
          </button>
          <button
            onClick={() => setTypeFilter('private')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              typeFilter === 'private'
                ? 'bg-[#607B5E] text-white shadow-xs font-bold'
                : 'bg-[#FAF8F5] text-[#5F675A] border border-[#EAE6DE] hover:bg-[#F5F2EC]'
            }`}
          >
            {t('groupTypePrivate')}
          </button>
        </div>
      </div>

      {/* Groups Grid / Cards */}
      {groups.length === 0 ? (
        <div className="p-8 bg-white border border-[#EAE6DE] rounded-2xl text-center space-y-2 shadow-xs">
          <Layers className="w-8 h-8 mx-auto text-[#878E82] opacity-40 mb-1" />
          <h3 className="font-bold text-sm text-[#272D24]">{t('noGroupsRegisteredYet')}</h3>
          <p className="text-xs text-[#878E82] max-w-sm mx-auto">
            {t('createFirstGroupPrompt')}
          </p>
          <button
            onClick={onOpenAddGroup}
            className="mt-3 px-4 py-2 rounded-xl bg-[#607B5E] hover:bg-[#50684E] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('createGroupBtn')}</span>
          </button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="p-8 bg-white border border-[#EAE6DE] rounded-2xl text-center text-[#878E82] space-y-1">
          <AlertCircle className="w-7 h-7 mx-auto opacity-40" />
          <p className="font-bold text-[#272D24] text-xs">{t('noMatchingSearchResults')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filteredGroups.map((group) => {
            const enrollments = db.getGroupEnrollments(group.id);

            return (
              <div
                key={group.id}
                onClick={() => onOpenGroupProfile(group)}
                className="p-3.5 bg-white border border-[#EAE6DE] rounded-2xl shadow-xs hover:border-[#607B5E]/40 transition-all cursor-pointer space-y-2.5 active:scale-[0.99]"
              >
                {/* Card Top: Accent + Title + Type Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: group.accentColor || '#607B5E' }}
                    />
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs text-[#272D24] truncate">
                        {group.name}
                      </h3>
                      <p className="text-[10px] text-[#878E82] font-medium truncate">
                        {group.subject} • {getLocalizedStageName(group.gradeLevel, language)}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-medium bg-[#F5F2EC] text-[#5F675A] px-2 py-0.5 rounded-md shrink-0">
                    {group.type === 'private' ? t('groupTypePrivate') : t('groupTypeGroup')}
                  </span>
                </div>

                {/* Pricing & Student Counts Strip */}
                <div className="grid grid-cols-2 gap-2 bg-[#FAF8F5] p-2 rounded-xl text-xs">
                  <div>
                    <span className="text-[9px] text-[#878E82] block font-medium">{t('enrolledStudentsCount')}</span>
                    <strong className="text-xs font-bold text-[#272D24] flex items-center gap-1 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-[#607B5E]" />
                      <span>{enrollments.length} {t('navStudents')}</span>
                    </strong>
                  </div>

                  <div>
                    <span className="text-[9px] text-[#878E82] block font-medium">
                      {group.billingType === 'monthly' ? t('billingMonthly') : group.billingType === 'package' ? t('packagePrice') : t('sessionPrice')}
                    </span>
                    <strong className="text-xs font-bold text-[#4E664C] flex items-center gap-1 mt-0.5">
                      <DollarSign className="w-3.5 h-3.5 text-[#607B5E]" />
                      <span>{group.defaultPrice} {t('currency')}</span>
                    </strong>
                  </div>
                </div>

                {/* Schedule & Location */}
                <div className="flex items-center justify-between text-[10px] text-[#878E82] pt-1 border-t border-[#EAE6DE]">
                  <div className="flex items-center gap-1 truncate">
                    <Calendar className="w-3 h-3 text-[#586E7E] shrink-0" />
                    <span className="truncate">{group.scheduleDays.join('، ') || 'Flexible'}</span>
                  </div>

                  {group.scheduleTime && (
                    <div className="flex items-center gap-1 shrink-0 font-medium text-[#272D24]">
                      <Clock className="w-3 h-3 text-[#586E7E]" />
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
