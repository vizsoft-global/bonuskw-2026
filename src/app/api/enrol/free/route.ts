import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyIdToken } from "@/lib/server/auth";
import type { BatchDoc, CourseDoc, PurchaseControls, UserDoc } from "@/lib/types/firestore";
import { canPurchase } from "@/lib/auth/purchase-access";
import { batchIsLive } from "@/lib/course/access-window";
import { isPublished } from "@/lib/course/status";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { courseId?: string };
  if (!body.courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

  const db = getAdminDb();
  // Staff accounts browse only; see purchase-access.ts.
  const profile = (await db.collection(collections.users).doc(user.uid).get()).data() as UserDoc | undefined;
  if (!canPurchase(profile)) {
    return NextResponse.json(
      { error: "Instructor and admin accounts cannot enrol", code: "staff-account" },
      { status: 403 },
    );
  }
  // Fail-safe switches (Settings > Purchases & dev mode). Dev-mode testers may
  // enrol, but their subscription is stamped as a test record.
  const controls = ((await db.collection(collections.adminConfig).doc("studentApp").get()).data()?.purchases ??
    {}) as PurchaseControls;
  const tester = controls.devMode === true && profile?.devTester === true;
  if (!tester && (controls.catalogMode || controls.coursesOff)) {
    return NextResponse.json(
      {
        error: controls.catalogMode
          ? "Purchases are paused right now. Please check back soon."
          : "Course enrolment is paused right now. Please check back soon.",
        code: controls.catalogMode ? "purchases-disabled" : "courses-disabled",
      },
      { status: 403 },
    );
  }
  const courseRef = db.collection(collections.course).doc(body.courseId);
  const courseSnap = await courseRef.get();
  if (!courseSnap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const course = courseSnap.data() as CourseDoc;
  if (course.coursePaymentType !== "Free" && Number(course.price) > 0) {
    return NextResponse.json({ error: "This course is paid" }, { status: 400 });
  }

  const userRef = db.collection(collections.users).doc(user.uid);
  // Only a live enrolment counts as "already in": a student whose earlier
  // term was archived may enrol again in the new batch.
  const existing = await db
    .collection(collections.subscription)
    .where("userRef", "==", userRef)
    .where("courseRef", "==", courseRef)
    .where("status", "==", "Ongoing")
    .limit(1)
    .get();
  if (!existing.empty) return NextResponse.json({ ok: true, already: true });

  // Enrolment needs a published course linked to a batch that is running.
  if (course.trashed || !isPublished(course) || !course.batchesRef) {
    return NextResponse.json({ error: "No batch is running" }, { status: 400 });
  }
  const batchesRef = db.collection(collections.batches).doc(course.batchesRef.id);
  const batch = (await batchesRef.get()).data() as BatchDoc | undefined;
  if (!batchIsLive(batch)) {
    return NextResponse.json({ error: "No batch is running" }, { status: 400 });
  }

  await db.collection(collections.subscription).add({
    userRef,
    courseRef,
    batchesRef,
    startDate: FieldValue.serverTimestamp(),
    paymentType: "Full payment",
    payment_status: "CAPTURED",
    status: "Ongoing",
    ...(tester ? { isTest: true, devSession: true } : {}),
  });
  await courseRef.set({ bookedCount: FieldValue.increment(1) }, { merge: true });
  return NextResponse.json({ ok: true });
}
