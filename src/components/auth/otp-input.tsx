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
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          placeholder="-"
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            const next = chars.split("");
            while (next.length < length) next.push("");
            if (!typed) {
              next[i] = "";
              setDigits(next.join(""));
              return;
            }
            // SMS autofill and fast typing can drop several digits into one
            // box; spread them across the following boxes.
            if (typed.length > 1) {
              const fill = typed.slice(0, length - i);
              for (let k = 0; k < fill.length; k += 1) next[i + k] = fill[k];
              setDigits(next.join(""));
              refs.current[Math.min(i + fill.length, length - 1)]?.focus();
              return;
            }
            next[i] = typed;
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
