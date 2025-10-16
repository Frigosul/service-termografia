import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { createSlug } from "../utils/create-slug";
import { getInstrumentsWithValues } from "./get-instruments-with-value";

export async function setSaveData() {
  try {
    const instruments = await getInstrumentsWithValues();

    if (!instruments?.length) return;
    const allInstruments = await prisma.instrument.findMany({
      select: {
        id: true,
        slug: true,
        minValue: true,
        maxValue: true,
        orderDisplay: true,
      },
    });

    const slugToInstrument = new Map(
      allInstruments.map((i) => [i.slug, i])
    );
    const slugsFromApi = instruments.map((i) => createSlug(i.name));

    // Slugs que existem no banco mas não estão na API → desativar
    const toDeactivate = allInstruments
      .map((i) => i.slug)
      .filter((slug) => !slugsFromApi.includes(slug));
    if (toDeactivate.length) {
      await prisma.instrument.updateMany({
        where: { slug: { in: toDeactivate } },
        data: { isActive: false },
      });
    }

    const instrumentsForCache: any[] = [];

    await prisma.$transaction(async (tx) => {
      const dataPoints: any[] = [];

      for (const inst of instruments) {
        const slug = createSlug(inst.name);
        const existing = slugToInstrument.get(slug);

        if (inst.error && !inst.modelId) {
          if (existing) {
            await tx.instrument.update({
              where: { id: existing.id },
              data: {
                name: inst.name,
                model: inst.modelId,
                isActive: true,
              },
            });
            instrumentsForCache.push({
              id: existing.id,
              idSitrad: inst.id,
              name: inst.name,
              slug,
              model: null,
              type: null,
              isActive: true,
              minValue: existing.minValue ?? null,
              maxValue: existing.maxValue ?? null,
              orderDisplay: existing.orderDisplay ?? 0,
              error: inst.error,
            });
          } else {
            const create = await tx.instrument.create({
              data: {
                idSitrad: inst.id,
                name: inst.name,
                model: 72,
                slug: createSlug(inst.name),
                type: 'TEMPERATURE',

              }
            })

            instrumentsForCache.push({
              id: create.id,
              idSitrad: inst.id,
              name: inst.name,
              slug: createSlug(inst.name),
              model: create.model,
              type: create.type,
              isActive: create.isActive,
              minValue: create.minValue,
              maxValue: create.maxValue,
              orderDisplay: create.orderDisplay,
              error: inst.error,
            });
          }
          continue;
        }
        const isPressure = inst.modelId === 67;
        const value = inst.modelId === 67 ? inst.GasPressure :
          inst.modelId === 72 ? inst.Sensor1 : inst.Temperature;


        if (existing) {
          // UPDATE
          await tx.instrument.update({
            where: { id: existing.id },
            data: {
              name: inst.name,
              model: inst.modelId,
              type: isPressure ? "PRESSURE" : "TEMPERATURE",
              isActive: true,
            },
          });

          dataPoints.push({
            instrumentId: existing.id,
            data: value,
            editData: value,
          });

          instrumentsForCache.push({
            id: existing.id,
            idSitrad: inst.id,
            name: inst.name,
            slug,
            model: inst.modelId,
            type: isPressure ? "PRESSURE" : "TEMPERATURE",
            isActive: true,
            minValue: existing.minValue ?? null,
            maxValue: existing.maxValue ?? null,
            orderDisplay: existing.orderDisplay ?? 0,

          });
        } else {
          // CREATE
          const created = await tx.instrument.create({
            data: {
              idSitrad: inst.id,
              model: inst.modelId,
              name: inst.name,
              slug,
              type: isPressure ? "PRESSURE" : "TEMPERATURE",
              isActive: true,

            },
          });

          dataPoints.push({
            instrumentId: created.id,
            data: value,
            editData: value,
          });

          instrumentsForCache.push({
            id: created.id,
            idSitrad: inst.id,
            name: inst.name,
            slug,
            model: inst.modelId,
            type: isPressure ? "PRESSURE" : "TEMPERATURE",
            isActive: true,
            minValue: null,
            maxValue: null,
            orderDisplay: 0,
          });
        }
      }

      if (dataPoints.length) {
        console.log(dataPoints);
        await tx.instrumentData.createMany({
          data: dataPoints,
        });
      }
    });

    // Ordenar antes de salvar no cache
    instrumentsForCache.sort((a, b) => a.orderDisplay - b.orderDisplay);
    await redis.set(
      String(process.env.METADATA_CACHE_KEY),
      JSON.stringify(instrumentsForCache),
      "EX",
      15
    );
  } catch (error) {
    console.error("Erro ao salvar dados e atualizar cache:", error);
  }
}
