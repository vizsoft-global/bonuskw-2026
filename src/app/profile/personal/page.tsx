"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";

export default function PersonalPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState(profile?.display_name || "");

  async function save() {
    if (!user) return;
    await updateDoc(doc(getDb(), collections.users, user.uid), { display_name: name });
    await refreshProfile();
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">{t("personal")}</h1>
      <input value={name} onChange={(e) => setName(e.target.value)} className="w-full max-w-md rounded-2xl border border-line bg-transparent px-3 py-3" />
      <p className="mt-2 text-sm text-muted">{profile?.phone_number}</p>
      <button type="button" onClick={() => void save()} className="mt-4 rounded-full bg-primary px-4 py-2 text-sm text-white">
        {t("finish")}
      </button>
    </AppShell>
  );
}
