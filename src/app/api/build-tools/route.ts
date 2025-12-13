import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import OpenAI from "openai";

type ToolIdea = { title: string; description: string; whyDifferent?: string };

function b64(s: string) {
  return Buffer.from(s, "utf8").toString("base64");
}

async function githubPutFile({
  owner,
  repo,
  branch,
  path,
  content,
  message,
}: {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  content: string;
  message: string;
}) {
  const token = process.env.GITHUB_TOKEN!;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;

  // check if exists (need sha to update)
  const getRes = await fetch(`${url}?ref=${branch}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  let sha: string | undefined;
  if (getRes.ok) {
    const j: any = await getRes.json().catch(() => null);
    sha = j?.sha;
  }

  const putRes = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      content: b64(content),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  const putJson = await putRes.json().catch(() => null);
  if (!putRes.ok) {
    throw new Error(
      `GitHub PUT failed (${putRes.status}): ${JSON.stringify(putJson)}`
    );
  }

  return putJson;
}

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  const email = session?.user?.email as string | undefined;
  let userId = (session?.user as any)?.id as string | undefined;

  if (!userId && email) {
    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    userId = dbUser?.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  }
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER || !process.env.GITHUB_REPO) {
    return NextResponse.json(
      { error: "Missing GitHub env vars (GITHUB_TOKEN/GITHUB_OWNER/GITHUB_REPO)" },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { ideas?: ToolIdea[] };
  const ideas = Array.isArray(body.ideas) ? body.ideas.slice(0, 3) : [];
  if (ideas.length === 0) {
    return NextResponse.json({ error: "No ideas provided" }, { status: 400 });
  }

  const owner = process.env.GITHUB_OWNER!;
  const repo = process.env.GITHUB_REPO!;
  const branch = process.env.GITHUB_BRANCH || "main";

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // existing tools (for non-overlap)
  const existingTools = await prisma.tool.findMany({
    select: { slug: true, title: true, description: true },
    orderBy: { title: "asc" },
  });

  const existingSummary =
    existingTools.length === 0
      ? "There are currently no existing tools."
      : "Existing tools:\n" +
        existingTools
          .slice(0, 1200)
          .map((t) => `- slug: ${t.slug}, title: ${t.title}, description: ${t.description ?? ""}`)
          .join("\n");

  const RUBRIC = `
You generate ONE new Atlas tool config as strict JSON.

Hard constraints:
- Single-page tool.
- Input is plain text (textarea) and/or file-upload.
- Output is plain text.
- Must be a specific moment-of-use tool (role + scenario).
- Must not overlap existing tools (role+input+output purpose).
- Avoid medical diagnosis, legal advice, unsafe/wrongdoing.
- slug must be unique (kebab-case, lowercase).

Return ONLY strict JSON with shape:
{
  "slug": string,
  "title": string,
  "description": string,
  "inputLabel": string,
  "outputLabel": string,
  "systemPrompt": string,
  "temperature": number 0..1,
  "features": string[] // ["text-input"] or ["text-input","file-upload"]
}
  `.trim();

  const slugsBuilt: string[] = [];

  for (const idea of ideas) {
    const baseSlug = slugify(idea.title) || `tool-${Date.now()}`;

    // create config via OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: RUBRIC },
        {
          role: "user",
          content: `
${existingSummary}

CUSTOM TOOL IDEA TO BUILD:
Title: ${idea.title}
Description: ${idea.description}

Generate the tool config. It must be clearly different from all existing tools.
          `.trim(),
        },
      ],
      temperature: 0.7,
    });

    let raw = completion.choices[0]?.message?.content ?? "";
    raw = raw.trim().replace(/```json/g, "").replace(/```/g, "");

    let config: any;
    try {
      config = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Failed to parse tool JSON from OpenAI." }, { status: 500 });
    }

    // normalize slug + ensure uniqueness
    let slug = slugify(config.slug || baseSlug) || baseSlug;

    // If slug exists in DB, suffix it
    const exists = await prisma.tool.findUnique({ where: { slug }, select: { id: true } });
    if (exists) {
      let i = 1;
      while (true) {
        const trySlug = `${slug}-${i}`;
        const e = await prisma.tool.findUnique({ where: { slug: trySlug }, select: { id: true } });
        if (!e) {
          slug = trySlug;
          break;
        }
        i++;
      }
    }

    const finalConfig = { ...config, slug };

    // commit JSON into tool-configs/
    const filePath = `tool-configs/${slug}.json`;
    await githubPutFile({
      owner,
      repo,
      branch,
      path: filePath,
      content: JSON.stringify(finalConfig, null, 2),
      message: `Add tool: ${slug}`,
    });

    // upsert Tool row so it appears immediately in DB-backed areas
    const toolRow = await prisma.tool.upsert({
      where: { slug },
      update: {
        title: String(finalConfig.title || slug),
        description: finalConfig.description ? String(finalConfig.description) : null,
        inputLabel: finalConfig.inputLabel ? String(finalConfig.inputLabel) : null,
        outputLabel: finalConfig.outputLabel ? String(finalConfig.outputLabel) : null,
      },
      create: {
        slug,
        title: String(finalConfig.title || slug),
        description: finalConfig.description ? String(finalConfig.description) : null,
        inputLabel: finalConfig.inputLabel ? String(finalConfig.inputLabel) : null,
        outputLabel: finalConfig.outputLabel ? String(finalConfig.outputLabel) : null,
      },
    });

    // auto-save to user
    await prisma.savedTool.createMany({
      data: [{ userId, toolId: toolRow.id }],
      skipDuplicates: true,
    });

    slugsBuilt.push(slug);
  }

  return NextResponse.json({ ok: true, slugs: slugsBuilt });
}
