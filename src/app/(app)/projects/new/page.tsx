"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
  Upload,
  X,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface UploadedFile {
  file: File;
  name: string;
  size: number;
  progress: number;
  status: "pending" | "uploading" | "done" | "error";
  storagePath?: string;
  error?: string;
}

type ExtractionPhase =
  | "idle"
  | "creating"
  | "uploading"
  | "parsing"
  | "analyzing"
  | "structuring"
  | "done"
  | "error";

const STEPS = [
  { id: 1, label: "Project Info" },
  { id: 2, label: "Upload Files" },
  { id: 3, label: "Extract & Analyze" },
];

const PHASE_MESSAGES: Record<ExtractionPhase, string> = {
  idle: "",
  creating: "Creating project…",
  uploading: "Uploading documents…",
  parsing: "Parsing documents…",
  analyzing: "Analyzing content with Claude AI…",
  structuring: "Structuring extracted data…",
  done: "Extraction complete!",
  error: "",
};


export default function NewProjectPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [bidDeadline, setBidDeadline] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const [phase, setPhase] = useState<ExtractionPhase>("idle");
  const [extractError, setExtractError] = useState<string | null>(null);

  // ── File helpers ──────────────────────────────────────────────────────────
  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const pdfs = Array.from(newFiles).filter((f) => f.type === "application/pdf");
    if (pdfs.length === 0) return;
    setFiles((prev) => [
      ...prev,
      ...pdfs.map((f) => ({
        file: f,
        name: f.name,
        size: f.size,
        progress: 0,
        status: "pending" as const,
      })),
    ]);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    addFiles(e.dataTransfer.files);
  }, []);

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── Upload files to Supabase Storage ────────────────────────────────────
  async function uploadFiles(userId: string, projectId: string): Promise<string[]> {
    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = `${userId}/${projectId}/${Date.now()}-${f.name}`;
      setFiles((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "uploading", progress: 30 } : item
        )
      );
      const { error } = await supabase.storage
        .from("project-files")
        .upload(path, f.file, { contentType: "application/pdf" });
      if (error) {
        setFiles((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "error", error: error.message, progress: 0 } : item
          )
        );
      } else {
        setFiles((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "done", progress: 100, storagePath: path } : item
          )
        );
        paths.push(path);
      }
    }
    return paths;
  }

  // ── Animate phase messages ─────────────────────────────────────────────
  function startPhaseAnimation(
    onPhaseChange: (p: ExtractionPhase) => void
  ): NodeJS.Timeout[] {
    const timers: NodeJS.Timeout[] = [];
    // parsing: 0s, analyzing: 2s, structuring: 8s
    const delays = [0, 2000, 8000];
    const phases: ExtractionPhase[] = ["parsing", "analyzing", "structuring"];
    phases.forEach((p, i) => {
      timers.push(setTimeout(() => onPhaseChange(p), delays[i]));
    });
    return timers;
  }

  // ── Main create + extract flow ────────────────────────────────────────────
  async function handleCreateAndExtract() {
    setExtractError(null);
    setPhase("creating");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Create project
      const { data: project, error: insertErr } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          title: projectName.trim(),
          status: "draft",
          source_url: sourceUrl.trim() || null,
          bid_deadline: bidDeadline ? new Date(bidDeadline).toISOString() : null,
        })
        .select()
        .single();

      if (insertErr || !project) throw new Error(insertErr?.message ?? "Could not create project");

      // 2. Upload files
      let storagePaths: string[] = [];
      if (files.length > 0) {
        setPhase("uploading");
        storagePaths = await uploadFiles(user.id, project.id);
        if (storagePaths.length > 0) {
          await supabase
            .from("projects")
            .update({ source_files: storagePaths })
            .eq("id", project.id);
        }
      }

      // 3. If no files, just go to detail page as draft
      if (storagePaths.length === 0) {
        router.push(`/projects/${project.id}`);
        return;
      }

      // 4. Animate messages while extraction runs
      const timers = startPhaseAnimation(setPhase);

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });

      timers.forEach(clearTimeout);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Extraction failed");
      }

      setPhase("done");
      await new Promise((r) => setTimeout(r, 800));
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setPhase("error");
      setExtractError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const isExtracting = ["creating", "uploading", "parsing", "analyzing", "structuring"].includes(
    phase
  );

  const phaseProgress: Record<ExtractionPhase, number> = {
    idle: 0,
    creating: 8,
    uploading: 20,
    parsing: 40,
    analyzing: 65,
    structuring: 88,
    done: 100,
    error: 0,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy">New Project</h1>
        <p className="text-gray-500 text-sm mt-0.5">Create a new RFP analysis project</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, idx) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                  step > s.id
                    ? "bg-green text-white"
                    : step === s.id
                    ? "bg-navy text-white"
                    : "bg-gray-200 text-gray-500"
                )}
              >
                {step > s.id ? <CheckCircle2 className="w-4 h-4" /> : s.id}
              </div>
              <span
                className={cn(
                  "text-xs mt-1 font-medium whitespace-nowrap",
                  step === s.id ? "text-navy" : "text-gray-400"
                )}
              >
                {s.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-2 mb-5 transition-colors",
                  step > s.id ? "bg-green" : "bg-gray-200"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">

        {/* ── Step 1: Project Info ──────────────────────────────────────── */}
        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (projectName.trim()) setStep(2);
            }}
            className="space-y-6"
          >
            <div className="space-y-1.5">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="e.g. City of Ottawa — IT Services RFP 2025"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deadline">Bid Deadline</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={bidDeadline}
                onChange={(e) => setBidDeadline(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url">BidNet / Source URL (optional)</Label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="url"
                  type="url"
                  placeholder="https://bidnet.com/..."
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={!projectName.trim()} className="gap-2">
                Next: Upload Files
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        )}

        {/* ── Step 2: File Upload ───────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer",
                isDragOver
                  ? "border-navy bg-navy/5"
                  : "border-gray-300 hover:border-navy/50 hover:bg-gray-50"
              )}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <div className="w-12 h-12 bg-navy/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Upload className="w-6 h-6 text-navy" />
              </div>
              <p className="font-semibold text-navy text-sm">Drop PDF files here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">RFPs, addenda, supporting documents</p>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {files.length} file{files.length !== 1 ? "s" : ""} selected
                </p>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                    <FileText className="w-4 h-4 text-navy shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{f.name}</p>
                      <p className="text-xs text-gray-400">{formatSize(f.size)}</p>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button type="button" onClick={() => setStep(3)} className="gap-2">
                Next: Extract & Analyze
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Extract & Analyze ─────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Extraction progress — shown while running */}
            {isExtracting && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-navy animate-spin shrink-0" />
                  <span className="text-sm font-medium text-navy">
                    {PHASE_MESSAGES[phase]}
                  </span>
                </div>
                <Progress value={phaseProgress[phase]} className="h-1.5" />
                <div className="space-y-2">
                  {(["parsing", "analyzing", "structuring"] as const).map((p) => {
                    const phases: ExtractionPhase[] = ["parsing", "analyzing", "structuring"];
                    const currentIdx = phases.indexOf(phase);
                    const thisIdx = phases.indexOf(p);
                    const isDone = currentIdx > thisIdx;
                    const isActive = currentIdx === thisIdx;
                    return (
                      <div key={p} className="flex items-center gap-2.5 text-xs">
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center shrink-0",
                            isDone ? "bg-green" : isActive ? "bg-navy animate-pulse" : "bg-gray-200"
                          )}
                        >
                          {isDone && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span
                          className={cn(
                            isDone ? "text-gray-500 line-through" : isActive ? "text-navy font-medium" : "text-gray-400"
                          )}
                        >
                          {p === "parsing" && "Parsing documents"}
                          {p === "analyzing" && "Analyzing content with Claude AI"}
                          {p === "structuring" && "Structuring extracted data"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Success flash */}
            {phase === "done" && (
              <div className="flex items-center gap-3 bg-green/10 border border-green/20 rounded-xl p-4">
                <CheckCircle2 className="w-5 h-5 text-green shrink-0" />
                <span className="text-sm font-medium text-green">
                  Extraction complete — opening project…
                </span>
              </div>
            )}

            {/* Error state */}
            {phase === "error" && extractError && (
              <div className="space-y-4">
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold mb-0.5">Extraction failed</p>
                    <p>{extractError}</p>
                    <p className="mt-1 text-xs text-red-500">
                      You can still save the project and enter data manually.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Idle: review summary + CTA */}
            {phase === "idle" && (
              <div className="space-y-4">
                <h2 className="font-semibold text-navy">Review &amp; start extraction</h2>
                <div className="bg-gray-50 rounded-xl divide-y divide-gray-200">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="text-xs text-gray-400 w-28 pt-0.5 shrink-0">Project</span>
                    <span className="text-sm font-medium text-navy">{projectName}</span>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="text-xs text-gray-400 w-28 pt-0.5 shrink-0">Deadline</span>
                    <span className="text-sm text-navy">
                      {bidDeadline ? new Date(bidDeadline).toLocaleString("en-CA") : "Not set"}
                    </span>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="text-xs text-gray-400 w-28 pt-0.5 shrink-0">Files</span>
                    <span className="text-sm text-navy">
                      {files.length > 0
                        ? `${files.length} PDF file${files.length !== 1 ? "s" : ""}`
                        : "No files — will save as draft"}
                    </span>
                  </div>
                  {sourceUrl && (
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span className="text-xs text-gray-400 w-28 pt-0.5 shrink-0">Source URL</span>
                      <span className="text-sm text-navy break-all">{sourceUrl}</span>
                    </div>
                  )}
                </div>

                {files.length > 0 && (
                  <div className="flex items-start gap-2.5 bg-navy/5 border border-navy/10 rounded-lg p-3 text-xs text-navy/70">
                    <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-navy" />
                    Claude will extract up to 30 procurement fields from your documents. The process takes 20–60 seconds.
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            {(phase === "idle" || phase === "error") && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPhase("idle");
                    setExtractError(null);
                    setStep(2);
                  }}
                  className="gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>
                <div className="flex gap-2">
                  {phase === "error" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        // Navigate to the partially-created project
                        router.push("/");
                      }}
                      className="gap-2"
                    >
                      Go to Dashboard
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="accent"
                    onClick={handleCreateAndExtract}
                    className="gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {files.length > 0 ? "Create & Extract" : "Create Project"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
