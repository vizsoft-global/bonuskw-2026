import { chapterEmiIndex } from "@/lib/course/emi";
import { paidInstallments } from "@/lib/course/entitlement";
import { isChapterLocked, isLessonLocked } from "@/lib/course/locks";
import { fileNameFromUrl } from "@/components/course/resource-row";
import { resourceKind, type ResourceKind } from "@/lib/course/resource-kind";
import { localizedField, type Locale } from "@/lib/i18n/content";
import type {
  ChapterDoc,
  CourseResourceDoc,
  LessonDoc,
  LessonFile,
  QuizDoc,
  SubscriptionDoc,
} from "@/lib/types/firestore";

type Row = { id: string; [key: string]: unknown };

type Translatable = {
  name?: string;
  nameManualTranslate?: { ar?: string; en?: string };
  nameAutoTranslate?: { ar?: string; en?: string };
};

/** Chapter/lesson/test names in the student's language when a translation is stored. */
function localName(doc: Translatable, locale: Locale, fallback: string) {
  return (
    localizedField(
      typeof doc.name === "string" ? doc.name : undefined,
      doc.nameManualTranslate,
      doc.nameAutoTranslate,
      locale,
    ) || fallback
  );
}

export type OutlineFile = {
  id: string;
  name: string;
  url: string;
  kind: ResourceKind;
  bytes?: number;
  locked: boolean;
};

export type OutlineLesson = {
  id: string;
  name: string;
  image?: string;
  /** Video poster used when the lesson has no thumbnail of its own. */
  poster?: string;
  videoDuration: number;
  /** Not playable for this student (paid content they have not unlocked). */
  locked: boolean;
  /**
   * Marked as a free preview by the instructor while the student has not
   * unlocked it: playable in a popup without enrolling.
   */
  preview: boolean;
  /** Attachments that belong to this lesson (downloadable while watching). */
  files: OutlineFile[];
};

export type OutlineItem =
  | {
      kind: "chapter";
      id: string;
      name: string;
      sellable: boolean;
      price?: number;
      locked: boolean;
      lessons: OutlineLesson[];
      /** Attachments that belong to the chapter itself rather than one lesson. */
      files: OutlineFile[];
    }
  | {
      kind: "quiz";
      id: string;
      name: string;
      questionCount: number;
      locked: boolean;
      passPercent?: number;
      timeLimitMin?: number | null;
    };

type Sub = Pick<
  SubscriptionDoc,
  "status" | "paymentType" | "payment_status" | "firstPaymentStatus" | "secondPaymentStatus" | "thirdPaymentStatus" | "paidCount" | "installmentCount"
> | null;

/**
 * Merges chapters (with their lessons and attachments) and tests into one list
 * ordered by `serialNumber`, and resolves what the current student can open.
 * Without a subscription everything paid is locked; free-preview lessons stay
 * playable. Course files always belong to a chapter: by `chapterRef`, or for
 * files saved before that link existed, the chapter they were placed after.
 */
