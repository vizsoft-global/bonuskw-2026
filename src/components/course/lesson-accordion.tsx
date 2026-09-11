import { LessonRow } from "@/components/course/lesson-row";
import { formatKwdLocale, type Locale } from "@/lib/i18n/content";

type Lesson = {
  id: string;
  name?: unknown;
  image?: unknown;
  videoDuration?: unknown;
  locked: boolean;
};

type Chapter = {
  id: string;
  name?: unknown;
  sellable?: unknown;
  price?: unknown;
  lessons: Lesson[];
};

export function LessonAccordion({
  chapters,
  locale,
}: {
  chapters: Chapter[];
  locale: Locale;
}) {
  return (
    <div>
      {chapters.map((chapter) => (
        <section key={chapter.id} className="border-b border-white/10">
          <div className="flex w-full items-center justify-between gap-3 py-[15px] text-start">
            <span className="min-w-0 truncate text-[14px] font-medium text-[#999]">
              {String(chapter.name || "Chapter")}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 pb-4 lg:grid-cols-4 lg:gap-3">
            {chapter.lessons.map((lesson) => (
              <LessonRow
                key={lesson.id}
                name={String(lesson.name || "Lesson")}
                image={typeof lesson.image === "string" ? lesson.image : undefined}
                seed={chapter.id}
                duration={Number(lesson.videoDuration || 0)}
                locked={lesson.locked}
              />
            ))}
            {chapter.sellable ? (
              <p className="col-span-full text-[12px] text-[#0c5eff]">
                {formatKwdLocale(Number(chapter.price), locale)}
              </p>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
