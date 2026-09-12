import { BrandThumb } from "@/components/shared/brand-thumb";
import { BATCH_TONE_CLASS, type BatchTone } from "@/lib/course/batch-status";
import { cn } from "@/lib/utils";

export function hasThumb(src?: string | null) {
  return Boolean(src?.trim());
}

/** Brand-coloured default artwork; pass the course id so each course keeps its colour. */
export function ThumbPlaceholder({ className, seed }: { className?: string; seed?: string | null }) {
  return <BrandThumb seed={seed} className={className} />;
}

export function CourseThumb({
  image,
  seed,
  className,
  aspect = "5/3",
  children,
}: {
  image?: string;
  /** Course id: picks the colour of the default artwork. */
  seed?: string | null;
  className?: string;
  aspect?: "5/3" | "3/4";
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[8px] border-[0.5px] border-white/10 bg-[#1d1d1d]",
        aspect === "3/4" ? "aspect-[3/4]" : "aspect-[5/3]",
        className,
      )}
    >
      {hasThumb(image) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <ThumbPlaceholder seed={seed} />
      )}
      {children}
    </div>
  );
}

/**
 * Batch chip on a thumbnail. Green = open for enrolment, amber = starts later,
 * red = closed. No tone (unknown) keeps the neutral grey.
 */
export function BatchBadge({ label, tone }: { label: string; tone?: BatchTone }) {
  return (
    <span
      className={cn(
        "absolute bottom-1.5 end-1.5 inline-flex items-center gap-1 rounded-[6px] border-[0.5px] px-[5px] py-[2px] text-[10px] font-medium",
        tone ? BATCH_TONE_CLASS[tone] : "border-white bg-[#545454] text-white",
      )}
    >
      {tone ? <span aria-hidden className="size-1.5 rounded-full bg-white/90" /> : null}
      {label}
    </span>
  );
}
