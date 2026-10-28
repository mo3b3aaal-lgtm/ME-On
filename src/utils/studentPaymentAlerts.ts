import {
  Attendance,
  Enrollment,
  Group,
  Payment,
  Session,
  Student,
} from '../types';
import { toLocalISODate, parseLocalDateStr } from './localDate';
import {
  addMoney,
  calculateCoveredSessions,
  divideMoney,
  multiplyMoney,
  roundMoney,
  subtractMoney,
} from './money';
import { isEnrollmentActiveOnDate } from './schedule';

export type StudentPaymentAlertKind =
  | 'none'
  | 'outstanding_payment'
  | 'low_session_balance'
  | 'both';

export interface StudentPaymentAlertInfo {
  studentId: string;
  alertKind: StudentPaymentAlertKind;
  hasOutstandingPayment: boolean;
  hasLowSessionBalance: boolean;
  outstandingAmount: number;
  lowSessionRemaining: number | null;
  netBalance: number;
}

export interface EvaluateStudentPaymentAlertsParams {
  students: readonly Student[];
  groups: readonly Group[];
  enrollments: readonly Enrollment[];
  sessions: readonly Session[];
  allAttendance: readonly Attendance[];
  payments: readonly Payment[];
  /** Remaining paid/package sessions at or below which low-balance warning triggers (default: 2) */
  lowSessionThreshold?: number;
  /** Optional YYYY-MM-DD reference date for monthly billing evaluation */
  referenceDateStr?: string;
}

export const DEFAULT_LOW_SESSION_BALANCE_THRESHOLD = 2;

function resolveEffectiveUnitPrice(enrollment?: Enrollment, group?: Group): number {
  if (enrollment && typeof enrollment.customPrice === 'number' && enrollment.customPrice > 0) {
    return enrollment.customPrice;
  }
  if (group && typeof group.defaultPrice === 'number' && group.defaultPrice > 0) {
    return group.defaultPrice;
  }
  return 100;
}

function getConsumedUnitsForAttendance(att: Attendance, session?: Session): number {
  const rawUnits =
    att.sessionUnits !== undefined && att.sessionUnits !== null
      ? Number(att.sessionUnits)
      : session?.sessionUnits !== undefined && session?.sessionUnits !== null
      ? Number(session.sessionUnits)
      : session?.sessionCount !== undefined && session?.sessionCount !== null
      ? Number(session.sessionCount)
      : 1;
  return isNaN(rawUnits) || rawUnits <= 0 ? 1 : rawUnits;
}

function isAttendanceCharged(att: Attendance): boolean {
  if (att.isCharged !== undefined) {
    return Boolean(att.isCharged);
  }
  return (
    att.status === 'present' ||
    att.status === 'late' ||
    att.status === 'absent_charged' ||
    att.status === 'absent'
  );
}

function isAttendanceMarkedUnpaid(att: Attendance): boolean {
  return (
    att.paymentStatus === 'unpaid' ||
    att.paymentOverride === 'unpaid' ||
    att.isPaid === false
  );
}

function hasExplicitSessionPackIntent(payments: readonly Payment[]): boolean {
  for (const p of payments) {
    if (
      p.paymentType === 'single_session' ||
      p.paymentType === 'session_count' ||
      (typeof p.sessionsPurchased === 'number' && p.sessionsPurchased > 0) ||
      (typeof p.sessionsCovered === 'number' && p.sessionsCovered > 0) ||
      (typeof p.autoSessionsConverted === 'number' && p.autoSessionsConverted > 0)
    ) {
      return true;
    }
  }
  return false;
}

function sumSessionsCoveredByPayments(
  payments: readonly Payment[],
  unitRate: number
): number {
  let total = 0;
  for (const p of payments) {
    const autoConv =
      typeof p.autoSessionsConverted === 'number' && p.autoSessionsConverted > 0
        ? p.autoSessionsConverted
        : 0;

    if (typeof p.sessionsPurchased === 'number' && p.sessionsPurchased > 0) {
      total += p.sessionsPurchased + autoConv;
    } else if (typeof p.sessionsCovered === 'number' && p.sessionsCovered > 0) {
      total += p.sessionsCovered + autoConv;
    } else if (p.paymentType === 'single_session') {
      total += 1 + autoConv;
    } else if (p.paymentType === 'session_count') {
      total += (p.sessionsPurchased || 1) + autoConv;
    } else if (
      p.paymentType !== 'specific_month' &&
      unitRate > 0 &&
      Number(p.amount) > 0
    ) {
      total += calculateCoveredSessions(Number(p.amount), unitRate) + autoConv;
    } else {
      total += autoConv;
    }
  }
  return roundMoney(total, 2);
}

