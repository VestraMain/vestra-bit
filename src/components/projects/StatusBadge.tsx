import { Badge } from "@/components/ui/badge";
import type { ProjectStatus } from "@/types/database";

const statusConfig: Record<
  ProjectStatus,
  { label: string; variant: "draft" | "extracting" | "review" | "generating" | "complete" | "archived" }
> = {
  draft: { label: "Draft", variant: "draft" },
  extracting: { label: "Extracting", variant: "extracting" },
  review: { label: "Review", variant: "review" },
  generating: { label: "Generating", variant: "generating" },
  complete: { label: "Complete", variant: "complete" },
  archived: { label: "Archived", variant: "archived" },
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
