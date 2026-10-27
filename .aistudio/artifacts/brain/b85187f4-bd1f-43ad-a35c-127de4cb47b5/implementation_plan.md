# Classy — Smooth Startup, Live Swipe Tracking & Instant Modals

Eliminate launch bottlenecks, tab-switching hesitation, and profile/modal opening lag across Classy while preserving 100% of its Harbor Mint visual identity, 2.2-second animated splash screen, billing accuracy, and Arabic RTL / English LTR behavior.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product and UX decisions were confirmed during interactive clarification and govern this optimization plan:

- **Focused Bottleneck Targets**: Prioritize startup responsiveness around the splash screen, effortless bottom-tab switching, and instant opening of student profiles, group dossiers, and action modals.
- **2.2-Second Animated Splash Preserved**: Keep the signature 2.2-second animated splash screen (and its Skip control) intact on launch, while transforming that 2.2-second window into a background pre-warming phase so views, modals, and financial summaries are ready before the splash fades out.
- **Live Finger-Tracking Tab Swipes**: Upgrade horizontal tab gestures so the current and incoming pages track the user's finger smoothly in real time and settle cleanly into place without visual jumps, strictly preserving the approved swipe-to-tab direction mapping and non-wrapping outer boundaries.
- **Strict Current Version Lock**: Maintain every existing screen, workflow, Harbor Mint color/typography token, attendance studio, financial rule, and cloud sync capability without redesigning the interface.

---

## 1. Overview & Core Concept

- **What It Does**: Re-engineers Classy's startup pipeline, client-side data/financial caching, tab-stage gesture physics, and modal rendering lifecycle so every tap, swipe, and sheet reveal responds within a single frame.
- **Target Audience / Persona**: Tutors and teachers managing live classes, student rosters, attendance, and payments one-handed on mobile devices (60 Hz and 120 Hz Android/mobile displays as well as desktop browsers).
- **Key Value**: Removes cold-bundle delays before the splash screen paints, eliminates repeated synchronous storage parsing and unnecessary background-tab re-renders, makes horizontal swipes feel physically connected to the thumb, and opens heavy student/group profiles without frame drops.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Instant Cold Paint & Smart Pre-Warming During the 2.2s Splash**:
   - On launch, only the lightweight core shell, animated Splash Screen, and initial Dashboard are needed for first paint, allowing the 2.2-second animated splash to appear immediately and animate at full refresh rate without main-thread contention.
   - While the 2.2-second splash animation plays, idle background tasks progressively preload secondary tab modules, heavy profile/attendance modals, and indexed student/group financial caches in tiny non-blocking slices.
   - When the 2.2-second splash completes (or when the user taps **Skip**), the Dashboard and adjacent tabs are already warm—eliminating the post-splash "first tap freeze."
2. **Live Finger-Tracking Horizontal Tab Navigation**:
   - **Dragging**: When swiping horizontally across the main stage (outside 24px OS edge-back zones, inputs, and horizontal carousels), the active tab and the destination neighbor tab move together in lockstep with the user's finger:
     - *Swipe Left → Right*: Tracks toward the page visually on the **left** (previous in LTR, next in RTL).
     - *Swipe Right → Left*: Tracks toward the page visually on the **right** (next in LTR, previous in RTL).
     - *Outer Tab Boundaries*: At the first or last tab, swiping past the boundary never wraps around; instead, subtle rubber-band resistance (`≤ 18px`) signals the boundary and glides smoothly back on release.
   - **Releasing & Settling**: If distance (`≥ 64px`) or flick velocity (`≥ 0.42 px/ms`) commits the swipe, both panels animate smoothly from their exact release offset into their final position (`140–175ms`) while the Bottom Navigation Bar updates immediately. If cancelled, the stage glides smoothly back to origin (`150ms`) with zero flicker or content jump.
3. **Instant Tab Taps & Preserved Context**:
   - Tapping any item in the Bottom Navigation Bar performs a crisp `150ms` directional slide-and-fade transition while preserving each tab's scroll position, active filters, and search state.
   - On the Reports tab, animated summary counters update inside isolated leaf elements so number count-up animations no longer re-render charts and payment tables on every frame.
4. **Zero-Lag Profile Dossiers & Action Modals**:
   - Tapping a Student card, Group card, or Session Attendance studio opens the detail sheet immediately at full frame rate (`150ms` slide-and-fade).
   - The dossier header, avatar/frame, primary summary cards, and active sub-tab appear on Frame 1 using cached O(1) financial and relation lookups, while long historical logs hydrate smoothly on the next frame without stalling the entrance animation.

### Visual Identity & Theme (Strict Preservation)

