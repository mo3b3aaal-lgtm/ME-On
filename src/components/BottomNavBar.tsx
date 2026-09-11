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
    <nav aria-label="Bottom Navigation" className="w-full bg-white/95 backdrop-blur-md border-t border-[#EAE6DE] px-2 py-1 flex items-center justify-around shrink-0 shadow-xs z-30 select-none safe-area-bottom">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all duration-150 min-w-[48px] relative ${
              isActive
                ? 'text-[#607B5E]'
                : 'text-[#878E82] hover:text-[#272D24] active:scale-95'
            }`}
          >
            <div
              className={`p-1 rounded-lg transition-colors ${
                isActive ? 'bg-[#607B5E]/12 text-[#607B5E]' : 'bg-transparent text-[#878E82]'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
            </div>
            <span
              className={`text-[10px] mt-0.5 tracking-tight font-medium ${
                isActive ? 'text-[#607B5E] font-bold' : 'text-[#878E82]'
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
