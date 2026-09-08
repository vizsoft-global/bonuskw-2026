"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bookmark, Languages, LogOut, Moon, Receipt, Sun, UserRound, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

export function ProfileMenu({
  trigger,
  align = "end",
  className,
}: {
  trigger: (open: boolean) => ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const { t, locale, setLocale } = useI18n();
  const { logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const isDark = resolvedTheme !== "light";

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative z-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn("cursor-pointer", className)}
      >
        {trigger(open)}
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute top-[calc(100%+8px)] z-50 w-[210px] overflow-hidden rounded-[14px] border-[0.7px] border-white/20 bg-white/10 py-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-[35px]",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          <MenuLink href="/profile" icon={UserRound} onClick={() => setOpen(false)}>
            {t("profile")}
          </MenuLink>
          <MenuLink href="/profile/saved" icon={Bookmark} onClick={() => setOpen(false)}>
            {t("saved")}
          </MenuLink>
          <MenuLink href="/profile/transactions" icon={Receipt} onClick={() => setOpen(false)}>
            {t("transactions")}
          </MenuLink>
          <div className="my-1.5 h-px bg-white/10" />
          <MenuButton
            icon={isDark ? Sun : Moon}
            onClick={() => {
              setTheme(isDark ? "light" : "dark");
              setOpen(false);
            }}
          >
            {isDark ? t("light") : t("dark")}
          </MenuButton>
          <MenuButton
            icon={Languages}
            onClick={() => {
              setLocale(locale === "en" ? "ar" : "en");
              setOpen(false);
            }}
          >
            {locale === "en" ? "العربية" : "English"}
          </MenuButton>
          <div className="my-1.5 h-px bg-white/10" />
          <MenuButton
            icon={LogOut}
            destructive
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            {t("logout")}
          </MenuButton>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
  onClick,
}: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[14px] text-[#fafafa] hover:bg-white/5"
    >
      <Icon className="size-[18px] stroke-[1.6]" />
      {children}
    </Link>
  );
}

function MenuButton({
  icon: Icon,
  children,
  onClick,
  destructive,
}: {
  icon: LucideIcon;
  children: ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-start text-[14px] hover:bg-white/5",
        destructive ? "text-[#ff6b6b]" : "text-[#fafafa]",
      )}
    >
      <Icon className={cn("size-[18px] stroke-[1.6]", destructive && "text-[#ff6b6b]")} />
      {children}
    </button>
  );
}
