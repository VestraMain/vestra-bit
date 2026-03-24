import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

interface SocialPlatformContent {
  en: string;
  es: string;
}

interface SocialCopy {
  instagram: SocialPlatformContent;
  facebook: SocialPlatformContent;
  tiktok: SocialPlatformContent;
}

async function generatePlatformCopy(
  extractedData: Record<string, unknown>,
  platform: "instagram" | "facebook" | "tiktok"
): Promise<SocialPlatformContent> {
  const title = String(extractedData.title ?? extractedData.project_name ?? "Government Contract");
  const agency = String(extractedData.issuing_agency ?? extractedData.agency ?? "");
  const bidNumber = String(extractedData.bid_number ?? "");
  const valueStr = extractedData.estimated_value
    ? `Estimated value: $${extractedData.estimated_value}`
    : "";
  const dueDate = extractedData.submission_deadline ?? extractedData.due_date ?? "";
  const scope = String(extractedData.scope_of_work ?? extractedData.project_description ?? "");
  const naicsCodes = Array.isArray(extractedData.naics_codes)
    ? extractedData.naics_codes.join(", ")
    : String(extractedData.naics_codes ?? "");

  const dataContext = `
Project Title: ${title}
Bid Number: ${bidNumber}
Issuing Agency: ${agency}
${valueStr}
Due Date: ${dueDate}
NAICS Codes: ${naicsCodes}
Scope: ${scope.slice(0, 500)}
`.trim();

  const platformInstructions: Record<typeof platform, string> = {
    instagram: `Create an Instagram post in ENGLISH (150-220 words) announcing this government contract opportunity.
Use an engaging hook, highlight key details (agency, value, deadline), include a call-to-action for contractors to get the full brief.
End with 15-20 relevant hashtags on a new line (mix of #GovCon, #GOVCON, #SmallBusiness, #FederalContracting, industry-specific tags).
Format: Post text first, then hashtags separated by a blank line.`,

    facebook: `Create a Facebook post in ENGLISH (80-120 words) announcing this government contract opportunity.
Professional but accessible tone. Include key details and a strong call-to-action.
End with 3-5 relevant hashtags inline or at the end.`,

    tiktok: `Create a TikTok video script in ENGLISH for announcing this government contract opportunity.
Format with exactly these sections:
HOOK: (5-10 words to grab attention in first 3 seconds)
KEY FACTS: (3-5 bullet points with key details, one per line starting with •)
CTA: (10-15 words call-to-action)
Keep total script under 150 words. Conversational and energetic tone.`,
  };

  const enPrompt = `${platformInstructions[platform]}

Contract Data:
${dataContext}

Return ONLY the post text, no explanations or metadata.`;

  const esInstructions: Record<typeof platform, string> = {
    instagram: `Crea una publicación de Instagram en ESPAÑOL (150-220 palabras) anunciando esta oportunidad de contrato gubernamental.
Usa un gancho atractivo, destaca los detalles clave (agencia, valor, fecha límite), incluye un llamado a la acción para que los contratistas obtengan el brief completo.
Termina con 15-20 hashtags relevantes en una nueva línea (mezcla de #ContratoGubernamental, #GOVCON, #PequeñaEmpresa, #ContratacionFederal, etiquetas específicas de la industria).
Formato: Texto del post primero, luego hashtags separados por una línea en blanco.`,

    facebook: `Crea una publicación de Facebook en ESPAÑOL (80-120 palabras) anunciando esta oportunidad de contrato gubernamental.
Tono profesional pero accesible. Incluye detalles clave y un fuerte llamado a la acción.
Termina con 3-5 hashtags relevantes.`,

    tiktok: `Crea un guión para video de TikTok en ESPAÑOL para anunciar esta oportunidad de contrato gubernamental.
Formato con exactamente estas secciones:
GANCHO: (5-10 palabras para captar atención en los primeros 3 segundos)
DATOS CLAVE: (3-5 puntos con detalles clave, uno por línea empezando con •)
CTA: (10-15 palabras de llamado a la acción)
Mantén el guión total bajo 150 palabras. Tono conversacional y enérgico.`,
  };

  const esPrompt = `${esInstructions[platform]}

Datos del Contrato:
${dataContext}

Devuelve SOLO el texto del post, sin explicaciones ni metadatos.`;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const [enResult, esResult] = await Promise.all([
    model.generateContent(enPrompt),
    model.generateContent(esPrompt),
  ]);

  const en = enResult.response.text().trim();
  const es = esResult.response.text().trim();

  return { en, es };
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
  const extractedData = (project.extracted_data as Record<string, any>) ?? {};

  const [instagram, facebook, tiktok] = await Promise.all([
    generatePlatformCopy(extractedData, "instagram"),
    generatePlatformCopy(extractedData, "facebook"),
    generatePlatformCopy(extractedData, "tiktok"),
  ]);

  const socialCopy: SocialCopy = { instagram, facebook, tiktok };

  const { error: updateErr } = await supabase
    .from("projects")
    .update({ social_copy: socialCopy })
    .eq("id", projectId);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to save social copy" }, { status: 500 });
  }

  return NextResponse.json({ success: true, social_copy: socialCopy });
}
