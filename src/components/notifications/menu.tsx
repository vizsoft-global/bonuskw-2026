"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HomeIcon } from "@/components/home/icon";
import { ClearAllButton, NotificationInbox, useVisibleNotifications } from "@/components/notifications/inbox";
import { useI18n } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

function CountBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute end-1.5 top-1.5 grid min-w-3 place-items-center rounded-[7px] bg-[#f24822] px-0.5 text-[8px] font-medium leading-3 text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function NotificationsMenu() {
  const { t } = useI18n();
  const { unread } = useVisibleNotifications();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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
    <div ref={root} className="relative z-50 hidden lg:block">
      <button
        type="button"
        aria-label={t("notifications")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="relative flex cursor-pointer items-center rounded-[47px] border-[0.5px] border-white/15 bg-white/5 p-[5px] backdrop-blur-[15px]"
      >
        <span className="relative size-10 overflow-visible rounded-[28px]">
          <span className="absolute start-2.5 top-[10px] size-5">
            <HomeIcon src="/home/bell.svg" />
          </span>
          <CountBadge count={unread} />
        </span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t("notifications")}
          className="absolute end-0 top-[calc(100%+8px)] z-50 flex w-[393px] max-w-[min(393px,calc(100vw-40px))] flex-col rounded-[24px] border-[0.7px] border-white/20 bg-white/10 px-[15px] pb-[15px] pt-[5px] shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-[35px]"
        >
          <div className="flex h-10 items-center justify-between">
            <p className="min-w-0 truncate text-[14px] font-semibold text-[#fafafa]">{t("notifications")}</p>
            <ClearAllButton className="cursor-pointer text-[12px] font-medium text-[#fc522c]" />
          </div>
          <div className="max-h-[min(420px,60vh)] overflow-y-auto">
            <NotificationInbox compact />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function NotificationsBellButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const { unread } = useVisibleNotifications();
  return (
    <Link href="/notifications" aria-label={t("notifications")} className={cn("relative grid size-10 place-items-center", className)}>
      <span className="size-5">
        <HomeIcon src="/home/bell.svg" />
      </span>
      <CountBadge count={unread} />
    </Link>
  );
}
