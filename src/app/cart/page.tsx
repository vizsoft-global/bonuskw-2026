"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadCart, saveCart, type CartLine, type CartState } from "@/lib/cart/store";
import { formatKwdLocale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";

export default function CartPage() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [cart, setCart] = useState<CartState>({ lines: [], savedForLater: [] });
  const [quote, setQuote] = useState<{ dueNow?: number; suggestions?: Array<{ name?: string }> } | null>(null);
  const [coupon, setCoupon] = useState("");

  useEffect(() => {
    if (!user) return;
    void loadCart(user.uid).then((next) => {
      setCart(next);
      setCoupon(next.couponCode || "");
    });
  }, [user]);

  async function persist(next: CartState) {
    if (!user) return;
    setCart(next);
    await saveCart(user.uid, next);
  }

  async function refreshQuote(next = cart) {
    if (!user) return;
    const token = await user.getIdToken();
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
        couponCode: next.couponCode,
      }),
    });
    setQuote(await res.json());
  }

  function setPay(line: CartLine, paymentType: "Full payment" | "EMI") {
    if (line.kind !== "course") return;
    void persist({
      ...cart,
      lines: cart.lines.map((item) =>
        item.courseId === line.courseId && item.kind === line.kind ? { ...item, paymentType } : item,
      ),
    });
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-semibold">{t("cart")}</h1>
      <div className="space-y-3">
        {cart.lines.map((line) => (
          <div key={`${line.kind}-${line.courseId}`} className="glass flex items-center justify-between gap-3 rounded-3xl p-3">
            <div>
              <p className="font-medium">{line.title || line.courseId}</p>
              <p className="text-sm text-muted">{formatKwdLocale(line.price, locale)}</p>
              {line.kind === "course" ? (
                <div className="mt-2 flex gap-2 text-xs">
                  <button type="button" onClick={() => setPay(line, "Full payment")}>{t("fullPay")}</button>
                  <button type="button" onClick={() => setPay(line, "EMI")}>{t("emi")}</button>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <button
                type="button"
                onClick={() =>
                  void persist({
                    lines: cart.lines.filter((item) => item !== line),
                    savedForLater: [...cart.savedForLater, line],
                  })
                }
              >
                {t("saveLater")}
              </button>
              <button
                type="button"
                onClick={() => void persist({ ...cart, lines: cart.lines.filter((item) => item !== line) })}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder={t("coupon")} className="flex-1 rounded-full border border-line bg-transparent px-3 py-2" />
        <button type="button" onClick={() => void persist({ ...cart, couponCode: coupon }).then(() => refreshQuote({ ...cart, couponCode: coupon }))}>
          {t("apply")}
        </button>
      </div>
      {(quote?.suggestions ?? []).map((item, i) => (
        <p key={i} className="mt-2 text-sm text-primary">{item.name}</p>
      ))}
      <p className="mt-4 text-lg font-semibold">{formatKwdLocale(quote?.dueNow, locale)}</p>
      <Link href="/checkout" className="mt-4 inline-block rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white">
        {t("checkout")}
      </Link>
      {cart.savedForLater.length ? <h2 className="mt-8 font-semibold">{t("saved")}</h2> : null}
      {cart.savedForLater.map((line) => (
        <button
          key={`saved-${line.courseId}`}
          type="button"
          className="mt-2 block text-sm"
          onClick={() =>
            void persist({
              lines: [...cart.lines, line],
              savedForLater: cart.savedForLater.filter((item) => item !== line),
              couponCode: cart.couponCode,
            })
          }
        >
          {t("moveToCart")} · {line.title}
        </button>
      ))}
    </AppShell>
  );
}