- **Aesthetic Direction**: Preserves Classy's **Harbor Mint** mobile-first design language—clean white canvas, soft mint structural surfaces, deep navy authority headers, and focused orange primary actions.
- **Color Palette & Mood**: Existing semantic tokens remain untouched (`--color-page: #FFFFFF`, `--color-mist: #F1F7F7`, `--color-mint: #B9DAD6`, `--color-mint-soft: #DCEDEB`, `--color-navy: #17375E`, `--color-navy-deep: #0F2A4A`, `--color-orange: #F5A04A`, `--color-teal: #2E8B83`, `--color-coral: #D64545`, `--color-line: #E1EBEC`).
- **Typography & Hierarchy**: Existing **Poppins** (English LTR) and **Cairo** (Arabic RTL) pairing with `tabular-nums` alignment on financial figures and compact single-line navigation controls.
- **Mobile Ergonomics & Touch Discipline**: Maintains `≥ 44×44px` interactive hitboxes, thumb-zone anchored Bottom Navigation Bar + Quick Add trigger, solid translucent modal scrims (avoiding GPU-expensive full-screen backdrop blurs), and compact sticky headers.

### Interactive Feedback & Motion

- **Compositor-Only Motion**: Every gesture, tab transition, and sheet animation exclusively mutates `transform` (`translate3d`, `scale3d`) and `opacity`—never layout geometry (`width`, `height`, `top`, `left`, `margin`).
- **Settling Curves & Timings**:
  - Live swipe tracking: `0ms` direct DOM transform during touch move; `140–175ms cubic-bezier(0.2, 0, 0, 1)` momentum-matched settle on release.
  - Direct tab tap transitions: `150ms cubic-bezier(0.2, 0, 0, 1)`.
  - Detail dossiers & bottom sheets: `150ms cubic-bezier(0.2, 0, 0, 1)` enter and exit.
- **Accessibility (`prefers-reduced-motion`)**: Automatically disables decorative slide offsets and live drag translation when system reduced motion is enabled, keeping navigation instant and accessible.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Code-Splitting Combined with Splash-Window Pre-Warming**
  - *Chosen Approach*: Split secondary views, chart visualizations, and heavy modals out of the synchronous boot bundle, then proactively preload them during idle frames inside the 2.2-second animated splash window.
  - *Why*: Shrinks initial JavaScript parse/compile time so the splash screen appears faster and animates smoothly, while ensuring zero network/parse delay when the user switches tabs or opens a profile after launch.
  - *Alternatives Considered*: Lazy-loading purely on click without pre-warming was rejected because the first tap on Reports or a Student Profile would briefly wait on chunk evaluation.

- **Decision 2: Versioned In-Memory Entity & Financial Cache with Immutable Reference Sharing**
  - *Chosen Approach*: Maintain an in-memory cache of parsed collections, O(1) relational lookup maps (by student, group, and session ID), and computed student/group financial summaries keyed by a lightweight data-revision counter—invalidating only the affected slices when data is saved or synced.
  - *Why*: Previously, reading students or groups allocated fresh object instances on every read and re-ran hundreds of storage lookups inside per-student financial loops, causing every data refresh to invalidate memoized background tabs. Reference-stable reads keep inactive tabs completely idle (`0` re-renders) and make opening profiles near-instant.
  - *Alternatives Considered*: Introducing an external state-management library was rejected to keep the bundle lean and avoid refactoring existing business logic.

- **Decision 3: Direct DOM Dual-Panel Swipe Engine (Zero React Renders During Touch Move)**
  - *Chosen Approach*: Drive horizontal finger tracking directly on the stage's active panel and target neighbor panel via DOM `translate3d` styles during `touchmove`, committing React tab state only once when the gesture finishes settling.
  - *Why*: Updating React state on every touch frame would re-reconcile large component trees at 60–120 Hz and cause stutter. Direct compositor transforms guarantee locked-to-finger fluidity and eliminate the visual jump that occurred when snapping from a capped `40px` preview back to `0px` on release.
  - *Alternatives Considered*: Heavy third-party gesture/carousel libraries were rejected per performance constraints and to preserve exact RTL/LTR and Android edge-back rules.

- **Decision 4: Two-Phase Priority Mounting Inside Heavy Dossiers & Modals**
  - *Chosen Approach*: Render the modal chrome, hero identity card, primary KPI balances, and active sub-tab shell immediately on open, while deferring below-the-fold historical timelines and secondary sub-tab lists by one animation frame (`requestAnimationFrame`) and deferring search filtering via `useDeferredValue`.
  - *Why*: Guarantees the `150ms` modal slide-in begins on the very next display frame without main-thread jank, even for students or groups with hundreds of attendance and payment records.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    Cold Boot & 2.2s Animated Splash                       │
│  [ Minimal Boot Shell ] ──► Paints Splash Immediately (60/120 Hz)         │
│  [ Idle Pre-Warmer ]    ──► Loads Secondary Tabs + Modals + Data Indexes  │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│              Versioned In-Memory Store & Financial Cache                  │
│  • Reference-stable collections (Students, Groups, Sessions, Payments)    │
│  • O(1) Relational Indexes (by StudentId, GroupId, SessionId)             │
│  • Revision-keyed Financial Summary Cache (Student & Group Balances)      │
│  • Non-blocking Local Persistence + Background Cloud Sync                 │
└───────────────┬───────────────────────────────────────────┬───────────────┘
                │                                           │
                ▼                                           ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────┐
