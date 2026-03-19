"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Download, Languages, Loader2, AlertCircle,
  FileText, Image as ImageIcon, Package,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/database";

type OutputFiles = {
  en_pdf?: string;
  es_pdf?: string;
  en_p1_jpg?: string;
  en_p2_jpg?: string;
  es_p1_jpg?: string;
  es_p2_jpg?: string;
};

type BlobCache = Partial<Record<keyof OutputFiles, string>>;
type PageTab = "page1" | "page2";

export default function BriefPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [outputs, setOutputs] = useState<OutputFiles>({});
  const [blobs, setBlobs] = useState<BlobCache>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enPage, setEnPage] = useState<PageTab>("page1");
  const [esPage, setEsPage] = useState<PageTab>("page1");
  const [generatingEs, setGeneratingEs] = useState(false);
  const [exportingJpg, setExportingJpg] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const blobsRef = useRef<BlobCache>({});

  // ── Load project + pre-fetch all output blobs ──────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: fetchErr } = await supabase
        .from("projects").select("*").eq("id", id).single();
      if (fetchErr || !data) { setError("Project not found."); setLoading(false); return; }
      setProject(data as Project);

      const outs = (data.output_files as OutputFiles) ?? {};
      setOutputs(outs);

      // Download all available blobs
      const keys: (keyof OutputFiles)[] = [
        "en_pdf", "es_pdf", "en_p1_jpg", "en_p2_jpg", "es_p1_jpg", "es_p2_jpg",
      ];
      const newBlobs: BlobCache = {};
      await Promise.all(
        keys.map(async (k) => {
          const path = outs[k];
          if (!path) return;
          const { data: fileData } = await supabase.storage.from("project-files").download(path);
          if (fileData) {
            const url = URL.createObjectURL(fileData);
            newBlobs[k] = url;
          }
        })
      );
      blobsRef.current = newBlobs;
      setBlobs(newBlobs);
      setLoading(false);
    }
    load();
    return () => { Object.values(blobsRef.current).forEach((u) => u && URL.revokeObjectURL(u)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Download helper ────────────────────────────────────────────────────────
  function downloadBlob(key: keyof OutputFiles, filename: string) {
    const url = blobs[key];
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
  }

  function slugTitle() {
    return project?.title?.replace(/[^a-z0-9]/gi, "-").toLowerCase() ?? "brief";
  }

  // ── Generate Spanish version ───────────────────────────────────────────────
  async function handleGenerateEs() {
    setGeneratingEs(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/generate-brief-es", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "ES generation failed");
      }
      setStatusMsg("Spanish brief generated — reloading…");
      // Re-fetch blobs for ES PDF
      const { data: updated } = await supabase.from("projects").select("output_files").eq("id", id).single();
      if (updated?.output_files) {
        const newOuts = updated.output_files as OutputFiles;
        setOutputs(newOuts);
        if (newOuts.es_pdf) {
          const { data: fileData } = await supabase.storage.from("project-files").download(newOuts.es_pdf);
          if (fileData) {
            const url = URL.createObjectURL(fileData);
            setBlobs((b) => ({ ...b, es_pdf: url }));
          }
        }
      }
      setStatusMsg("Spanish brief ready!");
    } catch (err) {
      setStatusMsg("Error: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setGeneratingEs(false);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  }

  // ── Export JPGs ────────────────────────────────────────────────────────────
  async function handleExportJpg() {
    setExportingJpg(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/export-jpg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "JPG export failed");

      const newOuts = body.output_files as OutputFiles;
      setOutputs(newOuts);
      setStatusMsg("JPGs exported — downloading blobs…");

      // Download new JPG blobs
      const jpgKeys: (keyof OutputFiles)[] = ["en_p1_jpg", "en_p2_jpg", "es_p1_jpg", "es_p2_jpg"];
      const blobUpdates: BlobCache = {};
      await Promise.all(jpgKeys.map(async (k) => {
        const path = newOuts[k];
        if (!path) return;
        const { data: fileData } = await supabase.storage.from("project-files").download(path);
        if (fileData) blobUpdates[k] = URL.createObjectURL(fileData);
      }));
      setBlobs((b) => ({ ...b, ...blobUpdates }));
      setStatusMsg(body.errors?.length ? `Done with warnings: ${body.errors.join(", ")}` : "JPGs ready!");
    } catch (err) {
      setStatusMsg("JPG error: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setExportingJpg(false);
      setTimeout(() => setStatusMsg(null), 6000);
    }
  }

  // ── Download ZIP ─────────────────────────────────────────────────────────
  async function handleDownloadZip() {
    const res = await fetch("/api/download-zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: id }),
    });
    if (!res.ok) { setStatusMsg("ZIP failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugTitle()}-vestra-brief.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasJpgs = !!(blobs.en_p1_jpg || blobs.en_p2_jpg);
  const hasEs = !!(blobs.es_pdf || blobs.es_p1_jpg);
  const hasZipContent = !!(outputs.en_pdf || outputs.es_pdf);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>

      {/* Top toolbar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-200 bg-white shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/projects/${id}`)} className="gap-2 shrink-0">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          {project && (
            <span className="text-sm font-semibold text-navy truncate max-w-[200px]">
              {project.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {statusMsg && (
            <span className={cn(
              "text-xs font-medium flex items-center gap-1 px-2",
              statusMsg.startsWith("Error") ? "text-red-600" : "text-green"
            )}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {statusMsg}
            </span>
          )}

          {/* Download individual PDFs */}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
            onClick={() => downloadBlob("en_pdf", `${slugTitle()}-en.pdf`)}
            disabled={!blobs.en_pdf}>
            <Download className="w-3.5 h-3.5" />
            EN PDF
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
            onClick={() => downloadBlob("es_pdf", `${slugTitle()}-es.pdf`)}
            disabled={!blobs.es_pdf}>
            <Download className="w-3.5 h-3.5" />
            ES PDF
          </Button>

          {/* Export JPGs */}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
            onClick={handleExportJpg}
            disabled={exportingJpg || (!outputs.en_pdf && !outputs.es_pdf)}>
            {exportingJpg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            {exportingJpg ? "Exporting…" : "Export JPGs"}
          </Button>

          {/* Download ZIP */}
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
            onClick={handleDownloadZip}
            disabled={!hasZipContent}>
            <Package className="w-3.5 h-3.5" />
            Download All (ZIP)
          </Button>

          {/* Generate Spanish */}
          <Button size="sm" variant="default" className="gap-1.5 text-xs h-8"
            onClick={handleGenerateEs}
            disabled={generatingEs || !outputs.en_pdf}>
            {generatingEs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
            {generatingEs ? "Generating…" : hasEs ? "Regenerate ES" : "Generate Spanish"}
          </Button>
        </div>
      </div>

      {/* Main viewer area */}
      <div className="flex-1 overflow-hidden bg-gray-100">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-navy animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500">Loading brief…</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && !blobs.en_pdf && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">No brief generated yet</p>
              <Button variant="outline" size="sm" className="mt-4"
                onClick={() => router.push(`/projects/${id}`)}>
                Back to Project
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && (blobs.en_pdf || blobs.en_p1_jpg) && (
          <div className="flex h-full gap-0">
            {/* EN panel */}
            <PdfPanel
              lang="EN"
              pdfUrl={blobs.en_pdf}
              p1Url={blobs.en_p1_jpg}
              p2Url={blobs.en_p2_jpg}
              page={enPage}
              onPageChange={setEnPage}
              hasJpgs={hasJpgs}
            />

            {/* Divider */}
            <div className="w-px bg-gray-300 shrink-0" />

            {/* ES panel */}
            {hasEs ? (
              <PdfPanel
                lang="ES"
                pdfUrl={blobs.es_pdf}
                p1Url={blobs.es_p1_jpg}
                p2Url={blobs.es_p2_jpg}
                page={esPage}
                onPageChange={setEsPage}
                hasJpgs={hasJpgs}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-xs px-6">
                  <Languages className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-500 mb-1">Spanish version not generated</p>
                  <p className="text-xs text-gray-400 mb-4">
                    Click &ldquo;Generate Spanish&rdquo; above to create the ES brief using Claude AI translation.
                  </p>
                  <Button size="sm" onClick={handleGenerateEs}
                    disabled={generatingEs || !outputs.en_pdf} className="gap-2">
                    {generatingEs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                    {generatingEs ? "Generating…" : "Generate Spanish"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* JPG thumbnail strip */}
      {hasJpgs && (
        <div className="shrink-0 border-t border-gray-200 bg-white px-5 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            JPG Exports — 300 DPI (for social / print)
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {([
              { key: "en_p1_jpg", label: "EN · Page 1", file: `${slugTitle()}-en-p1.jpg` },
              { key: "en_p2_jpg", label: "EN · Page 2", file: `${slugTitle()}-en-p2.jpg` },
              { key: "es_p1_jpg", label: "ES · Page 1", file: `${slugTitle()}-es-p1.jpg` },
              { key: "es_p2_jpg", label: "ES · Page 2", file: `${slugTitle()}-es-p2.jpg` },
            ] as { key: keyof OutputFiles; label: string; file: string }[]).map(({ key, label, file }) => {
              const url = blobs[key];
              if (!url) return null;
              return (
                <div key={key} className="shrink-0 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={label}
                    className="h-20 w-auto border border-gray-200 rounded shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => downloadBlob(key, file)}
                    title={`Download ${label}`}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">{label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Panel sub-component ───────────────────────────────────────────────────────
function PdfPanel({
  lang, pdfUrl, p1Url, p2Url, page, onPageChange, hasJpgs,
}: {
  lang: string;
  pdfUrl?: string;
  p1Url?: string;
  p2Url?: string;
  page: PageTab;
  onPageChange: (p: PageTab) => void;
  hasJpgs: boolean;
}) {
  const activeImgUrl = page === "page1" ? p1Url : p2Url;
  const showImageViewer = hasJpgs && (p1Url || p2Url);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-gray-200 shrink-0">
        <span className="text-xs font-bold text-navy tracking-wide">{lang} — English Brief</span>
        {showImageViewer && (
          <div className="flex border border-gray-200 rounded overflow-hidden text-[11px]">
            {(["page1", "page2"] as PageTab[]).map((p) => (
              <button key={p} onClick={() => onPageChange(p)}
                className={cn(
                  "px-2.5 py-1 transition-colors",
                  page === p ? "bg-navy text-white" : "text-gray-500 hover:bg-gray-50"
                )}>
                {p === "page1" ? "Page 1" : "Page 2"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Viewer */}
      <div className="flex-1 overflow-hidden">
        {showImageViewer && activeImgUrl ? (
          <div className="h-full overflow-auto flex items-start justify-center bg-gray-100 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeImgUrl} alt={`${lang} ${page}`}
              className="max-w-full shadow-lg border border-gray-300"
              style={{ maxHeight: "none" }}
            />
          </div>
        ) : pdfUrl ? (
          <iframe src={pdfUrl} className="w-full h-full border-0" title={`${lang} Brief`} />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <p className="text-sm text-gray-400">Not available</p>
          </div>
        )}
      </div>
    </div>
  );
}
