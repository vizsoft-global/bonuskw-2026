"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LineCard, PayCta, SavedCard } from "@/components/cart/line-card";
import { PaymentMethod, type PaymentSource } from "@/components/cart/payment-method";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadCart, saveCart, type CartLine, type CartState } from "@/lib/cart/store";
import { formatKwdLocale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";

export default function CartPage() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [cart, setCart] = useState<CartState>({ lines: [], savedForLater: [] });
  const [quote, setQuote] = useState<{ dueNow?: number; suggestions?: Array<{ name?: string }> } | null>(null);
  const [coupon, setCoupon] = useState("");
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<PaymentSource>("src_kw.knet");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void loadCart(user.uid)
      .then(async (next) => {
        setCart(next);
        setCoupon(next.couponCode || "");
        await refreshQuote(next);
      })
      .finally(() => setReady(true));
  }, [user]);

  async function refreshQuote(next: CartState) {
    if (!user) return;
    if (!next.lines.length) {
      setQuote(null);
      return;
    }
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

  async function persist(next: CartState) {
    if (!user) return;
    setCart(next);
    await saveCart(user.uid, next);
    await refreshQuote(next);
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

  async function pay() {
    if (!user || !accept || !cart.lines.length) return;
    setBusy(true);
    setError("");
    try {
      const latest = await loadCart(user.uid);
      const token = await user.getIdToken();
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: latest.lines.map((line) => ({
            kind: line.kind,
            courseId: line.courseId,
            chapterId: line.chapterId,
            installmentId: line.installmentId,
            paymentType: line.paymentType,
          })),
          couponCode: latest.couponCode,
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
    } finally {
      setBusy(false);
    }
  }

  const due =
    quote?.dueNow ?? cart.lines.reduce((sum, line) => sum + (Number(line.price) || 0), 0);
  const dueLabel = formatKwdLocale(due, locale);
  const canPay = accept && !busy && cart.lines.length > 0;
  const lineLabels = {
    fullPay: t("fullPay"),
    emi: t("emi"),
    emiMonths: t("emiMonths"),
    saveLater: t("saveLater"),
    remove: t("remove"),
  };

  const checkoutBlock = (
    <div className="flex flex-col gap-[25px] rounded-[12px] border border-white/20 bg-white/[0.06] p-[15px]">
      <PaymentMethod
        source={source}
        onSource={setSource}
        labels={{ title: t("paymentMethod"), knet: t("knet"), card: t("card"), myFatoorah: t("myFatoorah") }}
      />
      <label className="flex items-center gap-2 text-[12px] text-[#999]">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        {t("terms")}
      </label>
      {error ? <p className="text-[12px] text-[#f24822]">{error}</p> : null}
      <div className="flex flex-col items-center gap-2.5">
        {busy ? (
          <div className="grid h-[49px] w-full place-items-center">
            <Loader size="inline" />
          </div>
        ) : (
          <PayCta amount={dueLabel} label={t("proceed")} disabled={!canPay} onPay={() => void pay()} />
        )}
        <p className="text-center text-[10px] text-[#999]">{t("secure")}</p>
      </div>
    </div>
  );

  return (
    <AppShell loading={Boolean(user) && !ready} title={t("checkout")} skeleton={<ListPageSkeleton />}>
      {!cart.lines.length ? (
        <EmptyState
          icon="/home/cart.svg"
          title={t("emptyCartTitle")}
          body={t("emptyCartBody")}
          cta={{ href: "/", label: t("explore") }}
        />
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-20">
          <div className="flex flex-col gap-5">
            {cart.lines.map((line) => (
              <LineCard
                key={`${line.kind}-${line.courseId}-${line.chapterId || ""}-${line.installmentId || ""}`}
                line={line}
                locale={locale}
                labels={lineLabels}
                onPayType={(type) => setPay(line, type)}
                onSaveLater={() =>
                  void persist({
                    lines: cart.lines.filter((item) => item !== line),
                    savedForLater: [...cart.savedForLater, line],
                    couponCode: cart.couponCode,
                  })
                }
                onRemove={() =>
                  void persist({ ...cart, lines: cart.lines.filter((item) => item !== line) })
                }
              />
            ))}
            <div className="flex gap-2">
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder={t("coupon")}
                className="h-[50px] flex-1 rounded-[12px] bg-[#141414] px-3 text-[12px] text-[#fafafa] outline-none placeholder:text-[#999]"
              />
              <button
                type="button"
                onClick={() => void persist({ ...cart, couponCode: coupon })}
                className="h-[50px] rounded-[12px] bg-[#141414] px-4 text-[12px] font-medium text-[#fafafa]"
              >
                {t("apply")}
              </button>
            </div>
            {(quote?.suggestions ?? []).map((item, i) => (
              <p key={i} className="text-[12px] text-[#0c5eff]">
                {item.name}
              </p>
            ))}
          </div>
          {checkoutBlock}
        </div>
      )}

      {cart.savedForLater.length ? (
        <div className="mt-8">
          <h2 className="mb-3 text-[14px] font-medium text-[#999]">{t("saveLater")}</h2>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {cart.savedForLater.map((line) => (
              <SavedCard
                key={`saved-${line.kind}-${line.courseId}-${line.chapterId || ""}`}
                line={line}
                locale={locale}
                moveLabel={t("moveToCart")}
                onMove={() =>
                  void persist({
                    lines: [...cart.lines, line],
                    savedForLater: cart.savedForLater.filter((item) => item !== line),
                    couponCode: cart.couponCode,
                  })
                }
              />
            ))}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
