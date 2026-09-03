// ==========================================
// Teacher Manager Domain Entities (TypeScript)
// Designed for Scalable Entity-Relationship Architecture
// ==========================================

export type StudentStatus = 'active' | 'archived' | 'inactive';
export type GroupType = 'group' | 'private';
export type BillingType = 'monthly' | 'per_session' | 'package' | 'prepaid' | 'postpaid';
export type BillingMode = 'monthly' | 'prepaid' | 'postpaid' | 'package';
export type EnrollmentStatus = 'active' | 'paused' | 'stopped';
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent_charged' | 'absent_free' | 'late' | 'excused' | 'absent';
export type PaymentMethod = 'cash' | 'vodafone_cash' | 'instapay' | 'bank_transfer' | 'other';
export type MonthBillStatus = 'unpaid' | 'partially_paid' | 'fully_paid';
export type BillStatus = 'paid' | 'partial' | 'unpaid';

// Pricing modifier type when enrolling a student
export type PricingModifierType =
  | 'same_as_group' // نفس سعر المجموعة
  | 'fixed_discount' // خصم مبلغ ثابت
  | 'percentage_discount' // خصم نسبة مئوية
  | 'fixed_increase' // زيادة مبلغ ثابت
  | 'percentage_increase' // زيادة نسبة مئوية
  | 'custom_price'; // سعر مخصص بالكامل

// 4 Payment Types requested
export type PaymentTargetType =
  | 'specific_month' // 1. سداد شهر معين
  | 'single_session' // 2. سداد حصة واحدة
  | 'session_count' // 3. سداد عدد معين من الحصص
  | 'custom_amount'; // 4. سداد مبلغ مالي حر

// Time period filter for reports
export type ReportPeriodFilter = 'today' | 'this_week' | 'this_month' | 'specific_month' | 'custom_range' | 'all_time';

// 1. Student Entity (طالب واحد فقط دون استنساخ)
export interface Student {
  id: string;
  userId?: string; // معرف حساب المعلم المالك
  name: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  parentRelation?: 'الأب' | 'الأم' | 'ولي الأمر';
  gradeLevel?: string; // مثلاً: الصف الأول الثانوي، الصف الثالث الإعدادي...
  school?: string;
  notes?: string;
  status: StudentStatus;
  avatarColor: string;
  createdAt: string;
}

// 2. Group Entity (مجموعة دراسية أو درس خاص)
export interface Group {
  id: string;
  userId?: string; // معرف حساب المعلم المالك
  name: string; // اسم المجموعة
  subject: string; // المادة
  gradeLevel: string; // الصف الدراسي
  type: GroupType; // 'group' (مجموعة) | 'private' (درس خاص)
  billingType: BillingType; // 'monthly' | 'per_session' | 'package' | 'prepaid' | 'postpaid'
  billingMode?: BillingMode; // 'monthly' | 'prepaid' | 'postpaid' | 'package'
  defaultPrice: number; // السعر الافتراضي للحصة أو الاشتراك الشهري أو الباقة
  baseSessionsPerMonth?: number; // عدد الحصص الأساسي شهرياً (افتراضي 8)
  packageSessionsCount?: number; // عدد حصص الباقة (افتراضي 8)
  scheduleDays: string[]; // ['السبت', 'الثلاثاء']
  scheduleTime?: string; // e.g. "04:30 م"
  roomOrLocation?: string; // e.g. "قاعة 1", "سنتر النور", "أونلاين"
  accentColor: string; // اللون المميز للمجموعة
  notes?: string;
  createdAt: string;
}

// 3. Enrollment Entity (علاقة اشتراك الطالب في المجموعة - تسعير ونظام محاسبة مستقل لكل اشتراك)
export interface Enrollment {
  id: string;
  userId?: string; // معرف حساب المعلم المالك
  studentId: string;
  groupId: string;
  serviceType: GroupType; // 'group' | 'private'
  billingType: BillingType; // 'monthly' | 'per_session' | 'package' | 'prepaid' | 'postpaid'
  billingMode?: BillingMode; // 'monthly' | 'prepaid' | 'postpaid' | 'package'
  pricingType?: PricingModifierType; // نوع تعديل السعر
  pricingValue?: number; // قيمة التعديل (مبلغ أو نسبة)
  customPrice: number; // السعر النهائي المحسوب والمحفوظ بشكل دائم لهذا الاشتراك
  baseSessionsPerMonth?: number; // عدد الحصص الأساسي شهرياً (افتراضي 8)
  extraSessionPrice?: number; // سعر الحصة الإضافية
  packageSessionsCount?: number; // عدد حصص الباقة
  packagePrice?: number; // إجمالي سعر الباقة
  sessionCredit: number; // رصيد الحصص المتبقي لهذا الاشتراك
  financialCredit: number; // الرصيد المالي المتبقي (Financial Credit) e.g. 50 ج
  discount: number; // قيمة الخصم إن وجد
  status: EnrollmentStatus;
  joinedAt: string;
  notes?: string;
}

