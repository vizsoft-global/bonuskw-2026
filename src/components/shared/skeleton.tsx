import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-[#1a1a1a]", className)} />;
}

export function ListPageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 pt-2" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function SearchSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]" role="status" aria-label="Loading">
      <div className="hidden space-y-4 rounded-[16px] border border-white/10 bg-[#1a1a1a] p-4 lg:block">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[51px] w-full rounded-[47px]" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-3xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function StoreSkeleton() {
  return (
    <div className="flex flex-col gap-5 pt-5" role="status" aria-label="Loading">
      <Skeleton className="hidden h-7 w-48 lg:block" />
      <Skeleton className="h-[88px] w-full rounded-2xl" />
      <Skeleton className="h-5 w-40" />
      <div className="flex gap-[15px] overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-[164px] shrink-0 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-5 w-36" />
      <div className="grid grid-cols-2 gap-x-5 gap-y-6 lg:grid-cols-4 lg:gap-[25px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-5 pt-5" role="status" aria-label="Loading">
      <Skeleton className="hidden h-7 w-48 lg:block" />
      <Skeleton className="h-[88px] w-full rounded-2xl" />
      <Skeleton className="h-5 w-40" />
      <div className="flex gap-[15px] overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] w-[220px] shrink-0 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-5 w-36" />
      <div className="grid grid-cols-2 gap-x-5 gap-y-6 lg:grid-cols-4 lg:gap-[25px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[240px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function CourseDetailsSkeleton({ coverAspect = "5/3" }: { coverAspect?: "5/3" | "3/4" }) {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="Loading">
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-8">
        <Skeleton className={cn(coverAspect === "3/4" ? "aspect-[3/4]" : "aspect-[5/3]", "w-full rounded-[12px]")} />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-4/5" />
          <Skeleton className="h-8 w-48 rounded-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-[120px] w-full rounded-[24px]" />
        </div>
      </div>
      <Skeleton className="h-[72px] w-full rounded-[16px]" />
      <div className="flex gap-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-16" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-[8px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InstructorSkeleton() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-label="Loading">
      <Skeleton className="h-[107px] w-full rounded-[12px] lg:h-[138px]" />
      <div className="flex items-end gap-3">
        <Skeleton className="size-[93px] rounded-full lg:size-[160px]" />
        <div className="min-w-0 flex-1 space-y-2 pb-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      <Skeleton className="h-[64px] w-full rounded-[12px] lg:hidden" />
      <div className="flex gap-5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-6 lg:grid-cols-4 lg:gap-[25px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[240px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
