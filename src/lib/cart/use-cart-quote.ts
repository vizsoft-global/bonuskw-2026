"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-provider";
import { type Quote } from "@/lib/cart/quote";
import { loadCart, type CartState } from "@/lib/cart/store";

function cartKey(cart: CartState | undefined) {
  if (!cart) return "";
  return [
    cart.couponCode || "",
    ...cart.lines.map((line) =>
      [line.kind, line.courseId, line.chapterId || "", line.installmentId || "", line.paymentType].join(":"),
    ),
  ].join("|");
}

/**
 * The priced cart: subtotal, the offer that applied, and what is due now.
 * Shares the ["cart"] query with the header so it refreshes after every add
 * or removal.
 */
export function useCartQuote() {
  const { user } = useAuth();
  const uid = user?.uid;
  const cart = useQuery({
    queryKey: ["cart", uid],
    enabled: Boolean(uid),
    queryFn: () => loadCart(uid!),
  });
  const key = cartKey(cart.data);
  const quote = useQuery({
    queryKey: ["cart-quote", uid, key],
    enabled: Boolean(uid) && Boolean(cart.data?.lines.length),
    staleTime: 30_000,
    queryFn: async (): Promise<Quote | null> => {
      const token = await user!.getIdToken();
      const next = cart.data!;
      const res = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: next.lines.map((line) => ({
            kind: line.kind,
            courseId: line.courseId,
            chapterId: line.chapterId,
            installmentId: line.installmentId,
            paymentType: line.paymentType,
          })),
          couponCode: next.couponCode?.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as Quote | null;
      if (!res.ok || !body || body.error) return null;
      return body;
    },
  });
  return { cart: cart.data, quote: quote.data ?? null, quoting: cart.isFetched && quote.isFetching };
}
