import { BrandThumb } from "@/components/shared/brand-thumb";
import { BATCH_TONE_CLASS, type BatchTone } from "@/lib/course/batch-status";
import { imageFor, type ImageUse } from "@/lib/media/image-url";
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
  aspect = "4/3",
  use = "courseCard",
  priority,
  children,
}: {
  image?: string;
  /** Course id: picks the colour of the default artwork. */
  seed?: string | null;
  className?: string;
  aspect?: "5/3" | "4/3" | "3/4";
  /** Which Cloudflare size to request. */
  use?: ImageUse;
  priority?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[8px] border-[0.5px] border-line bg-surface",
        aspect === "3/4" ? "aspect-[3/4]" : aspect === "5/3" ? "aspect-[5/3]" : "aspect-[4/3]",
        className,
      )}
    >
      {hasThumb(image) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageFor(use, image)}
          alt=""
          width={aspect === "3/4" ? 480 : 640}
          height={aspect === "3/4" ? 640 : aspect === "5/3" ? 384 : 480}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
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
        "inline-flex items-center gap-1 rounded-[6px] border-[0.5px] px-[5px] py-[2px] text-[10px] font-medium",
        tone ? BATCH_TONE_CLASS[tone] : "border-white bg-[#545454] text-white",
      )}
    >
      {tone ? <span aria-hidden className="size-1.5 rounded-full bg-white/90" /> : null}
      {label}
    </span>
  );
}
