import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizePhone(raw: string, countryCode = "965") {
  const digits = digitsOnly(raw);
  if (!digits) return "";
  if (digits.startsWith(countryCode) && digits.length > 8) return `+${digits}`;
  if (raw.trim().startsWith("+")) return `+${digits}`;
  return `+${countryCode}${digits.replace(/^0+/, "")}`;
}

export function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
