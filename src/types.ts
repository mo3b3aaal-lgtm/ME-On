// ==========================================
// Classy Domain Entities (TypeScript)
// Designed for Scalable Entity-Relationship Architecture
// ==========================================

export type StudentStatus = 'active' | 'archived' | 'inactive';
export type GroupType = 'group' | 'private';
export type BillingType = 'monthly' | 'per_session' | 'package' | 'prepaid' | 'postpaid' | 'hourly';
export type BillingMode = 'monthly' | 'prepaid' | 'postpaid' | 'package' | 'hourly';
export type EnrollmentStatus = 'active' | 'paused' | 'stopped';
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent_charged' | 'absent_free' | 'late' | 'excused' | 'absent';
export type PaymentMethod = 'cash' | 'vodafone_cash' | 'instapay' | 'bank_transfer' | 'other';
export type MonthBillStatus = 'unpaid' | 'partially_paid' | 'fully_paid';
export type BillStatus = 'paid' | 'partial' | 'unpaid';

// Student Achievement Frame
export type AchievementFrame =
  | 'none'
  | 'gold'
  | 'silver'
  | 'platinum'
  | 'crown'
  | 'star'
  | 'champion'
  | 'default'
  | 'bronze_star'
  | 'silver_scholar'
  | 'gold_champion'
  | 'diamond_elite'
  | 'emerald_honor';

// Behavior Logging Category & Predefined Tags
export type BehaviorCategory = 'positive' | 'needs_improvement' | 'neutral';

export interface PredefinedBehaviorTag {
  id: string;
  name: string;
  nameEn?: string;
  category: BehaviorCategory;
  emoji: string;
  points?: number; // e.g. +10, -5, 0
  color: string;
  bgColor: string;
  borderColor: string;
}

export interface StudentBehaviorLog {
  id: string;
  userId?: string;
  studentId: string;
  studentName?: string;
  groupId?: string;
  groupName?: string;
  sessionId?: string;
  tag: string;
  tagEn?: string;
  category: BehaviorCategory;
  emoji?: string;
  points?: number;
  note?: string;
  timestamp: string; // ISO string with date & time
  createdAt: string;
  updatedAt?: string;
}

// Deletion Tombstone for synchronization across devices and Cloud
export interface DeletionTombstone {
  id: string;
  entityType: 'student' | 'group' | 'enrollment' | 'session' | 'attendance' | 'payment' | 'creditLog' | 'homeworkAssignment' | 'homeworkTest' | 'behaviorLog' | 'any';
  deletedAt: string;
  userId?: string;
}

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
export type ReportPeriodFilter = 'today' | 'last_7_days' | 'this_week' | 'this_month' | 'last_month' | 'specific_month' | 'custom_range' | 'all_time';

// 1. Student Entity (طالب واحد فقط دون استنساخ)
export interface Student {
  id: string;
  userId?: string; // معرف حساب المعلم المالك
  name: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  parentRelation?: 'الأب' | 'الأم' | 'ولي الأمر';
  gradeLevel?: string; // المرحلة الدراسية (ابتدائي 1-6، إعدادي 1-3، ثانوي 1-3)
  school?: string;
  notes?: string;
  status: StudentStatus;
  avatarColor: string;
  profilePhoto?: string; // Lightweight base64 image data URL (< 30KB)
  achievementFrame?: AchievementFrame; // إطار التميز (none, gold, silver, platinum, crown, star, champion)
  createdAt: string;
  updatedAt?: string;
}

