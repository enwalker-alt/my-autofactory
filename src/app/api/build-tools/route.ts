import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

type ToolPreset = { label: string; input: string };

type ToolConfigIncoming = {
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
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(
    path
  )}`;

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
    throw new Error(`GitHub PUT failed (${putRes.status}): ${JSON.stringify(putJson)}`);
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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function sanitizeTemperature(t: any) {
  const n = Number(t);
  if (!Number.isFinite(n)) return 0.5;
  return clamp(n, 0, 1);
}

/**
 * MUST match generateTool.mjs + recommend route
 *
 * NOTE:
 * - "file-upload" includes text files and audio/video which are transcribed to text
 *   before being passed into the tool prompt.
 */
const AVAILABLE_FEATURES = [
  "text-input",
  "file-upload",
  "presets",
  "structured-output",
  "clarify-first",
  "saved-history",
] as const;

function validateFeatures(maybe: any): string[] {
  if (!Array.isArray(maybe)) return ["text-input"];
  const cleaned = maybe
    .map((x) => String(x))
    .filter((f) => (AVAILABLE_FEATURES as readonly string[]).includes(f));
  return cleaned.length ? cleaned : ["text-input"];
}

function normalizePresets(maybe: any): ToolPreset[] | undefined {
  if (!Array.isArray(maybe)) return undefined;
  const cleaned = maybe
    .slice(0, 5)
    .map((p) => ({
      label: typeof p?.label === "string" ? p.label.trim().slice(0, 60) : "Example",
      input: typeof p?.input === "string" ? p.input.trim().slice(0, 2500) : "",
    }))
    .filter((p) => p.input.length > 0);

  return cleaned.length ? cleaned : undefined;
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

  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_OWNER || !process.env.GITHUB_REPO) {
    return NextResponse.json(
      { error: "Missing GitHub env vars (GITHUB_TOKEN/GITHUB_OWNER/GITHUB_REPO)" },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { ideas?: ToolConfigIncoming[] };
  const ideas = Array.isArray(body.ideas) ? body.ideas.slice(0, 3) : [];

  if (ideas.length === 0) {
    return NextResponse.json({ error: "No ideas provided" }, { status: 400 });
  }

  const owner = process.env.GITHUB_OWNER!;
  const repo = process.env.GITHUB_REPO!;
  const branch = process.env.GITHUB_BRANCH || "main";

  const slugsBuilt: string[] = [];

  for (const incoming of ideas) {
    const title = String(incoming?.title || "").trim();
    const description = String(incoming?.description || "").trim();
    const systemPrompt = String(incoming?.systemPrompt || "").trim();

    if (!title || !description || !systemPrompt) {
      return NextResponse.json(
        { error: "Invalid tool config: missing title/description/systemPrompt" },
        { status: 400 }
      );
    }

    const baseSlug = slugify(incoming?.slug || title) || `tool-${Date.now()}`;
    let slug = baseSlug;

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

    const features = validateFeatures(incoming?.features);
    const presets = features.includes("presets") ? normalizePresets(incoming?.presets) : undefined;

    const outputFormatDefault = features.includes("structured-output")
      ? incoming?.outputFormatDefault === "json"
        ? "json"
        : "plain"
      : undefined;

    const jsonSchemaHint = features.includes("structured-output")
      ? String(incoming?.jsonSchemaHint || "").trim()
      : undefined;

    const clarifyPrompt = features.includes("clarify-first")
      ? String(incoming?.clarifyPrompt || "").trim()
      : undefined;

    const finalizePrompt = features.includes("clarify-first")
      ? String(incoming?.finalizePrompt || "").trim()
      : undefined;

    const finalConfig = {
      slug,
      title,
      description,
      inputLabel: String(incoming?.inputLabel || "Paste your input text").trim(),
      outputLabel: String(incoming?.outputLabel || "Generated output").trim(),
      systemPrompt,
      temperature: sanitizeTemperature(incoming?.temperature),
      features,

      ...(presets ? { presets } : {}),
      ...(outputFormatDefault ? { outputFormatDefault } : {}),
      ...(jsonSchemaHint ? { jsonSchemaHint } : {}),
      ...(clarifyPrompt ? { clarifyPrompt } : {}),
      ...(finalizePrompt ? { finalizePrompt } : {}),
      ...(incoming?.whyDifferent ? { whyDifferent: String(incoming.whyDifferent).trim() } : {}),
    };

    const filePath = `tool-configs/${slug}.json`;
    await githubPutFile({
      owner,
      repo,
      branch,
      path: filePath,
      content: JSON.stringify(finalConfig, null, 2),
      message: `Add tool: ${slug}`,
    });

    const toolRow = await prisma.tool.upsert({
      where: { slug },
      update: {
        title: finalConfig.title,
        description: finalConfig.description ?? null,
        inputLabel: finalConfig.inputLabel ?? null,
        outputLabel: finalConfig.outputLabel ?? null,
      },
      create: {
        slug,
        title: finalConfig.title,
        description: finalConfig.description ?? null,
        inputLabel: finalConfig.inputLabel ?? null,
        outputLabel: finalConfig.outputLabel ?? null,
      },
    });

    await prisma.savedTool.createMany({
      data: [{ userId, toolId: toolRow.id }],
      skipDuplicates: true,
    });

    slugsBuilt.push(slug);
  }

  return NextResponse.json({ ok: true, slugs: slugsBuilt });
}
