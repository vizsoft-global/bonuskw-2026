import { brandThumbStyle } from "@/lib/brand-thumb";
import { cn } from "@/lib/utils";

/**
 * Brand-coloured placeholder artwork. Fills its (relative) parent; pass the
 * course id for courses and the chapter id for chapters and their lessons so
 * related items share a colour.
 */
export function BrandThumb({
  seed,
  className,
  markClassName,
}: {
  seed?: string | null;
  className?: string;
  /** Size of the mark; defaults to ~36% of the height. */
  markClassName?: string;
}) {
  return (
    <span
      className={cn("on-media absolute inset-0 grid place-items-center overflow-hidden", className)}
      style={brandThumbStyle(seed)}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/onboarding/logo.svg"
        alt=""
        className={cn("h-[44%] max-h-20 min-h-5 w-auto object-contain opacity-90", markClassName)}
        draggable={false}
      />
    </span>
  );
}
