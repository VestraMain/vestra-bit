import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 30;

// Valid single-page PDF generated with pdfkit — contains "Health check: PDF extraction OK"
const TEST_PDF_B64 =
  "JVBERi0xLjMKJf////8KNyAwIG9iago8PAovVHlwZSAvUGFnZQovUGFyZW50IDEgMCBSCi9NZWRp" +
  "YUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA1IDAgUgovUmVzb3VyY2VzIDYgMCBSCi9Vc2Vy" +
  "VW5pdCAxCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9Qcm9jU2V0IFsvUERGIC9UZXh0IC9JbWFnZUIg" +
  "L0ltYWdlQyAvSW1hZ2VJXQovRm9udCA8PAovRjEgOCAwIFIKPj4KL0NvbG9yU3BhY2UgPDwKPj4K" +
  "Pj4KZW5kb2JqCjUgMCBvYmoKPDwKL0xlbmd0aCAxMzAKL0ZpbHRlciAvRmxhdGVEZWNvZGUKPj4K" +
  "c3RyZWFtCnicZYu9CsJAEAb7fYrvBdT9u90LHFcIWtgJ14mFCaZL4fs3ErCznGFGwGAcBIycFMtG" +
  "H5I/dx4/KSiMNDtadYyNTleBKMZKj+Y1Skgs6VGVw2Jn61BGi9lefX+bcmF3D+UoHcZoWdNTO2Tv" +
  "JCw9pljjreyrzx38xLjRZdCdvs/nI7sKZW5kc3RyZWFtCmVuZG9iagoxMCAwIG9iagooUERGS2l0" +
  "KQplbmRvYmoKMTEgMCBvYmoKKFBERktpdCkKZW5kb2JqCjEyIDAgb2JqCihEOjIwMjYwMzIwMjIw" +
  "NjEyWikKZW5kb2JqCjkgMCBvYmoKPDwKL1Byb2R1Y2VyIDEwIDAgUgovQ3JlYXRvciAxMSAwIFIK" +
  "L0NyZWF0aW9uRGF0ZSAxMiAwIFIKPj4KZW5kb2JqCjggMCBvYmoKPDwKL1R5cGUgL0ZvbnQKL0Jh" +
  "c2VGb250IC9IZWx2ZXRpY2EKL1N1YnR5cGUgL1R5cGUxCi9FbmNvZGluZyAvV2luQW5zaUVuY29k" +
  "aW5nCj4+CmVuZG9iago0IDAgb2JqCjw8Cj4+CmVuZG9iagozIDAgb2JqCjw8Ci9UeXBlIC9DYXRh" +
  "bG9nCi9QYWdlcyAxIDAgUgovTmFtZXMgMiAwIFIKPj4KZW5kb2JqCjEgMCBvYmoKPDwKL1R5cGUg" +
  "L1BhZ2VzCi9Db3VudCAxCi9LaWRzIFs3IDAgUl0KPj4KZW5kb2JqCjIgMCBvYmoKPDwKL0Rlc3Rz" +
  "IDw8CiAgL05hbWVzIFsKXQo+Pgo+PgplbmRvYmoKeHJlZgowIDEzCjAwMDAwMDAwMDAgNjU1MzUg" +
  "ZiAKMDAwMDAwMDc4MSAwMDAwMCBuIAowMDAwMDAwODM4IDAwMDAwIG4gCjAwMDAwMDA3MTkgMDAw" +
  "MDAgbiAKMDAwMDAwMDY5OCAwMDAwMCBuIAowMDAwMDAwMjM4IDAwMDAwIG4gCjAwMDAwMDAxMzEg" +
  "MDAwMDAgbiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwNjAxIDAwMDAwIG4gCjAwMDAwMDA1" +
  "MjYgMDAwMDAgbiAKMDAwMDAwMDQ0MCAwMDAwMCBuIAowMDAwMDAwNDY1IDAwMDAwIG4gCjAwMDAw" +
  "MDA0OTAgMDAwMDAgbiAKdHJhaWxlcgo8PAovU2l6ZSAxMwovUm9vdCAzIDAgUgovSW5mbyA5IDAg" +
  "UgovSUQgWzxmNjI0M2JlODljNWZmMmIwZTIzZWM3ZTdmMDUzNmEzYj4gPGY2MjQzYmU4OWM1ZmYy" +
  "YjBlMjNlYzdlN2YwNTM2YTNiPl0KPj4Kc3RhcnR4cmVmCjg4NQolJUVPRgo=";

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
    const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    });
    const { data, error } = await supabase.storage.from("project-files").list("", { limit: 1 });
    results.supabase_storage = error
      ? { ok: false, detail: `Bucket list failed: ${error.message}`, error: error.message }
      : { ok: true, detail: `Reachable. Found ${data?.length ?? 0} item(s) at bucket root.` };
  } catch (e) {
    results.supabase_storage = {
      ok: false,
      detail: "Exception connecting to Supabase",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── Check 4: unpdf extraction (the only PDF extractor used in /api/extract) ─
  try {
    const { extractText } = await import("unpdf");
    const pdfBuffer = Buffer.from(TEST_PDF_B64, "base64");
    const { text, totalPages } = await extractText(new Uint8Array(pdfBuffer), { mergePages: true });
    const extracted = (text ?? "").trim();
    results.unpdf_extraction = {
      ok: true,
      detail: `Loaded ${totalPages} page(s). Extracted: "${extracted || "(empty)"}"`,
    };
  } catch (e) {
    results.unpdf_extraction = {
      ok: false,
      detail: "unpdf extraction failed — this will break /api/extract",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // ── Check 5: Node.js runtime info ─────────────────────────────────────────
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
    { status: allCriticalOk ? "all_ok" : "issues_found", checks: results },
    { status: allCriticalOk ? 200 : 500 }
  );
}
