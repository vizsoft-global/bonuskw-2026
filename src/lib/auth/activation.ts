"use client";

import type { User } from "firebase/auth";
import { useAuth } from "@/lib/auth/auth-provider";
import { useStudentConfig } from "@/lib/settings/use-student-config";
import type { UserDoc } from "@/lib/types/firestore";

export type ActivationStep = "names" | "email" | "phone";

/**
 * The steps the flow enforces today.
 *
 * Phone is deliberately *not* enforced. Kuwaiti carriers block enough
 * verification SMS that holding a student on the phone step kept real people
 * out of the app, which is the complaint the flow was generating. The number is
 * asked for at the point of purchase instead, where the checkout can refuse the
 * sale without locking anyone out of browsing.
 *
 * `/activate` still renders PhoneStep and `outstanding` still reports it, so
 * re-enforcing it here is a one-word change.
 */
const ENFORCED: ActivationStep[] = ["names", "email"];

/** Staff are outside activation entirely. */
export function isStaff(profile: UserDoc | null) {
  const role = String(profile?.userRole ?? "").trim();
  return Boolean(role) && role !== "Student";
}

/** A tester is only special while dev mode is on, same rule as purchases. */
export function isDevTester(profile: UserDoc | null, devMode: boolean) {
  return devMode && profile?.devTester === true;
}

/**
 * Everything the account is still missing, whether or not it is enforced yet.
 * The Firebase user is the authority on the identifiers — the profile's
 * `emailVerifed` / `phoneVerified` booleans are legacy and not read.
 */
function outstanding(user: User | null, profile: UserDoc | null): ActivationStep[] {
  const steps: ActivationStep[] = [];
  if (!profile?.firstName?.trim() || !profile?.lastName?.trim() || !profile?.dob) {
    steps.push("names");
  }
  if (!user?.emailVerified) steps.push("email");
  if (!user?.phoneNumber) steps.push("phone");
  return steps;
}

/** The steps `/activate` will actually ask for. */
export function missingSteps(user: User | null, profile: UserDoc | null): ActivationStep[] {
  return outstanding(user, profile).filter((step) => ENFORCED.includes(step));
}

/**
 * Whether this account has to go through `/activate` before using the app.
 *
 * True only for a signed-in student whose profile has neither been activated nor
 * been grandfathered, and who is missing an enforced step. Accounts created
 * before the flow shipped are stamped by
 * `bonuskw-admin/scripts/backfill-account-verification.mjs`.
 */
export function needsActivation(
  user: User | null,
  profile: UserDoc | null,
  opts: { devMode?: boolean } = {},
) {
  if (!user || !profile) return false;
  if (isStaff(profile) || isDevTester(profile, opts.devMode === true)) return false;
  if (profile.verification?.activatedAt || profile.verification?.grandfathered) return false;
  return missingSteps(user, profile).length > 0;
}

/**
 * The gate, for screens that need it (`RequireAuth`, the activation page). Kept
 * out of `AuthProvider` so the provider never has to know about dev mode.
 */
export function useActivationGate() {
  const { user, profile } = useAuth();
  const config = useStudentConfig();
  const devMode = config.data?.purchases?.devMode === true;
  return {
    needsActivation: needsActivation(user, profile, { devMode }),
    steps: missingSteps(user, profile),
    /**
     * Until the config query answers, dev mode is unknown, so a tester would be
     * held for a moment. Showing the skeleton beats redirecting them onward.
     */
    loading: config.isLoading,
  };
}
