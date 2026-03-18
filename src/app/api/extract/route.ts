import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";

// Use Node.js runtime (required for pdf-parse)
export const runtime = "nodejs";
export const maxDuration = 120;

// ── Supabase admin client (service role not needed here — user auth) ──────────
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

// ── PDF text extraction ──────────────────────────────────────────────────────
async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdf-parse v2+ uses a class-based API
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  // getText() returns an object with pages array; join all page text
  if (result && typeof result === "object" && Array.isArray(result.pages)) {
    return result.pages.map((p: { text?: string }) => p.text ?? "").join("\n");
  }
  if (result && typeof result.text === "string") return result.text;
  return String(result ?? "");
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await getSupabaseClient();

  // Auth check
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

  // Fetch project (ownership verified via RLS)
  const { data: project, error: fetchErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (fetchErr || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.source_files || project.source_files.length === 0) {
    return NextResponse.json({ error: "No source files to extract from" }, { status: 400 });
  }

  // Mark as extracting
  await supabase
    .from("projects")
    .update({ status: "extracting" })
    .eq("id", projectId);

  try {
    // ── Step 1: Download + parse all PDFs ──────────────────────────────────
    const textChunks: string[] = [];

    for (const filePath of project.source_files as string[]) {
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("project-files")
        .download(filePath);

      if (dlErr || !fileData) {
        console.warn(`Could not download ${filePath}:`, dlErr?.message);
        continue;
      }

      const buffer = Buffer.from(await fileData.arrayBuffer());
      try {
        const text = await extractPdfText(buffer);
        const filename = filePath.split("/").pop() ?? filePath;
        textChunks.push(`\n\n--- FILE: ${filename} ---\n${text}`);
      } catch (parseErr) {
        console.warn(`Could not parse PDF ${filePath}:`, parseErr);
      }
    }

    if (textChunks.length === 0) {
      throw new Error("Could not extract text from any of the uploaded files.");
    }

    // Concatenate and truncate to stay within Claude's context window
    const combined = textChunks.join("\n").slice(0, 180_000);

    // ── Step 2: Call Claude ─────────────────────────────────────────────────
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system:
        "You are a government procurement analyst. Extract fields from the " +
        "provided RFP documents and return a single valid JSON object. " +
        "CRITICAL: If you cannot find a field, set it to null. Never " +
        "fabricate, estimate, or infer values. Return ONLY valid JSON with " +
        "no markdown fences, no code blocks, and no explanatory text.",
      messages: [
        {
          role: "user",
          content:
            `Extract all procurement fields from the following RFP document text. ` +
            `Return ONLY a valid JSON object matching this schema exactly:\n\n` +
            `${EXTRACTION_SCHEMA}\n\n` +
            `For work_items and insurance_requirements, return empty arrays [] if none found.\n\n` +
            `Document text:\n${combined}`,
        },
      ],
    });

    // ── Step 3: Parse + validate Claude's response ─────────────────────────
    const raw = message.content[0].type === "text" ? message.content[0].text : "";

    // Strip any accidental markdown fences
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      throw new Error(
        `Claude returned invalid JSON. Raw response (first 500 chars): ${raw.slice(0, 500)}`
      );
    }

    // Ensure required array fields exist
    if (!Array.isArray(extracted.work_items)) extracted.work_items = [];
    if (!Array.isArray(extracted.insurance_requirements)) extracted.insurance_requirements = [];

    // ── Step 4: Save to DB ─────────────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("projects")
      .update({
        extracted_data: extracted,
        status: "review",
        // Sync bid_deadline from extracted data if not already set
        ...(extracted.bid_deadline && !project.bid_deadline
          ? { bid_deadline: null } // keep existing; deadline stays in extracted_data
          : {}),
      })
      .eq("id", projectId);

    if (updateErr) throw new Error(updateErr.message);

    return NextResponse.json({ success: true, extracted_data: extracted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    console.error("[extract]", message);

    // Revert status to draft so user can retry
    await supabase
      .from("projects")
      .update({
        status: "draft",
        extracted_data: { _extraction_error: message },
      })
      .eq("id", projectId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
