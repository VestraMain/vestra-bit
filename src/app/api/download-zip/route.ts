import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const outputs = (project.output_files as Record<string, string>) ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extracted = (project.extracted_data as Record<string, any>) ?? {};
  const bidNum = extracted.bid_number
    ? String(extracted.bid_number).replace(/[^a-z0-9]/gi, "-").toLowerCase()
    : projectId.slice(0, 8);
  const zipName = `${bidNum}-vestra-brief.zip`;

  // Files to bundle: en_pdf, es_pdf, en_p1_jpg, en_p2_jpg, es_p1_jpg, es_p2_jpg
  const fileMap: Record<string, string> = {
    en_pdf:    "vestra-brief-en.pdf",
    es_pdf:    "vestra-brief-es.pdf",
    en_p1_jpg: "vestra-brief-en-page1.jpg",
    en_p2_jpg: "vestra-brief-en-page2.jpg",
    es_p1_jpg: "vestra-brief-es-page1.jpg",
    es_p2_jpg: "vestra-brief-es-page2.jpg",
  };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const JSZip = require("jszip");
  const zip = new JSZip();
  let hasAnyFile = false;

  for (const [outputKey, zipFilename] of Object.entries(fileMap)) {
    const storagePath = outputs[outputKey];
    if (!storagePath) continue;
    try {
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("project-files").download(storagePath);
      if (dlErr || !fileData) continue;
      zip.file(zipFilename, await fileData.arrayBuffer());
      hasAnyFile = true;
    } catch {
      // skip missing files silently
    }
  }

  if (!hasAnyFile) {
    return NextResponse.json({ error: "No output files available to download" }, { status: 400 });
  }

  const zipBuffer = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  }) as ArrayBuffer;

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Content-Length": String(zipBuffer.byteLength),
    },
  });
}
