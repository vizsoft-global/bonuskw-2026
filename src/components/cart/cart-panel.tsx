"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CartSummary } from "@/components/cart/cart-summary";
import { formatKwdLocale, type Locale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCartQuote } from "@/lib/cart/use-cart-quote";
import { lineKey, removeLine, saveCart, type CartLine } from "@/lib/cart/store";
import { imageFor } from "@/lib/media/image-url";

let opener: ((open: boolean) => void) | null = null;

/** Opens the cart dropdown from anywhere. */
export function openCart() {
  opener?.(true);
}

const kindKey = { course: "kindCourse", chapter: "kindChapter", ebook: "kindEbook", installment: "kindInstallment" } as const;

export function CartPanel({ count }: { count: number }) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const client = useQueryClient();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { cart, quote, quoting } = useCartQuote();

  useEffect(() => {
    opener = (next) => setOpen(next);
    return () => {
      if (opener) opener = null;
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  async function remove(line: CartLine) {
    if (!user || !cart) return;
    const next = removeLine(cart, lineKey(line));
    await saveCart(user.uid, next);
    void client.invalidateQueries({ queryKey: ["cart", user.uid] });
    void client.invalidateQueries({ queryKey: ["cart-quote", user.uid] });
  }

  if (!open) return null;
  const lines = cart?.lines ?? [];
  const fallback = lines.reduce((sum, line) => sum + (Number(line.price) || 0), 0);

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={t("cart")}
      className="fixed inset-x-3 top-[4.25rem] z-[80] flex max-h-[min(70dvh,520px)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl lg:inset-x-auto lg:end-6 lg:top-[5.25rem] lg:w-[380px]"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-[14px] font-semibold text-text">
          {t("cart")}
          {count ? <span className="ms-1.5 text-[12px] font-normal text-muted">({count})</span> : null}
        </p>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-muted">
          {t("close")}
        </button>
      </div>
      {lines.length ? (
        <>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {lines.map((line) => (
              <li
                key={`${line.kind}-${line.courseId}-${line.chapterId || ""}-${line.installmentId || ""}`}
                className="flex items-center gap-3 border-b border-line px-4 py-2.5"
              >
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2">
                  {line.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageFor("courseCard", line.image)} alt="" width={96} height={96} className="size-full object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-text">{line.title || line.courseId}</span>
                  <span className="block text-[11px] text-muted">
                    {t(kindKey[line.kind])}
                    {line.paymentType === "EMI" ? ` · ${t("emi")}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-end">
                  <span className="block text-[12px] font-semibold text-text">
                    {formatKwdLocale(Number(line.price) || 0, locale as Locale)}
                  </span>
                  <button type="button" onClick={() => void remove(line)} className="text-[11px] text-[#f24822]">
                    {t("remove")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 border-t border-line p-4">
            <CartSummary quote={quote} quoting={quoting} fallback={fallback} />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/cart");
              }}
              className="h-11 rounded-full bg-[#0c5eff] text-[14px] font-semibold text-white"
            >
              {t("checkout")}
            </button>
          </div>
        </>
      ) : (
        <p className="px-4 py-8 text-center text-[13px] text-muted">{t("emptyCartTitle")}</p>
      )}
    </div>,
    document.body,
  );
}
