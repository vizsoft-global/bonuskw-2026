"use client";

import { useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { ActivationFlow } from "@/components/auth/activation-flow";
import { isStaff, useActivationGate } from "@/lib/auth/activation";
import { useAuth } from "@/lib/auth/auth-provider";
import { collections } from "@/lib/firebase/collections";
import { getDb } from "@/lib/firebase/client";

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
 *
 * It also stamps `verification.activatedAt`, once the enforced steps are done.
 * That has to happen somewhere that survives the moment of completion: the flow
 * itself is unmounted the instant its steps empty (the guard stops rendering
 * the overlay, `/activate` swaps to a loader), so an effect inside it never got
 * to run — which is why no account created since the gate shipped carried the
 * stamp, and the panel showed all of them as still pending.
 */
export function ActivationGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, needsOnboarding, refreshProfile } = useAuth();
  const { needsActivation } = useActivationGate();

  useEffect(() => {
    if (!user || !profile || needsActivation) return;
    if (profile.verification?.activatedAt || profile.verification?.grandfathered) return;
    if (isStaff(profile)) return;
    void updateDoc(doc(getDb(), collections.users, user.uid), {
      "verification.activatedAt": new Date(),
    })
      .then(() => refreshProfile())
      .catch(() => undefined);
  }, [user, profile, needsActivation, refreshProfile]);

  if (!user || !needsActivation || needsOnboarding) return <>{children}</>;

  return (
    <main className="fixed inset-0 z-[80] overflow-y-auto bg-app-top pb-[env(safe-area-inset-bottom)]">
      <ActivationFlow />
    </main>
  );
}
