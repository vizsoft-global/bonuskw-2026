"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadCart, saveCart } from "@/lib/cart/store";
import { invalidateEnrolment } from "@/lib/course/invalidate";
import { useI18n } from "@/lib/i18n/locale";

type PurchasedCourse = { id: string; name: string };

type StatusResponse = {
  status?: string;
  gatewayStatus?: string | null;
  chargeId?: string | null;
  error?: string;
  invoiceUrl?: string | null;
  failure?: string | null;
  courses?: PurchasedCourse[];
};

type Outcome = "checking" | "paid" | "failed" | "pending";

const MAX_POLLS = 20;
const POLL_MS = 2000;

/** Post-purchase success screen (Figma 946:32483 mobile / 946:32503 desktop). */
function PaidScreen({ courses }: { courses: PurchasedCourse[] }) {
  const { t } = useI18n();
  const single = courses.length === 1 ? courses[0] : null;

  const body =
    single != null ? (
      <>
        {t("purchaseSuccessSingle")
          .split("{course}")
          .map((part, i, arr) =>
            i < arr.length - 1 ? (
              <span key={i}>
                {part}
                <span className="font-bold text-white">{single.name || t("myCourses")}</span>
              </span>
            ) : (
              <span key={i}>{part}</span>
            ),
          )}
      </>
    ) : (
      t("purchaseSuccessMulti").replace("{count}", String(courses.length))
    );

  const btn =
    "flex h-[49px] items-center justify-center rounded-[24px] px-6 text-[14px] font-semibold transition active:scale-[0.98]";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#050505]">
      {/* ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[560px] -translate-x-1/2 rounded-full bg-[#0c5eff]/25 blur-[130px] lg:left-[8%] lg:translate-x-0"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-10 right-[-120px] hidden h-72 w-72 rounded-full bg-emerald-500/15 blur-[130px] lg:block"
      />
      <Link
        href="/cart"
        className="absolute top-5 left-5 z-10 flex items-center gap-2 text-[16px] font-semibold text-white lg:top-8 lg:left-10"
      >
        <ArrowLeft className="size-6 rtl:rotate-180" />
        <span className="hidden lg:inline">{t("checkout")}</span>
      </Link>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[720px] flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
        <div
          className="flex size-[66px] items-center justify-center rounded-full lg:size-[87px]"
          style={{ backgroundImage: "linear-gradient(205deg, #2e7bff 0%, #22c55e 130%)" }}
        >
          <Check className="size-9 text-white lg:size-12" strokeWidth={3} />
        </div>
        <h1 className="mt-6 bg-gradient-to-b from-white to-[#999] bg-clip-text text-[24px] font-bold text-transparent lg:mt-8 lg:text-[40px]">
          {t("purchaseSuccessful")}
        </h1>
        <p className="mt-3 max-w-[480px] text-[14px] leading-relaxed text-[#999] lg:mt-4 lg:text-[20px]">
          {body}
        </p>
        <div className="mt-8 flex w-full max-w-[267px] flex-col gap-3 lg:mt-10 lg:max-w-none lg:flex-row lg:items-center lg:justify-center">
          {single != null ? (
            <>
              <Link href={`/course/${single.id}/learn`} className={`${btn} w-full bg-[#0c5eff] text-white lg:w-[169px]`}>
                {t("startLearning")}
              </Link>
              <Link
                href="/my-space"
                className={`${btn} w-full border border-[#0c5eff] text-[#fafafa] lg:w-[198px]`}
              >
                {t("goToMyCourses")}
              </Link>
            </>
          ) : (
            <Link href="/my-space" className={`${btn} w-full bg-[#0c5eff] text-white lg:w-[220px]`}>
              {t("goToMyCourses")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ReturnBody() {
  const params = useSearchParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
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
  const [courses, setCourses] = useState<PurchasedCourse[]>([]);

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
          if (Array.isArray(json.courses)) setCourses(json.courses.filter((c) => c?.id));
          // The purchased lines are fulfilled: empty the cart so the next
          // checkout does not re-buy them, and drop cached enrolment views
          // so My Zone shows the new courses without a manual refresh.
          try {
            const cart = await loadCart(user!.uid);
            if (cart.lines.length) await saveCart(user!.uid, { ...cart, lines: [] });
          } catch {
            // best effort
          }
          void invalidateEnrolment(qc);
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
  }, [user, orderId, chargeId, paymentId, bounced, qc]);

  const title =
    outcome === "paid"
      ? t("purchaseSuccessful")
      : outcome === "failed"
        ? t("paymentFailedTitle")
        : outcome === "pending"
          ? t("paymentPendingTitle")
          : t("paymentChecking");
  const body =
    outcome === "paid"
      ? ""
      : outcome === "failed"
        ? invoiceUrl
          ? t("attemptFailedBody")
          : t("paymentFailedBody")
        : outcome === "pending"
          ? t("paymentPendingBody")
          : "";

  if (outcome === "paid") {
    return <PaidScreen courses={courses} />;
  }

  return (
    <AppShell loading={outcome === "checking"} title={title} skeleton={<ListPageSkeleton rows={3} />}>
      <div className="glass rounded-3xl p-5">
        <p className="text-2xl font-semibold">{title}</p>
        {body ? <p className="mt-2 text-sm text-muted">{body}</p> : null}
        {failure ? (
          <p className="mt-1 text-xs text-muted">{failure}</p>
        ) : gateway ? (
          <p className="mt-1 text-xs text-muted">{gateway}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
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
