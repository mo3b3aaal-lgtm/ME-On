import http from 'http';
import assert from 'assert';

// ============================================================================
// 1. REALISTIC QUOTA-CAPPED LOCALSTORAGE & INDEXEDDB ENVIRONMENT POLYFILLS
// ============================================================================
const mockStore = new Map<string, string>();
let maxQuotaBytes = 4.5 * 1024 * 1024; // 4.5 MB Android WebView-like budget
let forceHardQuotaFailOnKeys = false;

function currentUsedBytes(): number {
  let total = 0;
  for (const [k, v] of mockStore.entries()) {
    total += (k.length + v.length) * 2; // UTF-16 char estimate in WebView
  }
  return total;
}

function makeQuotaError(msg = 'QuotaExceededError: DOM Exception 22'): Error {
  const err: any = new Error(msg);
  err.name = 'QuotaExceededError';
  err.code = 22;
  return err;
}

const mockLocalStorage: Storage = {
  get length() {
    return mockStore.size;
  },
  clear() {
    mockStore.clear();
  },
  getItem(key: string) {
    return mockStore.has(key) ? mockStore.get(key)! : null;
  },
  key(index: number) {
    return Array.from(mockStore.keys())[index] ?? null;
  },
  removeItem(key: string) {
    mockStore.delete(key);
  },
  setItem(key: string, value: string) {
    const strVal = String(value);
    if (forceHardQuotaFailOnKeys && (key.startsWith('tm_v2_sessions') || key.startsWith('tm_v2_attendance'))) {
      throw makeQuotaError('QuotaExceededError: Simulated hard disk full');
    }
    const prevSize = mockStore.has(key) ? (key.length + mockStore.get(key)!.length) * 2 : 0;
    const nextSize = (key.length + strVal.length) * 2;
    if (currentUsedBytes() - prevSize + nextSize > maxQuotaBytes) {
      throw makeQuotaError(`QuotaExceededError writing ${key} (${nextSize} bytes)`);
    }
    mockStore.set(key, strVal);
  },
};

// Minimal IndexedDB polyfill so IDB mirror & recovery run end-to-end in Node
const idbStores = new Map<string, Map<string, any>>();
function getIdbStore(name: string): Map<string, any> {
  if (!idbStores.has(name)) idbStores.set(name, new Map());
  return idbStores.get(name)!;
}

const mockIndexedDB = {
  open(_name: string, _version?: number) {
    const req: any = { onupgradeneeded: null, onsuccess: null, onerror: null, result: null };
    queueMicrotask(() => {
      const dbObj: any = {
        objectStoreNames: {
          contains: (n: string) => idbStores.has(n),
        },
        createObjectStore: (n: string) => {
          getIdbStore(n);
          return {};
        },
        transaction: (storeNames: string | string[], _mode?: string) => {
          const names = Array.isArray(storeNames) ? storeNames : [storeNames];
          const tx: any = {
            oncomplete: null,
            onerror: null,
            objectStore: (sName: string) => {
              const store = getIdbStore(sName);
              return {
                put: (val: any, key?: string) => {
                  const k = key !== undefined ? key : val?.userId;
                  store.set(k, JSON.parse(JSON.stringify(val)));
                  return {};
                },
                get: (key: string) => {
                  const getReq: any = { onsuccess: null, onerror: null, result: undefined };
                  queueMicrotask(() => {
                    const found = store.get(key);
                    getReq.result = found ? JSON.parse(JSON.stringify(found)) : undefined;
                    getReq.onsuccess?.({ target: getReq });
                  });
                  return getReq;
                },
                delete: (key: string) => {
                  store.delete(key);
                  return {};
                },
              };
            },
          };
          for (const n of names) getIdbStore(n);
          queueMicrotask(() => tx.oncomplete?.({}));
          return tx;
        },
        close: () => {},
      };
      req.result = dbObj;
      req.onupgradeneeded?.({ target: req });
      req.onsuccess?.({ target: req });
    });
    return req;
  },
};

(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).indexedDB = mockIndexedDB;

const listeners: Record<string, Function[]> = {};
(globalThis as any).window = {
  location: {
    protocol: 'http:',
    host: '127.0.0.1:0',
    hostname: '127.0.0.1',
    port: '0',
    origin: 'http://127.0.0.1',
  },
  localStorage: mockLocalStorage,
  indexedDB: mockIndexedDB,
  addEventListener: (ev: string, cb: Function) => {
    listeners[ev] = listeners[ev] || [];
    listeners[ev].push(cb);
  },
  removeEventListener: (ev: string, cb: Function) => {
    if (listeners[ev]) listeners[ev] = listeners[ev].filter((f) => f !== cb);
  },
  dispatchEvent: () => true,
  setTimeout,
  clearTimeout,
  setInterval: (() => 0) as any, // Avoid keeping Node alive on background interval
  clearInterval,
};

(globalThis as any).document = {
  visibilityState: 'visible',
  addEventListener: () => {},
  removeEventListener: () => {},
};

let simulatedOnline = true;
Object.defineProperty(globalThis, 'navigator', {
  get() {
    return { onLine: simulatedOnline };
  },
  configurable: true,
});

// ============================================================================
// 2. EXPRESS-COMPATIBLE LOCAL HTTP TEST SERVER (REAL ROUTES + FAULT INJECTION)
// ============================================================================
type ServerFaultMode =
  | 'normal'
  | 'http_500'
  | 'http_401'
  | 'delayed'
  | 'malformed_empty'
  | 'malformed_partial'
  | 'stale_cloud';

