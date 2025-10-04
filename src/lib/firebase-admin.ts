import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;

// Initialize Firebase Admin only when needed
function initializeFirebaseAdmin(): { app: App; db: Firestore } {
  if (adminApp && adminDb) {
    return { app: adminApp, db: adminDb };
  }

  // Check if we have the required environment variables
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    console.warn(
      '⚠️ Firebase Admin environment variables not set. Firebase Admin features will not work.'
    );
    throw new Error(
      'Firebase Admin not configured - missing environment variables'
    );
  }

  // Initialize Firebase Admin
  if (!getApps().length) {
    adminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
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

// Export a function that initializes Firebase Admin when called
export function getAdminDb(): Firestore {
  const { db } = initializeFirebaseAdmin();
  return db;
}

// For backward compatibility, export adminDb as a getter
export { getAdminDb as adminDb };
