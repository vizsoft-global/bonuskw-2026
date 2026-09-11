"use client";

import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";
import { useStudentConfig } from "@/lib/settings/use-student-config";
import type { PurchaseControls } from "@/lib/types/firestore";

export type PurchaseKind = "course" | "chapter" | "ebook" | "installment";
export type PurchaseBlock = "all" | "courses" | "ebooks";

export function purchaseKindFor(course?: { itemType?: string }): PurchaseKind {
  return course?.itemType === "ebook" ? "ebook" : "course";
}

/** Mirrors the server rule in the admin app's purchase-controls. */
export function purchaseBlockFor(
  controls: PurchaseControls | undefined,
  kind: PurchaseKind,
): PurchaseBlock | null {
  if (!controls) return null;
  if (controls.catalogMode) return "all";
  if (kind === "ebook") return controls.ebooksOff ? "ebooks" : null;
  return controls.coursesOff ? "courses" : null;
}

/**
 * Client view of the fail-safe purchase switches. The checkout API enforces
 * the same rules; this only decides what to show. Dev-mode testers are never
 * blocked — their orders run through the test gateway instead.
 */
export function usePurchaseGate() {
  const config = useStudentConfig();
  const { profile } = useAuth();
  const { t } = useI18n();
  const controls = config.data?.purchases;
  const devMode = controls?.devMode === true;
  const tester = devMode && profile?.devTester === true;

  function blockFor(kind: PurchaseKind): string | undefined {
    if (tester) return undefined;
    const block = purchaseBlockFor(controls, kind);
    if (!block) return undefined;
    return t(block === "all" ? "purchasesPaused" : block === "courses" ? "coursesPaused" : "ebooksPaused");
  }

  return { blockFor, tester, devMode, controls, loading: config.isLoading };
}