// 4. Private Lesson Service (خدمة الدروس الخصوصية)
export interface PrivateLessonService {
  id: string;
  userId?: string; // معرف حساب المعلم المالك
  studentId: string;
  subject: string;
  hourlyRate: number;
  location?: string;
  notes?: string;
}

// 5. Session Entity (حصة دراسية مرتبطة بالتاريخ والشهر والسنة، وتدعم أكثر من حصة في نفس اليوم)
export interface Session {
  id: string;
  userId?: string; // معرف حساب المعلم المالك
  groupId: string;
  enrollmentId?: string;
  studentId?: string;
  packageId?: string;
  title: string; // عنوان أو موضوع الحصة
  date: string; // YYYY-MM-DD
  dayName: string; // e.g. "السبت"
  month: number; // 1 - 12
  year: number; // e.g. 2026
  startTime: string; // e.g. "16:00"
  endTime?: string; // e.g. "17:30"
  sessionNumber?: number; // رقم الحصة التسلسلي
  pricePerStudent?: number; // سعر الحصة الفعلي
  sessionCount?: number; // عدد الحصص المسجلة
  effectiveSessionPrice?: number; // سعر الحصة الفعلي (Effective Session Price = Package Total Price ÷ Package Session Count)
  totalSessionValue?: number; // إجمالي قيمة الحصص المسجلة (Session Count × Effective Session Price)
  packageTotalPrice?: number; // إجمالي سعر الباقة وقت التسجيل
  packageSessionsCount?: number; // عدد حصص الباقة وقت التسجيل
  status: SessionStatus;
  notes?: string;
  createdAt: string;
}

// 6. Attendance Entity (سجل الحضور والغياب)
export interface Attendance {
  id: string;
  userId?: string; // معرف حساب المعلم المالك
  sessionId: string;
  studentId: string;
  enrollmentId?: string;
  status: AttendanceStatus; // حاضر | غائب - محسوبة | غائب - غير محسوبة | متأخر | معتذر
  isCharged?: boolean; // هل الحصة محسوبة ماليًا على الطالب؟
  absenceReason?: string; // سبب عدم احتساب الغياب (الطالب ألغى | المدرس ألغى | مرض | ظرف طارئ | سبب آخر | مخصص)
  notes?: string;
  homeworkDone?: boolean; // حل الواجب
  quizScore?: number; // درجة الكويز إن وجد
  recordedAt: string;
}

// 7. Payment Entity (سجل المدفوعات والتحصيلات)
export interface Payment {
  id: string;
  userId?: string; // معرف حساب المعلم المالك
  studentId: string;
  enrollmentId?: string;
  groupId?: string;
  amount: number;
  paymentType: PaymentTargetType; // 'specific_month' | 'single_session' | 'session_count' | 'custom_amount'
  targetMonth?: number; // Month 1-12
  targetYear?: number; // e.g. 2026
  sessionsPurchased?: number; // عدد الحصص المشتراة
  sessionsCovered?: number; // عدد الحصص التي غطاها المبلغ
  financialCreditAdded?: number; // رصيد مالي مضاف جديد
  financialCreditConverted?: number; // رصيد مالي تم تحويله لحصص
  autoSessionsConverted?: number; // حصص ناتجة عن تحويل الرصيد المالي
  paymentMethod: PaymentMethod;
  date: string; // YYYY-MM-DD
  month: number;
  year: number;
  notes?: string;
  referenceNumber?: string;
  createdAt: string;
}

// 7.1 Session Credit Log Entity (سجل حركة رصيد الحصص الدفع المسبق)
export interface SessionCreditLog {
  id: string;
  userId?: string; // معرف حساب المعلم المالك
  enrollmentId: string;
  studentId: string;
  groupId: string;
  type: 'purchase' | 'consumption' | 'refund' | 'adjustment';
  sessionsDelta: number; // e.g. +8, +1, -1
  balanceBefore: number;
  balanceAfter: number;
  reason: string; // سبب العملية: شراء حصص، حضور حصة، غياب محسوب، تعديل...
  date: string; // YYYY-MM-DD
  sessionId?: string;
  paymentId?: string;
  createdAt: string;
}

// 8. Monthly Billing Ledger Record
export interface MonthlyBillingLedgerItem {
  month: number;
  year: number;
  monthName: string;
  basePrice: number;
  baseSessions: number;
  attendedSessions: number;
  extraSessions: number;
  extraCharge: number;
  totalRequired: number;
  totalPaid: number;
  remaining: number;
  status: MonthBillStatus;
}

