"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

/*
 * Home-screen install state shared by the auto prompt and the profile row.
 *
 * Only Chromium browsers fire `beforeinstallprompt`; iOS never does, so there
 * the UI can only explain "Share -> Add to Home Screen". The event is captured
 * once at module level so whichever component mounts first does not lose it.
 */

export type InstallPlatform =
  | "installed"
  /** Chromium on Android/desktop that gave us a deferred prompt. */
  | "android-native"
  /** Android browser without the event (Firefox, Samsung Internet, Opera). */
  | "android-manual"
  /** Safari / Chrome / Firefox on iOS or iPadOS: Share -> Add to Home Screen. */
  | "ios-safari"
  /** Instagram, Facebook, WhatsApp... webviews cannot install; open in Safari. */
  | "ios-inapp"
  | "desktop"
  | "unknown";

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_AT = "ba_install_dismissed_at";
const HIDDEN = "ba_install_hidden";
const INSTALLED = "ba_installed";
const OPENS = "ba_app_opens";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

type State = {
  ready: boolean;
  platform: InstallPlatform;
  deferred: BeforeInstallPromptEvent | null;
  /** True when the user (or a component) asked to show the sheet now. */
  open: boolean;
  /** Set once a manual "Don't show again" / install has happened. */
  hidden: boolean;
  /** True when "Not now" was tapped within the snooze window. */
  snoozed: boolean;
  opens: number;
};

let state: State = {
  ready: false,
  platform: "unknown",
  deferred: null,
  open: false,
  hidden: false,
  snoozed: false,
  opens: 0,
};
const listeners = new Set<() => void>();
let booted = false;

function emit(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn();
}

function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches
  );
}

function detectPlatform(): InstallPlatform {
  if (isStandalone()) return "installed";
  const ua = window.navigator.userAgent || "";
  const nav = window.navigator as Navigator & { maxTouchPoints?: number };
  // iPadOS 13+ reports itself as a Mac; touch points give it away.
  const iPadOs = /Macintosh/.test(ua) && (nav.maxTouchPoints ?? 0) > 1;
  const ios = /iPhone|iPad|iPod/.test(ua) || iPadOs;
  if (ios) {
    const inApp = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|Twitter|TikTok|Messenger|LinkedInApp|GSA\//i.test(ua);
    return inApp ? "ios-inapp" : "ios-safari";
  }
  if (/Android/i.test(ua)) return state.deferred ? "android-native" : "android-manual";
  return state.deferred ? "android-native" : "desktop";
}

function boot() {
  if (booted || typeof window === "undefined") return;
  booted = true;

  const opens = Number(read(OPENS) ?? "0") + 1;
  write(OPENS, String(opens));
  const params = new URLSearchParams(window.location.search);
  if (params.get("source") === "pwa" || isStandalone()) write(INSTALLED, "1");

  const hidden = read(HIDDEN) === "1" || read(INSTALLED) === "1";
  const snoozed = Date.now() < Number(read(DISMISSED_AT) ?? "0") + SNOOZE_MS;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    emit({ deferred: event as BeforeInstallPromptEvent, platform: isStandalone() ? "installed" : "android-native" });
  });
  window.addEventListener("appinstalled", () => {
    write(INSTALLED, "1");
    emit({ deferred: null, platform: "installed", hidden: true, open: false });
  });
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", (e) => {
    if (e.matches) emit({ platform: "installed", hidden: true, open: false });
  });

  emit({ ready: true, platform: detectPlatform(), hidden, snoozed, opens });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  boot();
  return () => {
    listeners.delete(fn);
  };
}

const serverState: State = { ...state };

export function useInstallPrompt() {
  const snap = useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );

  useEffect(() => {
    boot();
  }, []);

  const canPromptNatively = Boolean(snap.deferred);
  const installed = snap.platform === "installed";
  /** Whether the auto prompt should be considered at all right now. */
  const eligible =
    snap.ready &&
    !installed &&
    !snap.hidden &&
    !snap.snoozed &&
    snap.platform !== "desktop" &&
    snap.platform !== "unknown";

  const promptInstall = useCallback(async () => {
    const deferred = state.deferred;
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    if (choice.outcome === "accepted") {
      write(INSTALLED, "1");
      emit({ deferred: null, platform: "installed", hidden: true, open: false });
    } else {
      // The browser only lets us call prompt() once per captured event.
      emit({ deferred: null, platform: detectPlatform() });
    }
    return choice.outcome;
  }, []);

  const snooze = useCallback(() => {
    write(DISMISSED_AT, String(Date.now()));
    emit({ snoozed: true, open: false });
  }, []);

  const hideForever = useCallback(() => {
    write(HIDDEN, "1");
    emit({ hidden: true, open: false });
  }, []);

  const show = useCallback(() => emit({ open: true }), []);
  const close = useCallback(() => emit({ open: false }), []);

  return {
    ready: snap.ready,
    platform: snap.platform,
    installed,
    canPromptNatively,
    eligible,
    opens: snap.opens,
    open: snap.open,
    show,
    close,
    promptInstall,
    snooze,
    hideForever,
  };
}
