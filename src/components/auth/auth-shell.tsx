"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "./brand-logo";

export function AuthHeading({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="bg-gradient-to-b from-[#fafafa] from-[20%] to-[#b2b2b2] bg-clip-text text-[24px] font-medium text-transparent">
      {children}
    </h1>
  );
}

export function AuthShell({
  children,
  headerLink,
  showBack = true,
}: {
  children: React.ReactNode;
  headerLink?: React.ReactNode;
  showBack?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="relative min-h-dvh overflow-hidden bg-app-top text-white">
      <div className="pointer-events-none absolute -end-16 -top-40 size-[613px] lg:end-[-8%] lg:top-[12%] lg:size-[900px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/onboarding/glow.svg" alt="" className="size-full max-w-none" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 end-0 hidden w-[58%] lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/onboarding/book.png"
          alt=""
          className="absolute end-[-8%] top-[46%] h-auto w-[72%] max-w-[890px] -translate-y-1/2 object-contain"
        />
      </div>

      <header className="relative z-10 flex items-end px-[15px] pb-2.5 pt-safe lg:hidden">
        <div className="flex h-14 w-full items-center justify-between">
          {showBack ? (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Back"
              className="relative size-6 shrink-0 overflow-clip"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/onboarding/back.svg" alt="" className="size-full" />
            </button>
          ) : (
            <span className="size-6" />
          )}
          {headerLink ?? <BrandLogo size="nav" />}
          <span className="size-6" />
        </div>
      </header>

      <div className="absolute end-8 top-11 z-10 hidden lg:block">{headerLink}</div>

      <div className="relative z-10 overflow-y-auto px-[15px] pb-10 lg:flex lg:min-h-dvh lg:items-center lg:overflow-visible lg:px-[171px]">
        <div className="flex w-full flex-col gap-2.5 lg:w-[458px] lg:rounded-[24px] lg:border lg:border-white/15 lg:bg-white/[0.03] lg:p-[25px] lg:backdrop-blur-[50px]">
          <div className="hidden lg:block">
            <BrandLogo size="card" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthHeaderLink({
  prefix,
  action,
  href,
}: {
  prefix: string;
  action: string;
  href: string;
}) {
  return (
    <p className="text-center text-[12px] text-white lg:text-[14px]">
      <span className="text-white/60">{prefix} </span>
      <Link href={href} className="font-semibold text-white underline">
        {action}
      </Link>
    </p>
  );
}
