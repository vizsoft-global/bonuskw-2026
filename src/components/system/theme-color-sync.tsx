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

    const metas = document.querySelectorAll('meta[name="theme-color"]');
    if (metas.length === 0) {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      meta.setAttribute("content", color);
      document.head.appendChild(meta);
      return;
    }
    metas.forEach((meta) => {
      // Drop media-scoped fallbacks so one live colour wins in the installed app.
      meta.removeAttribute("media");
      meta.setAttribute("content", color);
    });
  }, [resolvedTheme, pathname]);

  return null;
}
