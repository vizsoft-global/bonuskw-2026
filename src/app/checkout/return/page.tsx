"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ListPageSkeleton } from "@/components/shared/skeleton";
import { useAuth } from "@/lib/auth/auth-provider";

function ReturnBody() {
  const params = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState("Checking payment…");
  const orderId = params.get("orderId") || params.get("tap_id") || "";

  useEffect(() => {
    if (!user || !orderId) return;
    let n = 0;
    const id = window.setInterval(() => {
      void user.getIdToken().then(async (token) => {
        const res = await fetch(`/api/checkout/status?orderId=${encodeURIComponent(orderId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as { status?: string };
        setStatus(json.status || "Pending");
        if (json.status === "Paid" || json.status === "CAPTURED" || n++ > 12) window.clearInterval(id);
      });
    }, 2000);
    return () => window.clearInterval(id);
  }, [user, orderId]);

  const checking = status === "Checking payment…";

  return (
    <AppShell loading={checking} title={status} skeleton={<ListPageSkeleton rows={3} />}>
      <p className="text-2xl font-semibold">{status}</p>
      <Link href="/" className="mt-4 inline-block text-primary">Home</Link>
    </AppShell>
  );
}

export default function CheckoutReturnPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#050505]" />}>
      <ReturnBody />
    </Suspense>
  );
}
