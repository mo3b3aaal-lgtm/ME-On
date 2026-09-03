import { useState, useEffect } from 'react';

export type AppLanguage = 'ar' | 'en-GB' | 'en-US';
export type Language = AppLanguage;

const STORAGE_KEY_LANG = 'tm_app_language_v2';

export interface LanguageOption {
  code: AppLanguage;
  name: string;
  nativeName: string;
  flag: string;
  direction: 'rtl' | 'ltr';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇪🇬', direction: 'rtl' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English (UK)', flag: '🇬🇧', direction: 'ltr' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English (US)', flag: '🇺🇸', direction: 'ltr' },
];

export const translations = {
  ar: {
    // Navigation
    navDashboard: 'الرئيسية',
    navStudents: 'الطلاب',
    navGroups: 'المجموعات',
    navSessions: 'الحصص',
    navReports: 'التقارير',
    navSettings: 'الإعدادات',

    // App Branding & General
    appName: 'إدارة المعلم الذكية',
    appSubtitle: 'النظام المحاسبي والتعليمي الشامل لإدارة المجموعات والدروس الخاصة',
    currency: 'ج.م',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    edit: 'تعديل',
    close: 'إغلاق',
    search: 'بحث',
    filter: 'تصفية',
    all: 'الكل',
    active: 'نشط',
    paused: 'موقوف مؤقتاً',
    stopped: 'ملغي القيد',
    completed: 'مكتملة',
    scheduled: 'مجدولة',
    cancelled: 'ملغاة',
    loading: 'جاري التحميل...',
    confirm: 'تأكيد',
    success: 'نجاح',
    error: 'خطأ',
    warning: 'تنبيه',

    // Dashboard
    dashWelcome: 'مرحباً بك،',
    dashOverview: 'نظرة عامة على نشاطك التعليمي والمحاسبي',
    dashTotalStudents: 'إجمالي الطلاب',
    dashTotalGroups: 'المجموعات النشطة',
    dashTotalSessions: 'الحصص المنفذة',
    dashTotalRevenue: 'إجمالي المحصل',
    dashTotalDue: 'إجمالي المستحق',
    dashTotalRemaining: 'المتبقي (مديونيات)',
    dashUpcomingSessions: 'الحصص القادمة اليوم',
    dashNoUpcomingSessions: 'لا توجد حصص مجدولة لهذا اليوم',
    dashQuickActions: 'إجراءات سريعة',
    dashNewStudent: 'طالب جديد',
    dashNewGroup: 'مجموعة جديدة',
    dashNewSession: 'حصة جديدة',
    dashRecordPayment: 'تسجيل دفعة',
    dashRecordPrivate: 'تسجيل حصة خاصة',
    dashQuickAttendance: 'تسجيل الحضور',

    // Students
    studentsTitle: 'سجل الطلاب',
    studentsSubtitle: 'إدارة بيانات الطلاب، الاشتراكات، والمواقف المالية',
    addStudent: 'إضافة طالب',
    editStudent: 'تعديل بيانات الطالب',
    studentName: 'اسم الطالب',
    parentName: 'ولي الأمر',
    phone: 'رقم الهاتف',
    parentPhone: 'هاتف ولي الأمر',
    gradeLevel: 'المرحلة الدراسية',
    school: 'المدرسة',
    notes: 'ملاحظات',
    studentProfile: 'الملف الشخصي للطالب',
    noStudentsFound: 'لم يتم العثور على طلاب',
    onlyDebtors: 'عليهم مديونية فقط',
    settled: 'خالص الحساب',
    hasDue: 'مديونية',
    hasCredit: 'رصيد',

    // Groups & Private Lessons
    groupsTitle: 'المجموعات والدروس الخاصة',
    groupsSubtitle: 'تنظيم المجموعات الدراسية، الدروس الخصوصية، والجداول',
    addGroup: 'إضافة مجموعة',
    editGroup: 'تعديل المجموعة',
    groupName: 'اسم المجموعة',
    subject: 'المادة الدراسية',
    groupType: 'نوع الخدمة',
    groupTypeGroup: 'مجموعة دراسية (سنتر / مدرسة)',
    groupTypePrivate: 'درس خاص (Private)',
    billingType: 'نظام المحاسبة',
    billingMode: 'نمط الفوترة',
    billingMonthly: 'شهري ثابت (Monthly Tuition)',
    billingPerSession: 'بالحصة (Per Session)',
    billingPrepaid: 'دفع مسبق بالحصص (Prepaid Credit)',
    billingPostpaid: 'دفع آجل بعد الحصة (Postpaid Due)',
    billingPackage: 'باقة حصص مسبقة (Package Deal)',
    defaultPrice: 'السعر الافتراضي',
    sessionPrice: 'سعر الحصة',
    packagePrice: 'سعر الباقة',
    packageSessionsCount: 'عدد حصص الباقة',
    baseSessionsPerMonth: 'عدد الحصص الأساسية شهرياً',
    extraSessionPrice: 'سعر الحصة الإضافية',
    scheduleDays: 'أيام الحصص',
    scheduleTime: 'وقت الحصة',
    location: 'المكان / القاعة',
    enrolledStudentsCount: 'الطلاب المسجلين',

    // Sessions & Attendance
    sessionsTitle: 'سجل الحصص والمواعيد',
    sessionsSubtitle: 'متابعة مواعيد الحصص، رصد الحضور، واستهلاك الأرصدة',
    addSession: 'إضافة حصة',
    sessionDate: 'تاريخ الحصة',
    startTime: 'وقت البدء',
    attendanceTitle: 'رصد الحضور والغياب',
    markAllPresent: 'تحديد الكل حاضر',
    present: 'حاضر',
    late: 'متأخر',
    absentCharged: 'غياب (محسوب)',
    absentFree: 'غياب (معذور / غير محسوب)',
    absenceReason: 'سبب الغياب',
    homeworkDone: 'تم أداء الواجب',
    sessionCredit: 'رصيد الحصص',
    sessionCreditRemaining: 'رصيد الحصص المتبقي',
    unpaidSessions: 'حصص مستحقة غير مدفوعة',
    consumedCredit: 'تم استهلاك حصة من الرصيد المسبق',

    // Payments & Billing
    paymentsTitle: 'سجل المدفوعات والتحصيلات',
    addPayment: 'تسجيل دفعة نقدية',
    amount: 'المبلغ المدفوع',
    paymentMethod: 'طريقة الدفع',
    paymentCash: 'نقداً (كاش)',
    paymentBank: 'تحويل بنكي / فودافون كاش',
    paymentCard: 'بطاقة دفع إلكتروني',
    paymentDate: 'تاريخ السداد',
    paymentType: 'نوع السداد',
    paymentTypeMonth: 'اشتراك شهر محدد',
    paymentTypeSessions: 'شراء رصيد حصص',
    paymentTypeCustom: 'مبلغ مالي حر',
    sessionsPurchasedCount: 'عدد الحصص المشتراة',
    receiptNumber: 'رقم الإيصال / المرجع',
    financialCredit: 'الرصيد المالي',
    currentDue: 'المستحق حالياً',
    totalPaid: 'إجمالي المدفوع',
    totalDue: 'إجمالي الرسوم / المستحق',

    // Reports
    reportsTitle: 'التقارير والإحصائيات المالية',
    reportsSubtitle: 'تحليل الإيرادات، التحصيلات، والمواقف المالية الشاملة',
    financialSummary: 'الملخص المالي العام',
    monthlyRevenues: 'الإيرادات الشهرية',
    attendanceRates: 'معدلات الحضور',

    // Settings & Language
    settingsTitle: 'الإعدادات والنسخ الاحتياطي',
    settingsSubtitle: 'إعدادات الحساب، لغة التطبيق، والمزامنة السحابية',
    languageSection: 'لغة التطبيق (Language)',
    languageDesc: 'اختر لغة واجهة النظام (العربية، الإنجليزية البريطانية، أو الإنجليزية الأمريكية)',
    teacherProfile: 'بيانات ملف المعلم',
    teacherName: 'اسم المعلم / الأستاذ',
    centerOrSchool: 'السنتر / المؤسسة التعليمية',
    autoSyncTitle: 'المزامنة التلقائية والنسخ الاحتياطي',
    syncNow: 'مزامنة الآن',
    exportBackup: 'تصدير نسخة احتياطية (.json)',
    restoreData: 'استعادة البيانات السحابية',
    syncActive: 'المزامنة نشطة ومجدولة',
    syncOffline: 'مؤجلة (دون اتصال)',
    syncServerUnavailable: 'مؤجلة (السيرفر غير متاح)',
    syncOff: 'المزامنة متوقفة',
    online: 'متصل بالإنترنت',
    onlineWifi: 'متصل بالإنترنت (Wi-Fi)',
    onlineCellular: 'متصل بالإنترنت (بيانات الجوال)',
    offline: 'وضع عدم الاتصال (أوفلاين)',
    serverUnavailable: 'متصل بالشبكة (السيرفر غير متاح)',
    logout: 'تسجيل الخروج',
    changePassword: 'تغيير كلمة المرور',
  },

  'en-GB': {
    // Navigation
    navDashboard: 'Dashboard',
    navStudents: 'Students',
    navGroups: 'Groups & Classes',
    navSessions: 'Timetable',
    navReports: 'Reports',
    navSettings: 'Settings',

    // App Branding & General
    appName: 'Smart Teacher Manager',
    appSubtitle: 'Comprehensive accounting and management suite for tuition centres and private tutors',
    currency: 'EGP',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    search: 'Search',
    filter: 'Filter',
    all: 'All',
    active: 'Active',
    paused: 'Paused',
    stopped: 'Withdrawn',
    completed: 'Completed',
    scheduled: 'Scheduled',
    cancelled: 'Cancelled',
    loading: 'Loading...',
    confirm: 'Confirm',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',

    // Dashboard
    dashWelcome: 'Welcome back,',
    dashOverview: 'Overview of your teaching timetable and accounts',
    dashTotalStudents: 'Total Students',
    dashTotalGroups: 'Active Groups',
    dashTotalSessions: 'Lessons Conducted',
    dashTotalRevenue: 'Total Received',
    dashTotalDue: 'Total Invoiced',
    dashTotalRemaining: 'Outstanding Balance',
    dashUpcomingSessions: "Today's Lessons",
    dashNoUpcomingSessions: 'No lessons scheduled for today',
    dashQuickActions: 'Quick Actions',
    dashNewStudent: 'New Student',
    dashNewGroup: 'New Group',
    dashNewSession: 'New Lesson',
    dashRecordPayment: 'Record Payment',
    dashRecordPrivate: 'Record Private Lesson',
    dashQuickAttendance: 'Mark Register',

    // Students
    studentsTitle: 'Student Directory',
    studentsSubtitle: 'Manage student enrolments, contact details, and account balances',
    addStudent: 'Add Student',
    editStudent: 'Edit Student Details',
    studentName: 'Student Name',
    parentName: 'Parent / Guardian',
    phone: 'Mobile Number',
    parentPhone: "Guardian's Mobile",
    gradeLevel: 'Year / Form Level',
    school: 'School / College',
    notes: 'Notes & Remarks',
    studentProfile: 'Student Profile',
    noStudentsFound: 'No students found',
    onlyDebtors: 'With Arrears Only',
    settled: 'Fully Settled',
    hasDue: 'Arrears Due',
    hasCredit: 'Credit Balance',

    // Groups & Private Lessons
    groupsTitle: 'Groups & Private Tuition',
    groupsSubtitle: 'Organise teaching groups, private tutorials, and timetables',
    addGroup: 'Add Group',
    editGroup: 'Edit Group',
    groupName: 'Group / Class Name',
    subject: 'Academic Subject',
    groupType: 'Service Type',
    groupTypeGroup: 'Tuition Group (Centre / School)',
    groupTypePrivate: 'Private Tutorial (1-to-1)',
    billingType: 'Billing Scheme',
    billingMode: 'Invoicing Mode',
    billingMonthly: 'Fixed Monthly Fee',
    billingPerSession: 'Per Lesson Rate',
    billingPrepaid: 'Prepaid Lesson Credits',
    billingPostpaid: 'Postpaid (Pay in Arrears)',
    billingPackage: 'Prepaid Term Package',
    defaultPrice: 'Standard Fee',
    sessionPrice: 'Price per Lesson',
    packagePrice: 'Package Price',
    packageSessionsCount: 'Number of Lessons in Package',
    baseSessionsPerMonth: 'Standard Lessons per Month',
    extraSessionPrice: 'Extra Lesson Rate',
    scheduleDays: 'Timetable Days',
    scheduleTime: 'Lesson Time',
    location: 'Venue / Room',
    enrolledStudentsCount: 'Enrolled Students',

    // Sessions & Attendance
    sessionsTitle: 'Timetable & Lessons Log',
    sessionsSubtitle: 'Track scheduled tutorials, take attendance, and deduct lesson credits',
    addSession: 'Schedule Lesson',
    sessionDate: 'Lesson Date',
    startTime: 'Start Time',
    attendanceTitle: 'Attendance Register & Credit Consumption',
    markAllPresent: 'Mark All Present',
    present: 'Present',
    late: 'Late',
    absentCharged: 'Absent (Chargeable)',
    absentFree: 'Absent (Excused / No Charge)',
    absenceReason: 'Absence Reason',
    homeworkDone: 'Prep / Homework Done',
    sessionCredit: 'Lesson Credits',
    sessionCreditRemaining: 'Remaining Lesson Credits',
    unpaidSessions: 'Unpaid Lessons (In Arrears)',
    consumedCredit: 'Consumed 1 Prepaid Lesson Credit',

    // Payments & Billing
    paymentsTitle: 'Payment & Receipts Ledger',
    addPayment: 'Record Payment',
    amount: 'Amount Paid',
    paymentMethod: 'Payment Method',
    paymentCash: 'Cash',
    paymentBank: 'Bank Transfer / Mobile Wallet',
    paymentCard: 'Card Payment',
    paymentDate: 'Payment Date',
    paymentType: 'Payment Allocation',
    paymentTypeMonth: 'Specific Month Fee',
    paymentTypeSessions: 'Purchase Lesson Credits',
    paymentTypeCustom: 'Custom Amount',
    sessionsPurchasedCount: 'Number of Lessons Purchased',
    receiptNumber: 'Receipt / Reference No.',
    financialCredit: 'Monetary Credit',
    currentDue: 'Current Due',
    totalPaid: 'Total Paid',
    totalDue: 'Total Amount Due',

    // Reports
    reportsTitle: 'Financial Statements & Analytics',
    reportsSubtitle: 'Analyse revenues, collections, and financial positions',
    financialSummary: 'Overall Financial Summary',
    monthlyRevenues: 'Monthly Revenue Breakdown',
    attendanceRates: 'Attendance Statistics',

    // Settings & Language
    settingsTitle: 'Settings & Cloud Backup',
    settingsSubtitle: 'Teacher profile, language preferences, and cloud synchronisation',
    languageSection: 'Application Language',
    languageDesc: 'Select your preferred interface language (Arabic, British English, or American English)',
    teacherProfile: 'Teacher Profile',
    teacherName: 'Teacher Name / Title',
    centerOrSchool: 'Tuition Centre / Institution',
    autoSyncTitle: 'Cloud Synchronisation & Backup',
    syncNow: 'Sync Now',
    exportBackup: 'Export Backup File (.json)',
    restoreData: 'Restore Cloud Data',
    syncActive: 'Active & Scheduled',
    syncOffline: 'Deferred (Offline)',
    syncServerUnavailable: 'Deferred (Server Unreachable)',
    syncOff: 'Sync Turned Off',
    online: 'Online',
    onlineWifi: 'Connected via Wi-Fi',
    onlineCellular: 'Connected via Mobile Data',
    offline: 'Offline Mode',
    serverUnavailable: 'Connected to Network (Server Unreachable)',
    logout: 'Log Out',
    changePassword: 'Change Password',
  },

  'en-US': {
    // Navigation
    navDashboard: 'Dashboard',
    navStudents: 'Students',
    navGroups: 'Groups & Classes',
    navSessions: 'Schedule',
    navReports: 'Reports',
    navSettings: 'Settings',

    // App Branding & General
    appName: 'Smart Teacher Manager',
    appSubtitle: 'Comprehensive accounting and management suite for tutoring centers and private tutors',
    currency: 'EGP',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    search: 'Search',
    filter: 'Filter',
    all: 'All',
    active: 'Active',
    paused: 'Paused',
    stopped: 'Dropped',
    completed: 'Completed',
    scheduled: 'Scheduled',
    cancelled: 'Canceled',
    loading: 'Loading...',
    confirm: 'Confirm',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',

    // Dashboard
    dashWelcome: 'Welcome back,',
    dashOverview: 'Overview of your teaching schedule and accounts',
    dashTotalStudents: 'Total Students',
    dashTotalGroups: 'Active Groups',
    dashTotalSessions: 'Sessions Conducted',
    dashTotalRevenue: 'Total Collected',
    dashTotalDue: 'Total Billed',
    dashTotalRemaining: 'Amount Due',
    dashUpcomingSessions: "Today's Sessions",
    dashNoUpcomingSessions: 'No sessions scheduled for today',
    dashQuickActions: 'Quick Actions',
    dashNewStudent: 'New Student',
    dashNewGroup: 'New Group',
    dashNewSession: 'New Session',
    dashRecordPayment: 'Record Payment',
    dashRecordPrivate: 'Record Private Session',
    dashQuickAttendance: 'Take Attendance',

    // Students
    studentsTitle: 'Student Roster',
    studentsSubtitle: 'Manage student enrollments, contact information, and billing balances',
    addStudent: 'Add Student',
    editStudent: 'Edit Student Details',
    studentName: 'Student Name',
    parentName: 'Parent / Guardian',
    phone: 'Cell Phone',
    parentPhone: "Parent's Cell Phone",
    gradeLevel: 'Grade Level',
    school: 'School',
    notes: 'Notes',
    studentProfile: 'Student Profile',
    noStudentsFound: 'No students found',
    onlyDebtors: 'With Balance Due Only',
    settled: 'Paid in Full',
    hasDue: 'Balance Due',
    hasCredit: 'Account Credit',

    // Groups & Private Lessons
    groupsTitle: 'Groups & Private Tutoring',
    groupsSubtitle: 'Organize tutoring groups, private lessons, and schedules',
    addGroup: 'Add Group',
    editGroup: 'Edit Group',
    groupName: 'Group / Class Name',
    subject: 'Subject',
    groupType: 'Service Type',
    groupTypeGroup: 'Tutoring Group (Center / School)',
    groupTypePrivate: 'Private Tutoring (1-on-1)',
    billingType: 'Billing Type',
    billingMode: 'Billing Mode',
    billingMonthly: 'Monthly Tuition',
    billingPerSession: 'Per Session Rate',
    billingPrepaid: 'Prepaid Session Credits',
    billingPostpaid: 'Postpaid (Pay Afterwards)',
    billingPackage: 'Prepaid Package Deal',
    defaultPrice: 'Default Rate',
    sessionPrice: 'Price per Session',
    packagePrice: 'Package Price',
    packageSessionsCount: 'Sessions in Package',
    baseSessionsPerMonth: 'Base Sessions per Month',
    extraSessionPrice: 'Extra Session Rate',
    scheduleDays: 'Schedule Days',
    scheduleTime: 'Session Time',
    location: 'Location / Room',
    enrolledStudentsCount: 'Enrolled Students',

    // Sessions & Attendance
    sessionsTitle: 'Schedule & Session Log',
    sessionsSubtitle: 'Track scheduled sessions, take attendance, and deduct session credits',
    addSession: 'Schedule Session',
    sessionDate: 'Session Date',
    startTime: 'Start Time',
    attendanceTitle: 'Attendance & Credit Deduction',
    markAllPresent: 'Mark All Present',
    present: 'Present',
    late: 'Late',
    absentCharged: 'Absent (Charged)',
    absentFree: 'Absent (Excused / Free)',
    absenceReason: 'Absence Reason',
    homeworkDone: 'Homework Completed',
    sessionCredit: 'Session Credits',
    sessionCreditRemaining: 'Remaining Session Credits',
    unpaidSessions: 'Unpaid Sessions (Due)',
    consumedCredit: 'Used 1 Prepaid Session Credit',

    // Payments & Billing
    paymentsTitle: 'Payments & Receipts',
    addPayment: 'Record Payment',
    amount: 'Payment Amount',
    paymentMethod: 'Payment Method',
    paymentCash: 'Cash',
    paymentBank: 'Bank Wire / Mobile Payment',
    paymentCard: 'Credit / Debit Card',
    paymentDate: 'Payment Date',
    paymentType: 'Payment Type',
    paymentTypeMonth: 'Specific Month Tuition',
    paymentTypeSessions: 'Buy Session Credits',
    paymentTypeCustom: 'Custom Amount',
    sessionsPurchasedCount: 'Sessions Purchased',
    receiptNumber: 'Receipt / Ref Number',
    financialCredit: 'Monetary Credit',
    currentDue: 'Current Due',
    totalPaid: 'Total Paid',
    totalDue: 'Total Amount Due',

    // Reports
    reportsTitle: 'Financial Reports & Analytics',
    reportsSubtitle: 'Analyze revenues, collections, and overall balances',
    financialSummary: 'Overall Financial Summary',
    monthlyRevenues: 'Monthly Revenue Breakdown',
    attendanceRates: 'Attendance Rates',

    // Settings & Language
    settingsTitle: 'Settings & Cloud Backup',
    settingsSubtitle: 'Teacher profile, language preferences, and cloud sync',
    languageSection: 'App Language',
    languageDesc: 'Choose your preferred language (Arabic, British English, or American English)',
    teacherProfile: 'Teacher Profile',
    teacherName: 'Teacher Name / Title',
    centerOrSchool: 'Tutoring Center / Institution',
    autoSyncTitle: 'Cloud Sync & Backup',
    syncNow: 'Sync Now',
    exportBackup: 'Export Backup (.json)',
    restoreData: 'Restore Cloud Data',
    syncActive: 'Active & Scheduled',
    syncOffline: 'Deferred (Offline)',
    syncServerUnavailable: 'Deferred (Server Unreachable)',
    syncOff: 'Sync Turned Off',
    online: 'Online',
    onlineWifi: 'Connected via Wi-Fi',
    onlineCellular: 'Connected via Cellular Data',
    offline: 'Offline Mode',
    serverUnavailable: 'Connected to Network (Server Unreachable)',
    logout: 'Log Out',
    changePassword: 'Change Password',
  },
} as const;

