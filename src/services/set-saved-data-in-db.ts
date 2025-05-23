import { Prisma } from "@prisma/client";
import dayjs from "dayjs";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { getInstrumentsWithValues } from "./get-instruments-with-value";

const instrumentInclude = {
  temperatures: {
    include: { temperature: true },
    orderBy: { temperature: { createdAt: "desc" } },
    take: 1,
  },
  pressures: {
    include: { pressure: true },
    orderBy: { pressure: { createdAt: "desc" } },
    take: 1,
  },
} satisfies Prisma.InstrumentInclude;
type InstrumentWithValues = Prisma.InstrumentGetPayload<{
  include: typeof instrumentInclude;
}>;

const now = dayjs().toDate();

export async function setSaveData() {
  try {
  const instrumentsWithValue = await getInstrumentsWithValues();
  if (!instrumentsWithValue) return;


  const upsertOperations = instrumentsWithValue.map((instrument) => {
    const isPress = instrument.modelId === 67;

    const status = Array.from(
      new Set([
        instrument.IsOpenDoor && "port",
        instrument.IsDefrost && "deg",
        instrument.IsRefrigeration && "resf",
        instrument.IsOutputFan && "vent",
        instrument.IsOutputDefr1 && "deg",
        instrument.IsOutputRefr && "resf",
      ])
    )
      .filter(Boolean)
      .join(",");

    const data = {
      idSitrad: instrument.id,
      name: instrument.name,
      model: instrument.modelId,
      status,
      type: isPress ? "press" : "temp",
      process:
        instrument.ProcessStatusText ??
        (instrument.ProcessStatus === 7
          ? "Refrigeração"
          : instrument.ProcessStatus === 1
          ? "Online"
          : instrument.ProcessStatus === 8
          ? "Degelo"
          : instrument.ProcessStatus?.toString()),
      updatedAt: now,
      error: instrument.error || null,
      isSensorError: isPress
        ? instrument.IsErrorPressureSensor
        : instrument.modelId === 72
        ? instrument.IsErrorS1
        : instrument.IsSensorError,
      setPoint: instrument.CurrentSetpoint ?? instrument.FncSetpoint,
      differential: instrument.FncDifferential,
    };

    // fallback para instrumentos com erro ou sem modelId, só atualiza
    if (instrument.error || !instrument.modelId) {
      return prisma.instrument.upsert({
        where: { name: instrument.name },
        update: data,
        create: data,
        include: instrumentInclude,
      });
    }

    // Upsert do instrumento
    return prisma.instrument.upsert({
      where: { name: instrument.name },
      update: data,
      create: data,
      include: instrumentInclude,
    });
  });

  const upsertedInstruments = await prisma.$transaction(upsertOperations);

  const createReadingsOperations = instrumentsWithValue.map(
    async (instrument) => {
      const isPress = instrument.modelId === 67;
      const temperatureValue =
        instrument.modelId === 72 ? instrument.Sensor1 : instrument.Temperature;
      const instrumentDb = upsertedInstruments.find(
        (i) => i.name === instrument.name
      );
      if (!instrumentDb) return;

      if (instrument.error || !instrument.modelId) {
    
        return;
      }

      const now = new Date();

      if (isPress) {

        const pressure = await prisma.pressure.create({
          data: {
            value: instrument.GasPressure,
            editValue: instrument.GasPressure,
            createdAt: now,
            updatedAt: now,
          },
        });

        await prisma.instrumentsPressure.create({
          data: {
            instrument_id: instrumentDb.id,
            pressure_id: pressure.id,
          },
        });
      } else {
        const temperature = await prisma.temperature.create({
          data: {
            value: temperatureValue,
            editValue: temperatureValue,
            createdAt: now,
            updatedAt: now,
          },
        });

        await prisma.instrumentsTemperature.create({
          data: {
            instrument_id: instrumentDb.id,
            temperature_id: temperature.id,
          },
        });
      }
    }
  );

  // Aguarda todas leituras serem criadas
  await Promise.all(createReadingsOperations);

  // Atualiza cache redis
  const updatedInstruments = upsertedInstruments
    .map(formatInstrument)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  await redis.set(
    String(process.env.METADATA_CACHE_KEY),
    JSON.stringify(updatedInstruments),
    "EX",
    15
  );

  console.log("Dados salvos com sucesso");
} catch (error) {
  console.error("Erro ao salvar dados e atualizar cache:", error);
}
}

function formatInstrument(saved: InstrumentWithValues) {
  const temperatureData = saved.temperatures?.[0]?.temperature ?? null;
  const pressureData = saved.pressures?.[0]?.pressure ?? null;

  return saved.type === "press"
    ? {
        id: saved.id,
        idSitrad: saved.idSitrad,
        name: saved.name,
        model: saved.model,
        displayOrder: saved.displayOrder,
        type: "press",
        process: saved.process,
        status: saved.status,
        isSensorError: saved.isSensorError,
        pressure: pressureData?.editValue ?? null,
        instrumentCreatedAt: saved.createdAt,
        createdAt: pressureData?.createdAt ?? null,
        error: saved.error,
        maxValue: saved.maxValue,
        minValue: saved.minValue,
        setPoint: saved.setPoint,
      }
    : {
        id: saved.id,
        idSitrad: saved.idSitrad,
        name: saved.name,
        model: saved.model,
        displayOrder: saved.displayOrder,
        type: "temp",
        process: saved.process,
        status: saved.status,
        isSensorError: saved.isSensorError,
        temperature: temperatureData?.editValue ?? null,
        instrumentCreatedAt: saved.createdAt,
        createdAt: temperatureData?.createdAt ?? null,
        error: saved.error,
        maxValue: saved.maxValue,
        minValue: saved.minValue,
        setPoint: saved.setPoint,
        differential: saved.differential,
      };
}
