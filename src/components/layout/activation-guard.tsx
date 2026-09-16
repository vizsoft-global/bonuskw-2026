"use client";

import { ActivationFlow } from "@/components/auth/activation-flow";
import { useActivationGate } from "@/lib/auth/activation";
import { useAuth } from "@/lib/auth/auth-provider";

/**
 * Holds a signed-in student on the activation flow until it is finished.
 *
 * Lives in the root layout, inside the providers, because no page in this app
 * opts into a shared auth wrapper — a guard per page would be easy to miss, and
 * that is exactly how a required step goes unenforced. Guests and staff are
 * untouched: with nobody signed in, or with `needsActivation` false, children
 * render as normal.
 *
 * The academic step (onboarding) still comes first, so it is left to its own
 * redirect rather than being intercepted here.
 */
export function ActivationGuard({ children }: { children: React.ReactNode }) {
  const { user, needsOnboarding } = useAuth();
  const { needsActivation } = useActivationGate();

  if (!user || !needsActivation || needsOnboarding) return <>{children}</>;

  return (
    <main className="fixed inset-0 z-[80] overflow-y-auto bg-app-top pb-[env(safe-area-inset-bottom)]">
      <ActivationFlow />
    </main>
  );
}
