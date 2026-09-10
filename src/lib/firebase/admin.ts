import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

let app: App | undefined;

export class AdminConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminConfigError";
  }
}

type ServiceAccount = { project_id?: string; client_email?: string; private_key?: string };

/**
 * Accepts the raw JSON object, or the same JSON stored as a quoted string
 * (how the Vercel dashboard often ends up saving it), with either real or
 * escaped newlines in the private key.
 */
function parseServiceAccount(raw: string): ServiceAccount {
  let value: unknown = raw.trim();
  for (let i = 0; i < 3 && typeof value === "string"; i += 1) {
    const text = value as string;
    try {
      value = JSON.parse(text);
    } catch {
      try {
        value = JSON.parse(text.replace(/\r?\n/g, "\\n"));
      } catch {
        break;
      }
    }
  }
  if (!value || typeof value !== "object") {
    throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  return value as ServiceAccount;
}

function initAdmin(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "bonus-academy";
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  }

  const parsed = parseServiceAccount(json);
  if (!parsed.client_email || !parsed.private_key) {
    throw new AdminConfigError("FIREBASE_SERVICE_ACCOUNT_JSON is missing client_email/private_key");
  }
  app = initializeApp({
    credential: cert({
      projectId: parsed.project_id ?? projectId,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key?.replace(/\\n/g, "\n"),
    }),
    projectId: parsed.project_id ?? projectId,
    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
      `${parsed.project_id ?? projectId}.appspot.com`,
  });
  return app;
}

export function getAdminDb(): Firestore {
  return getFirestore(initAdmin());
}

export function getAdminAuth(): Auth {
  return getAuth(initAdmin());
}

export function getAdminStorage(): Storage {
  return getStorage(initAdmin());
}
