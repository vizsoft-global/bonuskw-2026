"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader } from "@/components/shared/loader";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";
import { playerSrc, requestPlayback } from "@/lib/video/player-src";

/**
 * Plays a free-preview lesson in a popup so students can sample a course
 * before enrolling. Signed-out visitors can watch too: the server only hands
 * out a ticket when the lesson is marked as a free preview.
 */
export function VideoPopup({ lessonId, title, onClose }: { lessonId: string; title: string; onClose: () => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  // Tickets are short-lived, so one is requested per opening and never cached.
  const { data: ticket } = useQuery({
    queryKey: ["preview-ticket", lessonId, user?.uid ?? "anon"],
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => requestPlayback({ lessonId }, user ? await user.getIdToken() : null),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const src = playerSrc(ticket);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] grid place-items-center bg-black/80 px-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="w-full max-w-[960px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <p className="min-w-0 truncate text-[14px] font-medium text-[#fafafa]">
            <span className="me-2 rounded-full bg-[#0c5eff] px-2 py-0.5 text-[10px] font-semibold text-white">
              {t("freePreview")}
            </span>
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-[#fafafa]"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-[16px] bg-black ring-1 ring-white/10">
          {src ? (
            <iframe
              key={src}
              title={title}
              src={src}
              className="h-full w-full"
              allow="fullscreen; autoplay; encrypted-media"
            />
          ) : ticket?.error ? (
            <div className="grid h-full w-full place-items-center px-6 text-center text-[13px] text-[#999]">
              {ticket.error}
            </div>
          ) : (
            <div className="grid h-full w-full place-items-center">
              <Loader size="page" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