// 2. Group Entity (مجموعة دراسية أو درس خاص)
export interface Group {
  id: string;
  userId?: string; // معرف حساب المعلم المالك
  name: string; // اسم المجموعة
  subject: string; // المادة
  gradeLevel: string; // الصف الدراسي
  type: GroupType; // 'group' (مجموعة) | 'private' (درس خاص)
  billingType: BillingType; // 'monthly' | 'per_session' | 'package' | 'prepaid' | 'postpaid' | 'hourly'
  billingMode?: BillingMode; // 'monthly' | 'prepaid' | 'postpaid' | 'package' | 'hourly'
  defaultPrice: number; // السعر الافتراضي للحصة أو الاشتراك الشهري أو الباقة
  hourlyRate?: number; // سعر الساعة عند اختيار نظام المحاسبة بالساعة
  baseSessionsPerMonth?: number; // عدد الحصص الأساسي شهرياً (افتراضي 8)
  packageSessionsCount?: number; // عدد حصص الباقة (افتراضي 8)
  scheduleDays: string[]; // ['السبت', 'الثلاثاء']
  scheduleTime?: string; // e.g. "04:30 م"
  scheduleTimes?: Record<string, string | string[]>; // Map of day to time or array of times, e.g. { 'السبت': ['16:00', '19:00'] }
  roomOrLocation?: string; // e.g. "قاعة 1", "سنتر النور", "أونلاين"
  accentColor: string; // اللون المميز للمجموعة
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// 3. Enrollment Entity (علاقة اشتراك الطالب في المجموعة - تسعير ونظام محاسبة مستقل لكل اشتراك)
export interface Enrollment {
  id: string;
  userId?: string; // معرف حساب المعلم المالك
  studentId: string;
  groupId: string;
  serviceType: GroupType; // 'group' | 'private'
  billingType: BillingType; // 'monthly' | 'per_session' | 'package' | 'prepaid' | 'postpaid' | 'hourly'
  billingMode?: BillingMode; // 'monthly' | 'prepaid' | 'postpaid' | 'package' | 'hourly'
  pricingType?: PricingModifierType; // نوع تعديل السعر
  pricingValue?: number; // قيمة التعديل (مبلغ أو نسبة)
  customPrice: number; // السعر النهائي المحسوب والمحفوظ بشكل دائم لهذا الاشتراك
  hourlyRate?: number; // سعر الساعة عند المحاسبة بالساعة
  baseSessionsPerMonth?: number; // عدد الحصص الأساسي شهرياً (افتراضي 8)
  extraSessionPrice?: number; // سعر الحصة الإضافية
  packageSessionsCount?: number; // عدد حصص الباقة
  packagePrice?: number; // إجمالي سعر الباقة
  scheduleDays?: string[]; // أيام الحصص الخاصة بهذا الاشتراك إن وجدت
  scheduleTime?: string; // وقت الحصة
  scheduleTimes?: Record<string, string | string[]>; // مواعيد الأيام المحددة
  sessionCredit: number; // رصيد الحصص المتبقي لهذا الاشتراك
  financialCredit: number; // الرصيد المالي المتبقي (Financial Credit) e.g. 50 ج
  discount: number; // قيمة الخصم إن وجد
  status: EnrollmentStatus;
  joinedAt: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// 4. Private Lesson Entity / Service (خدمة الدروس الخصوصية المستقلة)
export interface PrivateLesson {
  id: string;
  userId?: string; // معرف حساب المعلم المالك
  studentId: string;
  subject: string;
  gradeLevel?: string;
  billingMode: BillingMode;
  billingType: BillingType;
  pricePerSession: number;
  hourlyRate?: number;
  packageSessionsCount?: number;
  packagePrice?: number;
  scheduleDays: string[];
  scheduleTime?: string;
  scheduleTimes?: Record<string, string | string[]>;
  roomOrLocation?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

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
  hours?: number; // عدد الساعات المنفذة للحصة (مثلاً: 1.5 أو 2)
  hourlyRate?: number; // سعر الساعة المحسوبة للحصة
  sessionCount?: number; // عدد الحصص المسجلة
  effectiveSessionPrice?: number; // سعر الحصة الفعلي (Effective Session Price = Package Total Price ÷ Package Session Count أو Hours × HourlyRate)
  totalSessionValue?: number; // إجمالي قيمة الحصص المسجلة
  packageTotalPrice?: number; // إجمالي سعر الباقة وقت التسجيل
  packageSessionsCount?: number; // عدد حصص الباقة وقت التسجيل
  status: SessionStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  // Historical Billing Snapshots
  billingModeSnapshot?: BillingMode;
  billingTypeSnapshot?: BillingType;
  hourlyRateSnapshot?: number;
  sessionPriceSnapshot?: number;
  effectivePriceSnapshot?: number;
  packagePriceSnapshot?: number;
  packageSessionsCountSnapshot?: number;
  hoursSnapshot?: number;
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
  paymentStatus?: 'paid' | 'unpaid' | 'default'; // حالة سداد الحصة (مدفوعة أو مستحقة/غير مسددة)
  isPaid?: boolean; // هل الحصة مدفوعة أم لا
  paymentOverride?: 'paid' | 'unpaid'; // تجاوز يدوي من المعلم لحالة السداد
  hours?: number; // عدد الساعات المسجلة للطالب
  hourlyRate?: number; // سعر الساعة للطالب
  absenceReason?: string; // سبب عدم احتساب الغياب (الطالب ألغى | المدرس ألغى | مرض | ظرف طارئ | سبب آخر | مخصص)
  notes?: string;
  homeworkDone?: boolean; // حل الواجب
  quizScore?: number; // درجة الكويز إن وجد
  recordedAt: string;
  updatedAt?: string;
  // Historical Billing Snapshots
  billingModeSnapshot?: BillingMode;
  billingTypeSnapshot?: BillingType;
  hourlyRateSnapshot?: number;
  sessionPriceSnapshot?: number;
  effectivePriceSnapshot?: number;
  packagePriceSnapshot?: number;
  packageSessionsCountSnapshot?: number;
  hoursSnapshot?: number;
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
  updatedAt?: string;
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
  updatedAt?: string;
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
  totalHours?: number;
  unpaidHours?: number;
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

// 10. Student Grand Financial Summary (مع الفصل التام بين ماليات المجموعات والدروس الخاصة)
export interface CategoryFinancialBreakdown {
  totalDue: number;
  totalPaid: number;
  remaining: number;
  totalSessionCredit: number;
  totalUnpaidSessions: number;
  totalFinancialCredit: number;
  enrollments: EnrollmentFinancialSummary[];
}

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
  groupsFinancials: CategoryFinancialBreakdown;
  privateFinancials: CategoryFinancialBreakdown;
  hasGroupService: boolean;
  hasPrivateService: boolean;
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

// 12. Teacher Overall Financial Summary & Historical Reports
export interface PeriodFinancialBreakdown {
  totalSessions: number;
  completedSessions: number;
  presentCount: number;
  lateCount: number;
  absentChargedCount: number;
  freeCount: number;
  totalSessionValue: number;
  totalCollected: number;
  totalDue: number;
  totalRemaining: number;
}

export interface MonthFinancialRecord {
  year: number;
  month: number;
  monthYear: string; // e.g. "2026-01"
  monthName: string; // e.g. "يناير 2026"
  totalCompletedSessions: number;
  presentSessionsCount: number;
  lateSessionsCount: number;
  absentChargedCount: number;
  freeSessionsCount: number;
  cancelledSessionsCount: number;
  totalSessionValue: number;
  totalCollected: number;
  totalDue: number;
  totalRemaining: number;
  group: PeriodFinancialBreakdown;
  private: PeriodFinancialBreakdown;
  methodStats: Record<string, { label: string; amount: number; count: number; color?: string }>;
}

export interface YearFinancialRecord {
  year: number;
  yearName: string;
  totalCompletedSessions: number;
  presentSessionsCount: number;
  lateSessionsCount: number;
  absentChargedCount: number;
  freeSessionsCount: number;
  totalSessionValue: number;
  totalCollected: number;
  totalDue: number;
  totalRemaining: number;
  group: PeriodFinancialBreakdown;
  private: PeriodFinancialBreakdown;
  months: MonthFinancialRecord[];
}

export interface LifetimeFinancialSummary {
  totalCompletedSessions: number;
  presentSessionsCount: number;
  lateSessionsCount: number;
  absentChargedCount: number;
  freeSessionsCount: number;
  totalSessionValue: number;
  totalCollected: number;
  totalDue: number;
  totalRemaining: number;
  group: PeriodFinancialBreakdown;
  private: PeriodFinancialBreakdown;
  years: YearFinancialRecord[];
  months: MonthFinancialRecord[];
}

export interface TeacherOverallFinancialSummary {
  totalRevenue: number;
  totalDues: number;
  totalRemaining: number;
  totalActiveStudents: number;
  totalSessionsConducted: number;
  totalExtraSessions: number;
  monthlyRevenues: {
    monthYear: string;
    month: number;
    year: number;
    monthName: string;
    revenue: number;
    dues: number;
    remaining: number;
    sessionsCount: number;
    groupRevenue: number;
    privateRevenue: number;
  }[];
  paymentsList: Payment[];
  financialHistory?: LifetimeFinancialSummary;
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

// ==========================================
// Homework & Quizzes Domain Models
// ==========================================

export type HomeworkAssignmentStatus = 'PENDING' | 'STARTED' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

// 1. Master Test (قالب الاختبار أو الواجب)
export interface HomeworkTest {
  id: string; // Internal unique ID (e.g. hwt_...)
  userId?: string; // Owner teacher user account ID
  title: string; // Test Title / عنوان الاختبار
  description?: string; // Instructions or description
  category?: string; // e.g. "واجب منزلي", "اختبار شهري", "تقييم أسبوعي"
  subject?: string; // المادة
  gradeLevel?: string; // المرحلة الدراسية
  durationMinutes?: number; // مدة الاختبار بالدقائق
  passingPercentage?: number; // نسبة النجاح (مثال 50%)
  questionCount?: number; // عدد الأسئلة
  totalPoints?: number; // إجمالي الدرجات
  directUrlTemplate?: string; // Custom or direct URL (e.g. Google Forms / Quiz URL)
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt?: string;
}

// 2. Homework Assignment (تكليف واجب لطالب محدد أو مجموعة)
export interface HomeworkAssignment {
  id: string; // Internal assignment ID (e.g. hwa_...)
  userId?: string; // Owner teacher user account ID
  testId: string; // Reference to HomeworkTest.id
  studentId: string; // Reference to Student.id
  studentName: string; // Cached student name
  groupId?: string; // Reference to Group.id if assigned to group
  groupName?: string; // Cached group name
  title: string; // Assignment title
  testTitle?: string; // Alias for title
  description?: string; // Assignment instructions
  assignedAt: string; // ISO date string
  dueAt?: string; // ISO date string for deadline
  status: HomeworkAssignmentStatus;
  launchUrl: string; // Direct link for student or online test link
  startedAt?: string;
  completedAt?: string;
  score?: number; // Points scored
  percentage?: number; // Percentage score (0 - 100)
  scorePercentage?: number; // Alias for percentage
  pointsScored?: number;
  scoreScored?: number; // Alias for pointsScored
  pointsAvailable?: number;
  scoreTotal?: number; // Alias for pointsAvailable
  passed?: boolean;
  durationSeconds?: number;
  timeStarted?: number | string;
  timeFinished?: number | string;
  externalResultId?: string;
  createdAt: string;
  updatedAt?: string;
}

// 3. Question-level Result (تفاصيل إجابات الأسئلة)
export interface HomeworkQuestionResult {
  id: string; // Internal ID (e.g. hqr_...)
  assignmentId: string; // Reference to HomeworkAssignment.id
  questionId: string | number;
  questionText: string;
  type?: string; // multiple_choice, true_false, short_answer, etc.
  selectedAnswer?: string;
  correctAnswer?: string;
  isCorrect: boolean;
  pointsScored: number;
  pointsAvailable: number;
  timeSpentSeconds?: number;
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
  behaviorLogs?: StudentBehaviorLog[];
  homeworkTests?: HomeworkTest[];
  homeworkAssignments?: HomeworkAssignment[];
  homeworkQuestionResults?: HomeworkQuestionResult[];
  teacherProfile?: TeacherProfile;
  tombstones?: DeletionTombstone[];
  deletedIds?: {
    students?: string[];
    groups?: string[];
    enrollments?: string[];
    sessions?: string[];
    attendance?: string[];
    payments?: string[];
    creditLogs?: string[];
    behaviorLogs?: string[];
    homeworkTests?: string[];
    homeworkAssignments?: string[];
  };
  resetAllBefore?: string; // ISO timestamp when user intentionally cleared all data
  stats?: {
    totalStudents: number;
    totalGroups: number;
    totalSessions: number;
    totalPayments: number;
    totalHomeworkAssignments?: number;
  };
}

// Pending Reset Record for durable client-side crash-safe wipe operations
export interface PendingResetRecord {
  userId: string;
  resetAllBefore: string;
  timestamp: string;
  attempts: number;
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
  resetAllBefore?: string;
  pendingReset?: PendingResetRecord;
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

// تشخيصات تسجيل الدخول واستعادة البيانات السحابية
export interface AuthDiagnostics {
  loginRequestUrl: string;
  httpStatus: number | string;
  loginSuccess: boolean;
  authenticatedUserId?: string;
  tokenSaved: boolean;
  syncPullStatus: number | string;
  studentsReceived: number;
  groupsReceived: number;
  sessionsReceived: number;
  paymentsReceived: number;
  restoreSuccess: boolean;
  restoreMessage?: string;
  timestamp: string;
}

// Bulk Session Creation Types
export interface BulkStudentSessionTarget {
  studentId: string;
  enrollmentId: string;
  groupId: string;
  hours?: number;
  hourlyRate?: number;
}

export interface BulkCreateSessionsParams {
  students: BulkStudentSessionTarget[];
  sessionCount: number;
  date: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  notes?: string;
  status?: SessionStatus;
  attendanceStatus?: AttendanceStatus;
  isCharged?: boolean;
  idempotencyKey?: string;
}

export interface BulkStudentResultItem {
  studentId: string;
  studentName: string;
  enrollmentId: string;
  groupId: string;
  groupName: string;
  sessionsCreated: number;
  billingMode: BillingMode;
  chargedAmountPerSession: number;
  totalAmount: number;
  success: boolean;
  error?: string;
}

export interface BulkCreateSessionsResult {
  success: boolean;
  totalCreated: number;
  totalRequested: number;
  sessionsPerStudent: number;
  studentCount: number;
  createdSessions: Session[];
  results: BulkStudentResultItem[];
}

// ==========================================
// Notification & Smart Reminders Domain Models
// ==========================================

export type NotificationType =
  | 'package_completed'
  | 'package_almost_due'
  | 'finished_package'
  | 'payment_overdue'
  | 'unrecorded_attendance'
  | 'repeated_absence'
  | 'low_credit'
  | 'upcoming_class';

export type NotificationStatus = 'active' | 'resolved' | 'dismissed';
export type NotificationPriority = 'high' | 'medium' | 'low';
export type NotificationActionType =
  | 'record_attendance'
  | 'add_payment'
  | 'open_student'
  | 'open_group'
  | 'whatsapp'
  | 'call';

export interface NotificationSettings {
  enableEarlyPackageWarning: boolean; // تنبيه مبكر قبل اكتمال الباقة/الحصص
  earlyWarningLessonThreshold: number; // عدد الحصص قبل الاكتمال (افتراضي 1)
  enableAttendanceReminders: boolean; // تنبيهات رصد الحضور
  enableOverdueReminders: boolean; // تنبيهات مستحقات السداد
  enableAbsenceReminders: boolean; // تنبيهات الغياب المتكرر
}

export interface NotificationStateItem {
  id: string;
  isRead: boolean;
  isDismissed?: boolean;
  readAt?: string;
  dismissedAt?: string;
}

export interface SmartReminderItem {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  isRead: boolean;
  title: string;
  description: string;
  badge: string;
  studentId?: string;
  studentName?: string;
  studentPhone?: string;
  parentPhone?: string;
  parentRelation?: string;
  groupId?: string;
  groupName?: string;
  sessionId?: string;
  amount?: number;
  remainingCredits?: number;
  timeStr?: string;
  actionType: NotificationActionType;
  // Package / Cycle tracking metadata
  enrollmentId?: string;
  packageSize?: number;
  cycleIndex?: number;
  totalCompletedSessions?: number;
  lessonsRemaining?: number;
  createdAt?: string;
  resolvedAt?: string;
}

export type AppNotification = SmartReminderItem;
