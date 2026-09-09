import "server-only";
import { FieldValue, type DocumentReference, type Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEVICE_WINDOW_MS = 30 * DAY_MS;
const DEFAULT_MAX_DEVICES = 4;
const DEFAULT_MAX_CITIES = 2;

export type SessionIdentity = {
  uid: string;
  email?: string;
  phone?: string;
};

export type StartSessionInput = {
  deviceId: string;
  os?: string;
  browser?: string;
  model?: string;
  ip: string;
  city: string;
};

export type DevicePolicy = { maxDevices30d: number; maxCitiesPerDay: number };

export type DeviceEntry = {
  id: string;
  kind: "session" | "device";
  label: string;
  os: string;
  browser: string;
  ip: string;
  location: string;
  at: string | null;
  isActive: boolean;
  isCurrent: boolean;
};

type DateLike = Timestamp | Date | { toDate?: () => Date } | undefined | null;

function toDate(value: DateLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  return null;
}

export async function readDevicePolicy(): Promise<DevicePolicy> {
  const snap = await getAdminDb().collection(collections.adminConfig).doc("studentApp").get();
  const policy = (snap.get("devicePolicy") ?? {}) as Partial<DevicePolicy>;
  return {
    maxDevices30d:
      typeof policy.maxDevices30d === "number" && policy.maxDevices30d > 0
        ? policy.maxDevices30d
        : DEFAULT_MAX_DEVICES,
    maxCitiesPerDay:
      typeof policy.maxCitiesPerDay === "number" && policy.maxCitiesPerDay > 0
        ? policy.maxCitiesPerDay
        : DEFAULT_MAX_CITIES,
  };
}

export async function evaluateDeviceFlags(uid: string, currentCity: string) {
  const db = getAdminDb();
  const userRef = db.collection(collections.users).doc(uid);
  const now = Date.now();
  const windowStart = new Date(now - DEVICE_WINDOW_MS);
  const dayStart = new Date(now - DAY_MS);

  const [policy, deviceSnap, sessionSnap] = await Promise.all([
    readDevicePolicy(),
    db
      .collection(collections.userdeviceinfo)
      .where("device_user_ref", "==", userRef)
      .limit(100)
      .get(),
    db.collection(collections.sessions).where("userref", "==", userRef).limit(200).get(),
  ]);

  const devices = new Set<string>();
  deviceSnap.docs.forEach((doc) => {
    const info = doc.get("device_info") as
      | { device_id?: string; device_login_time?: DateLike }
      | undefined;
    const loginAt = toDate(info?.device_login_time);
    if (!info?.device_id || !loginAt || loginAt < windowStart) return;
    devices.add(info.device_id);
  });

  const cities = new Set<string>();
  sessionSnap.docs.forEach((doc) => {
    const loginAt = toDate(doc.get("loginDateTime") as DateLike);
    if (!loginAt || loginAt < dayStart) return;
    const city = String(doc.get("location") ?? "").trim();
    if (city) cities.add(city.toLowerCase());
  });
  if (currentCity) cities.add(currentCity.toLowerCase());

  const reasons: string[] = [];
  if (devices.size > policy.maxDevices30d) reasons.push(`${devices.size} devices in 30 days`);
  if (cities.size > policy.maxCitiesPerDay) reasons.push(`${cities.size} cities in 24 hours`);
  if (!reasons.length) return { flagged: false as const, deviceCount: devices.size };

  const reason = reasons.join("; ");
  await Promise.all([
    userRef.set(
      { deviceFlag: { level: "review", reason, at: FieldValue.serverTimestamp() } },
      { merge: true },
    ),
    db.collection(collections.deviceFlags).doc(uid).set(
      {
        userRef,
        level: "review",
        reason,
        deviceCount: devices.size,
        cityCount: cities.size,
        cleared: false,
        updatedAt: FieldValue.serverTimestamp(),
        windowStart,
      },
      { merge: true },
    ),
  ]);
  return { flagged: true as const, deviceCount: devices.size };
}

export async function startSession(identity: SessionIdentity, input: StartSessionInput) {
  const db = getAdminDb();
  const userRef = db.collection(collections.users).doc(identity.uid);
  const contact = identity.email || identity.phone || "";
  const model = input.model || "Web";

  const active = await db
    .collection(collections.sessions)
    .where("userref", "==", userRef)
    .where("isActive", "==", true)
    .get();

  const batch = db.batch();
  active.docs.forEach((doc) => batch.update(doc.ref, { isActive: false }));

  const sessionRef = db.collection(collections.sessions).doc();
  batch.set(sessionRef, {
    userref: userRef,
    userEmail: contact,
    uniqueId: input.deviceId,
    isActive: true,
    loginDateTime: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp(),
    device: model,
    os: input.os || "Web",
    browser: input.browser || "",
    ip: input.ip,
    location: input.city,
  });

  const deviceRef = db.collection(collections.userdeviceinfo).doc();
  batch.set(deviceRef, {
    device_user_ref: userRef,
    device_user_email: contact,
    device_status: "active",
    device_android_version: " ",
    device_ios_version: "web",
    device_info: {
      device_id: input.deviceId,
      device_model: model,
      device_platform: "Web",
      device_login_time: FieldValue.serverTimestamp(),
      browser: input.browser || "",
      os: input.os || "Web",
      ip: input.ip,
      location: input.city,
    },
  });

  await batch.commit();
  try {
    await evaluateDeviceFlags(identity.uid, input.city);
  } catch (err) {
    console.error("evaluateDeviceFlags failed", err instanceof Error ? err.message : err);
  }
  return sessionRef.id;
}

async function ownedSession(uid: string, sessionId: string) {
  const ref = getAdminDb().collection(collections.sessions).doc(sessionId);
  const snap = await ref.get();
  const owner = snap.get("userref") as DocumentReference | undefined;
  if (!snap.exists || owner?.id !== uid) return null;
  return { ref, snap };
}

export async function heartbeat(uid: string, sessionId: string) {
  const owned = await ownedSession(uid, sessionId);
  if (!owned) return null;
  await owned.ref.update({ lastSeenAt: FieldValue.serverTimestamp() });
  return { isActive: owned.snap.get("isActive") !== false };
}

export async function kickSession(uid: string, sessionId: string) {
  const owned = await ownedSession(uid, sessionId);
  if (!owned) return false;
  await owned.ref.update({ isActive: false, endedAt: FieldValue.serverTimestamp() });
  return true;
}

export async function listDevices(uid: string, currentDeviceId: string): Promise<DeviceEntry[]> {
  const db = getAdminDb();
  const userRef = db.collection(collections.users).doc(uid);
  const [sessionSnap, deviceSnap] = await Promise.all([
    db.collection(collections.sessions).where("userref", "==", userRef).limit(200).get(),
    db
      .collection(collections.userdeviceinfo)
      .where("device_user_ref", "==", userRef)
      .limit(100)
      .get(),
  ]);

  const sessions: DeviceEntry[] = sessionSnap.docs.map((doc) => {
    const deviceId = String(doc.get("uniqueId") ?? "");
    const os = String(doc.get("os") ?? "");
    const browser = String(doc.get("browser") ?? "");
    return {
      id: doc.id,
      kind: "session",
      label: String(doc.get("device") ?? "") || [browser, os].filter(Boolean).join(" on ") || "Web",
      os,
      browser,
      ip: String(doc.get("ip") ?? ""),
      location: String(doc.get("location") ?? ""),
      at: toDate(doc.get("loginDateTime") as DateLike)?.toISOString() ?? null,
      isActive: doc.get("isActive") !== false,
      isCurrent: Boolean(currentDeviceId) && deviceId === currentDeviceId,
    };
  });
  sessions.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));
  sessions.splice(20);

  const devices: DeviceEntry[] = deviceSnap.docs
    .map((doc) => {
      const info = (doc.get("device_info") ?? {}) as {
        device_id?: string;
        device_model?: string;
        device_platform?: string;
        device_login_time?: DateLike;
        browser?: string;
        os?: string;
        ip?: string;
        location?: string;
      };
      const os = String(info.os ?? info.device_platform ?? "");
      const browser = String(info.browser ?? "");
      return {
        id: doc.id,
        kind: "device" as const,
        label: String(info.device_model ?? "") || [browser, os].filter(Boolean).join(" on ") || "Device",
        os,
        browser,
        ip: String(info.ip ?? ""),
        location: String(info.location ?? ""),
        at: toDate(info.device_login_time)?.toISOString() ?? null,
        isActive: String(doc.get("device_status") ?? "active") === "active",
        isCurrent: Boolean(currentDeviceId) && info.device_id === currentDeviceId,
      };
    })
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return [...sessions, ...devices];
}
