"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { signIn } from "next-auth/react";

type ToolMeta = {
  slug: string;
  title: string;
  description: string;
  avgRating?: number | null;
  ratingCount?: number | null;
};

type Props = {
  tools: ToolMeta[];
  savedSlugs: string[];
  isSignedIn: boolean;
};

const PER_PAGE = 20;

const SORT_OPTIONS = [
  { id: "rating-high", label: "Rating: High → Low" },
  { id: "rating-low", label: "Rating: Low → High" },
  { id: "title-az", label: "A → Z" },
  { id: "title-za", label: "Z → A" },
] as const;

type SortId = (typeof SORT_OPTIONS)[number]["id"];

const CATEGORY_RULES: Record<
  string,
  { label: string; strong: string[]; weak: string[]; phrases: string[]; minScore: number }
> = {
  writing: {
    label: "Writing & Messaging",
    phrases: [
      "cover letter",
      "linkedin post",
      "press release",
      "email response",
      "email reply",
      "follow up",
      "cold email",
      "sales email",
      "job application",
      "rewrite",
      "tone",
    ],
    strong: [
      "email",
      "copy",
      "rewrite",
      "edit",
      "grammar",
      "proof",
      "message",
      "reply",
      "response",
      "bio",
      "resume",
      "cover",
      "letter",
      "proposal",
      "pitch",
      "script",
      "dialogue",
      "headline",
    ],
    weak: ["clarify", "summarize", "concise", "professional", "polished"],
    minScore: 3,
  },

  research: {
    label: "Learning & Research",
    phrases: ["academic abstract", "literature review", "study guide", "research question", "explain like"],
    strong: [
      "academic",
      "research",
      "study",
      "learn",
      "lesson",
      "explain",
      "summary",
      "summarize",
      "abstract",
      "paper",
      "article",
      "source",
      "notes",
      "concept",
      "definition",
      "quiz",
      "flashcards",
    ],
    weak: ["simplify", "breakdown", "overview", "interpret", "clarification"],
    minScore: 3,
  },

  productivity: {
    label: "Workflows & Productivity",
    phrases: ["standard operating procedure", "to-do list", "step by step"],
    strong: [
      "checklist",
      "workflow",
      "sop",
      "template",
      "process",
      "procedure",
      "steps",
      "operations",
      "ops",
      "system",
      "organize",
      "prioritize",
      "plan",
      "framework",
    ],
    weak: ["improve", "streamline", "efficient", "structure", "track"],
    minScore: 3,
  },

  planning: {
    label: "Planning & Events",
    phrases: ["run of show", "event plan", "meeting agenda"],
    strong: [
      "event",
      "agenda",
      "itinerary",
      "schedule",
      "conference",
      "wedding",
      "party",
      "meeting",
      "presentation",
      "speaker",
      "prep",
      "prepare",
      "planning",
      "timeline",
    ],
    weak: ["checklist", "coordination", "logistics", "setup"],
    minScore: 3,
  },

  data: {
    label: "Data & Finance",
    phrases: ["cash flow", "financial model", "valuation", "income statement"],
    strong: [
      "finance",
      "financial",
      "valuation",
      "model",
      "forecast",
      "budget",
      "pricing",
      "metrics",
      "kpi",
      "analysis",
      "analyze",
      "calculate",
      "spreadsheet",
      "roi",
      "profit",
      "revenue",
      "cost",
      "margin",
      "numbers",
      "data",
    ],
    weak: ["compare", "summary", "insights", "estimate", "projection"],
    minScore: 3,
  },

  marketing: {
    label: "Marketing & Growth",
    phrases: ["landing page", "value proposition", "ad copy", "seo keywords"],
    strong: [
      "marketing",
      "growth",
      "ads",
      "ad",
      "seo",
      "campaign",
      "landing",
      "positioning",
      "hook",
      "brand",
      "audience",
      "offer",
      "conversion",
      "cta",
      "newsletter",
      "social",
      "content strategy",
    ],
    weak: ["headline", "pitch", "post", "copy", "optimize"],
    minScore: 3,
  },

  creative: {
    label: "Creative & Media",
    phrases: ["short story", "comic script", "character bio"],
    strong: [
      "creative",
      "story",
      "comic",
      "character",
      "plot",
      "scene",
      "dialogue",
      "poem",
      "lyrics",
      "name",
      "brainstorm",
      "ideas",
      "prompt",
      "worldbuilding",
    ],
    weak: ["style", "voice", "funny", "humor", "generate"],
    minScore: 3,
  },

  compliance: {
    label: "Policy & Professional",
    phrases: ["terms of service", "privacy policy", "risk assessment"],
    strong: ["policy", "compliance", "legal", "terms", "privacy", "disclaimer", "guidelines", "risk", "security", "hr", "regulation", "contract"],
    weak: ["professional", "formal", "review", "safe"],
    minScore: 3,
  },
};

