import React, { useState, useRef, useEffect } from 'react';
import { ActiveTab } from '../types';
import { useTranslation } from '../utils/i18n';
import { AppIcon, type AppIconName } from './ui/AppIcon';
import { triggerLightHaptic } from '../utils/haptics';

interface BottomNavBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenQuickAdd: () => void;
  isQuickAddOpen?: boolean;
}

interface NavTabItem {
  id: ActiveTab;
  slotIndex: number;
  icon: AppIconName;
  label: string;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  onOpenQuickAdd,
  isQuickAddOpen = false,
}) => {
  const { t, isRTL, language } = useTranslation();
  const [poppingTab, setPoppingTab] = useState<ActiveTab | null>(null);
  const popTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (popTimerRef.current !== null) {
        window.clearTimeout(popTimerRef.current);
      }
    };
  }, []);

  const leftTabs: NavTabItem[] = [
    {
      id: 'dashboard',
      slotIndex: 0,
      icon: 'home',
      label: t('navDashboard') || 'الرئيسية',
    },
    {
      id: 'sessions',
      slotIndex: 1,
      icon: 'sessions',
      label: t('navSessions') || 'الحصص',
    },
  ];

  const rightTabs: NavTabItem[] = [
    {
      id: 'reports',
      slotIndex: 3,
      icon: 'reports',
      label: t('navReports') || 'التقارير',
    },
    {
      id: 'students',
      slotIndex: 4,
      icon: 'students',
      label: t('navStudents') || 'الطلاب',
    },
  ];

  // Resolve which slot index is active (0, 1, 3, 4). If 'groups', map to 'students' (slot 4). Settings has no active slot (-1).
  const activeSlot =
    activeTab === 'dashboard'
      ? 0
      : activeTab === 'sessions'
      ? 1
      : activeTab === 'reports'
      ? 3
      : activeTab === 'students' || activeTab === 'groups'
      ? 4
      : -1;

  const handleTabClick = (tabId: ActiveTab) => {
    triggerLightHaptic();
    if (popTimerRef.current !== null) {
      window.clearTimeout(popTimerRef.current);
    }
    setPoppingTab(tabId);
    popTimerRef.current = window.setTimeout(() => {
      setPoppingTab(null);
      popTimerRef.current = null;
    }, 240);
    onTabChange(tabId);
  };

  const renderTabButton = (tab: NavTabItem) => {
    const isActive =
      tab.id === 'students'
        ? activeTab === 'students' || activeTab === 'groups'
        : activeTab === tab.id;

    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => handleTabClick(tab.id)}
        aria-label={tab.label}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 cursor-pointer select-none group"
      >
        <span
          className={`flex items-center justify-center transition-colors duration-150 ${
            isActive ? 'text-navy' : 'text-fog group-hover:text-slate'
          } ${poppingTab === tab.id ? 'animate-icon-pop' : ''}`}
        >
          <AppIcon name={tab.icon} weight="fill" size={26} />
        </span>
      </button>
    );
  };

  return (
    <nav
      aria-label="Bottom Navigation"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="absolute bottom-[calc(12px+env(safe-area-inset-bottom,0px))] inset-x-3 h-[72px] bg-page border border-line rounded-[32px] shadow-nav z-40 px-2 flex items-center justify-between select-none"
    >
      {/* Slot 0 & 1: Home and Sessions */}
      <div className="flex-1 flex items-center h-full">
        {leftTabs.map(renderTabButton)}
      </div>

      {/* Slot 2: Center Raised Navy FAB (opens QuickAddSheet) */}
      <div className="w-[72px] flex items-center justify-center shrink-0 relative">
        <button
          type="button"
          onClick={() => {
            triggerLightHaptic();
            onOpenQuickAdd();
          }}
          aria-label={language.startsWith('en') ? 'Quick Actions' : 'إجراء سريع'}
          title={language.startsWith('en') ? 'Quick Actions' : 'إجراء سريع'}
          className="w-14 h-14 -mt-[14px] rounded-full bg-page border-[3px] border-navy flex items-center justify-center shadow-[0_8px_20px_rgba(23,55,94,0.25)] active:scale-[0.92] transition-transform duration-150 cursor-pointer z-10"
        >
          <span
            className={`transition-transform duration-150 text-navy flex items-center justify-center ${
              isQuickAddOpen ? 'rotate-45' : 'rotate-0'
            }`}
          >
            <AppIcon name="plus" weight="fill" size={26} />
          </span>
        </button>
      </div>

      {/* Slot 3 & 4: Reports and Students */}
      <div className="flex-1 flex items-center h-full">
        {rightTabs.map(renderTabButton)}
      </div>

      {/* Sliding Active Indicator Dot (6px navy dot centered under the active icon) */}
      <div
        aria-hidden="true"
        className="absolute bottom-2.5 inset-x-2 h-1.5 pointer-events-none flex"
      >
        <div
          className="h-full flex items-center justify-center transition-[transform,opacity] duration-150 motion-reduce:transition-none"
          style={{
            width: '20%',
            transform:
              activeSlot >= 0
                ? isRTL
                  ? `translate3d(-${activeSlot * 100}%, 0, 0)`
                  : `translate3d(${activeSlot * 100}%, 0, 0)`
                : 'none',
            opacity: activeSlot >= 0 ? 1 : 0,
            transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-navy block" />
        </div>
      </div>
    </nav>
  );
};

export default BottomNavBar;
