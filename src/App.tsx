import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { ActiveTab, Student, Group, Session, Payment, TeacherProfile, UserAccount } from './types';
import { db } from './utils/storage';
import { useTranslation } from './utils/i18n';
import { useModalContext } from './contexts/ModalContext';
import {
  TOP_LEVEL_NAV_ORDER,
  TopLevelNavTab,
  normalizeTopLevelTab,
  usePageSwipeNavigation,
} from './utils/useSwipeGesture';

// Mobile UI components
import { BottomNavBar } from './components/BottomNavBar';
import { QuickAddSheet } from './components/QuickAddSheet';
import { AuthView } from './components/AuthView';
import { SplashScreen } from './components/SplashScreen';

// Main Views
import { DashboardView } from './components/DashboardView';
import { StudentsView } from './components/StudentsView';
import { SessionsView } from './components/SessionsView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';

// Modals
import { AddEditStudentModal } from './components/AddEditStudentModal';
import { AddEditGroupModal } from './components/AddEditGroupModal';
import { AddEditSessionModal } from './components/AddEditSessionModal';
import { BulkAddSessionModal } from './components/BulkAddSessionModal';
import { EnrollExistingStudentModal } from './components/EnrollExistingStudentModal';
import { StudentProfileModal } from './components/StudentProfileModal';
import { GroupProfileModal } from './components/GroupProfileModal';
import { RecordAttendanceModal } from './components/RecordAttendanceModal';
import { AddPaymentModal } from './components/AddPaymentModal';
import { NotificationsModal } from './components/NotificationsModal';
import { initLocalNotifications, scheduleDailyAttendanceReminder } from './utils/localNotifications';
import { toLocalISODate } from './utils/localDate';

function useDetailModalState<T>(exitDurationMs = 150) {
  const [item, setItem] = useState<T | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const open = useCallback((nextItem: T) => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setItem(nextItem);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || exitDurationMs <= 0) {
      setItem(null);
      return;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setItem(null);
      closeTimerRef.current = null;
    }, exitDurationMs);
  }, [exitDurationMs]);

  return { item, setItem, isOpen, open, close };
}

type NavMotionClass =
  | ''
  | 'nav-tab-enter-forward'
  | 'nav-tab-enter-backward'
  | 'nav-nested-enter'
  | 'nav-nested-return'
  | 'nav-swipe-enter-left'
  | 'nav-swipe-enter-right';

type PanelKey = TopLevelNavTab | 'settings';

const INITIAL_VISITED_PANELS: Record<PanelKey, boolean> = {
  dashboard: true,
  sessions: false,
  reports: false,
  students: false,
  settings: false,
};

function preserveArrayIfUnchanged<T>(prev: T[], next: T[]): T[] {
  if (prev.length !== next.length) return next;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return next;
  }
  return prev;
}

const MemoDashboardView = React.memo(DashboardView);
const MemoSessionsView = React.memo(SessionsView);
const MemoReportsView = React.memo(ReportsView);
const MemoStudentsView = React.memo(StudentsView);
const MemoSettingsView = React.memo(SettingsView);
const MemoBottomNavBar = React.memo(BottomNavBar);

interface TabPanelProps {
  panelKey: PanelKey;
  isActive: boolean;
  isMounted: boolean;
  motionClass: string;
  scrollPositionsRef: React.MutableRefObject<Partial<Record<PanelKey, number>>>;
  children: React.ReactNode;
}

