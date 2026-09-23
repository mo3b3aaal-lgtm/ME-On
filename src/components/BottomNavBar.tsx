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
    { id: 'dashboard' as ActiveTab, label: t('navDashboard'), icon: LayoutDashboard },
    { id: 'students' as ActiveTab, label: t('navStudents'), icon: Users },
    { id: 'groups' as ActiveTab, label: t('navGroups'), icon: Layers },
    { id: 'sessions' as ActiveTab, label: t('navSessions'), icon: CalendarCheck2 },
    { id: 'reports' as ActiveTab, label: t('navReports'), icon: BarChart3 },
    { id: 'settings' as ActiveTab, label: t('navSettings'), icon: Settings },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="w-full bg-white/95 backdrop-blur-md border-t border-[#E8E4F5] rounded-t-[28px] px-3 py-2 flex items-center justify-around shrink-0 shadow-[0_-8px_25px_rgba(20,21,44,0.06)] z-30 select-none safe-area-bottom"
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
                ? 'text-[#7B61FF] font-bold'
                : 'text-[#727494] hover:text-[#14152C] active:scale-95'
            }`}
          >
            <div
              className={`p-2 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-tr from-[#7B61FF] to-[#6C5CE7] text-white shadow-lg shadow-[#7B61FF]/30 -translate-y-1 scale-105'
                  : 'bg-transparent text-[#727494] group-hover:bg-[#F4F3FA] group-hover:text-[#14152C]'
              }`}
            >
              <Icon className={`w-4.5 h-4.5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
            </div>
            <span
              className={`text-[10px] mt-0.5 tracking-tight transition-colors ${
                isActive ? 'text-[#7B61FF] font-black' : 'text-[#727494] font-medium'
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
