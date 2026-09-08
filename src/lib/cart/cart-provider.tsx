"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  emptyCart,
  hasLine,
  lineKey,
  loadCart,
  moveToCart,
  moveToSaved,
  removeLine,
  saveCart,
  setPaymentType,
  upsertLine,
  type CartLine,
  type CartPaymentType,
  type CartState,
} from "./store";

type CartContextValue = {
  cart: CartState;
  count: number;
  loading: boolean;
  add: (line: Omit<CartLine, "addedAt">) => Promise<void>;
  remove: (key: string) => Promise<void>;
  saveForLater: (key: string) => Promise<void>;
  restore: (key: string) => Promise<void>;
  setPayment: (key: string, paymentType: CartPaymentType) => Promise<void>;
  setCoupon: (code?: string) => Promise<void>;
  clear: () => Promise<void>;
  inCart: (line: Pick<CartLine, "kind" | "courseId" | "chapterId" | "installmentId">) => boolean;
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartState>(emptyCart);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setCart(emptyCart);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setCart(await loadCart(user.uid));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const commit = useCallback(
    async (next: CartState) => {
      setCart(next);
      if (user) await saveCart(user.uid, next);
    },
    [user],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      count: cart.lines.length,
      loading,
      add: (line) => commit(upsertLine(cart, { ...line, addedAt: Date.now() })),
      remove: (key) => commit(removeLine(cart, key)),
      saveForLater: (key) => commit(moveToSaved(cart, key)),
      restore: (key) => commit(moveToCart(cart, key)),
      setPayment: (key, paymentType) => commit(setPaymentType(cart, key, paymentType)),
      setCoupon: (code) => commit({ ...cart, couponCode: code || undefined }),
      clear: () => commit({ ...emptyCart, savedForLater: cart.savedForLater }),
      inCart: (line) => hasLine(cart, lineKey(line)),
      refresh,
    }),
    [cart, loading, commit, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
