"use client";

import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";

export type CartLine = {
  kind: "course" | "chapter" | "ebook" | "installment";
  courseId: string;
  chapterId?: string;
  installmentId?: string;
  paymentType: "Full payment" | "EMI";
  title?: string;
  image?: string;
  price?: number;
  addedAt: number;
};

export type CartState = {
  lines: CartLine[];
  savedForLater: CartLine[];
  couponCode?: string;
};

const empty: CartState = { lines: [], savedForLater: [] };

export async function loadCart(uid: string): Promise<CartState> {
  const snap = await getDoc(doc(getDb(), collections.userCart, uid));
  if (!snap.exists()) return empty;
  const data = snap.data() as Partial<CartState>;
  return {
    lines: data.lines ?? [],
    savedForLater: data.savedForLater ?? [],
    couponCode: data.couponCode,
  };
}

export async function saveCart(uid: string, cart: CartState) {
  await setDoc(doc(getDb(), collections.userCart, uid), cart, { merge: true });
}

export function upsertLine(cart: CartState, line: CartLine) {
  const key = `${line.kind}:${line.courseId}:${line.chapterId || ""}`;
  const lines = cart.lines.filter(
    (item) => `${item.kind}:${item.courseId}:${item.chapterId || ""}` !== key,
  );
  return { ...cart, lines: [...lines, line] };
}
