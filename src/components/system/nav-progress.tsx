"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

let begin: (() => void) | null = null;

/** Starts the top bar before a programmatic navigation such as router.push. */
export function startNavigation() {
  begin?.();
}

/** Thin bar at the top of the screen while a new page is opening. */
export function NavProgress() {
  const path = usePathname();
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(false);
  }, [path]);

  useEffect(() => {
    begin = () => setOn(true);
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement | null)?.closest("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setOn(true);
    };
    document.addEventListener("click", onClick);
    return () => {
      if (begin) begin = null;
      document.removeEventListener("click", onClick);
    };
  }, []);

  if (!on) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden bg-transparent" aria-hidden>
      <div className="h-full w-1/3 animate-[nav_1s_ease-in-out_infinite] bg-[linear-gradient(90deg,#ED4A27,#32B2B9,#048EE4)]" />
      <style>{`@keyframes nav { 0% { transform: translateX(-120%); } 100% { transform: translateX(360%); } }`}</style>
    </div>
  );
}
