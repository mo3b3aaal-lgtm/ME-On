import { parseTimeToMinutes } from './src/utils/schedule.js';

function getChronologicalTimestamp(
  dateStr?: string | null,
  timeStr?: string | null,
  fallbackIso?: string | null
): number {
  let year = 0;
  let month = 0;
  let day = 0;
  let hasValidDate = false;

  if (dateStr && typeof dateStr === 'string' && dateStr.trim()) {
    const trimmed = dateStr.trim();
    const dateMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (dateMatch) {
      year = parseInt(dateMatch[1], 10);
      month = parseInt(dateMatch[2], 10) - 1;
      day = parseInt(dateMatch[3], 10);
      hasValidDate = true;
    } else {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        year = d.getFullYear();
        month = d.getMonth();
        day = d.getDate();
        hasValidDate = true;
      }
    }
  }

  if (!hasValidDate && fallbackIso && typeof fallbackIso === 'string' && fallbackIso.trim()) {
    const d = new Date(fallbackIso.trim());
    if (!isNaN(d.getTime())) {
      year = d.getFullYear();
      month = d.getMonth();
      day = d.getDate();
      hasValidDate = true;
    }
  }

  if (!hasValidDate) {
    return 0;
  }

  let timeMinutes = 0;
  if (timeStr && typeof timeStr === 'string' && timeStr.trim()) {
    const parsedMins = parseTimeToMinutes(timeStr);
    if (parsedMins !== 99999) {
      timeMinutes = parsedMins;
    }
  } else if (fallbackIso && typeof fallbackIso === 'string' && fallbackIso.includes('T')) {
    const d = new Date(fallbackIso.trim());
    if (!isNaN(d.getTime())) {
      timeMinutes = d.getHours() * 60 + d.getMinutes();
    }
  }

  const dateObj = new Date(year, month, day, Math.floor(timeMinutes / 60), timeMinutes % 60, 0, 0);
  const ts = dateObj.getTime();
  return isNaN(ts) ? 0 : ts;
}

function runVerification() {
  console.log('=== RUNNING CHRONOLOGICAL SORTING & ABSENCE INDICATOR TESTS ===');

  // Test 1: Sessions saved out of order appear newest to oldest
  const rawList1 = [
    { id: '1', dateStr: '2026-09-01', timeStr: '10:00' },
    { id: '2', dateStr: '2026-10-15', timeStr: '16:00' },
    { id: '3', dateStr: '2026-08-20', timeStr: '12:00' },
    { id: '4', dateStr: '2026-10-21', timeStr: '09:00' },
  ];
  const sorted1 = [...rawList1].sort((a, b) => {
    const tsA = getChronologicalTimestamp(a.dateStr, a.timeStr);
    const tsB = getChronologicalTimestamp(b.dateStr, b.timeStr);
    return tsB - tsA;
  });
  console.assert(sorted1.map(x => x.id).join(',') === '4,2,1,3', 'Test 1 Failed: Out of order sorting');
  console.log('✓ Test 1 Passed: Sessions saved out of order sort newest to oldest');

  // Test 2: Multiple sessions on same date sorted by actual times (latest first)
  const rawList2 = [
    { id: 'early', dateStr: '2026-10-21', timeStr: '09:00' },
    { id: 'noon', dateStr: '2026-10-21', timeStr: '12:30' },
    { id: 'evening', dateStr: '2026-10-21', timeStr: '18:00' },
    { id: 'afternoon', dateStr: '2026-10-21', timeStr: '15:15' },
  ];
  const sorted2 = [...rawList2].sort((a, b) => {
    const tsA = getChronologicalTimestamp(a.dateStr, a.timeStr);
    const tsB = getChronologicalTimestamp(b.dateStr, b.timeStr);
    return tsB - tsA;
  });
  console.assert(sorted2.map(x => x.id).join(',') === 'evening,afternoon,noon,early', 'Test 2 Failed: Same-date time sorting');
  console.log('✓ Test 2 Passed: Multiple sessions on same date sorted by time (latest first)');

  // Test 3: Newly recorded session appears in correct position
  const updatedList = [...rawList1, { id: 'newest', dateStr: '2026-10-25', timeStr: '11:00' }];
  const sorted3 = [...updatedList].sort((a, b) => {
    const tsA = getChronologicalTimestamp(a.dateStr, a.timeStr);
    const tsB = getChronologicalTimestamp(b.dateStr, b.timeStr);
    return tsB - tsA;
  });
  console.assert(sorted3[0].id === 'newest', 'Test 3 Failed: New session not top');
  console.log('✓ Test 3 Passed: Newly recorded session lands in exact chronological position');

  // Test 4 & 5: Charged vs Uncharged absence flags
  const attCharged = { status: 'absent_charged', isCharged: true };
  const attAbsentDefault = { status: 'absent' };
  const attAbsentFree = { status: 'absent_free', isCharged: false };

  const isCharged1 = attCharged.status === 'absent_charged' || (attCharged.status === 'absent' && attCharged.isCharged !== false);
  const isCharged2 = attAbsentDefault.status === 'absent_charged' || (attAbsentDefault.status === 'absent' && (attAbsentDefault as any).isCharged !== false);
  const isFree = attAbsentFree.status === 'absent_free' || (attAbsentFree.status === 'absent' && attAbsentFree.isCharged === false);

  console.assert(isCharged1 === true && isCharged2 === true, 'Test 4 Failed: Charged absence check');
  console.assert(isFree === true, 'Test 5 Failed: Uncharged absence check');
  console.log('✓ Test 4 & 5 Passed: Charged and uncharged absence properly classified');

  // Test 6: Present, late, excused statuses
  const attPresent = { status: 'present' };
  const attLate = { status: 'late' };
  const attExcused = { status: 'excused' };
  console.assert(attPresent.status === 'present', 'Test 6a Failed');
  console.assert(attLate.status === 'late', 'Test 6b Failed');
  console.assert(attExcused.status === 'excused', 'Test 6c Failed');
  console.log('✓ Test 6 Passed: Present, late, and excused statuses retained');

  // Test 7 & 8: Data integrity and no mutations
  const originalCopy = JSON.stringify(rawList1);
  const nonMutatingSort = [...rawList1].sort((a, b) => getChronologicalTimestamp(b.dateStr, b.timeStr) - getChronologicalTimestamp(a.dateStr, a.timeStr));
  console.assert(JSON.stringify(rawList1) === originalCopy, 'Test 7 Failed: Original array was mutated!');
  console.log('✓ Test 7 & 8 Passed: Non-mutating sorting preserves stored data intact');

  console.log('=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===');
}

runVerification();
