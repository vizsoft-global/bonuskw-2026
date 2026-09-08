import { cn } from "@/lib/utils";

const sizes = {
  splash: { wrap: "flex-col gap-2.5", mark: "size-[112px]", word: "text-[24px]", sub: "text-[12px]" },
  card: { wrap: "gap-2", mark: "size-[48px]", word: "text-[19px]", sub: "text-[10px]" },
  nav: { wrap: "gap-1.5", mark: "size-[36px]", word: "text-[15px]", sub: "text-[8px]" },
} as const;

export function BrandLogo({
  size = "card",
  className,
}: {
  size?: keyof typeof sizes;
  className?: string;
}) {
  const s = sizes[size];
  const splash = size === "splash";
  return (
    <div className={cn("flex items-center", s.wrap, className)}>
      <span className={cn("relative shrink-0 overflow-clip", s.mark)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/onboarding/logo.svg" alt="" className="size-full" />
      </span>
      <span
        className={cn(
          "uppercase leading-none text-white",
          splash ? "text-center" : "text-start",
        )}
      >
        <span className={cn("block font-serif font-medium tracking-wide", s.word)}>
          BONUS
        </span>
        <span className={cn("block font-normal text-white/50", s.sub)}>
          Academy
        </span>
      </span>
    </div>
  );
}
