"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadCart, saveCart, upsertLine, type CartState } from "@/lib/cart/store";
import { formatKwdLocale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";

type DueRequest = {
  id: string;
  status: "open" | "paid" | "expired" | "settled";
  amount: number;
  lines: {
    installmentId: string;
    courseId: string;
    courseName: string;
    index: number | null;
    count: number | null;
    amount: number;
    status: string;
    dueDate: string | null;
  }[];
};

/**
 * Landing page for the combined monthly payment link sent in reminders. It
 * loads every open installment on the request into the cart so one Tap charge
 * settles all of them.
 */
function PayBody() {
  const params = useSearchParams();
  const { user, ready } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const id = params.get("req") || "";
  const [data, setData] = useState<DueRequest | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(`/dues/pay?req=${id}`)}`);
      return;
    }
    if (!id) {
      router.replace("/dues");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/dues/request?id=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as DueRequest & { error?: string };
        if (!res.ok) throw new Error(json.error || "Could not load");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user, id, router]);

  async function payAll() {
    if (!user || !data || busy) return;
    setBusy(true);
    try {
      let cart: CartState = await loadCart(user.uid);
      for (const line of data.lines) {
        cart = upsertLine(cart, {
          kind: "installment",
          courseId: line.courseId,
          installmentId: line.installmentId,
          paymentType: "Full payment",
          title: line.courseName,
          price: line.amount,
          addedAt: Date.now(),
        });
      }
      await saveCart(user.uid, cart);
      router.push("/cart");
    } finally {
      setBusy(false);
    }
  }

  const loading = !data && !error;
  const body =
    data?.status === "expired"
      ? t("dueRequestExpired")
      : data && data.status !== "open"
        ? t("dueRequestSettled")
        : t("dueRequestBody");

  return (
    <AppShell loading={loading} title={t("dueRequestTitle")} skeleton={<ListPageSkeleton rows={3} />}>
      <div className="flex flex-col gap-4 rounded-[12px] border border-white/20 bg-white/[0.06] p-[15px]">
        <p className="text-[14px] text-[#fafafa]">{error || body}</p>
        {data?.status === "open" ? (
          <>
            <ul className="flex flex-col gap-2">
              {data.lines.map((line) => (
                <li key={line.installmentId} className="flex items-center justify-between text-[13px]">
                  <span className="text-[#fafafa]">
                    {line.courseName}
                    {line.index ? (
                      <span className="ms-1 text-[11px] text-[#999]">
                        ({line.index}
                        {line.count ? `/${line.count}` : ""})
                      </span>
                    ) : null}
                  </span>
                  <span className="font-semibold text-[#fafafa]">{formatKwdLocale(line.amount, locale)}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={() => void payAll()}
              className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#0c5eff] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {t("payNow")} · {formatKwdLocale(data.amount, locale)}
            </button>
          </>
        ) : (
          <Link href="/dues" className="text-[13px] text-[#0c5eff] underline">
            {t("viewDues")}
          </Link>
        )}
      </div>
    </AppShell>
  );
}

export default function DuesPayPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#050505]" />}>
      <PayBody />
    </Suspense>
  );
}
