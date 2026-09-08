export default function Loading() {
  return (
    <div className="flex flex-col gap-5 pt-5" role="status" aria-label="Loading">
      <div className="h-[88px] animate-pulse rounded-2xl bg-[#1a1a1a]" />
      <div className="h-5 w-40 animate-pulse rounded bg-[#1a1a1a]" />
      <div className="grid grid-cols-2 gap-x-5 gap-y-6 lg:grid-cols-4 lg:gap-[25px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[240px] animate-pulse rounded-2xl bg-[#1a1a1a]" />
        ))}
      </div>
    </div>
  );
}