/**
 * Pure, single-pass indexed evaluator that derives outstanding payment and low
 * session balance indicators for every student in `StudentsView` directly from
 * `payments` data alongside enrollments, groups, sessions, and attendance.
 */
export function evaluateStudentPaymentAlerts({
  students,
  groups,
  enrollments,
  sessions,
  allAttendance,
  payments,
  lowSessionThreshold = DEFAULT_LOW_SESSION_BALANCE_THRESHOLD,
  referenceDateStr,
}: EvaluateStudentPaymentAlertsParams): Map<string, StudentPaymentAlertInfo> {
  const result = new Map<string, StudentPaymentAlertInfo>();
  const resolvedRefDate = referenceDateStr || toLocalISODate();
  const refParts = resolvedRefDate.split('-').map(Number);
  const curYear = refParts[0] || new Date().getFullYear();
  const curMonth = refParts[1] || new Date().getMonth() + 1;
  const curMonthFirstDay = `${curYear}-${String(curMonth).padStart(2, '0')}-01`;
  const lastDayNum = new Date(curYear, curMonth, 0).getDate();
  const curMonthLastDay = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(
    lastDayNum
  ).padStart(2, '0')}`;

  const groupsById = new Map<string, Group>();
  for (const g of groups) {
    groupsById.set(g.id, g);
  }

  const enrollmentsByStudentId = new Map<string, Enrollment[]>();
  for (const enr of enrollments) {
    if (enr.status === 'stopped') continue;
    const list = enrollmentsByStudentId.get(enr.studentId);
    if (list) {
      list.push(enr);
    } else {
      enrollmentsByStudentId.set(enr.studentId, [enr]);
    }
  }

  const paymentsByStudentId = new Map<string, Payment[]>();
  for (const p of payments) {
    if (!p || !p.studentId) continue;
    const list = paymentsByStudentId.get(p.studentId);
    if (list) {
      list.push(p);
    } else {
      paymentsByStudentId.set(p.studentId, [p]);
    }
  }

  const activeSessionsById = new Map<string, Session>();
  const sessionsByEnrollmentId = new Map<string, Session[]>();
  const sessionsByGroupId = new Map<string, Session[]>();
  const privateSessionsByStudentId = new Map<string, Session[]>();

  for (const s of sessions) {
    if (!s || s.status === 'cancelled') continue;
    activeSessionsById.set(s.id, s);

    if (s.enrollmentId) {
      const list = sessionsByEnrollmentId.get(s.enrollmentId);
      if (list) list.push(s);
      else sessionsByEnrollmentId.set(s.enrollmentId, [s]);
    }
    if (s.groupId) {
      const list = sessionsByGroupId.get(s.groupId);
      if (list) list.push(s);
      else sessionsByGroupId.set(s.groupId, [s]);
    }
    if (s.studentId) {
      const list = privateSessionsByStudentId.get(s.studentId);
      if (list) list.push(s);
      else privateSessionsByStudentId.set(s.studentId, [s]);
    }
  }

  const attendanceByStudentId = new Map<string, Attendance[]>();
  for (const a of allAttendance) {
    if (!a || !a.studentId) continue;
    const list = attendanceByStudentId.get(a.studentId);
    if (list) {
      list.push(a);
    } else {
      attendanceByStudentId.set(a.studentId, [a]);
    }
  }

  for (const student of students) {
    const stEnrollments = enrollmentsByStudentId.get(student.id) || [];
    const stPayments = paymentsByStudentId.get(student.id) || [];
    const stAttendance = attendanceByStudentId.get(student.id) || [];

    // Partition student's payments across enrollments without double-counting
    const enrPaymentsMap = new Map<string, Payment[]>();
    const assignedPaymentIds = new Set<string>();

    for (const enr of stEnrollments) {
      enrPaymentsMap.set(enr.id, []);
    }

    // Pass 1: exact enrollmentId match
    for (const p of stPayments) {
      if (p.enrollmentId && enrPaymentsMap.has(p.enrollmentId)) {
        enrPaymentsMap.get(p.enrollmentId)!.push(p);
        assignedPaymentIds.add(p.id);
      }
    }

    // Pass 2: groupId match when enrollmentId was omitted
    for (const p of stPayments) {
      if (assignedPaymentIds.has(p.id) || !p.groupId) continue;
      const targetEnr = stEnrollments.find((e) => e.groupId === p.groupId);
      if (targetEnr) {
        enrPaymentsMap.get(targetEnr.id)!.push(p);
        assignedPaymentIds.add(p.id);
      }
    }

    // Pass 3: if student has exactly 1 active enrollment, route remaining student payments to it
    const unassignedPayments: Payment[] = [];
    for (const p of stPayments) {
      if (assignedPaymentIds.has(p.id)) continue;
      if (stEnrollments.length === 1) {
        enrPaymentsMap.get(stEnrollments[0].id)!.push(p);
        assignedPaymentIds.add(p.id);
      } else {
        unassignedPayments.push(p);
      }
    }

    let grandDue = 0;
    let grandPaid = 0;
    let grossRemaining = 0;
    let lowestSessionRemaining: number | null = null;

    const recordCandidateLowSession = (val: number) => {
      const normalized = Math.max(0, roundMoney(val, 2));
      if (normalized <= lowSessionThreshold) {
        if (lowestSessionRemaining === null || normalized < lowestSessionRemaining) {
          lowestSessionRemaining = normalized;
        }
      }
    };

    for (const enr of stEnrollments) {
      const group = enr.groupId ? groupsById.get(enr.groupId) : undefined;
      const enrPayments = enrPaymentsMap.get(enr.id) || [];
      const isPrivateService = enr.serviceType === 'private' || group?.type === 'private';

      // Collect deduplicated active sessions for this enrollment
      const enrSessionsMap = new Map<string, Session>();
      const byEnr = sessionsByEnrollmentId.get(enr.id) || [];
      for (const s of byEnr) enrSessionsMap.set(s.id, s);

      if (enr.groupId) {
        const byGrp = sessionsByGroupId.get(enr.groupId) || [];
        for (const s of byGrp) enrSessionsMap.set(s.id, s);
      }
      if (isPrivateService) {
        const byPriv = privateSessionsByStudentId.get(student.id) || [];
        for (const s of byPriv) enrSessionsMap.set(s.id, s);
      }

      const enrSessions = Array.from(enrSessionsMap.values());
      const consumedAttendance = stAttendance.filter(
        (a) => enrSessionsMap.has(a.sessionId) && isAttendanceCharged(a)
      );

      const attendedUnits = roundMoney(
        consumedAttendance.reduce(
          (sum, a) => sum + getConsumedUnitsForAttendance(a, enrSessionsMap.get(a.sessionId)),
          0
        ),
        2
      );

      const isHourly =
        enr.billingType === 'hourly' ||
        enr.billingMode === 'hourly' ||
        group?.billingType === 'hourly' ||
        group?.billingMode === 'hourly';

      const isMonthly =
        !isHourly &&
        (enr.billingType === 'monthly' ||
          enr.billingMode === 'monthly' ||
          (!enr.billingType && !enr.billingMode && group?.billingType === 'monthly'));

      const isPackage =
        !isHourly &&
        !isMonthly &&
        (enr.billingMode === 'package' ||
          enr.billingType === 'package' ||
          group?.billingType === 'package' ||
          group?.billingMode === 'package' ||
          Boolean(enr.packageSessionsCount || group?.packageSessionsCount));

      const isPostpaid =
        !isHourly &&
        !isMonthly &&
        !isPackage &&
        (enr.billingMode === 'postpaid' ||
          enr.billingType === 'postpaid' ||
          group?.billingMode === 'postpaid' ||
          group?.billingType === 'postpaid');

      const sessionRate = resolveEffectiveUnitPrice(enr, group);
      const explicitPaid = roundMoney(
        enrPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
        2
      );

      let enrDue = 0;
      let enrPaid = explicitPaid;
      let enrRemaining = 0;

      if (isMonthly) {
        const baseSessionsLimit = enr.baseSessionsPerMonth || group?.baseSessionsPerMonth || 8;
        const basePrice = roundMoney(
          enr.customPrice > 0 ? enr.customPrice : group?.defaultPrice || 0,
          2
        );
        const extraSessionRate =
          enr.extraSessionPrice ||
          (basePrice > 0 ? divideMoney(basePrice, baseSessionsLimit) : 100);

        const effStart = enr.startDate || student.startDate;
        const effEnd = enr.endDate || student.endDate;
        const hasConfiguredPeriod = Boolean(
          effStart ||
            effEnd ||
            (enr.vacationPeriods && enr.vacationPeriods.length > 0) ||
            (student.vacationPeriods && student.vacationPeriods.length > 0)
        );

        const monthsSet = new Set<string>();
        if (effStart) {
          const sd = parseLocalDateStr(effStart);
          if (!isNaN(sd.getTime()) && effStart <= resolvedRefDate && (!effEnd || effStart <= effEnd)) {
            monthsSet.add(`${sd.getFullYear()}-${sd.getMonth() + 1}`);
          }
        } else if (enr.joinedAt) {
          const jd = parseLocalDateStr(enr.joinedAt);
          if (!isNaN(jd.getTime())) {
            const joinedDateStr = toLocalISODate(jd);
            if (!effEnd || joinedDateStr <= effEnd) {
              monthsSet.add(`${jd.getFullYear()}-${jd.getMonth() + 1}`);
            }
          }
        }

        if ((!effStart || effStart <= curMonthLastDay) && (!effEnd || effEnd >= curMonthFirstDay)) {
          monthsSet.add(`${curYear}-${curMonth}`);
        }

        const consumedSessionIds = new Set(consumedAttendance.map((a) => a.sessionId));
        for (const s of enrSessions) {
          const sYear = s.year || (s.date ? Number(s.date.split('-')[0]) : 0);
          const sMonth = s.month || (s.date ? Number(s.date.split('-')[1]) : 0);
          if (sYear && sMonth) {
            if (
              consumedSessionIds.has(s.id) ||
              !hasConfiguredPeriod ||
              (s.date && isEnrollmentActiveOnDate(enr, s.date, student))
            ) {
              monthsSet.add(`${sYear}-${sMonth}`);
            }
          }
        }

        for (const p of enrPayments) {
          if (p.targetYear && p.targetMonth) {
            monthsSet.add(`${p.targetYear}-${p.targetMonth}`);
          } else if (p.year && p.month) {
            monthsSet.add(`${p.year}-${p.month}`);
          }
        }

        for (const mKey of monthsSet) {
          const [yr, mo] = mKey.split('-').map(Number);
          const monthSessionIds = new Set(
            enrSessions
              .filter((s) => {
                const sY = s.year || (s.date ? Number(s.date.split('-')[0]) : 0);
                const sM = s.month || (s.date ? Number(s.date.split('-')[1]) : 0);
                return sY === yr && sM === mo;
              })
              .map((s) => s.id)
          );
          const attendedThisMonth = consumedAttendance.filter((a) =>
            monthSessionIds.has(a.sessionId)
          ).length;
          const extraInMonth = Math.max(0, attendedThisMonth - baseSessionsLimit);
          const extraCharge = multiplyMoney(extraInMonth, extraSessionRate);
          enrDue = addMoney(enrDue, addMoney(basePrice, extraCharge));
        }

        enrRemaining = Math.max(0, subtractMoney(enrDue, enrPaid));
      } else if (isHourly) {
        const effectiveHourlyRate =
          enr.hourlyRate ||
          enr.customPrice ||
          group?.hourlyRate ||
          group?.defaultPrice ||
          100;
        let hourlyGrossCharged = 0;
        for (const a of consumedAttendance) {
          const sess = enrSessionsMap.get(a.sessionId);
          const hrs =
            a.hours !== undefined && a.hours !== null
              ? Number(a.hours)
              : sess?.hours !== undefined && sess?.hours !== null
              ? Number(sess.hours)
              : 1;
          const rate = a.hourlyRate || sess?.hourlyRate || effectiveHourlyRate;
          hourlyGrossCharged = addMoney(hourlyGrossCharged, multiplyMoney(hrs, rate));
        }
        enrDue = hourlyGrossCharged;

        const isPrepaidHourly =
          enr.billingMode === 'prepaid' ||
          enr.billingType === 'prepaid' ||
          (enr.billingType === 'per_session' && enr.billingMode !== 'postpaid');

        if (isPrepaidHourly) {
          let autoPaidVal = 0;
          for (const a of consumedAttendance) {
            if (!isAttendanceMarkedUnpaid(a)) {
              const sess = enrSessionsMap.get(a.sessionId);
              const hrs =
                a.hours !== undefined && a.hours !== null
                  ? Number(a.hours)
                  : sess?.hours !== undefined && sess?.hours !== null
                  ? Number(sess.hours)
                  : 1;
              const rate = a.hourlyRate || sess?.hourlyRate || effectiveHourlyRate;
              autoPaidVal = addMoney(autoPaidVal, multiplyMoney(hrs, rate));
            }
          }
          enrPaid = addMoney(autoPaidVal, explicitPaid);
        }
        enrRemaining = Math.max(0, subtractMoney(enrDue, enrPaid));
      } else if (isPackage) {
        const packageSize = Math.max(
          1,
          enr.packageSessionsCount || group?.packageSessionsCount || 8
        );
        const packagePrice =
          enr.packagePrice ||
          group?.defaultPrice ||
          enr.customPrice ||
          multiplyMoney(packageSize, 100);
        const unitRate =
          packageSize > 0 ? divideMoney(packagePrice, packageSize) : sessionRate;

        enrDue = roundMoney(multiplyMoney(attendedUnits, unitRate), 2);
        enrPaid = explicitPaid;
        enrRemaining = Math.max(0, subtractMoney(enrDue, enrPaid));

        const purchasedSessions = sumSessionsCoveredByPayments(enrPayments, unitRate);
        if (purchasedSessions > 0) {
          const remPaidSessions = Math.max(
            0,
            roundMoney(purchasedSessions - attendedUnits, 2)
          );
          recordCandidateLowSession(remPaidSessions);
        } else if (attendedUnits > 0) {
          const completedCycles = Math.floor(attendedUnits / packageSize);
          const cycleAttended = roundMoney(
            attendedUnits - completedCycles * packageSize,
            2
          );
          const remInCycle =
            cycleAttended > 0 ? roundMoney(packageSize - cycleAttended, 2) : 0;
          recordCandidateLowSession(remInCycle);
        } else if (typeof enr.sessionCredit === 'number' && enr.sessionCredit > 0) {
          recordCandidateLowSession(enr.sessionCredit);
        }
      } else if (isPostpaid) {
        enrDue = roundMoney(multiplyMoney(attendedUnits, sessionRate), 2);
        enrPaid = explicitPaid;
        enrRemaining = Math.max(0, subtractMoney(enrDue, enrPaid));

        const purchasedSessions = sumSessionsCoveredByPayments(enrPayments, sessionRate);
        if (
          purchasedSessions > 0 &&
          (hasExplicitSessionPackIntent(enrPayments) || purchasedSessions > attendedUnits)
        ) {
          const remPaidSessions = Math.max(
            0,
            roundMoney(purchasedSessions - attendedUnits, 2)
          );
          recordCandidateLowSession(remPaidSessions);
        } else if (typeof enr.sessionCredit === 'number' && enr.sessionCredit > 0) {
          recordCandidateLowSession(enr.sessionCredit);
        }
      } else {
        // Prepaid / Per-session
        const hasSessionPackPayments = hasExplicitSessionPackIntent(enrPayments);
        const purchasedFromPayments = sumSessionsCoveredByPayments(
          enrPayments,
          sessionRate
        );

        const unpaidAttendance = consumedAttendance.filter((a) =>
          isAttendanceMarkedUnpaid(a)
        );
        const autoPaidAttendance = consumedAttendance.filter(
          (a) => !isAttendanceMarkedUnpaid(a)
        );

        const unpaidVal = unpaidAttendance.reduce((sum, a) => {
          const sess = enrSessionsMap.get(a.sessionId);
          const units = getConsumedUnitsForAttendance(a, sess);
          return addMoney(sum, a.sessionPriceSnapshot || multiplyMoney(units, sessionRate));
        }, 0);

        const autoPaidVal = autoPaidAttendance.reduce((sum, a) => {
          const sess = enrSessionsMap.get(a.sessionId);
          const units = getConsumedUnitsForAttendance(a, sess);
          return addMoney(sum, a.sessionPriceSnapshot || multiplyMoney(units, sessionRate));
        }, 0);

        if (hasSessionPackPayments && unpaidAttendance.length === 0) {
          // Student pays in session packs via `payments`: compare attended units vs paid amount
          const sessionPackDue = roundMoney(multiplyMoney(attendedUnits, sessionRate), 2);
          enrDue = sessionPackDue;
          enrPaid = explicitPaid;
          enrRemaining = Math.max(0, subtractMoney(enrDue, enrPaid));

          const remPaidSessions = Math.max(
            0,
            roundMoney(purchasedFromPayments - attendedUnits, 2)
          );
          recordCandidateLowSession(remPaidSessions);
        } else {
          enrDue = addMoney(autoPaidVal, unpaidVal);
          enrPaid = addMoney(autoPaidVal, explicitPaid);
          enrRemaining = Math.max(0, subtractMoney(enrDue, enrPaid));

          if (purchasedFromPayments > 0) {
            const remPaidSessions = Math.max(
              0,
              roundMoney(purchasedFromPayments - attendedUnits, 2)
            );
            recordCandidateLowSession(remPaidSessions);
          } else if (typeof enr.sessionCredit === 'number' && enr.sessionCredit > 0) {
            recordCandidateLowSession(enr.sessionCredit);
          }
        }
      }

      grandDue = addMoney(grandDue, enrDue);
      grandPaid = addMoney(grandPaid, enrPaid);
      grossRemaining = addMoney(grossRemaining, enrRemaining);
    }

    // Factor in any unassigned student-level payments (e.g., student payments without enrollmentId)
    if (unassignedPayments.length > 0) {
      const unassignedAmount = roundMoney(
        unassignedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
        2
      );
      grandPaid = addMoney(grandPaid, unassignedAmount);
      grossRemaining = Math.max(0, subtractMoney(grossRemaining, unassignedAmount));

      if (hasExplicitSessionPackIntent(unassignedPayments)) {
        const fallbackUnitPrice = stEnrollments[0]
          ? resolveEffectiveUnitPrice(
              stEnrollments[0],
              stEnrollments[0].groupId
                ? groupsById.get(stEnrollments[0].groupId)
                : undefined
            )
          : 100;
        const unassignedPurchased = sumSessionsCoveredByPayments(
          unassignedPayments,
          fallbackUnitPrice
        );
        if (stEnrollments.length === 0 && unassignedPurchased > 0) {
          const directConsumedUnits = roundMoney(
            stAttendance
              .filter(
                (a) => activeSessionsById.has(a.sessionId) && isAttendanceCharged(a)
              )
              .reduce(
                (sum, a) =>
                  sum +
                  getConsumedUnitsForAttendance(a, activeSessionsById.get(a.sessionId)),
                0
              ),
            2
          );
          const remDirect = Math.max(
            0,
            roundMoney(unassignedPurchased - directConsumedUnits, 2)
          );
          recordCandidateLowSession(remDirect);

          const directDue = roundMoney(
            multiplyMoney(directConsumedUnits, fallbackUnitPrice),
            2
          );
          grandDue = addMoney(grandDue, directDue);
          grossRemaining = Math.max(0, subtractMoney(directDue, unassignedAmount));
        } else if (unassignedPurchased > 0) {
          recordCandidateLowSession(unassignedPurchased);
        }
      }
    }

    const netBalance = roundMoney(subtractMoney(grandPaid, grandDue), 2);
    const outstandingAmount = roundMoney(
      Math.max(grossRemaining, netBalance < 0 ? Math.abs(netBalance) : 0),
      2
    );

    const isArchived = student.status === 'archived';
    const hasOutstandingPayment = !isArchived && outstandingAmount > 0;
    const hasLowSessionBalance = !isArchived && lowestSessionRemaining !== null;

    let alertKind: StudentPaymentAlertKind = 'none';
    if (hasOutstandingPayment && hasLowSessionBalance) {
      alertKind = 'both';
    } else if (hasOutstandingPayment) {
      alertKind = 'outstanding_payment';
    } else if (hasLowSessionBalance) {
      alertKind = 'low_session_balance';
    }

    result.set(student.id, {
      studentId: student.id,
      alertKind,
      hasOutstandingPayment,
      hasLowSessionBalance,
      outstandingAmount,
      lowSessionRemaining: hasLowSessionBalance ? lowestSessionRemaining : null,
      netBalance,
    });
  }

  return result;
}
