import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Intake = {
  companyType?: string;
  industry?: string;
  teamSize?: string;
  roles?: string;
  normalWeek?: string;
  slowDowns?: string;
  documents?: string;
};

type ToolRow = {
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
};

type RecommendItem = {
  slug: string;
  title: string;
  reason: string;
  moment: string;
};

type ToolPreset = { label: string; input: string };

type ToolIdeaConfig = {
  slug: string;
  title: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  systemPrompt: string;
  temperature: number;
  features: string[];

  presets?: ToolPreset[];
  outputFormatDefault?: "plain" | "json";
  jsonSchemaHint?: string;
  clarifyPrompt?: string;
  finalizePrompt?: string;

  whyDifferent?: string;
};

function safeStr(x: any) {
  return typeof x === "string" ? x.trim() : "";
}

function normalize(text: string) {
  return (text || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toKebabSlug(s: string) {
  return normalize(s)
    .replace(/['"]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function sanitizeTemperature(t: any) {
  const n = Number(t);
  if (!Number.isFinite(n)) return 0.5;
  return clamp(n, 0, 1);
}

function stripCodeFences(raw: string) {
  return raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
}

/**
 * MUST match generateTool.mjs + build-tools route
 *
 * NOTE:
 * - "file-upload" includes text files AND audio/video uploads.
 * - audio/video are transcribed to text by the client/server before being sent to the tool.
 */
const AVAILABLE_FEATURES = [
  "text-input",
  "file-upload",
  "presets",
  "structured-output",
  "clarify-first",
  "saved-history",
] as const;

type Feature = (typeof AVAILABLE_FEATURES)[number];

function validateFeatures(maybe: any): Feature[] {
  if (!Array.isArray(maybe)) return ["text-input"];
  const cleaned = maybe
    .map((x) => String(x))
    .filter((f): f is Feature =>
      (AVAILABLE_FEATURES as readonly string[]).includes(f)
    );
  return cleaned.length ? cleaned : ["text-input"];
}

function normalizePresets(maybe: any): ToolPreset[] | undefined {
  if (!Array.isArray(maybe)) return undefined;
  const cleaned = maybe
    .slice(0, 5)
    .map((p) => ({
      label: safeStr(p?.label).slice(0, 60) || "Example",
      input: safeStr(p?.input).slice(0, 2500),
    }))
    .filter((p) => p.input.length > 0);

  if (cleaned.length === 0) return undefined;
  return cleaned;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Intake;

  const intake: Intake = {
    companyType: safeStr(body.companyType),
    industry: safeStr(body.industry),
    teamSize: safeStr(body.teamSize),
    roles: safeStr(body.roles),
    normalWeek: safeStr(body.normalWeek),
    slowDowns: safeStr(body.slowDowns),
    documents: safeStr(body.documents),
  };

  const tools: ToolRow[] = await prisma.tool.findMany({
    select: { slug: true, title: true, description: true, category: true },
    orderBy: { title: "asc" },
  });

  const toolMap = new Map(tools.map((t) => [t.slug, t]));
  const existingSlugs = new Set(tools.map((t) => t.slug.toLowerCase()));
  const existingTitles = new Set(tools.map((t) => (t.title || "").toLowerCase()));

  const intakeText = `
Company type: ${intake.companyType}
Industry: ${intake.industry}
Team size: ${intake.teamSize}
Key roles: ${intake.roles}

Normal day/week:
${intake.normalWeek}

What slows you down:
${intake.slowDowns}

Documents you work with:
${intake.documents}
  `.trim();

  const existingSummary =
    tools.length === 0
      ? "There are currently no existing tools."
      : "Existing tools:\n" +
        tools
          .slice(0, 900)
          .map(
            (t) =>
              `- slug: ${t.slug}, title: ${t.title}, description: ${t.description ?? ""}`
          )
          .join("\n");

  // Fallback heuristic if no OpenAI key
  if (!process.env.OPENAI_API_KEY) {
    const hay = normalize(intakeText);

    const scored = tools
      .map((t) => {
        const h = normalize(`${t.title} ${t.description ?? ""}`);
        let score = 0;
        const words = hay.split(" ").filter(Boolean);
        for (const w of words.slice(0, 90)) {
          if (w.length < 4) continue;
          if (h.includes(w)) score += 1;
        }
        return { t, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .filter((x) => x.score > 0);

    const recommended: RecommendItem[] = scored.map((x) => ({
      slug: x.t.slug,
      title: x.t.title,
      reason: "Matches your described workflow/documents.",
      moment: "Use it at the step where you currently do this manually.",
    }));

    const ideas: ToolIdeaConfig[] = [
      {
        slug: "workflow-bottleneck-mapper",
        title: "Workflow Bottleneck Mapper",
        description:
          "Turns your week description into a ranked bottleneck list and outputs SOP-grade checklists and templates for the top friction points.",
        inputLabel: "Paste your workflow description + examples",
        outputLabel: "Bottlenecks + SOP templates",
        systemPrompt:
          "You are a workflow analyst. Produce a prioritized bottleneck list and SOP-grade templates for the top 3 bottlenecks. Do not invent facts. Ask 3 clarifying questions if missing key details.",
        temperature: 0.45,
        features: ["text-input", "presets", "saved-history"],
        presets: [
          { label: "Operations team", input: "We handle weekly reporting, client requests, and data QA. The main delays are..." },
          { label: "Analyst workflow", input: "I review statements/cap tables, extract key fields, and reconcile inconsistencies. Pain points are..." },
        ],
      },
    ];

    return NextResponse.json({ recommended, ideas });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const RUBRIC = `
You are Atlas: a workflow analyst + product designer for small, one-page AI tools.

You will receive:
1) A workflow intake
2) A list of existing Atlas tools (slug/title/description)
3) AVAILABLE_FEATURES you are allowed to use

Your job:
(A) Recommend existing tools from the list that fit the workflow.
(B) Propose 1–3 NEW tool ideas AS FULL TOOL CONFIG JSON (same schema as our generator),
    strictly buildable with AVAILABLE_FEATURES.

Hard constraints:
- Single-page tool.
- Input is plain text (textarea) and/or text extracted from uploaded files.
  IMPORTANT: "file-upload" can include:
  - text files (txt/md/csv/json/log/html/xml)
  - audio/video files (mp3/wav/m4a/mp4/mov/webm) which are automatically transcribed to text before being passed to the tool.
- Output is plain text OR valid JSON if structured-output is enabled.
- Must be moment-of-use specific (role + scenario).
- Must not overlap existing tools (role+input+output purpose).
- Avoid medical diagnosis, legal advice, unsafe/wrongdoing.

Feature rules:
- Every new tool MUST include "features".
- features may only include names from AVAILABLE_FEATURES.

Optional fields rules:
- If features includes "presets", include 2–5 presets: [{"label","input"}]
- If features includes "structured-output", include:
  - outputFormatDefault: "plain" or "json"
  - jsonSchemaHint (short description of keys expected when json)
- If features includes "clarify-first", include:
  - clarifyPrompt (what questions to ask)
  - finalizePrompt (how to generate final artifact from answers)
- If features includes "saved-history", no extra fields required.

Return ONLY strict JSON with this top-level shape:

{
  "recommended": [{"slug": "...", "title": "...", "reason": "...", "moment": "..."}],
  "ideas": [
    {
      "slug": "kebab-case",
      "title": "...",
      "description": "...",
      "inputLabel": "...",
      "outputLabel": "...",
      "systemPrompt": "...",
      "temperature": 0.0,
      "features": ["text-input"],
      "presets"?: [{"label":"...","input":"..."}],
      "outputFormatDefault"?: "plain" | "json",
      "jsonSchemaHint"?: string,
      "clarifyPrompt"?: string,
      "finalizePrompt"?: string,
      "whyDifferent"?: string
    }
  ]
}
  `.trim();

  const USER = `
WORKFLOW INTAKE:
${intakeText}

${existingSummary}

AVAILABLE_FEATURES: ${AVAILABLE_FEATURES.join(", ")}

Tasks:
1) Recommend 6–10 existing tools max (ONLY from the list). For each: slug, title, reason, moment.
2) Generate 1–3 NEW tool configs that are clearly non-overlapping with existing tools AND with each other.
   They must be buildable using only AVAILABLE_FEATURES and include the correct optional fields when those features are used.
  `.trim();

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: RUBRIC },
      { role: "user", content: USER },
    ],
    temperature: 0.5,
  });

  let raw = stripCodeFences(completion.choices[0]?.message?.content ?? "");
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { recommended: [], ideas: [] };
  }

  const recommended: RecommendItem[] = Array.isArray(parsed.recommended)
    ? parsed.recommended
        .filter((r: any) => r?.slug && toolMap.has(String(r.slug)))
        .slice(0, 10)
        .map((r: any) => {
          const slug = String(r.slug);
          const t = toolMap.get(slug);
          return {
            slug,
            title: String(r.title || t?.title || slug),
            reason: String(r.reason || ""),
            moment: String(r.moment || ""),
          };
        })
    : [];

  const ideasRaw: any[] = Array.isArray(parsed.ideas) ? parsed.ideas.slice(0, 3) : [];

  const ideas: ToolIdeaConfig[] = [];
  for (const x of ideasRaw) {
    const title = safeStr(x?.title);
    const description = safeStr(x?.description);
    const inputLabel = safeStr(x?.inputLabel) || "Paste your input text";
    const outputLabel = safeStr(x?.outputLabel) || "Generated output";
    const systemPrompt = safeStr(x?.systemPrompt);
    const whyDifferent = safeStr(x?.whyDifferent);

    if (!title || !description || !systemPrompt) continue;
    if (existingTitles.has(title.toLowerCase())) continue;

    const proposedSlug = safeStr(x?.slug) || toKebabSlug(title);
    let slug = toKebabSlug(proposedSlug) || `new-tool-${ideas.length + 1}`;

    if (existingSlugs.has(slug.toLowerCase())) {
      let i = 1;
      while (existingSlugs.has(`${slug}-${i}`.toLowerCase())) i++;
      slug = `${slug}-${i}`;
    }

    const alreadyProposed = new Set(ideas.map((i) => i.slug.toLowerCase()));
    if (alreadyProposed.has(slug.toLowerCase())) {
      let i = 1;
      while (alreadyProposed.has(`${slug}-${i}`.toLowerCase())) i++;
      slug = `${slug}-${i}`;
    }

    const feats = validateFeatures(x?.features);

    const idea: ToolIdeaConfig = {
      slug,
      title,
      description,
      inputLabel,
      outputLabel,
      systemPrompt,
      temperature: sanitizeTemperature(x?.temperature),
      features: feats,
      whyDifferent: whyDifferent || "",
    };

    if (feats.includes("presets")) {
      const p = normalizePresets(x?.presets);
      if (p) idea.presets = p;
    }

    if (feats.includes("structured-output")) {
      const d = safeStr(x?.outputFormatDefault) as any;
      idea.outputFormatDefault = d === "json" ? "json" : "plain";
      idea.jsonSchemaHint = safeStr(x?.jsonSchemaHint);
    }

    if (feats.includes("clarify-first")) {
      idea.clarifyPrompt = safeStr(x?.clarifyPrompt);
      idea.finalizePrompt = safeStr(x?.finalizePrompt);
    }

    ideas.push(idea);
  }

  return NextResponse.json({ recommended, ideas });
}