export type TranslationKey = keyof typeof translations['ar'];

let currentLanguage: AppLanguage = 'ar';
const listeners: Array<(lang: AppLanguage) => void> = [];

export function getAppLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'ar';
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LANG) as AppLanguage;
    if (saved && (saved === 'ar' || saved === 'en-GB' || saved === 'en-US')) {
      return saved;
    }
  } catch {}
  return 'ar';
}

export function setAppLanguage(lang: AppLanguage): void {
  currentLanguage = lang;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_LANG, lang);
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    } catch {}
  }
  listeners.forEach((fn) => fn(lang));
}

export function t(key: TranslationKey, lang?: AppLanguage): string {
  const activeLang = lang || currentLanguage || getAppLanguage();
  const dict = translations[activeLang] || translations.ar;
  return (dict as any)[key] || translations.ar[key] || key;
}

export function useTranslation() {
  const [lang, setLang] = useState<AppLanguage>(() => getAppLanguage());

  useEffect(() => {
    currentLanguage = getAppLanguage();
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentLanguage === 'ar' ? 'rtl' : 'ltr';

    const handler = (newLang: AppLanguage) => {
      setLang(newLang);
    };
    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  return {
    t: (key: TranslationKey) => t(key, lang),
    language: lang,
    setLanguage: setAppLanguage,
    isRTL: lang === 'ar',
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}