function normalize(text: string) {
  return (text || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreCategory(haystack: string, categoryId: string) {
  const rule = CATEGORY_RULES[categoryId];
  if (!rule) return 0;

  let score = 0;
  for (const p of rule.phrases) if (haystack.includes(p)) score += 4;
  for (const kw of rule.strong) if (kw && haystack.includes(kw)) score += 2;
  for (const kw of rule.weak) if (kw && haystack.includes(kw)) score += 1;
  return score;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function StarsInline({ value, count }: { value?: number | null; count?: number | null }) {
  const v = typeof value === "number" ? value : 0;
  const c = typeof count === "number" ? count : 0;

  const full = Math.round(v);
  const stars = Array.from({ length: 5 }, (_, i) => (i < full ? "★" : "☆")).join("");

  return (
    <div className="flex items-center gap-2 text-[12px] text-slate-300">
      <span className="tracking-[0.2em] text-yellow-300/90">{stars}</span>
      <span className="text-slate-400">{c > 0 ? `${v.toFixed(1)} (${c})` : "No ratings"}</span>
    </div>
  );
}

/** Google-ish pagination numbers: 1 … 4 5 6 … 20 */
function buildPageModel(page: number, totalPages: number) {
  const items: Array<number | "…"> = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) items.push(i);
    return items;
  }

  const showLeft = Math.max(2, page - 1);
  const showRight = Math.min(totalPages - 1, page + 1);

  items.push(1);
  if (showLeft > 2) items.push("…");
  for (let i = showLeft; i <= showRight; i++) items.push(i);
  if (showRight < totalPages - 1) items.push("…");
  items.push(totalPages);

  return items;
}

type WorkflowKind = "PERSONAL" | "BUSINESS";
type WorkflowRow = {
  id: string;
  kind: WorkflowKind;
  name: string;
  data: any;
  createdAt: string;
  updatedAt: string;
};

type RecommendPayload = {
  kind: WorkflowKind;

  // “business-style”
  companyType: string;
  industry: string;
  teamSize: string;
  roles: string;

  // “personal-style”
  jobTitle: string;
  functionArea: string;

  // shared
  normalWeek: string;
  slowDowns: string;
  documents: string;
};

type RecommendedTool = {
  slug: string;
  title: string;
  reason: string;
  moment: string;
};

type ToolIdea = {
  title: string;
  description: string;
  whyDifferent: string;
};

function RecommendWizard({
  open,
  onClose,
  isSignedIn,
  onRequireSignIn,
  onSavedSlugsLocalAdd,
}: {
  open: boolean;
  onClose: () => void;
  isSignedIn: boolean;
  onRequireSignIn: () => Promise<void>;
  onSavedSlugsLocalAdd: (slugs: string[]) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [workflowsLoaded, setWorkflowsLoaded] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");

  const [form, setForm] = useState<RecommendPayload>({
    kind: "PERSONAL",

    companyType: "",
    industry: "",
    teamSize: "",
    roles: "",

    jobTitle: "",
    functionArea: "",

    normalWeek: "",
    slowDowns: "",
    documents: "",
  });

  const [profileName, setProfileName] = useState("");

  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendedTool[]>([]);
  const [ideas, setIdeas] = useState<ToolIdea[]>([]);
  const [selectedRec, setSelectedRec] = useState<Record<string, boolean>>({});
  const [selectedIdeas, setSelectedIdeas] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  function flash(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }

  async function loadWorkflowsOnce() {
    if (!isSignedIn) {
      setWorkflows([]);
      setWorkflowsLoaded(true);
      return;
    }
    try {
      const res = await fetch("/api/workflows", { cache: "no-store" });
      if (!res.ok) {
        setWorkflows([]);
        setWorkflowsLoaded(true);
        return;
      }
      const body = await res.json().catch(() => null);
      const rows = Array.isArray(body?.workflows) ? body.workflows : [];
      setWorkflows(rows);
    } catch {
      setWorkflows([]);
    } finally {
      setWorkflowsLoaded(true);
    }
  }

  function applyWorkflowData(w: WorkflowRow) {
    const d = w.data ?? {};
    setForm((p) => ({
      ...p,
      kind: w.kind,
      companyType: String(d.companyType ?? ""),
      industry: String(d.industry ?? ""),
      teamSize: String(d.teamSize ?? ""),
      roles: String(d.roles ?? ""),
      jobTitle: String(d.jobTitle ?? ""),
      functionArea: String(d.functionArea ?? ""),
      normalWeek: String(d.normalWeek ?? ""),
      slowDowns: String(d.slowDowns ?? ""),
      documents: String(d.documents ?? ""),
    }));
  }

  useEffect(() => {
    if (!open) return;

    // reset on open
    setStep(1);
    setLoading(false);
    setRecommendations([]);
    setIdeas([]);
    setSelectedRec({});
    setSelectedIdeas({});
    setToast(null);

    setSelectedWorkflowId("");
    setProfileName("");

    setForm({
      kind: "PERSONAL",
      companyType: "",
      industry: "",
      teamSize: "",
      roles: "",
      jobTitle: "",
      functionArea: "",
      normalWeek: "",
      slowDowns: "",
      documents: "",
    });

    setWorkflows([]);
    setWorkflowsLoaded(false);

    // load workflows for autofill
    loadWorkflowsOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submitIntake() {
    setLoading(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error("recommend error:", res.status, t);
        flash(`Recommend failed (${res.status})`);
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { recommended: RecommendedTool[]; ideas: ToolIdea[] };

      const rec = Array.isArray(data.recommended) ? data.recommended : [];
      const id = Array.isArray(data.ideas) ? data.ideas : [];

      setRecommendations(rec);
      setIdeas(id);

      const initSel: Record<string, boolean> = {};
      rec.forEach((r) => (initSel[r.slug] = true));
      setSelectedRec(initSel);

      const initIdeas: Record<number, boolean> = {};
      id.forEach((_, i) => (initIdeas[i] = false));
      setSelectedIdeas(initIdeas);

      setStep(2);
    } catch (e) {
      console.error(e);
      flash("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function saveWorkflowProfile() {
    if (!isSignedIn) {
      await onRequireSignIn();
      return;
    }

    const name = profileName.trim();
    if (!name) {
      flash("Give this workflow a name first.");
      return;
    }

    const payload = {
      name,
      kind: form.kind,
      data: {
        kind: form.kind,
        companyType: form.companyType,
        industry: form.industry,
        teamSize: form.teamSize,
        roles: form.roles,
        jobTitle: form.jobTitle,
        functionArea: form.functionArea,
        normalWeek: form.normalWeek,
        slowDowns: form.slowDowns,
        documents: form.documents,
      },
    };

    setLoading(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        flash(`Save workflow failed (${res.status})`);
        return;
      }
      flash("Workflow saved ✅");
      await loadWorkflowsOnce();
      setProfileName("");
    } catch (e) {
      console.error(e);
      flash("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function saveRecommended() {
    const slugs = Object.entries(selectedRec)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (slugs.length === 0) {
      flash("Select at least 1 tool.");
      return;
    }

    if (!isSignedIn) {
      await onRequireSignIn();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/tools/bulk-save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slugs }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error("bulk-save error:", res.status, t);
        flash(`Save failed (${res.status})`);
        setLoading(false);
        return;
      }

      onSavedSlugsLocalAdd(slugs);
      flash("Saved selected tools ✅");
      setStep(3);
    } catch (e) {
      console.error(e);
      flash("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function buildSelectedIdeas() {
    const picked = Object.entries(selectedIdeas)
      .filter(([, v]) => v)
      .map(([idx]) => Number(idx))
      .filter((n) => Number.isFinite(n));

    if (picked.length === 0) {
      flash("Pick 1–3 ideas first.");
      return;
    }
    if (picked.length > 3) {
      flash("Pick up to 3 ideas.");
      return;
    }
    if (!isSignedIn) {
      await onRequireSignIn();
      return;
    }

    const selected = picked.map((i) => ideas[i]).filter(Boolean);
    if (selected.length === 0) {
      flash("No ideas selected.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/build-tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ideas: selected }),
      });

      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json")
        ? await res.json().catch(() => null)
        : await res.text().catch(() => "");

      if (!res.ok) {
        console.error("build-tools error:", res.status, body);
        flash(`Build failed (${res.status})`);
        setLoading(false);
        return;
      }

      const slugs: string[] = Array.isArray((body as any)?.slugs) ? (body as any).slugs : [];
      if (slugs.length > 0) onSavedSlugsLocalAdd(slugs);

      flash(slugs.length > 0 ? `Built + saved ${slugs.length} new tools ✅` : "Build requested ✅");
      onClose();
    } catch (e) {
      console.error(e);
      flash("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const isBusiness = form.kind === "BUSINESS";

  const topHelp = isBusiness
    ? "Business mode: describe your company and roles so Atlas can recommend tools across the team."
    : "Personal mode: describe your own job + workflow so Atlas can recommend tools for you.";

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="absolute inset-0 flex items-end sm:items-center justify-center p-3 sm:p-4">
        <div className="relative w-full max-w-3xl rounded-2xl sm:rounded-3xl border border-white/10 bg-[#020617]/95 shadow-2xl shadow-purple-900/50 overflow-hidden">
          <div className="max-h-[90vh] overflow-y-auto overscroll-contain">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#020617]/95 backdrop-blur">
              <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.25em] text-purple-300/80 uppercase">
                    Atlas Recommendations
                  </p>
                  <h2 className="text-base sm:text-lg md:text-xl font-semibold leading-snug">
                    {step === 1 && "Recommend tools for your workflow"}
                    {step === 2 && "Your recommended tools"}
                    {step === 3 && "Optional: build brand-new tools for you"}
                  </h2>
                  <p className="mt-1 text-[11px] sm:text-xs md:text-sm text-gray-400">
                    {step === 1 && "Start by choosing Personal vs Business, then describe the workflow."}
                    {step === 2 && "These picks are tailored to what you wrote — save them to your account."}
                    {step === 3 && "These are new tool ideas generated from your workflow that Atlas can auto-build for you."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-full bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-white/10"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {toast && (
              <div className="px-4 sm:px-6 pt-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-gray-200">
                  {toast}
                </div>
              </div>
            )}

            <div className="px-4 sm:px-6 pb-5 sm:pb-6 pt-4 sm:pt-5">
              {step === 1 && (
                <div className="space-y-4">
                  {/* MODE + SAVED WORKFLOWS */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-gray-200">1) Choose context</div>
                        <div className="mt-1 text-[11px] text-gray-500">{topHelp}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, kind: "PERSONAL" }))}
                          className={
                            form.kind === "PERSONAL"
                              ? "rounded-full px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-500/70 to-blue-500/60 border border-purple-400/40"
                              : "rounded-full px-3 py-2 text-xs font-semibold text-gray-200 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-400/40 transition"
                          }
                        >
                          Personal
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, kind: "BUSINESS" }))}
                          className={
                            form.kind === "BUSINESS"
                              ? "rounded-full px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-500/70 to-blue-500/60 border border-purple-400/40"
                              : "rounded-full px-3 py-2 text-xs font-semibold text-gray-200 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-400/40 transition"
                          }
                        >
                          Business
                        </button>
                      </div>
                    </div>

                    {/* Saved workflow picker */}
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                      <div className="min-w-0">
                        <div className="mb-1 text-[11px] text-gray-400">
                          Saved workflows (autofill)
                        </div>
                        <select
                          value={selectedWorkflowId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedWorkflowId(id);
                            const w = workflows.find((x) => x.id === id);
                            if (w) applyWorkflowData(w);
                          }}
                          className="w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-100 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
                        >
                          <option value="" className="bg-[#020617]">
                            {workflowsLoaded
                              ? workflows.length > 0
                                ? "Select a saved workflow…"
                                : isSignedIn
                                  ? "No saved workflows yet"
                                  : "Sign in to use saved workflows"
                              : "Loading…"}
                          </option>
                          {workflows.map((w) => (
                            <option key={w.id} value={w.id} className="bg-[#020617]">
                              {w.kind === "BUSINESS" ? "Business" : "Personal"} — {w.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Link
                        href="/workflows"
                        onClick={(e) => {
                          if (!isSignedIn) e.preventDefault();
                        }}
                        className="self-end rounded-full px-3 py-2.5 text-xs font-semibold text-gray-200 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-400/40 transition text-center"
                        title={isSignedIn ? "Manage saved workflows" : "Sign in to manage workflows"}
                      >
                        Manage →
                      </Link>
                    </div>
                  </div>

                  {/* FIELDS */}
                  {isBusiness ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="Company type"
                        value={form.companyType}
                        onChange={(v) => setForm((p) => ({ ...p, companyType: v }))}
                        placeholder="Agency, SaaS, restaurant group…"
                      />
                      <Field
                        label="Industry"
                        value={form.industry}
                        onChange={(v) => setForm((p) => ({ ...p, industry: v }))}
                        placeholder="Healthcare, logistics, fintech…"
                      />
                      <Field
                        label="Team size"
                        value={form.teamSize}
                        onChange={(v) => setForm((p) => ({ ...p, teamSize: v }))}
                        placeholder="1, 5, 20, 200…"
                      />
                      <Field
                        label="Key roles"
                        value={form.roles}
                        onChange={(v) => setForm((p) => ({ ...p, roles: v }))}
                        placeholder="Sales, Ops, Support, Finance…"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field
                        label="Your job title"
                        value={form.jobTitle}
                        onChange={(v) => setForm((p) => ({ ...p, jobTitle: v }))}
                        placeholder="Analyst, Sales rep, Nurse, Student…"
                      />
                      <Field
                        label="Function / focus"
                        value={form.functionArea}
                        onChange={(v) => setForm((p) => ({ ...p, functionArea: v }))}
                        placeholder="Support, Finance, Ops, Writing, Engineering…"
                      />
                      <Field
                        label="Industry (optional)"
                        value={form.industry}
                        onChange={(v) => setForm((p) => ({ ...p, industry: v }))}
                        placeholder="Fintech, healthcare, retail…"
                      />
                      <Field
                        label="Team context (optional)"
                        value={form.teamSize}
                        onChange={(v) => setForm((p) => ({ ...p, teamSize: v }))}
                        placeholder="Solo, 3-person team, 40-person dept…"
                      />
                    </div>
                  )}

                  <TextArea
                    label={isBusiness ? "Describe a normal week (company)" : "Describe a normal week (you)"}
                    value={form.normalWeek}
                    onChange={(v) => setForm((p) => ({ ...p, normalWeek: v }))}
                    placeholder={
                      isBusiness
                        ? "What does the company do weekly? What repeats across teams?"
                        : "What do you do repeatedly? What are the common tasks you handle?"
                    }
                  />

                  <TextArea
                    label="What slows you down?"
                    value={form.slowDowns}
                    onChange={(v) => setForm((p) => ({ ...p, slowDowns: v }))}
                    placeholder="Where do things break, get delayed, or feel manual?"
                  />

                  <TextArea
                    label="What documents do you work with most?"
                    value={form.documents}
                    onChange={(v) => setForm((p) => ({ ...p, documents: v }))}
                    placeholder="Proposals, contracts, invoices, SOPs, meeting notes…"
                  />

                  {/* SAVE WORKFLOW */}
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs font-semibold text-gray-200">2) Save this workflow (optional)</div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      Save your Personal/Business profile so you can autofill next time and keep iterating.
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                      <input
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder={isBusiness ? "Name this business workflow (e.g., My Agency Ops)" : "Name this personal workflow (e.g., My Day Job)"}
                        className="w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
                      />
                      <button
                        type="button"
                        onClick={saveWorkflowProfile}
                        disabled={loading}
                        className="rounded-full px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-500/70 to-blue-500/60 border border-purple-400/40 hover:opacity-90 transition disabled:opacity-60"
                      >
                        Save workflow
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="text-[11px] text-gray-500">
                      You’re mapping your workflow — Atlas handles the tool matching.
                    </div>
                    <button
                      type="button"
                      onClick={submitIntake}
                      disabled={loading}
                      className="rounded-full px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-500/70 to-blue-500/60 border border-purple-400/40 hover:opacity-90 transition disabled:opacity-60"
                    >
                      {loading ? "Analyzing…" : "Get recommendations →"}
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-gray-200 font-semibold">
                      Recommended tools ({recommendations.length})
                    </p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      These recommendations are generated from your workflow description. Save the ones you want in your account.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {recommendations.map((r) => (
                      <div key={r.slug} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!selectedRec[r.slug]}
                            onChange={(e) =>
                              setSelectedRec((p) => ({ ...p, [r.slug]: e.target.checked }))
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-100">{r.title}</span>
                              <span className="text-[10px] text-gray-400">({r.slug})</span>
                            </div>
                            <p className="mt-1 text-[12px] text-gray-300">
                              <span className="text-purple-200 font-semibold">Why:</span> {r.reason}
                            </p>
                            <p className="mt-1 text-[12px] text-gray-400">
                              <span className="text-purple-200 font-semibold">Use it when:</span> {r.moment}
                            </p>
                          </div>
                        </label>

                        {/* ✅ REMOVED: Open button on the right */}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="rounded-full px-3 py-2 text-xs text-gray-200 border border-white/10 bg-white/5 hover:bg-white/10 transition"
                    >
                      ← Back
                    </button>

                    <button
                      type="button"
                      onClick={saveRecommended}
                      disabled={loading}
                      className="rounded-full px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-500/70 to-blue-500/60 border border-purple-400/40 hover:opacity-90 transition disabled:opacity-60"
                    >
                      {loading ? "Saving…" : "Save selected →"}
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-gray-200 font-semibold">
                      3 new tools Atlas can build for you ({ideas.length})
                    </p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      These ideas are generated *from your workflow* and are intended to fill gaps that aren’t covered by existing tools.
                      Pick up to 3 — Atlas will build them and auto-save them to your account.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {ideas.map((idea, i) => (
                      <div key={`${idea.title}-${i}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!selectedIdeas[i]}
                            onChange={(e) =>
                              setSelectedIdeas((p) => ({ ...p, [i]: e.target.checked }))
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-100">{idea.title}</div>
                            <p className="mt-1 text-[12px] text-gray-300">{idea.description}</p>
                            <p className="mt-1 text-[12px] text-gray-400">
                              <span className="text-purple-200 font-semibold">Why it’s different:</span>{" "}
                              {idea.whyDifferent}
                            </p>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="rounded-full px-3 py-2 text-xs text-gray-200 border border-white/10 bg-white/5 hover:bg-white/10 transition"
                    >
                      ← Back
                    </button>

                    <button
                      type="button"
                      onClick={buildSelectedIdeas}
                      disabled={loading}
                      className="rounded-full px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-500/70 to-blue-500/60 border border-purple-400/40 hover:opacity-90 transition disabled:opacity-60"
                    >
                      {loading ? "Building…" : "Build selected + save ✅"}
                    </button>
                  </div>

                  <div className="pt-1 text-[11px] text-gray-500">
                    Note: building commits new configs into your repo. Make sure env vars are set.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <button type="button" aria-label="Close overlay" onClick={onClose} className="absolute inset-0 -z-10" tabIndex={-1} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] text-gray-400">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] text-gray-400">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
      />
    </label>
  );
}

export default function ToolLibraryClient({ tools, savedSlugs, isSignedIn }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [localSaved, setLocalSaved] = useState<Set<string>>(() => new Set(savedSlugs));
  useEffect(() => setLocalSaved(new Set(savedSlugs)), [savedSlugs]);

  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const statusTimer = useRef<number | null>(null);

  const [recOpen, setRecOpen] = useState(false);

  function flashStatus(msg: string) {
    setSaveStatus(msg);
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setSaveStatus(null), 3500);
  }

  const savedOn = searchParams.get("saved") === "1";
  const qRaw = searchParams.get("q") || "";
  const query = normalize(qRaw);

  const category = searchParams.get("category") || "";
  const categoryLabel = CATEGORY_RULES[category]?.label;

  const sortParam = (searchParams.get("sort") || "rating-high") as SortId;
  const sort: SortId = SORT_OPTIONS.find((s) => s.id === sortParam)?.id ?? "rating-high";

  const pageParamRaw = searchParams.get("page") || "1";
  const pageParsed = Number.parseInt(pageParamRaw, 10);
  const requestedPage = Number.isFinite(pageParsed) && pageParsed > 0 ? pageParsed : 1;

  const setParam = (key: string, value?: string, resetPage = false) => {
    const current = new URLSearchParams(searchParams?.toString() || "");
    if (!value) current.delete(key);
    else current.set(key, value);
    if (resetPage) current.set("page", "1");

    const qs = current.toString();
    router.push(qs ? `/tools?${qs}` : "/tools", { scroll: true });
  };

  const setPage = (nextPage: number) => {
    const current = new URLSearchParams(searchParams?.toString() || "");
    current.set("page", String(nextPage));
    const qs = current.toString();
    router.push(qs ? `/tools?${qs}` : "/tools", { scroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function requireSignIn() {
    flashStatus("Sign in required.");
    await signIn("google", { callbackUrl: "/tools" });
  }

  async function toggleSave(slug: string) {
    if (!isSignedIn) {
      await requireSignIn();
      return;
    }

    const wasSaved = localSaved.has(slug);

    setLocalSaved((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(slug);
      else next.add(slug);
      return next;
    });

    try {
      const res = await fetch(`/api/tools/${slug}/save`, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      });

      let bodyText = "";
      let bodyJson: any = null;

      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        try {
          bodyJson = await res.json();
        } catch {
          bodyJson = null;
        }
      } else {
        try {
          bodyText = await res.text();
        } catch {
          bodyText = "";
        }
      }

      if (!res.ok) {
        console.error("Save failed:", { status: res.status, slug, bodyJson, bodyText });

        setLocalSaved((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(slug);
          else next.delete(slug);
          return next;
        });

        if (res.status === 401) {
          await requireSignIn();
          return;
        }

        flashStatus(`Save failed (${res.status}). Check console.`);
        return;
      }

      const savedValue = typeof bodyJson?.saved === "boolean" ? (bodyJson.saved as boolean) : !wasSaved;

      setLocalSaved((prev) => {
        const next = new Set(prev);
        if (savedValue) next.add(slug);
        else next.delete(slug);
        return next;
      });

      flashStatus(savedValue ? "Saved ✅" : "Unsaved ✅");
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("Save network error:", err);

      setLocalSaved((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(slug);
        else next.delete(slug);
        return next;
      });

      flashStatus("Network error — check console.");
    }
  }

  const sorted = useMemo(() => {
    let filtered = tools;

    if (savedOn) {
      filtered = !isSignedIn ? [] : filtered.filter((t) => localSaved.has(t.slug));
    }

    if (query) {
      filtered = filtered.filter((tool) => normalize(tool.title + " " + tool.description).includes(query));
    }

    if (category && category !== "all") {
      const rule = CATEGORY_RULES[category];
      if (rule) {
        filtered = filtered.filter((tool) => {
          const haystack = normalize(tool.title + " " + tool.description);
          return scoreCategory(haystack, category) >= rule.minScore;
        });
      }
    }

    const next = [...filtered].sort((a, b) => {
      const ar = typeof a.avgRating === "number" ? a.avgRating : 0;
      const br = typeof b.avgRating === "number" ? b.avgRating : 0;
      const ac = typeof a.ratingCount === "number" ? a.ratingCount : 0;
      const bc = typeof b.ratingCount === "number" ? b.ratingCount : 0;

      if (sort === "rating-high") {
        if (br !== ar) return br - ar;
        if (bc !== ac) return bc - ac;
        return normalize(a.title).localeCompare(normalize(b.title));
      }

      if (sort === "rating-low") {
        if (ar !== br) return ar - br;
        if (ac !== bc) return ac - bc;
        return normalize(a.title).localeCompare(normalize(b.title));
      }

      const at = normalize(a.title);
      const bt = normalize(b.title);
      return sort === "title-az" ? at.localeCompare(bt) : bt.localeCompare(at);
    });

    return next;
  }, [tools, savedOn, isSignedIn, localSaved, query, category, sort]);

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PER_PAGE));
  const page = clamp(requestedPage, 1, totalPages);

  const start = (page - 1) * PER_PAGE;
  const end = start + PER_PAGE;
  const pageItems = sorted.slice(start, end);

  const showingFrom = totalFiltered === 0 ? 0 : start + 1;
  const showingTo = Math.min(end, totalFiltered);

  const pageModel = buildPageModel(page, totalPages);

  return (
    <div>
      <RecommendWizard
        open={recOpen}
        onClose={() => setRecOpen(false)}
        isSignedIn={isSignedIn}
        onRequireSignIn={requireSignIn}
        onSavedSlugsLocalAdd={(slugs) => {
          setLocalSaved((prev) => {
            const next = new Set(prev);
            slugs.forEach((s) => next.add(s));
            return next;
          });
          startTransition(() => router.refresh());
        }}
      />

      {saveStatus && (
        <div className="mb-4 flex justify-center">
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-200">
            {saveStatus}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-xs md:text-sm text-gray-400 flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span>
              Showing <span className="text-purple-200 font-medium">{showingFrom}-{showingTo}</span> of{" "}
              <span className="text-purple-200 font-medium">{totalFiltered}</span>
            </span>

            {(qRaw.trim() || categoryLabel || savedOn) && (
              <>
                <span className="hidden sm:inline-block text-gray-600">•</span>
                <span className="flex flex-wrap items-center gap-1">
                  {savedOn && (
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs border border-purple-400/40 text-purple-100">
                      Saved
                    </span>
                  )}
                  {qRaw.trim() && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs border border-white/10">
                      “{qRaw}”
                    </span>
                  )}
                  {categoryLabel && (
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs border border-purple-400/40 text-purple-100">
                      {categoryLabel}
                    </span>
                  )}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center justify-center md:justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setRecOpen(true)}
              className="rounded-full px-3 py-2 text-xs md:text-sm font-semibold text-white bg-gradient-to-r from-purple-500/70 to-blue-500/60 border border-purple-400/40 hover:opacity-90 transition"
            >
              Recommend tools for me ✨
            </button>

            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setParam("sort", e.target.value, true)}
                className="appearance-none rounded-full bg-white/5 border border-white/10 text-gray-200 text-xs md:text-sm px-3 py-2 pr-9 hover:bg-white/10 hover:border-purple-400/40 transition"
                aria-label="Sort tools"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id} className="bg-[#020617]">
                    Sort: {o.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                ▾
              </div>
            </div>
          </div>
        </div>
      </div>

      {totalFiltered === 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-xs md:text-sm text-gray-400">
          No tools match your current filters.
          <div className="mt-2">Try clearing the search, picking a different category, or browsing all tools.</div>
        </div>
      )}

      {totalFiltered > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mt-4">
            {pageItems.map((tool) => {
              const isSaved = localSaved.has(tool.slug);

              return (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-400/40 transition duration-200 p-4 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-sm md:text-base font-medium mb-1 group-hover:text-white truncate">
                        {tool.title}
                      </h2>

                      <div className="mb-2">
                        <StarsInline value={tool.avgRating} count={tool.ratingCount} />
                      </div>

                      <p className="text-xs md:text-sm text-gray-400 line-clamp-3">{tool.description}</p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleSave(tool.slug);
                      }}
                      disabled={isPending}
                      className={
                        isSaved
                          ? "shrink-0 rounded-full border border-purple-400/40 bg-purple-500/15 px-3 py-1 text-[11px] text-purple-100 hover:bg-purple-500/20 transition disabled:opacity-60"
                          : "shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-200 hover:bg-white/10 hover:border-purple-400/40 transition disabled:opacity-60"
                      }
                      aria-label={isSaved ? "Unsave tool" : "Save tool"}
                      title={isSaved ? "Saved" : "Save"}
                    >
                      {isSaved ? "Saved ✓" : "Save"}
                    </button>
                  </div>

                  <div className="mt-3 text-[11px] text-purple-300/90 group-hover:text-purple-200">
                    Open tool →
                  </div>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-2 backdrop-blur">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="rounded-full px-3 py-1 text-xs text-gray-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  ← Prev
                </button>

                <div className="mx-1 h-5 w-px bg-white/10" />

                <div className="flex items-center gap-1">
                  {pageModel.map((item, idx) => {
                    if (item === "…") {
                      return (
                        <span key={`dots-${idx}`} className="px-2 text-xs text-gray-500 select-none">
                          …
                        </span>
                      );
                    }

                    const n = item;
                    const active = n === page;

                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPage(n)}
                        className={
                          active
                            ? "min-w-[34px] rounded-full px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-purple-500/70 to-blue-500/60 border border-purple-400/40 shadow-sm"
                            : "min-w-[34px] rounded-full px-3 py-1 text-xs text-gray-200 hover:bg-white/10 border border-transparent transition"
                        }
                        aria-current={active ? "page" : undefined}
                        aria-label={`Go to page ${n}`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>

                <div className="mx-1 h-5 w-px bg-white/10" />

                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="rounded-full px-3 py-1 text-xs text-gray-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
