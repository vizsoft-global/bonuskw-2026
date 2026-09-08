import { cn } from "@/lib/utils";

/** Segmented bar like the Figma "65% Completed" strip. */
export function Progress({
  value,
  segments = 6,
  className,
  tone = "primary",
}: {
  value: number;
  segments?: number;
  className?: string;
  tone?: "primary" | "accent" | "success";
}) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const filled = Math.round((pct / 100) * segments);
  const color =
    tone === "accent" ? "bg-accent" : tone === "success" ? "bg-success" : "bg-primary";
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("flex gap-1", className)}
    >
      {Array.from({ length: segments }).map((_, i) => (
        <span
          key={i}
          className={cn("h-1.5 flex-1 rounded-full", i < filled ? color : "bg-line-strong/60")}
        />
      ))}
    </div>
  );
}

export function LinearProgress({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line-strong/60", className)}>
      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
