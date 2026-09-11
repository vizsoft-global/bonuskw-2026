/**
 * Human messages for Firebase Auth failures. The raw codes ("auth/…") are
 * meaningless to students, and a few of them point at configuration problems
 * we want to see clearly while testing (reCAPTCHA, authorized domains, quota).
 */
export type AuthErrorKey =
  | "authErrInvalidPhone"
  | "authErrTooMany"
  | "authErrQuota"
  | "authErrCaptcha"
  | "authErrDomain"
  | "authErrNetwork"
  | "authErrBadCode"
  | "authErrCodeExpired"
  | "authErrNoCode"
  | "authErrWrongPassword"
  | "authErrNoUser"
  | "authErrDisabled"
  | "authErrPopupClosed"
  | "authErrOtherProvider"
  | "authErrInvalidEmail"
  | "authErrGeneric";

export function authErrorKey(err: unknown): AuthErrorKey {
  const code =
    typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code ?? "") : "";
  switch (code) {
    case "auth/invalid-phone-number":
    case "auth/missing-phone-number":
      return "authErrInvalidPhone";
    case "auth/too-many-requests":
      return "authErrTooMany";
    case "auth/quota-exceeded":
      return "authErrQuota";
    case "auth/invalid-app-credential":
    case "auth/captcha-check-failed":
    case "auth/missing-app-credential":
    case "auth/app-not-authorized":
      return "authErrCaptcha";
    case "auth/unauthorized-domain":
    case "auth/unauthorized-continue-uri":
      return "authErrDomain";
    case "auth/network-request-failed":
    case "auth/timeout":
      return "authErrNetwork";
    case "auth/invalid-verification-code":
    case "auth/invalid-verification-id":
      return "authErrBadCode";
    case "auth/code-expired":
    case "auth/session-expired":
      return "authErrCodeExpired";
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "authErrWrongPassword";
    case "auth/user-not-found":
      return "authErrNoUser";
    case "auth/user-disabled":
      return "authErrDisabled";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "authErrPopupClosed";
    case "auth/account-exists-with-different-credential":
    case "auth/credential-already-in-use":
    case "auth/provider-already-linked":
      return "authErrOtherProvider";
    case "auth/invalid-email":
    case "auth/missing-email":
      return "authErrInvalidEmail";
    default:
      return "authErrGeneric";
  }
}

/** Message for the UI; falls back to a server-provided message (custom OTP route). */
export function authErrorMessage(err: unknown, t: (key: AuthErrorKey) => string): string {
  const key = authErrorKey(err);
  if (key === "authErrGeneric" && err instanceof Error && err.message && !err.message.startsWith("Firebase:")) {
    return err.message;
  }
  if (key === "authErrGeneric") {
    // Unmapped Firebase code: keep it visible in small print so a support
    // screenshot tells us what actually failed.
    const code =
      typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code ?? "") : "";
    if (code) return `${t(key)} (${code})`;
  }
  return t(key);
}
