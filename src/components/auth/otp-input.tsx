"use client";

import { useEffect, useRef } from "react";

/**
 * A six-box one-time code field backed by a SINGLE real input.
 *
 * The boxes are decoration; the input underneath them is the field the browser
 * actually talks to. That matters because the code arrives in one of three ways
 * — Chrome's WebOTP consent ("Allow Chrome to read the message below and enter
 * the code"), the iOS keyboard suggestion, or our own `get()` call — and all
 * three are unreliable against six separate inputs:
 *
 *  - the browser has to guess which box to fill, and Chrome's autofill only
 *    looks for `autocomplete="one-time-code"`, which can sit on one box only;
 *  - autofill writes the DOM value directly, so React never observes the change,
 *    and a controlled input then reverts to its empty state on the next render —
 *    the code arrives and is wiped before it can be seen.
 *
 * One input removes both problems. It is invisible (the boxes show the digits)
 * and covers the row, so tapping anywhere lands in it.
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
}: {
  length?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const chars = value.replace(/\D/g, "").slice(0, length);

  /**
   * Focus on mount so the code suggestion has a target, and so the keypad is up
   * where the student is going next. Not `autoFocus`: that fires during
   * hydration, before the page is interactive, and is dropped on mobile.
   */
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /**
   * A listener on the node itself, alongside React's `onChange`.
   *
   * Autofill writes the DOM value directly, and React only reports a change it
   * can prove happened — so the value a browser injected can be reverted by the
   * next render without anyone seeing it. Reading the node covers that case no
   * matter which component of the browser did the writing. Calling through twice
   * for one keystroke is harmless: the handler is idempotent.
   */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const read = () => onChangeRef.current(el.value.replace(/\D/g, "").slice(0, length));
    el.addEventListener("input", read);
    el.addEventListener("change", read);
    return () => {
      el.removeEventListener("input", read);
      el.removeEventListener("change", read);
    };
  }, [length]);

  return (
    <div className="relative flex w-full gap-2">
      <div className="flex w-full gap-2" aria-hidden>
        {Array.from({ length }, (_, i) => (
          <div
            key={i}
            className="grid h-[59px] min-w-0 flex-1 place-items-center rounded-[12px] border-[1.5px] border-line-strong bg-transparent text-[16px] font-medium text-text"
          >
            {chars[i] ?? <span className="text-muted">-</span>}
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        value={chars}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={length}
        aria-label="One-time code"
        className="absolute inset-0 h-full w-full cursor-text rounded-[12px] bg-transparent text-transparent caret-transparent outline-none focus:ring-2 focus:ring-[#0c5eff]/40"
      />
    </div>
  );
}