export function buildOutline(input: {
  chapters: Row[];
  lessons: Row[];
  quizzes: Row[];
  resources: Row[];
  subscription?: Sub;
  /** Enrolment through a chapter purchase, by chapter id. */
  purchasedChapterIds?: Set<string>;
  /** Video posters by lesson id, used when a lesson has no thumbnail. */
  posters?: Record<string, string>;
  /** Real runtimes by lesson id, used when a lesson's own duration is 0. */
  durations?: Record<string, number>;
  /** Language for chapter/lesson/test names; English when omitted. */
  locale?: Locale;
}): OutlineItem[] {
  const locale: Locale = input.locale ?? "en";
  const paid = paidInstallments(input.subscription ?? null);
  const enrolled = Boolean(input.subscription && input.subscription.status === "Ongoing");
  const purchased = input.purchasedChapterIds ?? new Set<string>();

  const lessonsByChapter = new Map<string, Row[]>();
  for (const lesson of input.lessons) {
    const chapterId = (lesson.chapterRef as { id?: string } | undefined)?.id;
    if (!chapterId) continue;
    const list = lessonsByChapter.get(chapterId) ?? [];
    list.push(lesson);
    lessonsByChapter.set(chapterId, list);
  }

  const items: { serial: number; item: OutlineItem }[] = [];

  // Chapters sorted by position, so a legacy file with no chapterRef can be
  // attached to the chapter it was dragged under in the admin outline.
  const orderedChapters = [...input.chapters].sort(
    (a, b) => Number(a.serialNumber || 0) - Number(b.serialNumber || 0),
  );
  const filesByChapter = new Map<string, Row[]>();
  for (const resource of input.resources) {
    const r = resource as unknown as CourseResourceDoc;
    if (!r.url || !orderedChapters.length) continue;
    let chapterId = r.chapterRef?.id;
    if (!chapterId || !orderedChapters.some((c) => c.id === chapterId)) {
      const serial = Number(resource.serialNumber || 0);
      const before = orderedChapters.filter((c) => Number(c.serialNumber || 0) <= serial);
      chapterId = (before[before.length - 1] ?? orderedChapters[0]).id;
    }
    const list = filesByChapter.get(chapterId) ?? [];
    list.push(resource);
    filesByChapter.set(chapterId, list);
  }

  for (const chapter of orderedChapters) {
    const c = chapter as unknown as ChapterDoc;
    const gate = chapterEmiIndex({ emiIndex: c.emiIndex, emiType: c.emiType });
    const chapterOpen = !isChapterLocked(c) && ((enrolled && paid >= gate) || purchased.has(chapter.id));
    const chapterFiles = (filesByChapter.get(chapter.id) ?? [])
      .sort((a, b) => Number(a.serialNumber || 0) - Number(b.serialNumber || 0))
      .map((resource) => {
        const r = resource as unknown as CourseResourceDoc;
        const fileGate = Math.max(1, Number(r.emiIndex ?? 1));
        const open = r.status !== false && ((enrolled && paid >= fileGate) || purchased.has(chapter.id));
        return {
          id: resource.id,
          name: String(r.name || fileNameFromUrl(r.url!)),
          url: r.url!,
          kind:
            (r.kind as ResourceKind | undefined) ??
            resourceKind({ contentType: r.contentType, name: r.name, url: r.url }),
          bytes: r.bytes,
          locked: !open,
        } satisfies OutlineFile;
      });
    const lessons = (lessonsByChapter.get(chapter.id) ?? []).map((row) => {
      const lesson = row as unknown as LessonDoc;
      const lessonOpen = chapterOpen && !isLessonLocked(lesson);
      const files = ((lesson.lesson_file_list ?? []) as LessonFile[])
        .filter((f) => f.lesson_file_link && f.lesson_status !== "Inactive")
        .map((f, i) => {
          const url = f.lesson_file_link!;
          return {
            id: `${row.id}-${i}`,
            name: fileNameFromUrl(url),
            url,
            kind: resourceKind({ url }),
            locked: !lessonOpen || f.lesson_download_status === false,
          } satisfies OutlineFile;
        });
      return {
        id: row.id,
        name: localName(lesson as Translatable, locale, "Lesson"),
        image: typeof lesson.image === "string" ? lesson.image : undefined,
        poster: input.posters?.[row.id],
        videoDuration: Number(lesson.videoDuration || input.durations?.[row.id] || 0),
        locked: !lessonOpen,
        preview: !lessonOpen && lesson.lessonStatus === "Unlock" && !isLessonLocked(lesson) && !isChapterLocked(c),
        files,
      } satisfies OutlineLesson;
    });
    items.push({
      serial: Number(chapter.serialNumber || 0),
      item: {
        kind: "chapter",
        id: chapter.id,
        name: localName(c as Translatable, locale, "Chapter"),
        sellable: Boolean(c.sellable),
        price: typeof c.price === "number" ? c.price : undefined,
        locked: !chapterOpen,
        lessons,
        files: chapterFiles,
      },
    });
  }

  for (const quiz of input.quizzes) {
    const q = quiz as unknown as QuizDoc;
    items.push({
      serial: Number(quiz.serialNumber || 0),
      item: {
        kind: "quiz",
        id: quiz.id,
        name: localName(q as Translatable, locale, "Test"),
        questionCount: Number(q.questionCount ?? q.questions?.length ?? 0),
        passPercent: q.passPercent,
        timeLimitMin: q.timeLimitMin ?? null,
        locked: q.status === false || !enrolled,
      },
    });
  }

  return items.sort((a, b) => a.serial - b.serial).map((x) => x.item);
}

export function outlineCounts(items: OutlineItem[]) {
  let lessons = 0;
  let files = 0;
  let tests = 0;
  for (const item of items) {
    if (item.kind === "chapter") {
      lessons += item.lessons.length;
      files += item.files.length + item.lessons.reduce((s, l) => s + l.files.length, 0);
    } else tests += 1;
  }
  return { lessons, files, tests };
}
