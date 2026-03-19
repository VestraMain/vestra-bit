import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildBriefPDF } from "@/lib/brief/buildBriefPDF";

export const runtime = "nodejs";
export const maxDuration = 120;

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await req.json().catch(() => ({})) as { projectId?: string };
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { data: project, error: fetchErr } = await supabase
    .from("projects").select("*").eq("id", projectId).single();
  if (fetchErr || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  await supabase.from("projects").update({ status: "generating" }).eq("id", projectId);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractedData = (project.extracted_data as Record<string, any>) ?? {};
    const pdfBuffer = await buildBriefPDF(extractedData, project.title ?? "Unnamed Project", "en");

    const storagePath = `${user.id}/${projectId}/brief-en.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("project-files")
      .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadErr) throw new Error(uploadErr.message);

    const existingOutputs = (project.output_files as Record<string, string>) ?? {};
    await supabase.from("projects").update({
      status: "complete",
      output_files: { ...existingOutputs, en_pdf: storagePath },
    }).eq("id", projectId);

    return NextResponse.json({ success: true, path: storagePath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    await supabase.from("projects").update({ status: "review" }).eq("id", projectId);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
