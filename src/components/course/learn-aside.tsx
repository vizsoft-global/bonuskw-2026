"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { HomeIcon } from "@/components/home/icon";
import { FileThumb } from "@/components/course/outline";
import { formatBytes } from "@/lib/course/resource-kind";
import type { OutlineFile, OutlineItem, OutlineLesson } from "@/lib/course/outline";
import { cn } from "@/lib/utils";

export type LearnLabels = {
  currentlyPlaying: string;
  nextLessons: string;
  lessons: string;
  resources: string;
  resourcesCount: string;
  assetsCount: string;
  takeTheTest: string;
  test: string;
  tests: string;
  questions: string;
  download: string;
  minShort: string;
};

function mins(duration: number, minShort: string) {
  const m = Number.isFinite(duration) && duration > 0 ? Math.max(1, Math.round(duration / 60)) : 0;
  return `${m} ${minShort}`;
}

/** "PDF" · "ZIP" style label from the file extension, falling back to kind. */
function fileTypeLabel(file: OutlineFile) {
  const ext = /\.([a-z0-9]{2,4})(\?|#|$)/i.exec(file.name)?.[1];
  if (ext) return ext.toUpperCase();
  return file.kind === "pdf" ? "PDF" : file.kind === "image" ? "Image" : file.kind === "audio" ? "Audio" : file.kind === "video" ? "Video" : "File";
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

/** Real thumbnail when the lesson has one, otherwise the logo on a gradient. */
function CardThumb({ thumb, title }: { thumb?: string; title: string }) {
  if (thumb) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />;
  }
  return (
    <span
      className="grid h-full w-full place-items-center"
      style={{ backgroundImage: "linear-gradient(135deg, #0c5eff 0%, #062a6b 100%)" }}
    >
      <span className="block size-10 lg:size-12" aria-label={title}>
        <HomeIcon src="/onboarding/logo.svg" />
      </span>
    </span>
  );
}

/** Deliberately tiny lock pinned to the card's top corner. */
function TinyLock() {
  return (
    <span className="absolute end-1 top-1 rounded-full bg-black/70 p-[3px]" title="Locked">
      <span className="block size-2.5">
        <HomeIcon src="/course/lock.svg" />
      </span>
    </span>
  );
}

function LessonCard({
  lesson,
  thumb,
  active,
  labels,
  onOpen,
  onResources,
}: {
  lesson: OutlineLesson;
  thumb?: string;
  active: boolean;
  labels: LearnLabels;
  onOpen?: () => void;
  onResources?: () => void;
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
          <CardThumb thumb={thumb} title={lesson.name} />
          {lesson.locked ? <span className="absolute inset-0 bg-black/45" /> : null}
          {lesson.locked ? (
            <TinyLock />
          ) : active ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45">
              <Equalizer />
              <span className="text-[11px] font-medium text-white">{labels.currentlyPlaying}</span>
            </span>
          ) : (
            <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
              <span className="size-6 rounded-full bg-black/60 p-1">
                <HomeIcon src="/course/play.svg" />
              </span>
            </span>
          )}
        </span>
        <span className="block px-2 pt-2">
          <span className="block truncate text-[12px] font-medium leading-4 text-[#fafafa]" title={lesson.name}>
            {lesson.name}
          </span>
        </span>
      </button>
      <span className="flex items-center gap-3 px-2 pb-2 pt-1 text-[11px] text-[#999]">
        <span className="flex shrink-0 items-center gap-1">
          <span className="size-3 shrink-0">
            <HomeIcon src="/course/clock.svg" />
          </span>
          {mins(lesson.videoDuration, labels.minShort)}
        </span>
        {lesson.files.length ? (
          <button
            type="button"
            onClick={onResources}
            className="flex min-w-0 flex-1 items-center gap-1 text-start transition active:scale-[0.98]"
          >
            <span className="size-3 shrink-0">
              <HomeIcon src="/course/paperclip.svg" />
            </span>
            <span className="truncate">
              {labels.resourcesCount.replace("{n}", String(lesson.files.length))}
            </span>
          </button>
        ) : null}
      </span>
    </div>
  );
}

