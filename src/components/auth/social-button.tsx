import { cn } from "@/lib/utils";

export function SocialButton({
  icon,
  iconNode,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: string;
  /** Inline icon (e.g. a lucide component) when there is no image asset. */
  iconNode?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex h-[56px] w-full items-center justify-center gap-2.5 overflow-clip rounded-[16px] border-[1.5px] border-white/20 bg-white/[0.03] transition-colors hover:border-white/40 hover:bg-white/[0.06] active:scale-[0.99] disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="relative flex size-5 shrink-0 items-center justify-center overflow-clip">
        {iconNode ? (
          iconNode
        ) : icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" className="size-full" />
        ) : null}
      </span>
      <span className="relative text-[16px] font-medium text-[#fafafa]">{children}</span>
    </button>
  );
}
