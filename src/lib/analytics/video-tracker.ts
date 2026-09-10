"use client";

/**
 * Playback analytics without paying the provider for it.
 *
 * Attaches to the VdoCipher or Cloudflare Stream iframe through their player
 * APIs and measures what the student actually does: seconds watched, pauses,
 * seeks, buffering, furthest position, playback quality. Deltas are flushed to
 * `/api/analytics/video` every 20s, on pause, and when the tab hides or the
 * page unloads (via sendBeacon so the last chunk is not lost). Bandwidth is
 * estimated from watched seconds × a per-resolution bitrate, since neither
 * provider exposes bytes on the standard plan.
 */

export type VideoProviderKind = "vdocipher" | "stream";

export type VideoSessionContext = {
  courseId: string;
  lessonId: string;
  chapterId?: string;
  videoDocId?: string;
  provider: VideoProviderKind;
  durationSec?: number;
  locale?: string;
};

export type VideoDelta = {
  sessionId: string;
  first: boolean;
  watchSec: number;
  plays: number;
  pauses: number;
  seeks: number;
  buffers: number;
  bufferSec: number;
  estBytes: number;
  maxPositionSec: number;
  durationSec: number;
  qualityHeight: number;
  playbackRate: number;
  ended: boolean;
  device: string;
  connection: string;
} & VideoSessionContext;

type MediaLike = {
  addEventListener: (type: string, fn: (e?: unknown) => void) => void;
  removeEventListener?: (type: string, fn: (e?: unknown) => void) => void;
  currentTime?: number;
  duration?: number;
  videoHeight?: number;
  playbackRate?: number;
  paused?: boolean;
};

declare global {
  interface Window {
    VdoPlayer?: { getInstance: (iframe: HTMLIFrameElement) => { video: MediaLike } };
    Stream?: (iframe: HTMLIFrameElement) => MediaLike & { videoHeight?: number };
  }
}

const FLUSH_MS = 20_000;

/** Approximate streaming bitrate by rendition height, in bits per second. */
export function bitrateForHeight(height: number) {
  if (!height) return 1_500_000; // unknown rendition: assume ~720p-ish adaptive average
  if (height <= 240) return 350_000;
  if (height <= 360) return 700_000;
  if (height <= 480) return 1_200_000;
  if (height <= 720) return 2_500_000;
  if (height <= 1080) return 4_500_000;
  return 8_000_000;
}

