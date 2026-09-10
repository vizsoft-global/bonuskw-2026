"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadCart, saveCart } from "@/lib/cart/store";
import { useI18n } from "@/lib/i18n/locale";

type StatusResponse = {
  status?: string;
  gatewayStatus?: string | null;
  chargeId?: string | null;
  error?: string;
  invoiceUrl?: string | null;
  failure?: string | null;
};

type Outcome = "checking" | "paid" | "failed" | "pending";

const MAX_POLLS = 20;
const POLL_MS = 2000;

function ReturnBody() {
  const params = useSearchParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const [outcome, setOutcome] = useState<Outcome>("checking");
  const [gateway, setGateway] = useState<string>("");
  const orderId = params.get("orderId") || "";
  // Tap appends `tap_id` (the charge id) when it redirects back itself.
  const chargeId = params.get("chargeId") || params.get("tap_id") || "";
  // MyFatoorah appends `paymentId` (and `Id`) to the callback / error URLs.
  const paymentId = params.get("paymentId") || "";
  const bounced = params.get("failed") === "1";
  const [invoiceUrl, setInvoiceUrl] = useState<string>("");
  const [failure, setFailure] = useState<string>("");

  useEffect(() => {
    if (!user || (!orderId && !chargeId && !paymentId)) return;
    let polls = 0;
    let stopped = false;
    let timer: number | undefined;

    async function check() {
      if (stopped) return;
      polls += 1;
      try {
        const token = await user!.getIdToken();
        const query = new URLSearchParams();
        if (orderId) query.set("orderId", orderId);
        if (chargeId) query.set("chargeId", chargeId);
        if (paymentId) query.set("paymentId", paymentId);
        const res = await fetch(`/api/checkout/status?${query.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as StatusResponse;
        if (json.gatewayStatus) setGateway(json.gatewayStatus);
        if (json.invoiceUrl) setInvoiceUrl(json.invoiceUrl);
        if (json.failure) setFailure(json.failure);
        if (json.status === "Paid" || json.status === "CAPTURED") {
          setOutcome("paid");
          // The purchased lines are fulfilled; empty the cart so the next
          // checkout does not re-buy them. Saved-for-later stays.
          try {
            const cart = await loadCart(user!.uid);
            if (cart.lines.length) await saveCart(user!.uid, { ...cart, lines: [] });
          } catch {
            // best effort
          }
          return;
        }
        if (json.status === "Failed" || res.status === 409) {
          setOutcome("failed");
          return;
        }
        // MyFatoorah sent the student back after a declined attempt: the
        // invoice is still open, so offer a retry instead of polling on.
        if (bounced || json.gatewayStatus === "ATTEMPT_FAILED") {
          setOutcome("failed");
          return;
        }
      } catch {
        // network blip: keep polling
      }
      if (polls >= MAX_POLLS) {
        setOutcome("pending");
        return;
      }
      timer = window.setTimeout(check, POLL_MS);
    }

    void check();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [user, orderId, chargeId, paymentId, bounced]);

  const title =
    outcome === "paid"
      ? t("paymentSuccessTitle")
      : outcome === "failed"
        ? t("paymentFailedTitle")
        : outcome === "pending"
          ? t("paymentPendingTitle")
          : t("paymentChecking");
  const body =
    outcome === "paid"
      ? t("paymentSuccessBody")
      : outcome === "failed"
        ? invoiceUrl
          ? t("attemptFailedBody")
          : t("paymentFailedBody")
        : outcome === "pending"
          ? t("paymentPendingBody")
          : "";

  return (
    <AppShell loading={outcome === "checking"} title={title} skeleton={<ListPageSkeleton rows={3} />}>
      <div className="glass rounded-3xl p-5">
        <p className="text-2xl font-semibold">{title}</p>
        {body ? <p className="mt-2 text-sm text-muted">{body}</p> : null}
        {failure && outcome !== "paid" ? (
          <p className="mt-1 text-xs text-muted">{failure}</p>
        ) : gateway && outcome !== "paid" ? (
          <p className="mt-1 text-xs text-muted">{gateway}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {outcome === "paid" ? (
            <>
              <Link href="/my-space" className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white">
                {t("goToMyCourses")}
              </Link>
              <Link href="/dues" className="rounded-full border border-line px-5 py-3 text-sm font-medium">
                {t("viewDues")}
              </Link>
            </>
          ) : null}
          {outcome === "failed" && invoiceUrl ? (
            <a href={invoiceUrl} className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white">
              {t("retryPayment")}
            </a>
          ) : null}
          {outcome === "failed" ? (
            <Link
              href="/cart"
              className={
                invoiceUrl
                  ? "rounded-full border border-line px-5 py-3 text-sm font-medium"
                  : "rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white"
              }
            >
              {t("tryAgain")}
            </Link>
          ) : null}
          {outcome === "pending" ? (
            <Link href="/my-space" className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white">
              {t("goToMyCourses")}
            </Link>
          ) : null}
          <Link href="/" className="rounded-full px-5 py-3 text-sm text-primary">
            {t("home")}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

export default function CheckoutReturnPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-app-top" />}>
      <ReturnBody />
    </Suspense>
  );
}
