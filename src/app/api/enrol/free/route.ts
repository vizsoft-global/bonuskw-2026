import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyIdToken } from "@/lib/server/auth";
import type { BatchDoc, CourseDoc } from "@/lib/types/firestore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { courseId?: string };
  if (!body.courseId) return NextResponse.json({ error: "courseId required" }, { status: 400 });

  const db = getAdminDb();
  const courseRef = db.collection(collections.course).doc(body.courseId);
  const courseSnap = await courseRef.get();
  if (!courseSnap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const course = courseSnap.data() as CourseDoc;
  if (course.coursePaymentType !== "Free" && Number(course.price) > 0) {
    return NextResponse.json({ error: "This course is paid" }, { status: 400 });
  }

  const userRef = db.collection(collections.users).doc(user.uid);
  const existing = await db
    .collection(collections.subscription)
    .where("userRef", "==", userRef)
    .where("courseRef", "==", courseRef)
    .limit(1)
    .get();
  if (!existing.empty) return NextResponse.json({ ok: true, already: true });

  let batchesRef = course.batchesRef
    ? db.collection(collections.batches).doc(course.batchesRef.id)
    : null;
  if (batchesRef) {
    const batch = (await batchesRef.get()).data() as BatchDoc | undefined;
    if (!batch || batch.status !== "Ongoing") {
      return NextResponse.json({ error: "No batch is running" }, { status: 400 });
    }
  }

  await db.collection(collections.subscription).add({
    userRef,
    courseRef,
    batchesRef,
    startDate: FieldValue.serverTimestamp(),
    paymentType: "Full payment",
    payment_status: "CAPTURED",
    status: "Ongoing",
  });
  await courseRef.set({ bookedCount: FieldValue.increment(1) }, { merge: true });
  return NextResponse.json({ ok: true });
}
