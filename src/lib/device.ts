"use client";

const KEY = "ba_device_id";

export function getDeviceId() {
  const existing = window.localStorage.getItem(KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(KEY, id);
  document.cookie = `ba_device=${id};path=/;max-age=31536000;samesite=lax`;
  return id;
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
