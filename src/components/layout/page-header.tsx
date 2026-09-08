"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  back = true,
  backHref,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: boolean;
  backHref?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <div className={cn("mb-5 flex items-center gap-3", className)}>
      {back ? (
        <button
          type="button"
          aria-label="Back"
          onClick={() => (backHref ? router.push(backHref) : router.back())}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-text hover:bg-line-strong/40"
        >
          <ArrowLeft className="size-5 rtl:-scale-x-100" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-semibold md:text-2xl">{title}</h1>
        {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {action}
    </div>
  );
}
