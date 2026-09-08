"use client";

import { useQuery } from "@tanstack/react-query";
import { getToken, getMessaging, isSupported } from "firebase/messaging";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth/auth-provider";
import { getDb, getFirebaseApp } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { useI18n } from "@/lib/i18n/locale";

export default function NotificationsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const notes = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const snap = await getDocs(query(collection(getDb(), collections.announcement), limit(20)));
      return snap.docs;
    },
  });

  async function enablePush() {
    if (!user || !(await isSupported())) return;
    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
    if (!token) return;
    const idToken = await user.getIdToken();
    await fetch("https://bonus-academy.cloudfunctions.net/addFcmToken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { userDocPath: `users/${user.uid}`, fcmToken: token, deviceType: "web" } }),
    });
    void idToken;
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">{t("notifications")}</h1>
      <button type="button" onClick={() => void enablePush()} className="mb-4 text-sm text-primary">Enable</button>
      {(notes.data ?? []).map((note) => (
        <p key={note.id} className="mb-2 text-sm">{note.get("title") || note.get("bio")}</p>
      ))}
    </AppShell>
  );
}
