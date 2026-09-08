"use client";

import { useRef } from "react";

export function OtpInput({
  length = 6,
  value,
  onChange,
}: {
  length?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = value.replace(/\D/g, "").slice(0, length);

  function setDigits(next: string) {
    onChange(next.replace(/\D/g, "").slice(0, length));
  }

  return (
    <div className="flex w-full gap-2">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={chars[i] ?? ""}
          inputMode="numeric"
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          placeholder="-"
          onChange={(e) => {
            const char = e.target.value.replace(/\D/g, "").slice(-1);
            const next = chars.split("");
            if (!char) {
              next[i] = "";
              setDigits(next.join(""));
              return;
            }
            next[i] = char;
            setDigits(next.join(""));
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !chars[i] && i > 0) {
              e.preventDefault();
              const next = chars.split("");
              next[i - 1] = "";
              setDigits(next.join(""));
              refs.current[i - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            setDigits(pasted);
            refs.current[Math.min(pasted.length, length - 1)]?.focus();
          }}
          className="h-[59px] min-w-0 flex-1 rounded-[12px] border-[1.5px] border-white/20 bg-transparent text-center text-[16px] font-medium text-white outline-none placeholder:text-white/40"
        />
      ))}
    </div>
  );
}
