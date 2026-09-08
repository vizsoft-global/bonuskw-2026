import { asDate } from "@/lib/format";
import type { SettingsStory } from "@/lib/types/firestore";

export const STORY_MS = 30_000;

export type StorySegment = {
  url: string;
  kind: "image" | "video";
};

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const INACTIVE = new Set(["deactive", "inactive", "disabled", "off", "hidden"]);

export function isVideoUrl(url: string, type?: string) {
  if (type && /video/i.test(type)) return true;
  return VIDEO_RE.test(url);
}

function pushUrl(out: StorySegment[], url: unknown, type?: string) {
  if (typeof url !== "string") return;
  const next = url.trim();
  if (!next || out.some((seg) => seg.url === next)) return;
  out.push({ url: next, kind: isVideoUrl(next, type) ? "video" : "image" });
}

export function storySegments(story: SettingsStory): StorySegment[] {
  const out: StorySegment[] = [];
  if (Array.isArray(story.media)) {
    for (const item of story.media) {
      if (typeof item === "string") pushUrl(out, item);
      else if (item && typeof item === "object") pushUrl(out, item.url, item.type);
    }
  }
  if (Array.isArray(story.images)) story.images.forEach((url) => pushUrl(out, url));
  if (Array.isArray(story.videos)) story.videos.forEach((url) => pushUrl(out, url, "video"));
  pushUrl(out, story.video, "video");
  pushUrl(out, story.image, story.type);
  return out;
}

export function storyThumb(story: SettingsStory) {
  return storySegments(story)[0]?.url || story.image || "";
}

export function storyKey(story: SettingsStory, index: number) {
  return story.title || story.image || storyThumb(story) || String(index);
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