│     Application Shell & Tab Stage     │   │   Lazy + Pre-Warmed Modals    │
│                                       │   │                               │
│  ┌─────────────────────────────────┐  │   │  • Student Profile Dossier    │
│  │  Dual-Panel Live Swipe Engine   │  │   │  • Group Profile Dossier      │
│  │  • 1:1 Finger Tracking (DOM)    │  │   │  • Record Attendance Studio   │
│  │  • Boundary Rubber-Band Guard   │  │   │  • Add/Edit & Payment Sheets  │
│  │  • Velocity-Matched Settle      │  │   │                               │
│  └────────────────┬────────────────┘  │   │  [Frame 1: Shell + Cached KPI]│
│                   ▼                   │   │  [Frame 2: History Timeline]  │
│  ┌─────────────────────────────────┐  │   └───────────────────────────────┘
│  │ Memoized Isolated Tab Panels    │  │
│  │ • Dashboard   • Sessions        │  │
│  │ • Reports*    • Students/Groups │  │
│  │ (*Isolated Leaf Metric Counter) │  │
│  └────────────────┬────────────────┘  │
│                   ▼                   │
│  [ Synchronized Bottom Nav Bar ]      │
└───────────────────────────────────────┘
```

### Data Model & State

- **Reference-Stable Entity Snapshots**: Each core collection (`students`, `groups`, `sessions`, `enrollments`, `attendance`, `payments`, `teacherProfile`) is cached in memory per active teacher account. Reads return the exact same array and item references until a write or cloud sync mutates that specific collection.
- **O(1) Relational Lookup Indexes**: Derived `Map` indexes (`sessionsById`, `attendanceByStudentId`, `attendanceBySessionId`, `enrollmentsByStudentId`, `enrollmentsByGroupId`, `paymentsByStudentId`) rebuild lazily only when their underlying collection revision increments—eliminating nested `.find()` / `.filter()` scans across views and modals.
- **Memoized Financial Calculations**: Student and group financial summaries cache against a composite revision token (`enrollmentsRev + sessionsRev + attendanceRev + paymentsRev + creditLogsRev`). Opening a Student Profile or Group Profile reuses the warm calculation instantaneously.

### Interactive Component & State Mapping

- **Splash Screen & Idle Pre-Warmer**:
  - Preserves `2200ms` auto-dismiss duration and manual **Skip** handler.
  - Schedules staggered idle callbacks (`requestIdleCallback` with `setTimeout` fallback) to import lazy tab/modal chunks and warm the active tab's neighbor panels without blocking touch or animation frames.
- **Dual-Panel Swipe & Tab Stage**:
  - `touchstart`: Validates single-touch, excludes 24px viewport edges, active modals/dialogs, Settings view, text selections, inputs, and horizontal scrollers; resolves RTL/LTR direction.
  - `touchmove`: Locks to horizontal (`absX >= absY * 1.35`) or vertical scroll. On horizontal lock, reveals the target neighbor panel (if within tab boundaries) and updates `translate3d` offsets directly on both panel elements with zero React state updates. At outer tab boundaries, applies gentle `≤ 18px` resistance without wrapping.
  - `touchend` / `touchcancel`: Evaluates distance and flick velocity. On commit, animates both panels from their current pixel offset to completion (`0px` for incoming, `±width` for outgoing), triggers light haptic feedback, updates the active tab and Bottom Navigation Bar once, and resets inline styles cleanly. On cancel, animates smoothly back to `0px` and re-hides the neighbor panel.
- **Memoized Tab Panels & Views**:
  - Each `TabPanel` is memoized so motion classes and active flags update only on the leaving and entering tabs; uninvolved tabs perform zero DOM or React work.
  - Search inputs in large student/session views use deferred filtering (`useDeferredValue`) so typing stays crisp while lists filter smoothly.
  - Animated KPI numbers in Reports run inside an isolated leaf component so count-up frames never re-render charts or transaction lists.
- **Profile Dossiers & Bottom Sheets**:
  - Tapping a student, group, or attendance card immediately opens the `BottomSheet` using pre-warmed component code and O(1) cached financial/attendance maps, rendering long secondary history lists after the initial sheet entrance frame begins.
  - Closing a sheet runs the `150ms` directional exit animation while keeping background scroll position and selection state untouched.

### Key Sequences & Integrations

- **Local-First Saves & Non-Blocking Cloud Sync**: Recording attendance, adding payments, or editing students writes synchronously to the in-memory cache + local storage (updating only the mutated collection revisions) and dispatches existing Firestore/server cloud sync asynchronously in the background—never delaying modal close or navigation transitions.
- **Zero Schema or Security Rule Changes**: All persistence keys, account packages, sync endpoints, and Firestore data shapes remain 100% unchanged and backward-compatible with existing user data.
