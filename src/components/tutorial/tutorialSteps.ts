import type { ActiveTab } from '../../types';
import type { AppIconName } from '../ui/AppIcon';
import type { TutorialChapterId } from '../../utils/tutorialProgress';

export type TutorialStepKind = 'interactive' | 'guided' | 'practice';

export interface TutorialAppSnapshot {
  userId: string;
  activeTab: ActiveTab;
  studentsSegment: 'students' | 'groups';
  studentsCount: number;
  groupsCount: number;
  sessionsCount: number;
  isQuickAddOpen: boolean;
  isNotificationsOpen: boolean;
  isAddStudentOpen: boolean;
  isStudentProfileOpen: boolean;
  isAddGroupOpen: boolean;
  isGroupProfileOpen: boolean;
  isAttendanceOpen: boolean;
  isAddPaymentOpen: boolean;
  isEnrollOpen: boolean;
  isReportsAttendanceTrendsActive: boolean;
  isReportsBillingStreamsActive: boolean;
}

export interface TutorialAppActions {
  navigateToTab: (tab: ActiveTab) => void;
  setStudentsSegment: (seg: 'students' | 'groups') => void;
  closeAllModals: () => void;
  openAddStudent: () => void;
  closeAddStudent: () => void;
  openFirstStudentProfile: () => boolean;
  closeStudentProfile: () => void;
  openAddGroup: () => void;
  closeAddGroup: () => void;
  openFirstGroupProfile: () => boolean;
  closeGroupProfile: () => void;
  openFirstGroupAttendance: () => boolean;
  closeAttendance: () => void;
  openAddPaymentPreview: () => void;
  closeAddPayment: () => void;
  openNotifications: () => void;
  closeNotifications: () => void;
  createPracticeStudent: () => void;
  createPracticeGroup: () => void;
  activateReportsSubTab: (
    reportType: 'teacher_overview' | 'overdue_list' | 'group_report' | 'student_report',
    subTab?: string
  ) => void;
}

export interface TutorialStepDefinition {
  id: string;
  chapterId: TutorialChapterId;
  kind: TutorialStepKind;
  /** Primary DOM target `[data-tutorial-id="..."]` */
  targetId: string;
  /** Optional fallback target ID if primary is conditionally absent (e.g., empty list) */
  fallbackTargetId?: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  /** Short callout prompt for interactive hands-on steps */
  actionHintAr?: string;
  actionHintEn?: string;
  /** Optional safety warning badge (e.g., before financial/attendance saves) */
  safetyNoteAr?: string;
  safetyNoteEn?: string;
  /** Optional 1-tap safe practice helper button shown inside the step card */
  practiceCtaAr?: string;
  practiceCtaEn?: string;
  onPracticeAction?: (actions: TutorialAppActions, snapshot: TutorialAppSnapshot) => void;
  /** Prepares the screen/state when entering or retrying this step */
  prepare?: (actions: TutorialAppActions, snapshot: TutorialAppSnapshot) => void;
  /** Evaluates whether the user has completed the hands-on action */
  isActionCompleted?: (
    snapshot: TutorialAppSnapshot,
    entrySnapshot: TutorialAppSnapshot | null
  ) => boolean;
  /** Whether completing the real UI action automatically advances after a brief visual confirmation */
  autoAdvanceOnComplete?: boolean;
  /** Optional helper executed when user taps "نفّذ لي الخطوة" (Show Me) on an interactive step */
  performShowMe?: (actions: TutorialAppActions, snapshot: TutorialAppSnapshot) => void;
}

export interface TutorialChapterDefinition {
  id: TutorialChapterId;
  code: string;
  icon: AppIconName;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  steps: TutorialStepDefinition[];
}

