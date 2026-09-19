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
export function useWebOtp({
  enabled,
  onCode,
}: {
  /** Arm the listener only while a code is actually awaited. */
  enabled: boolean;
  onCode: (code: string) => void;
}) {
  // Kept in a ref so a caller passing an inline function does not re-arm the
  // request on every render — `get()` is a listening operation, not a cheap one.
  const handler = useRef(onCode);
  useEffect(() => {
    handler.current = onCode;
  }, [onCode]);

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
        if (code) handler.current(code.replace(/\D/g, "").slice(0, 6));
      })
      .catch(() => {
        // Aborted, dismissed, or the message was not formatted for us. Nothing
        // to report — the manual path is still there.
      });

    return () => controller.abort();
  }, [enabled]);
}
