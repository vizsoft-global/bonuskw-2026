"use client";

import { Loader } from "@/components/shared/loader";

export function Splash() {
  return (
    <main className="fixed inset-0 z-[80] grid min-h-dvh place-items-center overflow-hidden bg-[#050505]">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/onboarding/splash-bg.png"
          alt=""
          className="size-full object-cover"
        />
      </div>
      <div className="pointer-events-none absolute end-[-20%] bottom-[-10%] h-[70%] w-[55%] lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/onboarding/splash-glow.svg" alt="" className="size-full" />
      </div>
      <div className="relative z-10">
        <Loader size="splash" />
      </div>
    </main>
  );
}

