/** What `/api/video/otp` returns for either player. */
export type PlaybackTicket = {
  provider?: string;
  otp?: string;
  playbackInfo?: string;
  uid?: string;
  videoDocId?: string | null;
  error?: string;
};

/**
 * Embed URL for a playback ticket. Both players start muted: browsers block
 * audible autoplay, so this turns one tap into instant motion instead of a
 * paused frame plus a second tap on play.
 */
export function playerSrc(ticket: PlaybackTicket | null | undefined) {
  if (!ticket) return "";
  if (ticket.provider === "vdocipher" && ticket.otp) {
    return `https://player.vdocipher.com/v2/?otp=${ticket.otp}&playbackInfo=${ticket.playbackInfo}&autoplay=true`;
  }
  if (ticket.provider === "stream" && ticket.uid) {
    const domain = process.env.NEXT_PUBLIC_CF_STREAM_DOMAIN || "customer.cloudflarestream.com";
    return `https://${domain}/${ticket.uid}/iframe?autoplay=true&muted=true`;
  }
  return "";
}

/** Asks the server for a playback ticket; `token` is optional for previews. */
export async function requestPlayback(
  body: { lessonId: string } | { courseId: string },
  token?: string | null,
): Promise<PlaybackTicket> {
  const res = await fetch("/api/video/otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({ error: "Could not start playback" }))) as PlaybackTicket;
}
