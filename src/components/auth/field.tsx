import { cn } from "@/lib/utils";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  phone,
  type = "text",
  autoComplete,
  trailing,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  phone?: boolean;
  type?: string;
  autoComplete?: string;
  /** Small control shown at the end of the value row (e.g. show password). */
  trailing?: React.ReactNode;
  /** Enter key. */
  onSubmit?: () => void;
}) {
  return (
    <label className="flex w-full items-center overflow-clip rounded-[16px] border-[1.5px] border-white/20 px-[15px] py-3.5 focus-within:border-white/50">
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className={cn("text-[13px] text-white/60", phone && "text-center")}>{label}</span>
        {/* Prefix and digits share one line box so they sit on the same centre line.
            Phone: the whole "+965 …" group is centred in the field. */}
        <span
          className={cn("flex h-8 items-center gap-1.5", phone && "justify-center")}
          dir={phone || type === "email" ? "ltr" : undefined}
        >
          {phone ? (
            <span className="text-[24px] font-medium leading-none text-white">+965</span>
          ) : null}
          <input
            value={value}
            onChange={(e) => onChange(phone ? e.target.value.replace(/\D/g, "") : e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onSubmit) onSubmit();
            }}
            placeholder={placeholder}
            type={phone ? "tel" : type}
            dir={phone || type === "email" ? "ltr" : undefined}
            inputMode={phone ? "numeric" : type === "email" ? "email" : undefined}
            pattern={phone ? "[0-9]*" : undefined}
            maxLength={phone ? 8 : undefined}
            autoComplete={autoComplete}
            className={cn(
              "h-8 min-w-0 bg-transparent p-0 font-medium leading-none text-white outline-none placeholder:text-white/30",
              // Fixed width for 8 digits so the group stays centred while typing.
              phone ? "w-[9.5ch] text-[24px] tracking-wide" : "flex-1 text-[16px]",
            )}
          />
          {trailing}
        </span>
      </span>
    </label>
  );
}

export function SelectField({
  icon,
  label,
  optional,
  placeholder,
  value,
  onChange,
  options,
}: {
  icon: string;
  label: string;
  optional?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="flex w-full flex-col gap-[5px]">
      <div className="flex items-center gap-[5px] ps-[15px]">
        <span className="relative size-4 shrink-0 overflow-clip">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt="" className="size-full" />
        </span>
        <span className="text-[14px] font-medium text-white/60">{label}</span>
        {optional ? (
          <span className="text-[14px] font-light text-white/60">({optional})</span>
        ) : null}
      </div>
      <label className="relative flex w-full items-center overflow-clip rounded-[16px] border-[1.5px] border-white/50 p-[15px]">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full appearance-none bg-transparent pe-8 text-[14px] font-medium outline-none",
            value ? "text-white" : "text-white/70",
          )}
        >
          <option value="" className="bg-[#141414] text-white">
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id} className="bg-[#141414] text-white">
              {o.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute end-[15px] top-1/2 size-[18px] -translate-y-1/2 rotate-90 overflow-clip">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/onboarding/chevron.svg" alt="" className="size-full" />
        </span>
      </label>
    </div>
  );
}
