"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";

/**
 * Who this session belongs to, with a way out. Without it a student who signed
 * in with the wrong Google account had no way to tell, and no way to leave.
 * Used by onboarding and by activation, the two screens a fresh account sees.
 */
export function SignedInAs() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;
  const providerId = user.providerData[0]?.providerId ?? "";
  const provider =
    providerId === "google.com"
      ? "Google"
      : providerId === "apple.com"
        ? "Apple"
        : providerId === "password"
          ? "Email"
          : "";
  const who = user.email || user.phoneNumber || user.displayName || provider;
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line pt-4 text-[13px] text-muted">
      <span className="min-w-0 truncate">
        {t("signedInAs")} <span className="text-text">{who}</span>
        {provider && who !== provider ? ` · ${provider}` : ""}
      </span>
      <button
        type="button"
        onClick={() => void logout().then(() => router.replace("/login"))}
        className="shrink-0 font-medium text-text underline underline-offset-2"
      >
        {t("notYou")}
      </button>
    </div>
  );
}
