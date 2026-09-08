"use client";

import { cn } from "@/lib/utils";

export type CourseTab = "lessons" | "resources" | "tests";

export function CourseTabs({
  tab,
  onTab,
  counts,
  labels,
}: {
  tab: CourseTab;
  onTab: (tab: CourseTab) => void;
  counts: { lessons: number; resources: number; tests: number };
  labels: { lessons: string; resources: string; tests: string };
}) {
  const items: Array<{ id: CourseTab; label: string; count: number }> = [
    { id: "lessons", label: labels.lessons, count: counts.lessons },
    { id: "resources", label: labels.resources, count: counts.resources },
    { id: "tests", label: labels.tests, count: counts.tests },
  ];

  return (
    <div className="mt-6 flex gap-5 overflow-x-auto border-b border-white/10 hide-scrollbar">
      {items.map((item) => {
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTab(item.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 pb-2.5 text-[13px]",
              active ? "border-b-2 border-white font-medium text-[#fafafa]" : "text-[#999]",
            )}
          >
            {item.label}
            <span className="rounded-[8px] bg-[#141414] px-1.5 py-0.5 text-[10px] text-[#fafafa]">{item.count}</span>
          </button>
        );
      })}
    </div>
  );
}
