"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

const THRESHOLD = 280;
const MIN_HEIGHT = 220;

type Scroller = HTMLElement | Window;

function isWindowTarget(target: EventTarget | null) {
  return (
    target === window ||
    target === document ||
    target === document.documentElement ||
    target === document.body
  );
}

function scrollTopOf(scroller: Scroller) {
  if (scroller === window) return window.scrollY || document.documentElement.scrollTop || 0;
  return scroller instanceof HTMLElement ? scroller.scrollTop : 0;
}

function isPageScroller(el: HTMLElement) {
  if (el.closest("nav, [role='menu'], [role='listbox']")) return false;
  if (el.clientWidth < 280 || el.clientHeight < MIN_HEIGHT) return false;
  const overflowY = getComputedStyle(el).overflowY;
  if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") return false;
  return el.scrollHeight - el.clientHeight > 80;
}

export function ScrollToTop({ raised, className }: { raised?: boolean; className?: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  // `window` is not available during server prerendering; the effect sets it.
  const scrollerRef = useRef<Scroller | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    scrollerRef.current = window;
    setVisible(false);

    function consider(scroller: Scroller) {
      const top = scrollTopOf(scroller);
      if (top > THRESHOLD) {
        scrollerRef.current = scroller;
        setVisible((shown) => shown || true);
        return;
      }
      if (scrollerRef.current === scroller) setVisible(false);
    }

    function onScroll(event: Event) {
      const target = event.target;
      if (isWindowTarget(target)) {
        consider(window);
        return;
      }
      if (!(target instanceof HTMLElement) || !isPageScroller(target)) return;
      consider(target);
    }

    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, true);
  }, [pathname]);

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <button
      type="button"
      aria-label={t("backToTop")}
      title={t("backToTop")}
      onClick={() => {
        const scroller = scrollerRef.current ?? window;
        scroller.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className={cn(
        "fixed end-4 z-40 grid size-11 place-items-center rounded-full border border-white/15 bg-[#1c1c1c]/92 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:bg-[#2a2a2a] lg:end-8 lg:bottom-8",
        raised ? "bottom-28" : "bottom-6",
        className,
      )}
    >
      <ArrowUp className="size-5" strokeWidth={2.25} aria-hidden />
    </button>,
    document.body,
  );
}
