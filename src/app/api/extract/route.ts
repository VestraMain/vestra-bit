import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 120;

// ── Supabase client ───────────────────────────────────────────────────────────
async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// ── Extraction JSON schema sent to Claude ────────────────────────────────────
const EXTRACTION_SCHEMA = `{
  "owner": "Issuing agency / owner name, or null",
  "bid_number": "Bid/RFP/IFB reference number, or null",
  "naics_code": "NAICS code as string, or null",
  "estimated_value": "Estimated contract value (keep currency symbol), or null",
  "contract_type": "e.g. Lump Sum, Unit Price, Cost Plus, or null",
  "sbe_goal": "Small Business Enterprise participation goal %, or null",
  "bid_deadline": "Deadline for bid submission as ISO-8601 datetime or readable string, or null",
  "submission_platform": "Where/how to submit (e.g. Bonfire, email, in person), or null",
  "prebid_meeting_date": "Pre-bid meeting date/time as string, or null",
  "prebid_meeting_location": "Pre-bid meeting address or platform, or null",
  "questions_deadline": "Deadline for submitting questions as string, or null",
  "addendum_date": "Date of most recent addendum, or null",
  "construction_start": "Expected construction start date, or null",
  "substantial_completion": "Substantial completion date or duration, or null",
  "final_completion": "Final completion date or duration, or null",
  "liquidated_damages_per_day": "Liquidated damages dollar amount per day, or null",
  "payment_terms": "Payment terms description, or null",
  "bid_bond_requirement": "Bid bond % or amount required, or null",
  "performance_bond_requirement": "Performance/payment bond % or amount, or null",
  "procurement_contact_name": "Name of procurement officer/contact, or null",
  "procurement_contact_email": "Email of procurement officer/contact, or null",
  "project_title": "Full official title of the project, or null",
  "site_address": "Project site address, or null",
  "work_items": [
    {
      "name": "Work item/division name",
      "scope_summary": "Brief description of scope",
      "materials": "Key materials specified or null",
      "dimensions_quantities": "Key quantities/dimensions or null",
      "special_requirements": "Special specs or requirements or null"
    }
  ],
  "licensing_requirements": "Required contractor licenses as string, or null",
  "insurance_requirements": [
    { "type": "Insurance type name", "minimum": "Minimum coverage amount" }
  ],
  "co_labor_percentage": "Contractor's own labor % requirement, or null",
  "submission_forms_required": "List of required submission forms as string, or null"
}`;

// ── PDF text extraction ───────────────────────────────────────────────────────
// Uses unpdf exclusively. unpdf bundles pdfjs-dist with its own DOMMatrix
// polyfill (globalThis.DOMMatrix = class {}) so it works on Vercel's Node.js
// serverless runtime with zero browser API dependencies.
// pdf-parse is intentionally not used — its v2 release uses pdfjs-dist as a
// peer dep without the polyfill, causing "DOMMatrix is not defined" crashes.
async function getPdfText(buffer: Buffer): Promise<string> {
  try {
    const { extractText } = await import("unpdf");
    const { text } = await extractText(new Uint8Array(buffer), {
      mergePages: true,
    });
    return text ?? "";
  } catch (err) {
    console.error("[extract] unpdf extraction error:", err);
    return "";
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await getSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { projectId } = body as { projectId?: string };
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  console.log(`[extract] Starting extraction for project ${projectId}`);

  const { data: project, error: fetchErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (fetchErr || !project) {
    console.error(`[extract] Project not found: ${fetchErr?.message}`);
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.source_files || project.source_files.length === 0) {
    return NextResponse.json(
      { error: "No source files to extract from" },
      { status: 400 }
    );
  }

  console.log(`[extract] Found ${project.source_files.length} source file(s)`);

  // Mark as extracting
  await supabase
    .from("projects")
    .update({ status: "extracting" })
    .eq("id", projectId);

  try {
    // ── Step 1: Download + extract text from each PDF ──────────────────────
    const textChunks: string[] = [];
    const fileErrors: string[] = [];

    for (const filePath of project.source_files as string[]) {
      const filename = filePath.split("/").pop() ?? filePath;
      console.log(`[extract] Downloading: ${filePath}`);

      const { data: fileData, error: dlErr } = await supabase.storage
        .from("project-files")
        .download(filePath);

      if (dlErr || !fileData) {
        const msg = `Download failed for "${filename}": ${dlErr?.message ?? "no data"}`;
        console.error(`[extract] ${msg}`);
        fileErrors.push(msg);
        continue;
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      console.log(`[extract] Downloaded "${filename}" — ${buffer.byteLength} bytes`);

      const text = await getPdfText(buffer);
      console.log(`[extract] "${filename}" — ${text.length} chars extracted`);
      if (!text.trim()) {
        const msg = `"${filename}" yielded empty text (scanned/image-only PDF?)`;
        console.warn(`[extract] ${msg}`);
        fileErrors.push(msg);
        textChunks.push(
          `\n\n--- FILE: ${filename} ---\n[No extractable text — likely a scanned image PDF]`
        );
      } else {
        textChunks.push(`\n\n--- FILE: ${filename} ---\n${text}`);
      }
    }

    if (textChunks.length === 0) {
      throw new Error(
        `Could not extract text from any of the ${project.source_files.length} file(s). ` +
          `Errors: ${fileErrors.join(" | ")}`
      );
    }

    const combined = textChunks.join("\n").slice(0, 180_000);
    console.log(
      `[extract] Combined text: ${combined.length} chars from ` +
        `${textChunks.length}/${project.source_files.length} file(s).` +
        (fileErrors.length ? ` Partial errors: ${fileErrors.join(" | ")}` : "")
    );

    // ── Step 2: Call Gemini ─────────────────────────────────────────────────
    console.log(`[extract] Sending ${combined.length} chars to Gemini`);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const result = await model.generateContent(
      "You are a government procurement analyst. Extract fields from the " +
      "provided RFP documents and return a single valid JSON object. " +
      "CRITICAL: If you cannot find a field, set it to null. Never " +
      "fabricate, estimate, or infer values. Return ONLY valid JSON with " +
      "no markdown fences, no code blocks, and no explanatory text.\n\n" +
      `Extract all procurement fields from the following RFP document text. ` +
      `Return ONLY a valid JSON object matching this schema exactly:\n\n` +
      `${EXTRACTION_SCHEMA}\n\n` +
      `For work_items and insurance_requirements, return empty arrays [] if none found.\n\n` +
      `Document text:\n${combined}`
    );

    console.log(`[extract] Gemini responded.`);

    // ── Step 3: Parse + validate Gemini's response ──────────────────────────
    const raw = result.response.text();
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      throw new Error(
        `Claude returned invalid JSON. Raw (first 500 chars): ${raw.slice(0, 500)}`
      );
    }

    if (!Array.isArray(extracted.work_items)) extracted.work_items = [];
    if (!Array.isArray(extracted.insurance_requirements))
      extracted.insurance_requirements = [];

    // ── Step 4: Save to DB ─────────────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("projects")
      .update({
        extracted_data: extracted,
        status: "review",
        ...(extracted.bid_deadline && !project.bid_deadline
          ? { bid_deadline: null }
          : {}),
      })
      .eq("id", projectId);

    if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

    console.log(`[extract] Done. Project ${projectId} → status: review`);
    return NextResponse.json({ success: true, extracted_data: extracted });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Extraction failed";
    console.error(`[extract] FATAL for project ${projectId}:`, errMsg);

    await supabase
      .from("projects")
      .update({
        status: "draft",
        extracted_data: { _extraction_error: errMsg },
      })
      .eq("id", projectId);

    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
