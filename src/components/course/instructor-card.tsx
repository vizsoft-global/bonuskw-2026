"use client";

import Link from "next/link";
import { HomeIcon } from "@/components/home/icon";

function initialsOf(name?: string) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "B";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function InstructorCard({
  href,
  name,
  bio,
  photo,
  rating,
  ratingLabel,
  verified,
}: {
  href: string;
  name: string;
  bio?: string;
  photo?: string;
  rating: number;
  ratingLabel: string;
  verified?: boolean;
}) {
  return (
    <Link
      href={href}
      className="mt-3 flex items-center gap-3 rounded-[16px] bg-[#141414] px-3 py-2.5"
    >
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-[#666] bg-[#2a2a2a] text-sm font-semibold text-[#c8c8c8]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsOf(name)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold text-[#fafafa]">{name}</span>
          {verified ? (
            <span className="size-3.5 shrink-0">
              <HomeIcon src="/course/verified.svg" />
            </span>
          ) : null}
        </span>
        {bio ? <span className="mt-0.5 block truncate text-[12px] text-[#999]">{bio}</span> : null}
        <span className="mt-1 flex items-center gap-1 text-[12px] text-[#999]">
          <span className="size-3">
            <HomeIcon src="/course/star.svg" />
          </span>
          <span className="text-[#fafafa]">{rating.toFixed(1)}</span>
          {ratingLabel}
        </span>
      </span>
      <span className="size-4 shrink-0 rtl:rotate-180">
        <HomeIcon src="/course/chevron.svg" />
      </span>
    </Link>
  );
}
