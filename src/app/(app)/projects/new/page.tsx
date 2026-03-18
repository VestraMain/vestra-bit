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

const STEPS = [
  { id: 1, label: "Project Info" },
  { id: 2, label: "Upload Files" },
  { id: 3, label: "Review & Start" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [bidDeadline, setBidDeadline] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step 1 ──────────────────────────────────────────────────────────────
  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim()) return;
    setStep(2);
  }

  // ── File handling ────────────────────────────────────────────────────────
  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const pdfs = Array.from(newFiles).filter((f) => f.type === "application/pdf");
    if (pdfs.length === 0) {
      setError("Only PDF files are accepted.");
      return;
    }
    setError(null);
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

  // ── Upload files to Supabase Storage ─────────────────────────────────────
  async function uploadFiles(userId: string, projectId: string): Promise<string[]> {
    const paths: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const path = `${userId}/${projectId}/${Date.now()}-${f.name}`;

      setFiles((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "uploading", progress: 10 } : item
        )
      );

      const { error } = await supabase.storage
        .from("project-files")
        .upload(path, f.file, { contentType: "application/pdf" });

      if (error) {
        setFiles((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "error", error: error.message } : item
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

  // ── Create project ────────────────────────────────────────────────────────
  async function handleCreate() {
    setCreating(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // First create the project record
      const { data: project, error: insertError } = await supabase
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

      if (insertError) throw insertError;

      // Upload files if any
      let storagePaths: string[] = [];
      if (files.length > 0) {
        storagePaths = await uploadFiles(user.id, project.id);

        // Update project with file paths
        await supabase
          .from("projects")
          .update({ source_files: storagePaths })
          .eq("id", project.id);
      }

      router.push(`/`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setCreating(false);
    }
  }

  const canProceedStep1 = projectName.trim().length > 0;
  const canCreate = !creating;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
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
        {error && (
          <div className="mb-6 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Step 1: Project Info ─────────────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-6">
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
              <Button type="submit" disabled={!canProceedStep1} className="gap-2">
                Next: Upload Files
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        )}

        {/* ── Step 2: File Upload ──────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Drop zone */}
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
              <p className="font-semibold text-navy text-sm">
                Drop PDF files here or click to browse
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Multiple PDFs accepted — RFPs, addenda, supporting documents
              </p>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {files.length} file{files.length !== 1 ? "s" : ""} queued
                </p>
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5"
                  >
                    <FileText className="w-4 h-4 text-navy shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{f.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{formatSize(f.size)}</span>
                        {f.status === "uploading" && (
                          <Progress value={f.progress} className="h-1 w-20" />
                        )}
                        {f.status === "done" && (
                          <span className="text-xs text-green font-medium">Uploaded</span>
                        )}
                        {f.status === "error" && (
                          <span className="text-xs text-red-500">{f.error}</span>
                        )}
                      </div>
                    </div>
                    {f.status === "pending" && (
                      <button
                        onClick={() => removeFile(i)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {f.status === "done" && (
                      <CheckCircle2 className="w-4 h-4 text-green shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                className="gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                type="button"
                onClick={() => setStep(3)}
                className="gap-2"
              >
                Next: Review
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review & Create ──────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="font-semibold text-navy">Review your project</h2>

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl divide-y divide-gray-200">
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="text-xs text-gray-400 w-28 pt-0.5 shrink-0">Project Name</span>
                <span className="text-sm font-medium text-navy">{projectName}</span>
              </div>
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="text-xs text-gray-400 w-28 pt-0.5 shrink-0">Deadline</span>
                <span className="text-sm text-navy">
                  {bidDeadline
                    ? new Date(bidDeadline).toLocaleString("en-CA")
                    : "Not set"}
                </span>
              </div>
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="text-xs text-gray-400 w-28 pt-0.5 shrink-0">Source URL</span>
                <span className="text-sm text-navy break-all">
                  {sourceUrl || "Not provided"}
                </span>
              </div>
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="text-xs text-gray-400 w-28 pt-0.5 shrink-0">Files</span>
                <span className="text-sm text-navy">
                  {files.length > 0
                    ? `${files.length} PDF file${files.length !== 1 ? "s" : ""}`
                    : "No files attached"}
                </span>
              </div>
            </div>

            {files.length > 0 && (
              <div className="bg-navy/5 border border-navy/10 rounded-lg p-3 text-sm text-navy">
                <strong>Next step:</strong> After creating, click &quot;Extract &amp; Analyze&quot; to process your RFP documents with Claude AI.
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(2)}
                className="gap-2"
                disabled={creating}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={handleCreate}
                disabled={!canCreate}
                className="gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {files.length > 0 ? "Uploading & Creating…" : "Creating…"}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Create Project
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
