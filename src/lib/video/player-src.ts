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
 * paused frame plus a second tap on play. VdoCipher needs the same `muted=true`
 * as Cloudflare Stream — without it iOS refuses the autoplay and the lesson
 * opens on a paused player, which students read as "the video is not playing".
 */
export function playerSrc(ticket: PlaybackTicket | null | undefined) {
  if (!ticket) return "";
  if (ticket.provider === "vdocipher" && ticket.otp) {
    return `https://player.vdocipher.com/v2/?otp=${ticket.otp}&playbackInfo=${ticket.playbackInfo}&autoplay=true&muted=true`;
  }
  if (ticket.provider === "stream" && ticket.uid) {
    const domain = process.env.NEXT_PUBLIC_CF_STREAM_DOMAIN || "customer.cloudflarestream.com";
    return `https://${domain}/${ticket.uid}/iframe?autoplay=true&muted=true`;
  }
  return "";
}

/**
 * The server mints OTPs with a 300s TTL and a ticket is never reused, so a tab
 * that sat in the background past this point has to fetch a fresh one before
 * the player asks for a licence it can no longer authorise.
 */
export const TICKET_FRESH_MS = 4 * 60_000;

export function isTicketStale(fetchedAt: number | null) {
  return !fetchedAt || Date.now() - fetchedAt > TICKET_FRESH_MS;
}

/** A ticket with no playable source is a failure even when the server said 200. */
export function ticketProblem(ticket: PlaybackTicket | null | undefined) {
  if (!ticket) return "Could not start playback";
  if (ticket.error) return ticket.error;
  if (playerSrc(ticket)) return null;
  return "Video is not ready";
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
