import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore, doc, getDocFromServer, setDoc, getDoc } from 'firebase/firestore';

// Configuration loaded from firebase-applet-config.json
export const firebaseConfig = {
  projectId: 'corded-elevator-cf6jr',
  appId: '1:623166426191:web:7013079452408dcb1f2e3a',
  apiKey: 'AIzaSyDRo_ySBCr3nbkoNJ-HtmJywnAJSHlYuvA',
  authDomain: 'corded-elevator-cf6jr.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-teacherskdb-2ab7b23f-628d-4bc7-9c38-f649ca7153f9',
  storageBucket: 'corded-elevator-cf6jr.firebasestorage.app',
  messagingSenderId: '623166426191',
};

let appInstance: any = null;
let dbInstance: Firestore | null = null;

export function getFirebaseApp() {
  if (!appInstance) {
    appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  }
  return appInstance;
}

export function getFirestoreDb(): Firestore {
  if (!dbInstance) {
    const app = getFirebaseApp();
    dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
  return dbInstance;
}

/**
 * Direct health check against Google Cloud Firestore.
 * Bypasses any intermediary web server or cookie bridge.
 */
export async function testDirectFirestoreHealth(): Promise<{
  ok: boolean;
  status: string;
  database: string;
  durationMs: number;
  data?: any;
  error?: string;
}> {
  const start = Date.now();
  try {
    const db = getFirestoreDb();
    const healthDocRef = doc(db, 'system_health', 'status');
    
    // Attempt reading latest status
    let docSnap;
    try {
      docSnap = await getDocFromServer(healthDocRef);
    } catch {
      docSnap = await getDoc(healthDocRef);
    }

    if (!docSnap.exists()) {
      // Initialize health status
      await setDoc(healthDocRef, {
        status: 'ok',
        database: 'Firebase Firestore',
        databaseId: firebaseConfig.firestoreDatabaseId,
        lastCheck: new Date().toISOString(),
      });
    }

    const duration = Date.now() - start;
    return {
      ok: true,
      status: 'ok',
      database: 'Firebase Firestore (' + firebaseConfig.firestoreDatabaseId + ')',
      durationMs: duration,
      data: docSnap.data() || { status: 'ok' },
    };
  } catch (err: any) {
    const duration = Date.now() - start;
    return {
      ok: false,
      status: 'error',
      database: 'Firebase Firestore',
      durationMs: duration,
      error: err?.message || String(err),
    };
  }
}
