"use client";

import Link from "next/link";
import { Bookmark, Clock, Lock, LockOpen, PlaySquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatKwdLocale, type Locale } from "@/lib/i18n/content";

export function PriceTag({
  amount,
  locale,
  className,
  compareAt,
}: {
  amount?: number | null;
  locale: Locale;
  className?: string;
  compareAt?: number | null;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 font-semibold", className)}>
      {formatKwdLocale(amount, locale)}
      {compareAt && compareAt > (amount ?? 0) ? (
        <span className="text-xs font-normal text-faint line-through">
          {formatKwdLocale(compareAt, locale)}
        </span>
      ) : null}
    </span>
  );
}

export function LockBadge({ locked, className }: { locked: boolean; className?: string }) {
  return locked ? (
    <Lock className={cn("size-4 text-muted", className)} aria-label="Locked" />
  ) : (
    <LockOpen className={cn("size-4 text-success", className)} aria-label="Unlocked" />
  );
}

export function StatChip({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 flex-1 px-3 py-2 text-center first:ps-1 last:pe-1", className)}>
      <p className="truncate text-[11px] text-muted">{label}</p>
      <p className="mt-0.5 inline-flex items-center gap-1 truncate text-sm font-semibold">
        {icon}
        {value}
      </p>
    </div>
  );
}

export function StatStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("glass flex divide-x divide-line rounded-2xl rtl:divide-x-reverse", className)}>
      {children}
    </div>
  );
}

export function CourseThumb({
  image,
  title,
  className,
  badge,
  children,
}: {
  image?: string;
  title?: string;
  className?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-black/20", className)}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="course-fallback grid h-full w-full place-items-center p-3 text-center text-sm font-medium text-white/90">
          <span className="line-clamp-2">{title || "Bonus Academy"}</span>
        </div>
      )}
      {badge ? <div className="absolute bottom-2 end-2 flex gap-1">{badge}</div> : null}
      {children}
    </div>
  );
}

export type CourseCardProps = {
  href: string;
  title: string;
  image?: string;
  instructor?: string;
  lessons?: number;
  hours?: number | string;
  price?: string;
  compareAt?: string;
  batch?: string;
  badge?: string;
  action?: React.ReactNode;
  saved?: boolean;
  onSave?: () => void;
  layout?: "grid" | "list";
  className?: string;
  footer?: React.ReactNode;
};

export function CourseCard({
  href,
  title,
  image,
  instructor,
  lessons,
  hours,
  price,
  compareAt,
  batch,
  badge,
  action,
  saved,
  onSave,
  layout = "grid",
  className,
  footer,
}: CourseCardProps) {
  const list = layout === "list";
  return (
    <article
      className={cn(
        "card group overflow-hidden transition-shadow hover:shadow-card",
        list ? "grid grid-cols-[124px_1fr] sm:grid-cols-[180px_1fr]" : "flex flex-col",
        className,
      )}
    >
      <Link href={href} className={cn("block", list ? "h-full min-h-28" : "")}>
        <CourseThumb
          image={image}
          title={title}
          className={cn(list ? "h-full" : "aspect-[5/3]")}
          badge={
            batch ? (
              <Badge tone="overlay">{batch}</Badge>
            ) : badge ? (
              <Badge tone="overlay">{badge}</Badge>
            ) : null
          }
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="line-clamp-2 text-sm font-semibold leading-snug hover:underline md:text-[15px]">
            {title}
          </Link>
          {onSave ? (
            <button
              type="button"
              onClick={onSave}
              aria-pressed={saved}
              aria-label={saved ? "Remove bookmark" : "Bookmark"}
              className="-me-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2"
            >
              <Bookmark className={cn("size-4", saved && "fill-accent text-accent")} />
            </button>
          ) : null}
        </div>
        {instructor ? (
          <p className="flex min-w-0 items-center gap-2 text-xs text-muted">
            <span className="truncate">{instructor}</span>
          </p>
        ) : null}
        {lessons != null || hours != null ? (
          <p className="flex items-center gap-3 text-xs text-muted">
            {lessons != null ? (
              <span className="inline-flex items-center gap-1">
                <PlaySquare className="size-3.5" /> {lessons}
              </span>
            ) : null}
            {hours != null ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" /> {hours}
              </span>
            ) : null}
          </p>
        ) : null}
        {footer}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {price ? (
            <span className="inline-flex items-baseline gap-1.5 text-sm font-semibold">
              {price}
              {compareAt ? <span className="text-xs font-normal text-faint line-through">{compareAt}</span> : null}
            </span>
          ) : (
            <span />
          )}
          {action}
        </div>
      </div>
    </article>
  );
}

/** Kept for existing call sites; prefer `Button` from `@/components/ui`. */
export function PrimaryButton({ size = "sm", ...props }: ButtonProps) {
  return <Button size={size} {...props} />;
}

export function GhostLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("text-sm font-medium text-primary hover:underline", className)}>
      {children}
    </Link>
  );
}
