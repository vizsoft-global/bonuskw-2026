"use client";

import { Loader } from "@/components/shared/loader";
import { cn } from "@/lib/utils";

export function CtaButton({
  children,
  className,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex h-[57px] w-full items-center justify-center overflow-clip rounded-[16px] disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-[#f7f7f7] to-[#ededed]"
      />
      <span className="relative text-[16px] font-semibold text-[#141414]">
        {loading ? <Loader size="inline" /> : children}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[16px] shadow-[inset_0px_2px_1.5px_0px_white,inset_0px_-2px_1.5px_0px_rgba(0,0,0,0.25)]"
      />
    </button>
  );
}
