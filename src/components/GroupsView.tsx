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
} from 'lucide-react';
import { Group, Student } from '../types';
import { db } from '../utils/storage';

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
    <div className="flex-1 overflow-y-auto android-scrollbar p-4 space-y-3.5 text-[#2D332A] pb-24" dir="rtl">
      
      {/* View Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[#2D332A] tracking-tight">
            المجموعات والدروس ({groups.length})
          </h1>
          <p className="text-xs text-[#8A9187] font-semibold mt-0.5">
            إدارة المجموعات العامة والدروس الخصوصية ومواعيدها
          </p>
        </div>

        <button
          onClick={onOpenAddGroup}
          className="px-3 py-2 rounded-2xl bg-[#748C70] hover:bg-[#5E755A] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء مجموعة</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-3 bg-white border border-[#E8E2D6] rounded-2xl space-y-2.5 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-[#8A9187] absolute right-3 top-3" />
          <input
            type="text"
            placeholder="ابحث باسم المجموعة، المادة، أو الصف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F9F7F2] border border-[#E8E2D6] rounded-xl pr-9 pl-3 py-2 text-xs text-[#2D332A] placeholder-[#8A9187] focus:outline-none focus:border-[#748C70]"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              typeFilter === 'all'
                ? 'bg-[#748C70] text-white shadow-sm'
                : 'bg-[#F9F7F2] text-[#6B7567] border border-[#E8E2D6]'
            }`}
          >
            الكل ({groups.length})
          </button>
          <button
            onClick={() => setTypeFilter('group')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              typeFilter === 'group'
                ? 'bg-[#748C70] text-white shadow-sm'
                : 'bg-[#F9F7F2] text-[#6B7567] border border-[#E8E2D6]'
            }`}
          >
            مجموعات عامة
          </button>
          <button
            onClick={() => setTypeFilter('private')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              typeFilter === 'private'
                ? 'bg-[#748C70] text-white shadow-sm'
                : 'bg-[#F9F7F2] text-[#6B7567] border border-[#E8E2D6]'
            }`}
          >
            دروس خاصة / Private
          </button>
        </div>
      </div>

      {/* Groups Grid / Cards */}
      {groups.length === 0 ? (
        <div className="p-8 bg-white border border-[#E8E2D6] rounded-2xl text-center space-y-2 shadow-sm">
          <Layers className="w-10 h-10 mx-auto text-[#8A9187] opacity-50 mb-1" />
          <h3 className="font-bold text-sm text-[#2D332A]">لا توجد مجموعات مسجلة بعد</h3>
          <p className="text-xs text-[#8A9187] max-w-sm mx-auto">
            قم بإنشاء مجموعتك الأولى لتحديد مواعيد الحصص ونظام المحاسبة وإضافة الطلاب إليها.
          </p>
          <button
            onClick={onOpenAddGroup}
            className="mt-3 px-4 py-2 rounded-xl bg-[#748C70] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء مجموعة جديدة الآن</span>
          </button>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="p-8 bg-white border border-[#E8E2D6] rounded-2xl text-center text-[#8A9187] space-y-1">
          <AlertCircle className="w-8 h-8 mx-auto opacity-50" />
          <p className="font-bold text-[#2D332A] text-xs">لا توجد نتائج تطابق البحث</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredGroups.map((group) => {
            const enrollments = db.getGroupEnrollments(group.id);
            const stats = db.calculateGroupStats(group.id);

            return (
              <div
                key={group.id}
                onClick={() => onOpenGroupProfile(group)}
                className="p-4 bg-white border border-[#E8E2D6] rounded-2xl shadow-sm hover:border-[#748C70]/60 transition-all cursor-pointer space-y-3 active:scale-[0.99]"
              >
                {/* Card Top: Accent + Title + Type Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-sm shrink-0"
                      style={{ backgroundColor: group.accentColor || '#748C70' }}
                    >
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-[#2D332A] tracking-tight hover:text-[#748C70] transition-colors">
                        {group.name}
                      </h3>
                      <p className="text-[11px] text-[#8A9187] font-semibold">
                        {group.subject} • {group.gradeLevel}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold bg-[#F2ECE1] text-[#6B7567] px-2.5 py-1 rounded-full border border-[#E8E2D6]">
                    {group.type === 'private' ? 'درس خاص' : 'مجموعة'}
                  </span>
                </div>

                {/* Pricing & Student Counts Strip */}
                <div className="grid grid-cols-2 gap-2 bg-[#F9F7F2] p-2.5 rounded-xl text-xs">
                  <div>
                    <span className="text-[10px] text-[#8A9187] block">الطلاب المسجلين</span>
                    <strong className="text-xs font-black text-[#2D332A] flex items-center gap-1 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-[#748C70]" />
                      <span>{enrollments.length} طالب</span>
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-[#8A9187] block">
                      {group.billingType === 'monthly' ? 'الاشتراك الشهري' : group.billingType === 'package' ? 'سعر الباقة' : 'سعر الحصة'}
                    </span>
                    <strong className="text-xs font-black text-[#748C70] flex items-center gap-1 mt-0.5">
                      <DollarSign className="w-3.5 h-3.5 text-[#748C70]" />
                      <span>{group.defaultPrice} ج.م</span>
                    </strong>
                  </div>
                </div>

                {/* Schedule & Location */}
                <div className="flex items-center justify-between text-[11px] text-[#8A9187] pt-1 border-t border-[#E8E2D6]/60">
                  <div className="flex items-center gap-1 truncate">
                    <Calendar className="w-3.5 h-3.5 text-[#748C70] shrink-0" />
                    <span className="truncate">{group.scheduleDays.join('، ') || 'مواعيد متغيرة'}</span>
                  </div>

                  {group.scheduleTime && (
                    <div className="flex items-center gap-1 shrink-0 font-bold text-[#434B3E]">
                      <Clock className="w-3.5 h-3.5 text-[#748C70]" />
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
