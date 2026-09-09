"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { FileThumb } from "@/components/course/outline";
import { useI18n } from "@/lib/i18n/locale";
import { resourceKind } from "@/lib/course/resource-kind";
import { useMainSettings } from "@/lib/settings/use-settings";
import type { CustomPopup, StoryMedia } from "@/lib/types/firestore";

const SEEN = "ba-popup-dismissed:";

type Slide = {
  url: string;
  type: "image" | "video" | "audio" | "file";
  name?: string;
  poster?: string;
};

function kindOf(item: StoryMedia): Slide["type"] {
  const t = (item.type ?? item.kind ?? "").toLowerCase();
  if (t === "video" || t === "audio" || t === "file" || t === "image") return t;
  return "image";
}

function slidesOf(popup: CustomPopup): Slide[] {
  return (popup.media ?? [])
    .filter((item) => item.url)
    .map((item) => ({
      url: item.url as string,
      type: kindOf(item),
      name: item.name,
      poster: item.poster,
    }));
}

function courseIdFrom(path: string) {
  const match = path.match(/^\/course\/([^/]+)/);
  return match?.[1] ?? "";
}

function inWindow(popup: CustomPopup, now: Date) {
  const start = toDate(popup.startDate);
  const end = toDate(popup.endDate);
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const candidate = value as { toDate?: () => Date };
  return typeof candidate.toDate === "function" ? candidate.toDate() : null;
}

function isLive(popup: CustomPopup) {
  return !["deactive", "inactive", "disabled", "off", "hidden"].includes(String(popup.status ?? "active").toLowerCase());
}

export function popupMatches(popup: CustomPopup, path: string) {
  if (!isLive(popup) || !inWindow(popup, new Date())) return false;
  const locations = popup.locations ?? ["home"];
  if (path === "/" && locations.includes("home")) return true;
  if ((path === "/cart" || path.startsWith("/cart/")) && locations.includes("cart")) return true;
  const courseId = courseIdFrom(path);
  if (!courseId || !locations.includes("course")) return false;
  const ids = popup.courseIds ?? [];
  return ids.length === 0 || ids.includes(courseId);
}

function dismissed(id: string) {
  try {
    return sessionStorage.getItem(SEEN + id) === "1";
  } catch {
    return false;
  }
}

function remember(id: string) {
  try {
    sessionStorage.setItem(SEEN + id, "1");
  } catch {
    // Private mode can block storage; closing still hides it for this mount.
  }
}

function popupsOf(
  settings: {
    popupItems?: CustomPopup[];
    popupMsg?: { title?: string; subtitle?: string; message?: string };
  } | null | undefined,
): CustomPopup[] {
  if (settings?.popupItems?.length) return settings.popupItems;
  const legacy = settings?.popupMsg;
  if (!legacy?.title && !legacy?.subtitle && !legacy?.message) return [];
  return [{ id: "popup_legacy", ...legacy, locations: ["home"], status: "Active" }];
}

export function CustomPopupHost() {
  const path = usePathname();
  const settings = useMainSettings();
  const [openId, setOpenId] = useState<string | null>(null);

  const popup = useMemo(() => {
    const list = popupsOf(settings.data);
    return list.find((item) => item.id && popupMatches(item, path) && !dismissed(item.id)) ?? null;
  }, [path, settings.data]);

  useEffect(() => {
    if (!popup?.id) {
      setOpenId(null);
      return;
    }
    const timer = window.setTimeout(() => setOpenId(popup.id), 350);
    return () => window.clearTimeout(timer);
  }, [popup]);

  if (!popup || openId !== popup.id || typeof document === "undefined") return null;

  return createPortal(
    <PopupDialog
      popup={popup}
      onClose={() => {
        remember(popup.id);
        setOpenId(null);
      }}
    />,
    document.body,
  );
}

function PopupDialog({ popup, onClose }: { popup: CustomPopup; onClose: () => void }) {
  const { t } = useI18n();
  const slides = slidesOf(popup);
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const href = popup.redirect_url?.trim();
  const internal = href?.startsWith("/");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && slides.length > 1) setIndex((n) => (n + 1) % slides.length);
      if (event.key === "ArrowLeft" && slides.length > 1) setIndex((n) => (n - 1 + slides.length) % slides.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, slides.length]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center" role="presentation">
      <button type="button" className="absolute inset-0" aria-label={t("close")} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={popup.title || t("learnMore")}
        className="relative z-10 flex max-h-[min(720px,92dvh)] w-full max-w-[420px] flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#141414] text-[#fafafa] shadow-2xl"
      >
        <button
          type="button"
          aria-label={t("close")}
          onClick={onClose}
          className="absolute end-3 top-3 z-20 grid size-9 place-items-center rounded-full bg-black/50 text-white"
        >
          <X className="size-4" />
        </button>

        {slide ? (
          <div className="relative aspect-[4/5] max-h-[52dvh] bg-black">
            <SlideView slide={slide} />
            {slides.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label={t("back")}
                  onClick={() => setIndex((n) => (n - 1 + slides.length) % slides.length)}
                  className="absolute start-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/45"
                >
                  <ChevronLeft className="size-5 rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label={t("next")}
                  onClick={() => setIndex((n) => (n + 1) % slides.length)}
                  className="absolute end-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/45"
                >
                  <ChevronRight className="size-5 rtl:rotate-180" />
                </button>
                <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                  {slides.map((item, i) => (
                    <button
                      key={`${item.url}-${i}`}
                      type="button"
                      aria-label={`${i + 1}`}
                      onClick={() => setIndex(i)}
                      className={`h-1.5 rounded-full ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/40"}`}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2 overflow-y-auto px-5 py-4">
          {popup.title ? <h2 className="text-[18px] font-semibold leading-6">{popup.title}</h2> : null}
          {popup.subtitle ? <p className="text-[14px] text-[#cfcfcf]">{popup.subtitle}</p> : null}
          {popup.message ? <p className="whitespace-pre-wrap text-[14px] leading-6 text-[#d7d7d7]">{popup.message}</p> : null}
          {href ? (
            internal ? (
              <Link
                href={href}
                onClick={onClose}
                className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-[14px] font-medium text-[#111]"
              >
                {popup.buttonLabel || t("learnMore")}
              </Link>
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-[14px] font-medium text-[#111]"
              >
                {popup.buttonLabel || t("learnMore")}
              </a>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  const { t } = useI18n();
  if (slide.type === "video") {
    return <video src={slide.url} poster={slide.poster} className="h-full w-full object-contain" controls playsInline />;
  }
  if (slide.type === "audio") {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-4 bg-cover bg-center px-6"
        style={slide.poster ? { backgroundImage: `url(${slide.poster})` } : undefined}
      >
        <span className="rounded-full bg-black/50 p-4">
          <FileThumb kind="audio" className="size-8 text-white" />
        </span>
        <audio src={slide.url} controls className="w-full" />
      </div>
    );
  }
  if (slide.type === "file") {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3 bg-cover bg-center px-6 text-center"
        style={slide.poster ? { backgroundImage: `url(${slide.poster})` } : undefined}
      >
        <span className="rounded-2xl bg-black/50 p-4">
          <FileThumb kind={resourceKind({ name: slide.name, url: slide.url })} className="size-8 text-white" />
        </span>
        <p className="max-w-full truncate text-sm">{slide.name || t("download")}</p>
        <a href={slide.url} download target="_blank" rel="noreferrer" className="text-sm font-medium underline">
          {t("download")}
        </a>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={slide.url} alt="" className="h-full w-full object-cover" />
  );
}
