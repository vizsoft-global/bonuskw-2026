"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { Bell, House, LayoutGrid, Search, ShoppingBag, Store, UserRound } from "lucide-react";
import { AccountMenu } from "@/components/layout/account-menu";
import { BrandLogo } from "@/components/layout/brand";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth/auth-provider";
import { useCart } from "@/lib/cart/cart-provider";
import { getDb } from "@/lib/firebase/client";
import { collections } from "@/lib/firebase/collections";
import { displayName } from "@/lib/format";
import { useI18n } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", key: "home" as const, icon: House },
  { href: "/store", key: "store" as const, icon: Store },
  { href: "/my-space", key: "mySpace" as const, icon: LayoutGrid },
  { href: "/profile", key: "profile" as const, icon: UserRound },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

export function useUniversityName(universityId?: string) {
  return useQuery({
    queryKey: ["university", universityId],
    enabled: Boolean(universityId),
    staleTime: Infinity,
    queryFn: async () => {
      const snap = await getDoc(doc(getDb(), collections.university, universityId!));
      return (snap.get("name") as string | undefined) ?? "";
    },
  });
}

/**
 * Global chrome. Mobile: compact top bar + floating bottom dock. Desktop: one
 * sticky top nav with primary tabs, a real search field and the account menu.
 * `hideDock` is for immersive routes (player, stories) that need the space.
 */
export function AppShell({
  children,
  hideDock = false,
  width = "default",
}: {
  children: React.ReactNode;
  hideDock?: boolean;
  width?: "default" | "wide" | "narrow";
}) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const { count } = useCart();
  const path = usePathname();
  const router = useRouter();
  const university = useUniversityName(profile?.universityRef?.id);
  const name = displayName(profile);

  const maxWidth =
    width === "wide" ? "max-w-7xl" : width === "narrow" ? "max-w-3xl" : "max-w-6xl";

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className={cn("mx-auto flex items-center gap-3 px-4 py-3 md:gap-5", maxWidth)}>
          {/* Mobile: avatar + name/university */}
          <Link href="/profile" className="flex min-w-0 items-center gap-2.5 lg:hidden">
            <Avatar src={profile?.photo_url} name={name} />
            <span className="min-w-0 text-start">
              <span className="block truncate text-sm font-semibold leading-tight">{name}</span>
              {university.data ? (
                <span className="block truncate text-[11px] leading-tight text-muted">{university.data}</span>
              ) : null}
            </span>
          </Link>

          {/* Desktop: brand + primary nav */}
          <Link href="/" className="hidden shrink-0 lg:block" aria-label={t("appName")}>
            <BrandLogo />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {tabs.map((tab) => {
              const active = isActive(path, tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                    active ? "bg-surface-2 text-text" : "text-muted hover:text-text",
                  )}
                >
                  {t(tab.key)}
                </Link>
              );
            })}
          </nav>

          <div className="ms-auto flex items-center gap-2 md:gap-3">
            {/* Desktop search field */}
            <button
              type="button"
              onClick={() => router.push("/search")}
              className="hidden h-11 w-72 items-center gap-2 rounded-full border border-line bg-surface/70 px-4 text-sm text-muted hover:bg-surface-2 md:flex xl:w-80"
            >
              <Search className="size-4" />
              <span className="truncate">{t("search")}</span>
            </button>
            <IconLink href="/search" label={t("search")} className="md:hidden">
              <Search className="size-5" />
            </IconLink>
            <IconLink href="/notifications" label={t("notifications")}>
              <Bell className="size-5" />
            </IconLink>
            <IconLink href="/cart" label={t("cart")} count={count}>
              <ShoppingBag className="size-5" />
            </IconLink>
            <div className="hidden lg:block">
              <AccountMenu subtitle={university.data || undefined} />
            </div>
          </div>
        </div>
      </header>

      <main className={cn("mx-auto w-full px-4 pt-4 md:pt-6", maxWidth, hideDock ? "pb-8" : "pb-28 lg:pb-12")}>
        {children}
      </main>

      {!hideDock ? (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-3 z-30 mx-auto flex w-[min(92%,420px)] items-center justify-around rounded-full border border-line bg-elevated/90 px-2 py-1.5 shadow-card backdrop-blur-xl lg:hidden"
        >
          {tabs.map((tab) => {
            const active = isActive(path, tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-16 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <Icon className={cn("size-5", active && "fill-primary/15")} />
                {t(tab.key)}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}

function IconLink({
  href,
  label,
  count,
  className,
  children,
}: {
  href: string;
  label: string;
  count?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "relative grid size-10 place-items-center rounded-full text-text hover:bg-surface-2 md:size-11 md:border md:border-line md:bg-surface/70",
        className,
      )}
    >
      {children}
      {count ? (
        <span className="absolute -end-0.5 -top-0.5 grid min-w-4.5 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
