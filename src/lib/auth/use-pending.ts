"use client";

import { useCallback, useRef } from "react";

/**
 * Runs one async handler at a time.
 *
 * `disabled={busy}` is read from the previous render, so two clicks dispatched
 * before React re-renders both see `busy === false` and both run. For a
 * password reset that means two requests, and Firebase invalidates the first
 * link the moment it issues the second — so the student opens the older email
 * and is told the link "has expired or has already been used". The same window
 * exists on a verification resend, where it burns the link it just sent.
 *
 * A ref flips synchronously, which is what closes that window; `busy` stays
 * only for the spinner.
 */
export function usePending() {
  const pending = useRef(false);
  return useCallback(async (run: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    try {
      await run();
    } finally {
      pending.current = false;
    }
  }, []);
}
