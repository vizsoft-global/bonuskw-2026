"use client";

import { useEffect } from "react";
import { APP_VERSION } from "@/lib/version";

async function clearAndReload() {
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  }
  window.location.reload();
}

export function VersionGuard() {
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const json = (await res.json()) as { version?: string };
        if (json.version && json.version !== "dev" && json.version !== APP_VERSION) {
          await clearAndReload();
        }
      } catch {
        // ignore offline
      }
    };
    void check();
    const id = window.setInterval(check, 5 * 60 * 1000);
    window.addEventListener("focus", check);
    const onError = (event: ErrorEvent) => {
      if (String(event.message || "").includes("ChunkLoadError")) void clearAndReload();
    };
    window.addEventListener("error", onError);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, []);
  return null;
}
