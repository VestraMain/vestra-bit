import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 30;

// Minimal valid 1-page PDF with a "Hello World" text string
const MINIMAL_PDF_B64 =
  "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqIDIgMCBv" +
  "Ymk8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iaiAzIDAgb2JqPDwvVHlw" +
  "ZS9QYWdlL01lZGlhQm94WzAgMCA2MTIgNzkyXS9SZXNvdXJjZXM8PC9Gb250PDwvRjE8PC9UeXBl" +
  "L0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+Pj4+Pj4vQ29udGVudHMgNCAw" +
  "IFIvUGFyZW50IDIgMCBSPj5lbmRvYmogNCAwIG9iajw8L0xlbmd0aCA0ND4+c3RyZWFtCkJUCi9G" +
  "MSAxMiBUZgo3MiA3MjAgVGQKKEhlbGxvIFdvcmxkKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhy" +
  "ZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZgowMDAwMDAwMDA5IDAwMDAwIG4KMDAwMDAwMDA1OCAw" +
  "MDAwMCBuCjAwMDAwMDAxMTUgMDAwMDAgbgowMDAwMDAwMjk4IDAwMDAwIG4KdHJhaWxlcjw8L1Np" +
  "emUgNS9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjM5MgolJUVPRg==";

interface CheckResult {
  ok: boolean;
  detail: string;
  error?: string;
}

export async function GET() {
  const results: Record<string, CheckResult> = {};

  // ── Check 1: ANTHROPIC_API_KEY ────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  results.anthropic_api_key = apiKey
    ? { ok: true, detail: `Set (length: ${apiKey.length}, prefix: ${apiKey.slice(0, 7)}…)` }
    : { ok: false, detail: "NOT set — ANTHROPIC_API_KEY env var is missing", error: "Missing env var" };

  // ── Check 2: Supabase env vars ────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  results.supabase_env = (supabaseUrl && supabaseKey)
    ? { ok: true, detail: `URL: ${supabaseUrl}` }
    : { ok: false, detail: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY", error: "Missing env vars" };

  // ── Check 3: Supabase Storage reachability ────────────────────────────────
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      supabaseUrl!,
      supabaseKey!,
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

    const { data, error } = await supabase.storage
      .from("project-files")
      .list("", { limit: 1 });

    results.supabase_storage = error
      ? { ok: false, detail: `Bucket list failed: ${error.message}`, error: error.message }
      : { ok: true, detail: `Reachable. Found ${data?.length ?? 0} item(s) at bucket root.` };
  } catch (e) {
    results.supabase_storage = {
      ok: false,
      detail: "Exception while connecting to Supabase",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── Check 4: unpdf (primary extractor) ───────────────────────────────────
  try {
    const { extractText } = await import("unpdf");
    const pdfBuffer = Buffer.from(MINIMAL_PDF_B64, "base64");
    const { text, totalPages } = await extractText(new Uint8Array(pdfBuffer), {
      mergePages: true,
    });
    const extracted = (text ?? "").trim();
    results.unpdf_extraction = {
      ok: true,
      detail: `Loaded ${totalPages} page(s). Extracted: "${extracted || "(empty)"}"`,
    };
  } catch (e) {
    results.unpdf_extraction = {
      ok: false,
      detail: "unpdf extraction failed",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── Check 5: pdf-parse PDFParse (fallback extractor) ─────────────────────
  try {
    const { PDFParse } = await import("pdf-parse");
    const pdfBuffer = Buffer.from(MINIMAL_PDF_B64, "base64");
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    const result = await parser.getText();
    const pages: { text?: string }[] = Array.isArray(result?.pages) ? result.pages : [];
    const text = pages.map((p) => p.text ?? "").join(" ").trim();
    results.pdf_parse_extraction = {
      ok: true,
      detail: `Loaded ${pages.length} page(s). Extracted: "${text || "(empty)"}"`,
    };
  } catch (e) {
    results.pdf_parse_extraction = {
      ok: false,
      detail: "pdf-parse PDFParse fallback failed",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── Check 6: DOMMatrix availability (needed by pdfjs-dist for JPG export) ─
  results.dom_matrix = typeof globalThis.DOMMatrix !== "undefined"
    ? { ok: true, detail: "DOMMatrix is available in this runtime" }
    : { ok: false, detail: "DOMMatrix is NOT defined — export-jpg polyfill will handle this", error: "Missing browser global (expected on Vercel Node.js)" };

  // ── Check 7: Node.js runtime info ─────────────────────────────────────────
  results.runtime_info = {
    ok: true,
    detail: `Node.js ${process.version} | Platform: ${process.platform} | Arch: ${process.arch}`,
  };

  const allCriticalOk =
    results.anthropic_api_key.ok &&
    results.supabase_env.ok &&
    results.supabase_storage.ok &&
    results.unpdf_extraction.ok;

  return NextResponse.json(
    {
      status: allCriticalOk ? "all_ok" : "issues_found",
      note: "dom_matrix failure is expected on Vercel Node.js — the export-jpg route installs a polyfill",
      checks: results,
    },
    { status: allCriticalOk ? 200 : 500 }
  );
}
