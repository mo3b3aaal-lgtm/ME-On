import React from 'react';
import {
  LayoutDashboard,
  Users,
  Layers,
  CalendarCheck2,
  BarChart3,
  Settings,
} from 'lucide-react';
import { ActiveTab } from '../types';
import { useTranslation } from '../utils/i18n';

interface BottomNavBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();

  const tabs = [
    { id: 'dashboard' as ActiveTab, label: t('navDashboard') || 'الرئيسية', icon: LayoutDashboard },
    { id: 'students' as ActiveTab, label: t('navStudents') || 'الطلاب', icon: Users },
    { id: 'groups' as ActiveTab, label: t('navGroups') || 'المجموعات', icon: Layers },
    { id: 'sessions' as ActiveTab, label: t('navSessions') || 'الحصص', icon: CalendarCheck2 },
    { id: 'reports' as ActiveTab, label: t('navReports') || 'التقارير', icon: BarChart3 },
    { id: 'settings' as ActiveTab, label: t('navSettings') || 'الإعدادات', icon: Settings },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="w-full bg-[#17163D]/95 backdrop-blur-xl border-t border-[#403B9C]/40 rounded-t-[26px] px-2 py-2 flex items-center justify-around shrink-0 shadow-[0_-10px_35px_rgba(23,22,61,0.35)] z-30 select-none safe-area-bottom"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all duration-200 min-w-[50px] min-h-[48px] cursor-pointer relative group ${
              isActive
                ? 'text-white font-bold'
                : 'text-[#74778F] hover:text-[#E8E7FF] active:scale-95'
            }`}
          >
            <div
              className={`p-2 rounded-2xl transition-all duration-300 relative ${
                isActive
                  ? 'bg-gradient-to-tr from-[#7657F6] to-[#403B9C] text-white shadow-lg shadow-[#7657F6]/40 -translate-y-1.5 scale-110 ring-2 ring-[#7657F6]/30'
                  : 'bg-transparent text-[#9DA3C4] group-hover:bg-[#403B9C]/30 group-hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.3]' : 'stroke-[1.8]'}`} />
              {isActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#FF647C] ring-2 ring-[#17163D] animate-pulse" />
              )}
            </div>
            <span
              className={`text-[10.5px] mt-0.5 tracking-tight transition-colors ${
                isActive ? 'text-[#E8E7FF] font-black' : 'text-[#74778F] font-medium'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
