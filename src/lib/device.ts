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
  // Order matters: every iPhone/iPad UA contains "like Mac OS X", so testing
  // for Mac first labelled every phone as macOS — which hid the iPhone cohort
  // that reports the playback problems. iPadOS 13+ additionally reports itself
  // as "Macintosh" and is only distinguishable by its touch points.
  const ipadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua) || ipadOs
      ? "iOS"
      : /Mac/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : "Web";
  // iOS browsers are all WebKit with their own token; Chrome's "Chrome/" is
  // never present there. Checking Chrome first mislabels CriOS as Safari.
  const browser = /EdgiOS|EdgA?\//.test(ua)
    ? "Edge"
    : /CriOS/.test(ua)
      ? "Chrome"
      : /FxiOS/.test(ua)
        ? "Firefox"
        : /Chrome/.test(ua)
          ? "Chrome"
          : /Safari/.test(ua)
            ? "Safari"
            : /Firefox/.test(ua)
              ? "Firefox"
              : "Browser";
  return { os, browser, model: `${browser} on ${os}` };
}
