import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ToolConfig = {
  slug: string;
  title: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  systemPrompt: string;
  temperature?: number;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    // 👇 unwrap the params Promise (same idea as on the page component)
    const { slug } = await context.params;

    const { input } = await req.json();

    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "Missing 'input' string in request body" },
        { status: 400 }
      );
    }

    const configPath = path.join(
      process.cwd(),
      "tool-configs",
      `${slug}.json`
    );

    console.log("[API] slug:", slug);
    console.log(
      "[API] looking for:",
      configPath,
      "exists:",
      fs.existsSync(configPath)
    );

    if (!fs.existsSync(configPath)) {
      return NextResponse.json(
        { error: `Tool config not found for slug: ${slug}` },
        { status: 404 }
      );
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const config: ToolConfig = JSON.parse(raw);

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: input },
      ],
      temperature: config.temperature ?? 0.4,
    });

    const output = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({ output });
  } catch (err: any) {
    console.error("[API] error:", err);
    return NextResponse.json(
      { error: "Server error", details: err.message || String(err) },
      { status: 500 }
    );
  }
}
