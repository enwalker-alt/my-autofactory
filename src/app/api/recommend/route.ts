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

type ToolIdeaConfig = {
  slug: string;
  title: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  systemPrompt: string;
  temperature: number;
  features: string[];
  // Optional UI field (your modal uses this)
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

/**
 * Match your generator’s feature list.
 * (Later: import this from a shared file to avoid drift.)
 */
const AVAILABLE_FEATURES = ["text-input", "file-upload"] as const;
type Feature = (typeof AVAILABLE_FEATURES)[number];

function validateFeatures(maybe: any): Feature[] {
  if (!Array.isArray(maybe)) return ["text-input"];
  const cleaned = maybe
    .map((x) => String(x))
    .filter((f): f is Feature => (AVAILABLE_FEATURES as readonly string[]).includes(f));
  return cleaned.length ? cleaned : ["text-input"];
}

/**
 * Same “too simple” policy as generateTool.mjs (but deterministic-ish).
 * When you add more global features later, this will start discouraging
 * single-feature tools automatically.
 */
function generateTooSimpleBias(availableCount: number) {
  // if few features exist, allow anything
  if (availableCount <= 2) return 0; // 0 = no rejection
  // else: reject single text-input ideas ~80% of the time (like your script)
  return 0.8;
}

function sanitizeTemperature(t: any) {
  const n = Number(t);
  if (!Number.isFinite(n)) return 0.5;
  return clamp(n, 0, 1);
}

function stripCodeFences(raw: string) {
  return raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
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

  // Pull tools from DB (already synced)
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
          .slice(0, 900) // keep prompt bounded
          .map(
            (t) =>
              `- slug: ${t.slug}, title: ${t.title}, description: ${t.description ?? ""}`
          )
          .join("\n");

  /**
   * Fallback heuristic (no OpenAI key)
   */
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
      moment: "Use it at the exact step where you currently do this manually.",
    }));

    // Minimal buildable ideas in generator-like shape
    const ideas: ToolIdeaConfig[] = [
      {
        slug: "workflow-bottleneck-mapper",
        title: "Workflow Bottleneck Mapper",
        description:
          "Turns your week description into a ranked bottleneck list and outputs copy/paste SOP-grade checklists and templates for the top friction points.",
        inputLabel: "Paste your workflow description + examples",
        outputLabel: "Bottlenecks + SOP templates",
        systemPrompt:
          "You are a workflow analyst. Produce a prioritized bottleneck list and then produce SOP-grade templates for the top 3 bottlenecks. Use headings. Do not invent facts. Ask 3 clarifying questions if missing key details.",
        temperature: 0.45,
        features: ["text-input"],
        whyDifferent:
          "It generates a prioritized bottleneck map plus SOP templates, not generic rewriting.",
      },
    ];

    return NextResponse.json({ recommended, ideas });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  /**
   * This is the key change:
   * We embed your generator RUBRIC (adapted) and require ideas to be FULL tool configs.
   */
  const RUBRIC = `
You are Atlas: a workflow analyst + product designer for small, one-page AI tools.

You will receive:
1) A workflow intake
2) A list of existing Atlas tools (slug/title/description)
3) The list of AVAILABLE_FEATURES you are allowed to use

Your job:
(A) Recommend existing tools from the list that fit the workflow.
(B) Propose 1–3 NEW tool ideas AS FULL TOOL CONFIG JSON (same schema used by our generator),
    strictly buildable with AVAILABLE_FEATURES.

HARD CONSTRAINTS (must follow):
- Each tool must be usable as a single-page web app.
- Input is plain text (textarea) and/or text extracted from uploaded files.
- Output is plain text.
- Target a specific niche (role + scenario), not a broad audience.
- Must be actually useful, not a joke.
- Avoid: medical diagnosis, legal advice, unsafe content, or instructions enabling wrongdoing.
- NEW ideas must be clearly different from existing tools:
  - No overlapping user role AND overlapping input text type AND overlapping output purpose.
  - Superficial rewording or swapping job titles does NOT count as different.

AVAILABLE FEATURES:
1) "text-input" → textarea
2) "file-upload" → users upload files; you only receive extracted TEXT

SCALING & COMPLEXITY GUIDELINES:
- Prefer combining multiple features meaningfully when it clearly helps.
- With ONLY these two features, prefer ["text-input","file-upload"] when the value depends on analyzing a document;
  otherwise keep ["text-input"].

IMPORTANT FEATURE RULES:
- For EVERY new tool idea, include a "features" array.
- "features" may only contain names from AVAILABLE_FEATURES.
- If only textarea is needed: ["text-input"]
- If doc analysis helps: ["text-input","file-upload"]

SYSTEM PROMPT QUALITY BAR:
- The systemPrompt must clearly state:
  - the niche user
  - the exact artifact produced
  - 3–6 hard rules (e.g. don’t invent facts, ask clarifying questions if missing info, concise bullets, etc.)
- Must enforce structured output with headings/bullets.

Return ONLY strict JSON with this exact top-level shape:

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
      "whyDifferent": "short explanation"
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
2) Generate 1–3 NEW tool ideas that are clearly non-overlapping with existing tools AND with each other.
   IMPORTANT: NEW ideas MUST be returned as FULL TOOL CONFIG objects (slug/title/description/inputLabel/outputLabel/systemPrompt/temperature/features).
   Features must ONLY use the allowed list.
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

  // ---------- sanitize recommended ----------
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

  // ---------- sanitize ideas into FULL tool configs ----------
  const tooSimpleRejectProb = generateTooSimpleBias(AVAILABLE_FEATURES.length);

  const ideasRaw: any[] = Array.isArray(parsed.ideas) ? parsed.ideas.slice(0, 3) : [];

  const ideasSanitized: ToolIdeaConfig[] = [];
  for (const x of ideasRaw) {
    const title = safeStr(x?.title);
    const description = safeStr(x?.description);
    const inputLabel = safeStr(x?.inputLabel) || "Paste your input text";
    const outputLabel = safeStr(x?.outputLabel) || "Generated output";
    const systemPrompt = safeStr(x?.systemPrompt);
    const whyDifferent = safeStr(x?.whyDifferent);

    // slug rules
    const proposedSlug = safeStr(x?.slug) || toKebabSlug(title);
    let slug = toKebabSlug(proposedSlug);

    // Ensure uniqueness vs existing + other ideas
    if (!slug) slug = `new-tool-${ideasSanitized.length + 1}`;
    if (existingSlugs.has(slug.toLowerCase())) {
      let i = 1;
      while (existingSlugs.has(`${slug}-${i}`.toLowerCase())) i++;
      slug = `${slug}-${i}`;
    }
    const alreadyProposed = new Set(ideasSanitized.map((i) => i.slug.toLowerCase()));
    if (alreadyProposed.has(slug.toLowerCase())) {
      let i = 1;
      while (alreadyProposed.has(`${slug}-${i}`.toLowerCase())) i++;
      slug = `${slug}-${i}`;
    }

    // Validate features
    const features = validateFeatures(x?.features);

    // Encourage “not too simple” once feature set grows
    if (
      tooSimpleRejectProb > 0 &&
      features.length === 1 &&
      features[0] === "text-input"
    ) {
      // probabilistic rejection like your generator
      if (Math.random() < tooSimpleRejectProb) {
        continue;
      }
    }

    // reject if title duplicates existing titles
    if (existingTitles.has(title.toLowerCase())) continue;

    // Require systemPrompt (because build-tools will need it)
    if (!title || !description || !systemPrompt) continue;

    ideasSanitized.push({
      slug,
      title,
      description,
      inputLabel,
      outputLabel,
      systemPrompt,
      temperature: sanitizeTemperature(x?.temperature),
      features,
      whyDifferent: whyDifferent || "",
    });
  }

  return NextResponse.json({
    recommended,
    ideas: ideasSanitized,
  });
}
