"use client";

import { useEffect, useState } from "react";
import { HomeIcon } from "@/components/home/icon";
import { LessonRow } from "@/components/course/lesson-row";
import { formatKwdLocale, type Locale } from "@/lib/i18n/content";
import { cn } from "@/lib/utils";

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
  const [open, setOpen] = useState<string>(chapters[0]?.id || "");

  useEffect(() => {
    if (!open && chapters[0]?.id) setOpen(chapters[0].id);
  }, [chapters, open]);

  return (
    <div>
      {chapters.map((chapter) => {
        const expanded = open === chapter.id;
        return (
          <section key={chapter.id} className="border-b border-white/10">
            <button
              type="button"
              onClick={() => setOpen(expanded ? "" : chapter.id)}
              className="flex w-full items-center justify-between gap-3 py-[15px] text-start"
            >
              <span className="min-w-0 truncate text-[14px] font-medium text-[#999]">
                {String(chapter.name || "Chapter")}
              </span>
              <span className={cn("size-[18px] shrink-0 transition-transform", expanded ? "-rotate-90" : "rotate-90")}>
                <HomeIcon src="/course/chevron.svg" />
              </span>
            </button>
            {expanded ? (
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 pb-4 lg:grid-cols-4 lg:gap-3">
                {chapter.lessons.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    name={String(lesson.name || "Lesson")}
                    image={typeof lesson.image === "string" ? lesson.image : undefined}
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
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
