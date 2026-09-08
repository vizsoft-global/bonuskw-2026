"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Wrap any page that needs a signed-in student. Handles the three redirects
 * every protected screen needs: not signed in -> /login, academic profile
 * missing -> /onboarding, and session revoked -> /session-ended.
 */
export function RequireAuth({
  children,
  allowOnboarding = false,
}: {
  children: React.ReactNode;
  allowOnboarding?: boolean;
}) {
  const { user, ready, needsOnboarding, kicked } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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
    if (needsOnboarding && !allowOnboarding) router.replace("/onboarding");
  }, [ready, user, needsOnboarding, kicked, router, pathname, allowOnboarding]);

  if (!ready || !user || kicked || (needsOnboarding && !allowOnboarding)) {
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
