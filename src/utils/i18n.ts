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
    dashTotalGroups: 'المجموعات والدروس',
    dashTotalSessions: 'الحصص المنفذة',
    dashTotalRevenue: 'إجمالي المحصل',
    dashTotalDue: 'إجمالي المستحق المطلوب',
    dashTotalRemaining: 'المتبقي (المتأخرات)',
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

    // Student Photos & Achievement Frames
    profilePhoto: 'صورة الطالب',
    uploadPhoto: 'رفع صورة',
    changePhoto: 'تغيير الصورة',
    removePhoto: 'حذف الصورة',
    photoCompressedHint: 'يتم ضغط الصورة تلقائياً لتكون خفيفة وسريعة المزامنة',
    achievementFrame: 'إطار التميز والإنجاز',
    achievementFrameDesc: 'اختر إطاراً مميزاً يظهر حول صورة الطالب تكريماً لتفوقه',
    frameNone: 'بدون إطار',
    frameGold: 'إطار ذهبي (متفوق)',
    frameSilver: 'إطار فضي (ملتزم)',
    framePlatinum: 'إطار بلاتيني (نخبة)',
    frameCrown: 'تاج التميز الملكي',
    frameStar: 'نجمة الإبداع',
    frameChampion: 'بطل الدفعة',

    // Educational Stages
    stageFilter: 'تصفية بالمرحلة',
    allStages: 'جميع المراحل الدراسية',
    stagePrimary: 'المرحلة الابتدائية',
    stagePreparatory: 'المرحلة الإعدادية',
    stageSecondary: 'المرحلة الثانوية',
    stagePrimary1: 'الصف الأول الابتدائي',
    stagePrimary2: 'الصف الثاني الابتدائي',
    stagePrimary3: 'الصف الثالث الابتدائي',
    stagePrimary4: 'الصف الرابع الابتدائي',
    stagePrimary5: 'الصف الخامس الابتدائي',
    stagePrimary6: 'الصف السادس الابتدائي',
    stagePrep1: 'الصف الأول الإعدادي',
    stagePrep2: 'الصف الثاني الإعدادي',
    stagePrep3: 'الصف الثالث الإعدادي',
    stageSec1: 'الصف الأول الثانوي',
    stageSec2: 'الصف الثاني الثانوي',
    stageSec3: 'الصف الثالث الثانوي',
    stageOther: 'أخرى / عام',

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
    billingHourly: 'محاسبة بالساعة (Hourly Billing)',
    defaultPrice: 'السعر الافتراضي',
    sessionPrice: 'سعر الحصة',
    hourlyRate: 'سعر الساعة',
    packagePrice: 'سعر الباقة',
    packageSessionsCount: 'عدد حصص الباقة',
    baseSessionsPerMonth: 'عدد الحصص الأساسية شهرياً',
    extraSessionPrice: 'سعر الحصة الإضافية',
    scheduleDays: 'أيام الحصص',
    scheduleTime: 'وقت الحصة',
    location: 'المكان / القاعة',
    enrolledStudentsCount: 'الطلاب المسجلين',

    // Edit Billing Scheme
    editBilling: 'تعديل نظام المحاسبة',
    editBillingNotice: 'تنبيه: تغيير نظام المحاسبة يطبق على الحصص الجديدة فقط ولا يمس المعاملات السابقة',
    currentBillingScheme: 'نظام المحاسبة الحالي',
    newBillingScheme: 'النظام الجديد المختار',
    billingSettingsUpdated: 'تم تحديث نظام المحاسبة بنجاح',

    // Sessions & Attendance
    sessionsTitle: 'سجل الحصص والمواعيد',
    sessionsSubtitle: 'متابعة مواعيد الحصص، رصد الحضور، واستهلاك الأرصدة',
    addSession: 'إضافة حصة',
    sessionDate: 'تاريخ الحصة',
    startTime: 'وقت البدء',
    sessionHours: 'عدد ساعات الحصة',
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
    paymentBank: 'تحويل بنكي / فودافون كاش / إنستاباي',
    paymentCard: 'بطاقة دفع إلكتروني',
    paymentDate: 'تاريخ السداد',
    paymentType: 'نوع السداد',
    paymentTypeMonth: 'اشتراك شهر محدد',
    paymentTypeSessions: 'شراء رصيد حصص',
    paymentTypeCustom: 'مبلغ مالي حر',
    sessionsPurchasedCount: 'عدد الحصص المشتراة',
    receiptNumber: 'رقم الإيصال / المرجع',
    financialCredit: 'الرصيد المالي',
    currentDue: 'المستحق حالياً (المتبقي)',
    totalPaid: 'إجمالي المدفوع',
    totalDue: 'إجمالي المستحق المطلوب',
    totalCharged: 'إجمالي الرسوم المستحقة',

    // Reports
    reportsTitle: 'التقارير والكشوف المالية',
    reportsSubtitle: 'تحليل الإيرادات، التحصيلات، والمواقف المالية الشاملة',
    financialSummary: 'الملخص المالي العام',
    monthlyRevenues: 'سجل التحصيلات الشهرية',
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
    dashTotalDue: 'Total Invoiced / Due',
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

    // Student Photos & Achievement Frames
    profilePhoto: 'Student Photo',
    uploadPhoto: 'Upload Photo',
    changePhoto: 'Change Photo',
    removePhoto: 'Remove Photo',
    photoCompressedHint: 'Image is auto-compressed for lightning-fast sync',
    achievementFrame: 'Achievement & Merit Frame',
    achievementFrameDesc: 'Select an honorary visual frame for standout academic performance',
    frameNone: 'No Frame',
    frameGold: 'Gold Distinction',
    frameSilver: 'Silver Merit',
    framePlatinum: 'Platinum Elite',
    frameCrown: 'Royal Crown',
    frameStar: 'Star Performer',
    frameChampion: 'Class Champion',

    // Educational Stages
    stageFilter: 'Filter by Key Stage',
    allStages: 'All Key Stages',
    stagePrimary: 'Primary School (Years 1-6)',
    stagePreparatory: 'Preparatory / Middle (Years 7-9)',
    stageSecondary: 'Secondary / Sixth Form (Years 10-12)',
    stagePrimary1: 'Year 1 (Primary 1)',
    stagePrimary2: 'Year 2 (Primary 2)',
    stagePrimary3: 'Year 3 (Primary 3)',
    stagePrimary4: 'Year 4 (Primary 4)',
    stagePrimary5: 'Year 5 (Primary 5)',
    stagePrimary6: 'Year 6 (Primary 6)',
    stagePrep1: 'Year 7 (Prep 1)',
    stagePrep2: 'Year 8 (Prep 2)',
    stagePrep3: 'Year 9 (Prep 3)',
    stageSec1: 'Year 10 (Sec 1 / GCSE)',
    stageSec2: 'Year 11 (Sec 2 / GCSE)',
    stageSec3: 'Year 12 (Sec 3 / A-Level)',
    stageOther: 'Other / General',

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
    billingHourly: 'Hourly Billing Rate',
    defaultPrice: 'Standard Fee',
    sessionPrice: 'Price per Lesson',
    hourlyRate: 'Hourly Rate',
    packagePrice: 'Package Price',
    packageSessionsCount: 'Number of Lessons in Package',
    baseSessionsPerMonth: 'Standard Lessons per Month',
    extraSessionPrice: 'Extra Lesson Rate',
    scheduleDays: 'Timetable Days',
    scheduleTime: 'Lesson Time',
    location: 'Venue / Room',
    enrolledStudentsCount: 'Enrolled Students',

    // Edit Billing Scheme
    editBilling: 'Edit Billing Scheme',
    editBillingNotice: 'Notice: Modifying billing applies only to new tutorials; past records remain intact',
    currentBillingScheme: 'Current Billing Scheme',
    newBillingScheme: 'Selected New Scheme',
    billingSettingsUpdated: 'Billing configuration updated successfully',

    // Sessions & Attendance
    sessionsTitle: 'Timetable & Lessons Log',
    sessionsSubtitle: 'Track scheduled tutorials, take attendance, and deduct lesson credits',
    addSession: 'Schedule Lesson',
    sessionDate: 'Lesson Date',
    startTime: 'Start Time',
    sessionHours: 'Lesson Duration (Hours)',
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
    paymentBank: 'Bank Transfer / Mobile Wallet / InstaPay',
    paymentCard: 'Card Payment',
    paymentDate: 'Payment Date',
    paymentType: 'Payment Allocation',
    paymentTypeMonth: 'Specific Month Fee',
    paymentTypeSessions: 'Purchase Lesson Credits',
    paymentTypeCustom: 'Custom Amount',
    sessionsPurchasedCount: 'Number of Lessons Purchased',
    receiptNumber: 'Receipt / Reference No.',
    financialCredit: 'Monetary Credit',
    currentDue: 'Outstanding Due',
    totalPaid: 'Total Paid',
    totalDue: 'Total Invoiced / Due',
    totalCharged: 'Total Gross Charges',

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
    dashTotalDue: 'Total Billed / Due',
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

    // Student Photos & Achievement Frames
    profilePhoto: 'Student Photo',
    uploadPhoto: 'Upload Photo',
    changePhoto: 'Change Photo',
    removePhoto: 'Remove Photo',
    photoCompressedHint: 'Photo is automatically compressed for rapid sync',
    achievementFrame: 'Achievement Frame',
    achievementFrameDesc: 'Select an honorary frame for top academic achievement',
    frameNone: 'No Frame',
    frameGold: 'Gold Honor',
    frameSilver: 'Silver Merit',
    framePlatinum: 'Platinum Elite',
    frameCrown: 'Royal Crown',
    frameStar: 'Star Performer',
    frameChampion: 'Class Champion',

    // Educational Stages
    stageFilter: 'Filter by Grade Level',
    allStages: 'All Grade Levels',
    stagePrimary: 'Elementary School (Grades 1-6)',
    stagePreparatory: 'Middle School (Grades 7-9)',
    stageSecondary: 'High School (Grades 10-12)',
    stagePrimary1: '1st Grade (Elementary)',
    stagePrimary2: '2nd Grade (Elementary)',
    stagePrimary3: '3rd Grade (Elementary)',
    stagePrimary4: '4th Grade (Elementary)',
    stagePrimary5: '5th Grade (Elementary)',
    stagePrimary6: '6th Grade (Elementary)',
    stagePrep1: '7th Grade (Middle School)',
    stagePrep2: '8th Grade (Middle School)',
    stagePrep3: '9th Grade (Middle School)',
    stageSec1: '10th Grade (High School)',
    stageSec2: '11th Grade (High School)',
    stageSec3: '12th Grade (High School)',
    stageOther: 'Other / General',

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
    billingHourly: 'Hourly Rate Billing',
    defaultPrice: 'Standard Price',
    sessionPrice: 'Price per Session',
    hourlyRate: 'Hourly Rate',
    packagePrice: 'Package Price',
    packageSessionsCount: 'Number of Sessions in Package',
    baseSessionsPerMonth: 'Standard Sessions per Month',
    extraSessionPrice: 'Extra Session Rate',
    scheduleDays: 'Schedule Days',
    scheduleTime: 'Session Time',
    location: 'Location / Room',
    enrolledStudentsCount: 'Enrolled Students',

    // Edit Billing Scheme
    editBilling: 'Edit Billing Settings',
    editBillingNotice: 'Notice: Modifying billing applies only to future sessions; past records remain intact',
    currentBillingScheme: 'Current Billing Scheme',
    newBillingScheme: 'Selected New Scheme',
    billingSettingsUpdated: 'Billing settings updated successfully',

    // Sessions & Attendance
    sessionsTitle: 'Session Schedule & Log',
    sessionsSubtitle: 'Track scheduled sessions, take attendance, and manage session credits',
    addSession: 'Schedule Session',
    sessionDate: 'Session Date',
    startTime: 'Start Time',
    sessionHours: 'Session Duration (Hours)',
    attendanceTitle: 'Attendance Register & Credit Consumption',
    markAllPresent: 'Mark All Present',
    present: 'Present',
    late: 'Late',
    absentCharged: 'Absent (Billable)',
    absentFree: 'Absent (Excused / No Charge)',
    absenceReason: 'Absence Reason',
    homeworkDone: 'Homework Done',
    sessionCredit: 'Session Credits',
    sessionCreditRemaining: 'Remaining Session Credits',
    unpaidSessions: 'Unpaid Sessions (Due)',
    consumedCredit: 'Consumed 1 Prepaid Session Credit',

    // Payments & Billing
    paymentsTitle: 'Payment & Receipts Ledger',
    addPayment: 'Record Payment',
    amount: 'Amount Paid',
    paymentMethod: 'Payment Method',
    paymentCash: 'Cash',
    paymentBank: 'Bank Transfer / Mobile Wallet / InstaPay',
    paymentCard: 'Card Payment',
    paymentDate: 'Payment Date',
    paymentType: 'Payment Allocation',
    paymentTypeMonth: 'Specific Month Tuition',
    paymentTypeSessions: 'Purchase Session Credits',
    paymentTypeCustom: 'Custom Amount',
    sessionsPurchasedCount: 'Number of Sessions Purchased',
    receiptNumber: 'Receipt / Reference No.',
    financialCredit: 'Account Credit',
    currentDue: 'Outstanding Balance',
    totalPaid: 'Total Paid',
    totalDue: 'Total Amount Billed / Due',
    totalCharged: 'Total Gross Charges',

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
