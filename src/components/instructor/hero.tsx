"use client";

import { HomeIcon } from "@/components/home/icon";
import { cn } from "@/lib/utils";

export function InstructorHero({
  photo,
  name,
  bio,
  verified,
  courseCount,
  ebookCount,
  labels,
}: {
  photo?: string;
  name: string;
  bio?: string;
  verified?: boolean;
  courseCount: number;
  ebookCount: number;
  labels: {
    totalCourses: string;
    ebooks: string;
    coursesUnit: string;
    booksUnit: string;
  };
}) {
  return (
    <div>
      <div className="relative">
        <div className="relative h-[107px] overflow-hidden rounded-[12px] bg-[#141414] lg:h-[138px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/instructor/banner.png" alt="" className="absolute inset-0 size-full object-cover object-[center_32%]" />
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute end-4 top-4 flex items-center gap-[5px] lg:end-5 lg:top-5">
            <span className="text-end leading-none text-[#fafafa]">
              <span className="block font-serif text-[12px] font-medium tracking-wide lg:text-[16px]">BONUS</span>
              <span className="block text-[12px] font-light lg:text-[16px]">Instructors</span>
            </span>
            <span className="relative size-[31px] shrink-0 overflow-hidden lg:size-[40px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/instructor/mark.svg" alt="" className="size-full object-contain" />
            </span>
          </div>
        </div>

        <div className="relative z-10 -mt-[46px] flex items-end gap-3 px-[15px] lg:-mt-[70px] lg:gap-4 lg:px-5">
          <span className="grid size-[93px] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#050505] bg-[#2a2a2a] text-[28px] font-semibold text-[#c8c8c8] lg:size-[160px] lg:text-[44px]">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-full object-cover" />
            ) : (
              (name || "B").slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="min-w-0 flex-1 pb-1 lg:pb-3">
            <p className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold text-[#fafafa] lg:text-[18px]">
              <span className="truncate">{name}</span>
              {verified ? (
                <span className="size-3.5 shrink-0 lg:size-4">
                  <HomeIcon src="/course/verified.svg" />
                </span>
              ) : null}
            </p>
            {bio ? <p className="mt-0.5 truncate text-[10px] text-[#999] lg:text-[12px]">{bio}</p> : null}
          </div>
          <div className="hidden lg:block">
            <InstructorStats
              courseCount={courseCount}
              ebookCount={ebookCount}
              labels={labels}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 lg:hidden">
        <InstructorStats courseCount={courseCount} ebookCount={ebookCount} labels={labels} />
      </div>
    </div>
  );
}

function InstructorStats({
  courseCount,
  ebookCount,
  labels,
}: {
  courseCount: number;
  ebookCount: number;
  labels: {
    totalCourses: string;
    ebooks: string;
    coursesUnit: string;
    booksUnit: string;
  };
}) {
  const cols = [
    {
      label: labels.totalCourses,
      icon: "/home/book-bookmark.svg",
      value: `${courseCount} ${labels.coursesUnit}`,
    },
    {
      label: labels.ebooks,
      icon: "/home/notebook.svg",
      value: `${ebookCount} ${labels.booksUnit}`,
    },
  ];

  return (
    <div className="w-full overflow-hidden rounded-[12px] bg-[#141414] px-[19px] py-[14px] lg:w-[361px] lg:shrink-0">
      <div className="flex items-center justify-between">
        {cols.map((col, i) => (
          <div key={col.label} className="flex items-center">
            {i > 0 ? <span className="mx-3 h-[22px] w-px bg-white/10" /> : null}
            <div className="flex w-[77px] flex-col items-center gap-[5px]">
              <p className="w-full text-center text-[10px] text-[#999]">{col.label}</p>
              <div className="flex items-center justify-center gap-[3px]">
                <span className="size-4 shrink-0">
                  <HomeIcon src={col.icon} />
                </span>
                <p className="whitespace-nowrap text-[12px] font-medium text-[#fafafa]">{col.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InstructorTabs({
  tab,
  onTab,
  courses,
  ebooks,
  labels,
}: {
  tab: "courses" | "ebooks";
  onTab: (tab: "courses" | "ebooks") => void;
  courses: number;
  ebooks: number;
  labels: { courses: string; ebooks: string };
}) {
  const items = [
    { id: "courses" as const, label: labels.courses, count: courses },
    { id: "ebooks" as const, label: labels.ebooks, count: ebooks },
  ];
  return (
    <div className="mt-5 flex gap-5 overflow-x-auto border-b border-white/10 hide-scrollbar lg:mt-8">
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
