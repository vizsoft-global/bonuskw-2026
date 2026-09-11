"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HomeIcon } from "@/components/home/icon";
import { FileDownloadIcon, FileGlyph, FileTileArt, fileGradient, fileTypeLabel } from "@/components/course/file-art";
import { formatBytes } from "@/lib/course/resource-kind";
import type { OutlineFile, OutlineItem, OutlineLesson } from "@/lib/course/outline";
import { formatKwdLocale, type Locale } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

export type QuizResultSummary = { percent: number; passed: boolean; attempts: number };

type Quiz = Extract<OutlineItem, { kind: "quiz" }>;
type Chapter = Extract<OutlineItem, { kind: "chapter" }>;

/** One section per chapter: its lessons, its files and the tests placed after it. */
export type Section = { chapter: Chapter; quizzes: { quiz: Quiz; number: number }[] };

/**
 * Tests sit between chapters in the instructor's outline; on the student side
 * every test is shown inside the chapter it follows, so each chapter is one
 * self-contained section.
 */
export function groupSections(items: OutlineItem[]): Section[] {
  const sections: Section[] = [];
  const orphans: Quiz[] = [];
  let testNumber = 0;
  for (const item of items) {
    if (item.kind === "chapter") {
      sections.push({ chapter: item, quizzes: [] });
      continue;
    }
    testNumber += 1;
    const target = sections[sections.length - 1];
    if (target) target.quizzes.push({ quiz: item, number: testNumber });
    else orphans.push(item);
  }
  if (orphans.length && sections[0]) {
    let n = 0;
    sections[0].quizzes.unshift(...orphans.map((quiz) => ({ quiz, number: ++n })));
  }
  return sections;
}

function mins(seconds: number) {
  return seconds && Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : 0;
}

/** Small lock in the top corner of a card, as in the design. */
function TinyLock() {
  return (
    <span className="on-media absolute end-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-black/70 ring-1 ring-white/25">
      <span className="size-2.5">
        <HomeIcon src="/course/lock.svg" />
      </span>
    </span>
  );
}

/** "Currently Playing" overlay on the active lesson card (equalizer + label). */
function Equalizer() {
  const { t } = useI18n();
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ background: "rgba(0,0,0,0.4)" }}>
      <span className="flex h-[18px] items-end gap-[2.5px]" aria-hidden>
        {[55, 100, 75, 40, 85].map((h, i) => (
          <span
            key={i}
            className="w-[2.5px] animate-pulse rounded-full"
            style={{ height: `${h}%`, background: "#fff", animationDelay: `${i * 120}ms` }}
          />
        ))}
      </span>
      <span className="text-[12px] font-medium" style={{ color: "#fafafa" }}>
        {t("currentlyPlaying")}
      </span>
    </span>
  );
}

