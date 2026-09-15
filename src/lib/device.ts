"use client";

const KEY = "ba_device_id";

/**
 * Local guess at this device's id. The server owns the durable copy in the
 * HttpOnly `ba_device` cookie and echoes the resolved id back from
 * `/api/session/start`; `setDeviceId` keeps this copy in step with it.
 */
export function getDeviceId() {
  const existing = window.localStorage.getItem(KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(KEY, id);
  return id;
}

export function setDeviceId(id: string) {
  if (!id) return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* private mode */
  }
}

export function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /Mac/.test(ua)
    ? "macOS"
    : /Windows/.test(ua)
      ? "Windows"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : "Web";
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /Chrome/.test(ua)
      ? "Chrome"
      : /Safari/.test(ua)
        ? "Safari"
        : /Firefox/.test(ua)
          ? "Firefox"
          : "Browser";
  return { os, browser, model: `${browser} on ${os}` };
}
