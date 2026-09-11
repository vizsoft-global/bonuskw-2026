"use client";

import { useMemo, useState } from "react";
import { HomeIcon } from "@/components/home/icon";
import { FileThumb } from "@/components/course/outline";
import type { OutlineFile, OutlineItem, OutlineLesson } from "@/lib/course/outline";
import { cn } from "@/lib/utils";

export type LearnLabels = {
  currentlyPlaying: string;
  nextLessons: string;
  lessons: string;
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

function DurationLine({ duration, minShort }: { duration: number; minShort: string }) {
  return (
    <span className="mt-1 flex items-center gap-1 text-[10px] text-[#999]">
      <span className="size-3 shrink-0">
        <HomeIcon src="/course/clock.svg" />
      </span>
      {mins(duration, minShort)}
    </span>
  );
}

/** One attachment on its lesson card: downloads in place, no extra tab. */
function CardFileButton({ file, downloadLabel }: { file: OutlineFile; downloadLabel: string }) {
  if (file.locked) {
    return (
      <span className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-medium text-[#666]">
        <span className="size-3 shrink-0 opacity-70">
          <HomeIcon src="/course/lock.svg" />
        </span>
        <span className="min-w-0 flex-1 truncate text-start">{file.name}</span>
      </span>
    );
  }
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      download
      onClick={(e) => e.stopPropagation()}
      title={file.name}
      className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-[#0c5eff]/50 bg-[#0c5eff]/10 px-2 py-1 text-[10px] font-medium text-[#fafafa] transition active:scale-[0.98]"
    >
      <FileThumb kind={file.kind} className="h-4 w-6 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-start">{file.name}</span>
      <span className="shrink-0 text-[#7aa5ff]">{downloadLabel}</span>
    </a>
  );
}

function LessonCard({
  lesson,
  thumb,
  active,
  minShort,
  downloadLabel,
  onOpen,
}: {
  lesson: OutlineLesson;
  thumb?: string;
  active: boolean;
  minShort: string;
  downloadLabel: string;
  onOpen?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-[12px] border border-white/10 bg-[#141414]",
        active && "border-[#0c5eff]/60 ring-1 ring-[#0c5eff]/40",
      )}
    >
      <button
        type="button"
        disabled={lesson.locked || !onOpen}
        onClick={onOpen}
        className="group block w-full text-start disabled:cursor-default"
      >
        <span className="relative block aspect-video w-full overflow-hidden bg-[#252525]">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center">
              <span className="size-6 opacity-60">
                <HomeIcon src="/course/play.svg" />
              </span>
            </span>
          )}
          {lesson.locked ? <span className="absolute inset-0 bg-black/45" /> : null}
          {lesson.locked ? (
            <span className="absolute end-1.5 top-1.5 rounded-full bg-black/70 p-1" title="Locked">
              <span className="block size-3">
                <HomeIcon src="/course/lock.svg" />
              </span>
            </span>
          ) : active ? (
            <span className="absolute end-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-1">
              <Equalizer />
            </span>
          ) : (
            <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
              <span className="size-6 rounded-full bg-black/60 p-1">
                <HomeIcon src="/course/play.svg" />
              </span>
            </span>
          )}
        </span>
        <span className="block p-2">
          <span className="block truncate text-[11px] font-medium leading-4 text-[#fafafa]" title={lesson.name}>
            {lesson.name}
          </span>
          <DurationLine duration={lesson.videoDuration} minShort={minShort} />
        </span>
      </button>
      {lesson.files.length ? (
        <span className="block px-2 pb-2">
          {lesson.files.map((file) => (
            <CardFileButton key={file.id} file={file} downloadLabel={downloadLabel} />
          ))}
        </span>
      ) : null}
    </div>
  );
}

