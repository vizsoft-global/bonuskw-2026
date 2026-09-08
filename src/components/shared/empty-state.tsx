"use client";

import Link from "next/link";
import { HomeIcon } from "@/components/home/icon";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  body,
  cta,
  compact,
  className,
}: {
  icon: string;
  title: string;
  body: string;
  cta?: { href: string; label: string } | { onClick: () => void; label: string };
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "gap-2.5 py-6" : "gap-3 py-10",
        className,
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-[#141414]",
          compact ? "size-10" : "size-14",
        )}
      >
        <span className={cn(compact ? "size-4" : "size-5")}>
          <HomeIcon src={icon} />
        </span>
      </span>
      <div className="flex max-w-[280px] flex-col gap-1">
        <p className={cn("font-semibold text-[#fafafa]", compact ? "text-[13px]" : "text-[14px]")}>{title}</p>
        <p className={cn("text-[#999]", compact ? "text-[11px]" : "text-[12px]")}>{body}</p>
      </div>
      {cta ? (
        "href" in cta ? (
          <Link
            href={cta.href}
            className="mt-1 flex h-8 items-center rounded-full bg-[#0c5eff] px-4 text-[12px] font-medium leading-none text-white"
          >
            {cta.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            className="mt-1 flex h-8 items-center rounded-full bg-[#0c5eff] px-4 text-[12px] font-medium leading-none text-white"
          >
            {cta.label}
          </button>
        )
      ) : null}
    </div>
  );
}
