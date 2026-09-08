import { cn } from "@/lib/utils";

export function SocialButton({
  icon,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: string }) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex h-[57px] w-full items-center justify-center gap-2.5 overflow-clip rounded-[16px] border-[1.5px] border-white/20 bg-transparent disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="relative size-5 shrink-0 overflow-clip">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" className="size-full" />
      </span>
      <span className="relative text-[16px] font-medium text-[#fafafa]">{children}</span>
    </button>
  );
}
