"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Fullscreen for the lesson player.
 *
 * The lesson video lives in a cross-origin iframe (VdoCipher or Cloudflare
 * Stream), so the only fullscreen a student could reach was the provider's own
 * button inside that player — and the provider does not always render it on a
 * phone, which leaves "go fullscreen" with nothing behind it. The page now
 * owns the control:
 *
 * - where the browser has the Fullscreen API, the stage element itself goes
 *   fullscreen and the iframe grows with it;
 * - where it does not — every iPhone, since Safari on iOS implements
 *   requestFullscreen for `<video>` only, and a refused request throws — the
 *   stage is pinned over the page instead, so fullscreen still means a
 *   screen-filling video rather than a dead button.
 */

/** Safari's vendor-prefixed names, which only exist on a real element. */
type PrefixedElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type PrefixedDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
};

function prefixed() {
  return document as PrefixedDocument;
}

/** Whatever the browser currently has fullscreen, under either name. */
function fullscreenElement() {
  if (typeof document === "undefined") return null;
  return document.fullscreenElement ?? prefixed().webkitFullscreenElement ?? null;
}

/** False on iOS and in frames the embed did not grant fullscreen to. */
function apiAvailable() {
  if (typeof document === "undefined") return false;
  return Boolean(document.fullscreenEnabled ?? prefixed().webkitFullscreenEnabled);
}

export function useFullscreen(element: HTMLElement | null) {
  /** True while the pinned-over-the-page fallback is standing in for fullscreen. */
  const [filling, setFilling] = useState(false);
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const fillingRef = useRef(false);

  // The provider player starts its own fullscreen from inside the iframe,
  // which the parent document reports as a change too — so the button label
  // stays truthful whichever side began it.
  useEffect(() => {
    const sync = () => setBrowserFullscreen(Boolean(fullscreenElement()));
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  const release = useCallback(() => {
    fillingRef.current = false;
    setFilling(false);
    document.documentElement.removeAttribute("data-video-fill");
    document.body.style.removeProperty("overflow");
    if (fullscreenElement()) {
      const api = prefixed();
      void Promise.resolve(document.exitFullscreen?.() ?? api.webkitExitFullscreen?.()).catch(
        () => undefined,
      );
    }
  }, []);

  const enter = useCallback(async () => {
    if (!element) return;
    if (apiAvailable()) {
      const target = element as PrefixedElement;
      const request =
        element.requestFullscreen?.bind(element) ?? target.webkitRequestFullscreen?.bind(target);
      if (request) {
        try {
          await request();
          return;
        } catch {
          /* Refused: this frame has no fullscreen permission. Pin instead. */
        }
      }
    }
    fillingRef.current = true;
    setFilling(true);
    // Lets the floating Help button hide during iOS "fill" fullscreen.
    document.documentElement.dataset.videoFill = "1";
    // The pinned layer sits over a page that would still scroll under it.
    document.body.style.overflow = "hidden";
  }, [element]);

  const active = browserFullscreen || filling;
  const toggle = useCallback(() => {
    if (browserFullscreen || fillingRef.current) release();
    else void enter();
  }, [browserFullscreen, release, enter]);

  // Escape leaves the pinned layout; a real fullscreen is the browser's to end.
  useEffect(() => {
    if (!filling) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") release();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filling, release]);

  // A lesson change can replace the player while it is pinned: never leave the
  // page scroll-locked behind it.
  useEffect(
    () => () => {
      if (fillingRef.current) {
        document.body.style.removeProperty("overflow");
        document.documentElement.removeAttribute("data-video-fill");
      }
    },
    [],
  );

  return { active, filling, toggle, release };
}
