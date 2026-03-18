import Link from "next/link";
import { Plus, FolderOpen, CalendarClock, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectCard } from "@/components/projects/ProjectCard";
import type { Project } from "@/types/database";

async function getDashboardData(userId: string) {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const allProjects: Project[] = projects ?? [];

  const thisMonth = allProjects.filter(
    (p) => p.created_at >= startOfMonth
  ).length;

  const upcomingDeadlines = allProjects.filter((p) => {
    if (!p.bid_deadline) return false;
    const deadline = new Date(p.bid_deadline);
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 14;
  }).length;

  return { projects: allProjects, total: allProjects.length, thisMonth, upcomingDeadlines };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { projects, total, thisMonth, upcomingDeadlines } = await getDashboardData(user!.id);

  const stats = [
    {
      label: "Total Projects",
      value: total,
      icon: FolderOpen,
      color: "text-navy",
      bg: "bg-navy/10",
    },
    {
      label: "This Month",
      value: thisMonth,
      icon: TrendingUp,
      color: "text-green",
      bg: "bg-green/10",
    },
    {
      label: "Upcoming Deadlines",
      value: upcomingDeadlines,
      icon: CalendarClock,
      color: upcomingDeadlines > 0 ? "text-orange" : "text-gray-500",
      bg: upcomingDeadlines > 0 ? "bg-orange/10" : "bg-gray-100",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your RFP projects</p>
        </div>
        <Link href="/projects/new">
          <Button variant="accent" className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-navy">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-200 py-20 px-6 text-center">
          <div className="w-16 h-16 bg-navy/5 rounded-2xl flex items-center justify-center mb-4">
            <FolderOpen className="w-8 h-8 text-navy/30" />
          </div>
          <h3 className="text-lg font-semibold text-navy mb-1">No projects yet</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-xs">
            Create your first project to start processing RFP documents.
          </p>
          <Link href="/projects/new">
            <Button variant="default" className="gap-2">
              <Plus className="w-4 h-4" />
              Create First Project
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Active Projects
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </>
      )}

      {/* Floating New Project Button (mobile) */}
      <Link href="/projects/new">
        <button
          className="fixed bottom-6 right-6 w-14 h-14 bg-orange text-white rounded-full shadow-lg flex items-center justify-center hover:bg-orange/90 transition-colors md:hidden"
          aria-label="New Project"
        >
          <Plus className="w-6 h-6" />
        </button>
      </Link>
    </div>
  );
}
