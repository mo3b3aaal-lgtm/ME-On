import React, {
  Suspense,
  lazy,
  startTransition,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  ActiveTab,
  Student,
  Group,
  Enrollment,
  Session,
  Attendance,
  Payment,
  SmartReminderItem,
  TeacherProfile,
  UserAccount,
} from './types';
import { db } from './utils/storage';
import { useTranslation } from './utils/i18n';
import { useModalActions, useHasOpenModals } from './contexts/ModalContext';
import {
  TOP_LEVEL_NAV_ORDER,
  TopLevelNavTab,
  normalizeTopLevelTab,
  usePageSwipeNavigation,
} from './utils/useSwipeGesture';

// Core Shell & Primary View (eager for instant initial paint)
import { BottomNavBar } from './components/BottomNavBar';
import { QuickAddSheet } from './components/QuickAddSheet';
import { AuthView } from './components/AuthView';
import { SplashScreen } from './components/SplashScreen';
import { DashboardView } from './components/DashboardView';
import { DelayedFallback } from './components/ui/Skeleton';
import {
  SessionsScreenSkeleton,
  ReportsScreenSkeleton,
  StudentsScreenSkeleton,
  SettingsAsyncFallback,
  LessonStudioSheetSkeleton,
  ProfileSheetSkeleton,
} from './components/skeletons/ClassySkeletons';
import { initLocalNotifications, scheduleDailyAttendanceReminder } from './utils/localNotifications';
import {
  getNotificationRevision,
  getUnreadNotificationsCount,
  requestPlatformNotificationPermission,
  resetPermissionAlertDismissal,
  subscribeToNotifications,
} from './utils/notificationCenter';
import { parseTimeToMinutes, getLocalizedWeekdayName, DAY_INDEX_TO_CANONICAL } from './utils/schedule';
import { parseLocalDateStr, toLocalISODate } from './utils/localDate';
import { Toast, type ToastType } from './components/ui/Toast';
import type { PrivateClassIntakeResult } from './components/PrivateClassIntakeModal';

// Lazy-loaded Views & Modals (pre-warmed in idle slices during the 2.2s splash window)
const loadStudentsView = () => import('./components/StudentsView');
const loadSessionsView = () => import('./components/SessionsView');
const loadReportsView = () => import('./components/ReportsView');
const loadSettingsView = () => import('./components/SettingsView');

const loadAddEditStudentModal = () => import('./components/AddEditStudentModal');
const loadAddEditGroupModal = () => import('./components/AddEditGroupModal');
const loadAddEditSessionModal = () => import('./components/AddEditSessionModal');
const loadBulkAddSessionModal = () => import('./components/BulkAddSessionModal');
const loadEnrollExistingStudentModal = () => import('./components/EnrollExistingStudentModal');
const loadStudentProfileModal = () => import('./components/StudentProfileModal');
const loadGroupProfileModal = () => import('./components/GroupProfileModal');
const loadRecordAttendanceModal = () => import('./components/RecordAttendanceModal');
const loadAddPaymentModal = () => import('./components/AddPaymentModal');
const loadNotificationsModal = () => import('./components/NotificationsModal');
const loadPrivateClassIntakeModal = () => import('./components/PrivateClassIntakeModal');
const loadGuidedTutorial = () => import('./components/tutorial/GuidedTutorial');

const StudentsView = lazy(() => loadStudentsView().then((m) => ({ default: m.StudentsView })));
const SessionsView = lazy(() => loadSessionsView().then((m) => ({ default: m.SessionsView })));
const ReportsView = lazy(() => loadReportsView().then((m) => ({ default: m.ReportsView })));
const SettingsView = lazy(() => loadSettingsView().then((m) => ({ default: m.SettingsView })));

const AddEditStudentModal = lazy(() =>
  loadAddEditStudentModal().then((m) => ({ default: m.AddEditStudentModal }))
);
const AddEditGroupModal = lazy(() =>
  loadAddEditGroupModal().then((m) => ({ default: m.AddEditGroupModal }))
);
const AddEditSessionModal = lazy(() =>
  loadAddEditSessionModal().then((m) => ({ default: m.AddEditSessionModal }))
);
const BulkAddSessionModal = lazy(() =>
  loadBulkAddSessionModal().then((m) => ({ default: m.BulkAddSessionModal }))
);
const EnrollExistingStudentModal = lazy(() =>
  loadEnrollExistingStudentModal().then((m) => ({ default: m.EnrollExistingStudentModal }))
);
const StudentProfileModal = lazy(() =>
  loadStudentProfileModal().then((m) => ({ default: m.StudentProfileModal }))
);
const GroupProfileModal = lazy(() =>
  loadGroupProfileModal().then((m) => ({ default: m.GroupProfileModal }))
);
const RecordAttendanceModal = lazy(() =>
  loadRecordAttendanceModal().then((m) => ({ default: m.RecordAttendanceModal }))
);
const AddPaymentModal = lazy(() =>
  loadAddPaymentModal().then((m) => ({ default: m.AddPaymentModal }))
);
const NotificationsModal = lazy(() =>
  loadNotificationsModal().then((m) => ({ default: m.NotificationsModal }))
);
const PrivateClassIntakeModal = lazy(() =>
  loadPrivateClassIntakeModal().then((m) => ({ default: m.PrivateClassIntakeModal }))
);
const GuidedTutorial = lazy(() =>
  loadGuidedTutorial().then((m) => ({ default: m.GuidedTutorial }))
);

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
  if (prev === next) return prev;
  if (prev.length !== next.length) return next;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return next;
  }
  return prev;
}

