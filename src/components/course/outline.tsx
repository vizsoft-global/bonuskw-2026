"use client";

import { HomeIcon } from "@/components/home/icon";
import { LessonRow } from "@/components/course/lesson-row";
import { formatBytes, type ResourceKind } from "@/lib/course/resource-kind";
import type { OutlineFile, OutlineItem } from "@/lib/course/outline";
import { formatKwdLocale, type Locale } from "@/lib/i18n/content";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<ResourceKind, string> = {
  pdf: "PDF",
  image: "IMAGE",
  audio: "AUDIO",
  video: "VIDEO",
  file: "FILE",
};

/** Document-style thumbnail with a badge for the file type. */
export function FileThumb({ kind, className }: { kind: ResourceKind; className?: string }) {
  const tone =
    kind === "pdf"
      ? "bg-[#f24822]"
      : kind === "audio"
        ? "bg-[#8b5cf6]"
        : kind === "video"
          ? "bg-[#0c5eff]"
          : kind === "image"
            ? "bg-[#10b981]"
            : "bg-[#545454]";
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[10px] border-[0.5px] border-white/25 bg-[#1d1d1d]",
        className,
      )}
    >
      <span className="absolute inset-x-[22%] top-[14%] bottom-[18%] rounded-[3px] border border-white/30 bg-white/[0.08]" />
      <span className={cn("relative rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white", tone)}>
        {KIND_LABEL[kind]}
      </span>
    </span>
  );
}

function openFile(file: OutlineFile) {
  window.open(file.url, "_blank", "noopener,noreferrer");
}

