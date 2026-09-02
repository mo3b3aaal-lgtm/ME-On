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

interface BottomNavBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'dashboard' as ActiveTab, label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'students' as ActiveTab, label: 'الطلاب', icon: Users },
    { id: 'groups' as ActiveTab, label: 'المجموعات', icon: Layers },
    { id: 'sessions' as ActiveTab, label: 'الحصص', icon: CalendarCheck2 },
    { id: 'reports' as ActiveTab, label: 'التقارير', icon: BarChart3 },
    { id: 'settings' as ActiveTab, label: 'الإعدادات', icon: Settings },
  ];

  return (
    <div className="w-full bg-[#FFFFFF] border-t border-[#E8E2D6] px-2 py-1.5 flex items-center justify-around shrink-0 shadow-lg z-30 select-none safe-area-bottom">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 min-w-[50px] relative ${
              isActive
                ? 'text-[#748C70]'
                : 'text-[#8A9187] hover:text-[#2D332A] active:scale-95'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition-colors ${
                isActive ? 'bg-[#748C70]/15' : 'bg-transparent'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
            </div>
            <span
              className={`text-[10px] mt-0.5 font-bold tracking-tight ${
                isActive ? 'text-[#748C70] font-black' : 'text-[#8A9187]'
              }`}
            >
              {tab.label}
            </span>

            {isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#748C70] absolute -bottom-0.5" />
            )}
          </button>
        );
      })}
    </div>
  );
};
