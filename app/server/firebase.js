import admin from 'firebase-admin';

let db = null;

function hasValidFirebaseConfig() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } =
    process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return false;
  }

  if (
    FIREBASE_PROJECT_ID.includes('your-') ||
    FIREBASE_CLIENT_EMAIL.includes('your-') ||
    FIREBASE_PRIVATE_KEY.includes('...')
  ) {
    return false;
  }

  if (!FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
    return false;
  }

  return true;
}

export function initFirebase() {
  if (!hasValidFirebaseConfig()) {
    console.warn(
      '[firebase] Credentials missing or placeholder — in-memory storage'
    );
    return null;
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } =
    process.env;

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    }
    db = admin.firestore();
    return db;
  } catch (err) {
    console.warn('[firebase] Init failed — in-memory storage:', err.message);
    return null;
  }
}

export function getDb() {
  return db;
}

/** In-memory store when Firestore is not configured */
const memoryStore = {
  meals: new Map(),
  challenges: new Map(),
  reminders: new Map(),
};

export const memory = memoryStore;
