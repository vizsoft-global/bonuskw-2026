"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HomeIcon } from "@/components/home/icon";
import { useI18n } from "@/lib/i18n/locale";
import { markSeen } from "@/lib/stories/seen";
import { VIDEO_CAP_MS, storyKey, storySegments, storyThumb, type StorySegment } from "@/lib/stories/media";
import { FileThumb } from "@/components/course/outline";
import type { ResourceKind } from "@/lib/course/resource-kind";
import type { SettingsStory } from "@/lib/types/firestore";

export function StoryViewer({
  stories,
  startIndex,
  onClose,
}: {
  stories: SettingsStory[];
  startIndex: number;
  /**
   * When set, the viewer is embedded as an overlay on the current page:
   * closing calls back instead of navigating and the URL is left alone.
   */
  onClose?: () => void;
}) {
  const router = useRouter();
  const embedded = Boolean(onClose);
  const { t } = useI18n();
  const [storyIndex, setStoryIndex] = useState(() => clamp(startIndex, stories.length));
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [muted, setMuted] = useState(true);
  const [epoch, setEpoch] = useState(0);
  const progressRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pressRef = useRef<{ t: number; x: number } | null>(null);
  const nextRef = useRef<() => void>(() => {});
  const advancingRef = useRef(false);

  const story = stories[storyIndex];
  const segments = story ? storySegments(story) : [];
  const segment = segments[segmentIndex] as StorySegment | undefined;
  const paused = held || hidden;
  const courseId = story?.linkedRef?.id;

  const close = useCallback(() => {
    if (onClose) onClose();
    else router.push("/");
  }, [onClose, router]);

  const goNext = useCallback(() => {
    const segs = story ? storySegments(story) : [];
    if (segmentIndex + 1 < segs.length) {
      setSegmentIndex((n) => n + 1);
      return;
    }
    if (storyIndex + 1 < stories.length) {
      setStoryIndex((n) => n + 1);
      setSegmentIndex(0);
      return;
    }
    close();
  }, [close, segmentIndex, stories.length, story, storyIndex]);

  const goPrev = useCallback(() => {
    if (segmentIndex > 0) {
      setSegmentIndex((n) => n - 1);
      return;
    }
    if (storyIndex > 0) {
      const prev = stories[storyIndex - 1];
      setStoryIndex(storyIndex - 1);
      setSegmentIndex(Math.max(0, storySegments(prev).length - 1));
      return;
    }
    progressRef.current = 0;
    setProgress(0);
    const el = videoRef.current;
    if (el) el.currentTime = 0;
    setEpoch((n) => n + 1);
  }, [segmentIndex, stories, storyIndex]);

  nextRef.current = goNext;

  function advance() {
    if (advancingRef.current) return;
    advancingRef.current = true;
    goNext();
  }

  useEffect(() => {
    setStoryIndex(clamp(startIndex, stories.length));
    setSegmentIndex(0);
  }, [startIndex, stories.length]);

  useEffect(() => {
    if (!story) return;
    markSeen(storyKey(story, storyIndex));
    if (!embedded) window.history.replaceState(null, "", `/stories?i=${storyIndex}`);
  }, [embedded, story, storyIndex]);

  useEffect(() => {
    advancingRef.current = false;
    progressRef.current = 0;
    setProgress(0);
    const el = videoRef.current;
    if (el) el.currentTime = 0;
  }, [storyIndex, segmentIndex]);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, goNext, goPrev]);

  useEffect(() => {
    // Images and files run on the story's own timer; video and audio follow playback.
    if (paused || !segment || (segment.kind !== "image" && segment.kind !== "file")) return;
    const durationMs = segment.durationMs;
    const origin = performance.now() - progressRef.current * durationMs;
    let raf = 0;
    let done = false;
    const tick = (now: number) => {
      if (done) return;
      const p = Math.min(1, (now - origin) / durationMs);
      progressRef.current = p;
      setProgress(p);
      if (p >= 1) {
        done = true;
        advance();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      done = true;
      cancelAnimationFrame(raf);
    };
  }, [paused, segment, storyIndex, segmentIndex, epoch]);

  useEffect(() => {
    if (segment?.kind === "video") {
      const el = videoRef.current;
      if (!el) return;
      el.muted = muted;
      if (paused) el.pause();
      else void el.play().catch(() => {});
      return;
    }
    if (segment?.kind === "audio") {
      const el = audioRef.current;
      if (!el) return;
      if (paused) el.pause();
      else void el.play().catch(() => {});
    }
  }, [muted, paused, segment, storyIndex, segmentIndex]);

  useEffect(() => {
    const nextStory = stories[storyIndex];
    const nextSegs = nextStory ? storySegments(nextStory) : [];
    const upcoming = nextSegs[segmentIndex + 1] || storySegments(stories[storyIndex + 1] ?? {})[0];
    if (upcoming?.kind === "image") {
      const img = new Image();
      img.src = upcoming.url;
    }
  }, [segmentIndex, stories, storyIndex]);

  function onMediaTime(el: HTMLMediaElement | null) {
    if (!el || !segment) return;
    // Audio uses the story duration; video runs to its own length, capped.
    const capSec =
      segment.kind === "video"
        ? Math.min(el.duration && Number.isFinite(el.duration) ? el.duration : VIDEO_CAP_MS / 1000, VIDEO_CAP_MS / 1000)
        : Math.min(el.duration && Number.isFinite(el.duration) ? el.duration : segment.durationMs / 1000, segment.durationMs / 1000);
    const p = capSec ? Math.min(1, el.currentTime / capSec) : 0;
    progressRef.current = p;
    setProgress(p);
    if (el.currentTime >= capSec) advance();
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    pressRef.current = { t: Date.now(), x: e.clientX };
    setHeld(true);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const press = pressRef.current;
    pressRef.current = null;
    setHeld(false);
    if (!press || Date.now() - press.t >= 250) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (press.x - rect.left < rect.width / 2) goPrev();
    else goNext();
  }

  if (!story || !segment) {
    if (embedded) {
      close();
      return null;
    }
    return (
      <main className="grid min-h-dvh place-items-center bg-[#050505] text-[#999]">
        {t("empty")}
      </main>
    );
  }

  return (
    <div
      className={
        embedded
          ? "fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/90 text-[#fafafa] backdrop-blur-sm"
          : "relative min-h-dvh overflow-clip bg-[#050505] text-[#fafafa]"
      }
      onClick={embedded ? (e) => e.target === e.currentTarget && close() : undefined}
      role={embedded ? "dialog" : undefined}
      aria-modal={embedded ? true : undefined}
    >
      {!embedded ? (
        <>
          <div className="pointer-events-none absolute -end-16 -top-24 hidden h-[162px] w-[483px] overflow-hidden lg:block">
            <HomeIcon src="/home/glow.svg" />
          </div>
          <div className="hidden h-[81px] shrink-0 lg:block" />
        </>
      ) : null}
      <div
        className={
          embedded
            ? "flex w-full flex-col items-center px-[15px] py-[24px] lg:px-0"
            : "flex flex-col items-center px-[15px] pt-safe-header lg:px-0 lg:pt-0"
        }
      >
        <div className="flex w-full max-w-[384px] flex-col items-center gap-[15px] lg:gap-[25px]">
          <header className="flex w-full items-center justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 pe-[50px]">
              <span className="size-[55px] shrink-0 overflow-hidden rounded-full border-[0.5px] border-white/20 bg-[#141414]">
                {storyThumb(story) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={storyThumb(story)} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              <p className="min-w-0 truncate text-[16px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                {story.title || t("story")}
              </p>
            </div>
            <button type="button" aria-label={t("close")} onClick={close} className="grid size-10 shrink-0 place-items-center">
              <span className="size-3.5">
                <HomeIcon src="/story/close.svg" />
              </span>
            </button>
          </header>

          <div
            className="relative h-[min(643px,calc(100dvh-220px))] w-full touch-none select-none overflow-hidden rounded-[12px] border-[0.5px] border-white/20 bg-[#1d1d1d] lg:h-[643px]"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              pressRef.current = null;
              setHeld(false);
            }}
          >
            <div className="absolute inset-x-2.5 top-2.5 z-20 flex gap-1">
              {segments.map((_, i) => (
                <span key={i} className="h-0.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/30">
                  <span
                    className="block h-full rounded-full bg-white"
                    style={{
                      width: i < segmentIndex ? "100%" : i === segmentIndex ? `${progress * 100}%` : "0%",
                    }}
                  />
                </span>
              ))}
            </div>

            {segment.kind === "video" ? (
              <video
                ref={videoRef}
                key={segment.url}
                src={segment.url}
                poster={segment.poster}
                playsInline
                muted={muted}
                className="h-full w-full object-cover"
                onTimeUpdate={() => onMediaTime(videoRef.current)}
                onEnded={() => advance()}
              />
            ) : segment.kind === "audio" ? (
              <div className="relative h-full w-full">
                {segment.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={segment.poster} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-b from-[#1d1d1d] to-[#050505]" />
                )}
                <audio
                  ref={audioRef}
                  key={segment.url}
                  src={segment.url}
                  onTimeUpdate={() => onMediaTime(audioRef.current)}
                  onEnded={() => advance()}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
                  <span className="rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-medium text-white">
                    {segment.name || t("story")}
                  </span>
                </div>
              </div>
            ) : segment.kind === "file" ? (
              <div className="relative h-full w-full">
                {segment.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={segment.poster} alt="" className="h-full w-full object-cover opacity-60" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-b from-[#1d1d1d] to-[#050505]" />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
                  <FileThumb kind={fileKind(segment)} className="h-24 w-32" />
                  <p className="line-clamp-2 text-center text-[14px] font-medium text-white">
                    {segment.name || t("story")}
                  </p>
                  <a
                    href={segment.url}
                    target="_blank"
                    rel="noreferrer"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black"
                  >
                    {t("download")}
                  </a>
                </div>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={segment.url} alt="" className="h-full w-full object-cover" />
            )}

            {story.description?.trim() ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-12">
                <p className="line-clamp-4 whitespace-pre-line text-[14px] leading-5 text-white drop-shadow">
                  {story.description.trim()}
                </p>
              </div>
            ) : null}

            {segment.kind === "video" ? (
              <button
                type="button"
                aria-label={muted ? t("unmute") : t("mute")}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setMuted((m) => !m);
                }}
                className="absolute bottom-3 end-3 z-20 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white"
              >
                {muted ? t("unmute") : t("mute")}
              </button>
            ) : null}
          </div>

          {courseId ? (
            <Link
              href={`/course/${courseId}`}
              className="flex items-center gap-[3px] px-2.5 py-2 text-[12px] font-medium text-white"
            >
              {t("learnMore")}
              <span className="size-3.5 rtl:-scale-x-100">
                <HomeIcon src="/story/chevron.svg" />
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function fileKind(segment: StorySegment): ResourceKind {
  const name = `${segment.name ?? ""} ${segment.url}`.toLowerCase();
  if (/\.pdf(\?|$)/.test(name)) return "pdf";
  return "file";
}

function clamp(index: number, length: number) {
  if (!length) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(0, Math.floor(index)), length - 1);
}
