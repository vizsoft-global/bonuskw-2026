import { cn } from "@/lib/utils";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  phone,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  phone?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex w-full items-center overflow-clip rounded-[16px] border-[1.5px] border-white/20 p-[15px]">
      <span className="flex min-w-0 flex-1 flex-col gap-2.5">
        <span className="text-[14px] text-white/60">{label}</span>
        <span className="flex items-baseline gap-1">
          {phone ? (
            <span className="text-[24px] font-medium text-white">+965</span>
          ) : null}
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            type={type}
            inputMode={phone ? "numeric" : undefined}
            autoComplete={autoComplete}
            className={cn(
              "min-w-0 flex-1 bg-transparent font-medium text-white outline-none placeholder:text-white/30",
              phone ? "text-[24px]" : "text-[14px]",
            )}
          />
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
