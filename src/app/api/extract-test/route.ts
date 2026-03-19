import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 30;

// Minimal valid 1-page PDF with a text string ("Hello")
// Generated with: python3 -c "import base64; ..."
const MINIMAL_PDF_B64 =
  "JVBERi0xLjAKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqIDIgMCBv" +
  "Ymk8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iaiAzIDAgb2JqPDwvVHlw" +
  "ZS9QYWdlL01lZGlhQm94WzAgMCA2MTIgNzkyXS9SZXNvdXJjZXM8PC9Gb250PDwvRjE8PC9UeXBl" +
  "L0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+Pj4+Pj4vQ29udGVudHMgNCAw" +
  "IFI+PmVuZG9iaiA0IDAgb2JqPDwvTGVuZ3RoIDQ0Pj5zdHJlYW0KQlQKL0YxIDEyIFRmCjcyIDcw" +
  "MCBUZAooSGVsbG8gV29ybGQpIFRqCkVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAw" +
  "MDAwMCA2NTUzNSBmCjAwMDAwMDAwMDkgMDAwMDAgbgowMDAwMDAwMDU4IDAwMDAwIG4KMDAwMDAwMDEx" +
  "NSAwMDAwMCBuCjAwMDAwMDAyOTAgMDAwMDAgbgp0cmFpbGVyPDwvU2l6ZSA1L1Jvb3QgMSAwIFI+" +
  "PgpzdGFydHhyZWYKMzg0CiUlRU9G";

interface CheckResult {
  ok: boolean;
  detail: string;
  error?: string;
}

export async function GET() {
  const results: Record<string, CheckResult> = {};

  // ── Check 1: ANTHROPIC_API_KEY is set ────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  results.anthropic_api_key = apiKey
    ? { ok: true, detail: `Set (length: ${apiKey.length}, prefix: ${apiKey.slice(0, 7)}…)` }
    : { ok: false, detail: "NOT set — ANTHROPIC_API_KEY env var is missing", error: "Missing env var" };

  // ── Check 2: Supabase Storage reachability ───────────────────────────────
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
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

    // List the root of the project-files bucket (lightweight check)
    const { data, error } = await supabase.storage
      .from("project-files")
      .list("", { limit: 1 });

    if (error) {
      results.supabase_storage = {
        ok: false,
        detail: `Bucket list failed: ${error.message}`,
        error: error.message,
      };
    } else {
      results.supabase_storage = {
        ok: true,
        detail: `Reachable. Found ${data?.length ?? 0} item(s) at bucket root.`,
      };
    }
  } catch (e) {
    results.supabase_storage = {
      ok: false,
      detail: "Exception while connecting to Supabase",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── Check 3: pdfjs-dist can load and extract text from a PDF buffer ───────
  try {
    const { createRequire } = await import("module");
    const path = await import("path");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const r = createRequire(import.meta.url);
    const pdfjsBase = path.dirname(r.resolve("pdfjs-dist/package.json"));
    const workerPath = `${pdfjsBase}/legacy/build/pdf.worker.mjs`;
    pdfjs.GlobalWorkerOptions.workerSrc = workerPath;

    const pdfBuffer = Buffer.from(MINIMAL_PDF_B64, "base64");
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      verbosity: 0,
    });
    const doc = await loadingTask.promise;
    const numPages = doc.numPages;

    // Extract text from page 1
    const page = await doc.getPage(1);
    const tc = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = tc.items.map((it: any) => ("str" in it ? it.str : "")).join(" ").trim();

    results.pdfjs_text_extraction = {
      ok: true,
      detail: `Loaded ${numPages} page(s). Extracted text: "${text || "(empty — test PDF may have no text layer)"}"`,
    };
  } catch (e) {
    results.pdfjs_text_extraction = {
      ok: false,
      detail: "pdfjs-dist text extraction failed",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── Check 4: Node.js runtime info ────────────────────────────────────────
  results.runtime_info = {
    ok: true,
    detail: `Node.js ${process.version} | Platform: ${process.platform} | Arch: ${process.arch}`,
  };

  // ── Check 5: NEXT_PUBLIC_SUPABASE_URL is set ─────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  results.supabase_url = supabaseUrl
    ? { ok: true, detail: `Set: ${supabaseUrl}` }
    : { ok: false, detail: "NEXT_PUBLIC_SUPABASE_URL is not set", error: "Missing env var" };

  const allOk = Object.values(results).every((r) => r.ok);

  return NextResponse.json(
    {
      status: allOk ? "all_ok" : "issues_found",
      checks: results,
    },
    { status: allOk ? 200 : 500 }
  );
}
