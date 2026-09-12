"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DevModeBanner } from "@/components/commerce/dev-mode-banner";
import { LineCard, PayCta, SavedCard } from "@/components/cart/line-card";
import { PaymentMethods } from "@/components/cart/payment-method";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { canPurchase } from "@/lib/auth/purchase-access";
import { usePurchaseGate } from "@/lib/commerce/purchase-gate";
import { type Quote, quoteErrorKey, quoteLineFor, suggestionText } from "@/lib/cart/quote";
import { loadCart, saveCart, type CartLine, type CartState } from "@/lib/cart/store";
import { getDocsByIds } from "@/lib/catalog/queries";
import { batchTone, type BatchTone } from "@/lib/course/batch-status";
import { enrolmentBlock } from "@/lib/course/enrol";
import { collections } from "@/lib/firebase/collections";
import type { BatchDoc, CourseDoc } from "@/lib/types/firestore";
import { formatKwdLocale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

type CreateResponse = {
  orderId?: string;
  free?: boolean;
  /** MyFatoorah hosted payment page for this order. */
  redirectUrl?: string | null;
  url?: string | null;
  error?: string;
};

export default function CartPage() {
  const { user, profile } = useAuth();
  const staffViewer = Boolean(user) && !canPurchase(profile);
  const gate = usePurchaseGate();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [cart, setCart] = useState<CartState>({ lines: [], savedForLater: [] });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [coupon, setCoupon] = useState("");
  // Why the coupon in the cart was rejected (the rest of the cart still prices).
  const [couponError, setCouponError] = useState("");
  // Why the whole cart cannot be priced (blocks checkout).
  const [quoteError, setQuoteError] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [ready, setReady] = useState(false);
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // True while the browser is being handed to MyFatoorah's hosted page.
  const [redirecting, setRedirecting] = useState(false);

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

  // Live batch state for every course in the cart. A line added weeks ago can
  // outlive its batch, so the chip and the Pay button follow today's data,
  // not what was true when the student tapped "Add to cart".
  const courseIds = [...new Set(cart.lines.filter((l) => l.kind !== "ebook").map((l) => l.courseId))].sort();
  const batchState = useQuery({
    queryKey: ["cart-batches", courseIds.join(",")],
    enabled: courseIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const courses = await getDocsByIds(collections.course, courseIds);
      const batchIds = [
        ...new Set(
          Object.values(courses)
            .map((c) => (c as CourseDoc).batchesRef?.id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const batches = batchIds.length ? await getDocsByIds(collections.batches, batchIds) : {};
      const out: Record<string, { name: string; tone: BatchTone; blocked: boolean }> = {};
      for (const id of courseIds) {
        const course = courses[id] as CourseDoc | undefined;
        const batch = course?.batchesRef?.id ? (batches[course.batchesRef.id] as BatchDoc | undefined) : undefined;
        out[id] = {
          name: batch?.name || "",
          tone: batchTone(batch),
          // Installment lines pay for something already owned; never block them.
          blocked: Boolean(course) && enrolmentBlock(course, batch) !== null,
        };
      }
      return out;
    },
  });

  async function fetchQuote(next: CartState, couponCode: string | undefined) {
    if (!user) return { ok: false, body: {} as Quote };
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
        couponCode: couponCode?.trim() || undefined,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as Quote;
    return { ok: res.ok && !body.error, body };
  }

  /**
   * Prices the cart server-side. The server prices everything or nothing, so
   * when the coupon is the reason it fails we re-price without it: totals stay
   * right and the student sees why the code was refused instead of nothing.
   */
  async function refreshQuote(next: CartState) {
    if (!user) return;
    if (!next.lines.length) {
      setQuote(null);
      setCouponError("");
      setQuoteError("");
      return;
    }
    setQuoting(true);
    try {
      const withCoupon = await fetchQuote(next, next.couponCode);
      if (withCoupon.ok) {
        setQuote(withCoupon.body);
        setCouponError("");
        setQuoteError("");
        return;
      }
      if (next.couponCode?.trim()) {
        const bare = await fetchQuote(next, undefined);
        if (bare.ok) {
          setQuote(bare.body);
          setCouponError(t(quoteErrorKey(withCoupon.body.error)));
          setQuoteError("");
          return;
        }
        setQuote(null);
        setCouponError("");
        setQuoteError(t(quoteErrorKey(bare.body.error)));
        return;
      }
      setQuote(null);
      setCouponError("");
      setQuoteError(t(quoteErrorKey(withCoupon.body.error)));
    } catch {
      setQuote(null);
      setQuoteError(t("quoteFailed"));
    } finally {
      setQuoting(false);
    }
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
    if (!user || !accept || !cart.lines.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const latest = await loadCart(user.uid);
      const token = await user.getIdToken();
      // The server creates a Pending order and a MyFatoorah invoice, then we
      // hand the browser to the hosted page. MyFatoorah brings the student back
      // to /checkout/return, which confirms the payment with the server.
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "hosted",
          language: locale === "ar" ? "ar" : "en",
          lines: latest.lines.map((line) => ({
            kind: line.kind,
            courseId: line.courseId,
            chapterId: line.chapterId,
            installmentId: line.installmentId,
            paymentType: line.paymentType,
          })),
          couponCode: latest.couponCode,
          redirectUrl: `${window.location.origin}/checkout/return`,
        }),
      });
      const json = (await res.json()) as CreateResponse;
      if (!res.ok) {
        setError(json.error || t("paymentFailed"));
        return;
      }
      const next = json.redirectUrl || json.url;
      if (json.free || !next) {
        router.push(`/checkout/return?orderId=${encodeURIComponent(json.orderId || "")}`);
        return;
      }
      setRedirecting(true);
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("paymentFailed"));
      setRedirecting(false);
    } finally {
      setBusy(false);
    }
  }

  const batchFor = (line: CartLine) =>
    line.kind === "ebook" || line.kind === "installment" ? undefined : batchState.data?.[line.courseId];
  const closedLines = cart.lines.filter((line) => batchFor(line)?.blocked);
  const closedNames = [...new Set(closedLines.map((line) => line.title || line.courseId))].join(", ");
  const toneLabel = (tone: BatchTone) =>
    t(tone === "active" ? "batchOpen" : tone === "upcoming" ? "batchUpcoming" : "batchClosed");

  const listTotal = cart.lines.reduce((sum, line) => sum + (Number(line.price) || 0), 0);
  const due = quote?.dueNow ?? listTotal;
  const quotedInstallments = (line: CartLine) => quoteLineFor(quote, line)?.installments ?? undefined;
  // Coupon lands on exactly one line server-side; surface which one.
  const couponLine = quote?.lines?.find((q) => (q.couponDiscount ?? 0) > 0);
  const couponCartLine = couponLine
    ? cart.lines.find((line) => quoteLineFor(quote, line) === couponLine)
    : undefined;
  const promoTotal = quote
    ? (quote.lines ?? []).reduce((sum, q) => sum + (q.owned ? 0 : q.promotionDiscount || 0), 0)
    : 0;
  const couponTotal = quote
    ? (quote.lines ?? []).reduce((sum, q) => sum + (q.owned ? 0 : q.couponDiscount || 0), 0)
    : 0;
  const suggestionTexts = Array.from(
    new Set((quote?.suggestions ?? []).map((item) => suggestionText(item.message, locale))),
  ).filter(Boolean);
  const summaryTotal = quote
    ? (quote.lines ?? []).reduce((sum, q) => sum + (q.owned ? 0 : q.amountTotal || 0), 0)
    : listTotal;
  // "Pay all in EMI" is only offered when at least one course allows it.
  const emiEligible = cart.lines.filter((l) => l.kind === "course" && l.emiAvailable !== false);
  const allEmi = emiEligible.length > 0 && emiEligible.every((l) => l.paymentType === "EMI");
  const dueLabel = formatKwdLocale(due, locale);
  // First paused line wins: the checkout API refuses the whole order anyway.
  const paused = cart.lines.map((line) => gate.blockFor(line.kind)).find(Boolean);
  const canPay =
    accept &&
    !busy &&
    !redirecting &&
    !quoting &&
    Boolean(quote) &&
    !quoteError &&
    closedLines.length === 0 &&
    cart.lines.length > 0 &&
    !staffViewer &&
    !paused;
  const lineLabels = {
    fullPay: t("fullPay"),
    emi: t("emi"),
    emiMonths: t("emiMonths"),
    saveLater: t("saveLater"),
    remove: t("remove"),
  };

  // A coupon that covers the whole price: the server fulfils the order without
  // touching the payment gateway, so the payment section is not shown.
  const freeCheckout = Boolean(quote) && due <= 0 && cart.lines.length > 0;

  const summaryRow = (label: string, value: string, tone?: "muted" | "accent" | "strong") => (
    <div
      className={cn(
        "flex items-center justify-between gap-3 text-[12px]",
        tone === "accent" ? "text-[#1f9d4d]" : tone === "strong" ? "text-[#fafafa]" : "text-[#999]",
      )}
    >
      <span className={tone === "strong" ? "font-medium" : undefined}>{label}</span>
      <span className={tone === "strong" ? "text-[14px] font-semibold" : "font-medium"}>{value}</span>
    </div>
  );

  const checkoutBlock = (
    <div className="flex flex-col gap-[25px] rounded-[12px] border border-white/20 bg-white/[0.06] p-[15px]">
      <div className="flex flex-col gap-2 border-b border-white/10 pb-4">
        {summaryRow(t("subtotal"), formatKwdLocale(listTotal, locale))}
        {promoTotal > 0
          ? summaryRow(t("discountLabel"), `− ${formatKwdLocale(promoTotal, locale)}`, "accent")
          : null}
        {couponTotal > 0
          ? summaryRow(
              `${t("coupon")} · ${quote?.couponCode ?? ""}`,
              `− ${formatKwdLocale(couponTotal, locale)}`,
              "accent",
            )
          : null}
        {summaryTotal !== due
          ? summaryRow(t("orderTotal"), formatKwdLocale(summaryTotal, locale))
          : null}
        {summaryRow(t("totalDueNow"), quoting ? "…" : dueLabel, "strong")}
      </div>
      {closedLines.length ? (
        <p className="rounded-[10px] bg-[#f24822]/10 p-3 text-[12px] leading-relaxed text-[#f24822]">
          {t("cartClosedLines", { courses: closedNames })}
        </p>
      ) : quoteError ? (
        <p className="rounded-[10px] bg-[#f24822]/10 p-3 text-[12px] leading-relaxed text-[#f24822]">
          {quoteError}
        </p>
      ) : null}
      {freeCheckout ? (
        <div className="flex items-start gap-3 rounded-[12px] bg-[#1f9d4d]/15 p-3">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#1f9d4d] text-[11px] font-bold text-white">
            ✓
          </span>
          <p className="text-[12px] leading-relaxed text-[#cfe9d6]">{t("freeCheckoutHint")}</p>
        </div>
      ) : (
        <PaymentMethods
          title={t("paymentMethod")}
          hint={t("hostedPaymentHint")}
          testTitle={t("testModeBanner")}
          copyLabel={t("copyCardNumber")}
        />
      )}
      <label className="flex items-center gap-2 text-[12px] text-[#999]">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        {t("terms")}
      </label>
      {staffViewer ? (
        <p className="rounded-[10px] bg-white/[0.06] p-3 text-[12px] leading-relaxed text-[#999]">
          <span className="block font-semibold text-[#fafafa]">{t("staffViewOnlyTitle")}</span>
          {t("staffViewOnlyBody")}
        </p>
      ) : null}
      {paused ? (
        <p className="rounded-[10px] bg-[#f5d08a]/10 p-3 text-[12px] leading-relaxed text-[#999]">
          <span className="block font-semibold text-[#f5d08a]">{paused}</span>
          {t("purchasesPausedBody")}
        </p>
      ) : null}
      {error ? <p className="text-[12px] text-[#f24822]">{error}</p> : null}
      <div className="flex flex-col items-center gap-2.5">
        {busy || redirecting ? (
          <div className="grid h-[49px] w-full place-items-center gap-1 text-[12px] text-[#999]">
            <Loader size="inline" />
            {redirecting ? <span>{t("redirectingToPayment")}</span> : null}
          </div>
        ) : (
          <PayCta
            amount={dueLabel}
            label={freeCheckout ? t("freeCheckout") : t("proceed")}
            disabled={!canPay}
            onPay={() => void pay()}
          />
        )}
        {freeCheckout ? null : <p className="text-center text-[10px] text-[#999]">{t("secure")}</p>}
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
            <DevModeBanner />
            {cart.lines.map((line) => (
              <LineCard
                key={`${line.kind}-${line.courseId}-${line.chapterId || ""}-${line.installmentId || ""}`}
                line={line}
                locale={locale}
                labels={lineLabels}
                installments={quotedInstallments(line)}
                quoted={quoteLineFor(quote, line)}
                couponTag={t("couponTag")}
                batchTone={batchFor(line)?.tone}
                batchLabel={batchFor(line) ? toneLabel(batchFor(line)!.tone) : undefined}
                closed={Boolean(batchFor(line)?.blocked)}
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
            {emiEligible.length > 1 ? (
              <button
                type="button"
                onClick={() =>
                  void persist({
                    ...cart,
                    lines: cart.lines.map((item) =>
                      item.kind === "course" && item.emiAvailable !== false
                        ? { ...item, paymentType: allEmi ? "Full payment" : "EMI" }
                        : item,
                    ),
                  })
                }
                className="h-[44px] rounded-[12px] border border-white/20 px-4 text-[12px] font-medium text-[#fafafa]"
              >
                {allEmi ? t("payAllFull") : t("payAllEmi")}
              </button>
            ) : null}
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void persist({ ...cart, couponCode: coupon.trim() });
              }}
            >
              <div className="flex gap-2">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder={t("coupon")}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={Boolean(couponError)}
                  className={cn(
                    "h-[50px] flex-1 rounded-[12px] bg-[#141414] px-3 text-[12px] text-[#fafafa] outline-none placeholder:text-[#999]",
                    couponError ? "ring-1 ring-[#f24822]" : undefined,
                  )}
                />
                <button
                  type="submit"
                  disabled={quoting || !coupon.trim()}
                  className="h-[50px] rounded-[12px] bg-[#141414] px-4 text-[12px] font-medium text-[#fafafa] disabled:opacity-50"
                >
                  {t("apply")}
                </button>
              </div>
              {couponError ? (
                <p role="alert" className="text-[12px] text-[#f24822]">
                  {couponError}
                </p>
              ) : null}
              {quote?.couponCode && couponLine ? (
                <div className="flex items-start justify-between gap-3 rounded-[10px] bg-[#1f9d4d]/10 p-3 text-[12px] text-[#cfe9d6]">
                  <p className="leading-relaxed">
                    {t("couponApplied", {
                      code: quote.couponCode,
                      course: couponCartLine?.title || couponLine.courseName || "",
                    })}
                    {" · "}
                    <span className="font-semibold text-[#1f9d4d]">
                      − {formatKwdLocale(couponLine.couponDiscount ?? 0, locale)}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCoupon("");
                      void persist({ ...cart, couponCode: "" });
                    }}
                    className="shrink-0 text-[11px] text-[#999] underline-offset-2 hover:underline"
                  >
                    {t("couponRemove")}
                  </button>
                </div>
              ) : null}
            </form>
            {suggestionTexts.map((text) => (
              <p key={text} className="text-[12px] text-[#0c5eff]">
                {text}
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
