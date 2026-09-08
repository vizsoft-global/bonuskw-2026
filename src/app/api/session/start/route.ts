import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb } from "@/lib/firebase/admin";
import { clientIp, verifyIdToken } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    deviceId?: string;
    os?: string;
    browser?: string;
    model?: string;
  };
  if (!body.deviceId) {
    return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  }

  const db = getAdminDb();
  const uid = user.uid;
  const userRef = db.collection(collections.users).doc(uid);
  const ip = clientIp(req);
  const city = req.headers.get("x-vercel-ip-city") || "";

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
    userEmail: user.email || user.phone_number || "",
    uniqueId: body.deviceId,
    isActive: true,
    loginDateTime: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp(),
    device: body.model || "Web",
    os: body.os || "Web",
    ip,
    location: city,
  });

  const deviceRef = db.collection(collections.userdeviceinfo).doc();
  batch.set(deviceRef, {
    device_user_ref: userRef,
    device_user_email: user.email || user.phone_number || "",
    device_status: "active",
    device_android_version: " ",
    device_ios_version: "web",
    device_info: {
      device_id: body.deviceId,
      device_model: body.model || "Web",
      device_platform: "Web",
      device_login_time: FieldValue.serverTimestamp(),
      browser: body.browser || "",
    },
  });

  await batch.commit();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recent = await db
    .collection(collections.userdeviceinfo)
    .where("device_user_ref", "==", userRef)
    .limit(40)
    .get();
  const devices = new Set<string>();
  const cities = new Set<string>();
  recent.docs.forEach((doc) => {
    const info = doc.get("device_info") as { device_id?: string } | undefined;
    if (info?.device_id) devices.add(info.device_id);
  });
  if (city) cities.add(city);

  const policySnap = await db.collection(collections.adminConfig).doc("studentPolicy").get();
  const policy = (policySnap.data() ?? {}) as {
    maxDevices30d?: number;
    maxCitiesPerDay?: number;
  };
  const maxDevices = policy.maxDevices30d ?? 4;
  const reasons: string[] = [];
  if (devices.size > maxDevices) reasons.push(`${devices.size} devices in 30 days`);
  if (cities.size > (policy.maxCitiesPerDay ?? 2)) reasons.push("logins from multiple cities");
  if (reasons.length) {
    await userRef.set(
      { deviceFlag: { level: "review", reason: reasons.join("; "), at: FieldValue.serverTimestamp() } },
      { merge: true },
    );
    await db.collection(collections.deviceFlags).doc(uid).set(
      {
        userRef,
        level: "review",
        reason: reasons.join("; "),
        deviceCount: devices.size,
        cleared: false,
        updatedAt: FieldValue.serverTimestamp(),
        windowStart: since,
      },
      { merge: true },
    );
  }

  return NextResponse.json({ sessionId: sessionRef.id });
}
