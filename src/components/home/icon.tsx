import { cn } from "@/lib/utils";

export function HomeIcon({
  src,
  className,
  alt = "",
}: {
  src: string;
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn("block size-full object-contain", className)} />
  );
}
