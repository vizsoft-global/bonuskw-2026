"use client";

import { getDeviceId, deviceLabel } from "@/lib/device";

const SESSION_KEY = "ba_session_id";

export type OtherSession = {
  id: string;
  label: string;
  os: string;
  browser: string;
  location: string;
  lastSeenAt: string | null;
  live: boolean;
};

export type StartSessionOutcome =
  | { status: "started"; sessionId: string }
  | { status: "conflict"; sessions: OtherSession[] };

export function getStoredSessionId() {
  return window.localStorage.getItem(SESSION_KEY);
}

export function setStoredSessionId(id: string | null) {
  if (!id) window.localStorage.removeItem(SESSION_KEY);
  else window.localStorage.setItem(SESSION_KEY, id);
}

/**
 * Voluntary sign-out: mark this device's `sessions` row ended so the admin
 * Activity feed shows a logout time. Best-effort; never blocks sign-out.
 */
export async function endCurrentSession(idToken: string | null) {
  const sessionId = getStoredSessionId();
  if (!sessionId || !idToken) return;
  try {
    await fetch("/api/session/kick", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ sessionId }),
      keepalive: true,
    });
  } catch {
    /* offline or already ended */
  }
}

export async function startSession(idToken: string, opts: { force?: boolean } = {}): Promise<StartSessionOutcome> {
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
      force: Boolean(opts.force),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    sessionId?: string;
    conflict?: OtherSession[];
    error?: string;
  };
  if (res.status === 409 && Array.isArray(json.conflict)) {
    return { status: "conflict", sessions: json.conflict };
  }
  if (!res.ok || !json.sessionId) throw new Error(json.error || "Session failed");
  setStoredSessionId(json.sessionId);
  return { status: "started", sessionId: json.sessionId };
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
