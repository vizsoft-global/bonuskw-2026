"use client";

import { useMemo, useState } from "react";
import { HomeIcon } from "@/components/home/icon";
import { FileThumb } from "@/components/course/outline";
import { formatBytes } from "@/lib/course/resource-kind";
import type { OutlineFile, OutlineItem, OutlineLesson } from "@/lib/course/outline";
import { cn } from "@/lib/utils";

export type LearnLabels = {
  currentlyPlaying: string;
  nextLessons: string;
  resources: string;
  download: string;
  test: string;
  tests: string;
  questions: string;
  minShort: string;
};

function mins(duration: number, minShort: string) {
  const m = Number.isFinite(duration) && duration > 0 ? Math.max(1, Math.round(duration / 60)) : 0;
  return `${m} ${minShort}`;
}

/** Thumb with a centered play button for unlocked videos. */
function LessonThumb({ thumb, locked, active }: { thumb?: string; locked: boolean; active: boolean }) {
  return (
    <span className="relative block h-[55px] w-[82px] shrink-0 overflow-hidden rounded-[12px] border-[0.5px] border-white/25 bg-[#252525]">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : null}
      {locked ? <span className="absolute inset-0 bg-black/45" /> : null}
      {!locked && !active ? (
        <span className="absolute inset-0 grid place-items-center">
          <span className="size-[18px]">
            <HomeIcon src="/course/play.svg" />
          </span>
        </span>
      ) : null}
    </span>
  );
}

