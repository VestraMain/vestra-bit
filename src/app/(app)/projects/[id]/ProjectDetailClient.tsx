"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/projects/StatusBadge";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────
type ExtractedData = {
  owner?: string | null;
  bid_number?: string | null;
  naics_code?: string | null;
  estimated_value?: string | null;
  contract_type?: string | null;
  sbe_goal?: string | null;
  bid_deadline?: string | null;
  submission_platform?: string | null;
  prebid_meeting_date?: string | null;
  prebid_meeting_location?: string | null;
  questions_deadline?: string | null;
  addendum_date?: string | null;
  construction_start?: string | null;
  substantial_completion?: string | null;
  final_completion?: string | null;
  liquidated_damages_per_day?: string | null;
  payment_terms?: string | null;
  bid_bond_requirement?: string | null;
  performance_bond_requirement?: string | null;
  procurement_contact_name?: string | null;
  procurement_contact_email?: string | null;
  project_title?: string | null;
  site_address?: string | null;
  work_items?: WorkItem[];
  licensing_requirements?: string | null;
  insurance_requirements?: InsuranceItem[];
  co_labor_percentage?: string | null;
  submission_forms_required?: string | null;
  _extraction_error?: string;
};

type WorkItem = {
  name?: string | null;
  scope_summary?: string | null;
  materials?: string | null;
  dimensions_quantities?: string | null;
  special_requirements?: string | null;
};

type InsuranceItem = {
  type?: string | null;
  minimum?: string | null;
};

type RightPanelTab = "files" | "outputs" | "status";

