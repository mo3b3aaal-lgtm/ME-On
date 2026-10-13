import React, { useState, useEffect } from "react";
import { AppIcon } from "./components/ui/AppIcon";
import { DashboardView } from "./components/DashboardView";
import { SettingsScreen } from "./components/SettingsScreen";
import { BulkAddSessionModal } from "./components/BulkAddSessionModal";
import { RecordAttendanceModal } from "./components/RecordAttendanceModal";
import { RecordPrivateSessionModal } from "./components/RecordPrivateSessionModal";
import { StudentProfileModal } from "./components/StudentProfileModal";
import { db } from "./utils/storage";
import { Student, Group, Session, Attendance } from "./types";
import { ModalProvider } from "./contexts/ModalContext";
import { useCurrentLocalDate } from "./utils/date";
import { runAllVerifications, VerificationResult } from "./utils/e2e_verification_runner";

export const App: React.FC = () => {
  const currentDate = useCurrentLocalDate();
  const [activeTab, setActiveTab] = useState<"dashboard" | "students" | "settings" | "verify">("dashboard");
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  // Modals state
  const [isBulkAddOpen, setIsBulkAddOpen] = useState<boolean>(false);
  const [attendanceModalGroup, setAttendanceModalGroup] = useState<Group | null>(null);
  const [privateModalStudent, setPrivateModalStudent] = useState<Student | null>(null);
  const [profileModalStudent, setProfileModalStudent] = useState<Student | null>(null);

  // Verification runner state
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const [isRunningVerification, setIsRunningVerification] = useState<boolean>(false);

  const loadData = () => {
    let currentStudents = db.getStudents();
    let currentGroups = db.getGroups();

    // Seed sample data if totally empty
    if (currentStudents.length === 0) {
      const sampleStudents: Student[] = [
        { id: "st_1", name: "محمد العراقي", phone: "07801234567", gradeLevel: "الثالث متوسط", status: "active", avatarColor: "#0F2A4A", createdAt: new Date().toISOString() },
        { id: "st_2", name: "علي الموسوي", phone: "07709876543", gradeLevel: "الثالث متوسط", status: "active", avatarColor: "#0F2A4A", createdAt: new Date().toISOString() },
        { id: "st_3", name: "فاطمة الزهراء", phone: "07505554433", gradeLevel: "الرابع علمي", status: "active", avatarColor: "#0F2A4A", createdAt: new Date().toISOString() },
        { id: "st_4", name: "زينب البصري", phone: "07812233445", gradeLevel: "الرابع علمي", status: "active", avatarColor: "#0F2A4A", createdAt: new Date().toISOString() },
        { id: "st_5", name: "حيدر الكرخي", phone: "07901122334", gradeLevel: "السادس إعدادي", status: "active", avatarColor: "#0F2A4A", createdAt: new Date().toISOString() },
      ];
      sampleStudents.forEach(s => db.saveStudent(s));
      currentStudents = sampleStudents;

      const sampleGroups: Group[] = [
        {
          id: "grp_math_3",
          name: "مجموعة الرياضيات - الثالث",
          subject: "رياضيات",
          gradeLevel: "الثالث متوسط",
          type: "group",
          billingType: "monthly",
          defaultPrice: 100,
          scheduleDays: ["السبت", "الثلاثاء"],
          scheduleTime: "16:00",
          accentColor: "#0F2A4A",
          createdAt: new Date().toISOString(),
        },
        {
          id: "grp_physics_4",
          name: "مجموعة الفيزياء - الرابع",
          subject: "فيزياء",
          gradeLevel: "الرابع علمي",
          type: "group",
          billingType: "monthly",
          defaultPrice: 120,
          scheduleDays: ["الأحد", "الأربعاء"],
          scheduleTime: "18:00",
          accentColor: "#17375E",
          createdAt: new Date().toISOString(),
        },
      ];
      sampleGroups.forEach(g => db.saveGroup(g));
      currentGroups = sampleGroups;

      // Seed scheduled sessions for today
      db.saveSession({
        id: `sess_${currentDate.replace(/-/g, "")}_grp_math_3_group_960`,
        groupId: "grp_math_3",
        studentId: "group",
        date: currentDate,
        dayName: "السبت",
        month: 10,
        year: 2026,
        startTime: "16:00",
        hours: 1,
        title: "حصة الرياضيات - الثالث",
        status: "scheduled",
        sessionUnits: 1,
        createdAt: new Date().toISOString(),
      });
    }

    setStudents(currentStudents);
    setGroups(currentGroups);
    setSessions(db.getSessions());
    setAttendance(db.getAttendance());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunE2E = () => {
    setIsRunningVerification(true);
    setTimeout(() => {
      const res = runAllVerifications();
      setVerificationResults(res);
      setIsRunningVerification(false);
      loadData();
    }, 100);
  };

  return (
    <ModalProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 select-none">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0F2A4A] text-white flex items-center justify-center font-black text-sm shadow-sm">
            C
          </div>
          <div>
            <h1 className="text-base font-black text-[#0F2A4A] leading-tight">Classy</h1>
            <span className="text-[10px] font-bold text-slate-400">إدارة الحصص والطلاب</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab("verify")}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-emerald-200"
          >
            <AppIcon name="shield" size={14} />
            <span>فحص الأمان (E2E)</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-2xl mx-auto">
        {activeTab === "dashboard" && (
          <DashboardView
            students={students}
            groups={groups}
            sessions={sessions}
            onOpenBulkAdd={() => setIsBulkAddOpen(true)}
            onOpenRecordAttendance={g => setAttendanceModalGroup(g)}
            onOpenStudentProfile={st => setProfileModalStudent(st)}
            onRefresh={loadData}
          />
        )}

        {activeTab === "students" && (
          <div className="p-4 space-y-4 text-right">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-[#0F2A4A]">قائمة الطلاب ({students.length})</h2>
            </div>
            <div className="space-y-2">
              {students.map(st => (
                <div
                  key={st.id}
                  onClick={() => setProfileModalStudent(st)}
                  className="classy-card p-4 flex items-center justify-between cursor-pointer hover:border-slate-300 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#0F2A4A] font-bold flex items-center justify-center">
                      {st.name.slice(0, 1)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-800">{st.name}</h3>
                      <p className="text-xs text-slate-400">{st.phone || "بدون رقم"}</p>
                    </div>
                  </div>
                  <AppIcon name="chevronEnd" size={16} className="text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <SettingsScreen onRefresh={loadData} />
        )}

        {activeTab === "verify" && (
          <div className="p-4 space-y-4 text-right">
            <div className="classy-card p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-black text-[#0F2A4A]">اختبارات التحقق التلقائية (TASK 23)</h2>
                  <p className="text-xs text-slate-500">فحص حماية التكرار، والحدود القصوى، وأداة التطهير</p>
                </div>
                <button
                  onClick={handleRunE2E}
                  disabled={isRunningVerification}
                  className="px-4 py-2 bg-[#0F2A4A] text-white rounded-xl text-xs font-bold hover:bg-[#17375E] transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <AppIcon name="refresh" size={14} />
                  <span>{isRunningVerification ? "جاري الفحص..." : "تشغيل الفحص الآن"}</span>
                </button>
              </div>

              {verificationResults.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  اضغط على زر &quot;تشغيل الفحص الآن&quot; لاختبار كافة مسارات TASK 23 والتأكد من منع التكرار.
                </p>
              ) : (
                <div className="space-y-3">
                  {verificationResults.map(res => (
                    <div
                      key={res.step}
                      className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                        res.passed 
                          ? "bg-emerald-50/70 border-emerald-200 text-emerald-900" 
                          : "bg-rose-50 border-rose-200 text-rose-900"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5">
                          <AppIcon name={res.passed ? "checkCircle" : "alert"} size={16} />
                          <span>الخطوة {res.step}: {res.name}</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          res.passed ? "bg-emerald-200/80 text-emerald-900" : "bg-rose-200 text-rose-900"
                        }`}>
                          {res.passed ? "نجاح (PASSED)" : "فشل (FAILED)"}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90">{res.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 px-6 py-2.5 flex justify-around items-center z-40 shadow-lg">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${
            activeTab === "dashboard" ? "text-[#0F2A4A]" : "text-slate-400"
          }`}
        >
          <AppIcon name="calendar" size={20} weight={activeTab === "dashboard" ? "fill" : "regular"} />
          <span>الرئيسية</span>
        </button>

        <button
          onClick={() => setActiveTab("students")}
          className={`flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${
            activeTab === "students" ? "text-[#0F2A4A]" : "text-slate-400"
          }`}
        >
          <AppIcon name="students" size={20} weight={activeTab === "students" ? "fill" : "regular"} />
          <span>الطلاب</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex flex-col items-center gap-1 text-[11px] font-bold transition-all ${
            activeTab === "settings" ? "text-[#0F2A4A]" : "text-slate-400"
          }`}
        >
          <AppIcon name="settings" size={20} weight={activeTab === "settings" ? "fill" : "regular"} />
          <span>الإعدادات</span>
        </button>
      </nav>

      {/* Modals */}
      <BulkAddSessionModal
        isOpen={isBulkAddOpen}
        onClose={() => setIsBulkAddOpen(false)}
        students={students}
        groups={groups}
        onSuccess={loadData}
      />

      <RecordAttendanceModal
        isOpen={!!attendanceModalGroup}
        onClose={() => setAttendanceModalGroup(null)}
        group={attendanceModalGroup}
        students={students}
        onSuccess={loadData}
      />

      <RecordPrivateSessionModal
        isOpen={!!privateModalStudent}
        onClose={() => setPrivateModalStudent(null)}
        student={privateModalStudent}
        onSuccess={loadData}
      />

      <StudentProfileModal
        isOpen={!!profileModalStudent}
        onClose={() => setProfileModalStudent(null)}
        student={profileModalStudent}
        onUpdated={loadData}
      />
    </div>
  </ModalProvider>
);
};