/** Animated equalizer shown on the lesson that is playing now. */
function Equalizer() {
  return (
    <span className="flex h-[18px] shrink-0 items-end gap-[2.5px]" aria-hidden>
      {[10, 18, 13, 7].map((h, i) => (
        <span
          key={i}
          className="w-[3px] animate-pulse rounded-full bg-[#f6360b]"
          style={{ height: h, animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  );
}

function LockDot() {
  return (
    <span className="size-3.5 shrink-0 opacity-70">
      <HomeIcon src="/course/lock.svg" />
    </span>
  );
}

function LessonRow({
  lesson,
  thumb,
  active,
  minShort,
  onOpen,
}: {
  lesson: OutlineLesson;
  thumb?: string;
  active: boolean;
  minShort: string;
  onOpen?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={lesson.locked || !onOpen}
      onClick={onOpen}
      className={cn(
        "flex w-full items-center gap-[15px] border-b border-white/10 py-[15px] pe-[10px] text-start disabled:cursor-default",
        active && "rounded-[8px] bg-white/[0.05]",
      )}
    >
      <LessonThumb thumb={thumb} locked={lesson.locked} active={active} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-[#fafafa]">{lesson.name}</span>
        <span className="mt-[7px] flex items-center gap-[5px] text-[12px] text-[#999]">
          <span className="size-3 shrink-0">
            <HomeIcon src="/course/clock.svg" />
          </span>
          {mins(lesson.videoDuration, minShort)}
        </span>
      </span>
      {lesson.locked ? <LockDot /> : active ? <Equalizer /> : null}
    </button>
  );
}

/**
 * Post-purchase lesson rail: the playing lesson on top, then Next Lessons /
 * Resources tabs with chapter-grouped rows that carry real thumbnails.
 * Locks stay a tiny icon at the row's end, never an overlay.
 */
export function LearnAside({
  items,
  activeLessonId,
  activeQuizId,
  current,
  labels,
  onLesson,
  onQuiz,
}: {
  items: OutlineItem[];
  activeLessonId?: string;
  activeQuizId?: string;
  /** What's on the player now: poster, title, duration seconds. */
  current: { thumb?: string; title: string; duration: number } | null;
  labels: LearnLabels;
  onLesson?: (lessonId: string) => void;
  onQuiz?: (quizId: string) => void;
}) {
  const [tab, setTab] = useState<"lessons" | "resources">("lessons");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const chapters = useMemo(() => items.filter((i) => i.kind === "chapter"), [items]);
  const quizzes = useMemo(() => items.filter((i) => i.kind === "quiz"), [items]);
  const files = useMemo(() => {
    const rows: Array<OutlineFile & { lessonName?: string }> = [];
    for (const item of items) {
      if (item.kind === "chapter") {
        for (const lesson of item.lessons) {
          for (const file of lesson.files) rows.push({ ...file, lessonName: lesson.name });
        }
      } else if (item.kind === "file") {
        rows.push(item.file);
      }
    }
    return rows;
  }, [items]);

  return (
    <div>
      {current ? (
        <div className="px-[15px] pt-[10px]">
          <p className="text-[14px] font-medium text-[#999]">{labels.currentlyPlaying}</p>
          <div className="mt-[10px] flex items-center justify-between gap-[10px] rounded-[12px] bg-[#141414] py-[5px] pe-[20px] ps-[5px]">
            <div className="flex min-w-0 flex-1 items-center gap-[10px]">
              <LessonThumb thumb={current.thumb} locked={false} active />
              <div className="min-w-0 flex-1 pt-[5px]">
                <p className="truncate text-[12px] font-medium text-[#fafafa]">{current.title}</p>
                <p className="mt-[7px] flex items-center gap-[5px] text-[12px] text-[#999]">
                  <span className="size-3 shrink-0">
                    <HomeIcon src="/course/clock.svg" />
                  </span>
                  {mins(current.duration, labels.minShort)}
                </p>
              </div>
            </div>
            <Equalizer />
          </div>
        </div>
      ) : null}

      <div className="mt-[10px] flex items-center gap-[15px] border-b border-white/20 px-[15px]">
        {(
          [
            ["lessons", labels.nextLessons],
            ["resources", labels.resources],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-[5px] px-[5px] py-[10px] text-[12px]",
              tab === key ? "border-b border-[#fafafa] font-medium text-[#fafafa]" : "text-[#fafafa] opacity-60",
            )}
          >
            {label}
            {key === "resources" ? (
              <span className="rounded-[6px] bg-[#141414] px-2 py-0.5 text-[10px] font-medium text-[#fafafa]">
                {files.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "lessons" ? (
        <div className="px-[15px]">
          {chapters.map((chapter) => (
            <div key={chapter.id}>
              <button
                type="button"
                onClick={() => setCollapsed((prev) => ({ ...prev, [chapter.id]: !prev[chapter.id] }))}
                className="flex w-full items-center justify-between gap-3 py-[15px] text-start"
              >
                <span className="min-w-0 truncate text-[13px] font-medium text-[#fafafa]">{chapter.name}</span>
                <span className={cn("size-3.5 shrink-0 transition-transform", collapsed[chapter.id] && "-rotate-90")}>
                  <HomeIcon src="/course/chevron.svg" />
                </span>
              </button>
              {collapsed[chapter.id] ? null : (
                <div>
                  {chapter.lessons.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      thumb={lesson.image || lesson.poster}
                      active={lesson.id === activeLessonId}
                      minShort={labels.minShort}
                      onOpen={onLesson ? () => onLesson(lesson.id) : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          {quizzes.length ? (
            <div className="pt-2">
              <p className="py-2 text-[13px] font-medium text-[#fafafa]">{labels.tests}</p>
              {quizzes.map((quiz, i) => (
                <button
                  key={quiz.id}
                  type="button"
                  disabled={quiz.locked || !onQuiz}
                  onClick={onQuiz ? () => onQuiz(quiz.id) : undefined}
                  className="flex w-full items-center gap-3 border-b border-white/10 py-3 text-start disabled:cursor-default"
                >
                  <span className="grid h-[55px] w-[82px] shrink-0 place-items-center rounded-[12px] bg-[#0c5eff]/15 text-[11px] font-bold text-[#0c5eff]">
                    {labels.test} {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-[#fafafa]">{quiz.name}</span>
                    <span className="mt-[7px] block text-[12px] text-[#999]">
                      {quiz.questionCount} {labels.questions}
                    </span>
                  </span>
                  {quiz.locked ? <LockDot /> : quiz.id === activeQuizId ? <Equalizer /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="px-[15px] py-2">
          {files.length ? (
            files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 border-b border-white/10 py-3">
                <FileThumb kind={file.kind} className="h-10 w-14 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-[#fafafa]">{file.name}</span>
                  <span className="mt-1 block text-[11px] text-[#999]">
                    {file.bytes ? `${formatBytes(file.bytes)} · ` : ""}
                    {file.lessonName ?? labels.resources}
                  </span>
                </span>
                {file.locked ? (
                  <LockDot />
                ) : (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 rounded-full border border-white/20 px-3.5 py-1.5 text-[12px] font-medium text-[#fafafa]"
                  >
                    {labels.download}
                  </a>
                )}
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-[12px] text-[#999]">—</p>
          )}
        </div>
      )}
    </div>
  );
}
