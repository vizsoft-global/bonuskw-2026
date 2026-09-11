"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Avatar({
  src,
  name,
  className,
}: {
  src?: string;
  name?: string;
  className?: string;
}) {
  // Falls back to the initial if the photo (or generated avatar) fails to load.
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = Boolean(src) && failed !== src;
  return (
    <span
      className={cn(
        "grid size-[41px] shrink-0 place-items-center overflow-hidden rounded-full border-[0.5px] border-white/10 text-sm font-semibold text-white",
        showImage
          ? "bg-white/[0.08]"
          : "bg-[linear-gradient(145deg,rgba(255,138,76,0.72)_0%,rgba(246,54,11,0.28)_48%,rgba(12,94,255,0.58)_100%)]",
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(src ?? null)} />
      ) : (
        (name || "B").slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
