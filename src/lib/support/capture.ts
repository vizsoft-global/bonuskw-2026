"use client";

import { domToJpeg } from "modern-screenshot";

/**
 * Screenshot of what the user is looking at, not the whole scrollable page.
 * Fonts are not embedded (they account for most of the capture time), so text
 * renders in a system font — fine for a support screenshot. Help-widget nodes
 * carry `data-help-widget` and are left out, so the open dialog never appears.
 */
export async function captureViewport(): Promise<string | null> {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const x = window.scrollX;
  const y = window.scrollY;
  try {
    return await domToJpeg(document.body, {
      width,
      height,
      quality: 0.7,
      scale: Math.min(1, 1280 / Math.max(width, 1)),
      font: false,
      timeout: 4000,
      features: { restoreScrollPosition: true },
      style:
        x || y
          ? { transform: `translate(${-x}px, ${-y}px)`, transformOrigin: "top left" }
          : null,
      filter: (node) => !(node instanceof HTMLElement && node.dataset.helpWidget),
    });
  } catch (err) {
    console.warn("[help] screenshot failed", err);
    return null;
  }
}

/** Resolves with the screenshot, or null if it is not ready within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** Lets the dialog paint before the DOM clone blocks the main thread. */
export function afterPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

export type HelpDraft = {
  category: string;
  message: string;
  name: string;
  email: string;
  phone: string;
  at: number;
};

const DRAFT_KEY = "ba-help-draft";
const DRAFT_TTL_MS = 24 * 60 * 60_000;
const listeners = new Set<() => void>();

/** `useSyncExternalStore` subscription for "is there an unsent draft". */
export function subscribeDraft(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function hasDraftSnapshot() {
  return Boolean(loadDraft());
}

export function loadDraft(): HelpDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as HelpDraft;
    if (!draft.at || Date.now() - draft.at > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<HelpDraft, "at">) {
  try {
    if (!draft.message.trim()) {
      localStorage.removeItem(DRAFT_KEY);
    } else {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, at: Date.now() }));
    }
  } catch {
    /* private mode / quota: drafts are best-effort */
  }
  listeners.forEach((cb) => cb());
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((cb) => cb());
}