export const TUTORIAL_CHAPTERS: readonly TutorialChapterDefinition[] = [
  // =========================================================================
  // CHAPTER A — GETTING TO KNOW CLASSY
  // =========================================================================
  {
    id: 'getting_started',
    code: 'A',
    icon: 'home',
    titleAr: 'التعرّف على Classy',
    titleEn: 'Getting to Know Classy',
    subtitleAr: 'الرئيسية، شريط التنقل، الإشعارات، والإعدادات',
    subtitleEn: 'Dashboard, navigation bar, alerts, and settings',
    steps: [
      {
        id: 'a1_dashboard_progress',
        chapterId: 'getting_started',
        kind: 'guided',
        targetId: 'dashboard-progress-card',
        titleAr: 'بطاقة إنجاز اليوم',
        titleEn: "Today's Progress Card",
        bodyAr:
          'هنا تتابع حصصك المجدولة لليوم ونسبة الإنجاز لحظة بلحظة، مع زر سريع لبدء الحصة القادمة مباشرة.',
        bodyEn:
          'Track your scheduled classes and daily completion ring in real time, with a quick button to launch your next class.',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab !== 'dashboard') {
            actions.navigateToTab('dashboard');
          }
        },
      },
      {
        id: 'a2_dashboard_focus',
        chapterId: 'getting_started',
        kind: 'guided',
        targetId: 'dashboard-focus-grid',
        titleAr: 'تركيزك اليوم باختصار',
        titleEn: "Today's Focus Grid",
        bodyAr:
          'أربع بطاقات ذكية تعرض الحصص القادمة، الحصص التي تنتظر رصد الحضور، ومستحقات طلاب اليوم في نظرة واحدة.',
        bodyEn:
          'Four smart cards surface upcoming classes, unrecorded attendance, and due balances at a single glance.',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab !== 'dashboard') {
            actions.navigateToTab('dashboard');
          }
        },
      },
      {
        id: 'a3_header_notifications',
        chapterId: 'getting_started',
        kind: 'guided',
        targetId: 'header-notifications-btn',
        titleAr: 'مركز الإشعارات الذكي',
        titleEn: 'Smart Notification Center',
        bodyAr:
          'أيقونة الجرس تجمع تنبيهات مواعيد الحصص، الغياب المتكرر، وتجديد الباقات والمستحقات، ويمكنك الضغط عليها في أي وقت.',
        bodyEn:
          'The bell icon collects class reminders, repeated absences, package renewals, and payment alerts anytime.',
        prepare: (actions, snap) => {
          if (snap.isNotificationsOpen) {
            actions.closeNotifications();
          }
          if (snap.activeTab !== 'dashboard') {
            actions.navigateToTab('dashboard');
          }
        },
      },
      {
        id: 'a4_bottom_navigation',
        chapterId: 'getting_started',
        kind: 'guided',
        targetId: 'bottom-nav-bar',
        titleAr: 'شريط التنقل السريع وزر (+)',
        titleEn: 'Bottom Navigation & (+) Quick Actions',
        bodyAr:
          'تنقّل بلمسة واحدة أو بالسحب الأفقي بين الرئيسية، الحصص، التقارير، والطلاب. والزر الأوسط (+) يفتح قائمة الإجراءات الفورية.',
        bodyEn:
          'Switch tabs with a tap or horizontal swipe across Home, Sessions, Reports, and Students. Center (+) opens Quick Actions.',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab === 'settings') {
            actions.navigateToTab('dashboard');
          }
        },
      },
      {
        id: 'a5_open_settings_action',
        chapterId: 'getting_started',
        kind: 'interactive',
        targetId: 'header-settings-btn',
        titleAr: 'افتح شاشة الإعدادات بنفسك',
        titleEn: 'Open Settings Hands-On',
        bodyAr:
          'اضغط الآن على أيقونة الترس في أعلى الشاشة لفتح إعدادات البرنامج والتعرّف على طريقة الرجوع السلسة.',
        bodyEn:
          'Tap the gear icon in the top header now to open Settings and see how seamless back navigation works.',
        actionHintAr: 'اضغط على أيقونة الإعدادات (الترس) بالأعلى للمتابعة',
        actionHintEn: 'Tap the Settings gear icon in the header to continue',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab === 'settings') {
            actions.navigateToTab('dashboard');
          }
        },
        isActionCompleted: (snap) => snap.activeTab === 'settings',
        autoAdvanceOnComplete: true,
        performShowMe: (actions) => actions.navigateToTab('settings'),
      },
      {
        id: 'a6_return_from_settings',
        chapterId: 'getting_started',
        kind: 'interactive',
        targetId: 'settings-back-btn',
        titleAr: 'الرجوع الفوري للشاشة السابقة',
        titleEn: 'Return to Your Previous Tab',
        bodyAr:
          'ممتاز! الآن اضغط على سهم الرجوع في أعلى الإعدادات للعودة مباشرة إلى نفس التبويب الذي كنت فيه.',
        bodyEn:
          'Great! Now tap the Back arrow at the top of Settings to return directly to the exact tab you came from.',
        actionHintAr: 'اضغط على سهم الرجوع بأعلى اليمين/اليسار',
        actionHintEn: 'Tap the top Back arrow to return',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab !== 'settings') {
            actions.navigateToTab('settings');
          }
        },
        isActionCompleted: (snap) => snap.activeTab !== 'settings',
        autoAdvanceOnComplete: true,
        performShowMe: (actions) => actions.navigateToTab('dashboard'),
      },
    ],
  },

  // =========================================================================
  // CHAPTER B — STUDENTS & ENROLLMENT PERIODS
  // =========================================================================
  {
    id: 'students',
    code: 'B',
    icon: 'students',
    titleAr: 'إدارة الطلاب وفترات القيد',
    titleEn: 'Students & Enrollment Periods',
    subtitleAr: 'إضافة طالب، الاشتراكات، فترات التفعيل والإجازات، وملف الطالب',
    subtitleEn: 'Adding students, subscriptions, active dates/vacations & dossiers',
    steps: [
      {
        id: 'b1_open_students_tab',
        chapterId: 'students',
        kind: 'interactive',
        targetId: 'bottom-nav-students',
        titleAr: 'انتقل إلى قسم الطلاب',
        titleEn: 'Open the Students Section',
        bodyAr:
          'اضغط على أيقونة «الطلاب» في شريط التنقل السفلي لفتح سجل الطلاب والمجموعات.',
        bodyEn:
          'Tap the "Students" icon in the bottom navigation bar to open your Students & Groups directory.',
        actionHintAr: 'اضغط على تبويب «الطلاب» بالأسفل',
        actionHintEn: 'Tap the "Students" tab in the bottom bar',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab === 'students' || snap.activeTab === 'groups') {
            actions.navigateToTab('dashboard');
          }
        },
        isActionCompleted: (snap) =>
          snap.activeTab === 'students' || snap.activeTab === 'groups',
        autoAdvanceOnComplete: true,
        performShowMe: (actions) => {
          actions.navigateToTab('students');
          actions.setStudentsSegment('students');
        },
      },
      {
        id: 'b2_students_search_filters',
        chapterId: 'students',
        kind: 'guided',
        targetId: 'students-search-bar',
        titleAr: 'بحث فوري وتصفية ذكية',
        titleEn: 'Instant Search & Smart Filters',
        bodyAr:
          'يمكنك البحث بالاسم أو رقم الطالب أو ولي الأمر أو المدرسة، والتصفية بلمسة واحدة لمن «عليهم مستحقات» أو «دروس خاصة فقط» أو عرض الأرشيف.',
        bodyEn:
          'Search by name, student/parent phone, or school, and filter with one tap by "Have Dues", "Private Only", grade, or Archived.',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab !== 'students') {
            actions.navigateToTab('students');
          }
          if (snap.studentsSegment !== 'students') {
            actions.setStudentsSegment('students');
          }
        },
      },
      {
        id: 'b3_tap_add_student_btn',
        chapterId: 'students',
        kind: 'interactive',
        targetId: 'students-add-btn',
        titleAr: 'جرّب فتح نافذة إضافة طالب',
        titleEn: 'Open Add Student Form',
        bodyAr:
          'اضغط على زر «+ إضافة طالب» البرتقالي لفتح استمارة تسجيل طالب جديد واستكشاف إمكانياتها.',
        bodyEn:
          'Tap the orange "+ Add student" button to open the real student registration sheet.',
        actionHintAr: 'اضغط على زر «+ إضافة طالب»',
        actionHintEn: 'Tap "+ Add student"',
        prepare: (actions, snap) => {
          if (snap.isAddStudentOpen) {
            actions.closeAddStudent();
          }
          if (snap.activeTab !== 'students') {
            actions.navigateToTab('students');
          }
          if (snap.studentsSegment !== 'students') {
            actions.setStudentsSegment('students');
          }
        },
        isActionCompleted: (snap) => snap.isAddStudentOpen,
        autoAdvanceOnComplete: true,
        performShowMe: (actions) => {
          actions.navigateToTab('students');
          actions.setStudentsSegment('students');
          actions.openAddStudent();
        },
      },
      {
        id: 'b4_student_form_and_periods',
        chapterId: 'students',
        kind: 'practice',
        targetId: 'student-modal-form',
        titleAr: 'بيانات الطالب وفترة القيد والإجازات',
        titleEn: 'Student Details & Enrollment Periods',
        bodyAr:
          'أدخل اسم الطالب والمرحلة ونوع الاشتراك (مجموعة / درس خاص / كلاهما بدون دمج قسري). ومن قسم «فترة القيد والإجازات» يمكنك تحديد تاريخ بدء الدراسة أو إجازة مؤقتة فلا يُحسب عليه حضور قبل موعده.',
        bodyEn:
          'Set the student name, grade, and subscription mode (Group, Private, or Both independently). Use Enrollment Periods & Vacations to set start/end dates or temporary breaks.',
        safetyNoteAr:
          'يمكنك كتابة بياناتك بحرية، أو الضغط على الزر بالأسفل لإنشاء طالب تجريبي آمن بوسم [تجريبي] يمكنك حذفه لاحقاً بضغطة واحدة.',
        safetyNoteEn:
          'Type freely or tap below to create a safe [Practice]-tagged student that can be removed in 1 tap anytime.',
        practiceCtaAr: 'إنشاء طالب تجريبي آمن [تجريبي]',
        practiceCtaEn: 'Create Safe [Practice] Student',
        onPracticeAction: (actions) => {
          actions.createPracticeStudent();
          actions.closeAddStudent();
        },
        prepare: (actions, snap) => {
          if (!snap.isAddStudentOpen) {
            actions.navigateToTab('students');
            actions.setStudentsSegment('students');
            actions.openAddStudent();
          }
        },
        isActionCompleted: (snap, entrySnap) =>
          entrySnap !== null && snap.studentsCount > entrySnap.studentsCount,
      },
      {
        id: 'b5_student_profile_dossier',
        chapterId: 'students',
        kind: 'practice',
        targetId: 'student-profile-summary',
        fallbackTargetId: 'students-list-section',
        titleAr: 'الملف الشامل للطالب',
        titleEn: 'Comprehensive Student Dossier',
        bodyAr:
          'عند الضغط على بطاقة أي طالب يُفتح ملفه الكامل: كشف الحساب المالي، سجل الحضور والغياب، الدروس الخاصة، تقييمات السلوك والواجبات، والأرشفة الآمنة.',
        bodyEn:
          'Tapping any student card opens their full dossier: financial ledger, attendance history, private classes, behavior badges, and safe archiving.',
        practiceCtaAr: 'فتح ملف أول طالب للمعاينة',
        practiceCtaEn: 'Open First Student Dossier',
        onPracticeAction: (actions, snap) => {
          if (snap.studentsCount === 0) {
            actions.createPracticeStudent();
          }
          window.setTimeout(() => {
            actions.openFirstStudentProfile();
          }, 60);
        },
        prepare: (actions, snap) => {
          if (snap.isAddStudentOpen) {
            actions.closeAddStudent();
          }
          if (snap.activeTab !== 'students') {
            actions.navigateToTab('students');
          }
          if (snap.studentsSegment !== 'students') {
            actions.setStudentsSegment('students');
          }
        },
        isActionCompleted: (snap) => snap.isStudentProfileOpen,
      },
    ],
  },

  // =========================================================================
  // CHAPTER C — STUDY GROUPS
  // =========================================================================
  {
    id: 'groups',
    code: 'C',
    icon: 'groups',
    titleAr: 'المجموعات الدراسية',
    titleEn: 'Study Groups',
    subtitleAr: 'إنشاء المجموعات، المواعيد الأسبوعية، أنظمة المحاسبة، وتسجيل الطلاب',
    subtitleEn: 'Creating groups, weekly schedules, billing systems & enrolling students',
    steps: [
      {
        id: 'c1_switch_to_groups_segment',
        chapterId: 'groups',
        kind: 'interactive',
        targetId: 'students-segment-control',
        titleAr: 'افتح تبويب «المجموعات»',
        titleEn: 'Switch to the Groups Segment',
        bodyAr:
          'من أعلى شاشة الطلاب، اضغط على خيار «المجموعات» للتبديل الفوري إلى إدارة مجموعاتك الدراسية.',
        bodyEn:
          'At the top of the Students screen, tap "Groups" in the segmented switch to view your study groups.',
        actionHintAr: 'اختر «المجموعات» من المفتاح العلوي',
        actionHintEn: 'Select "Groups" in the top switch',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab !== 'students' && snap.activeTab !== 'groups') {
            actions.navigateToTab('students');
          }
          if (snap.studentsSegment === 'groups') {
            actions.setStudentsSegment('students');
          }
        },
        isActionCompleted: (snap) =>
          (snap.activeTab === 'students' || snap.activeTab === 'groups') &&
          snap.studentsSegment === 'groups',
        autoAdvanceOnComplete: true,
        performShowMe: (actions) => {
          actions.navigateToTab('groups');
          actions.setStudentsSegment('groups');
        },
      },
      {
        id: 'c2_tap_add_group_btn',
        chapterId: 'groups',
        kind: 'interactive',
        targetId: 'groups-add-btn',
        titleAr: 'إنشاء مجموعة جديدة',
        titleEn: 'Open Create Group Sheet',
        bodyAr:
          'اضغط على زر «+ إضافة مجموعة» لتحديد اسم المجموعة، المادة، المواعيد الأسبوعية، ونظام المحاسبة.',
        bodyEn:
          'Tap "+ Add group" to configure a group name, subject, weekly class days/times, and billing mode.',
        actionHintAr: 'اضغط على زر «+ إضافة مجموعة»',
        actionHintEn: 'Tap "+ Add group"',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab !== 'students' && snap.activeTab !== 'groups') {
            actions.navigateToTab('groups');
          }
          if (snap.studentsSegment !== 'groups') {
            actions.setStudentsSegment('groups');
          }
        },
        isActionCompleted: (snap) => snap.isAddGroupOpen,
        autoAdvanceOnComplete: true,
        performShowMe: (actions) => {
          actions.navigateToTab('groups');
          actions.setStudentsSegment('groups');
          actions.openAddGroup();
        },
      },
      {
        id: 'c3_group_form_details',
        chapterId: 'groups',
        kind: 'practice',
        targetId: 'group-modal-form',
        titleAr: 'مواعيد المجموعة ونظام التسعير',
        titleEn: 'Weekly Schedule & Billing System',
        bodyAr:
          'اختر أيام الحصص وتوقيت كل يوم بدقة، ثم حدد نظام المحاسبة للمجموعة: «بالحصة» أو «شهري» أو «باقة حصص» أو «بالساعة». سيظهر جدولها تلقائياً في تقويم الحصص!',
        bodyEn:
          'Pick weekly class days and start times, then choose Per Session, Monthly, Package, or Hourly billing. Classes appear automatically on your calendar!',
        safetyNoteAr:
          'يمكنك إنشاء مجموعتك الحقيقية الآن أو تجربة إنشاء مجموعة تدريبية آمنة بوسم [تجريبي].',
        safetyNoteEn:
          'Create your real group now or tap below to add a safe [Practice]-tagged sample group.',
        practiceCtaAr: 'إنشاء مجموعة تجريبية آمنة [تجريبي]',
        practiceCtaEn: 'Create Safe [Practice] Group',
        onPracticeAction: (actions) => {
          actions.createPracticeGroup();
          actions.closeAddGroup();
        },
        prepare: (actions, snap) => {
          if (!snap.isAddGroupOpen) {
            actions.navigateToTab('groups');
            actions.setStudentsSegment('groups');
            actions.openAddGroup();
          }
        },
        isActionCompleted: (snap, entrySnap) =>
          entrySnap !== null && snap.groupsCount > entrySnap.groupsCount,
      },
      {
        id: 'c4_group_profile_and_enroll',
        chapterId: 'groups',
        kind: 'practice',
        targetId: 'group-profile-enroll-btn',
        fallbackTargetId: 'groups-list-section',
        titleAr: 'ملف المجموعة وإضافة الطلاب المسجلين',
        titleEn: 'Group Dossier & Enrolling Students',
        bodyAr:
          'عند فتح أي مجموعة، ستجد إحصائيات الالتزام والتحصيل، وزر «إضافة مسجل» لضمّ طلابك المسجلين إلى المجموعة في ثوانٍ.',
        bodyEn:
          'Inside any Group dossier, view attendance & revenue KPIs and tap "Add Enrolled" to link existing students in seconds.',
        practiceCtaAr: 'فتح ملف أول مجموعة للمعاينة',
        practiceCtaEn: 'Open First Group Dossier',
        onPracticeAction: (actions, snap) => {
          if (snap.groupsCount === 0) {
            actions.createPracticeGroup();
          }
          window.setTimeout(() => {
            actions.openFirstGroupProfile();
          }, 60);
        },
        prepare: (actions, snap) => {
          if (snap.isAddGroupOpen) {
            actions.closeAddGroup();
          }
          if (snap.activeTab !== 'students' && snap.activeTab !== 'groups') {
            actions.navigateToTab('groups');
          }
          if (snap.studentsSegment !== 'groups') {
            actions.setStudentsSegment('groups');
          }
        },
        isActionCompleted: (snap) => snap.isGroupProfileOpen || snap.isEnrollOpen,
      },
    ],
  },

  // =========================================================================
  // CHAPTER D — SESSIONS & ATTENDANCE
  // =========================================================================
  {
    id: 'sessions_attendance',
    code: 'D',
    icon: 'sessions',
    titleAr: 'الحصص ورصد الحضور',
    titleEn: 'Sessions & Attendance',
    subtitleAr: 'التقويم الذكي، فصل المجموعات عن الخاص، وحالات الغياب المحسوب والمعفى',
    subtitleEn: 'Smart calendar, Group vs. Private separation, and charged/excused absences',
    steps: [
      {
        id: 'd1_open_sessions_tab',
        chapterId: 'sessions_attendance',
        kind: 'interactive',
        targetId: 'bottom-nav-sessions',
        titleAr: 'انتقل إلى شاشة الحصص',
        titleEn: 'Open the Sessions Screen',
        bodyAr:
          'اضغط على أيقونة «الحصص» في شريط التنقل السفلي لاستعراض تقويمك اليومي والأسبوعي والشهري.',
        bodyEn:
          'Tap the "Sessions" icon in the bottom bar to view your daily, weekly, and monthly teaching agenda.',
        actionHintAr: 'اضغط على تبويب «الحصص» بالأسفل',
        actionHintEn: 'Tap the "Sessions" tab in the bottom bar',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab === 'sessions') {
            actions.navigateToTab('dashboard');
          }
        },
        isActionCompleted: (snap) => snap.activeTab === 'sessions',
        autoAdvanceOnComplete: true,
        performShowMe: (actions) => actions.navigateToTab('sessions'),
      },
      {
        id: 'd2_navy_calendar',
        chapterId: 'sessions_attendance',
        kind: 'guided',
        targetId: 'sessions-navy-calendar',
        titleAr: 'التقويم التفاعلي (أسبوعي / شهري)',
        titleEn: 'Interactive Week & Month Calendar',
        bodyAr:
          'بدّل بين العرض الأسبوعي والشهري، واضغط على أي يوم لعرض حصصه المجدولة، أو اضغط على زر (+) لجدولة حصة إضافية أو تعويضية.',
        bodyEn:
          'Toggle between Week and Month views, tap any day to inspect its classes, or use (+) to schedule an extra or makeup session.',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab !== 'sessions') {
            actions.navigateToTab('sessions');
          }
        },
      },
      {
        id: 'd3_timeline_group_vs_private',
        chapterId: 'sessions_attendance',
        kind: 'guided',
        targetId: 'sessions-timeline-area',
        titleAr: 'فصل كامل بين المجموعات والدروس الخاصة',
        titleEn: 'Strict Group vs. Private Separation',
        bodyAr:
          'حصص المجموعات تفتح «استوديو التحضير الجماعي»، بينما الدرس الخاص يفتح «نافذة الدرس الخاص الفردية» مباشرة بدون إنشاء مجموعة وهمية، مع استبعاد الطلاب في الإجازات تلقائياً.',
        bodyEn:
          'Group sessions open the multi-student Lesson Studio, while Private lessons open a dedicated 1-on-1 intake modal—never mixing entities or charging students on vacation.',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab !== 'sessions') {
            actions.navigateToTab('sessions');
          }
        },
      },
      {
        id: 'd4_attendance_statuses',
        chapterId: 'sessions_attendance',
        kind: 'practice',
        targetId: 'attendance-modal-controls',
        fallbackTargetId: 'sessions-timeline-area',
        titleAr: 'رصد الحضور والغياب المحسوب أو المعفى',
        titleEn: 'Present, Late & Charged vs. Exempt Absence',
        bodyAr:
          'عند تحضير حصة، يمكنك تحديد «حاضر» أو «متأخر» أو «غائب»، وعند الغياب يخيّرك البرنامج بوضوح بين «غياب محسوب» (يخصم من الرصيد/يُستحق) أو «غياب معفى» مع تسجيل السبب وتقييم الواجب.',
        bodyEn:
          'Mark students Present, Late, or Absent. When Absent, choose between Charged Absence (consumes credit/due) or Exempt Absence with a recorded reason, plus homework status.',
        safetyNoteAr:
          'استكشف نافذة التحضير بأمان — لا يتم تعديل أي أرصدة إلا إذا ضغطت بنفسك على «حفظ الحضور وتحديث الأرصدة».',
        safetyNoteEn:
          'Explore safely — no balances are modified unless you explicitly tap "Save Attendance & Update Balances".',
        practiceCtaAr: 'معاينة نافذة تحضير حصة (إن وجدت)',
        practiceCtaEn: 'Preview Attendance Studio (if available)',
        onPracticeAction: (actions) => {
          actions.openFirstGroupAttendance();
        },
        prepare: (actions, snap) => {
          if (snap.activeTab !== 'sessions') {
            actions.navigateToTab('sessions');
          }
        },
        isActionCompleted: (snap) => snap.isAttendanceOpen,
      },
    ],
  },

  // =========================================================================
  // CHAPTER E — BILLING & PAYMENTS
  // =========================================================================
  {
    id: 'billing_payments',
    code: 'E',
    icon: 'wallet',
    titleAr: 'المحاسبة وتسجيل الدفعات',
    titleEn: 'Billing & Payments',
    subtitleAr: 'أنظمة الدفع الأربعة، رصيد الحصص، وتسجيل الدفعات بأمان',
    subtitleEn: 'Four billing modes, session credits, and safe payment recording',
    steps: [
      {
        id: 'e1_dues_and_balances_overview',
        chapterId: 'billing_payments',
        kind: 'guided',
        targetId: 'reports-type-control',
        titleAr: 'متابعة الأرصدة والمستحقات تلقائياً',
        titleEn: 'Automatic Balances & Dues Tracking',
        bodyAr:
          'يدعم Classy أربعة أنظمة محاسبة دقيقة: الشهري، بالحصة (مقدم أو آجل)، باقات الحصص، وبالساعة. ومن تبويب «المستحقات» في التقارير ترى فوراً الطلاب المتأخرين في السداد.',
        bodyEn:
          'Classy supports Monthly, Per-Session (prepaid/postpaid), Package, and Hourly billing. Use the "Dues" tab in Reports to see all outstanding student balances.',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab !== 'reports') {
            actions.navigateToTab('reports');
          }
          actions.activateReportsSubTab('overdue_list');
        },
      },
      {
        id: 'e2_payment_modal_modes',
        chapterId: 'billing_payments',
        kind: 'guided',
        targetId: 'payment-modal-types',
        fallbackTargetId: 'payment-modal-body',
        titleAr: 'نافذة تسجيل دفعة مالية مرنة',
        titleEn: 'Flexible Payment Recording Sheet',
        bodyAr:
          'عند تسجيل دفعة لطالب، يمكنك اختيار الاشتراك المحدد (مجموعة أو درس خاص)، وتحديد نوع السداد: «شهر معين» (يدعم الدفعات الجزئية)، «حصة واحدة»، «عدد حصص»، أو «مبلغ مالي»، مع وسيلة الدفع (كاش، فودافون كاش، إنستاباي، تحويل بنكي).',
        bodyEn:
          'Select the exact enrollment (Group or Private), pick Specific Month (supports partial payments), Single Session, Session Count, or Custom Amount, and choose Cash, Vodafone Cash, InstaPay, or Bank Transfer.',
        safetyNoteAr:
          'وضع المعاينة الآمنة: لا تضغط «حفظ» على طالب حقيقي إلا إذا أردت تسجيل دفعة فعلية.',
        safetyNoteEn:
          'Safe Preview: Do not tap Save on a real student unless recording an actual payment.',
        prepare: (actions, snap) => {
          if (!snap.isAddPaymentOpen) {
            actions.openAddPaymentPreview();
          }
        },
      },
      {
        id: 'e3_payment_safe_close',
        chapterId: 'billing_payments',
        kind: 'interactive',
        targetId: 'payment-cancel-btn',
        fallbackTargetId: 'payment-modal-body',
        titleAr: 'إغلاق آمن بدون تعديل حساباتك',
        titleEn: 'Close Safely Without Recording',
        bodyAr:
          'لحماية سجلاتك المالية الحقيقية أثناء التدريب، اضغط الآن على «إلغاء» لإغلاق نافذة الدفع بأمان تام دون إضافة أي مقبوضات غير مقصودة.',
        bodyEn:
          'To protect your real financial ledger during training, tap "Cancel" now to close the payment sheet without saving any unintended receipt.',
        actionHintAr: 'اضغط على زر «إلغاء» لإغلاق النافذة بأمان',
        actionHintEn: 'Tap "Cancel" to safely close the payment sheet',
        prepare: (actions, snap) => {
          if (!snap.isAddPaymentOpen) {
            actions.openAddPaymentPreview();
          }
        },
        isActionCompleted: (snap) => !snap.isAddPaymentOpen,
        autoAdvanceOnComplete: true,
        performShowMe: (actions) => actions.closeAddPayment(),
      },
    ],
  },

  // =========================================================================
  // CHAPTER F — REPORTS & ATTENDANCE ANALYTICS
  // =========================================================================
  {
    id: 'reports_analytics',
    code: 'F',
    icon: 'reports',
    titleAr: 'التقارير ومنحنيات الحضور',
    titleEn: 'Reports & Attendance Analytics',
    subtitleAr: 'نسبة التحصيل، منحنيات الحضور والالتزام، ومسارات المحاسبة',
    subtitleEn: 'Collection rates, attendance trend charts, and billing streams',
    steps: [
      {
        id: 'f1_open_reports_tab',
        chapterId: 'reports_analytics',
        kind: 'interactive',
        targetId: 'bottom-nav-reports',
        titleAr: 'افتح قسم التقارير المالية والتحليلية',
        titleEn: 'Open Reports & Analytics',
        bodyAr:
          'اضغط على أيقونة «التقارير» في شريط التنقل السفلي لاستعراض الأداء المالي وتحليلات حضور الطلاب.',
        bodyEn:
          'Tap the "Reports" icon in the bottom navigation bar to inspect financial summaries and attendance analytics.',
        actionHintAr: 'اضغط على تبويب «التقارير» بالأسفل',
        actionHintEn: 'Tap the "Reports" tab in the bottom bar',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab === 'reports') {
            actions.navigateToTab('sessions');
          }
        },
        isActionCompleted: (snap) => snap.activeTab === 'reports',
        autoAdvanceOnComplete: true,
        performShowMe: (actions) => {
          actions.navigateToTab('reports');
          actions.activateReportsSubTab('teacher_overview', 'overview');
        },
      },
      {
        id: 'f2_reports_collection_hero',
        chapterId: 'reports_analytics',
        kind: 'guided',
        targetId: 'reports-collection-card',
        titleAr: 'ملخص التحصيل والفترات الزمنية',
        titleEn: 'Collection Summary & Period Filters',
        bodyAr:
          'تعرض البطاقة الرئيسية صافي المحصل ونسبة التحصيل، ويمكنك تصفية الأرقام حسب «اليوم»، «هذا الشهر»، «الشهر الماضي»، أو تحديد فترة زمنية مخصصة.',
        bodyEn:
          'The executive card displays total collected revenue and collection percentage, filterable by Today, This Month, Last Month, or a Custom Date Range.',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab !== 'reports') {
            actions.navigateToTab('reports');
          }
          actions.activateReportsSubTab('teacher_overview', 'overview');
        },
      },
      {
        id: 'f3_attendance_trends_analytics',
        chapterId: 'reports_analytics',
        kind: 'interactive',
        targetId: 'reports-subtab-attendance_trends',
        titleAr: 'جرّب فتح «منحنيات الحضور»',
        titleEn: 'Explore Attendance Trends Analytics',
        bodyAr:
          'اضغط الآن على شريحة «منحنيات الحضور» لعرض الرسوم البيانية التفاعلية لنسب الحضور والغياب والالتزام عبر المجموعات والدروس الخاصة.',
        bodyEn:
          'Tap the "Attendance Trends" chip now to open interactive charts tracking presence, absence, and commitment across groups and private lessons.',
        actionHintAr: 'اضغط على شريحة «منحنيات الحضور» لاستعراض الرسم البياني',
        actionHintEn: 'Tap the "Attendance Trends" chip to view the chart',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab !== 'reports') {
            actions.navigateToTab('reports');
          }
          actions.activateReportsSubTab('teacher_overview', 'overview');
        },
        isActionCompleted: (snap) => snap.isReportsAttendanceTrendsActive,
        autoAdvanceOnComplete: false,
        performShowMe: (actions) => {
          actions.navigateToTab('reports');
          actions.activateReportsSubTab('teacher_overview', 'attendance_trends');
        },
      },
      {
        id: 'f4_billing_streams_breakdown',
        chapterId: 'reports_analytics',
        kind: 'guided',
        targetId: 'reports-subtab-billing_streams',
        titleAr: 'تحليل مسارات المحاسبة والمجموعات',
        titleEn: 'Billing Streams & Per-Group Reports',
        bodyAr:
          'ومن «مسارات المحاسبة» وتبويبات «المجموعات» و«الطلاب» يمكنك مقارنة عوائد الشهري والباقات والحصص الفردية ومراجعة السجل الشهري والسنوي بدقة.',
        bodyEn:
          'Use "Billing Streams", "Groups", and "Students" tabs to compare revenue across Monthly, Package, and Per-Session models alongside monthly/annual ledgers.',
        prepare: (actions, snap) => {
          if (snap.activeTab !== 'reports') {
            actions.navigateToTab('reports');
          }
          actions.activateReportsSubTab('teacher_overview', 'billing_streams');
        },
      },
    ],
  },

  // =========================================================================
  // CHAPTER G — SETTINGS, NOTIFICATIONS & CLOUD SYNC
  // =========================================================================
  {
    id: 'settings_sync',
    code: 'G',
    icon: 'settings',
    titleAr: 'الإعدادات، الإشعارات، والمزامنة',
    titleEn: 'Settings, Alerts & Cloud Sync',
    subtitleAr: 'اللغة والمظهر الداكن، النسخ الاحتياطي السحابي، وتنبيهات الهاتف',
    subtitleEn: 'Language & dark theme, cloud backup/sync, and mobile notifications',
    steps: [
      {
        id: 'g1_open_settings',
        chapterId: 'settings_sync',
        kind: 'interactive',
        targetId: 'header-settings-btn',
        titleAr: 'افتح الإعدادات لاستكمال الجولة',
        titleEn: 'Open Settings to Complete the Tour',
        bodyAr:
          'اضغط على أيقونة الإعدادات (الترس) في أعلى الشاشة لاستعراض خيارات التخصيص وحماية البيانات.',
        bodyEn:
          'Tap the Settings gear icon in the header to explore customization, alerts, and data protection.',
        actionHintAr: 'اضغط على أيقونة الإعدادات (الترس) بالأعلى',
        actionHintEn: 'Tap the Settings gear icon in the header',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab === 'settings') {
            actions.navigateToTab('reports');
          }
        },
        isActionCompleted: (snap) => snap.activeTab === 'settings',
        autoAdvanceOnComplete: true,
        performShowMe: (actions) => actions.navigateToTab('settings'),
      },
      {
        id: 'g2_language_and_theme',
        chapterId: 'settings_sync',
        kind: 'guided',
        targetId: 'settings-language-card',
        titleAr: 'اللغة، المظهر الداكن، والاهتزاز اللمسي',
        titleEn: 'Language, Dark Theme & Haptics',
        bodyAr:
          'بدّل في أي لحظة بين العربية والإنجليزية (RTL / LTR)، أو فعّل «الوضع الداكن» عالي التباين المريح للعين، مع التحكم في الاهتزاز اللمسي.',
        bodyEn:
          'Switch seamlessly between Arabic (RTL) and English (LTR), toggle high-contrast Harbor Mint Dark Mode, and customize haptic feedback.',
        prepare: (actions, snap) => {
          actions.closeAllModals();
          if (snap.activeTab !== 'settings') {
            actions.navigateToTab('settings');
          }
        },
      },
      {
        id: 'g3_cloud_sync_and_backup',
        chapterId: 'settings_sync',
        kind: 'guided',
        targetId: 'settings-cloud-sync-card',
        titleAr: 'الحفظ المحلي الفوري والمزامنة السحابية',
        titleEn: 'Local-First Safety & Cloud Backup',
        bodyAr:
          'يحفظ Classy بياناتك محلياً فوراً حتى بدون إنترنت. ومن هنا يمكنك تشغيل «مزامنة الآن» وتأكيد حالة السحابة الفعلية، أو تصدير واستيراد نسخة احتياطية بصيغة JSON في أي وقت.',
        bodyEn:
          'Classy saves changes locally right away even offline. Trigger "Sync Now" to verify real cloud sync status, or export/import a local JSON backup anytime.',
        prepare: (actions, snap) => {
          if (snap.activeTab !== 'settings') {
            actions.navigateToTab('settings');
          }
        },
      },
      {
        id: 'g4_notification_preferences',
        chapterId: 'settings_sync',
        kind: 'guided',
        targetId: 'settings-notifications-card',
        titleAr: 'تخصيص تنبيهات الحصص ونغمات الهاتف',
        titleEn: 'Mobile Alerts, Sounds & Quiet Hours',
        bodyAr:
          'تحكّم بدقة في تذكيرات قبل الحصة، تنبيهات الغياب وتجديد الباقات، نغمة الإشعار ومعاينتها الصوتية، وساعات الهدوء.',
        bodyEn:
          'Fine-tune class lead-time alarms, absence & package alerts, notification sound previews, and quiet hours.',
        prepare: (actions, snap) => {
          if (snap.activeTab !== 'settings') {
            actions.navigateToTab('settings');
          }
        },
      },
      {
        id: 'g5_relaunch_tutorial_anytime',
        chapterId: 'settings_sync',
        kind: 'guided',
        targetId: 'settings-tutorial-card',
        titleAr: 'العودة للجولة التفاعلية في أي وقت',
        titleEn: 'Relaunch Any Chapter Anytime',
        bodyAr:
          'من بطاقة «الجولة التفاعلية والمساعدة» هنا في الإعدادات يمكنك إعادة الجولة كاملة، أو فتح فصل محدد مباشرة، أو مسح أي بيانات [تجريبية] بضغطة واحدة!',
        bodyEn:
          'From this Interactive Guide card in Settings, restart the full tour, jump into any single chapter, or clean up [Practice] records in one tap!',
        prepare: (actions, snap) => {
          if (snap.activeTab !== 'settings') {
            actions.navigateToTab('settings');
          }
        },
      },
    ],
  },
];

export function getChapterById(chapterId: TutorialChapterId): TutorialChapterDefinition {
  return (
    TUTORIAL_CHAPTERS.find((c) => c.id === chapterId) || TUTORIAL_CHAPTERS[0]
  );
}

export function getTotalStepsCount(): number {
  return TUTORIAL_CHAPTERS.reduce((acc, ch) => acc + ch.steps.length, 0);
}

export function getGlobalStepNumber(chapterId: TutorialChapterId, stepIndex: number): number {
  let offset = 0;
  for (const ch of TUTORIAL_CHAPTERS) {
    if (ch.id === chapterId) {
      return offset + Math.min(Math.max(0, stepIndex), Math.max(0, ch.steps.length - 1)) + 1;
    }
    offset += ch.steps.length;
  }
  return 1;
}