function QuizCard({
  name,
  index,
  questionCount,
  timeLimitMin,
  labels,
  locked,
  active,
  onOpen,
}: {
  name: string;
  index: number;
  questionCount: number;
  timeLimitMin?: number | null;
  labels: LearnLabels;
  locked: boolean;
  active: boolean;
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
        disabled={locked || !onOpen}
        onClick={onOpen}
        className="group relative block aspect-video w-full place-items-center bg-[#1d1d1d] text-center disabled:cursor-default"
      >
        <span className="flex h-full w-full flex-col items-center justify-center gap-1">
          <span className="text-[26px] font-bold leading-none text-[#fafafa]">?</span>
          <span className="text-[13px] font-medium text-[#fafafa]">
            {labels.test} {index + 1}
          </span>
        </span>
        {locked ? (
          <>
            <span className="absolute inset-0 bg-black/45" />
            <TinyLock />
          </>
        ) : active ? (
          <span className="absolute end-1 top-1 rounded-full bg-black/70 px-1.5 py-1">
            <Equalizer />
          </span>
        ) : (
          <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
            <span className="size-6 rounded-full bg-black/60 p-1">
              <HomeIcon src="/course/play.svg" />
            </span>
          </span>
        )}
      </button>
      <span className="block px-2 pt-2">
        <span className="block truncate text-[12px] font-medium leading-4 text-[#fafafa]" title={name}>
          {name}
        </span>
        <span className="block pt-1 text-[11px] text-[#999]">
          {questionCount} {labels.questions}
          {timeLimitMin ? ` · ~${timeLimitMin} ${labels.minShort}` : ""}
        </span>
      </span>
      <span className="block p-2">
        <button
          type="button"
          disabled={locked || !onOpen}
          onClick={onOpen}
          className="flex w-full items-center justify-center gap-1 rounded-[10px] border border-white/15 py-2 text-[12px] font-medium text-[#fafafa] transition active:scale-[0.98] disabled:opacity-50"
        >
          {labels.takeTheTest}
          <span className="size-3.5 shrink-0 rtl:rotate-180">
            <HomeIcon src="/course/chevron.svg" />
          </span>
        </button>
      </span>
    </div>
  );
}

/**
 * One chapter as a visually distinct group: every lesson, test and file
 * inside belongs to this chapter.
 */
function ChapterGroup({
  name,
  locked,
  count,
  countLabel,
  children,
}: {
  name: string;
  locked: boolean;
  count: number;
  countLabel: string;
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
          {count} {countLabel}
        </span>
        <span className={cn("size-3.5 shrink-0 transition-transform", collapsed && "-rotate-90")}>
          <HomeIcon src="/course/chevron.svg" />
        </span>
      </button>
      {collapsed ? null : <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">{children}</div>}
    </section>
  );
}

export type LessonGroupsProps = {
  items: OutlineItem[];
  activeLessonId?: string;
  activeQuizId?: string;
  labels: LearnLabels;
  onLesson?: (lessonId: string) => void;
  onQuiz?: (quizId: string) => void;
  onResources?: () => void;
};

/** Chapter-grouped lesson/test card grids. Two columns on phones, four on desktop. */
export function LessonGroups({
  items,
  activeLessonId,
  activeQuizId,
  labels,
  onLesson,
  onQuiz,
  onResources,
}: LessonGroupsProps) {
  const chapters = useMemo(() => items.filter((i) => i.kind === "chapter"), [items]);
  const quizzes = useMemo(() => items.filter((i) => i.kind === "quiz"), [items]);
  return (
    <div className="flex flex-col gap-2.5">
      {chapters.map((chapter) => (
        <ChapterGroup
          key={chapter.id}
          name={chapter.name}
          locked={chapter.locked}
          count={chapter.lessons.length}
          countLabel={labels.lessons}
        >
          {chapter.lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              thumb={lesson.image || lesson.poster}
              active={lesson.id === activeLessonId}
              labels={labels}
              onOpen={onLesson ? () => onLesson(lesson.id) : undefined}
              onResources={onResources}
            />
          ))}
        </ChapterGroup>
      ))}
      {quizzes.length ? (
        <ChapterGroup
          name={labels.tests}
          locked={false}
          count={quizzes.length}
          countLabel={labels.test}
        >
          {quizzes.map((quiz, i) => (
            <QuizCard
              key={quiz.id}
              name={quiz.name}
              index={i}
              questionCount={quiz.questionCount}
              timeLimitMin={quiz.timeLimitMin}
              labels={labels}
              locked={quiz.locked}
              active={quiz.id === activeQuizId}
              onOpen={onQuiz ? () => onQuiz(quiz.id) : undefined}
            />
          ))}
        </ChapterGroup>
      ) : null}
    </div>
  );
}

