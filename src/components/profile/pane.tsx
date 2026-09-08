import { ListPageSkeleton } from "@/components/shared/skeleton";

export function ProfilePane({
  title,
  loading,
  skeleton,
  children,
}: {
  title: string;
  loading?: boolean;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h1 className="mb-4 hidden text-[20px] font-semibold text-[#fafafa] lg:block">{title}</h1>
      {loading ? (skeleton ?? <ListPageSkeleton />) : children}
    </div>
  );
}
