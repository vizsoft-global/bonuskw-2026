"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FilePreview } from "@/components/course/file-preview";
import { Loader } from "@/components/shared/loader";
import type { OutlineFile } from "@/lib/course/outline";
import { useAuth } from "@/lib/auth/auth-provider";
import { useI18n } from "@/lib/i18n/locale";
import { reportPlaybackIssue } from "@/lib/analytics/video-errors";
import { playerSrc, requestPlayback, ticketProblem } from "@/lib/video/player-src";

/**
 * Plays a free-preview lesson in a popup so students can sample a course
 * before enrolling. Signed-out visitors can watch too: the server only hands
 * out a ticket when the lesson is marked as a free preview.
 */
export function VideoPopup({
  lessonId,
  title,
  files = [],
  onClose,
}: {
  lessonId: string;
  title: string;
  files?: OutlineFile[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [file, setFile] = useState<OutlineFile | null>(null);
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  // Tickets are short-lived, so one is requested per opening and never cached.
  const { data: ticket, isFetching } = useQuery({
    queryKey: ["preview-ticket", lessonId, user?.uid ?? "anon", attempt],
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => requestPlayback({ lessonId }, user ? await user.getIdToken() : null),
  });
  // A failed ticket must say so and offer a retry — it used to fall through to
  // an empty stage that looked like a video that would not load.
  const problem = ticket && !isFetching ? ticketProblem(ticket) : null;
  useEffect(() => {
    if (!problem) return;
    reportPlaybackIssue({ stage: "ticket", message: problem, lessonId, provider: ticket?.provider });
  }, [problem, lessonId, ticket?.provider]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const src = playerSrc(ticket);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(false), [src]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] flex flex-col bg-black px-3 pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))] sm:grid sm:place-items-center sm:bg-black/80 sm:backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex h-full w-full flex-col sm:h-auto sm:max-w-[960px]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <p className="min-w-0 truncate text-[14px] font-medium text-text">
            <span className="me-2 rounded-full bg-[#0c5eff] px-2 py-0.5 text-[10px] font-semibold text-white">
              {t("freePreview")}
            </span>
            {title}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-text"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-[16px] bg-black ring-1 ring-white/10">
          {src ? (
            <>
              {ready ? null : (
                <div className="grid h-full w-full place-items-center">
                  <Loader size="page" />
                </div>
              )}
              <iframe
                key={src}
                title={title}
                src={src}
                onLoad={() => setReady(true)}
                className={ready ? "h-full w-full" : "hidden"}
              /* `allow` is what Chrome reads; the `allowFullScreen` attribute is
                 what iOS Safari and in-app WebViews still require. */
              allow="fullscreen; autoplay; encrypted-media"
              allowFullScreen
            />
            </>
          ) : problem ? (
            <div className="grid h-full w-full place-items-center px-6 text-center text-[13px] text-muted">
              <div>
                <p>{problem}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((n) => n + 1)}
                  className="mt-3 rounded-[10px] bg-white px-4 py-2 text-[12px] font-semibold text-black"
                >
                  {t("retryPlayback")}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid h-full w-full place-items-center">
              <Loader size="page" />
            </div>
          )}
        </div>
        {files.length ? (
          <ul className="mt-3 max-h-40 overflow-y-auto rounded-xl bg-surface p-2 text-text">
            {files.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-[13px]">
                <button type="button" onClick={() => setFile(row)} className="min-w-0 truncate text-start">
                  {row.name}
                </button>
                {row.downloadable ? (
                  <a href={row.url} download className="shrink-0 text-[12px] text-[#0c5eff]">
                    {t("download")}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {file ? (
        <div onClick={(e) => e.stopPropagation()}>
          <FilePreview file={file} onClose={() => setFile(null)} />
        </div>
      ) : null}
    </div>
  );
}
