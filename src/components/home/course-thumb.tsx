import { BrandThumb } from "@/components/shared/brand-thumb";
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

export function BatchBadge({ label }: { label: string }) {
  return (
    <span className="absolute bottom-1.5 end-1.5 rounded-[6px] border-[0.5px] border-white bg-[#545454] px-[5px] py-[2px] text-[10px] font-medium text-white">
      {label}
    </span>
  );
}
