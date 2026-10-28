/**
 * Pure helper utilities for the Fast Attendance roll-call workflow
 * in RecordAttendanceModal.
 */

export interface FastAdvanceResolution {
  nextIndex: number | null;
  updatedConfirmedIds: Set<string>;
  isPassComplete: boolean;
}

/**
 * Given the ordered list of student IDs in a group session, the index of the
 * student just marked/processed, and the set of student IDs already confirmed
 * in the current Fast Attendance pass, resolves the next student index to
 * auto-advance to.
 *
 * - Searches forward (`currentIndex + 1 .. length - 1`) for the next unconfirmed student.
 * - Wraps around (`0 .. currentIndex - 1`) if earlier students were skipped.
 * - Returns `nextIndex: null` when the pass transitions into 100% confirmed.
 * - If all students were ALREADY confirmed prior to this tap (re-verifying down
 *   the roster), advances sequentially to `currentIndex + 1` until the end of the list.
 */
export function resolveFastAttendanceAdvance(
  studentIds: readonly string[],
  currentIndex: number,
  previousConfirmedIds: ReadonlySet<string>
): FastAdvanceResolution {
  const total = studentIds.length;
  const updatedConfirmedIds = new Set<string>(previousConfirmedIds);

  if (total === 0 || currentIndex < 0 || currentIndex >= total) {
    return {
      nextIndex: null,
      updatedConfirmedIds,
      isPassComplete: total > 0 && updatedConfirmedIds.size >= total,
    };
  }

  const wasAlreadyComplete = previousConfirmedIds.size >= total;
  const currentStudentId = studentIds[currentIndex];
  updatedConfirmedIds.add(currentStudentId);

  const isPassComplete = updatedConfirmedIds.size >= total;

  // 1. Search forward for the first unconfirmed student after currentIndex
  for (let i = currentIndex + 1; i < total; i++) {
    if (!updatedConfirmedIds.has(studentIds[i])) {
      return {
        nextIndex: i,
        updatedConfirmedIds,
        isPassComplete: false,
      };
    }
  }

  // 2. Wrap around to catch any skipped unconfirmed student earlier in the list
  for (let i = 0; i < currentIndex; i++) {
    if (!updatedConfirmedIds.has(studentIds[i])) {
      return {
        nextIndex: i,
        updatedConfirmedIds,
        isPassComplete: false,
      };
    }
  }

  // 3. All students are confirmed:
  // If this tap just completed the pass, return null to signal completion.
  // If the pass was already complete and the teacher is re-tapping sequentially, step forward.
  if (wasAlreadyComplete && currentIndex + 1 < total) {
    return {
      nextIndex: currentIndex + 1,
      updatedConfirmedIds,
      isPassComplete: true,
    };
  }

  return {
    nextIndex: null,
    updatedConfirmedIds,
    isPassComplete,
  };
}
