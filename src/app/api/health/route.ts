import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

export async function GET() {
  try {
    // Verify unpdf loads and can extract text — this is the critical check
    // that was failing with "DOMMatrix is not defined" before the fix
    const { extractText } = await import("unpdf");

    const pdfBuffer = Buffer.from(TEST_PDF_B64, "base64");
    const { text, totalPages } = await extractText(new Uint8Array(pdfBuffer), {
      mergePages: true,
    });

    return NextResponse.json({
      status: "ok",
      unpdf: true,
      test: {
        pages: totalPages,
        text: (text ?? "").trim(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        unpdf: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
