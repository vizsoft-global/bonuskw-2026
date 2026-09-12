"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { PageLoader } from "@/components/shared/loader";
import { endCurrentSession, setStoredSessionId } from "@/lib/auth/session-client";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useI18n } from "@/lib/i18n/locale";

/**
 * Escape hatch: `/logout` ends the Firebase session and wipes every saved
 * login bit on this device, then lands on the sign-in screen. Reachable by
 * URL even when the UI has no working sign-out button.
 */
export default function LogoutPage() {
  const { t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const current = getFirebaseAuth().currentUser;
      const token = current ? await current.getIdToken().catch(() => null) : null;
      await endCurrentSession(token);
      setStoredSessionId(null);
      try {
        await signOut(getFirebaseAuth());
      } catch {
        /* already signed out */
      }
      try {
        window.sessionStorage.clear();
        Object.keys(window.localStorage)
          .filter((key) => key.startsWith("ba_session") || key.startsWith("firebase:"))
          .forEach((key) => window.localStorage.removeItem(key));
      } catch {
        /* private mode */
      }
      if (!cancelled) router.replace("/login");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <AuthShell showBack={false}>
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <PageLoader />
        <p className="text-[14px] text-white/60">{t("signingOut")}</p>
      </div>
    </AuthShell>
  );
}
