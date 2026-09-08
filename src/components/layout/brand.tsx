"use client";

import { useMainSettings } from "@/lib/settings/use-settings";
import { cn } from "@/lib/utils";

/** Four-point star mark used while the uploaded logo loads or is missing. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-8", className)} fill="none">
      <path
        d="M32 4c1.6 14.4 9.6 22.4 24 24-14.4 1.6-22.4 9.6-24 24-1.6-14.4-9.6-22.4-24-24 14.4-1.6 22.4-9.6 24-24Z"
        fill="currentColor"
      />
      <path d="M32 18v28M18 32h28" stroke="var(--bg)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLogo({
  className,
  withText = true,
  size = "md",
}: {
  className?: string;
  withText?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const settings = useMainSettings();
  const logo = settings.data?.logo;
  const dim = size === "lg" ? "size-16" : size === "sm" ? "size-7" : "size-9";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="Bonus Academy" className={cn(dim, "object-contain")} />
      ) : (
        <BrandMark className={cn(dim, "text-text")} />
      )}
      {withText ? (
        <span className="leading-none">
          <span className={cn("block font-serif font-bold tracking-wide", size === "lg" ? "text-2xl" : "text-base")}>
            BONUS
          </span>
          <span className="block text-[9px] uppercase tracking-[0.3em] text-muted">Academy</span>
        </span>
      ) : null}
    </span>
  );
}
