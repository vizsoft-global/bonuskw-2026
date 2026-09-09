"use client";

import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { APP_VERSION, BUILD_TIME } from "@/lib/version";

const FORCE_KEY = "ba_force_reload_at";

export async function clearAndReload() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(Date.now()));
    window.location.replace(url.toString());
  }
}

/**
 * Two independent triggers keep every open tab on the latest build:
 * 1. `/api/version` (served fresh by the newest deployment) disagrees with the
 *    version this bundle was compiled with, or a chunk fails to load.
 * 2. Admin sets `adminConfig/studentApp.forceReloadAt` to a timestamp newer
 *    than this bundle's build time — an explicit "refresh everyone" switch.
 */
export function VersionGuard() {
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
        const json = (await res.json()) as { version?: string };
        if (json.version && json.version !== "dev" && APP_VERSION !== "dev" && json.version !== APP_VERSION) {
          await clearAndReload();
        }
      } catch {
        // offline; try again on the next tick
      }
    };
    void check();
    const id = window.setInterval(check, 20 * 1000);
    const onFocus = () => void check();
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    const onError = (event: ErrorEvent) => {
      const message = String(event.message || "");
      if (message.includes("ChunkLoadError") || message.includes("Loading chunk")) {
        void clearAndReload();
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = String((event.reason && (event.reason.message || event.reason)) || "");
      if (reason.includes("ChunkLoadError") || reason.includes("Failed to fetch dynamically imported module")) {
        void clearAndReload();
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    let stop: (() => void) | undefined;
    try {
      stop = onSnapshot(doc(getDb(), collections.adminConfig, "studentApp"), (snap) => {
        const raw = snap.get("forceReloadAt") as { toMillis?: () => number } | number | undefined;
        const at = typeof raw === "number" ? raw : raw?.toMillis?.() ?? 0;
        if (!at) return;
        const done = Number(window.localStorage.getItem(FORCE_KEY) || 0);
        if (at > BUILD_TIME && at > done) {
          window.localStorage.setItem(FORCE_KEY, String(at));
          void clearAndReload();
        }
      });
    } catch {
      // Firebase not configured (e.g. preview without env); version polling still runs.
    }

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      stop?.();
    };
  }, []);
  return null;
}
