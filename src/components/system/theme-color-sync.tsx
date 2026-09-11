"use client";

import { useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Must match `--app-top` in globals.css. */
export const APP_TOP_DARK = "#050505";
export const APP_TOP_LIGHT = "#f6f6f8";

/**
 * Keeps the browser / PWA status bar the same colour as the screen top.
 * Without this, Android paints `theme-color` (#0B0B0C) while the header is
 * #141414 / #050505, so the bar reads as a separate strip.
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    const color = resolvedTheme === "light" ? APP_TOP_LIGHT : APP_TOP_DARK;
    document.documentElement.style.setProperty("--app-top", color);

    // Keep exactly one unscoped tag: Android reads the first matching
    // `theme-color`, so stray media-scoped copies can win over the live one.
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const [meta, ...extra] = metas;
    extra.forEach((m) => m.remove());
    if (!meta) {
      const created = document.createElement("meta");
      created.setAttribute("name", "theme-color");
      created.setAttribute("content", color);
      document.head.appendChild(created);
      return;
    }
    meta.removeAttribute("media");
    if (meta.getAttribute("content") !== color) meta.setAttribute("content", color);
  }, [resolvedTheme, pathname]);

  return null;
}