let serverFaultMode: ServerFaultMode = 'normal';
let serverDelayMs = 260;
let serverMergeCallCount = 0;
let cloudStoreByUser = new Map<string, any>();
let staleSnapshotToReturn: any = null;
const VALID_TOKEN = 'valid_test_token_123';
const REAUTH_TOKEN = 'reauth_test_token_456';
let activeValidToken = VALID_TOKEN;

const SYNC_ARRAY_FIELDS = [
  'students',
  'groups',
  'enrollments',
  'sessions',
  'attendance',
  'payments',
  'creditLogs',
  'behaviorLogs',
  'homeworkTests',
  'homeworkAssignments',
  'homeworkQuestionResults',
  'tombstones',
] as const;

function validateIncomingSyncPackage(pkg: unknown): string | null {
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    return 'Invalid dataPackage: expected an object';
  }
  const obj = pkg as Record<string, unknown>;
  for (const f of SYNC_ARRAY_FIELDS) {
    if (obj[f] !== undefined && !Array.isArray(obj[f])) {
      return `Invalid dataPackage.${f}: expected an array`;
    }
  }
  return null;
}

function parseSafeTs(iso?: string): number {
  if (!iso) return 0;
  const ts = new Date(iso).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function serverMergeList(cloudList: any[] = [], localList: any[] = []): any[] {
  const map = new Map<string, any>();
  for (const item of cloudList) if (item?.id) map.set(item.id, item);
  for (const item of localList) {
    if (!item?.id) continue;
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
    } else {
      const prevT = Math.max(parseSafeTs(prev.updatedAt), parseSafeTs(prev.createdAt), parseSafeTs(prev.recordedAt));
      const nextT = Math.max(parseSafeTs(item.updatedAt), parseSafeTs(item.createdAt), parseSafeTs(item.recordedAt));
      if (nextT >= prevT) {
        map.set(item.id, item);
      }
    }
  }
  return Array.from(map.values());
}

function startTestServer(): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      await new Promise((r) => req.on('end', r));
      const bodyStr = Buffer.concat(chunks).toString('utf8');
      let body: any = {};
      try {
        if (bodyStr) body = JSON.parse(bodyStr);
      } catch {
        body = {};
      }

      const sendJson = (status: number, data: any) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      };

      const url = (req.url || '/').split('?')[0];

      if (url === '/api/health') {
        return sendJson(200, { status: 'ok', database: 'MockFirestore' });
      }

      if (url === '/api/auth/login') {
        activeValidToken = REAUTH_TOKEN;
        const uid = 'acc_master_teacher';
        const existingCloud = cloudStoreByUser.get(uid) || {
          students: [],
          groups: [],
          enrollments: [],
          sessions: [],
          attendance: [],
          payments: [],
        };
        return sendJson(200, {
          success: true,
          token: activeValidToken,
          user: {
            id: uid,
            name: 'Master Teacher',
            email: body.identifier || 'teacher@classy.app',
          },
          hasCloudData: true,
          cloudData: existingCloud,
        });
      }

      const authHeader = String(req.headers['authorization'] || '');
      const tokenHeader = String(req.headers['x-auth-token'] || '');
      const suppliedToken = authHeader.replace(/^Bearer\s+/i, '').trim() || tokenHeader.trim();

      if (url === '/api/sync/merge') {
        serverMergeCallCount++;

        if (serverFaultMode === 'http_401' || (suppliedToken && suppliedToken !== activeValidToken)) {
          return sendJson(401, { success: false, error: 'Unauthorized / Token expired' });
        }
        if (serverFaultMode === 'http_500') {
          return sendJson(500, { success: false, error: 'Simulated transient Firestore failure' });
        }
        if (serverFaultMode === 'delayed') {
          await new Promise((r) => setTimeout(r, serverDelayMs));
        }
        if (serverFaultMode === 'malformed_empty') {
          return sendJson(200, { success: true, merged: true, dataPackage: {} });
        }
        if (serverFaultMode === 'malformed_partial') {
          return sendJson(200, { success: true, merged: true, dataPackage: { students: 'CORRUPT_STRING', groups: [] } });
        }
        if (serverFaultMode === 'stale_cloud' && staleSnapshotToReturn) {
          return sendJson(200, { success: true, merged: true, dataPackage: staleSnapshotToReturn });
        }

        const { dataPackage } = body;
        const valErr = validateIncomingSyncPackage(dataPackage);
        if (valErr) {
          return sendJson(400, { success: false, error: valErr });
        }

        const uid = dataPackage.userId || 'acc_master_teacher';
        const existing = cloudStoreByUser.get(uid) || {};
        const merged = {
          ...existing,
          ...dataPackage,
          students: serverMergeList(existing.students, dataPackage.students),
          groups: serverMergeList(existing.groups, dataPackage.groups),
          enrollments: serverMergeList(existing.enrollments, dataPackage.enrollments),
          sessions: serverMergeList(existing.sessions, dataPackage.sessions),
          attendance: serverMergeList(existing.attendance, dataPackage.attendance),
          payments: serverMergeList(existing.payments, dataPackage.payments),
          lastSyncTime: new Date().toISOString(),
        };
        cloudStoreByUser.set(uid, merged);
        return sendJson(200, { success: true, merged: true, dataPackage: merged });
      }

      if (url === '/api/sync/push') {
        if (suppliedToken !== activeValidToken) return sendJson(401, { success: false, error: 'Unauthorized' });
        const valErr = validateIncomingSyncPackage(body.dataPackage);
        if (valErr) return sendJson(400, { success: false, error: valErr });
        const uid = body.dataPackage.userId || 'acc_master_teacher';
        cloudStoreByUser.set(uid, body.dataPackage);
        return sendJson(200, { success: true, lastSyncTime: new Date().toISOString() });
      }

      if (url === '/api/sync/pull') {
        if (suppliedToken !== activeValidToken) return sendJson(401, { success: false, error: 'Unauthorized' });
        if (serverFaultMode === 'malformed_empty') {
          return sendJson(200, { success: true, hasCloudData: true, dataPackage: {} });
        }
        if (serverFaultMode === 'malformed_partial') {
          return sendJson(200, { success: true, hasCloudData: true, dataPackage: { students: 'CORRUPT_STRING', groups: [] } });
        }
        const uid = 'acc_master_teacher';
        const cloud = cloudStoreByUser.get(uid);
        return sendJson(200, { success: true, hasCloudData: Boolean(cloud), dataPackage: cloud || null });
      }

      sendJson(404, { success: false, error: 'Not found' });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

