"use client";

import { Lottie } from "lottie-react";
import { cn } from "@/lib/utils";

const SRC = "/lottie/bonus-logo.json";

export function Loader({
  size = "page",
  className,
}: {
  size?: "splash" | "page" | "inline";
  className?: string;
}) {
  const box =
    size === "splash"
      ? "size-[168px] max-h-[168px] max-w-[168px]"
      : size === "inline"
        ? "size-10 max-h-10 max-w-10"
        : "size-16 max-h-16 max-w-16";
  return (
    <div role="status" aria-label="Loading" className={cn("grid place-items-center", className)}>
      <Lottie src={SRC} autoplay loop className={box} />
    </div>
  );
}

export function PageLoader({ full }: { full?: boolean }) {
  return (
    <div className={cn("grid place-items-center", full ? "fixed inset-0 z-[80] min-h-dvh bg-app-top" : "min-h-[40vh]")}>
      <Loader size={full ? "splash" : "page"} />
    </div>
  );
}
