import Link from "next/link";
import { HomeIcon } from "./icon";

export function StatsCard({
  streak,
  courses,
  hours,
  labels,
}: {
  streak: number;
  courses: number;
  hours: number;
  labels: {
    myStats: string;
    streak: string;
    activeCourses: string;
    studyTime: string;
    daysUnit: string;
    coursesUnit: string;
    hoursUnit: string;
  };
}) {
  const cols = [
    {
      label: labels.streak,
      icon: "/home/fire.svg",
      value: `${streak} ${labels.daysUnit}`,
    },
    {
      label: labels.activeCourses,
      icon: "/home/book-bookmark.svg",
      value: `${courses} ${labels.coursesUnit}`,
    },
    {
      label: labels.studyTime,
      icon: "/home/clock-square.svg",
      value: `${hours} ${labels.hoursUnit}`,
    },
  ];

  return (
    <div className="w-full overflow-hidden rounded-[12px] bg-[#141414] px-[19px] py-[14px] lg:w-[363px] lg:shrink-0">
      <Link href="/my-space" className="mb-[10px] hidden items-center gap-[5px] lg:flex">
        <span className="text-[12px] font-semibold text-white">{labels.myStats}</span>
        <span className="size-[18px]">
          <HomeIcon src="/home/chevron.svg" />
        </span>
      </Link>
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
