"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  buildTapCheckoutConfig,
  loadTapCheckout,
  type CheckoutSdkPayload,
  type TapCheckoutPaymentMethod,
} from "@/lib/payments/tap-checkout";

const TAP_ELEMENT_ID = "tap-checkout-sdk";

type CreateResponse = {
  orderId?: string;
  free?: boolean;
  redirectUrl?: string | null;
  url?: string | null;
  sdk?: CheckoutSdkPayload;
  error?: string;
};

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
  // Tap Checkout SDK is embedded on this page; `paying` means its popup is open.
  const [paying, setPaying] = useState(false);
  const unmountRef = useRef<(() => void) | null>(null);

  // Warm the SDK while the student is still reviewing the cart.
  useEffect(() => {
    void loadTapCheckout().catch(() => undefined);
  }, []);

  const teardown = useCallback(() => {
    unmountRef.current?.();
    unmountRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

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
    if (!user || !accept || !cart.lines.length || busy || paying) return;
    setBusy(true);
    setError("");
    try {
      const latest = await loadCart(user.uid);
      const token = await user.getIdToken();
      // MyFatoorah is not wired yet; Tap handles K-Net and cards through one SDK.
      const tapSource = source === "src_card" ? "src_card" : "src_kw.knet";
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "sdk",
          lines: latest.lines.map((line) => ({
            kind: line.kind,
            courseId: line.courseId,
            chapterId: line.chapterId,
            installmentId: line.installmentId,
            paymentType: line.paymentType,
          })),
          couponCode: latest.couponCode,
          source: tapSource,
          redirectUrl: `${window.location.origin}/checkout/return`,
        }),
      });
      const json = (await res.json()) as CreateResponse;
      if (!res.ok) {
        setError(json.error || t("paymentFailed"));
        return;
      }
      if (json.free || !json.sdk) {
        // Zero-due order was fulfilled on the server, or the API fell back to
        // the hosted page. Either way there is nothing to embed.
        const next = json.redirectUrl || json.url;
        if (next) window.location.href = next;
        else router.push(`/checkout/return?orderId=${encodeURIComponent(json.orderId || "")}`);
        return;
      }

      const sdkPayload = json.sdk;
      const thisOrderId = json.orderId || sdkPayload.orderRef;
      const methods: "ALL" | TapCheckoutPaymentMethod[] =
        tapSource === "src_kw.knet" ? ["KNET"] : ["VISA", "MASTERCARD", "AMEX", "MADA"];

      const sdk = await loadTapCheckout();
      teardown();
      setPaying(true);
      const { unmount } = sdk.renderCheckout(
        TAP_ELEMENT_ID,
        buildTapCheckoutConfig({
          sdk: sdkPayload,
          language: locale === "ar" ? "ar" : "en",
          paymentMethods: methods,
          onSuccess: ({ chargeId }) => {
            teardown();
            router.push(
              `/checkout/return?orderId=${encodeURIComponent(thisOrderId)}&chargeId=${encodeURIComponent(chargeId)}`,
            );
          },
          onError: (err) => {
            setError(err?.message || err?.description || t("paymentFailed"));
          },
          onClose: () => {
            teardown();
            setPaying(false);
          },
        }),
      );
      unmountRef.current = unmount;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("paymentFailed"));
      teardown();
      setPaying(false);
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
      {/* Tap Checkout SDK mounts its popup here while a payment is in progress. */}
      <div id={TAP_ELEMENT_ID} className={paying ? "min-h-[420px] overflow-hidden rounded-[12px] bg-white" : "hidden"} />
      <div className="flex flex-col items-center gap-2.5">
        {busy ? (
          <div className="grid h-[49px] w-full place-items-center">
            <Loader size="inline" />
          </div>
        ) : paying ? (
          <button
            type="button"
            onClick={() => {
              teardown();
              setPaying(false);
              setError("");
            }}
            className="h-[49px] w-full rounded-[12px] border border-white/20 text-[12px] font-medium text-[#fafafa]"
          >
            {t("changePaymentMethod")}
          </button>
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
