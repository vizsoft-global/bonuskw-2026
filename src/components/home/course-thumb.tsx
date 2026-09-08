import { cn } from "@/lib/utils";

export function hasThumb(src?: string | null) {
  return Boolean(src?.trim());
}

export function ThumbPlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0", className)} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/instructor/banner.png"
        alt=""
        className="absolute inset-0 size-full object-cover object-[center_32%]"
      />
      <div className="absolute inset-0 bg-black/25" />
      <div className="absolute inset-0 grid place-items-center p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/onboarding/logo.svg" alt="" className="size-[30%] max-h-12 min-h-6 object-contain" />
      </div>
    </div>
  );
}

export function CourseThumb({
  image,
  className,
  aspect = "5/3",
  children,
}: {
  image?: string;
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
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <ThumbPlaceholder />
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