const EXTRACTING_MESSAGES = [
  "Parsing documents…",
  "Analyzing content with Claude AI…",
  "Structuring extracted data…",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function isNull(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between py-2 border-b border-gray-200 mb-4 text-left"
    >
      <h3 className="text-sm font-semibold text-navy uppercase tracking-wide">{title}</h3>
      {open ? (
        <ChevronUp className="w-4 h-4 text-gray-400" />
      ) : (
        <ChevronDown className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const missing = isNull(value);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Label className={cn("text-xs", missing ? "text-orange" : "text-gray-600")}>{label}</Label>
        {missing && (
          <span className="text-[10px] font-medium text-orange bg-orange/10 px-1.5 py-0.5 rounded">
            Not found
          </span>
        )}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "[ Not found in documents ]"}
          rows={2}
          className={cn(
            "flex w-full rounded-md border bg-white px-3 py-2 text-sm resize-none",
            "placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-navy",
            "focus:border-transparent disabled:opacity-50 transition-colors",
            missing ? "border-orange/40 bg-orange/5" : "border-gray-200"
          )}
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "[ Not found in documents ]"}
          className={cn(
            missing ? "border-orange/40 bg-orange/5 placeholder:text-gray-300" : "border-gray-200"
          )}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProjectDetailClient({ initial }: { initial: Project }) {
  const supabase = createClient();

  const [project, setProject] = useState<Project>(initial);
  const [data, setData] = useState<ExtractedData>(
    (initial.extracted_data as ExtractedData) ?? {}
  );
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightPanelTab>("files");
  const [msgIdx, setMsgIdx] = useState(0);

  // Section open/close state
  const [sections, setSections] = useState({
    admin: true,
    dates: true,
    financial: true,
    scope: true,
    requirements: true,
    contacts: true,
  });
  function toggleSection(key: keyof typeof sections) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  // ── Poll for status changes while extracting ────────────────────────────
  useEffect(() => {
    if (project.status !== "extracting") return;

    // Cycle through status messages
    const msgTimer = setInterval(() => {
      setMsgIdx((i) => (i + 1) % EXTRACTING_MESSAGES.length);
    }, 3000);

    // Poll DB every 4 seconds
    const pollTimer = setInterval(async () => {
      const { data: updated } = await supabase
        .from("projects")
        .select("*")
        .eq("id", project.id)
        .single();
      if (updated && updated.status !== "extracting") {
        setProject(updated as Project);
        setData((updated.extracted_data as ExtractedData) ?? {});
        clearInterval(pollTimer);
        clearInterval(msgTimer);
      }
    }, 4000);

    return () => {
      clearInterval(pollTimer);
      clearInterval(msgTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.status, project.id]);

  // ── Re-extract ──────────────────────────────────────────────────────────
  async function handleReExtract() {
    setProject((p) => ({ ...p, status: "extracting" }));
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Extraction failed");
      setProject((p) => ({ ...p, status: "review" }));
      setData(body.extracted_data as ExtractedData);
    } catch (err) {
      setProject((p) => ({ ...p, status: "draft" }));
      console.error(err);
    }
  }

  // ── Save changes ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMessage(null);
    const { error } = await supabase
      .from("projects")
      .update({ extracted_data: data as Record<string, unknown> })
      .eq("id", project.id);
    setSaving(false);
    setSaveMessage(error ? "Save failed: " + error.message : "Saved");
    setTimeout(() => setSaveMessage(null), 3000);
  }, [supabase, data, project.id]);

  // ── Field helpers ─────────────────────────────────────────────────────────
  function field(key: keyof ExtractedData): string {
    const v = data[key];
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    return "";
  }

  function setField(key: keyof ExtractedData) {
    return (v: string) => setData((d) => ({ ...d, [key]: v || null }));
  }

  function setWorkItem(idx: number, subKey: keyof WorkItem, val: string) {
    setData((d) => {
      const items = [...(d.work_items ?? [])];
      items[idx] = { ...items[idx], [subKey]: val || null };
      return { ...d, work_items: items };
    });
  }

  function addWorkItem() {
    setData((d) => ({
      ...d,
      work_items: [
        ...(d.work_items ?? []),
        { name: null, scope_summary: null, materials: null, dimensions_quantities: null, special_requirements: null },
      ],
    }));
  }

  function removeWorkItem(idx: number) {
    setData((d) => ({ ...d, work_items: (d.work_items ?? []).filter((_, i) => i !== idx) }));
  }

  function setInsurance(idx: number, subKey: keyof InsuranceItem, val: string) {
    setData((d) => {
      const items = [...(d.insurance_requirements ?? [])];
      items[idx] = { ...items[idx], [subKey]: val || null };
      return { ...d, insurance_requirements: items };
    });
  }

  function addInsurance() {
    setData((d) => ({
      ...d,
      insurance_requirements: [...(d.insurance_requirements ?? []), { type: null, minimum: null }],
    }));
  }

  function removeInsurance(idx: number) {
    setData((d) => ({
      ...d,
      insurance_requirements: (d.insurance_requirements ?? []).filter((_, i) => i !== idx),
    }));
  }

  // ── Extraction in progress overlay ───────────────────────────────────────
  if (project.status === "extracting") {
    return (
      <div className="max-w-6xl mx-auto">
        <ProjectHeader project={project} onSave={handleSave} saving={saving} saveMessage={saveMessage} />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 bg-navy/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-8 h-8 text-navy animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-navy mb-2">Extracting data…</h2>
            <p className="text-gray-500 text-sm mb-6 min-h-[20px] transition-all">
              {EXTRACTING_MESSAGES[msgIdx]}
            </p>
            <div className="flex justify-center gap-1.5">
              {EXTRACTING_MESSAGES.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-500",
                    i === msgIdx ? "w-6 bg-navy" : "w-1.5 bg-gray-300"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Extraction error state ──────────────────────────────────────────────
  const extractionError =
    project.status === "draft" && (data as ExtractedData)._extraction_error
      ? (data as ExtractedData)._extraction_error
      : null;

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto">
      <ProjectHeader
        project={project}
               onSave={handleSave}
        saving={saving}
        saveMessage={saveMessage}
      />

      {extractionError && (
        <div className="mb-6 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>Extraction failed:</strong> {extractionError}
            <br />
            <span className="text-xs text-red-500">You can enter data manually below, or re-run extraction.</span>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* ── Left panel: editable form (60%) ──────────────────────────── */}
        <div className="flex-[3] min-w-0 space-y-6">

          {/* Administrative */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader title="Administrative" open={sections.admin} onToggle={() => toggleSection("admin")} />
            {sections.admin && (
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Project Title" value={field("project_title")} onChange={setField("project_title")} />
                <FieldRow label="Issuing Owner / Agency" value={field("owner")} onChange={setField("owner")} />
                <FieldRow label="Bid / RFP Number" value={field("bid_number")} onChange={setField("bid_number")} />
                <FieldRow label="NAICS Code" value={field("naics_code")} onChange={setField("naics_code")} />
                <FieldRow label="Estimated Value" value={field("estimated_value")} onChange={setField("estimated_value")} />
                <FieldRow label="Contract Type" value={field("contract_type")} onChange={setField("contract_type")} />
                <FieldRow label="Submission Platform" value={field("submission_platform")} onChange={setField("submission_platform")} />
                <FieldRow label="Site Address" value={field("site_address")} onChange={setField("site_address")} />
              </div>
            )}
          </div>

          {/* Dates & Milestones */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader title="Dates & Milestones" open={sections.dates} onToggle={() => toggleSection("dates")} />
            {sections.dates && (
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Bid Deadline" value={field("bid_deadline")} onChange={setField("bid_deadline")} />
                <FieldRow label="Questions Deadline" value={field("questions_deadline")} onChange={setField("questions_deadline")} />
                <FieldRow label="Pre-bid Meeting Date" value={field("prebid_meeting_date")} onChange={setField("prebid_meeting_date")} />
                <FieldRow label="Pre-bid Meeting Location" value={field("prebid_meeting_location")} onChange={setField("prebid_meeting_location")} />
                <FieldRow label="Addendum Date" value={field("addendum_date")} onChange={setField("addendum_date")} />
                <FieldRow label="Construction Start" value={field("construction_start")} onChange={setField("construction_start")} />
                <FieldRow label="Substantial Completion" value={field("substantial_completion")} onChange={setField("substantial_completion")} />
                <FieldRow label="Final Completion" value={field("final_completion")} onChange={setField("final_completion")} />
              </div>
            )}
          </div>

          {/* Financial & Bonds */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader title="Financial & Bonds" open={sections.financial} onToggle={() => toggleSection("financial")} />
            {sections.financial && (
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Liquidated Damages / Day" value={field("liquidated_damages_per_day")} onChange={setField("liquidated_damages_per_day")} />
                <FieldRow label="Payment Terms" value={field("payment_terms")} onChange={setField("payment_terms")} />
                <FieldRow label="Bid Bond Requirement" value={field("bid_bond_requirement")} onChange={setField("bid_bond_requirement")} />
                <FieldRow label="Performance Bond Requirement" value={field("performance_bond_requirement")} onChange={setField("performance_bond_requirement")} />
                <FieldRow label="SBE Goal (%)" value={field("sbe_goal")} onChange={setField("sbe_goal")} />
              </div>
            )}
          </div>

          {/* Scope of Work */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader title="Scope of Work" open={sections.scope} onToggle={() => toggleSection("scope")} />
            {sections.scope && (
              <div className="space-y-4">
                {(data.work_items ?? []).length === 0 && (
                  <p className="text-sm text-orange bg-orange/5 border border-orange/20 rounded-lg p-3 text-center">
                    [ Not found in documents ]
                  </p>
                )}
                {(data.work_items ?? []).map((item, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Work Item {idx + 1}
                      </span>
                      <button
                        onClick={() => removeWorkItem(idx)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldRow
                        label="Name / Division"
                        value={item.name ?? ""}
                        onChange={(v) => setWorkItem(idx, "name", v)}
                      />
                      <FieldRow
                        label="Dimensions / Quantities"
                        value={item.dimensions_quantities ?? ""}
                        onChange={(v) => setWorkItem(idx, "dimensions_quantities", v)}
                      />
                    </div>
                    <FieldRow
                      label="Scope Summary"
                      value={item.scope_summary ?? ""}
                      onChange={(v) => setWorkItem(idx, "scope_summary", v)}
                      multiline
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FieldRow
                        label="Materials"
                        value={item.materials ?? ""}
                        onChange={(v) => setWorkItem(idx, "materials", v)}
                      />
                      <FieldRow
                        label="Special Requirements"
                        value={item.special_requirements ?? ""}
                        onChange={(v) => setWorkItem(idx, "special_requirements", v)}
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addWorkItem}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Work Item
                </Button>
              </div>
            )}
          </div>

          {/* Requirements */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader title="Requirements" open={sections.requirements} onToggle={() => toggleSection("requirements")} />
            {sections.requirements && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FieldRow
                    label="Licensing Requirements"
                    value={field("licensing_requirements")}
                    onChange={setField("licensing_requirements")}
                    multiline
                  />
                  <FieldRow
                    label="Own-Force Labour (%)"
                    value={field("co_labor_percentage")}
                    onChange={setField("co_labor_percentage")}
                  />
                </div>
                <FieldRow
                  label="Submission Forms Required"
                  value={field("submission_forms_required")}
                  onChange={setField("submission_forms_required")}
                  multiline
                />

                {/* Insurance requirements */}
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600">Insurance Requirements</Label>
                  {(data.insurance_requirements ?? []).length === 0 && (
                    <p className="text-sm text-orange bg-orange/5 border border-orange/20 rounded-lg p-3 text-center">
                      [ Not found in documents ]
                    </p>
                  )}
                  {(data.insurance_requirements ?? []).map((ins, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder="Type (e.g. General Liability)"
                        value={ins.type ?? ""}
                        onChange={(e) => setInsurance(idx, "type", e.target.value)}
                        className={cn("flex-1", isNull(ins.type) ? "border-orange/40 bg-orange/5" : "border-gray-200")}
                      />
                      <Input
                        placeholder="Minimum (e.g. $2,000,000)"
                        value={ins.minimum ?? ""}
                        onChange={(e) => setInsurance(idx, "minimum", e.target.value)}
                        className={cn("flex-1", isNull(ins.minimum) ? "border-orange/40 bg-orange/5" : "border-gray-200")}
                      />
                      <button
                        onClick={() => removeInsurance(idx)}
                        className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addInsurance}
                    className="gap-1.5 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Insurance Row
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Contacts */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader title="Procurement Contact" open={sections.contacts} onToggle={() => toggleSection("contacts")} />
            {sections.contacts && (
              <div className="grid grid-cols-2 gap-4">
                <FieldRow label="Contact Name" value={field("procurement_contact_name")} onChange={setField("procurement_contact_name")} />
                <FieldRow label="Contact Email" value={field("procurement_contact_email")} onChange={setField("procurement_contact_email")} />
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel (40%) ─────────────────────────────────────────── */}
        <div className="flex-[2] min-w-0 space-y-4">
          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200">
              {(["files", "outputs", "status"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setRightTab(t)}
                  className={cn(
                    "flex-1 py-3 text-xs font-semibold uppercase tracking-wide transition-colors",
                    rightTab === t
                      ? "text-navy border-b-2 border-navy bg-navy/5"
                      : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  {t === "files" ? "Source Files" : t === "outputs" ? "Outputs" : "Status"}
                </button>
              ))}
            </div>

            <div className="p-4">
              {/* Source Files tab */}
              {rightTab === "files" && (
                <div className="space-y-2">
                  {!project.source_files || project.source_files.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No files uploaded.</p>
                  ) : (
                    (project.source_files as string[]).map((path, i) => {
                      const filename = path.split("/").pop() ?? path;
                      return (
                        <div key={i} className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2.5">
                          <FileText className="w-4 h-4 text-navy shrink-0" />
                          <span className="text-sm text-navy truncate flex-1">{filename}</span>
                          <DownloadButton supabase={supabase} path={path} />
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Outputs tab */}
              {rightTab === "outputs" && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">No outputs yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Generate a brief to create outputs.
                  </p>
                </div>
              )}

              {/* Status tab */}
              {rightTab === "status" && (
                <div className="space-y-3">
                  <StatusRow
                    label="Project Status"
                    value={<StatusBadge status={project.status} />}
                  />
                  <StatusRow
                    label="Created"
                    value={<span className="text-xs text-gray-600">{new Date(project.created_at).toLocaleString("en-CA")}</span>}
                  />
                  {project.bid_deadline && (
                    <StatusRow
                      label="Bid Deadline"
                      value={<span className="text-xs text-gray-600">{new Date(project.bid_deadline).toLocaleString("en-CA")}</span>}
                    />
                  )}
                  {project.source_url && (
                    <StatusRow
                      label="Source URL"
                      value={
                        <a
                          href={project.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-navy hover:text-orange transition-colors"
                        >
                          Open <ExternalLink className="w-3 h-3" />
                        </a>
                      }
                    />
                  )}
                  <StatusRow
                    label="Files"
                    value={<span className="text-xs text-gray-600">{project.source_files?.length ?? 0} PDF(s)</span>}
                  />
                  <StatusRow
                    label="Fields extracted"
                    value={
                      <span className="text-xs text-gray-600">
                        {Object.keys(data).filter(
                          (k) => k !== "_extraction_error" && !isNull(data[k as keyof ExtractedData])
                        ).length}{" "}
                        / 30
                      </span>
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {/* Re-extract button (when data exists or error occurred) */}
          {(project.source_files?.length ?? 0) > 0 && (
              <Button
                variant="outline"
                className="w-full gap-2 text-sm"
                onClick={handleReExtract}
              >
                <RefreshCw className="w-4 h-4" />
                Re-run Extraction
              </Button>
            )}
        </div>
      </div>
    </div>
  );
}

// ── Small helper components ────────────────────────────────────────────────────

function ProjectHeader({
  project,
  onSave,
  saving,
  saveMessage,
}: {
  project: Project;
  onSave: () => void;
  saving: boolean;
  saveMessage: string | null;
}) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <StatusBadge status={project.status} />
          {project.bid_deadline && (
            <DeadlinePill deadline={project.bid_deadline} />
          )}
        </div>
        <h1 className="text-xl font-bold text-navy leading-snug">{project.title}</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {saveMessage && (
          <span
            className={cn(
              "text-xs font-medium flex items-center gap-1",
              saveMessage === "Saved" ? "text-green" : "text-red-500"
            )}
          >
            {saveMessage === "Saved" ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            {saveMessage}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={saving}
          className="gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </Button>
        <Button
          variant="default"
          size="sm"
          disabled={project.status !== "review"}
          className="gap-2"
          title={project.status !== "review" ? "Complete extraction first" : ""}
        >
          <Sparkles className="w-4 h-4" />
          Generate Brief
        </Button>
      </div>
    </div>
  );
}

function DeadlinePill({ deadline }: { deadline: string }) {
  const now = new Date();
  const d = new Date(deadline);
  const days = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  const urgent = days <= 5;
  return (
    <Badge variant={urgent ? "urgent" : "default"} className="text-[10px]">
      {days < 0 ? "Overdue" : days === 0 ? "Due today" : `${days}d left`}
    </Badge>
  );
}

function StatusRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      {value}
    </div>
  );
}

function DownloadButton({
  supabase,
  path,
}: {
  supabase: ReturnType<typeof createClient>;
  path: string;
}) {
  async function handleDownload() {
    const { data, error } = await supabase.storage.from("project-files").download(path);
    if (error || !data) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = path.split("/").pop() ?? "file.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      onClick={handleDownload}
      className="text-gray-400 hover:text-navy transition-colors"
      title="Download"
    >
      <ExternalLink className="w-3.5 h-3.5" />
    </button>
  );
}
