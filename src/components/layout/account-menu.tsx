"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { useTheme } from "next-themes";
import {
  Bookmark,
  ChevronDown,
  Languages,
  LogOut,
  Moon,
  Receipt,
  Sun,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";
import { displayName } from "@/lib/format";
import { avatarSrc } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const itemClass =
  "flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2";

export function AccountMenu({ subtitle }: { subtitle?: string }) {
  const { profile, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  const name = displayName(profile);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface/70 ps-1 pe-3 text-start hover:bg-surface-2"
        >
          <Avatar src={avatarSrc(profile)} name={name} size="sm" />
          <span className="hidden min-w-0 lg:block">
            <span className="block max-w-36 truncate text-sm font-medium leading-tight">{name}</span>
            {subtitle ? (
              <span className="block max-w-36 truncate text-[11px] leading-tight text-muted">{subtitle}</span>
            ) : null}
          </span>
          <ChevronDown className="size-4 text-muted" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-64 rounded-2xl border border-line bg-elevated p-1.5 shadow-card data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href="/profile">
              <UserRound className="size-4 text-muted" /> {t("profile")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href="/profile/saved">
              <Bookmark className="size-4 text-muted" /> {t("saved")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href="/profile/transactions">
              <Receipt className="size-4 text-muted" /> {t("transactions")}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1.5 h-px bg-line" />
          <DropdownMenu.Item
            className={itemClass}
            onSelect={(event) => {
              event.preventDefault();
              setTheme(dark ? "light" : "dark");
            }}
          >
            {dark ? <Sun className="size-4 text-muted" /> : <Moon className="size-4 text-muted" />}
            {dark ? t("light") : t("dark")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={itemClass}
            onSelect={(event) => {
              event.preventDefault();
              setLocale(locale === "ar" ? "en" : "ar");
            }}
          >
            <Languages className="size-4 text-muted" />
            {locale === "ar" ? "English" : "العربية"}
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1.5 h-px bg-line" />
          <DropdownMenu.Item className={cn(itemClass, "text-danger")} onSelect={() => void logout()}>
            <LogOut className="size-4" /> {t("logout")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