// 9. Enrollment Financial Summary
export interface EnrollmentFinancialSummary {
  enrollmentId: string;
  groupId: string;
  groupName: string;
  groupType: GroupType;
  accentColor: string;
  billingType: BillingType;
  billingMode?: BillingMode;
  customPrice: number;
  effectiveSessionPrice?: number;
  packagePrice?: number;
  packageSessionsCount?: number;
  baseSessionsPerMonth: number;
  totalDue: number;
  totalPaid: number;
  remaining: number;
  sessionCredit: number;
  sessionCreditValue: number;
  financialCredit: number;
  attendedSessionsCount: number;
  extraSessionsCount: number;
  purchasedSessionsCount: number;
  usedSessionsCount: number;
  settledSessionsCount?: number;
  freeSessionsCount: number;
  unpaidSessionsCount: number;
  creditLogs: SessionCreditLog[];
  monthlyLedger: MonthlyBillingLedgerItem[];
  payments: Payment[];
}

// 10. Student Grand Financial Summary
export interface StudentGrandFinancialSummary {
  studentId: string;
  studentName: string;
  enrollmentsSummary: EnrollmentFinancialSummary[];
  grandTotalDue: number;
  grandTotalPaid: number;
  grandRemaining: number;
  totalSessionCredit: number;
  totalUnpaidSessions: number;
  totalFinancialCredit: number;
  allPayments: Payment[];
}

// 11. Group Financial Summary
export interface GroupFinancialSummary {
  groupId: string;
  groupName: string;
  groupType: GroupType;
  accentColor: string;
  billingType: BillingType;
  defaultPrice: number;
  totalStudents: number;
  totalDue: number;
  totalPaid: number;
  remaining: number;
  totalCompletedSessions: number;
  totalAttendedSessions: number;
  totalPrepaidCredits: number;
  studentsSummary: {
    student: Student;
    enrollment: Enrollment;
    totalDue: number;
    totalPaid: number;
    remaining: number;
    sessionCredit: number;
    financialCredit: number;
    attendedCount: number;
  }[];
}

// 12. Teacher Overall Financial Summary
export interface TeacherOverallFinancialSummary {
  totalRevenue: number;
  totalDues: number;
  totalRemaining: number;
  totalActiveStudents: number;
  totalSessionsConducted: number;
  totalExtraSessions: number;
  monthlyRevenues: { monthYear: string; revenue: number; dues: number }[];
  paymentsList: Payment[];
}

// 13. Financial Credit (legacy compatibility)
export interface FinancialCredit {
  studentId: string;
  totalDue: number; // إجمالي المستحق
  totalPaid: number; // إجمالي المدفوع
  balance: number; // الرصيد الحالي (سالب = عليه مديونية، موجب = له رصيد مسبق)
}

// 14. Monthly Billing (legacy compatibility)
export interface MonthlyBilling {
  id: string;
  studentId: string;
  enrollmentId: string;
  month: number;
  year: number;
  requiredAmount: number;
  paidAmount: number;
  status: BillStatus;
  notes?: string;
}

// 15. Session Credit (legacy compatibility)
export interface SessionCredit {
  id: string;
  studentId: string;
  enrollmentId: string;
  prepaidSessionsRemaining: number;
  totalPrepaid: number;
  updatedAt: string;
}

// ملف المدرس
export interface TeacherProfile {
  name: string;
  subject: string;
  phone: string;
  centerOrSchool?: string;
  academicYear?: string;
  currency: string; // e.g. "ج.م"
}

// حزمة بيانات الحساب المتزامنة
export interface UserAccountDataPackage {
  lastSyncTime: string;
  version: string;
  userId: string;
  students: Student[];
  groups: Group[];
  enrollments: Enrollment[];
  sessions: Session[];
  attendance: Attendance[];
  payments: Payment[];
  creditLogs?: SessionCreditLog[];
  teacherProfile?: TeacherProfile;
  stats?: {
    totalStudents: number;
    totalGroups: number;
    totalSessions: number;
    totalPayments: number;
  };
}

// حساب المستخدم والمعلم لتسجيل الدخول
export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  centerOrSchool?: string;
  password?: string;
  authToken?: string;
  recoveryPin?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  createdAt: string;
  lastLoginAt?: string;
  lastSyncAt?: string;
  syncedData?: UserAccountDataPackage;
}

// التبويبات الرئيسية للتطبيق
export type ActiveTab = 'dashboard' | 'students' | 'groups' | 'sessions' | 'reports' | 'settings';

// خيارات فترات المزامنة التلقائية المجدولة
export type AutoSyncFrequency = 'off' | 'hourly' | 'daily' | 'weekly' | 'monthly';

// حالة عملية المزامنة الحالية
export type AutoSyncStatus = 'idle' | 'syncing' | 'success' | 'offline_deferred' | 'error';

// إعدادات وبيانات المزامنة التلقائية المجدولة
export interface AutoSyncConfig {
  frequency: AutoSyncFrequency;
  lastSyncTime: string | null;
  nextSyncTime: string | null;
  status: AutoSyncStatus;
  statusMessage?: string;
  autoRetryOnReconnect: boolean;
}
