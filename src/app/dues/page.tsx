"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDocs, query, where } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadCart, saveCart, upsertLine } from "@/lib/cart/store";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";

export default function DuesPage() {
  const { user } = useAuth();
  const { t } = useI18n();
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

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl font-semibold">{t("transactions")}</h1>
      {(dues.data ?? []).map((due) => (
        <button
          key={due.id}
          type="button"
          className="mb-2 block w-full rounded-2xl border border-line p-3 text-start"
          onClick={() => {
            if (!user) return;
            void loadCart(user.uid).then((cart) =>
              saveCart(
                user.uid,
                upsertLine(cart, {
                  kind: "installment",
                  courseId: due.get("courseRef")?.id,
                  installmentId: due.id,
                  paymentType: "Full payment",
                  title: due.get("courseName") || "Installment",
                  price: due.get("amount"),
                  addedAt: Date.now(),
                }),
              ).then(() => {
                window.location.href = "/checkout";
              }),
            );
          }}
        >
          {due.get("courseName")} · {due.get("amount")} KWD · {due.get("status")}
        </button>
      ))}
    </AppShell>
  );
}
