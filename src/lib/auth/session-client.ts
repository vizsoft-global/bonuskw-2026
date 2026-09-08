"use client";

import { getDeviceId, deviceLabel } from "@/lib/device";

const SESSION_KEY = "ba_session_id";

export function getStoredSessionId() {
  return window.localStorage.getItem(SESSION_KEY);
}

export function setStoredSessionId(id: string | null) {
  if (!id) window.localStorage.removeItem(SESSION_KEY);
  else window.localStorage.setItem(SESSION_KEY, id);
}

export async function startSession(idToken: string) {
  const device = deviceLabel();
  const res = await fetch("/api/session/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      ...device,
      userAgent: navigator.userAgent,
    }),
  });
  const json = (await res.json()) as { sessionId?: string; error?: string };
  if (!res.ok || !json.sessionId) throw new Error(json.error || "Session failed");
  setStoredSessionId(json.sessionId);
  return json.sessionId;
}

export async function heartbeat(idToken: string, sessionId: string) {
  await fetch("/api/session/heartbeat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ sessionId }),
  });
}
