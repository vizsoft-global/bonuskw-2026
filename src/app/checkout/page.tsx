"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadCart } from "@/lib/cart/store";
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

type Stage = "choose" | "starting" | "paying";

export default function CheckoutPage() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [source, setSource] = useState<"src_kw.knet" | "src_card">("src_kw.knet");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<Stage>("choose");
  const [amount, setAmount] = useState<number | null>(null);
  const [orderId, setOrderId] = useState("");
  const unmountRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (user) void loadCart(user.uid);
  }, [user]);

  // Warm the SDK while the student is still reading the page.
  useEffect(() => {
    void loadTapCheckout().catch(() => undefined);
  }, []);

  const teardown = useCallback(() => {
    unmountRef.current?.();
    unmountRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  async function pay() {
    if (!user || !accept || stage !== "choose") return;
    setError("");
    setStage("starting");
    try {
      const cart = await loadCart(user.uid);
      const token = await user.getIdToken();
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "sdk",
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
      const json = (await res.json()) as CreateResponse;
      if (!res.ok) {
        setError(json.error || t("paymentFailed"));
        setStage("choose");
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
      setOrderId(thisOrderId);
      setAmount(sdkPayload.amount);
      setStage("paying");

      const methods: "ALL" | TapCheckoutPaymentMethod[] =
        source === "src_kw.knet" ? ["KNET"] : ["VISA", "MASTERCARD", "AMEX", "MADA"];

      const sdk = await loadTapCheckout();
      teardown();
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
            setStage("choose");
          },
        }),
      );
      unmountRef.current = unmount;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("paymentFailed"));
      setStage("choose");
      teardown();
    }
  }

  function cancelPayment() {
    teardown();
    setStage("choose");
    setError("");
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-semibold">{t("checkout")}</h1>

      {stage !== "paying" ? (
        <>
          <div className="space-y-3">
            <label className="glass flex items-center justify-between rounded-2xl p-3">
              <span>{t("knet")}</span>
              <input
                type="radio"
                name="source"
                checked={source === "src_kw.knet"}
                onChange={() => setSource("src_kw.knet")}
              />
            </label>
            <label className="glass flex items-center justify-between rounded-2xl p-3">
              <span>{t("card")}</span>
              <input
                type="radio"
                name="source"
                checked={source === "src_card"}
                onChange={() => setSource("src_card")}
              />
            </label>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
            {t("terms")}
          </label>
          {error ? <p className="mt-2 text-sm text-accent">{error}</p> : null}
          <button
            type="button"
            disabled={!accept || stage === "starting"}
            onClick={() => void pay()}
            className="mt-4 w-full rounded-full bg-primary py-3 font-semibold text-white disabled:opacity-60"
          >
            {stage === "starting" ? t("preparingPayment") : t("proceed")}
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="glass flex items-center justify-between rounded-2xl p-3 text-sm">
            <span>{t("amountDue")}</span>
            <span className="font-semibold">{formatKwdLocale(amount ?? undefined, locale)}</span>
          </div>
          {error ? <p className="text-sm text-accent">{error}</p> : null}
          <div
            id={TAP_ELEMENT_ID}
            data-order={orderId}
            className="min-h-[420px] overflow-hidden rounded-3xl bg-white"
          />
          <button
            type="button"
            onClick={cancelPayment}
            className="w-full rounded-full border border-line py-3 text-sm font-medium"
          >
            {t("changePaymentMethod")}
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">{t("secure")}</p>
    </AppShell>
  );
}
