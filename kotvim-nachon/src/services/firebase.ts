import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';

/**
 * Firebase is optional: without VITE_FIREBASE_CONFIG the app runs in "device only" mode
 * and keeps everything in local storage.
 */
function readConfig(): Record<string, string> | null {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw);
    return cfg && cfg.apiKey ? cfg : null;
  } catch {
    console.warn('VITE_FIREBASE_CONFIG is not valid JSON');
    return null;
  }
}

const config = readConfig();
export const firebaseEnabled = !!config;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let fns: Functions | null = null;

if (config) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = initializeFirestore(app, { localCache: persistentLocalCache() });
  fns = getFunctions(app, (import.meta.env.VITE_FUNCTIONS_REGION as string) || 'europe-west1');
}

export { app, auth, db, fns };
