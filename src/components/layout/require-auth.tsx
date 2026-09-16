"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useActivationGate } from "@/lib/auth/activation";
import { useAuth } from "@/lib/auth/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Wrap any page that needs a signed-in student. Handles the four redirects
 * every protected screen needs: not signed in -> /login, academic profile
 * missing -> /onboarding, activation not finished -> /activate, and session
 * revoked -> /session-ended.
 */
export function RequireAuth({
  children,
  allowOnboarding = false,
  allowActivation = false,
}: {
  children: React.ReactNode;
  allowOnboarding?: boolean;
  allowActivation?: boolean;
}) {
  const { user, ready, needsOnboarding, kicked } = useAuth();
  const activation = useActivationGate();
  const router = useRouter();
  const pathname = usePathname();
  // The academic step comes first, and the activation flow itself is exempt or
  // it could never be completed.
  const activationBlocked = activation.needsActivation && !needsOnboarding && !allowActivation;

  useEffect(() => {
    if (!ready) return;
    if (kicked) {
      router.replace("/session-ended");
      return;
    }
    if (!user) {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
      return;
    }
    if (needsOnboarding && !allowOnboarding) {
      router.replace("/onboarding");
      return;
    }
    if (activationBlocked) router.replace("/activate");
  }, [
    ready,
    user,
    needsOnboarding,
    activationBlocked,
    kicked,
    router,
    pathname,
    allowOnboarding,
  ]);

  if (
    !ready ||
    !user ||
    kicked ||
    (needsOnboarding && !allowOnboarding) ||
    activationBlocked
  ) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6" aria-busy>
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