function QuizCard({
  name,
  index,
  questionCount,
  questionsLabel,
  testLabel,
  locked,
  active,
  onOpen,
}: {
  name: string;
  index: number;
  questionCount: number;
  questionsLabel: string;
  testLabel: string;
  locked: boolean;
  active: boolean;
  onOpen?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={locked || !onOpen}
      onClick={onOpen}
      className={cn(
        "flex flex-col overflow-hidden rounded-[12px] border border-white/10 bg-[#141414] text-start disabled:cursor-default",
        active && "border-[#0c5eff]/60 ring-1 ring-[#0c5eff]/40",
      )}
    >
      <span className="relative grid aspect-video w-full place-items-center bg-[#0c5eff]/15 text-[11px] font-bold text-[#0c5eff]">
        {testLabel} {index + 1}
        {locked ? (
          <span className="absolute end-1.5 top-1.5 rounded-full bg-black/70 p-1">
            <span className="block size-3">
              <HomeIcon src="/course/lock.svg" />
            </span>
          </span>
        ) : null}
        {active ? (
          <span className="absolute end-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-1">
            <Equalizer />
          </span>
        ) : null}
      </span>
      <span className="block p-2">
        <span className="block truncate text-[11px] font-medium leading-4 text-[#fafafa]" title={name}>
          {name}
        </span>
        <span className="mt-1 block text-[10px] text-[#999]">
          {questionCount} {questionsLabel}
        </span>
      </span>
    </button>
  );
}

/**
 * One chapter as a visually distinct group: every video and file inside
 * belongs to this chapter, and the grid beneath holds its lessons as cards.
 */
function ChapterGroup({
  id,
  name,
  locked,
  lessonCount,
  lessonsLabel,
  children,
}: {
  id: string;
  name: string;
  locked: boolean;
  lessonCount: number;
  lessonsLabel: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section aria-label={name} className="rounded-[16px] border border-white/10 bg-white/[0.03] p-2.5">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center gap-2 px-1 pb-2 pt-1 text-start"
      >
        {locked ? (
          <span className="size-3.5 shrink-0 opacity-70">
            <HomeIcon src="/course/lock.svg" />
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#fafafa]">{name}</span>
        <span className="shrink-0 text-[10px] text-[#999]">
          {lessonCount} {lessonsLabel}
        </span>
        <span className={cn("size-3.5 shrink-0 transition-transform", collapsed && "-rotate-90")}>
          <HomeIcon src="/course/chevron.svg" />
        </span>
      </button>
      {collapsed ? null : (
        <div key={id} className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * Post-purchase lesson rail: the playing lesson on top, then chapter groups
 * whose lessons render as compact cards (thumbnail, title, runtime, inline
 * PDF downloads, lock badge on the card's top corner).
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
  const chapters = useMemo(() => items.filter((i) => i.kind === "chapter"), [items]);
  const quizzes = useMemo(() => items.filter((i) => i.kind === "quiz"), [items]);

  return (
    <div>
      {current ? (
        <div className="px-[15px] pt-[10px]">
          <p className="text-[14px] font-medium text-[#999]">{labels.currentlyPlaying}</p>
          <div className="mt-[10px] flex items-center justify-between gap-[10px] rounded-[12px] bg-[#141414] py-[5px] pe-[20px] ps-[5px]">
            <div className="flex min-w-0 flex-1 items-center gap-[10px]">
              <span className="relative block h-[55px] w-[82px] shrink-0 overflow-hidden rounded-[12px] border-[0.5px] border-white/25 bg-[#252525]">
                {current.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : null}
              </span>
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

      <div className="px-[15px] pb-[15px] pt-[10px]">
        <p className="pb-2 text-[12px] font-semibold text-[#fafafa]">{labels.nextLessons}</p>
        <div className="flex flex-col gap-2.5">
          {chapters.map((chapter) => (
            <ChapterGroup
              key={chapter.id}
              id={chapter.id}
              name={chapter.name}
              locked={chapter.locked}
              lessonCount={chapter.lessons.length}
              lessonsLabel={labels.lessons}
            >
              {chapter.lessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  thumb={lesson.image || lesson.poster}
                  active={lesson.id === activeLessonId}
                  minShort={labels.minShort}
                  downloadLabel={labels.download}
                  onOpen={onLesson ? () => onLesson(lesson.id) : undefined}
                />
              ))}
            </ChapterGroup>
          ))}
          {quizzes.length ? (
            <ChapterGroup
              id="tests"
              name={labels.tests}
              locked={false}
              lessonCount={quizzes.length}
              lessonsLabel={labels.tests}
            >
              {quizzes.map((quiz, i) => (
                <QuizCard
                  key={quiz.id}
                  name={quiz.name}
                  index={i}
                  questionCount={quiz.questionCount}
                  questionsLabel={labels.questions}
                  testLabel={labels.test}
                  locked={quiz.locked}
                  active={quiz.id === activeQuizId}
                  onOpen={onQuiz ? () => onQuiz(quiz.id) : undefined}
                />
              ))}
            </ChapterGroup>
          ) : null}
        </div>
      </div>
    </div>
  );
}
