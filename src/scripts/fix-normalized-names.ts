// scripts/fix-normalized-names.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const instruments = await prisma.instrument.findMany({
    select: { id: true, name: true },
  });

  const seen = new Set<string>();

  for (const instrument of instruments) {
    const normalized = normalizeName(instrument.name);

    if (seen.has(normalized)) {
      console.warn(`⚠️ Duplicado encontrado: ${normalized} (instrument id: ${instrument.id})`);
      await prisma.instrument.update({
        where: { id: instrument.id },
        data: { normalizedName: `${normalized}1` },
      });
      continue;
    }

    seen.add(normalized);

    await prisma.instrument.update({
      where: { id: instrument.id },
      data: { normalizedName: normalized },
    });
  }

  console.log("✅ Todos os normalizedName foram atualizados.");
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
  })
  .finally(() => prisma.$disconnect());
