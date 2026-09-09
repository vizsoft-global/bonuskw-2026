"use client";

import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "next-themes";
import { useI18n } from "@/lib/i18n/locale";

export { toast };

export function Toaster() {
  const { resolvedTheme } = useTheme();
  const { dir } = useI18n();
  return (
    <Sonner
      theme={resolvedTheme === "light" ? "light" : "dark"}
      dir={dir}
      position="top-center"
      // Keep toasts clear of the status bar when installed to the home screen.
      offset="max(16px, calc(env(safe-area-inset-top, 0px) + 8px))"
      mobileOffset="max(16px, calc(env(safe-area-inset-top, 0px) + 8px))"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border-line !bg-elevated !text-text !shadow-card",
        },
      }}
    />
  );
}
