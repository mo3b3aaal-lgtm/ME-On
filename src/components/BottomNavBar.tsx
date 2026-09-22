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
      className="w-full bg-white border-t border-[#E2E8F0] rounded-t-2xl px-2.5 py-2 flex items-center justify-around shrink-0 shadow-[0_-4px_16px_rgba(15,23,42,0.03)] z-30 select-none safe-area-bottom"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all duration-150 min-w-[48px] min-h-[46px] cursor-pointer relative group ${
              isActive
                ? 'text-[#172554] font-bold'
                : 'text-[#64748B] hover:text-[#0F172A] active:scale-95'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all duration-150 ${
                isActive
                  ? 'bg-[#172554] text-white shadow-sm ring-2 ring-[#C9A227]/20 -translate-y-0.5'
                  : 'bg-transparent text-[#64748B] group-hover:bg-slate-100 group-hover:text-[#0F172A]'
              }`}
            >
              <Icon className={`w-4.5 h-4.5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.75]'}`} />
            </div>
            <span
              className={`text-[10px] mt-1 tracking-tight transition-colors ${
                isActive ? 'text-[#172554] font-bold' : 'text-[#64748B] font-medium'
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
