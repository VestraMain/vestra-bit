import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProjectDetailClient from "./ProjectDetailClient";
import type { Project } from "@/types/database";

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) notFound();

  return <ProjectDetailClient initial={data as Project} />;
}
