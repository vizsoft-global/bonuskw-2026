"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/locale";

/**
 * Served by the service worker when a navigation fails without network.
 * Kept free of auth/Firestore so it renders from cache alone.
 */
export default function OfflinePage() {
  const { t } = useI18n();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  function retry() {
    const target = document.referrer && new URL(document.referrer).origin === location.origin ? document.referrer : "/";
    location.replace(target);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-app-top px-6 text-center text-[#fafafa] pt-safe-header pb-safe">
      <Image src="/icons/icon-192.png" alt="" width={72} height={72} className="size-[72px] rounded-2xl" priority />
      <span className="mt-6 grid size-12 place-items-center rounded-full bg-white/10 text-[#ff4a1c]">
        <WifiOff className="size-6" />
      </span>
      <h1 className="mt-4 text-xl font-semibold">{t("offlineTitle")}</h1>
      <p className="mt-2 max-w-xs text-sm text-[#999]">{t("offlineBody")}</p>
      <Button variant="accent" size="lg" className="mt-6 min-w-40" onClick={retry}>
        {t("retry")}
      </Button>
      {online ? null : <p className="mt-3 text-xs text-[#666]">Offline</p>}
    </main>
  );
}
