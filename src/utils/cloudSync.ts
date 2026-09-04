import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirestoreDb } from '../config/firebase';

export interface CloudSyncResult {
  success: boolean;
  timestamp?: string;
  dataPackage?: any;
  error?: string;
  merged?: boolean;
}

/**
 * Direct cloud synchronization with Firebase Firestore.
 * Bypasses all web proxies and works seamlessly in standalone Android APK and Web.
 */
export async function syncUserDataToFirestore(
  userId: string,
  localPackage: any
): Promise<CloudSyncResult> {
  try {
    const db = getFirestoreDb();
    const userDocRef = doc(db, 'teachers', userId, 'data', 'current');
    
    // Fetch existing cloud document to perform merging if applicable
    const existingSnap = await getDoc(userDocRef);
    let finalPackage = localPackage;

    if (existingSnap.exists()) {
      const cloudData = existingSnap.data();
      if (cloudData && cloudData.dataPackage) {
        // Merge logic if cloud package is newer or has distinct updates
        finalPackage = {
          ...cloudData.dataPackage,
          ...localPackage,
          lastUpdated: new Date().toISOString(),
        };
      }
    }

    // Save to Firestore
    await setDoc(userDocRef, {
      userId,
      dataPackage: finalPackage,
      updatedAt: serverTimestamp(),
      lastClientSync: new Date().toISOString(),
    });

    return {
      success: true,
      timestamp: new Date().toISOString(),
      dataPackage: finalPackage,
      merged: true,
    };
  } catch (err: any) {
    console.error('[CloudSync Firestore Error]:', err);
    return {
      success: false,
      error: err?.message || 'Firestore sync failed',
    };
  }
}

/**
 * Direct cloud pull from Firebase Firestore.
 */
export async function pullUserDataFromFirestore(userId: string): Promise<CloudSyncResult> {
  try {
    const db = getFirestoreDb();
    const userDocRef = doc(db, 'teachers', userId, 'data', 'current');
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        success: true,
        dataPackage: data?.dataPackage || null,
        timestamp: data?.lastClientSync || new Date().toISOString(),
      };
    }

    return {
      success: true,
      dataPackage: null,
    };
  } catch (err: any) {
    console.error('[CloudSync Pull Error]:', err);
    return {
      success: false,
      error: err?.message || 'Firestore pull failed',
    };
  }
}
