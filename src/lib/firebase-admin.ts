import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

/**
 * Firebase Admin SDK configuration
 * This module is server-side only and should never be imported in client-side code
 */

let adminApp: App | null = null;
let adminDb: Firestore | null = null;

/**
 * Initialize Firebase Admin SDK with environment variables
 * @returns Firebase Admin app and Firestore database instances
 * @throws Error if required environment variables are missing
 */
function initializeFirebaseAdmin(): { app: App; db: Firestore } {
  if (adminApp && adminDb) {
    return { app: adminApp, db: adminDb };
  }

  // Check if we have the required environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (
    !projectId ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error(
      'Firebase Admin not configured - missing required environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
    );
  }

  // Initialize Firebase Admin
  if (!getApps().length) {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } else {
    adminApp = getApps()[0];
  }

  adminDb = getFirestore(adminApp);
  return { app: adminApp, db: adminDb };
}

/**
 * Get Firestore database instance
 * Initializes Firebase Admin SDK if not already initialized
 * @returns Firestore database instance
 */
export function getAdminDb(): Firestore {
  const { db } = initializeFirebaseAdmin();
  return db;
}

/**
 * @deprecated Use getAdminDb() instead
 * For backward compatibility only
 */
export { getAdminDb as adminDb };
