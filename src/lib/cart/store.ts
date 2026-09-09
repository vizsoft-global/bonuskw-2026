"use client";

import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";

export type CartLineKind = "course" | "chapter" | "ebook" | "installment";
export type CartPaymentType = "Full payment" | "EMI";

export type CartLine = {
  kind: CartLineKind;
  courseId: string;
  chapterId?: string;
  installmentId?: string;
  paymentType: CartPaymentType;
  /** Denormalised for instant rendering; the quote API is the source of truth for money. */
  title?: string;
  image?: string;
  price?: number;
  emiPrices?: [number, number, number];
  emiAvailable?: boolean;
  batch?: string;
  addedAt: number;
};

export type CartState = {
  lines: CartLine[];
  savedForLater: CartLine[];
  couponCode?: string;
  updatedAt?: number;
};

export const emptyCart: CartState = { lines: [], savedForLater: [] };

export function lineKey(line: Pick<CartLine, "kind" | "courseId" | "chapterId" | "installmentId">) {
  return `${line.kind}:${line.courseId}:${line.chapterId || ""}:${line.installmentId || ""}`;
}

export async function loadCart(uid: string): Promise<CartState> {
  const snap = await getDoc(doc(getDb(), collections.userCart, uid));
  if (!snap.exists()) return emptyCart;
  const data = snap.data() as Partial<CartState>;
  return {
    lines: Array.isArray(data.lines) ? data.lines : [],
    savedForLater: Array.isArray(data.savedForLater) ? data.savedForLater : [],
    couponCode: data.couponCode,
    updatedAt: data.updatedAt,
  };
}

function compactLine(line: CartLine): CartLine {
  return Object.fromEntries(Object.entries(line).filter(([, value]) => value !== undefined)) as CartLine;
}

export async function saveCart(uid: string, cart: CartState) {
  const payload: CartState = {
    ...cart,
    lines: cart.lines.map(compactLine),
    savedForLater: cart.savedForLater.map(compactLine),
    couponCode: cart.couponCode ?? "",
    updatedAt: Date.now(),
  };
  await setDoc(doc(getDb(), collections.userCart, uid), payload, { merge: true });
  return payload;
}

export function upsertLine(cart: CartState, line: CartLine): CartState {
  const key = lineKey(line);
  const lines = cart.lines.filter((item) => lineKey(item) !== key);
  const savedForLater = cart.savedForLater.filter((item) => lineKey(item) !== key);
  return { ...cart, lines: [...lines, line], savedForLater };
}

export function removeLine(cart: CartState, key: string): CartState {
  return {
    ...cart,
    lines: cart.lines.filter((item) => lineKey(item) !== key),
    savedForLater: cart.savedForLater.filter((item) => lineKey(item) !== key),
  };
}

export function moveToSaved(cart: CartState, key: string): CartState {
  const line = cart.lines.find((item) => lineKey(item) === key);
  if (!line) return cart;
  return {
    ...cart,
    lines: cart.lines.filter((item) => lineKey(item) !== key),
    savedForLater: [...cart.savedForLater.filter((item) => lineKey(item) !== key), line],
  };
}

export function moveToCart(cart: CartState, key: string): CartState {
  const line = cart.savedForLater.find((item) => lineKey(item) === key);
  if (!line) return cart;
  return upsertLine(
    { ...cart, savedForLater: cart.savedForLater.filter((item) => lineKey(item) !== key) },
    { ...line, addedAt: Date.now() },
  );
}

export function setPaymentType(cart: CartState, key: string, paymentType: CartPaymentType): CartState {
  return {
    ...cart,
    lines: cart.lines.map((item) => (lineKey(item) === key ? { ...item, paymentType } : item)),
  };
}

export function hasLine(cart: CartState, key: string) {
  return cart.lines.some((item) => lineKey(item) === key);
}
