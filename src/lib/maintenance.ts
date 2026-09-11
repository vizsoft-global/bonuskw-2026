export const MAINT_COOKIE = "ba_maint_ok";

export type MaintenanceWindow = {
  enabled?: boolean;
  until?: number;
};

export function writeMaintenanceCookie(until?: number | null) {
  if (typeof document === "undefined") return;
  const value = String(until && until > 0 ? until : 1);
  const maxAge = until && until > Date.now() ? Math.ceil((until - Date.now()) / 1000) + 300 : 86_400;
  document.cookie = `${MAINT_COOKIE}=${value};path=/;max-age=${maxAge};samesite=lax`;
}

export function readMaintenanceCookie() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )ba_maint_ok=([^;]+)/);
  return match?.[1] ?? "";
}

export function hasMaintenanceBypass(until?: number | null) {
  const cookie = readMaintenanceCookie();
  if (!cookie) return false;
  if (!until) return true;
  return cookie === String(until);
}

export function formatRemain(until: number, now = Date.now()) {
  const ms = Math.max(0, until - now);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
