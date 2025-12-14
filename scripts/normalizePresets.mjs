import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, "..");
const CONFIG_DIR = path.join(ROOT, "tool-configs");

// Default refinement lenses (generic, non-scenario)
const DEFAULT_LENSES = [
  {
    label: "Make it clearer",
    prompt:
      "Rewrite/produce the output with maximum clarity. Reduce ambiguity, define terms briefly, and avoid jargon unless necessary.",
    hint: "Improve clarity",
  },
  {
    label: "More structured",
    prompt:
      "Use a clean structure with headings and bullet points. Make the output scannable and logically ordered.",
    hint: "Add structure",
  },
  {
    label: "More critical",
    prompt:
      "Be more rigorous. Identify weak spots, missing assumptions, contradictions, and any risks or limitations.",
    hint: "Pressure-test",
  },
  {
    label: "More actionable",
    prompt:
      "Add concrete next steps, checklists, or recommendations. Prioritize what to do first and why.",
    hint: "Make it usable",
  },
  {
    label: "Shorter",
    prompt:
      "Keep the output concise. Remove filler, keep only the highest-signal information, and use tight language.",
    hint: "Concise",
  },
];

function isTooSpecificPresetLabel(label) {
  const s = String(label || "").toLowerCase();
  return (
    /manuscript|paper|psychology|biology|social science|case study|example|notes on a|poster on|clinical|patient|contract|lawsuit|tax return|resume for/i.test(
      s
    ) ||
    s.length > 60
  );
}

function normalizePreset(p) {
  const label = typeof p?.label === "string" ? p.label.trim().slice(0, 60) : "Refine";

  // Already lens-style
  if (typeof p?.prompt === "string" && p.prompt.trim()) {
    return {
      label,
      prompt: p.prompt.trim().slice(0, 1200),
      hint: typeof p?.hint === "string" ? p.hint.trim().slice(0, 160) : undefined,
    };
  }

  // Legacy preset with input -> convert to lens prompt
  if (typeof p?.input === "string" && p.input.trim()) {
    const input = p.input.trim().slice(0, 400);
    return {
      label,
      prompt: `Use this lens while generating: ${input}`.slice(0, 1200),
      hint: "Refinement lens (converted from legacy preset)",
    };
  }

  return null;
}

function main() {
  if (!fs.existsSync(CONFIG_DIR)) {
    console.error(`No tool-configs directory found at: ${CONFIG_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(CONFIG_DIR).filter((f) => f.endsWith(".json"));
  if (!files.length) {
    console.log("No tool configs found.");
    return;
  }

  let changedCount = 0;

  for (const file of files) {
    const filePath = path.join(CONFIG_DIR, file);
    let raw;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      console.warn(`Skipping invalid JSON: ${file}`);
      continue;
    }

    const features = Array.isArray(json.features) ? json.features : [];
    const usesPresets = features.includes("presets");

    if (!usesPresets) continue;

    const originalPresets = json.presets;
    let presets = Array.isArray(originalPresets) ? originalPresets : [];

    // Normalize all presets into lens format
    presets = presets.map(normalizePreset).filter(Boolean);

    // If labels still too specific (or not enough presets), overwrite with defaults
    const hasTooSpecific = presets.some((p) => isTooSpecificPresetLabel(p.label));
    if (hasTooSpecific || presets.length < 2) {
      presets = DEFAULT_LENSES.slice(0, 4);
    } else {
      // Cap to 6
      presets = presets.slice(0, 6);
    }

    // Write back if changed
    const next = { ...json, presets };
    const nextStr = JSON.stringify(next, null, 2) + "\n";

    if (nextStr !== raw.trimEnd() + "\n") {
      fs.writeFileSync(filePath, nextStr, "utf-8");
      changedCount++;
      console.log(`Updated presets: ${file}`);
    }
  }

  console.log(`Done. Updated ${changedCount} config file(s).`);
}

main();
