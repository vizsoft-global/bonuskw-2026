"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { StoryViewer } from "@/components/home/story-viewer";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/locale";
import { storyKey, storyThumb } from "@/lib/stories/media";
import { getSeenServerSnapshot, getSeenSnapshot, parseSeen, subscribeSeen } from "@/lib/stories/seen";
import type { SettingsStory } from "@/lib/types/firestore";

export function StoriesRow({
  stories,
  fade = false,
}: {
  stories: SettingsStory[];
  fade?: boolean;
}) {
  const { t } = useI18n();
  const raw = useSyncExternalStore(subscribeSeen, getSeenSnapshot, getSeenServerSnapshot);
  const seen = parseSeen(raw);
  // Stories open as an overlay on the current page and auto-advance; the
  // /stories route stays only for deep links.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openIndex]);

  if (!stories.length) return null;

  return (
    <div className={cn("relative min-w-0", fade && "flex-1")}>
      {openIndex !== null
        ? createPortal(
            <StoryViewer stories={stories} startIndex={openIndex} onClose={() => setOpenIndex(null)} />,
            document.body,
          )
        : null}
      <div className="flex gap-[10px] overflow-x-auto hide-scrollbar">
        {stories.map((story, i) => {
          const key = storyKey(story, i);
          const viewed = seen.includes(key);
          const thumb = storyThumb(story);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="flex w-[78px] shrink-0 flex-col items-center gap-[3px]"
            >
              <span
                className={cn(
                  "flex size-[78px] items-center justify-center overflow-hidden rounded-full border-2 p-1",
                  viewed ? "border-[#4c4c4c]" : "border-[#f24822]",
                )}
              >
                <span className="size-full overflow-hidden rounded-full border-[0.5px] border-white/20 bg-[#141414]">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </span>
              </span>
              <span className="w-full truncate text-center text-[12px] text-[#fafafa]">
                {story.title || t("story")}
              </span>
            </button>
          );
        })}
      </div>
      {fade ? (
        <div className="pointer-events-none absolute inset-y-0 end-0 w-[140px] bg-gradient-to-l from-[#050505] from-[60%] to-transparent" />
      ) : null}
    </div>
  );
}
