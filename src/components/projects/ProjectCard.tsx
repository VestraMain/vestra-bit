import Link from "next/link";
import { Calendar, ExternalLink, FileDown, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import { formatDeadline, formatDate } from "@/lib/utils";
import type { Project } from "@/types/database";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { label: deadlineLabel, isUrgent } = formatDeadline(project.bid_deadline);

  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <Card className="hover:shadow-md hover:border-navy/20 transition-all cursor-pointer h-full">
        <CardContent className="p-5">
          {/* Title + status */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="font-semibold text-navy text-sm leading-snug line-clamp-2 flex-1 group-hover:text-navy/80 transition-colors">
              {project.title}
            </h3>
            <StatusBadge status={project.status} />
          </div>

          {/* Deadline */}
          <div className="flex items-center gap-1.5 mb-4">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            {project.bid_deadline ? (
              <span className="text-xs text-gray-500">
                {formatDate(project.bid_deadline)} —{" "}
                <span className={isUrgent ? "text-red-600 font-semibold" : "text-gray-500"}>
                  {deadlineLabel}
                </span>
              </span>
            ) : (
              <span className="text-xs text-gray-400">No deadline set</span>
            )}
            {isUrgent && project.bid_deadline && (
              <Badge variant="urgent" className="ml-1 text-[10px] py-0 px-1.5">
                Urgent
              </Badge>
            )}
          </div>

          {/* File count */}
          {project.source_files && project.source_files.length > 0 && (
            <p className="text-xs text-gray-400 mb-4">
              {project.source_files.length} source file{project.source_files.length !== 1 ? "s" : ""}
            </p>
          )}

          {/* Quick actions — stop propagation so card link doesn't trigger */}
          <div
            className="flex items-center gap-2 flex-wrap"
            onClick={(e) => e.preventDefault()}
          >
            {(project.status === "review" || project.status === "draft") && (
              <Link href={`/projects/${project.id}`}>
                <Button size="sm" variant="default" className="h-7 text-xs px-2.5 gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  {project.status === "review" ? "Generate Brief" : "Open"}
                </Button>
              </Link>
            )}

            {project.status === "complete" && project.output_files ? (
              <Button size="sm" variant="success" className="h-7 text-xs px-2.5 gap-1.5">
                <FileDown className="w-3 h-3" />
                Download
              </Button>
            ) : null}

            {project.source_url && (
              <a
                href={project.source_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2.5 gap-1.5">
                  <ExternalLink className="w-3 h-3" />
                  Source
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
