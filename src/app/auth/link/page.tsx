"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { CtaButton } from "@/components/auth/cta-button";
import { PageLoader } from "@/components/shared/loader";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";

type State = { kind: "working" } | { kind: "error"; code: string };

/**
 * Landing page for admin-issued sign-in links (`/auth/link?t=…`). Redeems the
 * token once, signs the student in and sends them on. The token is single use,
 * so a failure here is final and the student must ask for a fresh link.
 */
function LinkSignIn() {
  const { t } = useI18n();
  const { signInWithLink } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const [state, setState] = useState<State>(() =>
    token ? { kind: "working" } : { kind: "error", code: "invalid" },
  );
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    signInWithLink(token)
      .then((result) => router.replace(result.needsOnboarding ? "/onboarding" : "/"))
      .catch((err: Error & { code?: string }) => {
        const code = (err.code ?? "").replace(/^link\//, "") || "invalid";
        setState({ kind: "error", code });
      });
  }, [router, signInWithLink, token]);

  if (state.kind === "working") {
    return (
      <AuthShell showBack={false}>
        <div className="flex flex-col gap-6">
          <AuthHeading>{t("linkSigningIn")}</AuthHeading>
          <PageLoader />
        </div>
      </AuthShell>
    );
  }

  const message =
    state.code === "expired"
      ? t("linkExpired")
      : state.code === "used"
        ? t("linkUsed")
        : t("linkInvalid");

  return (
    <AuthShell showBack={false}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2.5">
          <AuthHeading>{t("linkFailedTitle")}</AuthHeading>
          <p className="text-[14px] leading-relaxed text-white/60">{message}</p>
        </div>
        <CtaButton onClick={() => router.replace("/login")}>{t("linkGoToLogin")}</CtaButton>
      </div>
    </AuthShell>
  );
}

export default function LinkPage() {
  return (
    <Suspense fallback={<PageLoader full />}>
      <LinkSignIn />
    </Suspense>
  );
}
