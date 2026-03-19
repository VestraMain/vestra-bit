"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Copy, Check, Instagram, Facebook, Sparkles, Loader2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/database";

type Platform = "instagram" | "facebook" | "tiktok";
type Lang = "en" | "es";

interface SocialPlatformContent {
  en: string;
  es: string;
}

interface SocialCopy {
  instagram?: SocialPlatformContent;
  facebook?: SocialPlatformContent;
  tiktok?: SocialPlatformContent;
}

const PLATFORMS: { id: Platform; label: string; icon: React.ComponentType<{ className?: string }>; color: string; maxChars: number }[] = [
  { id: "instagram", label: "Instagram", icon: Instagram, color: "from-purple-500 to-pink-500", maxChars: 2200 },
  { id: "facebook", label: "Facebook", icon: Facebook, color: "from-blue-600 to-blue-400", maxChars: 63206 },
  { id: "tiktok", label: "TikTok", icon: Share2, color: "from-gray-900 to-gray-700", maxChars: 2200 },
];

function CharCounter({ text, max }: { text: string; max: number }) {
  const count = text.length;
  const pct = count / max;
  return (
    <span className={cn("text-xs font-mono", pct > 0.9 ? "text-red-500" : pct > 0.75 ? "text-yellow-500" : "text-gray-400")}>
      {count.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-navy text-white hover:bg-navy/80 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function TikTokPreview({ text }: { text: string }) {
  return (
    <div className="bg-black rounded-2xl p-4 text-white max-w-xs mx-auto" style={{ minHeight: 200 }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-xs font-bold">V</div>
        <span className="text-sm font-semibold">@vestra_govcon</span>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{text || <span className="text-gray-500 italic">No content yet</span>}</p>
    </div>
  );
}

function InstagramPreview({ text }: { text: string }) {
  const [body, hashtags] = text.includes("\n\n")
    ? text.split(/\n\n(?=#)/)
    : [text, ""];
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden max-w-xs mx-auto">
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">V</div>
        <span className="text-sm font-semibold text-gray-900">vestra_govcon</span>
      </div>
      <div className="bg-gradient-to-br from-navy/5 to-orange/5 h-32 flex items-center justify-center">
        <span className="text-navy/30 text-xs">📋 Contract Brief</span>
      </div>
      <div className="p-3">
        <p className="text-sm text-gray-800 leading-relaxed line-clamp-3">{body || <span className="text-gray-400 italic">No content yet</span>}</p>
        {hashtags && <p className="text-xs text-blue-500 mt-1 line-clamp-2">{hashtags}</p>}
      </div>
    </div>
  );
}

function FacebookPreview({ text }: { text: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden max-w-xs mx-auto">
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">V</div>
        <div>
          <div className="text-sm font-semibold text-gray-900">Vestra BIT</div>
          <div className="text-xs text-gray-400">Just now · 🌐</div>
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm text-gray-800 leading-relaxed line-clamp-4">{text || <span className="text-gray-400 italic">No content yet</span>}</p>
      </div>
      <div className="border-t border-gray-100 flex">
        {["👍 Like", "💬 Comment", "↗️ Share"].map((action) => (
          <button key={action} className="flex-1 py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors">{action}</button>
        ))}
      </div>
    </div>
  );
}

export default function SocialPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [lang, setLang] = useState<Lang>("en");
  const [socialCopy, setSocialCopy] = useState<SocialCopy>({});
  const [editedCopy, setEditedCopy] = useState<Record<string, Record<Lang, string>>>({});
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProject = useCallback(async () => {
    const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (data) {
      setProject(data as Project);
      const sc = (data.social_copy as SocialCopy) ?? {};
      setSocialCopy(sc);
      // Init edited copy from saved data
      const initial: Record<string, Record<Lang, string>> = {};
      for (const p of ["instagram", "facebook", "tiktok"] as Platform[]) {
        initial[p] = { en: sc[p]?.en ?? "", es: sc[p]?.es ?? "" };
      }
      setEditedCopy(initial);
    }
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json();
      if (json.social_copy) {
        const sc = json.social_copy as SocialCopy;
        setSocialCopy(sc);
        const updated: Record<string, Record<Lang, string>> = {};
        for (const p of ["instagram", "facebook", "tiktok"] as Platform[]) {
          updated[p] = { en: sc[p]?.en ?? "", es: sc[p]?.es ?? "" };
        }
        setEditedCopy(updated);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleTextChange = (value: string) => {
    setEditedCopy((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [lang]: value },
    }));
  };

  const handleSave = async () => {
    const merged: SocialCopy = {};
    for (const p of ["instagram", "facebook", "tiktok"] as Platform[]) {
      merged[p] = { en: editedCopy[p]?.en ?? "", es: editedCopy[p]?.es ?? "" };
    }
    await supabase.from("projects").update({ social_copy: merged }).eq("id", projectId);
    setSocialCopy(merged);
  };

  const currentText = editedCopy[platform]?.[lang] ?? "";
  const currentPlatform = PLATFORMS.find((p) => p.id === platform)!;
  const hasContent = Object.values(socialCopy).some((v) => v?.en || v?.es);

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
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-navy">Social Media Copy</h1>
              <p className="text-xs text-gray-500">{project?.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasContent && (
              <button
                onClick={handleSave}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-navy text-navy hover:bg-navy/5 transition-colors"
              >
                Save Changes
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange text-white text-sm font-medium hover:bg-orange/90 transition-colors disabled:opacity-60"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "Generating…" : hasContent ? "Regenerate" : "Generate Copy"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Platform + Lang tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
            {PLATFORMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPlatform(id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  platform === id ? "bg-navy text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
            {(["en", "es"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  lang === l ? "bg-navy text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                {l === "en" ? "🇺🇸 English" : "🇲🇽 Spanish"}
              </button>
            ))}
          </div>
        </div>

        {!hasContent && !generating ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className={cn("w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-4", currentPlatform.color)}>
              <currentPlatform.icon className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-navy mb-2">No Social Copy Yet</h2>
            <p className="text-gray-500 text-sm max-w-md">
              Generate AI-powered social media posts for Instagram, Facebook, and TikTok in both English and Spanish.
            </p>
          </div>
        ) : generating ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-orange" />
            <p className="text-gray-500 text-sm">Generating copy for all 3 platforms in EN + ES…</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {/* Editor */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className={cn("h-1.5 bg-gradient-to-r", currentPlatform.color)} />
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <currentPlatform.icon className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-semibold text-gray-800">{currentPlatform.label} ({lang.toUpperCase()})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CharCounter text={currentText} max={currentPlatform.maxChars} />
                    <CopyButton text={currentText} />
                  </div>
                </div>
                <textarea
                  value={currentText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-navy/20 font-mono leading-relaxed"
                  rows={platform === "tiktok" ? 12 : 16}
                  placeholder={`Your ${currentPlatform.label} copy will appear here…`}
                />
              </div>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className={cn("h-1.5 bg-gradient-to-r", currentPlatform.color)} />
              <div className="p-4">
                <p className="text-sm font-semibold text-gray-800 mb-4">Preview</p>
                <div className="flex justify-center">
                  {platform === "instagram" && <InstagramPreview text={currentText} />}
                  {platform === "facebook" && <FacebookPreview text={currentText} />}
                  {platform === "tiktok" && <TikTokPreview text={currentText} />}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
