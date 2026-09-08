"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDocs, query, where } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";

export default function DevicesPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const devices = useQuery({
    queryKey: ["devices", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(getDb(), collections.userdeviceinfo), where("device_user_ref", "==", doc(getDb(), collections.users, user!.uid))),
      );
      return snap.docs;
    },
  });
  const sessions = useQuery({
    queryKey: ["sessions", user?.uid],
    enabled: Boolean(user),
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(getDb(), collections.sessions), where("userref", "==", doc(getDb(), collections.users, user!.uid))),
      );
      return snap.docs;
    },
  });

  async function kick(sessionId: string) {
    if (!user) return;
    const token = await user.getIdToken();
    await fetch("/api/session/kick", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">{t("deviceLogs")}</h1>
      {(sessions.data ?? []).map((session) => (
        <div key={session.id} className="mb-2 flex items-center justify-between rounded-2xl border border-line px-3 py-2 text-sm">
          <span>{session.get("device") || "Web"} · {session.get("isActive") ? "active" : "off"}</span>
          {session.get("isActive") ? (
            <button type="button" onClick={() => void kick(session.id)}>Sign out</button>
          ) : null}
        </div>
      ))}
      <p className="mt-4 text-xs text-muted">{devices.data?.length || 0} logged devices</p>
    </AppShell>
  );
}
