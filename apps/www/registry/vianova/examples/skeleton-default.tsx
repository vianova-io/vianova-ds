import { Skeleton } from "@/registry/vianova/ui/skeleton";

export default function SkeletonDefault() {
  return (
    <div className="w-full space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
