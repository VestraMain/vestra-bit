import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";

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

interface QAPair {
  question: string;
  answer: string;
}

interface OutreachStrategy {
  who: string;
  lead_with: string;
  objections: string;
}

interface TeamTips {
  likely_questions: QAPair[];
  disqualification_risks: string[];
  technical_talking_points: string[];
  ideal_contractor_profile: string;
  outreach_strategy: OutreachStrategy;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (project.extracted_data as Record<string, any>) ?? {};

  const title = String(data.title ?? data.project_name ?? "Government Contract");
  const agency = String(data.issuing_agency ?? data.agency ?? "");
  const bidNumber = String(data.bid_number ?? "");
  const scope = String(data.scope_of_work ?? data.project_description ?? "");
  const requirements = Array.isArray(data.minimum_requirements)
    ? data.minimum_requirements.join("; ")
    : String(data.minimum_requirements ?? "");
  const workItems = Array.isArray(data.work_items)
    ? data.work_items.join("; ")
    : String(data.work_items ?? "");
  const naicsCodes = Array.isArray(data.naics_codes)
    ? data.naics_codes.join(", ")
    : String(data.naics_codes ?? "");
  const setAsideCodes = String(data.set_aside_codes ?? "");
  const bondingReqs = String(data.bonding_requirements ?? "");
  const insuranceReqs = Array.isArray(data.insurance_requirements)
    ? data.insurance_requirements.join("; ")
    : String(data.insurance_requirements ?? "");
  const estimatedValue = String(data.estimated_value ?? "");
  const submissionDeadline = String(data.submission_deadline ?? data.due_date ?? "");

  const context = `
Project Title: ${title}
Bid Number: ${bidNumber}
Issuing Agency: ${agency}
Estimated Value: ${estimatedValue}
Submission Deadline: ${submissionDeadline}
NAICS Codes: ${naicsCodes}
Set-Aside Codes: ${setAsideCodes}
Scope of Work: ${scope.slice(0, 600)}
Minimum Requirements: ${requirements}
Work Items: ${workItems}
Bonding Requirements: ${bondingReqs}
Insurance Requirements: ${insuranceReqs}
`.trim();

  const prompt = `You are an expert government contracting advisor. Analyze this RFP/bid opportunity and generate strategic intelligence for a sales and business development team.

Contract Data:
${context}

Return a JSON object with EXACTLY this structure (no markdown, no explanation, raw JSON only):
{
  "likely_questions": [
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."}
  ],
  "disqualification_risks": [
    "Risk description 1",
    "Risk description 2",
    "Risk description 3"
  ],
  "technical_talking_points": [
    "Talking point 1",
    "Talking point 2",
    "Talking point 3",
    "Talking point 4",
    "Talking point 5"
  ],
  "ideal_contractor_profile": "A concise 2-3 sentence description of the ideal contractor for this opportunity.",
  "outreach_strategy": {
    "who": "Who to contact at the agency (role/title)",
    "lead_with": "What value proposition to lead with in outreach",
    "objections": "Common objections and how to overcome them"
  }
}

Guidelines:
- likely_questions: Questions the agency may ask during evaluation, with strategic answers a contractor should give
- disqualification_risks: Specific requirements that could disqualify a contractor if not met (licensing, bonding, set-aside status, etc.)
- technical_talking_points: Key differentiators or capabilities to highlight when pitching for this contract
- ideal_contractor_profile: Describe the perfect contractor for this bid (size, experience, certifications, location)
- outreach_strategy: Tactical advice for pursuing this opportunity proactively`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText = msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";

  let teamTips: TeamTips;
  try {
    // Strip markdown code fences if present
    const cleaned = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    teamTips = JSON.parse(cleaned) as TeamTips;
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  const { error: updateErr } = await supabase
    .from("projects")
    .update({ team_tips: teamTips })
    .eq("id", projectId);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to save team tips" }, { status: 500 });
  }

  return NextResponse.json({ success: true, team_tips: teamTips });
}
