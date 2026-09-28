import { Student, Group, Session, Attendance } from '../types';
import { getAppLanguage } from './i18n';

export interface AttentionNeededStudent {
  studentId: string;
  studentName: string;
  riskLevel: 'high' | 'medium' | 'low';
  attendanceRate: number;
  reason: string;
  recommendation: string;
  parentPhone?: string;
}

export interface SmartAttendanceInsightsResult {
  overallHealthScore: number;
  headline: string;
  summary: string;
  attentionNeededStudents: AttentionNeededStudent[];
  positiveNotes?: string;
  generatedAt?: string;
}

export function computeAttendanceSummaryForStudents(
  students: Student[],
  sessions: Session[],
  attendance: Attendance[]
) {
  const activeStudents = students.filter((s) => s.status !== 'archived');
  
  // Sort sessions chronologically descending
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return activeStudents.map((st) => {
    const studentAttendance = attendance.filter((a) => a.studentId === st.id);
    const presentCount = studentAttendance.filter(
      (a) => a.status === 'present' || a.status === 'late'
    ).length;
    const lateCount = studentAttendance.filter((a) => a.status === 'late').length;
    const absentChargedCount = studentAttendance.filter(
      (a) => a.status === 'absent_charged' || (a.status === 'absent' && a.isCharged !== false)
    ).length;
    const absentFreeCount = studentAttendance.filter(
      (a) => a.status === 'absent_free' || a.status === 'excused' || (a.status === 'absent' && a.isCharged === false)
    ).length;

    // Recent 4 recorded session statuses
    const recentStatuses: string[] = [];
    for (const sess of sortedSessions) {
      const att = studentAttendance.find((a) => a.sessionId === sess.id);
      if (att) {
        recentStatuses.push(att.status);
        if (recentStatuses.length >= 4) break;
      }
    }

    const totalSessions = studentAttendance.length;

    return {
      studentId: st.id,
      studentName: st.name,
      totalSessions,
      presentCount,
      lateCount,
      absentChargedCount,
      absentFreeCount,
      recentStatuses,
      rate: totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 100,
    };
  });
}

export async function fetchAttendanceInsights(
  students: Student[],
  groups: Group[],
  sessions: Session[],
  attendance: Attendance[],
  teacherSubject?: string,
  teacherName?: string,
  lang?: string
): Promise<SmartAttendanceInsightsResult> {
  const currentLang = lang || getAppLanguage();
  const isEn = currentLang.startsWith('en');

  const defaultSubject = teacherSubject || (isEn ? 'General' : 'عام');
  const defaultTeacher = teacherName || (isEn ? 'Teacher' : 'المعلم');

  const attendanceSummary = computeAttendanceSummaryForStudents(students, sessions, attendance);

  // Fallback generation logic for offline or fast responses
  const getLocalFallback = (): SmartAttendanceInsightsResult => {
    const atRisk: AttentionNeededStudent[] = [];
    let totalPresent = 0;
    let totalRecorded = 0;

    attendanceSummary.forEach((st) => {
      totalPresent += st.presentCount;
      totalRecorded += st.totalSessions;

      const recentAbsences = st.recentStatuses.slice(0, 2).filter((s) => s.includes('absent')).length;
      if (recentAbsences >= 2 || (st.totalSessions >= 3 && st.rate < 75)) {
        const studentObj = students.find((s) => s.id === st.studentId);
        const reason = isEn
          ? (recentAbsences >= 2 ? 'Consecutive absence for last 2 lessons' : `Low attendance rate (${st.rate}%)`)
          : (recentAbsences >= 2 ? 'غياب متتالي لآخر حصتين' : `نسبة الحضور منخفضة (${st.rate}%)`);
        const recommendation = isEn
          ? 'Contact guardian to check in and arrange lesson catch-up material'
          : 'التواصل مع ولي الأمر للاطمئنان ومتابعة تعويض المحتوى الدراسي';

        atRisk.push({
          studentId: st.studentId,
          studentName: st.studentName,
          riskLevel: recentAbsences >= 2 ? 'high' : 'medium',
          attendanceRate: st.rate,
          reason,
          recommendation,
          parentPhone: studentObj?.parentPhone || studentObj?.phone || '',
        });
      }
    });

    const score = totalRecorded > 0 ? Math.round((totalPresent / totalRecorded) * 100) : 100;

    const headline = isEn
      ? (atRisk.length > 0
          ? `${atRisk.length} ${atRisk.length === 1 ? 'student requires' : 'students require'} follow-up and engagement`
          : 'Stable commitment and excellent attendance across all groups')
      : (atRisk.length > 0
          ? `رصد ${atRisk.length} طلاب بحاجة لاهتمام ومتابعة إضافية`
          : 'معدل التزام مستقر وحضور ممتاز في كافة المجموعات');

    const summary = isEn
      ? `Overall attendance rate is ${score}%. Consistent attendance ensures optimal learning progression.`
      : `معدل الحضور العام ${score}%. الحفاظ على استمرارية الحضور يعزز التحصيل الدراسي.`;

    const positiveNotes = isEn
      ? 'Most students are regularly attending scheduled lessons on time'
      : 'معظم الطلاب ملتزمون بالمواعيد والحصص دون انقطاع';

    return {
      overallHealthScore: score,
      headline,
      summary,
      attentionNeededStudents: atRisk.slice(0, 4),
      positiveNotes,
      generatedAt: new Date().toISOString(),
    };
  };

  try {
    const response = await fetch('/api/ai/attendance-insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        students: students.map((s) => ({
          id: s.id,
          name: s.name,
          phone: s.phone,
          parentPhone: s.parentPhone,
        })),
        attendanceSummary,
        teacherSubject: defaultSubject,
        teacherName: defaultTeacher,
        language: isEn ? 'en' : 'ar',
      }),
    });

    if (!response.ok) {
      return getLocalFallback();
    }

    const data = await response.json();
    return data;
  } catch {
    return getLocalFallback();
  }
}