function usePanelLatchedValue<T>(shouldUpdate: boolean, value: T): T {
  const latchedRef = useRef<T>(value);
  if (shouldUpdate) {
    latchedRef.current = value;
  }
  return latchedRef.current;
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

const TabPanel: React.FC<TabPanelProps> = React.memo(
  ({ panelKey, isActive, isMounted, motionClass, scrollPositionsRef, children }) => {
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
  }
);

export default function App() {
  const { t, language, isRTL } = useTranslation();
  const isEn = language.startsWith('en');
  const isEnRef = useRef(isEn);
  isEnRef.current = isEn;

  const { popTopModal } = useModalActions();
  const hasOpenModals = useHasOpenModals();

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
  const [peekingTab, setPeekingTab] = useState<TopLevelNavTab | null>(null);
  const [navMotion, setNavMotion] = useState<{ cls: NavMotionClass; parity: 0 | 1 }>({
    cls: '',
    parity: 0,
  });

  const previousMainTabRef = useRef<TopLevelNavTab>('dashboard');
  const tabScrollPositionsRef = useRef<Partial<Record<PanelKey, number>>>({});

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => db.getCurrentSession());

  // Database Data States
  const [students, setStudents] = useState<Student[]>(() => db.getStudents());
  const [groups, setGroups] = useState<Group[]>(() => db.getGroups());
  const [enrollments, setEnrollments] = useState<Enrollment[]>(() => db.getEnrollments());
  const [sessions, setSessions] = useState<Session[]>(() => db.getSessions());
  const [attendance, setAttendance] = useState<Attendance[]>(() => db.getAttendance());
  const [payments, setPayments] = useState<Payment[]>(() => db.getPayments());
  const [domainRevision, setDomainRevision] = useState<number>(() => db.getDomainRevision());
  const [notifRevision, setNotifRevision] = useState<number>(() => getNotificationRevision());
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile>(() => db.getTeacherProfile());
  const [navToast, setNavToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [appPrivateIntakeTarget, setAppPrivateIntakeTarget] = useState<{
    student: Student;
    enrollment?: Enrollment | null;
    session?: Session | null;
    dateStr: string;
    rawTime?: string;
  } | null>(null);

  const studentsRef = useRef(students);
  studentsRef.current = students;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const enrollmentsRef = useRef(enrollments);
  enrollmentsRef.current = enrollments;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const domainRevisionRef = useRef(domainRevision);
  domainRevisionRef.current = domainRevision;

  const hasLocalData =
    students.length > 0 ||
    groups.length > 0 ||
    enrollments.length > 0 ||
    sessions.length > 0 ||
    attendance.length > 0 ||
    payments.length > 0;
  const hasLocalDataRef = useRef(hasLocalData);
  hasLocalDataRef.current = hasLocalData;

  // Refresh state from database while preserving unchanged array/object references
  const refreshData = useCallback(() => {
    setPeekingTab((prev) => (prev === null ? prev : null));
    setStudents((prev) => preserveArrayIfUnchanged(prev, db.getStudents()));
    setGroups((prev) => preserveArrayIfUnchanged(prev, db.getGroups()));
    setEnrollments((prev) => preserveArrayIfUnchanged(prev, db.getEnrollments()));
    setSessions((prev) => preserveArrayIfUnchanged(prev, db.getSessions()));
    setAttendance((prev) => preserveArrayIfUnchanged(prev, db.getAttendance()));
    setPayments((prev) => preserveArrayIfUnchanged(prev, db.getPayments()));
    setDomainRevision((prev) => {
      const next = db.getDomainRevision();
      domainRevisionRef.current = next;
      return prev === next ? prev : next;
    });
    setTeacherProfile((prev) => {
      const next = db.getTeacherProfile();
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
    scheduleDailyAttendanceReminder({ isEn: isEnRef.current }).catch(() => {});
  }, []);

  // Track genuine cloud hydration ONLY when the local store is empty (zero re-renders when data is already in memory)
  const [isCloudHydratingEmpty, setIsCloudHydratingEmpty] = useState<boolean>(() => {
    if (!currentUser) return false;
    return !hasLocalData && db.getAutoSyncConfig(currentUser.id).status === 'syncing';
  });

  useEffect(() => {
    if (!currentUser) {
      setIsCloudHydratingEmpty(false);
      return;
    }
    const syncListener = () => {
      const syncing = db.getAutoSyncConfig(currentUser.id).status === 'syncing';
      setIsCloudHydratingEmpty((prev) => {
        const next = syncing && !hasLocalDataRef.current;
        return prev === next ? prev : next;
      });
      if (!syncing && db.getDomainRevision() !== domainRevisionRef.current) {
        refreshData();
      }
    };
    syncListener();
    const unsubSync = db.subscribeToSyncUpdates(syncListener);
    const handleStorageEvent = () => {
      if (db.getDomainRevision() !== domainRevisionRef.current) {
        refreshData();
      }
    };
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      unsubSync();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [currentUser?.id, refreshData]);

  const isHydratingEmptyStore = Boolean(currentUser) && isCloudHydratingEmpty && !hasLocalData;

  // Referentially stable navigation dispatcher (never causes inactive tabs to re-render)
  const navigateWithMotion = useCallback(
    (
      nextTab: ActiveTab,
      explicitDirection?:
        | 'forward'
        | 'backward'
        | 'nested-return'
        | 'swipe-left'
        | 'swipe-right'
        | 'swipe-settled'
    ) => {
      const currentTab = activeTabRef.current;

      setPeekingTab((prev) => (prev === null ? prev : null));
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
      if (explicitDirection === 'swipe-settled') {
        resolvedClass = '';
      } else if (explicitDirection === 'swipe-left') {
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

  // Subscribe to notification revision updates for accurate unread badge counts
  useEffect(() => {
    return subscribeToNotifications(() => {
      setNotifRevision(getNotificationRevision());
    });
  }, []);

  const unreadNotificationsCount = React.useMemo(() => {
    if (!currentUser) return 0;
    return getUnreadNotificationsCount(currentUser.id);
  }, [currentUser?.id, domainRevision, notifRevision, language]);

  // Centralized Notification Tap Router (handles both in-app Notification Center & OS/Web notification taps)
  const handleNotificationTargetNavigation = useCallback(
    (payload: Partial<SmartReminderItem> & Record<string, any>) => {
      if (!payload || typeof payload !== 'object') return;

      const activeSessionUser = db.getCurrentSession();
      if (payload.userId && activeSessionUser && payload.userId !== activeSessionUser.id) {
        setNavToast({
          message: isEnRef.current
            ? 'This alert belongs to another account.'
            : 'هذا الإشعار مرتبط بحساب مستخدم آخر.',
          type: 'info',
        });
        return;
      }

      const action = payload.actionType as string | undefined;

      // 1. OS Permissions / Settings routing
      if (action === 'open_permissions') {
        navigateWithMotion('settings');
        requestPlatformNotificationPermission()
          .then((res) => {
            if (res === 'granted') {
              resetPermissionAlertDismissal(activeSessionUser?.id);
            }
          })
          .catch(() => {});
        return;
      }

      if (action === 'open_settings' || payload.targetTab === 'settings') {
        navigateWithMotion('settings');
        return;
      }

      const rawType = payload.type as string | undefined;
      if (action === 'open_session' || rawType === 'daily_attendance_reminder') {
        navigateWithMotion('sessions');
        return;
      }

      const latestStudents = db.getStudents();
      const latestGroups = db.getGroups();
      const latestEnrollments = db.getEnrollments();
      const latestSessions = db.getSessions();

      // 2. Payment routing
      if (action === 'add_payment') {
        const stu = payload.studentId
          ? latestStudents.find((s) => s.id === payload.studentId && s.status !== 'archived')
          : undefined;
        if (!stu) {
          setNavToast({
            message: tRef.current('notifTargetUnavailable'),
            type: 'info',
          });
          return;
        }
        setTargetStudentForPayment(stu);
        setTargetEnrollmentIdForPayment(payload.enrollmentId);
        setIsAddPaymentOpen(true);
        return;
      }

      // 3. Private Lesson routing (STRICT RULE: NEVER open bulk group attendance modal for private lessons)
      const matchedSession = payload.sessionId
        ? latestSessions.find((s) => s.id === payload.sessionId)
        : undefined;
      const matchedGroup = payload.groupId
        ? latestGroups.find((g) => g.id === payload.groupId)
        : matchedSession?.groupId
        ? latestGroups.find((g) => g.id === matchedSession.groupId)
        : undefined;
      const isPrivateTarget =
        action === 'open_private_session' ||
        payload.isPrivate === true ||
        Boolean(matchedSession?.studentId) ||
        matchedGroup?.type === 'private';

      if (isPrivateTarget && (action === 'open_private_session' || action === 'record_attendance')) {
        const studentId = payload.studentId || matchedSession?.studentId;
        const stu = studentId
          ? latestStudents.find((s) => s.id === studentId && s.status !== 'archived')
          : undefined;

        if (!stu) {
          setNavToast({
            message: tRef.current('notifTargetUnavailable'),
            type: 'info',
          });
          return;
        }

        const enr =
          (payload.enrollmentId
            ? latestEnrollments.find((e) => e.id === payload.enrollmentId)
            : undefined) ||
          latestEnrollments.find(
            (e) => e.studentId === stu.id && (e.serviceType === 'private' || !e.groupId)
          ) ||
          null;

        setAppPrivateIntakeTarget({
          student: stu,
          enrollment: enr,
          session: matchedSession || null,
          dateStr: payload.date || matchedSession?.date || toLocalISODate(),
          rawTime: payload.rawTime || matchedSession?.startTime || '16:00',
        });
        return;
      }

      // 4. Group Attendance routing
      if (action === 'record_attendance') {
        if (matchedSession) {
          attendanceModal.open(matchedSession);
          return;
        }
        if (matchedGroup) {
          const dateStr = payload.date || toLocalISODate();
          const existingToday = latestSessions.find(
            (s) => s.groupId === matchedGroup.id && s.date === dateStr && !s.studentId
          );
          if (existingToday) {
            attendanceModal.open(existingToday);
            return;
          }
          // Create concrete scheduled group session for that date so teacher can record attendance immediately
          const dObj = parseLocalDateStr(dateStr);
          const validDate = !isNaN(dObj.getTime()) ? dObj : new Date();
          const canonDay = DAY_INDEX_TO_CANONICAL[validDate.getDay()] || 'saturday';
          const nowIso = new Date().toISOString();
          const startTime = payload.rawTime || matchedGroup.scheduleTime || '16:00';
          const newGroupSession: Session = {
            id: `ses_notif_${matchedGroup.id}_${dateStr}_${parseTimeToMinutes(startTime)}`,
            groupId: matchedGroup.id,
            title: matchedGroup.name,
            date: dateStr,
            dayName: getLocalizedWeekdayName(canonDay, true),
            month: validDate.getMonth() + 1,
            year: validDate.getFullYear(),
            startTime,
            status: 'scheduled',
            pricePerStudent: matchedGroup.defaultPrice || 100,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          db.saveSession(newGroupSession);
          refreshData();
          attendanceModal.open(newGroupSession);
          return;
        }

        setNavToast({
          message: tRef.current('notifTargetUnavailable'),
          type: 'info',
        });
        return;
      }

      // 5. Student or Group Dossier routing
      if (action === 'open_student' || payload.studentId) {
        const stu = payload.studentId
          ? latestStudents.find((s) => s.id === payload.studentId)
          : undefined;
        if (!stu) {
          setNavToast({
            message: tRef.current('notifTargetUnavailable'),
            type: 'info',
          });
          return;
        }
        studentProfileModal.open(stu);
        return;
      }

      if (action === 'open_group' || payload.groupId) {
        if (!matchedGroup) {
          setNavToast({
            message: tRef.current('notifTargetUnavailable'),
            type: 'info',
          });
          return;
        }
        groupProfileModal.open(matchedGroup);
        return;
      }

      navigateWithMotion('dashboard');
    },
    [navigateWithMotion, refreshData]
  );

  const handleConfirmAppPrivateIntake = useCallback(
    (result: PrivateClassIntakeResult) => {
      if (!appPrivateIntakeTarget) return;
      const { student, enrollment, session: existingSession, dateStr, rawTime } = appPrivateIntakeTarget;

      let session = existingSession;
      if (!session) {
        const nowIso = new Date().toISOString();
        const mins = parseTimeToMinutes(rawTime || '16:00');
        const safeMins = mins === 99999 ? 960 : mins;
        const deterministicId = `sess_${dateStr}_stu_${student.id}_${safeMins}`;
        const dObj = parseLocalDateStr(dateStr);
        const validDate = !isNaN(dObj.getTime()) ? dObj : new Date();
        const canonDay = DAY_INDEX_TO_CANONICAL[validDate.getDay()] || 'saturday';

        session = db.getSessionById(deterministicId) || {
          id: deterministicId,
          groupId: '',
          enrollmentId: enrollment?.id,
          studentId: student.id,
          title: isEnRef.current
            ? `Private Lesson - ${student.name}`
            : `درس خاص - ${student.name}`,
          date: dateStr,
          dayName: getLocalizedWeekdayName(canonDay, true),
          startTime: rawTime || '16:00',
          hours: result.hours || 1.5,
          hourlyRate: result.pricePerStudent || enrollment?.hourlyRate || 100,
          pricePerStudent: result.pricePerStudent || enrollment?.customPrice || 100,
          status: 'scheduled',
          month: validDate.getMonth() + 1,
          year: validDate.getFullYear(),
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      }

      const isHourly =
        session.isHourly ||
        enrollment?.billingMode === 'hourly' ||
        enrollment?.billingType === 'hourly';
      const finalStatus = result.attendanceStatus || 'present';
      const isCharged =
        result.isCharged !== undefined ? result.isCharged : finalStatus !== 'absent_free';
      const existingAtt = db
        .getSessionAttendance(session.id)
        .find((a) => a.studentId === student.id);

      const record: Attendance = {
        ...existingAtt,
        id: existingAtt?.id || `att_${session.id}_${student.id}`,
        sessionId: session.id,
        studentId: student.id,
        enrollmentId: enrollment?.id || session.enrollmentId,
        status: finalStatus,
        isCharged,
        sessionUnits: isHourly ? undefined : result.sessionUnits,
        hours: isHourly ? result.hours : undefined,
        notes: result.notes,
        behaviorRating: result.behaviorRating,
        homeworkRating: result.homeworkRating,
        absenceReason:
          finalStatus === 'absent_free'
            ? result.notes || (isEnRef.current ? 'Uncharged Absence' : 'غياب غير محسوب')
            : undefined,
        recordedAt: existingAtt?.recordedAt || new Date().toISOString(),
      };

      db.saveSession({
        ...session,
        status: 'completed',
        sessionUnits: isHourly ? undefined : result.sessionUnits,
        hours: isHourly ? result.hours : undefined,
        pricePerStudent: result.pricePerStudent,
        notes: result.notes !== undefined ? result.notes : session.notes,
      });
      db.saveAttendanceBatch(session.id, [record]);

      setAppPrivateIntakeTarget(null);
      refreshData();
    },
    [appPrivateIntakeTarget, refreshData]
  );

  // Initialize Local Notifications and Tap Action Listener
  useEffect(() => {
    initLocalNotifications((extra) => {
      if (extra && typeof extra === 'object') {
        handleNotificationTargetNavigation(extra);
      } else {
        navigateWithMotion('sessions');
      }
    });

    const handleReminderEvent = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (detail && typeof detail === 'object') {
        handleNotificationTargetNavigation(detail);
      } else {
        navigateWithMotion('sessions');
      }
    };
    window.addEventListener('classy_open_attendance_reminder', handleReminderEvent);

    scheduleDailyAttendanceReminder({ isEn }).catch(() => {});

    return () => {
      window.removeEventListener('classy_open_attendance_reminder', handleReminderEvent);
    };
  }, [isEn, navigateWithMotion, handleNotificationTargetNavigation]);

  // Process any pending resets on startup or network recovery
  useEffect(() => {
    db.processPendingResets().catch(() => {});
  }, []);

  // Turn the 2.2s splash window into a staggered idle pre-warmer for lazy chunks, caches & neighbor tabs
  useEffect(() => {
    if (!currentUser) return;

    const runIdle = (fn: () => void, delayMs: number): number => {
      return window.setTimeout(() => {
        const win = window as any;
        if (typeof win.requestIdleCallback === 'function') {
          win.requestIdleCallback(fn, { timeout: 300 });
        } else {
          fn();
        }
      }, delayMs);
    };

    const t1 = runIdle(() => {
      Promise.all([
        loadSessionsView(),
        loadStudentsView(),
        loadReportsView(),
        loadSettingsView(),
        loadStudentProfileModal(),
        loadGroupProfileModal(),
        loadRecordAttendanceModal(),
        loadAddPaymentModal(),
        loadGuidedTutorial(),
      ]).catch(() => {});
    }, 80);

    const t2 = runIdle(() => {
      Promise.all([
        loadAddEditStudentModal(),
        loadAddEditGroupModal(),
        loadAddEditSessionModal(),
        loadBulkAddSessionModal(),
        loadEnrollExistingStudentModal(),
        loadNotificationsModal(),
        loadPrivateClassIntakeModal(),
      ]).catch(() => {});
      try {
        db.warmCaches(currentUser.id);
      } catch {}
    }, 280);

    const t3 = runIdle(() => {
      startTransition(() => {
        setVisitedPanels((prev) => (prev.sessions ? prev : { ...prev, sessions: true }));
      });
    }, 480);

    const t4 = runIdle(() => {
      startTransition(() => {
        setVisitedPanels((prev) => (prev.students ? prev : { ...prev, students: true }));
      });
    }, 760);

    const t5 = runIdle(() => {
      startTransition(() => {
        setVisitedPanels((prev) => (prev.reports ? prev : { ...prev, reports: true }));
      });
    }, 1060);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      window.clearTimeout(t5);
    };
  }, [currentUser?.id]);

  // Auth Handlers
  const handleLoginSuccess = useCallback(
    (user: UserAccount) => {
      setCurrentUser(user);
      setVisitedPanels(INITIAL_VISITED_PANELS);
      setPeekingTab(null);
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
    setPeekingTab(null);
    tabScrollPositionsRef.current = {};
    previousMainTabRef.current = 'dashboard';
    studentsSegmentRef.current = 'students';
    setStudentsSegment('students');
    setNavMotion({ cls: '', parity: 0 });
    activeTabRef.current = 'dashboard';
    setActiveTab('dashboard');
    refreshData();
  }, [refreshData]);

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

  const handleEnsureTabMounted = useCallback((targetTab: TopLevelNavTab) => {
    setVisitedPanels((prev) => (prev[targetTab] ? prev : { ...prev, [targetTab]: true }));
    setPeekingTab((prev) => (prev === targetTab ? prev : targetTab));
  }, []);

  const handleSwipeNavigate = useCallback(
    (
      targetTab: TopLevelNavTab,
      direction: 'forward' | 'backward',
      settledByDrag?: boolean
    ) => {
      if (settledByDrag) {
        navigateWithMotion(targetTab, 'swipe-settled');
      } else {
        navigateWithMotion(targetTab, direction === 'forward' ? 'swipe-left' : 'swipe-right');
      }
    },
    [navigateWithMotion]
  );

  // Top-level horizontal swipe gesture (disabled when logged out, on Settings, or when any modal/sheet is active)
  const isSwipeDisabled =
    !currentUser ||
    activeTab === 'settings' ||
    isQuickAddOpen ||
    hasOpenModals ||
    studentProfileModal.isOpen ||
    groupProfileModal.isOpen ||
    attendanceModal.isOpen ||
    isAddStudentOpen ||
    isAddGroupOpen ||
    isAddSessionOpen ||
    isBulkAddSessionOpen ||
    isAddPaymentOpen ||
    isEnrollModalOpen ||
    isNotificationsModalOpen ||
    Boolean(appPrivateIntakeTarget);

  const { stageRef, swipeBind } = usePageSwipeNavigation({
    activeTab,
    disabled: isSwipeDisabled,
    onSwipeNavigate: handleSwipeNavigate,
    onEnsureTabMounted: handleEnsureTabMounted,
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

  // Latch domain props for mounted inactive panels so background mutations do not re-render hidden heavy views,
  // while synchronously delivering the latest domain state on the exact render a tab becomes active or swipe-peeked.
  const shouldUpdateDashboard =
    isDashboardActive || peekingTab === 'dashboard' || !visitedPanels.dashboard;
  const shouldUpdateSessions =
    isSessionsActive || peekingTab === 'sessions' || !visitedPanels.sessions;
  const shouldUpdateReports =
    isReportsActive || peekingTab === 'reports' || !visitedPanels.reports;
  const shouldUpdateStudents =
    isStudentsActive || peekingTab === 'students' || !visitedPanels.students;
  const shouldUpdateSettings = isSettingsActive || !visitedPanels.settings;

  const dashboardStudents = usePanelLatchedValue(shouldUpdateDashboard, students);
  const dashboardGroups = usePanelLatchedValue(shouldUpdateDashboard, groups);
  const dashboardEnrollments = usePanelLatchedValue(shouldUpdateDashboard, enrollments);
  const dashboardSessions = usePanelLatchedValue(shouldUpdateDashboard, sessions);
  const dashboardAttendance = usePanelLatchedValue(shouldUpdateDashboard, attendance);
  const dashboardPayments = usePanelLatchedValue(shouldUpdateDashboard, payments);
  const dashboardTeacherProfile = usePanelLatchedValue(shouldUpdateDashboard, teacherProfile);
  const dashboardIsLoading = usePanelLatchedValue(shouldUpdateDashboard, isHydratingEmptyStore);

  const sessionsList = usePanelLatchedValue(shouldUpdateSessions, sessions);
  const sessionsGroups = usePanelLatchedValue(shouldUpdateSessions, groups);
  const sessionsStudents = usePanelLatchedValue(shouldUpdateSessions, students);
  const sessionsEnrollments = usePanelLatchedValue(shouldUpdateSessions, enrollments);
  const sessionsAttendance = usePanelLatchedValue(shouldUpdateSessions, attendance);
  const sessionsPayments = usePanelLatchedValue(shouldUpdateSessions, payments);
  const sessionsIsLoading = usePanelLatchedValue(shouldUpdateSessions, isHydratingEmptyStore);

  const reportsStudents = usePanelLatchedValue(shouldUpdateReports, students);
  const reportsGroups = usePanelLatchedValue(shouldUpdateReports, groups);
  const reportsEnrollments = usePanelLatchedValue(shouldUpdateReports, enrollments);
  const reportsSessions = usePanelLatchedValue(shouldUpdateReports, sessions);
  const reportsAttendance = usePanelLatchedValue(shouldUpdateReports, attendance);
  const reportsPayments = usePanelLatchedValue(shouldUpdateReports, payments);
  const reportsIsLoading = usePanelLatchedValue(shouldUpdateReports, isHydratingEmptyStore);

  const studentsList = usePanelLatchedValue(shouldUpdateStudents, students);
  const studentsGroups = usePanelLatchedValue(shouldUpdateStudents, groups);
  const studentsEnrollments = usePanelLatchedValue(shouldUpdateStudents, enrollments);
  const studentsSessions = usePanelLatchedValue(shouldUpdateStudents, sessions);
  const studentsAttendance = usePanelLatchedValue(shouldUpdateStudents, attendance);
  const studentsPayments = usePanelLatchedValue(shouldUpdateStudents, payments);
  const studentsIsLoading = usePanelLatchedValue(shouldUpdateStudents, isHydratingEmptyStore);
  const studentsLatchedSegment = usePanelLatchedValue(
    shouldUpdateStudents,
    resolvedStudentsSegment
  );

  const settingsTeacherProfile = usePanelLatchedValue(shouldUpdateSettings, teacherProfile);
  const settingsCurrentUser = usePanelLatchedValue(shouldUpdateSettings, currentUser);

  const dashboardUnreadCount = usePanelLatchedValue(
    shouldUpdateDashboard,
    unreadNotificationsCount
  );
  const sessionsUnreadCount = usePanelLatchedValue(
    shouldUpdateSessions,
    unreadNotificationsCount
  );
  const reportsUnreadCount = usePanelLatchedValue(
    shouldUpdateReports,
    unreadNotificationsCount
  );
  const studentsUnreadCount = usePanelLatchedValue(
    shouldUpdateStudents,
    unreadNotificationsCount
  );

  return (
    <div
      className="min-h-screen bg-page md:bg-mint flex items-center justify-center p-0 md:p-4 lg:p-6 select-none font-sans text-navy"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Animated Splash Screen Experience */}
      {showSplash && (
        <SplashScreen onComplete={handleSplashComplete} autoDismissMs={2200} />
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
                motionClass={isDashboardActive ? activeMotionClass : ''}
                scrollPositionsRef={tabScrollPositionsRef}
              >
                <MemoDashboardView
                  students={dashboardStudents}
                  groups={dashboardGroups}
                  enrollments={dashboardEnrollments}
                  sessions={dashboardSessions}
                  allAttendance={dashboardAttendance}
                  payments={dashboardPayments}
                  teacherProfile={dashboardTeacherProfile}
                  isLoading={dashboardIsLoading}
                  onOpenAddStudent={handleOpenAddStudent}
                  onOpenAddGroup={handleOpenAddGroup}
                  onOpenAddSession={handleOpenAddSession}
                  onOpenAddPayment={handleOpenAddPaymentDefault}
                  onOpenStudentProfile={studentProfileModal.open}
                  onOpenGroupProfile={groupProfileModal.open}
                  onOpenAttendanceModal={attendanceModal.open}
                  onOpenNotificationsModal={handleOpenNotificationsModal}
                  unreadNotificationsCount={dashboardUnreadCount}
                  onNavigateToTab={handleTabChange}
                  onDataChanged={refreshData}
                />
              </TabPanel>

              <TabPanel
                panelKey="sessions"
                isActive={isSessionsActive}
                isMounted={visitedPanels.sessions}
                motionClass={isSessionsActive ? activeMotionClass : ''}
                scrollPositionsRef={tabScrollPositionsRef}
              >
                <Suspense
                  fallback={
                    <DelayedFallback delayMs={95}>
                      <SessionsScreenSkeleton />
                    </DelayedFallback>
                  }
                >
                  <MemoSessionsView
                    sessions={sessionsList}
                    groups={sessionsGroups}
                    students={sessionsStudents}
                    enrollments={sessionsEnrollments}
                    allAttendance={sessionsAttendance}
                    payments={sessionsPayments}
                    isLoading={sessionsIsLoading}
                    onOpenAddSession={handleOpenAddSession}
                    onEditSession={handleOpenEditSession}
                    onOpenAttendanceModal={attendanceModal.open}
                    onOpenStudentProfile={studentProfileModal.open}
                    onOpenGroupProfile={groupProfileModal.open}
                    onSessionDeleted={refreshData}
                    onDataChanged={refreshData}
                    onNavigateToTab={handleTabChange}
                    onOpenNotificationsModal={handleOpenNotificationsModal}
                    unreadNotificationsCount={sessionsUnreadCount}
                  />
                </Suspense>
              </TabPanel>

              <TabPanel
                panelKey="reports"
                isActive={isReportsActive}
                isMounted={visitedPanels.reports}
                motionClass={isReportsActive ? activeMotionClass : ''}
                scrollPositionsRef={tabScrollPositionsRef}
              >
                <Suspense
                  fallback={
                    <DelayedFallback delayMs={95}>
                      <ReportsScreenSkeleton />
                    </DelayedFallback>
                  }
                >
                  <MemoReportsView
                    students={reportsStudents}
                    groups={reportsGroups}
                    enrollments={reportsEnrollments}
                    sessions={reportsSessions}
                    allAttendance={reportsAttendance}
                    payments={reportsPayments}
                    isLoading={reportsIsLoading}
                    onOpenAddPayment={handleOpenAddPayment}
                    onOpenStudentProfile={studentProfileModal.open}
                    onNavigateToTab={handleTabChange}
                    onOpenNotificationsModal={handleOpenNotificationsModal}
                    unreadNotificationsCount={reportsUnreadCount}
                  />
                </Suspense>
              </TabPanel>

              <TabPanel
                panelKey="students"
                isActive={isStudentsActive}
                isMounted={visitedPanels.students}
                motionClass={isStudentsActive ? activeMotionClass : ''}
                scrollPositionsRef={tabScrollPositionsRef}
              >
                <Suspense
                  fallback={
                    <DelayedFallback delayMs={95}>
                      <StudentsScreenSkeleton segment={studentsLatchedSegment} />
                    </DelayedFallback>
                  }
                >
                  <MemoStudentsView
                    students={studentsList}
                    groups={studentsGroups}
                    enrollments={studentsEnrollments}
                    sessions={studentsSessions}
                    allAttendance={studentsAttendance}
                    payments={studentsPayments}
                    isLoading={studentsIsLoading}
                    activeSegment={studentsLatchedSegment}
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
                    unreadNotificationsCount={studentsUnreadCount}
                  />
                </Suspense>
              </TabPanel>

              <TabPanel
                panelKey="settings"
                isActive={isSettingsActive}
                isMounted={visitedPanels.settings}
                motionClass={isSettingsActive ? activeMotionClass : ''}
                scrollPositionsRef={tabScrollPositionsRef}
              >
                <Suspense
                  fallback={
                    <DelayedFallback delayMs={110}>
                      <SettingsAsyncFallback />
                    </DelayedFallback>
                  }
                >
                  <MemoSettingsView
                    teacherProfile={settingsTeacherProfile}
                    currentUser={settingsCurrentUser}
                    isActive={isSettingsActive}
                    onProfileUpdated={handleProfileUpdated}
                    onDataReset={refreshData}
                    onLogout={handleLogout}
                    onNavigateToTab={handleTabChange}
                    onBack={handleBackFromSettings}
                  />
                </Suspense>
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
        <Suspense fallback={null}>
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
            <Suspense
              fallback={
                studentProfileModal.isOpen ? (
                  <DelayedFallback delayMs={95}>
                    <ProfileSheetSkeleton />
                  </DelayedFallback>
                ) : null
              }
            >
              <StudentProfileModal
                isOpen={studentProfileModal.isOpen}
                onClose={studentProfileModal.close}
                student={studentProfileModal.item}
                allGroups={groups}
                domainRevision={domainRevision}
                onEditStudent={(st) => handleOpenEditStudent(st)}
                onOpenEnrollModal={(st) => handleOpenEnrollForStudent(st)}
                onOpenAddPayment={(st, enrId) => handleOpenAddPayment(st, enrId)}
                onDataChanged={refreshData}
              />
            </Suspense>
          )}

          {/* Group Dossier / Profile Modal */}
          {groupProfileModal.item && (
            <Suspense
              fallback={
                groupProfileModal.isOpen ? (
                  <DelayedFallback delayMs={95}>
                    <ProfileSheetSkeleton />
                  </DelayedFallback>
                ) : null
              }
            >
              <GroupProfileModal
                isOpen={groupProfileModal.isOpen}
                onClose={groupProfileModal.close}
                group={groupProfileModal.item}
                domainRevision={domainRevision}
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
            </Suspense>
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

          {/* Record Attendance Modal (Lesson Studio) */}
          {attendanceModal.item && (
            <Suspense
              fallback={
                attendanceModal.isOpen ? (
                  <DelayedFallback delayMs={95}>
                    <LessonStudioSheetSkeleton />
                  </DelayedFallback>
                ) : null
              }
            >
              <RecordAttendanceModal
                isOpen={attendanceModal.isOpen}
                onClose={attendanceModal.close}
                session={attendanceModal.item}
                isLoading={isHydratingEmptyStore}
                onSaveComplete={refreshData}
              />
            </Suspense>
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
              enrollments={enrollments}
              allAttendance={attendance}
              onOpenAddPayment={(st, enrId) => handleOpenAddPayment(st, enrId)}
              onOpenStudentProfile={(st) => studentProfileModal.open(st)}
              onOpenAttendanceModal={(ses) => attendanceModal.open(ses)}
              onOpenNotificationTarget={handleNotificationTargetNavigation}
              onOpenNotificationSettings={() => navigateWithMotion('settings')}
              onDataChanged={refreshData}
            />
          )}

          {/* Private Lesson Intake Modal (opened directly from Private Lesson notifications) */}
          {appPrivateIntakeTarget && (
            <PrivateClassIntakeModal
              isOpen={Boolean(appPrivateIntakeTarget)}
              onClose={() => setAppPrivateIntakeTarget(null)}
              student={appPrivateIntakeTarget.student}
              enrollment={appPrivateIntakeTarget.enrollment}
              session={appPrivateIntakeTarget.session}
              onConfirm={handleConfirmAppPrivateIntake}
            />
          )}

          {/* Interactive Hands-On Onboarding Tutorial Engine */}
          {currentUser && (
            <GuidedTutorial
              userId={currentUser.id}
              isAppReady={!showSplash && Boolean(currentUser) && !isHydratingEmptyStore}
              activeTab={activeTab}
              studentsSegment={resolvedStudentsSegment}
              students={students}
              groups={groups}
              sessions={sessions}
              isQuickAddOpen={isQuickAddOpen}
              isNotificationsOpen={isNotificationsModalOpen}
              isAddStudentOpen={isAddStudentOpen}
              isStudentProfileOpen={studentProfileModal.isOpen}
              isAddGroupOpen={isAddGroupOpen}
              isGroupProfileOpen={groupProfileModal.isOpen}
              isAttendanceOpen={attendanceModal.isOpen}
              isAddPaymentOpen={isAddPaymentOpen}
              isEnrollOpen={isEnrollModalOpen}
              onNavigateToTab={handleTabChange}
              onSetStudentsSegment={setStudentsSegment}
              onCloseQuickAdd={() => setIsQuickAddOpen(false)}
              onOpenNotifications={handleOpenNotificationsModal}
              onCloseNotifications={() => setIsNotificationsModalOpen(false)}
              onOpenAddStudent={handleOpenAddStudent}
              onCloseAddStudent={() => setIsAddStudentOpen(false)}
              onOpenStudentProfile={studentProfileModal.open}
              onCloseStudentProfile={studentProfileModal.close}
              onOpenAddGroup={handleOpenAddGroup}
              onCloseAddGroup={() => setIsAddGroupOpen(false)}
              onOpenGroupProfile={groupProfileModal.open}
              onCloseGroupProfile={groupProfileModal.close}
              onOpenAttendance={attendanceModal.open}
              onCloseAttendance={attendanceModal.close}
              onOpenAddPayment={(st) => handleOpenAddPayment(st)}
              onCloseAddPayment={() => {
                setIsAddPaymentOpen(false);
                setTargetStudentForPayment(null);
                setTargetEnrollmentIdForPayment(undefined);
              }}
              onCloseEnroll={() => setIsEnrollModalOpen(false)}
              onDataChanged={refreshData}
              onShowToast={(message) => setNavToast({ message, type: 'info' })}
            />
          )}
        </Suspense>

        <Toast
          isOpen={Boolean(navToast)}
          message={navToast?.message || ''}
          type={navToast?.type || 'info'}
          onClose={() => setNavToast(null)}
        />

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
