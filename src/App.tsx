import React, { useState, useEffect, useCallback } from 'react';
import { ActiveTab, Student, Group, Session, Payment, TeacherProfile, UserAccount } from './types';
import { db } from './utils/storage';

// Mobile UI components
import { AndroidStatusBar } from './components/AndroidStatusBar';
import { BottomNavBar } from './components/BottomNavBar';
import { AuthView } from './components/AuthView';

// Main Views
import { DashboardView } from './components/DashboardView';
import { StudentsView } from './components/StudentsView';
import { GroupsView } from './components/GroupsView';
import { SessionsView } from './components/SessionsView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';

// Modals
import { AddEditStudentModal } from './components/AddEditStudentModal';
import { AddEditGroupModal } from './components/AddEditGroupModal';
import { AddEditSessionModal } from './components/AddEditSessionModal';
import { EnrollExistingStudentModal } from './components/EnrollExistingStudentModal';
import { StudentProfileModal } from './components/StudentProfileModal';
import { GroupProfileModal } from './components/GroupProfileModal';
import { RecordAttendanceModal } from './components/RecordAttendanceModal';
import { AddPaymentModal } from './components/AddPaymentModal';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => db.getCurrentSession());

  // Database Data States
  const [students, setStudents] = useState<Student[]>(() => db.getStudents());
  const [groups, setGroups] = useState<Group[]>(() => db.getGroups());
  const [sessions, setSessions] = useState<Session[]>(() => db.getSessions());
  const [payments, setPayments] = useState<Payment[]>(() => db.getPayments());
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile>(() => db.getTeacherProfile());

  // Function to refresh state from database
  const refreshData = useCallback(() => {
    setStudents(db.getStudents());
    setGroups(db.getGroups());
    setSessions(db.getSessions());
    setPayments(db.getPayments());
    setTeacherProfile(db.getTeacherProfile());
  }, []);

  // Auth Handlers
  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
    refreshData();
  };

  const handleLogout = () => {
    db.logout();
    setCurrentUser(null);
  };

  // Modals state
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [sessionDefaultGroupId, setSessionDefaultGroupId] = useState<string | undefined>(undefined);

  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [targetStudentForPayment, setTargetStudentForPayment] = useState<Student | null>(null);
  const [targetEnrollmentIdForPayment, setTargetEnrollmentIdForPayment] = useState<string | undefined>(undefined);

  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollTargetStudent, setEnrollTargetStudent] = useState<Student | null>(null);
  const [enrollTargetGroup, setEnrollTargetGroup] = useState<Group | null>(null);

  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);
  const [selectedGroupForProfile, setSelectedGroupForProfile] = useState<Group | null>(null);
  const [selectedSessionForAttendance, setSelectedSessionForAttendance] = useState<Session | null>(null);

  // Sync profile data if updated
  useEffect(() => {
    if (selectedStudentForProfile) {
      const refreshed = students.find((s) => s.id === selectedStudentForProfile.id);
      setSelectedStudentForProfile(refreshed || null);
    }
  }, [students]);

  useEffect(() => {
    if (selectedGroupForProfile) {
      const refreshed = groups.find((g) => g.id === selectedGroupForProfile.id);
      setSelectedGroupForProfile(refreshed || null);
    }
  }, [groups]);

  // Handlers for Add/Edit
  const handleOpenAddStudent = () => {
    setEditingStudent(null);
    setIsAddStudentOpen(true);
  };

  const handleOpenEditStudent = (student: Student) => {
    setEditingStudent(student);
    setIsAddStudentOpen(true);
  };

  const handleOpenAddGroup = () => {
    setEditingGroup(null);
    setIsAddGroupOpen(true);
  };

  const handleOpenEditGroup = (group: Group) => {
    setEditingGroup(group);
    setIsAddGroupOpen(true);
  };

  const handleOpenAddSession = (defaultGroupId?: string) => {
    setEditingSession(null);
    setSessionDefaultGroupId(defaultGroupId || groups[0]?.id);
    setIsAddSessionOpen(true);
  };

  const handleOpenEditSession = (session: Session) => {
    setEditingSession(session);
    setSessionDefaultGroupId(session.groupId);
    setIsAddSessionOpen(true);
  };

  const handleOpenAddPayment = (student?: Student, enrollmentId?: string) => {
    setTargetStudentForPayment(student || null);
    setTargetEnrollmentIdForPayment(enrollmentId);
    setIsAddPaymentOpen(true);
  };

  const handleOpenEnrollForStudent = (student: Student) => {
    setEnrollTargetStudent(student);
    setEnrollTargetGroup(null);
    setIsEnrollModalOpen(true);
  };

  const handleOpenEnrollForGroup = (group: Group) => {
    setEnrollTargetStudent(null);
    setEnrollTargetGroup(group);
    setIsEnrollModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F0EBE1] flex items-center justify-center p-0 md:p-4 lg:p-6 select-none font-sans text-[#434B3E]" dir="rtl">
      
      {/* Android Mobile Frame */}
      <div className="relative w-full md:max-w-[440px] h-[100dvh] md:h-[880px] md:max-h-[94vh] bg-[#F9F7F2] md:rounded-[44px] md:border-[8px] md:border-[#E8E2D6] md:ring-1 md:ring-[#D6CDC2] flex flex-col overflow-hidden shadow-2xl text-[#434B3E]">
        
        {/* Android Punch-hole Camera */}
        <div className="hidden md:block absolute top-3 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-[#2D332A] border border-[#E8E2D6] z-50 pointer-events-none shadow-inner" />

        {/* 1. Android Status Bar */}
        <AndroidStatusBar />

        {/* 2. Main Screen Body */}
        <main className="flex-1 flex flex-col overflow-hidden relative bg-[#F9F7F2]">
          
          {!currentUser ? (
            <AuthView onLoginSuccess={handleLoginSuccess} />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  students={students}
                  groups={groups}
                  sessions={sessions}
                  payments={payments}
                  teacherProfile={teacherProfile}
                  onOpenAddStudent={handleOpenAddStudent}
                  onOpenAddGroup={handleOpenAddGroup}
                  onOpenAddSession={handleOpenAddSession}
                  onOpenAddPayment={() => handleOpenAddPayment()}
                  onOpenStudentProfile={(s) => setSelectedStudentForProfile(s)}
                  onOpenGroupProfile={(g) => setSelectedGroupForProfile(g)}
                  onOpenAttendanceModal={(ses) => setSelectedSessionForAttendance(ses)}
                  onNavigateToTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'students' && (
                <StudentsView
                  students={students}
                  groups={groups}
                  onOpenAddStudent={handleOpenAddStudent}
                  onOpenStudentProfile={(s) => setSelectedStudentForProfile(s)}
                />
              )}

              {activeTab === 'groups' && (
                <GroupsView
                  groups={groups}
                  allStudents={students}
                  onOpenAddGroup={handleOpenAddGroup}
                  onOpenGroupProfile={(g) => setSelectedGroupForProfile(g)}
                />
              )}

              {activeTab === 'sessions' && (
                <SessionsView
                  sessions={sessions}
                  groups={groups}
                  onOpenAddSession={handleOpenAddSession}
                  onEditSession={handleOpenEditSession}
                  onOpenAttendanceModal={(ses) => setSelectedSessionForAttendance(ses)}
                  onSessionDeleted={refreshData}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  students={students}
                  groups={groups}
                  sessions={sessions}
                  payments={payments}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  teacherProfile={teacherProfile}
                  currentUser={currentUser}
                  onProfileUpdated={(p) => {
                    setTeacherProfile(p);
                    refreshData();
                  }}
                  onDataReset={refreshData}
                  onLogout={handleLogout}
                />
              )}
            </>
          )}

        </main>

        {/* 3. Android Bottom Navigation Bar (Visible only when logged in) */}
        {currentUser && (
          <BottomNavBar
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab)}
          />
        )}

        {/* --- MODALS --- */}

        {/* Add/Edit Student Modal */}
        <AddEditStudentModal
          isOpen={isAddStudentOpen}
          onClose={() => setIsAddStudentOpen(false)}
          editingStudent={editingStudent}
          allGroups={groups}
          onSaveComplete={() => {
            refreshData();
          }}
        />

        {/* Add/Edit Group Modal */}
        <AddEditGroupModal
          isOpen={isAddGroupOpen}
          onClose={() => setIsAddGroupOpen(false)}
          editingGroup={editingGroup}
          onSaveComplete={() => {
            refreshData();
          }}
        />

        {/* Add/Edit Session Modal */}
        <AddEditSessionModal
          isOpen={isAddSessionOpen}
          onClose={() => setIsAddSessionOpen(false)}
          editingSession={editingSession}
          defaultGroupId={sessionDefaultGroupId}
          allGroups={groups}
          onSaveComplete={() => {
            refreshData();
          }}
        />

        {/* Enroll Existing Student into Group Modal */}
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

        {/* Student Dossier / Profile Modal */}
        <StudentProfileModal
          isOpen={!!selectedStudentForProfile}
          onClose={() => setSelectedStudentForProfile(null)}
          student={selectedStudentForProfile}
          allGroups={groups}
          onEditStudent={(st) => handleOpenEditStudent(st)}
          onOpenEnrollModal={(st) => handleOpenEnrollForStudent(st)}
          onOpenAddPayment={(st, enrId) => handleOpenAddPayment(st, enrId)}
          onDataChanged={refreshData}
        />

        {/* Group Dossier / Profile Modal */}
        <GroupProfileModal
          isOpen={!!selectedGroupForProfile}
          onClose={() => setSelectedGroupForProfile(null)}
          group={selectedGroupForProfile}
          onEditGroup={(grp) => handleOpenEditGroup(grp)}
          onAddExistingStudent={(grp) => handleOpenEnrollForGroup(grp)}
          onAddNewStudentToGroup={(grp) => {
            handleOpenAddStudent();
          }}
          onAddSessionForGroup={(grp) => handleOpenAddSession(grp.id)}
          onOpenAttendanceModal={(ses) => setSelectedSessionForAttendance(ses)}
          onOpenStudentProfile={(st) => setSelectedStudentForProfile(st)}
          onDataChanged={refreshData}
        />

        {/* Record Attendance Modal */}
        <RecordAttendanceModal
          isOpen={!!selectedSessionForAttendance}
          onClose={() => setSelectedSessionForAttendance(null)}
          session={selectedSessionForAttendance}
          onSaveComplete={refreshData}
        />

        {/* Add Payment Modal */}
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

      </div>
    </div>
  );
}
