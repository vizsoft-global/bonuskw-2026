"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BrandLogo } from "@/components/layout/brand";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";

function LoginForm() {
  const params = useSearchParams();
  const mode = params.get("mode") === "signup" ? "signup" : "login";
  const { t } = useI18n();
  const { sendSms, signInGoogle, signInApple } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      await sendSms(phone);
      router.push(`/verify?mode=${mode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send SMS");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="grid place-items-center px-6 py-16">
        <div className="glass w-full max-w-md rounded-3xl p-6">
          <BrandLogo className="mb-1" />
          <h1 className="mt-2 text-2xl font-semibold">
            {mode === "signup" ? t("createAccount") : t("welcomeBack")}
          </h1>
          <p className="mt-2 text-sm text-muted">{t("phoneHint")}</p>
          <label className="mt-6 block text-sm">
            {t("mobileNumber")}
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+965"
              className="mt-2 w-full rounded-2xl border border-line bg-transparent px-3 py-3"
            />
          </label>
          {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="mt-4 w-full rounded-full bg-white py-3 text-sm font-semibold text-black"
          >
            {t("continue")}
          </button>
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={() => void signInGoogle()} className="rounded-full border border-line py-2 text-sm">
              {t("google")}
            </button>
            <button type="button" onClick={() => void signInApple()} className="rounded-full border border-line py-2 text-sm">
              {t("apple")}
            </button>
          </div>
          <p className="mt-4 text-xs text-muted">{t("agree")}</p>
        </div>
      </section>
      <section className="hidden bg-gradient-to-br from-black via-[#2a120c] to-[#ff4a1c]/40 lg:block" />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
