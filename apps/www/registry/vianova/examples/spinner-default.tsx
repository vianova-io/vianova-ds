import { Spinner } from "@/registry/vianova/ui/spinner";

export default function SpinnerDefault() {
  return (
    <div className="flex items-center gap-4">
      <Spinner />
      <span className="text-sm text-muted-foreground">Loading zones…</span>
    </div>
  );
}