/** Lesson thumbnail: its own image, the video poster, or the brand mark on a blue gradient. */
function CardThumb({ src, children, className }: { src?: string; children?: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "relative block aspect-video w-full overflow-hidden rounded-[10px] bg-[#141414] ring-1 ring-white/10",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span
          className="absolute inset-0 grid place-items-center"
          style={{ background: "linear-gradient(160deg,#0c5eff 0%,#071f4f 100%)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/onboarding/logo.svg" alt="" className="size-[34%] max-h-12 object-contain opacity-90" />
        </span>
      )}
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------------- */
/* Cards                                                                    */
/* ----------------------------------------------------------------------- */

const CARD =
  "flex w-[calc((100%-10px)/2)] shrink-0 snap-start flex-col gap-1.5 sm:w-[calc((100%-20px)/3)] lg:w-[calc((100%-30px)/4)]";
/** Smaller thumbs on the learn page so a full row fits under the player. */
const CARD_DENSE =
  "flex w-[calc((100%-8px)/2)] shrink-0 snap-start flex-col gap-1 sm:w-[calc((100%-16px)/3)] lg:w-[min(188px,calc((100%-36px)/5))]";

function cardClass(dense?: boolean) {
  return dense ? CARD_DENSE : CARD;
}

function LessonCard({
  lesson,
  active,
  dense,
  onOpen,
  onResources,
}: {
  lesson: OutlineLesson;
  active?: boolean;
  dense?: boolean;
  onOpen?: () => void;
  onResources?: () => void;
}) {
  const { t } = useI18n();
  const playable = Boolean(onOpen) && (!lesson.locked || lesson.preview);
  const thumb = lesson.image || lesson.poster;
  return (
    <div className={cardClass(dense)}>
      <button
        type="button"
        disabled={!playable}
        onClick={onOpen}
        className="flex flex-col gap-1.5 text-start disabled:cursor-default"
      >
        <CardThumb src={thumb} className={cn(active && "ring-2 ring-[#0c5eff]")}>
          {lesson.locked && !lesson.preview ? <span className="absolute inset-0 bg-black/35" /> : null}
          {lesson.locked && !lesson.preview ? <TinyLock /> : null}
          {active ? <Equalizer /> : null}
          {lesson.preview && lesson.locked ? (
            <span className="absolute bottom-1.5 start-1.5 rounded-full bg-[#0c5eff] px-2 py-0.5 text-[9px] font-semibold text-white">
              {t("freePreview")}
            </span>
          ) : null}
        </CardThumb>
        <span className="line-clamp-2 text-[13px] font-medium leading-[18px] text-[#fafafa]">{lesson.name}</span>
      </button>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium text-[#999]">
        <span className="flex items-center gap-1">
          <span className="size-3 shrink-0">
            <HomeIcon src="/course/clock.svg" />
          </span>
          {mins(lesson.videoDuration)} {t("minShort")}
        </span>
        {lesson.files.length ? (
          <button
            type="button"
            onClick={onResources}
            disabled={!onResources}
            className="flex items-center gap-1 rounded-full hover:text-[#fafafa] disabled:hover:text-[#999]"
          >
            <FileDownloadIcon className="size-3 shrink-0" />
            {t("resourcesCount").replace("{n}", String(lesson.files.length))}
          </button>
        ) : null}
      </span>
    </div>
  );
}

function TestBadge() {
  return (
    <svg viewBox="0 0 48 48" className="size-11" style={{ color: "#fff" }} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        d="M24 4l4.6 3.4 5.7-.6 2.1 5.3 5.3 2.1-.6 5.7L44 24l-3.4 4.6.6 5.7-5.3 2.1-2.1 5.3-5.7-.6L24 44l-4.6-3.4-5.7.6-2.1-5.3-5.3-2.1.6-5.7L4 24l3.4-4.6-.6-5.7 5.3-2.1 2.1-5.3 5.7.6z"
        strokeLinejoin="round"
      />
      <path d="M19.5 19.5a4.5 4.5 0 1 1 6.6 4c-1.6.9-2.1 1.8-2.1 3.3" strokeLinecap="round" />
      <circle cx="24" cy="32" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TestCard({
  quiz,
  number,
  result,
  active,
  dense,
  onOpen,
}: {
  quiz: Quiz;
  number: number;
  result?: QuizResultSummary;
  active?: boolean;
  dense?: boolean;
  onOpen?: () => void;
}) {
  const { t } = useI18n();
  const canOpen = Boolean(onOpen) && !quiz.locked;
  return (
    <div className={cardClass(dense)}>
      <button
        type="button"
        disabled={!canOpen}
        onClick={onOpen}
        className="flex flex-col gap-1.5 text-start disabled:cursor-default"
      >
        <span
          className={cn(
            "relative block aspect-video w-full overflow-hidden rounded-[10px] ring-1 ring-white/10",
            active && "ring-2 ring-[#0c5eff]",
          )}
          style={{ background: "linear-gradient(180deg,#122853 0%,#2859b9 100%)" }}
        >
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <TestBadge />
            <span className="text-[18px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
              {t("test")}
            </span>
          </span>
          {quiz.locked ? <TinyLock /> : null}
          {result ? (
            <span
              className={cn(
                "absolute bottom-1.5 start-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold",
                result.passed ? "bg-[#10b981]" : "bg-[#f24822]",
              )}
              style={{ color: "#fff" }}
            >
              {result.percent}% · {result.passed ? t("passedTest") : t("failedTest")}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 text-[13px] font-medium leading-[18px] text-[#fafafa]">
          {t("test")} {number}: {quiz.name}
        </span>
      </button>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium text-[#999]">
        <span className="flex items-center gap-1">
          <span className="grid size-3 shrink-0 place-items-center rounded-full border border-current text-[7px] leading-none">?</span>
          {quiz.questionCount} {t("questions")}
        </span>
        {quiz.timeLimitMin ? (
          <span className="flex items-center gap-1">
            <span className="size-3 shrink-0">
              <HomeIcon src="/course/clock.svg" />
            </span>
            ~{quiz.timeLimitMin} {t("minShort")}
          </span>
        ) : null}
      </span>
      {canOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "mt-0.5 flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#373737] text-[#fafafa]",
            dense ? "h-8 px-3 text-[12px]" : "h-10 px-5 text-[13px]",
          )}
        >
          {result ? t("retakeTest") : t("takeTheTest")}
          <span className="size-3.5 rtl:-scale-x-100">
            <HomeIcon src="/course/chevron.svg" />
          </span>
        </button>
      ) : null}
    </div>
  );
}

function defaultOpenFile(file: OutlineFile) {
  window.open(file.url, "_blank", "noopener,noreferrer");
}

/** A chapter-level attachment, shown as a card in the same row as the lessons. */
function FileCard({
  file,
  dense,
  onOpen,
}: {
  file: OutlineFile;
  dense?: boolean;
  onOpen: (file: OutlineFile) => void;
}) {
  return (
    <div className={cardClass(dense)}>
      <button
        type="button"
        disabled={file.locked}
        onClick={() => onOpen(file)}
        className="flex flex-col gap-1.5 text-start disabled:cursor-default"
      >
        <span
          className="relative block aspect-video w-full overflow-hidden rounded-[10px] ring-1 ring-white/25"
          style={{ background: fileGradient(file.kind) }}
        >
          <span className="absolute inset-0 grid place-items-center">
            <FileGlyph file={file} className="w-[29%]" />
          </span>
          {file.locked ? <span className="absolute inset-0 bg-black/35" /> : null}
          {file.locked ? <TinyLock /> : null}
        </span>
        <span className="line-clamp-2 text-[13px] font-medium leading-[18px] text-[#fafafa]">{file.name}</span>
      </button>
      <span className="flex items-center gap-2.5 text-[11px] font-medium text-[#999]">
        <span className="flex items-center gap-1">
          <span className="size-3 shrink-0">
            <HomeIcon src="/course/paperclip.svg" />
          </span>
          {fileTypeLabel(file)}
        </span>
        {file.bytes ? (
          <span className="flex items-center gap-1">
            <FileDownloadIcon className="size-3 shrink-0" />
            {formatBytes(file.bytes)}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Horizontal rail: four cards per view, arrow to scroll further           */
/* ----------------------------------------------------------------------- */

function Rail({ children, count }: { children: ReactNode; count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ prev: false, next: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth - 1;
      const x = Math.abs(el.scrollLeft);
      const next = { prev: x > 1, next: max > 0 && x < max };
      setEdges((prev) => (prev.prev === next.prev && prev.next === next.next ? prev : next));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [count]);

  function scroll(dir: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    el.scrollBy({ left: dir * el.clientWidth * (rtl ? -1 : 1), behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div ref={ref} className="hide-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth pb-1">
        {children}
      </div>
      {edges.prev ? (
        <RailArrow side="start" onClick={() => scroll(-1)} />
      ) : null}
      {edges.next ? (
        <RailArrow side="end" onClick={() => scroll(1)} />
      ) : null}
    </div>
  );
}

function RailArrow({ side, onClick }: { side: "start" | "end"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "end" ? "Scroll forward" : "Scroll back"}
      className={cn(
        // Roughly centred on the thumbnails, which take the top ~60% of a card.
        "on-media absolute top-[30%] z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/75 ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-black",
        side === "end" ? "end-1" : "start-1",
      )}
    >
      <span className={cn("size-3.5", side === "end" ? "rtl:-scale-x-100" : "-scale-x-100 rtl:scale-x-100")}>
        <HomeIcon src="/course/chevron.svg" />
      </span>
    </button>
  );
}

/* ----------------------------------------------------------------------- */
/* Resources dialog: a lesson's attachments, opened from the card          */
/* ----------------------------------------------------------------------- */

function ResourcesDialog({
  lesson,
  onClose,
  onOpen,
}: {
  lesson: OutlineLesson;
  onClose: () => void;
  onOpen: (file: OutlineFile) => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] grid place-items-center bg-black/70 px-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-[20px] border border-white/10 bg-[#141414] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-[#fafafa]">{lesson.name}</p>
            <p className="text-[12px] text-[#999]">{t("resourcesCount").replace("{n}", String(lesson.files.length))}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-[#fafafa]"
            aria-label={t("close")}
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <ul className="flex flex-col divide-y divide-white/10">
          {lesson.files.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                disabled={file.locked}
                onClick={() => {
                  onClose();
                  onOpen(file);
                }}
                className="flex min-h-12 w-full items-center gap-3 py-2 text-start disabled:opacity-70"
              >
                <FileTileArt file={file} className="size-10 rounded-[8px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-[#fafafa]">{file.name}</span>
                  <span className="text-[11px] text-[#999]">
                    {fileTypeLabel(file)}
                    {file.bytes ? ` · ${formatBytes(file.bytes)}` : ""}
                  </span>
                </span>
                {file.locked ? (
                  <span className="size-4 shrink-0">
                    <HomeIcon src="/course/lock.svg" />
                  </span>
                ) : (
                  <span className="shrink-0 text-[12px] font-medium text-[#0c5eff]">{t("download")}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Sections                                                                 */
/* ----------------------------------------------------------------------- */

export function ChapterSections({
  items,
  locale,
  activeId,
  quizResults,
  onLesson,
  onQuiz,
  onBuyChapter,
  onFile,
  headerTone = "light",
  dense,
}: {
  items: OutlineItem[];
  locale: Locale;
  /** Lesson or test currently open (learn page): keeps its chapter expanded. */
  activeId?: string;
  quizResults?: Record<string, QuizResultSummary>;
  /** Open a lesson; also called for free-preview lessons the student has not unlocked. */
  onLesson?: (lesson: OutlineLesson) => void;
  onQuiz?: (quizId: string) => void;
  onBuyChapter?: (chapterId: string) => void;
  /** Open an unlocked file (preview or download); opens in a new tab by default. */
  onFile?: (file: OutlineFile) => void;
  /** Chapter title colour: bright on the course page, muted on the learn page. */
  headerTone?: "light" | "muted";
  /** Tighter cards so a lesson row fits under the player. */
  dense?: boolean;
}) {
  const { t } = useI18n();
  const openFile = onFile ?? defaultOpenFile;
  const sections = groupSections(items);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [resourcesFor, setResourcesFor] = useState<OutlineLesson | null>(null);

  // First chapter open by default; on the learn page the chapter of the
  // playing lesson/test is the one open. Manual toggles win afterwards.
  const activeSection =
    sections.find(
      (s) =>
        s.chapter.lessons.some((l) => l.id === activeId) || s.quizzes.some((q) => q.quiz.id === activeId),
    ) ?? sections[0];

  return (
    <div className="flex flex-col">
      {sections.map((section, index) => {
        const { chapter } = section;
        const open = toggled[chapter.id] ?? section === activeSection;
        const count = chapter.lessons.length + chapter.files.length + section.quizzes.length;
        return (
          <section key={chapter.id} className={cn("border-b border-white/10 last:border-b-0", dense ? "py-1.5" : "py-3")}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setToggled((prev) => ({ ...prev, [chapter.id]: !open }))}
                aria-expanded={open}
                className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-start"
              >
                <span
                  className={cn(
                    "min-w-0 truncate text-[14px] font-medium",
                    headerTone === "muted" ? "text-[#999]" : "text-[#fafafa]",
                  )}
                >
                  {t("chapterN").replace("{n}", String(index + 1))}: {chapter.name}
                </span>
                <span className="shrink-0 text-[11px] text-[#666]">{count}</span>
              </button>
              {chapter.sellable && chapter.locked && onBuyChapter ? (
                <button
                  type="button"
                  onClick={() => onBuyChapter(chapter.id)}
                  className="shrink-0 rounded-full border border-[#0c5eff]/40 bg-[#0c5eff]/10 px-2.5 py-1 text-[11px] font-medium text-[#0c5eff] hover:bg-[#0c5eff]/20"
                >
                  {t("buyChapter")} · {formatKwdLocale(Number(chapter.price), locale)}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setToggled((prev) => ({ ...prev, [chapter.id]: !open }))}
                aria-label={open ? t("seeLess") : t("seeMore")}
                className="grid size-8 shrink-0 place-items-center text-[#999]"
              >
                <span className={cn("size-3.5 transition-transform", open ? "-rotate-90" : "rotate-90")}>
                  <HomeIcon src="/course/chevron.svg" />
                </span>
              </button>
            </div>
            {open ? (
              count ? (
                <div className={dense ? "pt-1" : "pt-2"}>
                  <Rail count={count}>
                    {chapter.lessons.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        dense={dense}
                        active={activeId === lesson.id}
                        onOpen={onLesson ? () => onLesson(lesson) : undefined}
                        onResources={() => setResourcesFor(lesson)}
                      />
                    ))}
                    {chapter.files.map((file) => (
                      <FileCard key={file.id} file={file} dense={dense} onOpen={openFile} />
                    ))}
                    {section.quizzes.map(({ quiz, number }) => (
                      <TestCard
                        key={quiz.id}
                        quiz={quiz}
                        number={number}
                        dense={dense}
                        result={quizResults?.[quiz.id]}
                        active={activeId === quiz.id}
                        onOpen={onQuiz ? () => onQuiz(quiz.id) : undefined}
                      />
                    ))}
                  </Rail>
                </div>
              ) : (
                <p className="pb-1 pt-1 text-[12px] text-[#666]">{t("emptyLessonsTitle")}</p>
              )
            ) : null}
          </section>
        );
      })}
      {resourcesFor ? (
        <ResourcesDialog lesson={resourcesFor} onClose={() => setResourcesFor(null)} onOpen={openFile} />
      ) : null}
    </div>
  );
}
