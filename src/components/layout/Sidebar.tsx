"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlusCircle, Settings, LogOut, FileText, Eye, Share2, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects/new", label: "New Project", icon: PlusCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // Detect if we're on a project sub-page
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const currentProjectId = projectMatch ? projectMatch[1] : null;
  const isNewProject = currentProjectId === "new";
  const projectId = isNewProject ? null : currentProjectId;

  const projectSubLinks = projectId
    ? [
        { href: `/projects/${projectId}`, label: "Project Detail", icon: FileText },
        { href: `/projects/${projectId}/preview`, label: "Brief Preview", icon: Eye },
        { href: `/projects/${projectId}/social`, label: "Social Media", icon: Share2 },
        { href: `/projects/${projectId}/notes`, label: "Team Notes", icon: StickyNote },
      ]
    : [];

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-navy flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-white/10">
        <div className="w-8 h-8 rounded-lg bg-orange flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-white" />
        </div>
        <div className="leading-tight">
          <span className="text-white font-bold text-base tracking-tight">Vestra</span>
          <span className="text-orange font-bold text-base tracking-tight"> BIT</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href) && href !== "/";
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {/* Project sub-navigation */}
        {projectSubLinks.length > 0 && (
          <div className="pt-3 mt-1 border-t border-white/10">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-3 mb-1.5">
              This Project
            </p>
            {projectSubLinks.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/50 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-white/10 pt-4">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