const TabPanel: React.FC<TabPanelProps> = ({
  panelKey,
  isActive,
  isMounted,
  motionClass,
  scrollPositionsRef,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const scrollElRef = useRef<HTMLElement | null>(null);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const handleScrollCapture = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!isActiveRef.current) return;
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (
        target.parentElement === panelRef.current ||
        target.classList.contains('android-scrollbar')
      ) {
        scrollElRef.current = target;
        scrollPositionsRef.current[panelKey] = target.scrollTop;
      }
    },
    [panelKey, scrollPositionsRef]
  );

  useLayoutEffect(() => {
    if (!isActive) return;
    const savedTop = scrollPositionsRef.current[panelKey];
    if (typeof savedTop !== 'number') return;

    const el =
      scrollElRef.current && scrollElRef.current.isConnected
        ? scrollElRef.current
        : panelRef.current?.querySelector<HTMLElement>('.android-scrollbar, .overflow-y-auto') ??
          null;

    if (el) {
      scrollElRef.current = el;
      if (Math.abs(el.scrollTop - savedTop) > 0.5) {
        el.scrollTop = savedTop;
      }
    }
  }, [isActive, panelKey, scrollPositionsRef]);

  if (!isMounted && !isActive) return null;

  return (
    <div
      ref={panelRef}
      data-tab-panel={panelKey}
      aria-hidden={!isActive}
      inert={!isActive || undefined}
      onScrollCapture={handleScrollCapture}
      className={
        isActive
          ? `tab-panel tab-panel-active ${motionClass}`.trim()
          : 'tab-panel tab-panel-inactive'
      }
    >
      {children}
    </div>
  );
};

