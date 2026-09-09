"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/locale";
import { haptic } from "@/lib/ui/haptics";

export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  const { t } = useI18n();

  function goBack() {
    haptic("light");
    try {
      const ref = document.referrer;
      if (ref && new URL(ref).origin === window.location.origin) {
        router.back();
        return;
      }
    } catch {
      /* ignore invalid referrer */
    }
    router.push(fallback);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={t("back")}
      className="grid size-10 shrink-0 cursor-pointer place-items-center"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/onboarding/back.svg" alt="" className="size-6 rtl:-scale-x-100" />
    </button>
  );
}
