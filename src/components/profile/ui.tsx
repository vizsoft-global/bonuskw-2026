"use client";

import Link from "next/link";
import { HomeIcon } from "@/components/home/icon";
import { cn } from "@/lib/utils";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-[#999]">{children}</p>;
}

export function MenuRow({
  href,
  icon,
  label,
  onClick,
  trailing,
  last,
  active,
}: {
  href?: string;
  icon: string;
  label: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  last?: boolean;
  active?: boolean;
}) {
  const inner = (
    <>
      <span className="size-4 shrink-0">
        <HomeIcon src={icon} />
      </span>
      <span className={cn("min-w-0 flex-1 text-start text-[14px] font-medium", active ? "text-[#0c5eff]" : "text-[#fafafa]")}>
        {label}
      </span>
      {trailing}
    </>
  );
  const className = cn(
    "flex min-h-11 w-full items-center gap-2.5 py-2.5",
    last ? "" : "border-b-[0.8px] border-[#fafafa]/10",
  );
  if (href) {
    return (
      <Link href={href} className={cn(className, active && "text-[#0c5eff]")}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export function PushToggle({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      className={cn(
        "relative h-5 w-[37px] shrink-0 rounded-full transition-colors",
        on ? "bg-[#0c5eff]" : "bg-[#3a3a3a]",
        disabled && "opacity-70",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-white transition-[inset-inline-start]",
          on ? "start-[17px]" : "start-0.5",
        )}
      />
    </span>
  );
}

export function ProfileField({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  type = "text",
  trailing,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="flex h-[61px] w-full items-center overflow-clip rounded-[16px] border-[1.5px] border-white/20 px-[15px] py-2.5">
      <span className="flex min-w-0 flex-1 flex-col gap-2.5">
        <span className="text-[12px] text-white/60">{label}</span>
        <span className="flex items-center justify-between gap-2">
          <input
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            type={type}
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-[#fafafa] outline-none placeholder:text-white/30"
          />
          {trailing}
        </span>
      </span>
    </label>
  );
}

export function ProfileTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-end gap-4 border-b border-white/10">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 pb-2 text-[14px]",
              active ? "border-white text-[#fafafa]" : "border-transparent text-[#999]",
            )}
          >
            {tab.label}
            {tab.count != null ? (
              <span className="rounded-[8px] bg-[#292929] px-2 py-px text-[12px] text-[#fafafa]">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function LangRadio({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-full border",
        selected ? "border-[#f24822]" : "border-white/50",
      )}
    >
      {selected ? <span className="size-2 rounded-full bg-[#f24822]" /> : null}
    </span>
  );
}
