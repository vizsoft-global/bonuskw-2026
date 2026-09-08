"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, House, Search, ShoppingBag, Store, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", key: "home" as const, icon: House },
  { href: "/store", key: "store" as const, icon: Store },
  { href: "/my-space", key: "mySpace" as const, icon: ShoppingBag },
  { href: "/profile", key: "profile" as const, icon: UserRound },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const cartCount = 0;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/" className="hidden items-center gap-2 font-semibold lg:flex">
            <span className="grid size-8 place-items-center rounded-xl bg-white/10">✚</span>
            {t("appName")}
          </Link>
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="flex min-w-0 items-center gap-2 lg:hidden"
          >
            <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-white/10 text-sm">
              {profile?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                (profile?.display_name || "B").slice(0, 1)
              )}
            </span>
            <span className="min-w-0 text-start">
              <span className="block truncate text-sm font-medium">
                {profile?.display_name || t("profile")}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/search")}
            className="glass flex h-10 flex-1 items-center gap-2 rounded-full px-3 text-sm text-muted"
          >
            <Search className="size-4" />
            <span className="truncate">{t("search")}</span>
          </button>
          <Link href="/notifications" aria-label={t("notifications")} className="relative">
            <Bell className="size-5" />
          </Link>
          <Link href="/cart" aria-label={t("cart")} className="relative">
            <ShoppingBag className="size-5" />
            {cartCount ? (
              <span className="absolute -end-1 -top-1 grid size-4 place-items-center rounded-full bg-accent text-[10px]">
                {cartCount}
              </span>
            ) : null}
          </Link>
          <Link href="/profile" className="hidden items-center gap-2 lg:flex">
            <span className="text-sm">{profile?.display_name || t("profile")}</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 lg:pb-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-3 z-30 mx-auto flex w-[min(92%,420px)] items-center justify-around rounded-full border border-line bg-surface/90 px-2 py-2 shadow-lg backdrop-blur-xl lg:hidden">
        {tabs.map((tab) => {
          const active = path === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-0.5 text-[11px]",
                active ? "text-primary" : "text-muted",
              )}
            >
              <Icon className="size-5" />
              {t(tab.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
