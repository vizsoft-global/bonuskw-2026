"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";

function VerifyForm() {
  const { t } = useI18n();
  const { confirmSms, sendFallback, confirmFallback, needsOnboarding } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [showFallback, setShowFallback] = useState(false);
  const phone = typeof window !== "undefined" ? window.sessionStorage.getItem("ba_phone") || "" : "";

  useEffect(() => {
    const id = window.setTimeout(() => setShowFallback(true), 30000);
    return () => window.clearTimeout(id);
  }, []);

  async function done() {
    router.replace(needsOnboarding ? "/onboarding" : "/");
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="glass w-full max-w-md rounded-3xl p-6">
        <h1 className="text-2xl font-semibold">{t("verifyTitle")}</h1>
        <p className="mt-2 text-sm text-muted">
          {t("verifyHint")} {phone}
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          className="mt-6 w-full rounded-2xl border border-line bg-transparent px-3 py-3 tracking-[0.4em]"
        />
        {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
        <button
          type="button"
          className="mt-4 w-full rounded-full bg-primary py-3 text-sm font-semibold text-white"
          onClick={() =>
            void confirmSms(code)
              .then(done)
              .catch((err: Error) => setError(err.message))
          }
        >
          {t("verify")}
        </button>
        {showFallback ? (
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              className="text-sm text-primary"
              onClick={() => void sendFallback(phone, "whatsapp").catch((err: Error) => setError(err.message))}
            >
              {t("whatsapp")}
            </button>
            <button
              type="button"
              className="text-sm text-muted"
              onClick={() =>
                void sendFallback(phone, "sms")
                  .then(() =>
                    confirmFallback(phone, code).then(done),
                  )
                  .catch((err: Error) => setError(err.message))
              }
            >
              {t("smsFallback")}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