function ResourceRow({ file, downloadLabel }: { file: OutlineFile; downloadLabel: string }) {
  const meta = file.bytes ? `${fileTypeLabel(file)} · ${formatBytes(file.bytes)}` : fileTypeLabel(file);
  const inner = (
    <>
      <FileThumb kind={file.kind} className="h-[55px] w-[55px] shrink-0" />
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-[13px] font-medium text-[#fafafa]" title={file.name}>
          {file.name}
        </span>
        <span className="mt-1 block text-[11px] text-[#999]">{meta}</span>
      </span>
      {file.locked ? (
        <span className="size-4 shrink-0 opacity-70" title={downloadLabel}>
          <HomeIcon src="/course/lock.svg" />
        </span>
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 text-[#fafafa]">
          <Download className="size-4" />
        </span>
      )}
    </>
  );
  if (file.locked) {
    return <div className="flex w-full items-center gap-3 py-3">{inner}</div>;
  }
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noreferrer"
      download
      className="flex w-full items-center gap-3 py-3 transition active:scale-[0.99]"
    >
      {inner}
    </a>
  );
}

/** Every attachment in the course: icon, real file name, kind + size, download. */
export function ResourcesPanel({
  items,
  labels,
}: {
  items: OutlineItem[];
  labels: LearnLabels;
}) {
  const files = useMemo(() => {
    const rows: OutlineFile[] = [];
    for (const item of items) {
      if (item.kind === "chapter") {
        for (const lesson of item.lessons) rows.push(...lesson.files);
      } else if (item.kind === "file") {
        rows.push(item.file);
      }
    }
    return rows;
  }, [items]);

  return (
    <div id="learn-resources-panel">
      <div className="flex items-baseline justify-between gap-2 px-1 pb-1">
        <p className="text-[14px] font-semibold text-[#fafafa]">{labels.resources}</p>
        <p className="text-[11px] text-[#999]">{labels.assetsCount.replace("{n}", String(files.length))}</p>
      </div>
      <div className="divide-y divide-white/5">
        {files.map((file) => (
          <ResourceRow key={file.id} file={file} downloadLabel={labels.download} />
        ))}
      </div>
    </div>
  );
}

/** Phones/tablets: Next Lessons and Resources switch in place. */
export function LearnMobileTabs({
  items,
  activeLessonId,
  activeQuizId,
  labels,
  onLesson,
  onQuiz,
}: Omit<LessonGroupsProps, "onResources">) {
  const [tab, setTab] = useState<"lessons" | "resources">("lessons");
  const fileCount = useMemo(() => {
    let n = 0;
    for (const item of items) {
      if (item.kind === "chapter") n += item.lessons.reduce((s, l) => s + l.files.length, 0);
      else if (item.kind === "file") n += 1;
    }
    return n;
  }, [items]);

  return (
    <div>
      <div className="flex items-center gap-4 border-b border-white/20">
        {(
          [
            ["lessons", labels.nextLessons, null],
            ["resources", labels.resources, fileCount],
          ] as const
        ).map(([key, label, badge]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-1 py-2.5 text-[13px]",
              tab === key ? "border-b border-[#fafafa] font-semibold text-[#fafafa]" : "text-[#fafafa] opacity-60",
            )}
          >
            {label}
            {badge != null ? (
              <span className="rounded-[6px] bg-[#141414] px-2 py-0.5 text-[10px] font-medium text-[#fafafa]">
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="pt-2.5">
        {tab === "lessons" ? (
          <LessonGroups
            items={items}
            activeLessonId={activeLessonId}
            activeQuizId={activeQuizId}
            labels={labels}
            onLesson={onLesson}
            onQuiz={onQuiz}
            onResources={() => setTab("resources")}
          />
        ) : (
          <ResourcesPanel items={items} labels={labels} />
        )}
      </div>
    </div>
  );
}
