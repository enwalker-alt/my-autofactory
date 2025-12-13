import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const configDir = path.join(process.cwd(), "tool-configs");
  const files = fs.readdirSync(configDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const filePath = path.join(configDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const json = JSON.parse(raw);

    // Adjust if your JSON structure differs
    const slug = json.slug;
    const title = json.title;
    const description = json.description ?? null;
    const category = json.category ?? null;
    const inputLabel = json.inputLabel ?? null;
    const outputLabel = json.outputLabel ?? null;

    await prisma.tool.upsert({
      where: { slug },
      update: { title, description, category, inputLabel, outputLabel },
      create: { slug, title, description, category, inputLabel, outputLabel },
    });
  }

  console.log(`✅ Synced ${files.length} tool configs into DB.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
