"use client";

import Link from "next/link";
import { Bookmark, Lock, LockOpen, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatKwdLocale, type Locale } from "@/lib/i18n/content";

export function PriceTag({
  amount,
  locale,
  className,
}: {
  amount?: number | null;
  locale: Locale;
  className?: string;
}) {
  return <span className={cn("font-semibold", className)}>{formatKwdLocale(amount, locale)}</span>;
}

export function RatingStars({ value }: { value?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted">
      <Star className="size-3.5 fill-accent text-accent" />
      {(value || 0).toFixed(1)}
    </span>
  );
}

export function LockBadge({ locked }: { locked: boolean }) {
  return locked ? (
    <Lock className="size-4 text-muted" />
  ) : (
    <LockOpen className="size-4 text-success" />
  );
}

export function StatChip({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="glass min-w-0 flex-1 rounded-2xl px-3 py-2">
      <p className="truncate text-[11px] text-muted">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

export function CourseCard({
  href,
  title,
  image,
  meta,
  price,
  badge,
  action,
  saved,
  onSave,
  layout = "grid",
}: {
  href: string;
  title: string;
  image?: string;
  meta?: string;
  price?: string;
  badge?: string;
  action?: React.ReactNode;
  saved?: boolean;
  onSave?: () => void;
  layout?: "grid" | "list";
}) {
  return (
    <article
      className={cn(
        "glass overflow-hidden rounded-3xl",
        layout === "list" ? "grid grid-cols-[112px_1fr] md:grid-cols-[180px_1fr]" : "flex flex-col",
      )}
    >
      <Link href={href} className="relative block aspect-[5/3] bg-black/20">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-[#1a1c3a] to-[#ff4a1c]/40 text-sm">
            Bonus
          </div>
        )}
        {badge ? (
          <span className="absolute bottom-2 start-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px]">
            {badge}
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="line-clamp-2 font-medium">
            {title}
          </Link>
          {onSave ? (
            <button type="button" onClick={onSave} aria-label="Save">
              <Bookmark className={cn("size-4", saved && "fill-accent text-accent")} />
            </button>
          ) : null}
        </div>
        {meta ? <p className="text-xs text-muted">{meta}</p> : null}
        <div className="mt-auto flex items-center justify-between gap-2">
          {price ? <span className="text-sm font-semibold">{price}</span> : <span />}
          {action}
        </div>
      </div>
    </article>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm text-primary">
      {children}
    </Link>
  );
}