// Wrap globalThis.fetch to honor simulatedOnline = false realistically
const realFetch = globalThis.fetch.bind(globalThis);
(globalThis as any).fetch = (input: any, init?: any) => {
  if (!simulatedOnline) {
    return Promise.reject(new Error('Simulated network offline: TypeError Failed to fetch'));
  }
  return realFetch(input, init);
};

// ============================================================================
// 3. MAIN VERIFICATION RUNNER (ALL 15 MANDATORY SCENARIOS)
// ============================================================================
async function main() {
  const { server, baseUrl } = await startTestServer();
  mockLocalStorage.setItem('tm_custom_api_base_url', baseUrl);

  const storageMod = await import('../src/utils/storage');
  const durableMod = await import('../src/utils/durableStorageHelper');
  const {
    db,
    ensureDataMigrated,
    resetInMemoryStorageCachesForTests,
    performFullSync,
    pullCloudDataPackageFromServer,
    runAutoSyncSchedulerTick,
    recoverUserFromIndexedDBMirror,
    StoragePersistenceError,
    getSyncQueueState,
    hasPendingCloudSync,
  } = storageMod;
  const { saveSyncQueueState } = durableMod;

  const UID = 'acc_master_teacher';

  function resetAllStateForScenario(quotaBytes = 4.5 * 1024 * 1024) {
    mockStore.clear();
    idbStores.clear();
    cloudStoreByUser.clear();
    staleSnapshotToReturn = null;
    serverFaultMode = 'normal';
    serverMergeCallCount = 0;
    simulatedOnline = true;
    forceHardQuotaFailOnKeys = false;
    activeValidToken = VALID_TOKEN;
    maxQuotaBytes = quotaBytes;

    mockLocalStorage.setItem('tm_custom_api_base_url', baseUrl);
    mockLocalStorage.setItem(`tm_v2_auth_token_${UID}`, activeValidToken);
    mockLocalStorage.setItem(
      'tm_v2_current_session',
      JSON.stringify({ id: UID, name: 'Master Teacher', email: 'teacher@classy.app', authToken: activeValidToken })
    );
    resetInMemoryStorageCachesForTests();
    ensureDataMigrated();
  }

  // Simulates Android Recent Apps kill + full cold relaunch
  function simulateAppProcessKillAndRelaunch() {
    resetInMemoryStorageCachesForTests();
    ensureDataMigrated();
  }

  function seedBaseRoster() {
    const grp = {
      id: 'grp_math_1',
      name: 'Math Group A',
      subject: 'Mathematics',
      gradeLevel: '10th',
      type: 'group' as const,
      billingType: 'per_session' as const,
      billingMode: 'postpaid' as const,
      defaultPrice: 100,
      scheduleDays: ['saturday', 'tuesday'],
      scheduleTime: '16:00',
      accentColor: 'navy',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.saveGroup(grp);

    const ali = {
      id: 'stu_ali',
      name: 'Ali',
      gradeLevel: '10th',
      avatarColor: 'navy',
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.saveStudent(ali);

    const mahmoud = {
      id: 'stu_mahmoud',
      name: 'Mahmoud',
      gradeLevel: '10th',
      avatarColor: 'teal',
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.saveStudent(mahmoud);

    const yassin = {
      id: 'stu_yassin',
      name: 'Yassin',
      gradeLevel: '10th',
      avatarColor: 'orange',
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.saveStudent(yassin);

    const enrAli = db.createPrivateLessonService(ali.id, { subject: 'Math', sessionPrice: 120, billingType: 'postpaid', billingMode: 'postpaid' }).enrollment;
    const enrMahmoud = db.createPrivateLessonService(mahmoud.id, { subject: 'Physics', sessionPrice: 150, billingType: 'postpaid', billingMode: 'postpaid' }).enrollment;
    const enrYassin = db.createPrivateLessonService(yassin.id, { subject: 'Chemistry', sessionPrice: 130, billingType: 'postpaid', billingMode: 'postpaid' }).enrollment;
    db.enrollStudent(ali.id, grp.id, { serviceType: 'group', billingType: 'per_session', customPrice: 100 });
    return { grp, ali, mahmoud, yassin, enrAli, enrMahmoud, enrYassin };
  }

  const results: { id: number; name: string; passed: boolean; detail: string }[] = [];

  async function runScenario(id: number, name: string, fn: () => Promise<string>) {
    try {
      const detail = await fn();
      results.push({ id, name, passed: true, detail });
      console.log(`✅ [Scenario ${id}] PASS — ${name}: ${detail}`);
    } catch (err: any) {
      results.push({ id, name, passed: false, detail: err?.message || String(err) });
      console.error(`❌ [Scenario ${id}] FAIL — ${name}:`, err);
    }
  }

  // --------------------------------------------------------------------------
  // Scenario 1: Complete attendance registration + process kill + relaunch
  // --------------------------------------------------------------------------
  await runScenario(1, 'Complete attendance registration -> process kill -> relaunch', async () => {
    resetAllStateForScenario();
    const { ali, enrAli } = seedBaseRoster();
    const ses = {
      id: 'ses_s1_1',
      groupId: '',
      studentId: ali.id,
      enrollmentId: enrAli.id,
      title: 'Ali Lesson 1',
      date: '2026-11-16',
      dayName: 'الاثنين',
      month: 11,
      year: 2026,
      startTime: '16:00',
      endTime: '17:00',
      status: 'completed' as const,
      pricePerStudent: 120,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.saveSession(ses);
    db.saveAttendanceBatch(ses.id, [
      {
        id: `att_${ses.id}_${ali.id}`,
        sessionId: ses.id,
        studentId: ali.id,
        enrollmentId: enrAli.id,
        status: 'present',
        isCharged: true,
        sessionUnits: 1,
        recordedAt: new Date().toISOString(),
      },
    ]);

    simulateAppProcessKillAndRelaunch();
    const loadedSes = db.getSessionById(ses.id);
    const loadedAtt = db.getSessionAttendance(ses.id);
    assert(loadedSes?.status === 'completed', 'Session must remain completed after relaunch');
    assert.strictEqual(loadedAtt.length, 1, 'Attendance count must be 1');
    assert.strictEqual(loadedAtt[0].status, 'present');
    assert.strictEqual(db.calculateStudentGrandFinancials(ali.id).grandTotalDue, 120);
    return 'Session completed, attendance=present, due=120 survived process kill';
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Charged & Uncharged absence + process kill + relaunch
  // --------------------------------------------------------------------------
  await runScenario(2, 'Charged & uncharged absences -> process kill -> relaunch', async () => {
    resetAllStateForScenario();
    const { ali, enrAli } = seedBaseRoster();
    db.recordPrivateSessionsForStudent({
      studentId: ali.id,
      enrollmentId: enrAli.id,
      groupId: enrAli.groupId,
      date: '2026-11-16',
      startTime: '15:00',
      sessionCount: 1,
      attendanceStatus: 'absent_charged',
      isCharged: true,
      sessionStatus: 'completed',
    });
    db.recordPrivateSessionsForStudent({
      studentId: ali.id,
      enrollmentId: enrAli.id,
      groupId: enrAli.groupId,
      date: '2026-11-16',
      startTime: '18:00',
      sessionCount: 1,
      attendanceStatus: 'absent_free',
      isCharged: false,
      absenceReason: 'Medical excuse',
      sessionStatus: 'completed',
    });

    simulateAppProcessKillAndRelaunch();
    const allAtt = db.getAttendance().filter((a) => a.studentId === ali.id);
    assert.strictEqual(allAtt.length, 2, 'Both charged and uncharged absences must persist');
    assert(allAtt.some((a) => a.status === 'absent_charged' && a.isCharged === true));
    assert(allAtt.some((a) => a.status === 'absent_free' && a.isCharged === false));
    assert.strictEqual(db.calculateStudentGrandFinancials(ali.id).grandTotalDue, 120, 'Only charged absence accrues 120');
    return 'Both absent_charged (due=120) and absent_free (due=0) survived kill';
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Multiple lessons same student same day
  // --------------------------------------------------------------------------
  await runScenario(3, 'Multiple lessons same student same day -> kill -> relaunch', async () => {
    resetAllStateForScenario();
    const { mahmoud, enrMahmoud } = seedBaseRoster();
    db.recordPrivateSessionsForStudent({
      studentId: mahmoud.id,
      enrollmentId: enrMahmoud.id,
      groupId: enrMahmoud.groupId,
      date: '2026-11-16',
      startTime: '14:00',
      sessionCount: 1,
      attendanceStatus: 'present',
      isCharged: true,
      sessionStatus: 'completed',
    });
    db.recordPrivateSessionsForStudent({
      studentId: mahmoud.id,
      enrollmentId: enrMahmoud.id,
      groupId: enrMahmoud.groupId,
      date: '2026-11-16',
      startTime: '19:00',
      sessionCount: 1,
      attendanceStatus: 'present',
      isCharged: true,
      sessionStatus: 'completed',
    });

    simulateAppProcessKillAndRelaunch();
    const mahSessions = db.getSessions().filter((s) => s.studentId === mahmoud.id && s.date === '2026-11-16');
    const mahAtt = db.getAttendance().filter((a) => a.studentId === mahmoud.id);
    assert.strictEqual(mahSessions.length, 2, 'Must keep 2 distinct sessions on same day');
    assert.strictEqual(mahAtt.length, 2, 'Must keep 2 attendance rows on same day');
    assert.strictEqual(db.calculateStudentGrandFinancials(mahmoud.id).grandTotalDue, 300);
    return '2 distinct sessions + 2 attendance records + 300 due survived kill';
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Multiple students same day (Ali 1, Mahmoud 2, Yassin 2 + Group)
  // --------------------------------------------------------------------------
  await runScenario(4, 'Multiple students same day (Ali 1, Mahmoud 2, Yassin 2) -> kill', async () => {
    resetAllStateForScenario();
    const { ali, mahmoud, yassin, enrAli, enrMahmoud, enrYassin } = seedBaseRoster();

    db.recordPrivateSessionsForStudent({
      studentId: ali.id, enrollmentId: enrAli.id, groupId: enrAli.groupId,
      date: '2026-11-16', startTime: '12:00', sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
    });
    for (const time of ['14:00', '16:00']) {
      db.recordPrivateSessionsForStudent({
        studentId: mahmoud.id, enrollmentId: enrMahmoud.id, groupId: enrMahmoud.groupId,
        date: '2026-11-16', startTime: time, sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
      });
    }
    for (const time of ['18:00', '20:00']) {
      db.recordPrivateSessionsForStudent({
        studentId: yassin.id, enrollmentId: enrYassin.id, groupId: enrYassin.groupId,
        date: '2026-11-16', startTime: time, sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
      });
    }

    simulateAppProcessKillAndRelaunch();
    assert.strictEqual(db.getSessions().filter((s) => s.status === 'completed').length, 5);
    assert.strictEqual(db.getAttendance().filter((a) => a.studentId === ali.id).length, 1);
    assert.strictEqual(db.getAttendance().filter((a) => a.studentId === mahmoud.id).length, 2);
    assert.strictEqual(db.getAttendance().filter((a) => a.studentId === yassin.id).length, 2);
    return 'All 5 sessions across Ali(1), Mahmoud(2), Yassin(2) survived process kill';
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Offline registration + process kill offline + reconnect recovery
  // --------------------------------------------------------------------------
  await runScenario(5, 'Offline registration -> kill offline -> relaunch -> reconnect sync', async () => {
    resetAllStateForScenario();
    const { ali, enrAli } = seedBaseRoster();
    simulatedOnline = false;

    db.recordPrivateSessionsForStudent({
      studentId: ali.id, enrollmentId: enrAli.id, groupId: enrAli.groupId,
      date: '2026-11-16', startTime: '17:00', sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
    });
    const syncWhileOffline = await performFullSync(UID, false);
    assert(syncWhileOffline.isOffline === true, 'Sync must report offline');
    assert(hasPendingCloudSync(UID), 'Dirty sync queue must stay pending while offline');

    simulateAppProcessKillAndRelaunch();
    assert.strictEqual(db.getSessions().length, 1, 'Offline session intact after kill');
    assert.strictEqual(db.getAttendance().length, 1, 'Offline attendance intact after kill');
    assert(hasPendingCloudSync(UID), 'Dirty sync queue survives offline process kill');

    simulatedOnline = true;
    const ran = await runAutoSyncSchedulerTick(true);
    assert(ran === true, 'Scheduler tick should run recovery sync upon reconnect');
    assert(!hasPendingCloudSync(UID), 'Dirty sync queue should clear after cloud sync');
    assert.strictEqual(cloudStoreByUser.get(UID)?.attendance?.length, 1, 'Cloud store must now contain offline record');
    return 'Offline record survived kill and pushed cleanly to cloud upon reconnect';
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Failed cloud sync (HTTP 500) + backoff queue + recovery retry
  // --------------------------------------------------------------------------
  await runScenario(6, 'Failed cloud sync (HTTP 500) -> dirty queue + recovery retry', async () => {
    resetAllStateForScenario();
    const { ali, enrAli } = seedBaseRoster();
    db.recordPrivateSessionsForStudent({
      studentId: ali.id, enrollmentId: enrAli.id, groupId: enrAli.groupId,
      date: '2026-11-16', startTime: '17:00', sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
    });

    serverFaultMode = 'http_500';
    const failRes = await performFullSync(UID, true);
    assert(failRes.success === false, 'HTTP 500 must fail sync');
    const qAfterFail = getSyncQueueState(UID);
    assert(qAfterFail.consecutiveFailures === 1);
    assert(qAfterFail.nextRetryAt !== null, 'Backoff retry timestamp must be scheduled');
    assert(qAfterFail.localMutationSeq > qAfterFail.lastSyncedMutationSeq, 'Dirty sequence preserved');

    serverFaultMode = 'normal';
    const ran = await runAutoSyncSchedulerTick(true);
    assert(ran === true);
    assert(!hasPendingCloudSync(UID), 'Queue must flush after server recovery');
    assert.strictEqual(cloudStoreByUser.get(UID)?.sessions?.length, 1);
    return 'HTTP 500 scheduled backoff without losing dirty queue; recovery succeeded';
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Delayed cloud response (out-of-order stale response during edit)
  // --------------------------------------------------------------------------
  await runScenario(7, 'Delayed cloud response does not drop newer concurrent edit', async () => {
    resetAllStateForScenario();
    const { ali, yassin, enrAli, enrYassin } = seedBaseRoster();
    db.recordPrivateSessionsForStudent({
      studentId: ali.id, enrollmentId: enrAli.id, groupId: enrAli.groupId,
      date: '2026-11-16', startTime: '14:00', sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
    });

    serverFaultMode = 'delayed';
    serverDelayMs = 240;
    const slowSyncPromise = performFullSync(UID, false);

    // Mutate Yassin while slow sync request is still in-flight!
    await new Promise((r) => setTimeout(r, 60));
    db.recordPrivateSessionsForStudent({
      studentId: yassin.id, enrollmentId: enrYassin.id, groupId: enrYassin.groupId,
      date: '2026-11-16', startTime: '19:00', sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
    });

    const slowRes = await slowSyncPromise;
    assert(slowRes.success === true);
    assert.strictEqual(db.getAttendance().length, 2, 'Newer local edit must remain locally intact');
    assert(hasPendingCloudSync(UID), 'Concurrent mutation during flight must keep queue dirty');

    serverFaultMode = 'normal';
    await runAutoSyncSchedulerTick(true);
    assert(!hasPendingCloudSync(UID));
    assert.strictEqual(cloudStoreByUser.get(UID)?.attendance?.length, 2, 'Follow-up sync pushed newer concurrent edit');
    return 'Both pre-flight & in-flight edits persisted and pushed to cloud';
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Empty {}, partial, and malformed cloud response rejection
  // --------------------------------------------------------------------------
  await runScenario(8, 'Empty {}, partial, or malformed cloud payloads rejected safely', async () => {
    resetAllStateForScenario();
    const { ali, enrAli } = seedBaseRoster();
    db.recordPrivateSessionsForStudent({
      studentId: ali.id, enrollmentId: enrAli.id, groupId: enrAli.groupId,
      date: '2026-11-16', startTime: '15:00', sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
    });

    // Server route validation rejects corrupt client push with 400
    const badPush = await fetch(`${baseUrl}/api/sync/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeValidToken}` },
      body: JSON.stringify({ dataPackage: { students: 'NOT_AN_ARRAY' } }),
    });
    assert.strictEqual(badPush.status, 400, 'Server must reject corrupt payload with HTTP 400');

    // Client rejects empty {} returned from server
    serverFaultMode = 'malformed_empty';
    const emptyRes = await performFullSync(UID, true);
    assert(emptyRes.success === false, 'Client must reject empty {} cloud package');
    assert.strictEqual(db.getAttendance().length, 1, 'Local attendance must remain untouched');

    // Client rejects partial/malformed pull payload
    serverFaultMode = 'malformed_partial';
    const pullRes = await pullCloudDataPackageFromServer(UID);
    assert(pullRes.success === false, 'Pull must reject partial/malformed cloud package');
    assert.strictEqual(db.getAttendance().length, 1, 'Local attendance untouched after malformed pull');
    return 'Empty {}, corrupt push (400), and partial pull rejected; local 100% intact';
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Stale cloud snapshot does not overwrite newer local attendance
  // --------------------------------------------------------------------------
  await runScenario(9, 'Stale cloud snapshot never overwrites newer local attendance', async () => {
    resetAllStateForScenario();
    const { ali, enrAli } = seedBaseRoster();
    const oldTime = '2026-11-16T08:00:00.000Z';
    const newTime = '2026-11-16T18:00:00.000Z';

    const sesId = 'ses_stale_check';
    staleSnapshotToReturn = {
      students: db.getStudents(),
      groups: db.getGroups(),
      enrollments: db.getEnrollments(),
      sessions: [{
        id: sesId, groupId: '', studentId: ali.id, enrollmentId: enrAli.id,
        title: 'Ali Lesson', date: '2026-11-16', dayName: 'الاثنين', month: 11, year: 2026,
        startTime: '16:00', endTime: '17:00', status: 'scheduled', pricePerStudent: 120,
        createdAt: oldTime, updatedAt: newTime, // Even if stale server has newer/different timestamp, completed status wins!
      }],
      attendance: [{
        id: `att_${sesId}_${ali.id}`, sessionId: sesId, studentId: ali.id, enrollmentId: enrAli.id,
        status: 'absent_free', isCharged: false, recordedAt: oldTime, updatedAt: oldTime,
      }],
      payments: [],
    };

    // Local has newer completed + present
    db.saveSession({
      id: sesId, groupId: '', studentId: ali.id, enrollmentId: enrAli.id,
      title: 'Ali Lesson', date: '2026-11-16', dayName: 'الاثنين', month: 11, year: 2026,
      startTime: '16:00', endTime: '17:00', status: 'completed', pricePerStudent: 120,
      createdAt: oldTime, updatedAt: newTime,
    });
    db.saveAttendanceBatch(sesId, [{
      id: `att_${sesId}_${ali.id}`, sessionId: sesId, studentId: ali.id, enrollmentId: enrAli.id,
      status: 'present', isCharged: true, recordedAt: newTime, updatedAt: newTime,
    }]);

    serverFaultMode = 'stale_cloud';
    await performFullSync(UID, true);
    const localSes = db.getSessionById(sesId);
    const localAtt = db.getSessionAttendance(sesId)[0];
    assert.strictEqual(localSes?.status, 'completed', 'Completed session must not revert to scheduled');
    assert.strictEqual(localAtt?.status, 'present', 'Newer local attendance status must win over stale cloud');
    return 'Newer local present/completed preserved against stale cloud scheduled/absent_free';
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Concurrent local writes during active in-flight sync
  // --------------------------------------------------------------------------
  await runScenario(10, 'Concurrent local writes during active in-flight sync', async () => {
    resetAllStateForScenario();
    const { ali, yassin, enrAli, enrYassin } = seedBaseRoster();
    db.recordPrivateSessionsForStudent({
      studentId: ali.id, enrollmentId: enrAli.id, groupId: enrAli.groupId,
      date: '2026-11-16', startTime: '13:00', sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
    });

    serverFaultMode = 'delayed';
    serverDelayMs = 200;
    const p = performFullSync(UID, false);
    await new Promise((r) => setTimeout(r, 40));

    // Concurrent write of attendance + payment during sync flight
    db.recordPrivateSessionsForStudent({
      studentId: yassin.id, enrollmentId: enrYassin.id, groupId: enrYassin.groupId,
      date: '2026-11-16', startTime: '15:00', sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
    });
    db.recordPayment({
      studentId: yassin.id, enrollmentId: enrYassin.id, groupId: enrYassin.groupId,
      amount: 130, paymentType: 'single_session', paymentMethod: 'cash', date: '2026-11-16', month: 11, year: 2026,
    });

    await p;
    assert(hasPendingCloudSync(UID), 'Dirty seq must stay pending for concurrent writes');
    serverFaultMode = 'normal';
    await runAutoSyncSchedulerTick(true);

    const cloud = cloudStoreByUser.get(UID);
    assert.strictEqual(cloud?.attendance?.length, 2);
    assert.strictEqual(cloud?.payments?.length, 1);
    return 'Concurrent attendance + payment queued during flight and synced cleanly on follow-up';
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Duplicate concurrent sync calls coalesced via mutex
  // --------------------------------------------------------------------------
  await runScenario(11, 'Duplicate concurrent performFullSync calls coalesced cleanly', async () => {
    resetAllStateForScenario();
    const { ali, enrAli } = seedBaseRoster();
    db.recordPrivateSessionsForStudent({
      studentId: ali.id, enrollmentId: enrAli.id, groupId: enrAli.groupId,
      date: '2026-11-16', startTime: '16:00', sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
    });

    serverFaultMode = 'delayed';
    serverDelayMs = 120;
    serverMergeCallCount = 0;

    const [r1, r2, r3] = await Promise.all([
      performFullSync(UID, true),
      performFullSync(UID, false),
      performFullSync(UID, false),
    ]);
    assert(r1.success && r2.success && r3.success);
    assert.strictEqual(serverMergeCallCount, 1, 'In-flight mutex must coalesce 3 calls into 1 HTTP request');
    assert.strictEqual(db.getAttendance().length, 1, 'Zero duplicate attendance records');
    return '3 parallel performFullSync calls coalesced to 1 HTTP request, 0 duplicates';
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Token expiration (401) & re-authentication recovery
  // --------------------------------------------------------------------------
  await runScenario(12, 'Token expiration (401) & re-auth recovery without data loss', async () => {
    resetAllStateForScenario();
    const { ali, enrAli } = seedBaseRoster();
    db.recordPrivateSessionsForStudent({
      studentId: ali.id, enrollmentId: enrAli.id, groupId: enrAli.groupId,
      date: '2026-11-16', startTime: '16:00', sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
    });

    serverFaultMode = 'http_401';
    const res401 = await performFullSync(UID, true);
    assert(res401.success === false && res401.isAuthExpired === true);
    assert.strictEqual(db.getAutoSyncConfig(UID).status, 'auth_expired');
    assert(hasPendingCloudSync(UID), 'Unsynced local edits must remain pending during auth_expired');

    // Re-authenticate
    serverFaultMode = 'normal';
    const loginRes = await db.login('teacher@classy.app', 'secret123');
    assert(loginRes.success === true);
    await new Promise((r) => setTimeout(r, 80)); // allow async post-login dirty push

    assert.strictEqual(getSyncQueueState(UID).authExpired, false);
    assert.strictEqual(db.getAttendance().length, 1);
    assert.strictEqual(cloudStoreByUser.get(UID)?.attendance?.length, 1);
    return '401 flagged auth_expired preserving local dirty edits; re-login cleared flag & pushed';
  });

  // --------------------------------------------------------------------------
  // Scenario 13: App restart mid-sync
  // --------------------------------------------------------------------------
  await runScenario(13, 'App restart mid-sync -> dirty queue recovers and pushes on relaunch', async () => {
    resetAllStateForScenario();
    const { mahmoud, enrMahmoud } = seedBaseRoster();
    db.recordPrivateSessionsForStudent({
      studentId: mahmoud.id, enrollmentId: enrMahmoud.id, groupId: enrMahmoud.groupId,
      date: '2026-11-16', startTime: '17:00', sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
    });

    // Simulate interruption right in the middle of an active in-flight sync before HTTP finished
    const q = getSyncQueueState(UID);
    saveSyncQueueState({ ...q, inFlightStartedAt: new Date().toISOString() });

    simulateAppProcessKillAndRelaunch();
    assert(hasPendingCloudSync(UID), 'Interrupted mid-sync mutation must remain pending after kill');
    const ran = await runAutoSyncSchedulerTick(true);
    assert(ran === true, 'Startup scheduler tick must push interrupted dirty queue');
    assert(!hasPendingCloudSync(UID));
    assert.strictEqual(cloudStoreByUser.get(UID)?.attendance?.length, 1);
    return 'Mid-sync crash detected dirty queue on relaunch and flushed to cloud';
  });

  // --------------------------------------------------------------------------
  // Scenario 14: 2–3 week endurance stress test (25 cold-start days + bloat purge)
  // --------------------------------------------------------------------------
  await runScenario(14, '2-3 week endurance stress test (25 cold launches + daily sessions)', async () => {
    resetAllStateForScenario(2.5 * 1024 * 1024); // Strict 2.5MB WebView quota
    const { ali, mahmoud, yassin, enrAli, enrMahmoud, enrYassin } = seedBaseRoster();

    // Inject historical leaked keys matching the exact recurrence bug!
    mockLocalStorage.setItem('tm_v2_sessions_backup_1700000001', JSON.stringify([{ legacy: 'x'.repeat(20_000) }]));
    mockLocalStorage.setItem('tm_v2_sessions_backup_1700000002', JSON.stringify([{ legacy: 'y'.repeat(20_000) }]));
    const bloatedAccounts = [{ id: UID, name: 'Master Teacher', email: 't@c.app', syncedData: { huge: 'z'.repeat(30_000) } }];
    mockLocalStorage.setItem('tm_v2_accounts', JSON.stringify(bloatedAccounts));

    for (let day = 1; day <= 25; day++) {
      const dateStr = `2026-11-${String(day).padStart(2, '0')}`;
      simulateAppProcessKillAndRelaunch();

      db.recordPrivateSessionsForStudent({
        studentId: ali.id, enrollmentId: enrAli.id, groupId: enrAli.groupId,
        date: dateStr, startTime: '14:00', sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
      });
      db.recordPrivateSessionsForStudent({
        studentId: mahmoud.id, enrollmentId: enrMahmoud.id, groupId: enrMahmoud.groupId,
        date: dateStr, startTime: '16:00', sessionCount: 1, attendanceStatus: day % 3 === 0 ? 'absent_free' : 'present',
        isCharged: day % 3 !== 0, sessionStatus: 'completed',
      });
      db.recordPrivateSessionsForStudent({
        studentId: yassin.id, enrollmentId: enrYassin.id, groupId: enrYassin.groupId,
        date: dateStr, startTime: '18:00', sessionCount: 1, attendanceStatus: 'absent_charged', isCharged: true, sessionStatus: 'completed',
      });

      // Add notification state & cooldown churn every day
      db.markNotificationAsRead(`notif_day_${day}`, UID);
      await performFullSync(UID, false);
    }

    simulateAppProcessKillAndRelaunch();

    // Verify NO key proliferation!
    const allKeys = Array.from(mockStore.keys());
    const leakedKeys = allKeys.filter((k) => k.startsWith('tm_v2_sessions_backup_'));
    assert.strictEqual(leakedKeys.length, 0, 'Zero timestamped session backup bloat keys allowed');
    const accountsStored = JSON.parse(mockStore.get('tm_v2_accounts') || '[]');
    assert(accountsStored.every((a: any) => !('syncedData' in a)), 'Accounts must never embed syncedData');
    assert.strictEqual(db.getSessions().length, 75, 'All 25 * 3 = 75 daily sessions must survive');
    assert.strictEqual(db.getAttendance().length, 75, 'All 75 attendance entries must survive');
    return `25 daily cold-start cycles, 75 sessions/attendance preserved, totalBytes=${currentUsedBytes()}`;
  });

  // --------------------------------------------------------------------------
  // Scenario 15: Quota exhaustion simulation + auto-reclaim + fail-loud guarantee
  // --------------------------------------------------------------------------
  await runScenario(15, 'Quota exhaustion -> auto-reclaim recovery + fail-loud StoragePersistenceError', async () => {
    // Part A: Reclaimable bloat fills quota -> saveList auto-reclaims and succeeds!
    resetAllStateForScenario(4.5 * 1024 * 1024);
    const { ali, enrAli } = seedBaseRoster();

    // Inject reclaimable bloat (~210KB UTF-16 of leaked backup + diag bloat), then clamp quota just above current usage (~235KB)
    // so the next multi-KB session+attendance write triggers QuotaExceededError and forces auto-reclaim!
    mockLocalStorage.setItem('tm_v2_sessions_backup_999', 'a'.repeat(45_000));
    mockLocalStorage.setItem(`tm_v2_account_backup_${UID}`, 'b'.repeat(40_000));
    mockLocalStorage.setItem('tm_v2_diag_log', JSON.stringify([{ msg: 'c'.repeat(20_000) }]));
    maxQuotaBytes = currentUsedBytes() + 500;

    db.recordPrivateSessionsForStudent({
      studentId: ali.id, enrollmentId: enrAli.id, groupId: enrAli.groupId,
      date: '2026-11-16', startTime: '17:00', sessionCount: 1, attendanceStatus: 'present', isCharged: true, sessionStatus: 'completed',
    });
    assert(!mockStore.has('tm_v2_sessions_backup_999'), 'Reclaimer should purge leaked backup under quota pressure');
    assert.strictEqual(db.getAttendance().length, 1, 'Attendance write succeeded after reclaiming bloat');

    // Part B: True hard disk exhaustion -> must throw StoragePersistenceError & NOT poison RAM!
    forceHardQuotaFailOnKeys = true;
    let caughtErr: any = null;
    try {
      db.saveAttendanceBatch('ses_hard_fail', [
        {
          id: 'att_hard_fail',
          sessionId: 'ses_hard_fail',
          studentId: ali.id,
          enrollmentId: enrAli.id,
          status: 'present',
          isCharged: true,
          recordedAt: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      caughtErr = e;
    }
    forceHardQuotaFailOnKeys = false;
    assert(caughtErr instanceof StoragePersistenceError, 'Must throw StoragePersistenceError on unrecoverable quota failure');
    assert.strictEqual(
      db.getAttendance().some((a) => a.id === 'att_hard_fail'),
      false,
      'Unpersisted record MUST NOT exist in RAM (zero phantom UI success)'
    );

    // Allow scheduled 180ms IDB mirror flush + microtasks to commit, then verify IndexedDB recovery if localStorage was wiped
    maxQuotaBytes = 4.5 * 1024 * 1024;
    await new Promise((r) => setTimeout(r, 250));
    const idbLoaded = await durableMod.idbLoadUserPackage(UID);
    assert(idbLoaded !== null, 'IDB mirror should hold backup copy');
    mockLocalStorage.removeItem('tm_v2_students');
    mockLocalStorage.removeItem('tm_v2_groups');
    mockLocalStorage.removeItem('tm_v2_sessions');
    mockLocalStorage.removeItem('tm_v2_attendance');
    resetInMemoryStorageCachesForTests();
    assert.strictEqual(db.getAttendance().length, 0);
    const recovered = await recoverUserFromIndexedDBMirror(UID);
    assert(recovered === true && db.getAttendance().length === 1 && db.getSessions().length === 1, 'IDB mirror must self-recover evicted localStorage');

    return 'Auto-reclaim succeeded; hard quota threw StoragePersistenceError (0 RAM lie); IDB recovery passed';
  });

  server.close();
  console.log('\n==============================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`VERIFICATION SUMMARY: ${passedCount}/${results.length} scenarios passed`);
  console.log('==============================================================');
  if (passedCount !== results.length) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal verification suite error:', err);
  process.exit(1);
});
