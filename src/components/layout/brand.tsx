import { cn } from "@/lib/utils";

const LOCKUP = "/brand/logo-lockup.png";
const STACKED = "/brand/logo-stacked.png";

/** Official Bonus Academy mark. White artwork is masked so it follows light/dark text color. */
function LogoArt({
  src,
  label,
  className,
}: {
  src: string;
  label: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-block bg-text", className)}
      style={{
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

export function BrandMark({ className }: { className?: string }) {
  return <LogoArt src={LOCKUP} label="Bonus Academy" className={cn("h-8 w-[6.2rem]", className)} />;
}

export function BrandLogo({
  className,
  withText = true,
  size = "md",
}: {
  className?: string;
  withText?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  if (!withText) {
    return <BrandMark className={className} />;
  }
  const dim =
    size === "lg"
      ? "h-48 w-[8.6rem]"
      : size === "sm"
        ? "h-7 w-[5.4rem]"
        : "h-9 w-[7rem]";
  const src = size === "lg" ? STACKED : LOCKUP;
  return <LogoArt src={src} label="Bonus Academy" className={cn(dim, className)} />;
}
