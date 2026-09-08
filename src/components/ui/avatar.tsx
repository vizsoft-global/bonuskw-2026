import { cn } from "@/lib/utils";

export function Avatar({
  src,
  name,
  className,
  size = "md",
}: {
  src?: string | null;
  name?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const dim =
    size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-16 text-xl" : size === "xl" ? "size-24 text-3xl" : "size-10 text-sm";
  const initial = (name || "").trim().charAt(0).toUpperCase() || "B";
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 font-semibold text-muted ring-1 ring-line",
        dim,
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initial
      )}
    </span>
  );
}
