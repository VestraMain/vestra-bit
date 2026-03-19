"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Languages, Loader2, AlertCircle, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { Project } from "@/types/database";

export default function BriefPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabase
        .from("projects").select("*").eq("id", id).single();
      if (fetchErr || !data) { setError("Project not found."); setLoading(false); return; }
      setProject(data as Project);

      const outputs = (data.output_files as Record<string, string> | null) ?? {};
      const path = outputs.en_pdf;
      if (!path) { setLoading(false); return; }

      const { data: fileData, error: dlErr } = await supabase.storage
        .from("project-files").download(path);
      if (dlErr || !fileData) { setError("Could not load PDF."); setLoading(false); return; }

      const url = URL.createObjectURL(fileData);
      objectUrlRef.current = url;
      setPdfUrl(url);
      setLoading(false);
    }
    load();
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleDownload() {
    if (!pdfUrl || !project) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `vestra-bit-${project.title?.replace(/[^a-z0-9]/gi, "-").toLowerCase() ?? "brief"}.pdf`;
    a.click();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/projects/${id}`)} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Project
          </Button>
          {project && (
            <span className="text-sm font-semibold text-navy line-clamp-1 max-w-xs">
              {project.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled
            title="Coming in Phase 4"
          >
            <Languages className="w-4 h-4" />
            Generate Spanish Version
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleDownload}
            disabled={!pdfUrl}
          >
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Viewer area */}
      <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-hidden">
        {loading && (
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-navy animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading brief…</p>
          </div>
        )}

        {error && (
          <div className="text-center max-w-sm">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        {!loading && !error && !pdfUrl && (
          <div className="text-center max-w-sm">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No brief generated yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Go back to the project and click &ldquo;Generate Brief&rdquo;.
            </p>
            <Button
              variant="outline" size="sm" className="mt-4"
              onClick={() => router.push(`/projects/${id}`)}
            >
              Back to Project
            </Button>
          </div>
        )}

        {pdfUrl && (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Bid Intelligence Brief"
          />
        )}
      </div>
    </div>
  );
}
