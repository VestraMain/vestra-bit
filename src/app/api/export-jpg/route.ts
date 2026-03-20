import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 120;

// pdf-to-img uses pdfjs-dist for rendering, which needs DOMMatrix.
// Vercel's Node.js runtime doesn't provide browser globals, so we polyfill
// it before any pdfjs-dist import can run. Only rendering (canvas) needs
// DOMMatrix — text extraction never uses it.
/* eslint-disable @typescript-eslint/no-explicit-any */
if (typeof globalThis.DOMMatrix === "undefined") {
  // Minimal stub so pdfjs-dist passes its global check at load time.
  // Real matrix math runs inside the canvas worker; this satisfies the
  // instanceof / typeof checks that happen before actual rendering.
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true; isIdentity = true;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(init?: unknown) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    multiply(other: unknown) { return new (globalThis as any).DOMMatrix(); }
    inverse() { return new (globalThis as any).DOMMatrix(); }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    translate(...args: number[]) { return new (globalThis as any).DOMMatrix(); }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    scale(...args: number[]) { return new (globalThis as any).DOMMatrix(); }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    rotate(...args: number[]) { return new (globalThis as any).DOMMatrix(); }
    transformPoint(pt?: { x?: number; y?: number }) { return { x: pt?.x ?? 0, y: pt?.y ?? 0 }; }
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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

// ── Convert one PDF buffer → array of JPG buffers (one per page) ──────────────
async function pdfToJpgs(pdfBuffer: Buffer): Promise<Buffer[]> {
  // pdf-to-img v5 is ESM-only — use dynamic import
  const { pdf } = await import("pdf-to-img");

  // scale = 300/72 ≈ 4.167 → US Letter at 300 DPI (2550 × 3300 px)
  const scale = 300 / 72;
  const pages: Buffer[] = [];

  for await (const pngPage of await pdf(pdfBuffer, { scale })) {
    // pngPage is already a Buffer (PNG). Convert to JPG with sharp.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = require("sharp");
    const jpgBuf: Buffer = await sharp(pngPage)
      .jpeg({ quality: 92, mozjpeg: false })
      .toBuffer();
    pages.push(jpgBuf);
  }
  return pages;
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
  const results: Record<string, string> = { ...outputs };
  const errors: string[] = [];

  // Process EN and ES PDFs
  const pdfsToProcess: Array<{ key: "en_pdf" | "es_pdf"; p1Key: string; p2Key: string }> = [
    { key: "en_pdf", p1Key: "en_p1_jpg", p2Key: "en_p2_jpg" },
    { key: "es_pdf", p1Key: "es_p1_jpg", p2Key: "es_p2_jpg" },
  ];

  for (const { key, p1Key, p2Key } of pdfsToProcess) {
    const pdfPath = outputs[key];
    if (!pdfPath) continue; // skip if PDF not yet generated

    try {
      const { data: fileData, error: dlErr } = await supabase.storage
        .from("project-files").download(pdfPath);
      if (dlErr || !fileData) { errors.push(`Could not download ${key}`); continue; }

      const pdfBuf = Buffer.from(await fileData.arrayBuffer());
      const pages = await pdfToJpgs(pdfBuf);

      const lang = key.startsWith("en") ? "en" : "es";
      for (let i = 0; i < Math.min(pages.length, 2); i++) {
        const jpgPath = `${user.id}/${projectId}/brief-${lang}-p${i + 1}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("project-files")
          .upload(jpgPath, pages[i], { contentType: "image/jpeg", upsert: true });
        if (upErr) { errors.push(`Upload failed for page ${i + 1} of ${key}`); continue; }
        results[i === 0 ? p1Key : p2Key] = jpgPath;
      }
    } catch (err) {
      errors.push(`Failed to convert ${key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Save updated output_files
  await supabase.from("projects")
    .update({ output_files: results })
    .eq("id", projectId);

  if (errors.length > 0 && Object.keys(results).length === Object.keys(outputs).length) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }
  return NextResponse.json({ success: true, output_files: results, errors });
}
