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

// ── Extraction JSON schema sent to Gemini ─────────────────────────────────────
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

// ── Gemini call with 429 retry logic ─────────────────────────────────────────
// Free-tier rate limit: retries up to 3 times with a 20-second backoff.
async function callGeminiWithRetry(
  model: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]>,
  prompt: string,
  filename: string
): Promise<string> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 20_000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate");
      if (is429 && attempt < MAX_RETRIES) {
        console.warn(
          `[extract] "${filename}" — 429 rate limit hit (attempt ${attempt}/${MAX_RETRIES}). ` +
          `Waiting ${RETRY_DELAY_MS / 1000}s before retry…`
        );
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Gemini call failed after ${MAX_RETRIES} attempts`);
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
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    // gemini-2.0-flash-lite: higher free-tier RPM quota than gemini-2.0-flash
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    // Merged extracted data across all files — later files fill in nulls from earlier ones
    let merged: Record<string, unknown> = {};
    const fileErrors: string[] = [];
    let successCount = 0;

    // ── Process each PDF individually ──────────────────────────────────────
    const sourceFiles = project.source_files as string[];
    for (let i = 0; i < sourceFiles.length; i++) {
      const filePath = sourceFiles[i];
      const filename = filePath.split("/").pop() ?? filePath;

      console.log(`[extract] Downloading (${i + 1}/${sourceFiles.length}): ${filePath}`);

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

      const fullText = await getPdfText(buffer);
      if (!fullText.trim()) {
        const msg = `"${filename}" yielded empty text (scanned/image-only PDF?)`;
        console.warn(`[extract] ${msg}`);
        fileErrors.push(msg);
        continue;
      }

      // Limit to first 15,000 chars — government RFPs front-load key fields
      const text = fullText.slice(0, 15_000);
      console.log(
        `[extract] "${filename}" — ${fullText.length} chars extracted, sending first ${text.length}`
      );

      // 5-second inter-file delay (skip before the first file)
      if (i > 0) {
        console.log(`[extract] Waiting 5s before next Gemini call…`);
        await new Promise((r) => setTimeout(r, 5_000));
      }

      const prompt =
        "You are a government procurement analyst. Extract fields from the " +
        "provided RFP document and return a single valid JSON object. " +
        "CRITICAL: If you cannot find a field, set it to null. Never " +
        "fabricate, estimate, or infer values. Return ONLY valid JSON with " +
        "no markdown fences, no code blocks, and no explanatory text.\n\n" +
        `Extract all procurement fields from the following RFP document text. ` +
        `Return ONLY a valid JSON object matching this schema exactly:\n\n` +
        `${EXTRACTION_SCHEMA}\n\n` +
        `For work_items and insurance_requirements, return empty arrays [] if none found.\n\n` +
        `Document text:\n${text}`;

      console.log(`[extract] Sending "${filename}" to Gemini…`);
      const raw = await callGeminiWithRetry(model, prompt, filename);
      console.log(`[extract] Gemini responded for "${filename}".`);

      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();

      let fileData2: Record<string, unknown>;
      try {
        fileData2 = JSON.parse(cleaned);
      } catch {
        console.warn(
          `[extract] "${filename}" returned invalid JSON — skipping. ` +
          `Raw (first 200 chars): ${raw.slice(0, 200)}`
        );
        fileErrors.push(`"${filename}" returned invalid JSON from Gemini`);
        continue;
      }

      // Merge: first file seeds the object; subsequent files fill in only null fields
      if (successCount === 0) {
        merged = fileData2;
      } else {
        for (const key of Object.keys(fileData2)) {
          if (merged[key] === null || merged[key] === undefined) {
            merged[key] = fileData2[key];
          }
        }
      }
      successCount++;
    }

    if (successCount === 0) {
      throw new Error(
        `Could not extract data from any of the ${sourceFiles.length} file(s). ` +
          `Errors: ${fileErrors.join(" | ")}`
      );
    }

    if (!Array.isArray(merged.work_items)) merged.work_items = [];
    if (!Array.isArray(merged.insurance_requirements)) merged.insurance_requirements = [];

    // ── Save to DB ─────────────────────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("projects")
      .update({
        extracted_data: merged,
        status: "review",
        ...(merged.bid_deadline && !project.bid_deadline
          ? { bid_deadline: null }
          : {}),
      })
      .eq("id", projectId);

    if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

    console.log(
      `[extract] Done. Project ${projectId} → status: review. ` +
      `Processed ${successCount}/${sourceFiles.length} file(s).` +
      (fileErrors.length ? ` Partial errors: ${fileErrors.join(" | ")}` : "")
    );
    return NextResponse.json({ success: true, extracted_data: merged });
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
