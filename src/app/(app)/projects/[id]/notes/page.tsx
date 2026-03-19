"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft, Sparkles, Loader2, ChevronDown, ChevronRight,
  HelpCircle, AlertTriangle, Zap, User, Target, StickyNote
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/database";

interface QAPair {
  question: string;
  answer: string;
}

interface OutreachStrategy {
  who: string;
  lead_with: string;
  objections: string;
}

interface TeamTips {
  likely_questions?: QAPair[];
  disqualification_risks?: string[];
  technical_talking_points?: string[];
  ideal_contractor_profile?: string;
  outreach_strategy?: OutreachStrategy;
}

interface AccordionSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function AccordionSection({ title, icon: Icon, iconColor, children, defaultOpen = false }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", iconColor)}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-navy text-sm">{title}</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100">{children}</div>}
    </div>
  );
}

export default function NotesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [teamTips, setTeamTips] = useState<TeamTips>({});
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProject = useCallback(async () => {
    const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (data) {
      setProject(data as Project);
      setTeamTips((data.team_tips as TeamTips) ?? {});
      setNotes(data.internal_notes ?? "");
    }
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json();
      if (json.team_tips) {
        setTeamTips(json.team_tips as TeamTips);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleNotesSave = async () => {
    setSaving(true);
    await supabase.from("projects").update({ internal_notes: notes }).eq("id", projectId);
    setSaving(false);
    setLastSaved(new Date());
  };

  const hasTips = Object.keys(teamTips).length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-navy" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-navy">Team Notes</h1>
              <p className="text-xs text-gray-500">{project?.title}</p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange text-white text-sm font-medium hover:bg-orange/90 transition-colors disabled:opacity-60"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? "Generating…" : hasTips ? "Regenerate Tips" : "Generate AI Tips"}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {/* AI Tips */}
        {generating ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white rounded-2xl border border-gray-200">
            <Loader2 className="w-8 h-8 animate-spin text-orange" />
            <p className="text-gray-500 text-sm">Analyzing contract for your team…</p>
          </div>
        ) : !hasTips ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-gray-200">
            <div className="w-14 h-14 rounded-2xl bg-orange/10 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-orange" />
            </div>
            <h2 className="text-lg font-semibold text-navy mb-2">No AI Tips Yet</h2>
            <p className="text-gray-500 text-sm max-w-sm">
              Generate strategic intelligence for your team: likely questions, risks, talking points, and outreach strategy.
            </p>
          </div>
        ) : (
          <>
            {/* Likely Questions */}
            {teamTips.likely_questions && teamTips.likely_questions.length > 0 && (
              <AccordionSection
                title="Likely Evaluation Questions"
                icon={HelpCircle}
                iconColor="bg-blue-500"
                defaultOpen={true}
              >
                <div className="mt-4 space-y-3">
                  {teamTips.likely_questions.map((qa, i) => (
                    <div key={i} className="bg-blue-50 rounded-xl p-4">
                      <p className="text-sm font-semibold text-blue-800 mb-1.5">Q: {qa.question}</p>
                      <p className="text-sm text-blue-700 leading-relaxed">A: {qa.answer}</p>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            )}

            {/* Disqualification Risks */}
            {teamTips.disqualification_risks && teamTips.disqualification_risks.length > 0 && (
              <AccordionSection
                title="Disqualification Risks"
                icon={AlertTriangle}
                iconColor="bg-red-500"
                defaultOpen={true}
              >
                <div className="mt-4 space-y-2">
                  {teamTips.disqualification_risks.map((risk, i) => (
                    <div key={i} className="flex gap-3 bg-red-50 rounded-xl p-3.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-800 leading-relaxed">{risk}</p>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            )}

            {/* Technical Talking Points */}
            {teamTips.technical_talking_points && teamTips.technical_talking_points.length > 0 && (
              <AccordionSection
                title="Technical Talking Points"
                icon={Zap}
                iconColor="bg-green-500"
              >
                <div className="mt-4 space-y-2">
                  {teamTips.technical_talking_points.map((point, i) => (
                    <div key={i} className="flex gap-3 items-start bg-green-50 rounded-xl p-3.5">
                      <div className="w-5 h-5 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-sm text-green-800 leading-relaxed">{point}</p>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            )}

            {/* Ideal Contractor Profile */}
            {teamTips.ideal_contractor_profile && (
              <AccordionSection
                title="Ideal Contractor Profile"
                icon={User}
                iconColor="bg-purple-500"
              >
                <div className="mt-4 bg-purple-50 rounded-xl p-4">
                  <p className="text-sm text-purple-800 leading-relaxed">{teamTips.ideal_contractor_profile}</p>
                </div>
              </AccordionSection>
            )}

            {/* Outreach Strategy */}
            {teamTips.outreach_strategy && (
              <AccordionSection
                title="Outreach Strategy"
                icon={Target}
                iconColor="bg-orange"
              >
                <div className="mt-4 space-y-3">
                  <div className="bg-orange/5 rounded-xl p-4">
                    <p className="text-xs font-semibold text-orange uppercase tracking-wide mb-1.5">Who to Contact</p>
                    <p className="text-sm text-gray-800">{teamTips.outreach_strategy.who}</p>
                  </div>
                  <div className="bg-orange/5 rounded-xl p-4">
                    <p className="text-xs font-semibold text-orange uppercase tracking-wide mb-1.5">Lead With</p>
                    <p className="text-sm text-gray-800">{teamTips.outreach_strategy.lead_with}</p>
                  </div>
                  <div className="bg-orange/5 rounded-xl p-4">
                    <p className="text-xs font-semibold text-orange uppercase tracking-wide mb-1.5">Handle Objections</p>
                    <p className="text-sm text-gray-800">{teamTips.outreach_strategy.objections}</p>
                  </div>
                </div>
              </AccordionSection>
            )}
          </>
        )}

        {/* Manual Notes */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <StickyNote className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-navy text-sm">Internal Notes</span>
            <div className="ml-auto flex items-center gap-3">
              {lastSaved && (
                <span className="text-xs text-gray-400">
                  Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
            </div>
          </div>
          <div className="p-5">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesSave}
              placeholder="Add internal team notes, follow-up actions, contact info, or any other details…"
              className="w-full min-h-48 rounded-xl border border-gray-200 p-4 text-sm text-gray-800 resize-y focus:outline-none focus:ring-2 focus:ring-navy/20 leading-relaxed"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleNotesSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-navy text-white text-sm font-medium hover:bg-navy/90 transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Notes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
