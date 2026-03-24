import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

// ── Translate extracted_data to Spanish via Gemini Flash ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function translateData(data: Record<string, any>): Promise<Record<string, any>> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Only send the prose fields — structured data (dates, numbers, codes) stays untouched
  const result = await model.generateContent(
    "You are a bilingual government contracting specialist. Translate the provided " +
    "English JSON content into professional Mexican-American Spanish. Rules:\n" +
    "- Translate human-readable text naturally and professionally\n" +
    "- NEVER translate: proper nouns, organization names, bid numbers, dollar amounts, " +
    "dates, addresses, legal code references, NAICS codes, product model numbers, or measurement values\n" +
    "- Key terms: Licitación (Bid), Fianza de Licitación (Bid Bond), " +
    "Terminación Sustancial (Substantial Completion), Daños y Perjuicios Pactados (Liquidated Damages)\n" +
    "- Return a JSON object with IDENTICAL keys and structure. Null values stay null.\n" +
    "- Return ONLY valid JSON with no markdown, no code blocks, no explanation.\n\n" +
    "Translate the following procurement data JSON to professional Mexican-American Spanish. " +
    "Return ONLY valid JSON with the same structure:\n\n" + JSON.stringify(data, null, 2)
  );

  const raw = result.response.text();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(cleaned) as Record<string, any>;
  } catch {
    console.warn("[generate-brief-es] Translation JSON parse failed — using original data");
    return data;
  }
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await req.json().catch(() => ({})) as { projectId?: string };
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const { data: project, error: fetchErr } = await supabase
    .from("projects").select("*").eq("id", projectId).single();
  if (fetchErr || !project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractedData = (project.extracted_data as Record<string, any>) ?? {};

    // Translate prose fields
    const translatedData = await translateData(extractedData);

    // Build Spanish PDF
    const pdfBuffer = await buildBriefPDF(translatedData, project.title ?? "Unnamed Project", "es");

    const storagePath = `${user.id}/${projectId}/brief-es.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("project-files")
      .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadErr) throw new Error(uploadErr.message);

    const existingOutputs = (project.output_files as Record<string, string>) ?? {};
    await supabase.from("projects").update({
      output_files: { ...existingOutputs, es_pdf: storagePath },
    }).eq("id", projectId);

    return NextResponse.json({ success: true, path: storagePath });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Spanish generation failed";
    console.error("[generate-brief-es]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
