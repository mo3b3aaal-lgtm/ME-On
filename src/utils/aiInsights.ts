import { Student, Group, Session, Attendance } from '../types';

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
  teacherSubject: string = 'عام',
  teacherName: string = 'المعلم'
): Promise<SmartAttendanceInsightsResult> {
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
        atRisk.push({
          studentId: st.studentId,
          studentName: st.studentName,
          riskLevel: recentAbsences >= 2 ? 'high' : 'medium',
          attendanceRate: st.rate,
          reason: recentAbsences >= 2 ? 'غياب متتالي لآخر حصتين' : `نسبة الحضور منخفضة (${st.rate}%)`,
          recommendation: 'التواصل مع ولي الأمر للاطمئنان ومتابعة تعويض المحتوى الدراسي',
          parentPhone: studentObj?.parentPhone || studentObj?.phone || '',
        });
      }
    });

    const score = totalRecorded > 0 ? Math.round((totalPresent / totalRecorded) * 100) : 100;

    return {
      overallHealthScore: score,
      headline:
        atRisk.length > 0
          ? `رصد ${atRisk.length} طلاب بحاجة لاهتمام ومتابعة إضافية`
          : 'معدل التزام مستقر وحضور ممتاز في كافة المجموعات',
      summary: `معدل الحضور العام ${score}%. الحفاظ على استمرارية الحضور يعزز التحصيل الدراسي.`,
      attentionNeededStudents: atRisk.slice(0, 4),
      positiveNotes: 'معظم الطلاب ملتزمون بالمواعيد والحصص دون انقطاع',
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
        teacherSubject,
        teacherName,
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
