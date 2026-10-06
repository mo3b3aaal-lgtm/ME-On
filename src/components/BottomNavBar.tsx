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
      className="w-full bg-[#F8F2EA]/95 backdrop-blur-xl border-t border-[#B6A89C]/60 rounded-t-[26px] px-2 py-2 flex items-center justify-around shrink-0 shadow-[0_-10px_35px_rgba(92,64,51,0.14)] z-30 select-none safe-area-bottom"
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
                ? 'text-[#6B1E2B] font-bold'
                : 'text-[#69493C] hover:text-[#5C4033] active:scale-95'
            }`}
          >
            <div
              className={`p-2 rounded-2xl transition-all duration-300 relative ${
                isActive
                  ? 'bg-[#6B1E2B]/12 text-[#6B1E2B] shadow-md shadow-[#6B1E2B]/10 -translate-y-1 scale-110 ring-1 ring-[#B68A4C]/55'
                  : 'bg-transparent text-[#69493C] group-hover:bg-[#EADBC7]/60 group-hover:text-[#5C4033]'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4] text-[#6B1E2B]' : 'stroke-[1.8] text-[#69493C]'}`} />
              {isActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#B68A4C] ring-2 ring-[#FAF7F2] animate-pulse" />
              )}
            </div>
            <span
              className={`text-[10.5px] mt-0.5 tracking-tight transition-colors ${
                isActive ? 'text-[#6B1E2B] font-black' : 'text-[#69493C] font-medium'
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
