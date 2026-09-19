import "server-only";
import {
  FieldValue,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";

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

/*
 * Device and city limits were retired. Sessions never expire now and the only
 * rule is one live session at a time (see `startSession`). Nothing in either app
 * ever read the flags these used to write, so the policy is gone rather than
 * relaxed — a limit that silently signs people out is worse than no limit.
 */

/*
 * Nothing forces a sign-out any more. The only way a session ends without the
 * student tapping sign out is a take-over from another device (which the student
 * themself chose), a stale session nobody has heartbeated for 15 minutes, or an
 * admin kick. Each of those is recorded on the `sessions` row as
 * `endedBy` / `endedFrom` / `endedAt` so admin Activity can show who ended it.
 */

/** Another device's session as shown in the "already signed in" prompt. */
export type ConflictingSession = {
  id: string;
  label: string;
  os: string;
  browser: string;
  location: string;
  /** ISO time of the last heartbeat (or login), null when unknown. */
  lastSeenAt: string | null;
  /** Heartbeat within the live window — someone is probably using it right now. */
  live: boolean;
};

/** Heartbeats arrive every 5 minutes; treat anything newer than this as in use. */
export const LIVE_WINDOW_MS = 15 * 60 * 1000;

function lastActivity(doc: QueryDocumentSnapshot) {
  return toDate(doc.get("lastSeenAt") as DateLike) ?? toDate(doc.get("loginDateTime") as DateLike);
}

/**
 * A session counts as in use only while it keeps heartbeating. A session left
 * behind by a closed tab, a wiped browser or an abandoned phone stops being
 * live after this window, so it can no longer force a take-over prompt on the
 * device someone is actually using.
 */
function isLive(doc: QueryDocumentSnapshot, now: number) {
  const seen = lastActivity(doc);
  return Boolean(seen && now - seen.getTime() < LIVE_WINDOW_MS);
}

export type StartSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; conflict: ConflictingSession[] };

/**
 * Starts a session for this device. A session on a *different* device blocks the
 * sign-in only while that device is still heartbeating (see `isLive`); the caller
 * then passes `force` to take over, and the other device is signed out because
 * its `sessions` doc flips to isActive:false. The same device signing in again —
 * reload, new tab, PWA relaunch, or after its storage was cleared — never
 * conflicts, and sessions nobody is using are closed quietly.
 */
export async function startSession(
  identity: SessionIdentity,
  input: StartSessionInput,
  opts: { force?: boolean } = {},
): Promise<StartSessionResult> {
  const db = getAdminDb();
  const userRef = db.collection(collections.users).doc(identity.uid);
  const contact = identity.email || identity.phone || "";
  const model = input.model || "Web";

  const active = await db
    .collection(collections.sessions)
    .where("userref", "==", userRef)
    .where("isActive", "==", true)
    .get();

  const now = Date.now();
  // A wiped browser hands out a new device id (iOS ITP, private mode, cleared
  // storage). Same model, browser and IP is the same device, so it must not read
  // as a second sign-in and trigger a take-over prompt.
  const myFingerprint = [input.model || "Web", input.os || "Web", input.browser || "", input.ip]
    .map((v) => String(v ?? "").trim().toLowerCase())
    .join("|");
  const fingerprintOf = (doc: QueryDocumentSnapshot) =>
    ["device", "os", "browser", "ip"]
      .map((key) => String(doc.get(key) ?? "").trim().toLowerCase())
      .join("|");
  const rows = active.docs.map((doc) => ({
    doc,
    deviceId: String(doc.get("uniqueId") ?? ""),
    sameDevice:
      String(doc.get("uniqueId") ?? "") === input.deviceId || fingerprintOf(doc) === myFingerprint,
    live: isLive(doc, now),
  }));

  // Only a session that is still heartbeating on another device blocks sign-in.
  // Sessions left behind by a closed tab, a wiped browser or an abandoned phone
  // are closed out quietly and the login continues — they used to keep forcing
  // the take-over prompt, and taking over signed the student's real device out.
  const liveOthers = rows.filter((row) => !row.sameDevice && row.live);
  if (liveOthers.length && !opts.force) {
    const conflict: ConflictingSession[] = liveOthers
      .map((row) => {
        const os = String(row.doc.get("os") ?? "");
        const browser = String(row.doc.get("browser") ?? "");
        const seen = lastActivity(row.doc);
        return {
          id: row.doc.id,
          label:
            String(row.doc.get("device") ?? "") ||
            [browser, os].filter(Boolean).join(" on ") ||
            "Device",
          os,
          browser,
          location: String(row.doc.get("location") ?? ""),
          lastSeenAt: seen?.toISOString() ?? null,
          live: true,
        };
      })
      .sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? ""));
    return { ok: false, conflict };
  }

  // Same browser again (new tab, reload, PWA relaunch): keep the session it
  // already has instead of replacing it. Replacing flipped the old doc to
  // isActive:false, and a tab still listening to it signed the whole browser
  // out — Firebase auth state is shared across tabs.
  const mine = rows
    .filter((row) => row.sameDevice)
    .sort((a, b) => {
      const at = toDate(a.doc.get("loginDateTime") as DateLike)?.getTime() ?? 0;
      const bt = toDate(b.doc.get("loginDateTime") as DateLike)?.getTime() ?? 0;
      return bt - at;
    });
  const keep = mine[0] ?? null;

  const batch = db.batch();
  rows.forEach((row) => {
    if (keep && row.doc.id === keep.doc.id) return;
    const sameDevice = row.sameDevice;
    const endedBy = sameDevice ? "duplicate" : row.live ? "takeover" : "stale";
    batch.update(row.doc.ref, {
      isActive: false,
      endedAt: FieldValue.serverTimestamp(),
      // takeover = the student chose this device over a live one; stale =
      // nobody had used it for a while; duplicate = another tab beat it here.
      endedBy,
      // Plain-language cause, so admin Activity can show why a session ended
      // without re-deriving it from the counters.
      endedReason:
        endedBy === "takeover"
          ? `Signed in on ${model}`
          : endedBy === "stale"
            ? "Expired after 15 minutes without activity"
            : "Closed — this device signed in again",
      ...(row.live && !sameDevice ? { endedFrom: model } : {}),
    });
  });

  if (keep) {
    batch.update(keep.doc.ref, { lastSeenAt: FieldValue.serverTimestamp() });
    await batch.commit();
    return { ok: true, sessionId: keep.doc.id };
  }

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
  return { ok: true, sessionId: sessionRef.id };
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

export async function kickSession(uid: string, sessionId: string, by: "self" | "self-other" = "self") {
  const owned = await ownedSession(uid, sessionId);
  if (!owned) return false;
  await owned.ref.update({
    isActive: false,
    endedAt: FieldValue.serverTimestamp(),
    endedBy: by,
    endedReason: by === "self-other" ? "Signed out from the devices list" : "Signed out",
  });
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
