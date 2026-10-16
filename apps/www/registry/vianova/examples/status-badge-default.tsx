import { StatusBadge } from "@/registry/vianova/patterns/status-badge";

export default function StatusBadgeDefault() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge tone="success">Connected</StatusBadge>
      <StatusBadge tone="warning">Incident open</StatusBadge>
      <StatusBadge tone="info">Awaiting operator</StatusBadge>
      <StatusBadge tone="destructive">Rejected</StatusBadge>
      <StatusBadge tone="neutral">Inactive</StatusBadge>
    </div>
  );
}