export default function App() {
  const { t, language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');
  const isEnRef = useRef(isEn);
  isEnRef.current = isEn;

  const { popTopModal, modalStack } = useModalContext();

  // Animated Splash Screen
  const [showSplash, setShowSplash] = useState(true);

  // Navigation & Lazy-Mounted Panel Retention (preserves state, memo caches & scroll position)
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const activeTabRef = useRef<ActiveTab>(activeTab);
  activeTabRef.current = activeTab;

  const [studentsSegment, setStudentsSegment] = useState<'students' | 'groups'>('students');
  const studentsSegmentRef = useRef<'students' | 'groups'>(studentsSegment);
  studentsSegmentRef.current = studentsSegment;

  const [visitedPanels, setVisitedPanels] =
    useState<Record<PanelKey, boolean>>(INITIAL_VISITED_PANELS);
  const [navMotion, setNavMotion] = useState<{ cls: NavMotionClass; parity: 0 | 1 }>({
    cls: '',
    parity: 0,
  });

  const previousMainTabRef = useRef<TopLevelNavTab>('dashboard');
  const tabScrollPositionsRef = useRef<Partial<Record<PanelKey, number>>>({});

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => db.getCurrentSession());

  // Database Data States
  const [students, setStudents] = useState<Student[]>(() => db.getStudents());
  const [groups, setGroups] = useState<Group[]>(() => db.getGroups());
  const [sessions, setSessions] = useState<Session[]>(() => db.getSessions());
  const [payments, setPayments] = useState<Payment[]>(() => db.getPayments());
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile>(() => db.getTeacherProfile());

  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  // Refresh state from database while preserving unchanged array/object references
  const refreshData = useCallback(() => {
    setStudents((prev) => preserveArrayIfUnchanged(prev, db.getStudents()));
    setGroups((prev) => preserveArrayIfUnchanged(prev, db.getGroups()));
    setSessions((prev) => preserveArrayIfUnchanged(prev, db.getSessions()));
    setPayments((prev) => preserveArrayIfUnchanged(prev, db.getPayments()));
    setTeacherProfile((prev) => {
      const next = db.getTeacherProfile();
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
    scheduleDailyAttendanceReminder({ isEn: isEnRef.current }).catch(() => {});
  }, []);

  // Referentially stable navigation dispatcher (never causes inactive tabs to re-render)
  const navigateWithMotion = useCallback(
    (
      nextTab: ActiveTab,
      explicitDirection?: 'forward' | 'backward' | 'nested-return' | 'swipe-left' | 'swipe-right'
    ) => {
      const currentTab = activeTabRef.current;

      if (nextTab === 'settings') {
        if (currentTab === 'settings') return;
        const currentMain = normalizeTopLevelTab(currentTab);
        if (currentMain) {
          previousMainTabRef.current = currentMain;
        }
        setVisitedPanels((prev) => (prev.settings ? prev : { ...prev, settings: true }));
        setNavMotion((prev) => ({
          cls: 'nav-nested-enter',
          parity: prev.parity === 0 ? 1 : 0,
        }));
        activeTabRef.current = 'settings';
        setActiveTab('settings');
        return;
      }

      const targetMain: TopLevelNavTab =
        nextTab === 'groups' ? 'students' : (normalizeTopLevelTab(nextTab) ?? 'dashboard');

      const nextSegment =
        nextTab === 'groups'
          ? 'groups'
          : nextTab === 'students'
          ? 'students'
          : studentsSegmentRef.current;

      const currentMain = normalizeTopLevelTab(currentTab);

      if (currentTab === 'settings' || explicitDirection === 'nested-return') {
        if (nextSegment !== studentsSegmentRef.current) {
          studentsSegmentRef.current = nextSegment;
          setStudentsSegment(nextSegment);
        }
        setVisitedPanels((prev) => (prev[targetMain] ? prev : { ...prev, [targetMain]: true }));
        setNavMotion((prev) => ({
          cls: 'nav-nested-return',
          parity: prev.parity === 0 ? 1 : 0,
        }));
        activeTabRef.current = targetMain;
        setActiveTab(targetMain);
        return;
      }

      // Already on the same top-level tab: update segment only if needed, otherwise complete no-op
      if (currentMain === targetMain) {
        if (nextSegment !== studentsSegmentRef.current) {
          studentsSegmentRef.current = nextSegment;
          setStudentsSegment(nextSegment);
        }
        if (currentTab !== targetMain) {
          activeTabRef.current = targetMain;
          setActiveTab(targetMain);
        }
        return;
      }

      if (nextSegment !== studentsSegmentRef.current) {
        studentsSegmentRef.current = nextSegment;
        setStudentsSegment(nextSegment);
      }

      setVisitedPanels((prev) => (prev[targetMain] ? prev : { ...prev, [targetMain]: true }));

      let resolvedClass: NavMotionClass;
      if (explicitDirection === 'swipe-left') {
        resolvedClass = 'nav-swipe-enter-left';
      } else if (explicitDirection === 'swipe-right') {
        resolvedClass = 'nav-swipe-enter-right';
      } else if (explicitDirection === 'forward') {
        resolvedClass = 'nav-tab-enter-forward';
      } else if (explicitDirection === 'backward') {
        resolvedClass = 'nav-tab-enter-backward';
      } else if (currentMain) {
        const fromIdx = TOP_LEVEL_NAV_ORDER.indexOf(currentMain);
        const toIdx = TOP_LEVEL_NAV_ORDER.indexOf(targetMain);
        resolvedClass = toIdx >= fromIdx ? 'nav-tab-enter-forward' : 'nav-tab-enter-backward';
      } else {
        resolvedClass = 'nav-tab-enter-forward';
      }

      setNavMotion((prev) => ({
        cls: resolvedClass,
        parity: prev.parity === 0 ? 1 : 0,
      }));
      activeTabRef.current = targetMain;
      setActiveTab(targetMain);
    },
    []
  );

  const handleTabChange = useCallback(
    (tab: ActiveTab) => {
      navigateWithMotion(tab);
    },
    [navigateWithMotion]
  );

  const handleBackFromSettings = useCallback(() => {
    const returnTarget = previousMainTabRef.current || 'dashboard';
    navigateWithMotion(returnTarget, 'nested-return');
  }, [navigateWithMotion]);

  // Initialize Local Notifications and Tap Action Listener
  useEffect(() => {
    initLocalNotifications(() => {
      navigateWithMotion('sessions');
    });

    const handleReminderEvent = () => {
      navigateWithMotion('sessions');
    };
    window.addEventListener('classy_open_attendance_reminder', handleReminderEvent);

    scheduleDailyAttendanceReminder({ isEn }).catch(() => {});

    return () => {
      window.removeEventListener('classy_open_attendance_reminder', handleReminderEvent);
    };
  }, [isEn, navigateWithMotion]);

  // Process any pending resets on startup or network recovery
  useEffect(() => {
    db.processPendingResets().catch(() => {});
  }, []);

  // Auth Handlers
  const handleLoginSuccess = useCallback(
    (user: UserAccount) => {
      setCurrentUser(user);
      setVisitedPanels(INITIAL_VISITED_PANELS);
      tabScrollPositionsRef.current = {};
      previousMainTabRef.current = 'dashboard';
      studentsSegmentRef.current = 'students';
      setStudentsSegment('students');
      setNavMotion({ cls: '', parity: 0 });
      activeTabRef.current = 'dashboard';
      setActiveTab('dashboard');
      refreshData();
    },
    [refreshData]
  );

  const handleLogout = useCallback(() => {
    db.logout();
    setCurrentUser(null);
    setVisitedPanels(INITIAL_VISITED_PANELS);
    tabScrollPositionsRef.current = {};
    previousMainTabRef.current = 'dashboard';
    studentsSegmentRef.current = 'students';
    setStudentsSegment('students');
    setNavMotion({ cls: '', parity: 0 });
    activeTabRef.current = 'dashboard';
    setActiveTab('dashboard');
  }, []);

  // Modals state
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [sessionDefaultGroupId, setSessionDefaultGroupId] = useState<string | undefined>(undefined);
  const [sessionDefaultDate, setSessionDefaultDate] = useState<string | undefined>(undefined);
  const [sessionDefaultStudentId, setSessionDefaultStudentId] = useState<string | undefined>(undefined);

  const [isBulkAddSessionOpen, setIsBulkAddSessionOpen] = useState(false);
  const [bulkAddStudents, setBulkAddStudents] = useState<Student[]>([]);
  const [bulkAddGroupId, setBulkAddGroupId] = useState<string | undefined>(undefined);

  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [targetStudentForPayment, setTargetStudentForPayment] = useState<Student | null>(null);
  const [targetEnrollmentIdForPayment, setTargetEnrollmentIdForPayment] = useState<string | undefined>(undefined);

  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollTargetStudent, setEnrollTargetStudent] = useState<Student | null>(null);
  const [enrollTargetGroup, setEnrollTargetGroup] = useState<Group | null>(null);

  const studentProfileModal = useDetailModalState<Student>(150);
  const groupProfileModal = useDetailModalState<Group>(150);
  const attendanceModal = useDetailModalState<Session>(150);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);

  // Sync profile data if updated while open
  useEffect(() => {
    if (studentProfileModal.isOpen && studentProfileModal.item) {
      const refreshed = students.find((s) => s.id === studentProfileModal.item!.id);
      if (refreshed) {
        studentProfileModal.setItem(refreshed);
      } else {
        studentProfileModal.close();
      }
    }
  }, [students]);

  useEffect(() => {
    if (groupProfileModal.isOpen && groupProfileModal.item) {
      const refreshed = groups.find((g) => g.id === groupProfileModal.item!.id);
      if (refreshed) {
        groupProfileModal.setItem(refreshed);
      } else {
        groupProfileModal.close();
      }
    }
  }, [groups]);

  // Single-registration Native Android Back Button & Escape Key Handling (prevents listener leaks & double-fires)
  const backActionRef = useRef<() => boolean>(() => false);
  const tRef = useRef(t);
  const lastBackAtRef = useRef<number>(0);

  useLayoutEffect(() => {
    tRef.current = t;
    backActionRef.current = () => {
      const now = performance.now();
      if (now - lastBackAtRef.current < 110) {
        return true;
      }

      // 1. Close topmost active modal/dialog in stack (LIFO order)
      if (popTopModal()) {
        lastBackAtRef.current = now;
        return true;
      }

      // 2. Return from Settings to the exact previous main tab
      if (activeTabRef.current === 'settings') {
        lastBackAtRef.current = now;
        handleBackFromSettings();
        return true;
      }

      // 3. Return to dashboard tab if currently on another top-level tab
      if (activeTabRef.current !== 'dashboard') {
        lastBackAtRef.current = now;
        navigateWithMotion('dashboard', 'backward');
        return true;
      }

      return false; // At root dashboard -> trigger app exit prompt
    };
  });

  useEffect(() => {
    let disposed = false;
    let backListener: { remove?: () => void } | null = null;

    const setupCapacitorBack = async () => {
      try {
        const handle = await CapacitorApp.addListener('backButton', () => {
          const handled = backActionRef.current();
          if (!handled) {
            if (window.confirm(tRef.current('confirmExitApp'))) {
              CapacitorApp.exitApp();
            }
          }
        });
        if (disposed) {
          handle?.remove?.();
        } else {
          backListener = handle;
        }
      } catch {
        // Not running in Capacitor native runtime
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        backActionRef.current();
      }
    };

    setupCapacitorBack();
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      disposed = true;
      if (backListener && backListener.remove) {
        backListener.remove();
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Referentially stable handlers for memoized tab views & modals
  const handleOpenAddStudent = useCallback(() => {
    setEditingStudent(null);
    setIsAddStudentOpen(true);
  }, []);

  const handleOpenEditStudent = useCallback((student: Student) => {
    setEditingStudent(student);
    setIsAddStudentOpen(true);
  }, []);

  const handleOpenAddGroup = useCallback(() => {
    setEditingGroup(null);
    setIsAddGroupOpen(true);
  }, []);

  const handleOpenEditGroup = useCallback((group: Group) => {
    setEditingGroup(group);
    setIsAddGroupOpen(true);
  }, []);

  const handleOpenAddSession = useCallback(
    (defaultGroupId?: string, defaultDate?: string, defaultStudentId?: string) => {
      setEditingSession(null);
      setSessionDefaultGroupId(defaultGroupId || groupsRef.current[0]?.id);
      setSessionDefaultDate(defaultDate);
      setSessionDefaultStudentId(defaultStudentId);
      setIsAddSessionOpen(true);
    },
    []
  );

  const handleStudentsAddSession = useCallback(
    (defaultGroupId?: string, defaultDate?: string) => {
      handleOpenAddSession(defaultGroupId, defaultDate);
    },
    [handleOpenAddSession]
  );

  const handleOpenBulkAddSession = useCallback((studentsToBulk: Student[], groupId?: string) => {
    setBulkAddStudents(studentsToBulk);
    setBulkAddGroupId(groupId);
    setIsBulkAddSessionOpen(true);
  }, []);

  const handleStudentsBulkAddSession = useCallback(
    (studentsToBulk: Student[]) => {
      handleOpenBulkAddSession(studentsToBulk);
    },
    [handleOpenBulkAddSession]
  );

  const handleOpenEditSession = useCallback((session: Session) => {
    setEditingSession(session);
    setSessionDefaultGroupId(session.groupId);
    setSessionDefaultDate(session.date);
    setSessionDefaultStudentId(session.studentId);
    setIsAddSessionOpen(true);
  }, []);

  const handleOpenAddPayment = useCallback((student?: Student, enrollmentId?: string) => {
    setTargetStudentForPayment(student || null);
    setTargetEnrollmentIdForPayment(enrollmentId);
    setIsAddPaymentOpen(true);
  }, []);

  const handleOpenAddPaymentDefault = useCallback(() => {
    handleOpenAddPayment();
  }, [handleOpenAddPayment]);

  const handleOpenEnrollForStudent = useCallback((student: Student) => {
    setEnrollTargetStudent(student);
    setEnrollTargetGroup(null);
    setIsEnrollModalOpen(true);
  }, []);

  const handleOpenEnrollForGroup = useCallback((group: Group) => {
    setEnrollTargetStudent(null);
    setEnrollTargetGroup(group);
    setIsEnrollModalOpen(true);
  }, []);

  const handleOpenNotificationsModal = useCallback(() => {
    setIsNotificationsModalOpen(true);
  }, []);

  const handleOpenQuickAdd = useCallback(() => {
    setIsQuickAddOpen(true);
  }, []);

  const handleProfileUpdated = useCallback(
    (updatedProfile: TeacherProfile) => {
      setTeacherProfile(updatedProfile);
      refreshData();
    },
    [refreshData]
  );

  const handleQuickRecordAttendance = useCallback(() => {
    const today = toLocalISODate();
    const todaySessions = sessionsRef.current.filter(
      (s) => s.date === today && s.status !== 'cancelled'
    );
    if (todaySessions.length > 0) {
      const unrecorded = todaySessions.find((s) => s.status === 'scheduled') || todaySessions[0];
      attendanceModal.open(unrecorded);
    } else {
      handleTabChange('sessions');
    }
  }, [handleTabChange, attendanceModal.open]);

  const handleOpenAddPrivateSession = useCallback(() => {
    handleOpenAddSession();
  }, [handleOpenAddSession]);

  const handleSwipeNavigate = useCallback(
    (targetTab: TopLevelNavTab, direction: 'forward' | 'backward') => {
      navigateWithMotion(targetTab, direction === 'forward' ? 'swipe-left' : 'swipe-right');
    },
    [navigateWithMotion]
  );

  // Top-level horizontal swipe gesture (disabled when logged out, on Settings, or when any modal/sheet is active)
  const isSwipeDisabled =
    !currentUser ||
    activeTab === 'settings' ||
    isQuickAddOpen ||
    modalStack.length > 0 ||
    studentProfileModal.isOpen ||
    groupProfileModal.isOpen ||
    attendanceModal.isOpen ||
    isAddStudentOpen ||
    isAddGroupOpen ||
    isAddSessionOpen ||
    isBulkAddSessionOpen ||
    isAddPaymentOpen ||
    isEnrollModalOpen ||
    isNotificationsModalOpen;

  const { stageRef, swipeBind } = usePageSwipeNavigation({
    activeTab,
    disabled: isSwipeDisabled,
    onSwipeNavigate: handleSwipeNavigate,
  });

  const isDashboardActive = activeTab === 'dashboard';
  const isSessionsActive = activeTab === 'sessions';
  const isReportsActive = activeTab === 'reports';
  const isStudentsActive = activeTab === 'students' || activeTab === 'groups';
  const isSettingsActive = activeTab === 'settings';
  const activeMotionClass = navMotion.cls
    ? `${navMotion.cls}${navMotion.parity === 1 ? ' nav-anim-alt' : ''}`
    : '';
  const resolvedStudentsSegment = activeTab === 'groups' ? 'groups' : studentsSegment;

  return (
    <div
      className="min-h-screen bg-page md:bg-mint flex items-center justify-center p-0 md:p-4 lg:p-6 select-none font-sans text-navy"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Animated Splash Screen Experience */}
      {showSplash && (
        <SplashScreen onComplete={() => setShowSplash(false)} autoDismissMs={2200} />
      )}

      {/* Modern Mobile Frame */}
      <div className="relative w-full md:max-w-[440px] h-[100dvh] md:h-[880px] md:max-h-[94vh] bg-page md:rounded-[40px] md:border-[8px] md:border-navy md:ring-1 md:ring-line/50 flex flex-col overflow-hidden shadow-2xl text-navy">
        {/* Mobile Punch-hole Camera */}
        <div className="hidden md:block absolute top-3 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-navy border border-line/40 z-50 pointer-events-none shadow-inner" />

        {/* Main Screen Body */}
        <main className="flex-1 flex flex-col overflow-hidden relative bg-page">
          {!currentUser ? (
            <AuthView onLoginSuccess={handleLoginSuccess} />
          ) : (
            <div ref={stageRef} {...swipeBind} className="tab-stage">
              <TabPanel
                panelKey="dashboard"
                isActive={isDashboardActive}
                isMounted={visitedPanels.dashboard}
                motionClass={activeMotionClass}
                scrollPositionsRef={tabScrollPositionsRef}
              >
                <MemoDashboardView
                  students={students}
                  groups={groups}
                  sessions={sessions}
                  payments={payments}
                  teacherProfile={teacherProfile}
                  onOpenAddStudent={handleOpenAddStudent}
                  onOpenAddGroup={handleOpenAddGroup}
                  onOpenAddSession={handleOpenAddSession}
                  onOpenAddPayment={handleOpenAddPaymentDefault}
                  onOpenStudentProfile={studentProfileModal.open}
                  onOpenGroupProfile={groupProfileModal.open}
                  onOpenAttendanceModal={attendanceModal.open}
                  onOpenNotificationsModal={handleOpenNotificationsModal}
                  onNavigateToTab={handleTabChange}
                  onDataChanged={refreshData}
                />
              </TabPanel>

              <TabPanel
                panelKey="sessions"
                isActive={isSessionsActive}
                isMounted={visitedPanels.sessions}
                motionClass={activeMotionClass}
                scrollPositionsRef={tabScrollPositionsRef}
              >
                <MemoSessionsView
                  sessions={sessions}
                  groups={groups}
                  students={students}
                  payments={payments}
                  onOpenAddSession={handleOpenAddSession}
                  onEditSession={handleOpenEditSession}
                  onOpenAttendanceModal={attendanceModal.open}
                  onOpenStudentProfile={studentProfileModal.open}
                  onOpenGroupProfile={groupProfileModal.open}
                  onSessionDeleted={refreshData}
                  onDataChanged={refreshData}
                  onNavigateToTab={handleTabChange}
                  onOpenNotificationsModal={handleOpenNotificationsModal}
                />
              </TabPanel>

              <TabPanel
                panelKey="reports"
                isActive={isReportsActive}
                isMounted={visitedPanels.reports}
                motionClass={activeMotionClass}
                scrollPositionsRef={tabScrollPositionsRef}
              >
                <MemoReportsView
                  students={students}
                  groups={groups}
                  sessions={sessions}
                  payments={payments}
                  onOpenAddPayment={handleOpenAddPayment}
                  onOpenStudentProfile={studentProfileModal.open}
                  onNavigateToTab={handleTabChange}
                  onOpenNotificationsModal={handleOpenNotificationsModal}
                />
              </TabPanel>

              <TabPanel
                panelKey="students"
                isActive={isStudentsActive}
                isMounted={visitedPanels.students}
                motionClass={activeMotionClass}
                scrollPositionsRef={tabScrollPositionsRef}
              >
                <MemoStudentsView
                  students={students}
                  groups={groups}
                  sessions={sessions}
                  payments={payments}
                  activeSegment={resolvedStudentsSegment}
                  onSegmentChange={setStudentsSegment}
                  onOpenAddStudent={handleOpenAddStudent}
                  onOpenStudentProfile={studentProfileModal.open}
                  onOpenEditStudent={handleOpenEditStudent}
                  onOpenAddPayment={handleOpenAddPayment}
                  onOpenAddSession={handleStudentsAddSession}
                  onOpenAttendanceModal={attendanceModal.open}
                  onOpenBulkAddSession={handleStudentsBulkAddSession}
                  onOpenAddGroup={handleOpenAddGroup}
                  onEditGroup={handleOpenEditGroup}
                  onOpenGroupProfile={groupProfileModal.open}
                  onDataChanged={refreshData}
                  onNavigateToTab={handleTabChange}
                  onOpenNotificationsModal={handleOpenNotificationsModal}
                />
              </TabPanel>

              <TabPanel
                panelKey="settings"
                isActive={isSettingsActive}
                isMounted={visitedPanels.settings}
                motionClass={activeMotionClass}
                scrollPositionsRef={tabScrollPositionsRef}
              >
                <MemoSettingsView
                  teacherProfile={teacherProfile}
                  currentUser={currentUser}
                  onProfileUpdated={handleProfileUpdated}
                  onDataReset={refreshData}
                  onLogout={handleLogout}
                  onNavigateToTab={handleTabChange}
                  onBack={handleBackFromSettings}
                />
              </TabPanel>
            </div>
          )}
        </main>

        {/* 3. Android Bottom Navigation Bar (Visible only when logged in) */}
        {currentUser && (
          <MemoBottomNavBar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onOpenQuickAdd={handleOpenQuickAdd}
            isQuickAddOpen={isQuickAddOpen}
          />
        )}

        {/* --- MODALS --- */}

        {/* Add/Edit Student Modal */}
        {isAddStudentOpen && (
          <AddEditStudentModal
            isOpen={isAddStudentOpen}
            onClose={() => setIsAddStudentOpen(false)}
            editingStudent={editingStudent}
            allGroups={groups}
            onSaveComplete={() => {
              refreshData();
            }}
          />
        )}

        {/* Add/Edit Group Modal */}
        {isAddGroupOpen && (
          <AddEditGroupModal
            isOpen={isAddGroupOpen}
            onClose={() => setIsAddGroupOpen(false)}
            editingGroup={editingGroup}
            onSaveComplete={() => {
              refreshData();
            }}
          />
        )}

        {/* Add/Edit Session Modal */}
        {isAddSessionOpen && (
          <AddEditSessionModal
            isOpen={isAddSessionOpen}
            onClose={() => {
              setIsAddSessionOpen(false);
              setSessionDefaultStudentId(undefined);
            }}
            editingSession={editingSession}
            defaultGroupId={sessionDefaultGroupId}
            defaultDate={sessionDefaultDate}
            defaultStudentId={sessionDefaultStudentId}
            allGroups={groups}
            allStudents={students}
            onSaveComplete={() => {
              refreshData();
            }}
          />
        )}

        {/* Enroll Existing Student into Group Modal */}
        {isEnrollModalOpen && (
          <EnrollExistingStudentModal
            isOpen={isEnrollModalOpen}
            onClose={() => setIsEnrollModalOpen(false)}
            targetStudent={enrollTargetStudent}
            targetGroup={enrollTargetGroup}
            allStudents={students}
            allGroups={groups}
            onEnrollmentComplete={() => {
              refreshData();
            }}
          />
        )}

        {/* Student Dossier / Profile Modal */}
        {studentProfileModal.item && (
          <StudentProfileModal
            isOpen={studentProfileModal.isOpen}
            onClose={studentProfileModal.close}
            student={studentProfileModal.item}
            allGroups={groups}
            onEditStudent={(st) => handleOpenEditStudent(st)}
            onOpenEnrollModal={(st) => handleOpenEnrollForStudent(st)}
            onOpenAddPayment={(st, enrId) => handleOpenAddPayment(st, enrId)}
            onDataChanged={refreshData}
          />
        )}

        {/* Group Dossier / Profile Modal */}
        {groupProfileModal.item && (
          <GroupProfileModal
            isOpen={groupProfileModal.isOpen}
            onClose={groupProfileModal.close}
            group={groupProfileModal.item}
            onEditGroup={(grp) => handleOpenEditGroup(grp)}
            onAddExistingStudent={(grp) => handleOpenEnrollForGroup(grp)}
            onAddNewStudentToGroup={() => {
              handleOpenAddStudent();
            }}
            onAddSessionForGroup={(grp) => handleOpenAddSession(grp.id)}
            onOpenAttendanceModal={(ses) => attendanceModal.open(ses)}
            onOpenStudentProfile={(st) => studentProfileModal.open(st)}
            onOpenBulkAddSession={(stList, grpId) => handleOpenBulkAddSession(stList, grpId)}
            onDataChanged={refreshData}
          />
        )}

        {/* Bulk Add Sessions for Multiple Students Modal */}
        {isBulkAddSessionOpen && (
          <BulkAddSessionModal
            isOpen={isBulkAddSessionOpen}
            onClose={() => {
              setIsBulkAddSessionOpen(false);
              setBulkAddStudents([]);
              setBulkAddGroupId(undefined);
            }}
            selectedStudents={bulkAddStudents}
            preselectedGroupId={bulkAddGroupId}
            allGroups={groups}
            onSuccess={() => {
              refreshData();
            }}
          />
        )}

        {/* Record Attendance Modal */}
        {attendanceModal.item && (
          <RecordAttendanceModal
            isOpen={attendanceModal.isOpen}
            onClose={attendanceModal.close}
            session={attendanceModal.item}
            onSaveComplete={refreshData}
          />
        )}

        {/* Add Payment Modal */}
        {isAddPaymentOpen && (
          <AddPaymentModal
            isOpen={isAddPaymentOpen}
            onClose={() => {
              setIsAddPaymentOpen(false);
              setTargetStudentForPayment(null);
              setTargetEnrollmentIdForPayment(undefined);
            }}
            targetStudent={targetStudentForPayment}
            targetEnrollmentId={targetEnrollmentIdForPayment}
            allStudents={students}
            onPaymentSaved={refreshData}
          />
        )}

        {/* Notifications & Smart Alerts Modal */}
        {isNotificationsModalOpen && (
          <NotificationsModal
            isOpen={isNotificationsModalOpen}
            onClose={() => setIsNotificationsModalOpen(false)}
            students={students}
            groups={groups}
            sessions={sessions}
            enrollments={db.getEnrollments()}
            onOpenAddPayment={(st, enrId) => handleOpenAddPayment(st, enrId)}
            onOpenStudentProfile={(st) => studentProfileModal.open(st)}
            onOpenAttendanceModal={(ses) => attendanceModal.open(ses)}
            onDataChanged={refreshData}
          />
        )}

        {/* Quick Add Bottom Sheet (Center FAB Action) */}
        <QuickAddSheet
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          onRecordAttendance={handleQuickRecordAttendance}
          onAddStudent={handleOpenAddStudent}
          onAddGroup={handleOpenAddGroup}
          onAddPayment={() => handleOpenAddPayment()}
          onAddSession={() => handleOpenAddSession()}
          onAddPrivateSession={handleOpenAddPrivateSession}
        />
      </div>
    </div>
  );
}
