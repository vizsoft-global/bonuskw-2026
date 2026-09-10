"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { doc, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";
import { APP_VERSION, BUILD_TIME } from "@/lib/version";

const POLL_MS = 30 * 1000;
const MIN_GAP_MS = 15 * 1000;
const RELOAD_LOOP_WINDOW_MS = 60 * 1000;
const RELOAD_MARK_KEY = "ba:last-version-reload";
const FORCE_KEY = "ba_force_reload_at";

type ReloadMark = { version: string; at: number };

function readMark(): ReloadMark | null {
  try {
    const raw = window.sessionStorage.getItem(RELOAD_MARK_KEY);
    return raw ? (JSON.parse(raw) as ReloadMark) : null;
  } catch {
    return null;
  }
}

function writeMark(mark: ReloadMark) {
  try {
    window.sessionStorage.setItem(RELOAD_MARK_KEY, JSON.stringify(mark));
  } catch {
    /* storage unavailable */
  }
}

async function clearClientCaches() {
  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      /* ignore */
    }
  }
  if ("serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    } catch {
      /* ignore */
    }
  }
}

function hardReload() {
  const url = new URL(window.location.href);
  url.searchParams.set("v", String(Date.now()));
  // replace() plus a new query avoids reload() restoring the cached document.
  window.location.replace(url.toString());
}

/** Clear caches and reload. Kept exported for the profile "Reset app" action. */
export async function clearAndReload() {
  try {
    await clearClientCaches();
  } finally {
    hardReload();
  }
}

function isChunkLoadError(value: unknown) {
  const message =
    value instanceof Error
      ? `${value.name} ${value.message}`
      : typeof value === "string"
        ? value
        : "";
  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

/**
 * Keeps every open tab / installed PWA on the latest build. Same behaviour as
 * the admin panel:
 *
 * 1. `/api/version` (served by the newest deployment) disagrees with the
 *    version this bundle was compiled with, or a chunk fails to load → clear
 *    caches + service worker and hard-reload, with a short toast.
 * 2. If that reload did not land on the new build within a minute (stuck
 *    cache, offline), stop looping and show a top bar with "Refresh now".
 * 3. Admin sets `adminConfig/studentApp.forceReloadAt` newer than this build →
 *    explicit "refresh everyone" switch.
 */
export function VersionGuard() {
  const { t } = useI18n();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [stuck, setStuck] = useState(false);
  const lastCheck = useRef(0);
  const reloading = useRef(false);

  const forceRefresh = useCallback(
    async (serverVersion: string) => {
      if (reloading.current) return;
      reloading.current = true;

      const mark = readMark();
      const loopDetected =
        mark && mark.version === serverVersion && Date.now() - mark.at < RELOAD_LOOP_WINDOW_MS;

      queryClient.clear();
      await clearClientCaches();
      setStuck(true);

      if (loopDetected) {
        // Reloading again would just spin; leave the bar up for a manual refresh.
        reloading.current = false;
        return;
      }

      writeMark({ version: serverVersion, at: Date.now() });
      toast.info(t("updatingApp"), { duration: 1200 });
      window.setTimeout(() => hardReload(), 400);
    },
    [queryClient, t],
  );

  const check = useCallback(
    async (force = false) => {
      if (APP_VERSION === "dev" || reloading.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden" && !force) return;
      const now = Date.now();
      if (!force && now - lastCheck.current < MIN_GAP_MS) return;
      lastCheck.current = now;
      try {
        const res = await fetch(`/api/version?t=${now}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { version?: string };
        if (json.version && json.version !== "dev" && json.version !== APP_VERSION) {
          await forceRefresh(json.version);
        }
      } catch {
        /* offline or transient — try again on the next trigger */
      }
    },
    [forceRefresh],
  );

  // Route changes are a natural moment to compare versions.
  useEffect(() => {
    const timer = window.setTimeout(() => void check(), 0);
    return () => window.clearTimeout(timer);
  }, [pathname, check]);

  useEffect(() => {
    const initial = window.setTimeout(() => void check(true), 0);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const onFocus = () => void check();
    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error ?? event.message)) void forceRefresh(`chunk:${APP_VERSION}`);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) void forceRefresh(`chunk:${APP_VERSION}`);
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    const timer = window.setInterval(() => void check(), POLL_MS);

    // Admin-triggered "refresh everyone".
    let stop: (() => void) | undefined;
    try {
      stop = onSnapshot(doc(getDb(), collections.adminConfig, "studentApp"), (snap) => {
        const raw = snap.get("forceReloadAt") as { toMillis?: () => number } | number | undefined;
        const at = typeof raw === "number" ? raw : raw?.toMillis?.() ?? 0;
        if (!at) return;
        const done = Number(window.localStorage.getItem(FORCE_KEY) || 0);
        if (at > BUILD_TIME && at > done) {
          window.localStorage.setItem(FORCE_KEY, String(at));
          void forceRefresh(`force:${at}`);
        }
      });
    } catch {
      /* Firebase not configured (preview without env); version polling still runs. */
    }

    return () => {
      window.clearTimeout(initial);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.clearInterval(timer);
      stop?.();
    };
  }, [check, forceRefresh]);

  if (!stuck) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-app-top px-4 pb-2.5 text-[13px] text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] pt-[calc(env(safe-area-inset-top,0px)+10px)]"
    >
      <span>{t("updateAvailable")}</span>
      <button
        type="button"
        onClick={() => {
          writeMark({ version: "", at: 0 });
          void clearAndReload();
        }}
        className="rounded-full bg-white px-3 py-1 text-[12px] font-semibold text-[#111] active:scale-95"
      >
        {t("refreshNow")}
      </button>
    </div>
  );
}