function loadScript(src: string, ready: () => boolean) {
  return new Promise<void>((resolve, reject) => {
    if (ready()) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("player api failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("player api failed"));
    document.head.appendChild(s);
  });
}

function deviceKind() {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

function connectionKind() {
  const c = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return c?.effectiveType ?? "unknown";
}

export class VideoTracker {
  private ctx: VideoSessionContext;
  private getToken: () => Promise<string>;
  private sessionId = crypto.randomUUID();
  private media: MediaLike | null = null;
  private handlers: [string, (e?: unknown) => void][] = [];
  private timer: number | null = null;
  private lastTime: number | null = null;
  private playing = false;
  private bufferingSince: number | null = null;
  private seekingFromUser = false;
  private first = true;
  private stopped = false;

  // Accumulated since last flush.
  private d = { watchSec: 0, plays: 0, pauses: 0, seeks: 0, buffers: 0, bufferSec: 0, estBytes: 0 };
  private maxPosition = 0;
  private duration = 0;
  private quality = 0;
  private rate = 1;
  private ended = false;

  constructor(ctx: VideoSessionContext, getToken: () => Promise<string>) {
    this.ctx = ctx;
    this.getToken = getToken;
    this.duration = ctx.durationSec ?? 0;
  }

  async attach(iframe: HTMLIFrameElement) {
    try {
      if (this.ctx.provider === "vdocipher") {
        await loadScript("https://player.vdocipher.com/v2/api.js", () => Boolean(window.VdoPlayer));
        this.media = window.VdoPlayer!.getInstance(iframe).video;
      } else {
        await loadScript("https://embed.cloudflarestream.com/embed/sdk.latest.js", () => Boolean(window.Stream));
        this.media = window.Stream!(iframe);
      }
    } catch {
      return; // analytics must never break playback
    }
    if (this.stopped || !this.media) return;
    this.bind();
    this.timer = window.setInterval(() => void this.flush(false), FLUSH_MS);
    document.addEventListener("visibilitychange", this.onHide);
    window.addEventListener("pagehide", this.onHide);
  }

  private on(type: string, fn: (e?: unknown) => void) {
    this.media?.addEventListener(type, fn);
    this.handlers.push([type, fn]);
  }

  private bind() {
    this.on("play", () => {
      this.playing = true;
      this.d.plays += 1;
      this.lastTime = this.media?.currentTime ?? null;
    });
    this.on("playing", () => {
      this.playing = true;
      if (this.bufferingSince != null) {
        this.d.bufferSec += (Date.now() - this.bufferingSince) / 1000;
        this.bufferingSince = null;
      }
    });
    this.on("pause", () => {
      const t = this.media?.currentTime ?? 0;
      const dur = this.media?.duration ?? this.duration;
      this.playing = false;
      // A pause fired at the very end is the video finishing, not the student stopping.
      if (!(dur && t >= dur - 1)) this.d.pauses += 1;
      void this.flush(false);
    });
    this.on("seeking", () => {
      this.seekingFromUser = true;
    });
    this.on("seeked", () => {
      if (this.seekingFromUser) this.d.seeks += 1;
      this.seekingFromUser = false;
      this.lastTime = this.media?.currentTime ?? null;
    });
    this.on("waiting", () => {
      if (this.playing && this.bufferingSince == null) {
        this.d.buffers += 1;
        this.bufferingSince = Date.now();
      }
    });
    this.on("ratechange", () => {
      this.rate = this.media?.playbackRate ?? 1;
    });
    this.on("ended", () => {
      this.ended = true;
      this.playing = false;
      void this.flush(false);
    });
    this.on("timeupdate", () => {
      const t = this.media?.currentTime;
      if (typeof t !== "number") return;
      if (this.media?.duration) this.duration = this.media.duration;
      if (this.media?.videoHeight) this.quality = Math.max(this.quality, this.media.videoHeight);
      if (t > this.maxPosition) this.maxPosition = t;
      if (this.playing && this.lastTime != null) {
        const delta = t - this.lastTime;
        // Ignore jumps (seeks) and clock oddities; real ticks are ~0.25s.
        if (delta > 0 && delta <= 2) {
          const wall = delta / (this.rate || 1);
          this.d.watchSec += wall;
          this.d.estBytes += (wall * bitrateForHeight(this.quality)) / 8;
        }
      }
      this.lastTime = t;
    });
  }

  private onHide = () => {
    if (document.visibilityState === "hidden") void this.flush(true);
  };

  private snapshot(): VideoDelta {
    return {
      sessionId: this.sessionId,
      first: this.first,
      ...this.ctx,
      watchSec: Math.round(this.d.watchSec),
      plays: this.d.plays,
      pauses: this.d.pauses,
      seeks: this.d.seeks,
      buffers: this.d.buffers,
      bufferSec: Math.round(this.d.bufferSec),
      estBytes: Math.round(this.d.estBytes),
      maxPositionSec: Math.round(this.maxPosition),
      durationSec: Math.round(this.duration),
      qualityHeight: this.quality,
      playbackRate: this.rate,
      ended: this.ended,
      device: deviceKind(),
      connection: connectionKind(),
    };
  }

  private hasData() {
    const d = this.d;
    return this.first || d.watchSec >= 1 || d.plays || d.pauses || d.seeks || d.buffers || this.ended;
  }

  async flush(beacon: boolean) {
    if (!this.hasData()) return;
    const payload = this.snapshot();
    this.d = { watchSec: 0, plays: 0, pauses: 0, seeks: 0, buffers: 0, bufferSec: 0, estBytes: 0 };
    this.first = false;
    try {
      const token = await this.getToken();
      const body = JSON.stringify({ ...payload, token });
      if (beacon && "sendBeacon" in navigator) {
        navigator.sendBeacon("/api/analytics/video", new Blob([body], { type: "application/json" }));
      } else {
        await fetch("/api/analytics/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    } catch {
      /* best effort */
    }
  }

  detach() {
    this.stopped = true;
    if (this.timer) window.clearInterval(this.timer);
    document.removeEventListener("visibilitychange", this.onHide);
    window.removeEventListener("pagehide", this.onHide);
    for (const [type, fn] of this.handlers) this.media?.removeEventListener?.(type, fn);
    this.handlers = [];
    void this.flush(true);
  }
}
