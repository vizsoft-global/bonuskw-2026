/** Same public web config as the admin panel and Flutter app. */
export const firebaseWebConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyDhyJLQxvQcFjRNhukHEQr71v8QiBJE_EE",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "bonus-academy.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "bonus-academy",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    "bonus-academy.appspot.com",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "1021620493475",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:1021620493475:web:fa76081866700701373316",
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "G-9YSZK35TP0",
};

export const ALGOLIA_APP_ID =
  process.env.NEXT_PUBLIC_ALGOLIA_APP_ID ?? "2G3N621ZL8";

export const ADMIN_API_BASE =
  process.env.NEXT_PUBLIC_ADMIN_API_BASE ??
  "https://bonus-admin-beta.vercel.app";
