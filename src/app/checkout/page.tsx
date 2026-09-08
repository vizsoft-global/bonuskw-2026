"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadCart } from "@/lib/cart/store";
import { useI18n } from "@/lib/i18n/locale";

export default function CheckoutPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [source, setSource] = useState("src_kw.knet");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) void loadCart(user.uid);
  }, [user]);

  async function pay() {
    if (!user || !accept) return;
    const cart = await loadCart(user.uid);
    const token = await user.getIdToken();
    const res = await fetch("/api/checkout/create", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: cart.lines.map((line) => ({
          kind: line.kind,
          courseId: line.courseId,
          chapterId: line.chapterId,
          installmentId: line.installmentId,
          paymentType: line.paymentType,
        })),
        couponCode: cart.couponCode,
        source,
        redirectUrl: `${window.location.origin}/checkout/return`,
      }),
    });
    const json = (await res.json()) as { redirectUrl?: string; url?: string; error?: string; orderId?: string };
    if (!res.ok) {
      setError(json.error || "Payment failed");
      return;
    }
    const next = json.redirectUrl || json.url;
    if (next) window.location.href = next;
    else router.push(`/checkout/return?orderId=${json.orderId || ""}`);
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-semibold">{t("checkout")}</h1>
      <div className="space-y-3">
        <label className="glass flex items-center justify-between rounded-2xl p-3">
          <span>{t("knet")}</span>
          <input type="radio" checked={source === "src_kw.knet"} onChange={() => setSource("src_kw.knet")} />
        </label>
        <label className="glass flex items-center justify-between rounded-2xl p-3">
          <span>{t("card")}</span>
          <input type="radio" checked={source === "src_card"} onChange={() => setSource("src_card")} />
        </label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        {t("terms")}
      </label>
      {error ? <p className="mt-2 text-sm text-accent">{error}</p> : null}
      <button type="button" disabled={!accept} onClick={() => void pay()} className="mt-4 w-full rounded-full bg-primary py-3 font-semibold text-white">
        {t("proceed")}
      </button>
      <p className="mt-2 text-xs text-muted">{t("secure")}</p>
    </AppShell>
  );
}
