"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { openCart } from "@/components/cart/cart-panel";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";
import { imageFor } from "@/lib/media/image-url";

type Added = { title?: string; image?: string };

let show: ((item: Added) => void) | null = null;

/** Confirms a successful add-to-cart from anywhere in the app. */
export function showAddedToCart(item: Added) {
  show?.(item);
}

export function AddedToCartDialog() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const client = useQueryClient();
  const [item, setItem] = useState<Added | null>(null);

  useEffect(() => {
    const open = (next: Added) => {
      setItem(next);
      void client.invalidateQueries({ queryKey: ["cart", user?.uid] });
    };
    show = open;
    return () => {
      if (show === open) show = null;
    };
  }, [client, user?.uid]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item]);

  if (!item) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
      onClick={() => setItem(null)}
    >
      <div
        className="relative w-full max-w-sm rounded-[20px] border border-line bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-2xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label={t("close")}
          onClick={() => setItem(null)}
          className="absolute end-3 top-3 grid size-8 place-items-center rounded-full text-muted hover:text-text"
        >
          <X className="size-4" />
        </button>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-[#1f9d4d]/15">
            <Check className="size-6 text-[#1f9d4d]" />
          </span>
          <h2 className="text-[16px] font-semibold text-text">{t("addedTitle")}</h2>
          <div className="flex w-full items-center gap-3 rounded-[12px] bg-surface-2 p-2 text-start">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageFor("courseCard", item.image)} alt="" className="size-12 shrink-0 rounded-[8px] object-cover" />
            ) : null}
            <p className="line-clamp-2 text-[13px] font-medium text-text">{item.title}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setItem(null);
              router.push("/cart");
            }}
            className="h-11 rounded-full bg-[#0c5eff] text-[14px] font-semibold text-white"
          >
            {t("checkout")}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setItem(null);
                openCart();
              }}
              className="h-11 flex-1 rounded-full border border-line text-[13px] font-medium text-text"
            >
              {t("viewCart")}
            </button>
            <button
              type="button"
              onClick={() => setItem(null)}
              className="h-11 flex-1 rounded-full border border-line text-[13px] font-medium text-text"
            >
              {t("continueBrowsing")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
