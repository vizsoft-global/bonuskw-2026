"use client";

import { useEffect, useRef } from "react";

/**
 * Reads a one-time code straight out of an SMS, with the student's consent, so
 * they do not have to switch apps and type six digits back in.
 *
 * Two things gate this and neither is under our control:
 *
 *  1. The browser. Only Chrome on Android implements `OTPCredential`; iOS
 *     Safari and every desktop browser do not. That is why the input also
 *     carries `autocomplete="one-time-code"` — Safari ignores the API but still
 *     offers the code above the keyboard for a correctly formatted message.
 *  2. The message. The SMS has to end with a domain-bound line on its own:
 *
 *       Your Bonus Academy code is 123456
 *
 *       @app.bonuskw.com #123456
 *
 *     Without that line the browser will not hand the code over.
 *
 * Because either can be missing, this fails silently by design: the student
 * types the code exactly as before. It must never surface an error, and it must
 * never be the only way in.
 */
/**
 * The last code a listener received.
 *
 * Chrome resolves `get()` on the screen that asked for the SMS, and the student
 * is then navigated to the screen with the code boxes on it. Without carrying
 * the code across that hop the prompt only lands once they have already read
 * the message and typed it in, which is what makes the whole thing pointless.
 */
let delivered: string | null = null;

/** Reads and clears a code that arrived on a screen the student has left. */
export function takeDeliveredOtp(): string | null {
  const code = delivered;
  delivered = null;
  return code;
}

export function useWebOtp({
  enabled,
  onCode,
  takeStashed = false,
}: {
  /** Arm the listener only while a code is actually awaited. */
  enabled: boolean;
  /** Optional; a screen with no code boxes of its own can just leave it stashed. */
  onCode?: (code: string) => void;
  /** Deliver a code stashed by the screen that requested the SMS. */
  takeStashed?: boolean;
}) {
  // Kept in a ref so a caller passing an inline function does not re-arm the
  // request on every render — `get()` is a listening operation, not a cheap one.
  const handler = useRef(onCode);
  useEffect(() => {
    handler.current = onCode;
  }, [onCode]);

  /**
   * Hand over anything the previous screen caught, once, on mount. Delivered
   * through the same callback the live listener uses, so the screen has one way
   * to receive a code rather than two.
   */
  useEffect(() => {
    if (!takeStashed) return;
    const pending = takeDeliveredOtp();
    if (pending) handler.current?.(pending);
  }, [takeStashed]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    // Feature detection rather than a platform sniff.
    if (!("OTPCredential" in window)) return;
    if (!navigator.credentials?.get) return;

    const controller = new AbortController();
    const options = {
      otp: { transport: ["sms"] },
      signal: controller.signal,
    } as unknown as CredentialRequestOptions;

    void navigator.credentials
      .get(options)
      .then((credential) => {
        const code = (credential as unknown as { code?: string } | null)?.code;
        if (!code) return;
        const clean = code.replace(/\D/g, "").slice(0, 6);
        // Stashed as well as handed over, so a screen that is about to unmount
        // does not lose the code to the navigation that unmounts it.
        delivered = clean;
        handler.current?.(clean);
      })
      .catch(() => {
        // Aborted, dismissed, or the message was not formatted for us. Nothing
        // to report — the manual path is still there.
      });

    return () => controller.abort();
  }, [enabled]);
}
