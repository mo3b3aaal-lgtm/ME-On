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
      className="w-full bg-[#FFFFFF]/95 backdrop-blur-xl border-t border-[#C7CDD3] rounded-t-[26px] px-2 py-2 flex items-center justify-around shrink-0 shadow-[0_-10px_35px_rgba(22,50,79,0.08)] z-30 select-none safe-area-bottom"
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
                ? 'text-[#0A3D62] font-bold'
                : 'text-[#6F7882] hover:text-[#16324F] active:scale-95'
            }`}
          >
            <div
              className={`p-2 rounded-2xl transition-all duration-300 relative ${
                isActive
                  ? 'bg-[#0A3D62] text-[#FFFFFF] shadow-md shadow-[#0A3D62]/20 -translate-y-1 scale-110 ring-1 ring-[#16324F]/20'
                  : 'bg-transparent text-[#6F7882] group-hover:bg-[#C7CDD3]/25 group-hover:text-[#16324F]'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4] text-[#FFFFFF]' : 'stroke-[1.8] text-[#6F7882]'}`} />
              {isActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#16324F] ring-2 ring-[#FFFFFF] animate-pulse" />
              )}
            </div>
            <span
              className={`text-[10.5px] mt-0.5 tracking-tight transition-colors ${
                isActive ? 'text-[#0A3D62] font-black' : 'text-[#6F7882] font-medium'
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
