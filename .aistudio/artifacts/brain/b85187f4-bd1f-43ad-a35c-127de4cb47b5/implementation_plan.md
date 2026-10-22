# Advance Scheduling for Private Students

Extend Classy's existing "Schedule Upcoming Session" modal to support advance single-occurrence scheduling for individual private students, strictly isolated by date and preserved within the existing Classy visual design.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design decisions were confirmed during interactive clarification and govern the implementation:

- **Confirmed Mode Switch UI**: Radio cards with icon badges placed at the top of the scheduling modal (`AddEditSessionModal`) to smoothly toggle between **Group Session** (مجموعة دراسية) and **Private Session** (درس خاص).
- **Confirmed Student Selection Flow**: In Private Session mode, students with active private enrollments appear first, accompanied by a clean search input (by student name or phone) and full support for student avatars with their achievement frames.
- **Strict Date Isolation**: A scheduled private appointment is tied to an exact date (`YYYY-MM-DD`) and start time. It will appear on the Dashboard agenda *only* when that date is the active date, on the calendar *only* on that date, and will *not* produce unwanted recurring appointments or duplicate entries.
- **Tap Routing**: Tapping the private session opens the existing private session intake studio (`PrivateClassIntakeModal`), preserving private lesson units, duration, and billing without opening group attendance.

---

## 1. Overview & Core Concept

- **What It Does**: Teachers can schedule an individual private student's upcoming lesson in advance for any future date and time directly from the existing scheduling workflow.
- **Target Audience**: Teachers conducting one-on-one tutoring or private sessions alongside or independently of regular group batches.
- **Key Value**: Eliminates the limitation where scheduling was group-only, allowing teachers to plan ahead for private students on specific dates without pseudo-groups or manual workarounds.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Opening Schedule Modal**:
   - The user opens "Schedule Upcoming Session" (جدولة حصة قادمة) from the Dashboard, Calendar (`SessionsView`), or FAB Quick Add Sheet.
2. **Selecting Session Type**:
   - Two radio cards are presented at the top:
     - **Group Session (مجموعة)**: Icon with users/book, shows existing group picker.
     - **Private Session (درس خاص)**: Icon with user/sparkles, shows individual student selector.
3. **Selecting Private Student**:
   - Live search input allows quick filtering by student name or phone number.
   - List prioritizes students with active private lessons (badged), with full display of the student's name, grade level, avatar color, photo, and achievement frame (Gold, Platinum, Star, etc.).
   - Selecting a student automatically presets the lesson title (e.g., "درس خاص - [اسم الطالب]"), subject, and default pricing/hourly rate from their private enrollment or profile.
4. **Setting Appointment Date & Time**:
   - Date picker (defaulting to the selected date or today) and time picker.
   - Duration / hours selection and price per session.
   - Optional location (e.g. Student's Home, Center, Online) and notes.
5. **Saving & Feedback**:
   - Saves a canonical `Session` with `studentId: selectedStudent.id` and `groupId: ''` (or student's private group if applicable) without creating any fake groups or altering group membership.
   - Modal closes with instant feedback; the appointment appears in the calendar for the chosen date.

### Visual Styling & Anti-Slop Restraint

- **Radio Cards**: Two equal-width selectable cards with 1px border (`border-line`), active state highlighted with `#0F2A4A` border, subtle background tint, and single-line labels with icon badges.
- **Student Tile**: Compact item layout ($48\text{px}$ height) featuring `StudentAvatar` with achievement frame, student name, and quiet metadata text (`·` separators) indicating stage or subject.
- **Zero Layout Shift**: Seamless transition when switching between Group and Private modes without breaking form geometry or button contracts.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Student Association without Pseudo-Groups**
  - *Chosen Approach*: Save the `Session` record with `studentId = student.id`, `groupId = ''`, and `enrollmentId = privateEnrollment?.id`.
  - *Why*: Strict requirement: private students must never have dummy groups created or appear in group attendance lists.
  - *Alternatives Considered*: Creating 1-student "private groups" was rejected as it corrupts group analytics and violates data isolation.

- **Decision 2: Strict Date Bound (No Unintended Recurrence)**
  - *Chosen Approach*: Persist the appointment as a discrete single `Session` record with `status: 'scheduled'` and explicit `date: YYYY-MM-DD`.
  - *Why*: Recurring slots in Classy are generated via `scheduleDays` arrays. By saving an explicit session record without modifying the student's recurring `scheduleDays`, the session exists strictly on the selected date.

- **Decision 3: Non-Mutating Aggregation in Dashboard & Calendar**
  - *Chosen Approach*: Utilize existing deterministic matching keys in `findSessionForScheduleItem` and `getDetailedAgendaForDate`.
  - *Why*: Prevents creating duplicate records during render passes or app reopens.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│                   AddEditSessionModal                   │
│                                                        │
│  [ Radio: Group Session ]   [ Radio: Private Session ] │
│                             ┌────────────────────────┐ │
│                             │ Student Search & List  │ │
│                             │ (Avatar + Frame)       │ │
│                             └────────────────────────┘ │
│  [ Date: YYYY-MM-DD ]       [ Time: HH:MM ]            │
│  [ Duration / Hours ]       [ Notes & Location ]       │
└───────────────────────────┬────────────────────────────┘
                            │
               db.saveSession(savedSession)
                            │
                            ▼
               ┌────────────────────────┐
               │    Canonical Session   │
               │  - id: ses_...         │
               │  - studentId: stu_...  │
               │  - groupId: ''         │
               │  - date: 2026-10-25    │
               │  - status: 'scheduled' │
               └────────────┬───────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│     Dashboard (todayStr)      │   │    Calendar / SessionsView    │
│  - Appears ONLY if            │   │  - Appears in Agenda on       │
│    session.date === todayStr  │   │    selected date (2026-10-25) │
│  - Tap -> PrivateClassIntake  │   │  - Dot on 2026-10-25 in grid  │
└───────────────────────────────┘   └───────────────────────────────┘
```

### Component & State Mapping

1. **`src/components/AddEditSessionModal.tsx`**:
   - Accept `allStudents: Student[]` prop.
   - Add state `sessionType: 'group' | 'private'`.
   - Add state `selectedStudentId: string` and `studentSearchQuery: string`.
   - Memoize private student candidates: prioritizes students who have an enrollment where `serviceType === 'private'` or `!groupId`, followed by all other active students.
   - In private mode, validate that `selectedStudentId` is chosen before submit.
   - On submit, construct `savedSession` with `studentId: selectedStudentId`, `groupId: ''`, and associated private enrollment ID if present.
2. **`src/App.tsx`**:
   - Pass `allStudents={students}` to `AddEditSessionModal`.
3. **`src/utils/schedule.ts`**:
   - In `getUpcomingClassesForStudent(studentId, ...)`: include scheduled `Session` objects where `s.studentId === studentId && s.status === 'scheduled' && s.date >= todayStr` so advance scheduled sessions appear in the student profile upcoming timeline.
4. **Verification**:
   - Run type checks (`tsc --noEmit`) and Vite compilation (`npm run build`).
   - Validate scenarios: future date appearance, absence on earlier dates, duplicate prevention, and private intake modal tap behavior.
