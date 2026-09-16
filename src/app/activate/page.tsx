"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ActivationFlow } from "@/components/auth/activation-flow";
import { useActivationGate } from "@/lib/auth/activation";
import { useAuth } from "@/lib/auth/auth-provider";
import { PageLoader } from "@/components/shared/loader";

/**
 * The activation route. `ActivationGuard` shows the same flow inline over any
 * page, so this exists for a direct visit and for the post-sign-in redirect.
 */
export default function ActivatePage() {
  const { profile, ready } = useAuth();
  const gate = useActivationGate();
  const router = useRouter();
  const done = ready && Boolean(profile) && !gate.needsActivation;

  useEffect(() => {
    if (done) router.replace("/");
  }, [done, router]);

  if (done || gate.loading) return <PageLoader />;
  return <ActivationFlow />;
}
