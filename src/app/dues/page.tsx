"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDocs, query, where, type QueryDocumentSnapshot } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";
import { usePurchaseGate } from "@/lib/commerce/purchase-gate";
import { loadCart, saveCart, upsertLine, type CartLine, type CartState } from "@/lib/cart/store";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { formatKwdLocale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";

function dueLine(due: QueryDocumentSnapshot): CartLine {
  return {
    kind: "installment",
    courseId: due.get("courseRef")?.id,
    installmentId: due.id,
    paymentType: "Full payment",
    title: due.get("courseName") || "Installment",
    price: due.get("amount"),
    addedAt: Date.now(),
  };
}

export default function DuesPage() {
  const { user } = useAuth();
  const gate = usePurchaseGate();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const dues = useQuery({
    queryKey: ["dues", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(getDb(), collections.installments), where("userRef", "==", doc(getDb(), collections.users, user!.uid))),
      );
      return snap.docs.filter((d) => d.get("status") === "due" || d.get("status") === "overdue");
    },
  });

  const list = dues.data ?? [];
  const total = list.reduce((sum, d) => sum + (Number(d.get("amount")) || 0), 0);

  const paused = gate.blockFor("installment");

  async function addToCart(items: QueryDocumentSnapshot[]) {
    if (!user || busy || paused) return;
    setBusy(true);
    try {
      let cart: CartState = await loadCart(user.uid);
      for (const due of items) cart = upsertLine(cart, dueLine(due));
      await saveCart(user.uid, cart);
      router.push("/cart");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell loading={dues.isPending} title={t("transactions")} skeleton={<ListPageSkeleton />}>
      {list.length ? (
        <>
          {/* One checkout for everything outstanding: a single gateway charge. */}
          {paused ? (
            <p className="mb-3 rounded-[10px] bg-[#f5d08a]/10 p-3 text-[12px] leading-relaxed text-[#f5d08a]">
              {paused}
            </p>
          ) : null}
          {list.length > 1 ? (
            <button
              type="button"
              disabled={busy || Boolean(paused)}
              onClick={() => void addToCart(list)}
              className="mb-3 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#0c5eff] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
            >
              {t("payAllDue").replace("{amount}", formatKwdLocale(total, locale))}
            </button>
          ) : null}
          {list.map((due) => (
            <button
              key={due.id}
              type="button"
              disabled={busy || Boolean(paused)}
              className="mb-2 block min-h-11 w-full rounded-2xl border border-line p-3 text-start disabled:opacity-60"
              onClick={() => void addToCart([due])}
            >
              {due.get("courseName")} · {formatKwdLocale(Number(due.get("amount")) || 0, locale)} · {due.get("status")}
              {due.get("index") ? (
                <span className="ms-1 text-[11px] text-[#999]">
                  ({due.get("index")}
                  {due.get("count") ? `/${due.get("count")}` : ""})
                </span>
              ) : null}
            </button>
          ))}
        </>
      ) : (
        <EmptyState icon="/profile/clock.svg" title={t("emptyDuesTitle")} body={t("emptyDuesBody")} />
      )}
    </AppShell>
  );
}
