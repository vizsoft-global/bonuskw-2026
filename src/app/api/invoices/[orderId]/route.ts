import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/firebase/collections";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { verifyIdToken } from "@/lib/server/auth";
import { simplePdf } from "@/lib/server/pdf";
import type { OrderDoc } from "@/lib/types/firestore";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ orderId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const user = await verifyIdToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orderId } = await ctx.params;
  const db = getAdminDb();
  const orderSnap = await db.collection(collections.orders).doc(orderId).get();
  if (!orderSnap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = orderSnap.data() as OrderDoc;
  if (order.userRef?.id !== user.uid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const invoiceRef = db.collection(collections.invoices).doc(orderId);
  const existing = await invoiceRef.get();
  if (existing.exists && existing.get("storagePath")) {
    const [url] = await getAdminStorage()
      .bucket()
      .file(String(existing.get("storagePath")))
      .getSignedUrl({ action: "read", expires: Date.now() + 10 * 60 * 1000 });
    return NextResponse.json({ url });
  }

  const lines = (order.lines ?? []).map(
    (line, i) => `${i + 1}. ${line.courseName || line.kind} — ${line.amountNow} KWD`,
  );
  const pdf = simplePdf([
    "Bonus Academy",
    `Invoice ${order.orderID || orderId}`,
    `Status: ${order.status || ""}`,
    `Total due: ${order.dueNow ?? order.cartTotal ?? 0} KWD`,
    ...lines,
  ]);
  const storagePath = `invoices/${user.uid}/${orderId}.pdf`;
  await getAdminStorage().bucket().file(storagePath).save(pdf, {
    contentType: "application/pdf",
  });
  await invoiceRef.set({
    orderId,
    userRef: db.collection(collections.users).doc(user.uid),
    number: order.orderID || orderId,
    storagePath,
    issuedAt: FieldValue.serverTimestamp(),
  });
  const [url] = await getAdminStorage()
    .bucket()
    .file(storagePath)
    .getSignedUrl({ action: "read", expires: Date.now() + 10 * 60 * 1000 });
  return NextResponse.json({ url });
}
