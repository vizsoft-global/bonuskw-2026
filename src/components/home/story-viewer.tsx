"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HomeIcon } from "@/components/home/icon";
import { useI18n } from "@/lib/i18n/locale";
import { markSeen } from "@/lib/stories/seen";
import { STORY_MS, storyKey, storySegments, storyThumb, type StorySegment } from "@/lib/stories/media";
import type { SettingsStory } from "@/lib/types/firestore";

export function StoryViewer({ stories, startIndex }: { stories: SettingsStory[]; startIndex: number }) {
  const router = useRouter();
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
  const pressRef = useRef<{ t: number; x: number } | null>(null);
  const nextRef = useRef<() => void>(() => {});
  const advancingRef = useRef(false);

  const story = stories[storyIndex];
  const segments = story ? storySegments(story) : [];
  const segment = segments[segmentIndex] as StorySegment | undefined;
  const paused = held || hidden;
  const courseId = story?.linkedRef?.id;

  const close = useCallback(() => router.push("/"), [router]);

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
    window.history.replaceState(null, "", `/stories?i=${storyIndex}`);
  }, [story, storyIndex]);

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
    if (paused || !segment || segment.kind !== "image") return;
    const origin = performance.now() - progressRef.current * STORY_MS;
    let raf = 0;
    let done = false;
    const tick = (now: number) => {
      if (done) return;
      const p = Math.min(1, (now - origin) / STORY_MS);
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
    const el = videoRef.current;
    if (!el || segment?.kind !== "video") return;
    el.muted = muted;
    if (paused) el.pause();
    else void el.play().catch(() => {});
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

  function onVideoTime() {
    const el = videoRef.current;
    if (!el) return;
    const cap = Math.min(el.duration && Number.isFinite(el.duration) ? el.duration : 30, 30);
    const p = cap ? Math.min(1, el.currentTime / cap) : 0;
    progressRef.current = p;
    setProgress(p);
    if (el.currentTime >= 30) advance();
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
    return (
      <main className="grid min-h-dvh place-items-center bg-[#050505] text-[#999]">
        {t("empty")}
      </main>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-clip bg-[#050505] text-[#fafafa]">
      <div className="pointer-events-none absolute -end-16 -top-24 hidden h-[162px] w-[483px] overflow-hidden lg:block">
        <HomeIcon src="/home/glow.svg" />
      </div>
      <div className="hidden h-[81px] shrink-0 lg:block" />
      <div className="flex flex-col items-center px-[15px] pt-[60px] lg:px-0 lg:pt-0">
        <div className="flex w-full max-w-[384px] flex-col items-center gap-[15px] lg:gap-[25px]">
          <header className="flex w-full items-center justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 pe-[50px]">
              <span className="size-[55px] shrink-0 overflow-hidden rounded-full border-[0.5px] border-white/20 bg-[#141414]">
                {storyThumb(story) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={storyThumb(story)} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              <p className="min-w-0 truncate text-[16px] font-semibold text-[#fafafa]">
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
                playsInline
                muted={muted}
                className="h-full w-full object-cover"
                onTimeUpdate={onVideoTime}
                onEnded={() => advance()}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={segment.url} alt="" className="h-full w-full object-cover" />
            )}

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

function clamp(index: number, length: number) {
  if (!length) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(0, Math.floor(index)), length - 1);
}