/** One downloadable file: thumbnail, name, type/size, download or lock. */
export function FileTile({
  file,
  downloadLabel,
  compact,
}: {
  file: OutlineFile;
  downloadLabel: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <button
        type="button"
        disabled={file.locked}
        onClick={() => openFile(file)}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-start disabled:opacity-70"
      >
        <FileThumb kind={file.kind} className="h-9 w-12" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-[#fafafa]">{file.name}</span>
          <span className="text-[11px] text-[#999]">
            {KIND_LABEL[file.kind]}
            {file.bytes ? ` · ${formatBytes(file.bytes)}` : ""}
          </span>
        </span>
        {file.locked ? (
          <span className="size-4 shrink-0">
            <HomeIcon src="/course/lock.svg" />
          </span>
        ) : (
          <span className="shrink-0 text-[12px] font-medium text-[#0c5eff]">{downloadLabel}</span>
        )}
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={file.locked}
      onClick={() => openFile(file)}
      className="flex flex-col gap-1.5 text-start disabled:cursor-default"
    >
      <span className="relative block">
        <FileThumb kind={file.kind} className="aspect-[82/55] w-full" />
        <span className={cn("absolute inset-0 grid place-items-center rounded-[10px]", file.locked ? "bg-black/45" : "")}>
          {file.locked ? (
            <span className="size-5">
              <HomeIcon src="/course/lock.svg" />
            </span>
          ) : null}
        </span>
      </span>
      <span className="line-clamp-2 text-[13px] font-medium leading-normal text-[#fafafa]">{file.name}</span>
      <span className="flex items-center gap-[5px] text-[11px] font-medium text-[#999]">
        <span className="size-3 shrink-0">
          <HomeIcon src="/course/paperclip.svg" />
        </span>
        {file.locked ? KIND_LABEL[file.kind] : downloadLabel}
        {file.bytes ? ` · ${formatBytes(file.bytes)}` : ""}
      </span>
    </button>
  );
}

function TestRow({
  name,
  questionCount,
  timeLimitMin,
  locked,
  label,
  questionsLabel,
  onOpen,
  active,
}: {
  name: string;
  questionCount: number;
  timeLimitMin?: number | null;
  locked: boolean;
  label: string;
  questionsLabel: string;
  onOpen?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={locked || !onOpen}
      onClick={onOpen}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-[12px] border border-white/15 bg-white/[0.04] px-3 py-2.5 text-start disabled:cursor-default",
        active && "border-[#0c5eff] bg-[#0c5eff]/10",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-[#0c5eff]/15 text-[11px] font-bold text-[#0c5eff]">
        {label}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-[#fafafa]">{name}</span>
        <span className="text-[11px] text-[#999]">
          {questionCount} {questionsLabel}
          {timeLimitMin ? ` · ${timeLimitMin} min` : ""}
        </span>
      </span>
      {locked ? (
        <span className="size-4 shrink-0">
          <HomeIcon src="/course/lock.svg" />
        </span>
      ) : (
        <span className="size-3.5 shrink-0 rtl:-scale-x-100">
          <HomeIcon src="/course/chevron.svg" />
        </span>
      )}
    </button>
  );
}

/**
 * The course outline exactly as the instructor ordered it: chapters (with
 * lessons and their attachments), tests and standalone files interleaved.
 */
export function CourseOutline({
  items,
  locale,
  labels,
  onLesson,
  onQuiz,
  onBuyChapter,
  activeId,
  compact,
}: {
  items: OutlineItem[];
  locale: Locale;
  labels: { download: string; test: string; questions: string; chapter: string; buyChapter?: string };
  onLesson?: (lessonId: string) => void;
  onQuiz?: (quizId: string) => void;
  /** Adds a sellable, still-locked chapter to the cart. */
  onBuyChapter?: (chapterId: string) => void;
  /** Currently playing lesson or open quiz (learn page). */
  activeId?: string;
  /** Sidebar layout: single-column rows instead of tiles. */
  compact?: boolean;
}) {
  // Precompute test numbering so rendering stays pure.
  const testNumbers = new Map<string, number>();
  items.forEach((item) => {
    if (item.kind === "quiz") testNumbers.set(item.id, testNumbers.size + 1);
  });
  return (
    <div className={compact ? "flex flex-col gap-3" : undefined}>
      {items.map((item) => {
        if (item.kind === "chapter") {
          return (
            <section key={item.id} className={compact ? "" : "border-b border-white/10"}>
              <div className={cn("flex w-full items-center justify-between gap-3 text-start", compact ? "py-1" : "py-[15px]")}>
                <span className="min-w-0 truncate text-[14px] font-medium text-[#999]">{item.name}</span>
                {item.locked && !compact ? (
                  <span className="size-4 shrink-0">
                    <HomeIcon src="/course/lock.svg" />
                  </span>
                ) : null}
              </div>
              <div
                className={
                  compact
                    ? "flex flex-col gap-1"
                    : "grid grid-cols-2 gap-x-2.5 gap-y-3 pb-4 lg:grid-cols-4 lg:gap-3"
                }
              >
                {item.lessons.map((lesson) =>
                  compact ? (
                    <div key={lesson.id}>
                      <button
                        type="button"
                        disabled={lesson.locked}
                        onClick={() => onLesson?.(lesson.id)}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-2 rounded-xl px-2 py-2 text-start text-sm text-[#fafafa] disabled:opacity-60",
                          activeId === lesson.id && "bg-[#0c5eff]/15",
                        )}
                      >
                        <span className="size-3.5 shrink-0">
                          <HomeIcon src={lesson.locked ? "/course/lock.svg" : "/course/play.svg"} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{lesson.name}</span>
                      </button>
                      {lesson.files.length ? (
                        <div className="ms-6">
                          {lesson.files.map((file) => (
                            <FileTile key={file.id} file={file} downloadLabel={labels.download} compact />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div key={lesson.id} className="contents">
                      <button
                        type="button"
                        disabled={lesson.locked || !onLesson}
                        onClick={() => onLesson?.(lesson.id)}
                        className="text-start disabled:cursor-default"
                      >
                        <LessonRow
                          name={lesson.name}
                          image={lesson.image}
                          duration={lesson.videoDuration}
                          locked={lesson.locked}
                        />
                      </button>
                      {lesson.files.map((file) => (
                        <FileTile key={file.id} file={file} downloadLabel={labels.download} />
                      ))}
                    </div>
                  ),
                )}
                {item.sellable && item.locked && !compact ? (
                  <button
                    type="button"
                    onClick={onBuyChapter ? () => onBuyChapter(item.id) : undefined}
                    disabled={!onBuyChapter}
                    className="col-span-full inline-flex w-fit items-center gap-1.5 rounded-full border border-[#0c5eff]/40 bg-[#0c5eff]/10 px-3 py-1.5 text-[12px] font-medium text-[#0c5eff] hover:bg-[#0c5eff]/20 disabled:opacity-60"
                  >
                    {labels.buyChapter ?? "Buy chapter"} · {formatKwdLocale(Number(item.price), locale)}
                  </button>
                ) : null}
              </div>
            </section>
          );
        }
        if (item.kind === "quiz") {
          const testNumber = testNumbers.get(item.id) ?? 0;
          return (
            <div key={item.id} className={compact ? "" : "py-3"}>
              <TestRow
                name={item.name}
                questionCount={item.questionCount}
                timeLimitMin={item.timeLimitMin}
                locked={item.locked}
                label={`${labels.test} ${testNumber}`}
                questionsLabel={labels.questions}
                onOpen={onQuiz ? () => onQuiz(item.id) : undefined}
                active={activeId === item.id}
              />
            </div>
          );
        }
        return (
          <div key={item.id} className={compact ? "" : "py-3"}>
            {compact ? (
              <FileTile file={item.file} downloadLabel={labels.download} compact />
            ) : (
              <div className="grid grid-cols-2 gap-x-2.5 lg:grid-cols-4">
                <FileTile file={item.file} downloadLabel={labels.download} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
