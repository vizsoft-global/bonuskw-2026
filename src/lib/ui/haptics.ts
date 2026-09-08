type HapticKind = "light" | "medium" | "success";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 16,
  success: [10, 24, 14],
};

export function haptic(kind: HapticKind = "light") {
  if (typeof window === "undefined") return;
  try {
    if (!navigator.vibrate) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* unsupported */
  }
}
