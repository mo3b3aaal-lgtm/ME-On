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
    <nav aria-label="Bottom Navigation" className="w-full bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around shrink-0 shadow-lg z-30 select-none safe-area-bottom">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all duration-200 min-w-[50px] min-h-[44px] relative ${
              isActive
                ? 'text-blue-600'
                : 'text-slate-400 hover:text-slate-700 active:scale-95'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                isActive ? 'bg-blue-50 text-blue-600 shadow-2xs' : 'bg-transparent text-slate-400'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
            </div>
            <span
              className={`text-[10px] mt-0.5 tracking-tight ${
                isActive ? 'text-blue-700 font-bold' : 'text-slate-500 font-medium'
              }`}
            >
              {tab.label}
            </span>
            {isActive && (
              <span className="w-1 h-1 rounded-full bg-blue-600 absolute bottom-0.5" />
            )}
          </button>
        );
      })}
    </nav>
  );
};

