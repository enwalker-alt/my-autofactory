import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

type Intake = {
  companyType?: string;
  industry?: string;
  teamSize?: string;
  roles?: string;
  normalWeek?: string;
  slowDowns?: string;
  documents?: string;
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

  // Pull tools from DB (fast + already synced)
  const tools = await prisma.tool.findMany({
    select: { slug: true, title: true, description: true, category: true },
    orderBy: { title: "asc" },
  });

  const toolSummary = tools
    .map((t) => `- ${t.slug}: ${t.title} — ${t.description ?? ""}`)
    .slice(0, 1200)
    .join("\n");

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

  // ---- Fallback heuristic if no OpenAI key
  if (!process.env.OPENAI_API_KEY) {
    const hay = normalize(intakeText);

    const scored = tools
      .map((t) => {
        const h = normalize(`${t.title} ${t.description ?? ""}`);
        let score = 0;

        // small heuristic matching
        const words = hay.split(" ").filter(Boolean);
        for (const w of words.slice(0, 80)) {
          if (w.length < 4) continue;
          if (h.includes(w)) score += 1;
        }
        return { t, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .filter((x) => x.score > 0);

    const recommended = scored.map((x) => ({
      slug: x.t.slug,
      title: x.t.title,
      reason: "Matches your described workflow/documents.",
      moment: "Use it during the step where you currently do this manually.",
    }));

    const ideas = [
      {
        title: "Workflow Friction Spotter",
        description:
          "Turns a week description into a ranked list of bottlenecks with suggested automations and templates.",
        whyDifferent:
          "It creates a prioritized bottleneck map (not just rewriting/summarizing).",
      },
    ];

    return NextResponse.json({ recommended, ideas });
  }

  // ---- OpenAI matching + novel ideas
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const SYSTEM = `
You are Atlas, a workflow analyst + tool matcher.

Input: a company/workflow intake + a list of existing Atlas tools (slug/title/description).
Output: (1) a short list of recommended existing tools with tight reasoning AND the exact moment-of-use,
(2) 1-3 NEW tool ideas that are clearly non-overlapping with existing tools.

Hard constraints:
- Recommend ONLY tools that appear in the provided list.
- Each recommendation must include: slug, title, reason, moment.
- Ideas must not overlap existing tools: no similar role+input+output purpose.
- Avoid medical diagnosis, legal advice, unsafe, wrongdoing instructions.
Return ONLY strict JSON with this exact shape:

{
  "recommended": [{"slug": "...", "title": "...", "reason": "...", "moment": "..."}],
  "ideas": [{"title": "...", "description": "...", "whyDifferent": "..."}]
}
  `.trim();

  const USER = `
WORKFLOW INTAKE:
${intakeText}

EXISTING TOOLS:
${toolSummary}

Pick 6-10 recommended tools max.
Then generate 1-3 new tool ideas that are not similar to any existing tool.
  `.trim();

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: USER },
    ],
    temperature: 0.5,
  });

  let raw = completion.choices[0]?.message?.content ?? "";
  raw = raw.trim().replace(/```json/g, "").replace(/```/g, "");

  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Last resort fallback
    parsed = { recommended: [], ideas: [] };
  }

  // Safety: ensure slugs exist
  const toolMap = new Map(tools.map((t) => [t.slug, t]));
  const recommended = Array.isArray(parsed.recommended)
    ? parsed.recommended
        .filter((r: any) => r?.slug && toolMap.has(String(r.slug)))
        .slice(0, 10)
        .map((r: any) => ({
          slug: String(r.slug),
          title: String(r.title || toolMap.get(String(r.slug))?.title || r.slug),
          reason: String(r.reason || ""),
          moment: String(r.moment || ""),
        }))
    : [];

  const ideas = Array.isArray(parsed.ideas)
    ? parsed.ideas.slice(0, 3).map((x: any) => ({
        title: String(x.title || ""),
        description: String(x.description || ""),
        whyDifferent: String(x.whyDifferent || ""),
      }))
    : [];

  return NextResponse.json({ recommended, ideas });
}
