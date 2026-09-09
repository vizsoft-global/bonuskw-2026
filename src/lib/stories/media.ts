import { asDate } from "@/lib/format";
import type { SettingsStory, StoryMedia } from "@/lib/types/firestore";

/** Fallback when a story has no duration of its own. */
export const STORY_MS = 10_000;
/** Videos never run past this even if the file is longer. */
export const VIDEO_CAP_MS = 60_000;

export type StorySegmentKind = "image" | "video" | "audio" | "file";

export type StorySegment = {
  url: string;
  kind: StorySegmentKind;
  /** How long the segment stays on screen (images/audio/files). */
  durationMs: number;
  /** Background for audio and file segments. */
  poster?: string;
  name?: string;
};

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const AUDIO_RE = /\.(mp3|wav|m4a|aac|ogg)(\?|#|$)/i;
const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i;
const INACTIVE = new Set(["deactive", "inactive", "disabled", "off", "hidden"]);

export function isVideoUrl(url: string, type?: string) {
  if (type && /video/i.test(type)) return true;
  return VIDEO_RE.test(url);
}

function kindOf(url: string, type?: string): StorySegmentKind {
  const t = (type ?? "").toLowerCase();
  if (t === "video" || t === "audio" || t === "file" || t === "image") return t;
  if (VIDEO_RE.test(url)) return "video";
  if (AUDIO_RE.test(url)) return "audio";
  if (IMAGE_RE.test(url) || !t) return "image";
  return "file";
}

function pushUrl(
  out: StorySegment[],
  url: unknown,
  opts: { type?: string; durationSec?: number; poster?: string; name?: string; storyDefault: number },
) {
  if (typeof url !== "string") return;
  const next = url.trim();
  if (!next || out.some((seg) => seg.url === next)) return;
  const kind = kindOf(next, opts.type);
  const seconds = opts.durationSec ?? opts.storyDefault;
  out.push({
    url: next,
    kind,
    durationMs: Math.max(1000, (seconds > 0 ? seconds : STORY_MS / 1000) * 1000),
    poster: opts.poster,
    name: opts.name,
  });
}

export function storySegments(story: SettingsStory): StorySegment[] {
  const out: StorySegment[] = [];
  const storyDefault = Number(story.durationSec) > 0 ? Number(story.durationSec) : STORY_MS / 1000;
  const poster = story.image;
  if (Array.isArray(story.media)) {
    for (const item of story.media) {
      if (typeof item === "string") pushUrl(out, item, { storyDefault });
      else if (item && typeof item === "object") {
        const m = item as StoryMedia;
        pushUrl(out, m.url, {
          type: m.type ?? m.kind,
          durationSec: m.durationSec,
          poster: m.poster ?? poster,
          name: m.name,
          storyDefault,
        });
      }
    }
  }
  if (Array.isArray(story.images)) story.images.forEach((url) => pushUrl(out, url, { storyDefault }));
  if (Array.isArray(story.videos)) story.videos.forEach((url) => pushUrl(out, url, { type: "video", storyDefault, poster }));
  pushUrl(out, story.video_url, { type: "video", storyDefault, poster });
  pushUrl(out, story.video, { type: "video", storyDefault, poster });
  // The cover doubles as the media only for image stories.
  if (out.length === 0 || (story.type ?? "image") === "image") {
    pushUrl(out, story.image, { type: story.type === "image" || !story.type ? "image" : story.type, storyDefault });
  }
  return out;
}

export function storyThumb(story: SettingsStory) {
  if (story.image) return story.image;
  const first = storySegments(story)[0];
  return first?.kind === "image" ? first.url : first?.poster || "";
}

export function storyKey(story: SettingsStory, index: number) {
  return story.id || story.title || story.image || storyThumb(story) || String(index);
}

export function isStoryActive(story: SettingsStory) {
  const status = String(story.status || "").toLowerCase();
  if (status && INACTIVE.has(status)) return false;
  const now = Date.now();
  const start = asDate(story.startDate);
  const end = asDate(story.endDate);
  if (start && start.getTime() > now) return false;
  if (end && end.getTime() < now) return false;
  return storySegments(story).length > 0;
}
