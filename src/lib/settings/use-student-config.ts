"use client";

import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import type { PurchaseControls } from "@/lib/types/firestore";

/** `adminConfig/studentApp` — written by the admin panel (Settings > Student app). */
export type StudentConfig = {
  minWebBuild?: string;
  termsConditions?: { en?: string; ar?: string; version?: number };
  privacy?: { en?: string; ar?: string; version?: number };
  devicePolicy?: { maxDevices30d?: number; maxCitiesPerDay?: number };
  supportWhatsapp?: string;
  supportEmail?: string;
  maintenance?: { enabled?: boolean; message?: { en?: string; ar?: string } };
  /** Fail-safe purchase switches (Settings > Purchases & dev mode). */
  purchases?: PurchaseControls;
};

export async function fetchStudentConfig(): Promise<StudentConfig> {
  const snap = await getDoc(doc(getDb(), collections.adminConfig, "studentApp"));
  return (snap.data() as StudentConfig | undefined) ?? {};
}

export function useStudentConfig() {
  return useQuery({
    queryKey: ["adminConfig", "studentApp"],
    queryFn: fetchStudentConfig,
    staleTime: 10 * 60 * 1000,
  });
}
