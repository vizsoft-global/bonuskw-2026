"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { loadCart, saveCart, upsertLine } from "@/lib/cart/store";
import { useI18n } from "@/lib/i18n/locale";

export default function SavedPage() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">{t("saved")}</h1>
      {(profile?.fvrtCourseList ?? []).map((ref) => (
        <div key={ref.id} className="mb-2 flex items-center justify-between rounded-2xl border border-line px-3 py-2 text-sm">
          <Link href={`/course/${ref.id}`}>{ref.id}</Link>
          <button
            type="button"
            onClick={() => {
              if (!user) return;
              void loadCart(user.uid).then((cart) =>
                saveCart(
                  user.uid,
                  upsertLine(cart, {
                    kind: "course",
                    courseId: ref.id,
                    paymentType: "Full payment",
                    addedAt: Date.now(),
                  }),
                ),
              );
            }}
          >
            {t("moveToCart")}
          </button>
        </div>
      ))}
    </AppShell>
  );
}
