import React from 'react';
import {
  LayoutDashboard,
  Users,
  Layers,
  CalendarCheck2,
  BarChart3,
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
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="absolute bottom-[calc(12px+env(safe-area-inset-bottom,0px))] left-3 right-3 h-[68px] bg-[#F6EFE8] border border-[#DDD3C7] rounded-[28px] shadow-[0_6px_18px_rgba(41,56,40,0.07)] z-30 px-2 flex items-center justify-around select-none"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 min-h-[48px] min-w-[48px] py-1 cursor-pointer transition-colors ${
              isActive ? 'text-[#293828]' : 'text-[#756046] hover:text-[#0F1206]'
            }`}
          >
            <Icon
              className="w-5 h-5 transition-colors"
              strokeWidth={1.7}
              fill={isActive ? 'currentColor' : 'none'}
            />
            <span
              className={`text-[10.5px] mt-1 leading-none tracking-tight ${
                isActive ? 'font-bold text-[#0F1206]' : 'font-medium text-[#756046]'
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
