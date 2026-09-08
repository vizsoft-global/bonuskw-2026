"use client";

import { EmailAuthProvider, updatePassword } from "firebase/auth";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";

export default function PasswordPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [next, setNext] = useState("");
  const hasPassword = user?.providerData.some((p) => p.providerId === "password");

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">{t("changePassword")}</h1>
      {hasPassword ? (
        <>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="rounded-2xl border border-line bg-transparent px-3 py-3" />
          <button
            type="button"
            className="ms-2 rounded-full bg-primary px-4 py-2 text-sm text-white"
            onClick={() => {
              if (user) void updatePassword(user, next);
            }}
          >
            {t("finish")}
          </button>
        </>
      ) : (
        <p className="text-sm text-muted">This account uses a phone number. Manage sign-in from the login screen.</p>
      )}
      <span className="hidden">{EmailAuthProvider.PROVIDER_ID}</span>
    </AppShell>
  );
}
