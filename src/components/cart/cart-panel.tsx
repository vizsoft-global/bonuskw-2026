"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet } from "@/components/ui/sheet";
import { formatKwdLocale, type Locale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import { useAuth } from "@/lib/auth/auth-provider";
import { lineKey, loadCart, removeLine, saveCart, type CartLine, type CartState } from "@/lib/cart/store";
import { imageFor } from "@/lib/media/image-url";

let opener: ((open: boolean) => void) | null = null;

/** Opens the cart panel from anywhere, including the "View cart" toast action. */
export function openCart() {
  opener?.(true);
}

const kindKey = { course: "kindCourse", chapter: "kindChapter", ebook: "kindEbook", installment: "kindInstallment" } as const;

export function CartPanel({ count }: { count: number }) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cart, setCart] = useState<CartState | null>(null);

  useEffect(() => {
    opener = setOpen;
    return () => {
      if (opener === setOpen) opener = null;
    };
  }, []);

  useEffect(() => {
    if (!open || !user) return;
    let live = true;
    void loadCart(user.uid).then((next) => { if (live) setCart(next); });
    return () => { live = false; };
  }, [open, user, count]);

  async function remove(line: CartLine) {
    if (!user || !cart) return;
    const next = removeLine(cart, lineKey(line));
    setCart(next);
    await saveCart(user.uid, next);
    void client.invalidateQueries({ queryKey: ["cart", user.uid] });
  }

  const lines = cart?.lines ?? [];
  const total = lines.reduce((sum, line) => sum + (Number(line.price) || 0), 0);

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      side="end"
      title={t("cart")}
      description={lines.length ? t("cartItems").replace("{n}", String(lines.length)) : undefined}
      footer={lines.length ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{t("subtotal")}</span>
            <span className="font-semibold">{formatKwdLocale(total, locale as Locale)}</span>
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); router.push("/cart"); }}
            className="h-11 rounded-full bg-primary text-sm font-semibold text-white"
          >
            {t("checkout")}
          </button>
        </div>
      ) : undefined}
    >
      {lines.length ? (
        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <li key={`${line.kind}-${line.courseId}-${line.chapterId || ""}-${line.installmentId || ""}`} className="flex items-center gap-3">
              <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2">
                {line.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageFor("courseCard", line.image)} alt="" width={112} height={112} className="size-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{line.title || line.courseId}</span>
                <span className="block text-[11px] text-muted">
                  {t(kindKey[line.kind])}
                  {line.paymentType === "EMI" ? ` · ${t("emi")}` : ""}
                </span>
                <span className="block text-xs font-medium">{formatKwdLocale(Number(line.price) || 0, locale as Locale)}</span>
              </span>
              <button type="button" onClick={() => void remove(line)} className="shrink-0 text-xs text-danger">
                {t("remove")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-muted">{t("emptyCartTitle")}</p>
      )}
    </Sheet>
  );
}
