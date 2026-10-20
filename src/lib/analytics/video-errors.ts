"use client";

/**
 * Playback failures the session tracker cannot see: a ticket that never
 * arrived, a player API that never attached, a provider error mid-play, an
 * OTP that lapsed. None of those produce a `videoSessions` row, which is why
 * "some students cannot play at all" used to leave no trace at all.
 */
export type PlaybackIssue = {
  stage: "ticket" | "load" | "player" | "expired";
  message: string;
  code?: string;
  status?: number;
  courseId?: string;
  lessonId?: string;
  chapterId?: string;
  provider?: string;
  detail?: string;
};

export function reportPlaybackIssue(issue: PlaybackIssue, token?: string | null) {
  const body = JSON.stringify({ ...issue, token: token || undefined, at: Date.now() });
  try {
    if ("sendBeacon" in navigator) {
      navigator.sendBeacon("/api/analytics/video-error", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  void fetch("/api/analytics/video-error", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
