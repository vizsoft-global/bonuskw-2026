"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDocs, query, where } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";

export default function TransactionsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const orders = useQuery({
    queryKey: ["orders", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(getDb(), collections.orders), where("userRef", "==", doc(getDb(), collections.users, user!.uid))),
      );
      return snap.docs;
    },
  });

  async function invoice(orderId: string) {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch(`/api/invoices/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = (await res.json()) as { url?: string };
    if (json.url) window.open(json.url, "_blank");
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">{t("transactions")}</h1>
      {(orders.data ?? []).map((order) => (
        <div key={order.id} className="mb-2 flex items-center justify-between rounded-2xl border border-line px-3 py-2 text-sm">
          <span>{order.get("orderID") || order.id} · {order.get("status")}</span>
          <button type="button" onClick={() => void invoice(order.id)}>{t("invoice")}</button>
        </div>
      ))}
    </AppShell>
  );
}
