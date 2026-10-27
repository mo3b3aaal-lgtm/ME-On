import { useCallback, useSyncExternalStore } from 'react';
import { db } from './storage';
import { toLocalISODate } from './localDate';
import type { Group, Student } from '../types';

export type TutorialChapterId =
  | 'getting_started'
  | 'students'
  | 'groups'
  | 'sessions_attendance'
  | 'billing_payments'
  | 'reports_analytics'
  | 'settings_sync';

export type TutorialStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

export type TutorialRunScope = 'full' | 'single_chapter';

export interface TutorialPersistedState {
  version: 1;
  userId: string;
  firstLoginPromptHandled: boolean;
  status: TutorialStatus;
  runScope: TutorialRunScope;
  activeChapterId: TutorialChapterId;
  activeStepIndex: number;
  completedChapterIds: TutorialChapterId[];
  completedStepIds: string[];
  skippedStepIds: string[];
  practiceStudentIds: string[];
  practiceGroupIds: string[];
  startedAt?: string;
  completedAt?: string;
  dismissedAt?: string;
  updatedAt: string;
}

export interface TutorialRuntimeUIState {
  /** Whether the live spotlight tour is actively running in this browser session */
  isTourActive: boolean;
  /** Whether the Chapter Picker Hub modal is open */
  isChapterHubOpen: boolean;
  /** Whether the Tour Completion summary modal is open */
  isCompletionModalOpen: boolean;
  /** Whether the mid-tour interruption recovery prompt has been dismissed/resolved in this session */
  resumePromptHandledSessionForUser: string | null;
}

export const PRACTICE_TAG_AR = '[تجريبي]';
export const PRACTICE_TAG_EN = '[Practice]';

const STORAGE_KEY_PREFIX = 'tm_v2_tutorial_state_';

const ALL_CHAPTER_IDS: readonly TutorialChapterId[] = [
  'getting_started',
  'students',
  'groups',
  'sessions_attendance',
  'billing_payments',
  'reports_analytics',
  'settings_sync',
] as const;

function normalizeUserId(userId?: string | null): string {
  const trimmed = (userId || '').trim();
  return trimmed || 'acc_master_teacher';
}

export function getTutorialStorageKey(userId?: string | null): string {
  return `${STORAGE_KEY_PREFIX}${normalizeUserId(userId)}`;
}

function createDefaultPersistedState(userId?: string | null): TutorialPersistedState {
  const uid = normalizeUserId(userId);
  return {
    version: 1,
    userId: uid,
    firstLoginPromptHandled: false,
    status: 'not_started',
    runScope: 'full',
    activeChapterId: 'getting_started',
    activeStepIndex: 0,
    completedChapterIds: [],
    completedStepIds: [],
    skippedStepIds: [],
    practiceStudentIds: [],
    practiceGroupIds: [],
    updatedAt: new Date().toISOString(),
  };
}

function isValidChapterId(val: unknown): val is TutorialChapterId {
  return typeof val === 'string' && (ALL_CHAPTER_IDS as readonly string[]).includes(val);
}

function sanitizeStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of val) {
    if (typeof item === 'string' && item.trim() && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function sanitizeChapterArray(val: unknown): TutorialChapterId[] {
  if (!Array.isArray(val)) return [];
  const seen = new Set<TutorialChapterId>();
  const out: TutorialChapterId[] = [];
  for (const item of val) {
    if (isValidChapterId(item) && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function parsePersistedState(raw: string | null, userId?: string | null): TutorialPersistedState {
  const fallback = createDefaultPersistedState(userId);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<TutorialPersistedState>;
    if (!parsed || typeof parsed !== 'object') return fallback;

    const status: TutorialStatus =
      parsed.status === 'in_progress' ||
      parsed.status === 'completed' ||
      parsed.status === 'dismissed' ||
      parsed.status === 'not_started'
        ? parsed.status
        : 'not_started';

    const runScope: TutorialRunScope =
      parsed.runScope === 'single_chapter' ? 'single_chapter' : 'full';

    const activeChapterId: TutorialChapterId = isValidChapterId(parsed.activeChapterId)
      ? parsed.activeChapterId
      : 'getting_started';

    const activeStepIndex =
      typeof parsed.activeStepIndex === 'number' &&
      Number.isFinite(parsed.activeStepIndex) &&
      parsed.activeStepIndex >= 0
        ? Math.floor(parsed.activeStepIndex)
        : 0;

    return {
      version: 1,
      userId: normalizeUserId(userId),
      firstLoginPromptHandled: Boolean(parsed.firstLoginPromptHandled),
      status,
      runScope,
      activeChapterId,
      activeStepIndex,
      completedChapterIds: sanitizeChapterArray(parsed.completedChapterIds),
      completedStepIds: sanitizeStringArray(parsed.completedStepIds),
      skippedStepIds: sanitizeStringArray(parsed.skippedStepIds),
      practiceStudentIds: sanitizeStringArray(parsed.practiceStudentIds),
      practiceGroupIds: sanitizeStringArray(parsed.practiceGroupIds),
      startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : undefined,
      completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : undefined,
      dismissedAt: typeof parsed.dismissedAt === 'string' ? parsed.dismissedAt : undefined,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}

// In-memory cache + reactive pub/sub store
const stateCacheByUser = new Map<string, TutorialPersistedState>();
const listeners = new Set<() => void>();

let runtimeUIState: TutorialRuntimeUIState = {
  isTourActive: false,
  isChapterHubOpen: false,
  isCompletionModalOpen: false,
  resumePromptHandledSessionForUser: null,
};

function emitChange(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeToTutorial(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTutorialPersistedState(userId?: string | null): TutorialPersistedState {
  const uid = normalizeUserId(userId);
  const cached = stateCacheByUser.get(uid);
  if (cached) return cached;

  let raw: string | null = null;
  try {
    if (typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(getTutorialStorageKey(uid));
    }
  } catch {
    raw = null;
  }

  const loaded = parsePersistedState(raw, uid);
  stateCacheByUser.set(uid, loaded);
  return loaded;
}

function saveTutorialPersistedState(
  userId: string | null | undefined,
  updater: (prev: TutorialPersistedState) => TutorialPersistedState
): TutorialPersistedState {
  const uid = normalizeUserId(userId);
  const prev = getTutorialPersistedState(uid);
  const next: TutorialPersistedState = {
    ...updater(prev),
    version: 1,
    userId: uid,
    updatedAt: new Date().toISOString(),
  };

  stateCacheByUser.set(uid, next);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getTutorialStorageKey(uid), JSON.stringify(next));
    }
  } catch {
    // quota or storage unavailable — keep in-memory state working safely
  }
  emitChange();
  return next;
}

export function getTutorialRuntimeUIState(): TutorialRuntimeUIState {
  return runtimeUIState;
}

export function updateTutorialRuntimeUIState(patch: Partial<TutorialRuntimeUIState>): void {
  const next: TutorialRuntimeUIState = {
    ...runtimeUIState,
    ...patch,
  };
  if (
    next.isTourActive === runtimeUIState.isTourActive &&
    next.isChapterHubOpen === runtimeUIState.isChapterHubOpen &&
    next.isCompletionModalOpen === runtimeUIState.isCompletionModalOpen &&
    next.resumePromptHandledSessionForUser === runtimeUIState.resumePromptHandledSessionForUser
  ) {
    return;
  }
  runtimeUIState = next;
  emitChange();
}

/**
 * Determines whether the First-Login Onboarding Choice screen should be offered.
 * Shown ONLY on first login for this account when not previously handled/dismissed/completed.
 */
export function shouldShowFirstLoginChoice(userId?: string | null): boolean {
  if (!userId) return false;
  const state = getTutorialPersistedState(userId);
  return !state.firstLoginPromptHandled && state.status === 'not_started';
}

/**
 * Determines whether an interrupted mid-tutorial session can be resumed after reload/re-login.
 */
export function shouldShowInterruptedTourPrompt(userId?: string | null): boolean {
  if (!userId) return false;
  const uid = normalizeUserId(userId);
  if (runtimeUIState.isTourActive) return false;
  if (runtimeUIState.resumePromptHandledSessionForUser === uid) return false;
  const state = getTutorialPersistedState(uid);
  return state.status === 'in_progress';
}

/**
 * User chose "Explore on My Own" or skipped on first-login prompt.
 * Never re-prompts on subsequent logins.
 */
export function dismissFirstLoginTutorial(userId?: string | null): TutorialPersistedState {
  const uid = normalizeUserId(userId);
  updateTutorialRuntimeUIState({
    isTourActive: false,
    isChapterHubOpen: false,
    isCompletionModalOpen: false,
    resumePromptHandledSessionForUser: uid,
  });
  return saveTutorialPersistedState(uid, (prev) => ({
    ...prev,
    firstLoginPromptHandled: true,
    status: prev.status === 'completed' ? 'completed' : 'dismissed',
    dismissedAt: new Date().toISOString(),
  }));
}

/**
 * Starts the full interactive tour from Chapter A Step 0 (or restarts cleanly).
 */
export function startFullTutorial(
  userId?: string | null,
  resetCompletedBadges = false
): TutorialPersistedState {
  const uid = normalizeUserId(userId);
  const now = new Date().toISOString();
  const next = saveTutorialPersistedState(uid, (prev) => ({
    ...prev,
    firstLoginPromptHandled: true,
    status: 'in_progress',
    runScope: 'full',
    activeChapterId: 'getting_started',
    activeStepIndex: 0,
    completedChapterIds: resetCompletedBadges ? [] : prev.completedChapterIds,
    completedStepIds: resetCompletedBadges ? [] : prev.completedStepIds,
    skippedStepIds: resetCompletedBadges ? [] : prev.skippedStepIds,
    startedAt: prev.startedAt || now,
  }));
  updateTutorialRuntimeUIState({
    isTourActive: true,
    isChapterHubOpen: false,
    isCompletionModalOpen: false,
    resumePromptHandledSessionForUser: uid,
  });
  return next;
}

/**
 * Resumes an in-progress tutorial from the exact saved chapter and step index.
 */
export function resumeTutorial(userId?: string | null): TutorialPersistedState {
  const uid = normalizeUserId(userId);
  const next = saveTutorialPersistedState(uid, (prev) => ({
    ...prev,
    firstLoginPromptHandled: true,
    status: 'in_progress',
  }));
  updateTutorialRuntimeUIState({
    isTourActive: true,
    isChapterHubOpen: false,
    isCompletionModalOpen: false,
    resumePromptHandledSessionForUser: uid,
  });
  return next;
}

/**
 * Starts a specific chapter directly (either standalone or within full tour).
 */
export function startTutorialChapter(
  userId: string | null | undefined,
  chapterId: TutorialChapterId,
  scope: TutorialRunScope = 'single_chapter'
): TutorialPersistedState {
  const uid = normalizeUserId(userId);
  const now = new Date().toISOString();
  const next = saveTutorialPersistedState(uid, (prev) => ({
    ...prev,
    firstLoginPromptHandled: true,
    status: 'in_progress',
    runScope: scope,
    activeChapterId: chapterId,
    activeStepIndex: 0,
    startedAt: prev.startedAt || now,
  }));
  updateTutorialRuntimeUIState({
    isTourActive: true,
    isChapterHubOpen: false,
    isCompletionModalOpen: false,
    resumePromptHandledSessionForUser: uid,
  });
  return next;
}

/**
 * Updates current chapter/step pointer and optionally marks a step/chapter completed or skipped.
 */
export function setTutorialStepPosition(
  userId: string | null | undefined,
  params: {
    chapterId: TutorialChapterId;
    stepIndex: number;
    completedStepId?: string;
    skippedStepId?: string;
    completedChapterId?: TutorialChapterId;
  }
): TutorialPersistedState {
  return saveTutorialPersistedState(userId, (prev) => {
    const completedStepIds =
      params.completedStepId && !prev.completedStepIds.includes(params.completedStepId)
        ? [...prev.completedStepIds, params.completedStepId]
        : prev.completedStepIds;

    const skippedStepIds =
      params.skippedStepId && !prev.skippedStepIds.includes(params.skippedStepId)
        ? [...prev.skippedStepIds, params.skippedStepId]
        : prev.skippedStepIds;

    const completedChapterIds =
      params.completedChapterId && !prev.completedChapterIds.includes(params.completedChapterId)
        ? [...prev.completedChapterIds, params.completedChapterId]
        : prev.completedChapterIds;

    return {
      ...prev,
      status: 'in_progress',
      activeChapterId: params.chapterId,
      activeStepIndex: Math.max(0, params.stepIndex),
      completedStepIds,
      skippedStepIds,
      completedChapterIds,
    };
  });
}

/**
 * Pauses the active spotlight session while keeping `status: 'in_progress'` so the user can resume later,
 * OR exits/dismisses completely when `markDismissed = true`.
 */
export function exitTutorialSession(
  userId?: string | null,
  markDismissed = true
): TutorialPersistedState {
  const uid = normalizeUserId(userId);
  updateTutorialRuntimeUIState({
    isTourActive: false,
    isChapterHubOpen: false,
    isCompletionModalOpen: false,
    resumePromptHandledSessionForUser: uid,
  });

  return saveTutorialPersistedState(uid, (prev) => {
    if (!markDismissed) {
      return {
        ...prev,
        firstLoginPromptHandled: true,
      };
    }
    return {
      ...prev,
      firstLoginPromptHandled: true,
      status: prev.completedChapterIds.length === ALL_CHAPTER_IDS.length ? 'completed' : 'dismissed',
      dismissedAt: new Date().toISOString(),
    };
  });
}

/**
 * Completes the tutorial (or single chapter) and opens the completion summary modal.
 */
export function finishTutorialRun(
  userId: string | null | undefined,
  finalStepId?: string,
  finalChapterId?: TutorialChapterId
): TutorialPersistedState {
  const uid = normalizeUserId(userId);
  const now = new Date().toISOString();
  const next = saveTutorialPersistedState(uid, (prev) => {
    const completedStepIds =
      finalStepId && !prev.completedStepIds.includes(finalStepId)
        ? [...prev.completedStepIds, finalStepId]
        : prev.completedStepIds;

    const completedChapterIds =
      finalChapterId && !prev.completedChapterIds.includes(finalChapterId)
        ? [...prev.completedChapterIds, finalChapterId]
        : prev.completedChapterIds;

    const isFullDone =
      prev.runScope === 'full' || completedChapterIds.length >= ALL_CHAPTER_IDS.length;

    return {
      ...prev,
      firstLoginPromptHandled: true,
      status: isFullDone ? 'completed' : 'dismissed',
      completedStepIds,
      completedChapterIds,
      completedAt: isFullDone ? now : prev.completedAt,
    };
  });

  updateTutorialRuntimeUIState({
    isTourActive: false,
    isChapterHubOpen: false,
    isCompletionModalOpen: true,
    resumePromptHandledSessionForUser: uid,
  });

  return next;
}

/**
 * Resets tutorial completion & progress badges for the active user (does NOT touch app data).
 */
export function resetTutorialProgress(userId?: string | null): TutorialPersistedState {
  const uid = normalizeUserId(userId);
  updateTutorialRuntimeUIState({
    isTourActive: false,
    isChapterHubOpen: false,
    isCompletionModalOpen: false,
    resumePromptHandledSessionForUser: uid,
  });
  return saveTutorialPersistedState(uid, (prev) => ({
    ...createDefaultPersistedState(uid),
    firstLoginPromptHandled: true,
    practiceStudentIds: prev.practiceStudentIds,
    practiceGroupIds: prev.practiceGroupIds,
  }));
}

export function openTutorialChapterHub(): void {
  updateTutorialRuntimeUIState({
    isTourActive: false,
    isChapterHubOpen: true,
    isCompletionModalOpen: false,
  });
}

export function closeTutorialChapterHub(): void {
  updateTutorialRuntimeUIState({
    isChapterHubOpen: false,
  });
}

export function closeTutorialCompletionModal(): void {
  updateTutorialRuntimeUIState({
    isCompletionModalOpen: false,
  });
}

// ============================================================================
// SAFE PRACTICE SANDBOX HELPERS (Strictly Tagged & Isolated from Real Data)
// ============================================================================

export function isPracticeLabeledName(name?: string | null): boolean {
  if (!name) return false;
  return name.includes(PRACTICE_TAG_AR) || name.includes(PRACTICE_TAG_EN);
}

export function recordPracticeStudent(userId: string | null | undefined, studentId: string): void {
  if (!studentId) return;
  saveTutorialPersistedState(userId, (prev) => ({
    ...prev,
    practiceStudentIds: prev.practiceStudentIds.includes(studentId)
      ? prev.practiceStudentIds
      : [...prev.practiceStudentIds, studentId],
  }));
}

export function recordPracticeGroup(userId: string | null | undefined, groupId: string): void {
  if (!groupId) return;
  saveTutorialPersistedState(userId, (prev) => ({
    ...prev,
    practiceGroupIds: prev.practiceGroupIds.includes(groupId)
      ? prev.practiceGroupIds
      : [...prev.practiceGroupIds, groupId],
  }));
}

/**
 * Creates a clearly labeled `[تجريبي]` practice student on explicit user opt-in during Chapter B.
 * Tracked by ID so the user can keep it or remove it in 1 tap without ever touching real students.
 */
export function createSafePracticeStudent(userId?: string | null, isEn = false): Student {
  const uid = normalizeUserId(userId);
  const existingStudents = db.getStudents();
  const state = getTutorialPersistedState(uid);

  const existingPractice = existingStudents.find(
    (s) => state.practiceStudentIds.includes(s.id) && isPracticeLabeledName(s.name)
  );
  if (existingPractice) {
    return existingPractice;
  }

  const nowIso = new Date().toISOString();
  const todayStr = toLocalISODate();
  const studentId = `stu_tutorial_practice_${Date.now().toString(36)}`;
  const practiceStudent: Student = {
    id: studentId,
    userId: uid,
    name: isEn ? `${PRACTICE_TAG_EN} Omar Khaled` : `${PRACTICE_TAG_AR} عمر خالد`,
    phone: '01000000000',
    gradeLevel: 'الصف الأول الثانوي',
    school: isEn ? 'Classy Practice Academy' : 'مدرسة التدريب التفاعلي',
    avatarColor: '#17375E',
    achievementFrame: 'none',
    scheduleDays: ['saturday', 'tuesday'],
    scheduleTime: '16:00',
    scheduleTimes: { saturday: ['16:00'], tuesday: ['16:00'] },
    startDate: todayStr,
    notes: isEn
      ? 'Safe practice student created during the interactive onboarding tour.'
      : 'طالب تجريبي آمن تم إنشاؤه للتدريب أثناء الجولة التفاعلية.',
    status: 'active',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  db.saveStudent(practiceStudent);
  db.createPrivateLessonService(studentId, {
    subject: isEn ? `${PRACTICE_TAG_EN} Mathematics` : `${PRACTICE_TAG_AR} الرياضيات`,
    sessionPrice: 120,
    billingType: 'per_session',
    billingMode: 'postpaid',
    scheduleDays: ['saturday', 'tuesday'],
    scheduleTime: '16:00',
    scheduleTimes: { saturday: ['16:00'], tuesday: ['16:00'] },
    startDate: todayStr,
  });

  recordPracticeStudent(uid, studentId);
  return practiceStudent;
}

/**
 * Creates a clearly labeled `[تجريبي]` practice group on explicit user opt-in during Chapter C.
 * Tracked by ID so the user can keep it or remove it in 1 tap without ever touching real groups.
 */
export function createSafePracticeGroup(userId?: string | null, isEn = false): Group {
  const uid = normalizeUserId(userId);
  const existingGroups = db.getGroups();
  const state = getTutorialPersistedState(uid);

  const existingPractice = existingGroups.find(
    (g) => state.practiceGroupIds.includes(g.id) && isPracticeLabeledName(g.name)
  );
  if (existingPractice) {
    return existingPractice;
  }

  const nowIso = new Date().toISOString();
  const groupId = `grp_tutorial_practice_${Date.now().toString(36)}`;
  const practiceGroup: Group = {
    id: groupId,
    userId: uid,
    name: isEn ? `${PRACTICE_TAG_EN} Excellence Group A` : `${PRACTICE_TAG_AR} مجموعة التميز (أ)`,
    subject: isEn ? 'Mathematics' : 'الرياضيات',
    gradeLevel: 'الصف الأول الثانوي',
    type: 'group',
    scheduleDays: ['sunday', 'wednesday'],
    scheduleTime: '17:00',
    scheduleTimes: { sunday: ['17:00'], wednesday: ['17:00'] },
    billingType: 'monthly',
    billingMode: 'monthly',
    defaultPrice: 300,
    accentColor: '#17375E',
    notes: isEn
      ? 'Safe practice group created during the interactive onboarding tour.'
      : 'مجموعة تجريبية آمنة تم إنشاؤها للتدريب أثناء الجولة التفاعلية.',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  db.saveGroup(practiceGroup);
  recordPracticeGroup(uid, groupId);
  return practiceGroup;
}

/**
 * Counts how many tracked `[تجريبي]` practice records still exist in the current user's database.
 */
export function getActivePracticeEntitiesCount(userId?: string | null): {
  studentsCount: number;
  groupsCount: number;
  totalCount: number;
} {
  const state = getTutorialPersistedState(userId);
  if (state.practiceStudentIds.length === 0 && state.practiceGroupIds.length === 0) {
    return { studentsCount: 0, groupsCount: 0, totalCount: 0 };
  }

  const allStudents = db.getStudents();
  const allGroups = db.getGroups();

  const studentsCount = allStudents.filter(
    (s) => state.practiceStudentIds.includes(s.id) && isPracticeLabeledName(s.name)
  ).length;
  const groupsCount = allGroups.filter(
    (g) => state.practiceGroupIds.includes(g.id) && isPracticeLabeledName(g.name)
  ).length;

  return {
    studentsCount,
    groupsCount,
    totalCount: studentsCount + groupsCount,
  };
}

/**
 * Deletes ONLY tracked `[تجريبي]` / `[Practice]` records created during the tutorial.
 * Strict double-guard: requires BOTH tracked ID membership AND `[تجريبي]`/`[Practice]` label match,
 * guaranteeing real user data is never touched under any circumstance.
 */
export function cleanupPracticeEntities(userId?: string | null): {
  removedStudents: number;
  removedGroups: number;
} {
  const uid = normalizeUserId(userId);
  const state = getTutorialPersistedState(uid);
  let removedStudents = 0;
  let removedGroups = 0;

  const currentStudents = db.getStudents();
  for (const stuId of state.practiceStudentIds) {
    if (!stuId.startsWith('stu_tutorial_practice_')) continue;
    const match = currentStudents.find((s) => s.id === stuId);
    if (match && isPracticeLabeledName(match.name)) {
      db.deleteStudentPermanently(stuId);
      removedStudents++;
    }
  }

  const currentGroups = db.getGroups();
  for (const grpId of state.practiceGroupIds) {
    if (!grpId.startsWith('grp_tutorial_practice_')) continue;
    const match = currentGroups.find((g) => g.id === grpId);
    if (match && isPracticeLabeledName(match.name)) {
      db.deleteGroup(grpId);
      removedGroups++;
    }
  }

  saveTutorialPersistedState(uid, (prev) => ({
    ...prev,
    practiceStudentIds: [],
    practiceGroupIds: [],
  }));

  return { removedStudents, removedGroups };
}

/**
 * React hook for subscribing to both persisted per-account tutorial state and runtime UI state.
 */
export function useTutorialState(userId?: string | null): {
  persisted: TutorialPersistedState;
  runtime: TutorialRuntimeUIState;
} {
  const uid = normalizeUserId(userId);

  const getPersisted = useCallback(() => getTutorialPersistedState(uid), [uid]);
  const persisted = useSyncExternalStore(subscribeToTutorial, getPersisted, getPersisted);
  const runtime = useSyncExternalStore(
    subscribeToTutorial,
    getTutorialRuntimeUIState,
    getTutorialRuntimeUIState
  );

  return { persisted, runtime };
}

/**
 * Test-only cache reset helper for isolated automated verification suites.
 */
export function __resetTutorialMemoryCacheForTests(): void {
  stateCacheByUser.clear();
  runtimeUIState = {
    isTourActive: false,
    isChapterHubOpen: false,
    isCompletionModalOpen: false,
    resumePromptHandledSessionForUser: null,
  };
  emitChange();
}
