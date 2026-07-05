// Firebase client init for Ranked mode's live matchmaking + match sync.
// Reads config from NEXT_PUBLIC_FIREBASE_* env vars (see .env.local.example) —
// until those are set, isFirebaseConfigured stays false and Ranked mode shows
// a "not set up yet" state instead of crashing.
import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const config = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = !!(config.apiKey && config.databaseURL);

let dbInstance = null;
export function getDb() {
  if (!isFirebaseConfigured || typeof window === "undefined") return null;
  if (!dbInstance) {
    const app = getApps().length ? getApps()[0] : initializeApp(config);
    dbInstance = getDatabase(app);
  }
  return dbInstance;
}
