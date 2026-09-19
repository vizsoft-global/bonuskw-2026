/**
 * Firebase App Check bootstrap.
 *
 * App Check has to be installed on the app before any Firestore request goes
 * out: once enforcement is enabled in the Firebase console, clients that cannot
 * produce a token are rejected. That is what blocks the retired Flutter
 * Android/iOS builds, which have no App Check at all.
 *
 * Inert until NEXT_PUBLIC_RECAPTCHA_SITE_KEY is set, so it can ship before
 * enforcement is switched on. Kept identical to the copy in bonuskw-admin.
 */

import { getApp, getApps, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const RETRY_MS = 250;
const MAX_RETRIES = 40;

let installed = false;
let retries = 0;

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  }
}

function appInstance(): FirebaseApp | null {
  return getApps().length > 0 ? getApp() : null;
}

export function ensureAppCheck(): void {
  if (installed || typeof window === "undefined") {
    return;
  }

  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  if (!siteKey) {
    return;
  }

  const app = appInstance();
  if (!app) {
    // `@/lib/firebase/client` creates the app on first use; wait for it.
    if (retries < MAX_RETRIES) {
      retries += 1;
      window.setTimeout(ensureAppCheck, RETRY_MS);
    }
    return;
  }

  try {
    const debugToken = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN?.trim();
    if (debugToken) {
      window.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }

    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    installed = true;
  } catch {
    // App Check bootstrap must never break the app.
  }
}
