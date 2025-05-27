import { Prisma } from "@prisma/client";
import dayjs from "dayjs";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { normalizeName } from "../utils/normalizeName";
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

export async function setSaveData() {
  const now = dayjs().toDate();

  try {
    const instruments = await getInstrumentsWithValues();
    if (!instruments?.length) return;

    const normalizedNames = instruments
      .map(i => normalizeName(i.name))


    await prisma.instrument.updateMany({
      where: { normalizedName: { notIn: normalizedNames } },
      data: { isActive: false },
    });

    const upserted = await prisma.$transaction(
      instruments.map(instrument => buildUpsertInstrument(instrument, now))
    );

    const upsertedMap = new Map(
      upserted.map(i => [i.normalizedName as string, i])
    );
    const {
      temperaturesToInsert,
      pressuresToInsert,
      instrumentTemperatureRelations,
      instrumentPressureRelations,
    } = prepareInsertData(instruments, upsertedMap);

    const [createdPressures, createdTemperatures] = await prisma.$transaction([
      prisma.pressure.createManyAndReturn({ data: pressuresToInsert, skipDuplicates: true }),
      prisma.temperature.createManyAndReturn({ data: temperaturesToInsert, skipDuplicates: true }),
    ]);

    createdPressures.forEach((p, i) => {
      instrumentPressureRelations[i].pressure_id = p.id;
    });
    createdTemperatures.forEach((t, i) => {
      instrumentTemperatureRelations[i].temperature_id = t.id;
    });

    await prisma.$transaction([
      prisma.instrumentsPressure.createManyAndReturn({
        data: instrumentPressureRelations,
        skipDuplicates: true,
      }),
      prisma.instrumentsTemperature.createManyAndReturn({
        data: instrumentTemperatureRelations,
        skipDuplicates: true,
      }),
    ]);

    const formatted = upserted.map(formatInstrument).sort((a, b) => a.displayOrder - b.displayOrder);

    await redis.set(
      String(process.env.METADATA_CACHE_KEY),
      JSON.stringify(formatted),
      "EX",
      15
    );
  } catch (error) {
    console.error("Erro ao salvar dados e atualizar cache:", error);
  }
}

// 🔹 Constrói o objeto do Prisma para o upsert
function buildUpsertInstrument(instrument: any, now: Date) {
  const isPress = instrument.modelId === 67;
  const normalized = normalizeName(instrument.name);
  const status = Array.from(
    new Set([
      instrument.IsOpenDoor && "port",
      instrument.IsDefrost && "deg",
      instrument.IsRefrigeration && "resf",
      instrument.IsOutputFan && "vent",
      instrument.IsOutputDefr1 && "deg",
      instrument.IsOutputRefr && "resf",
    ])
  ).filter(Boolean).join(",");

  const process =
    instrument.ProcessStatusText ??
    (instrument.ProcessStatus === 7
      ? "Refrigeração"
      : instrument.ProcessStatus === 1
        ? "Online"
        : instrument.ProcessStatus === 8
          ? "Degelo"
          : instrument.ProcessStatus?.toString());

  const data = {
    idSitrad: instrument.id,
    name: instrument.name,
    normalizedName: normalized,
    model: instrument.modelId,
    status,
    type: isPress ? "press" : "temp",
    process,
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

  return prisma.instrument.upsert({
    where: { normalizedName: normalized },
    update: data,
    create: data,
    include: instrumentInclude,
  });
}

// 🔹 Separa os dados para inserção em batch
function prepareInsertData(
  instruments: any[],
  upsertedMap: Map<string, InstrumentWithValues>
) {
  const temperaturesToInsert: Prisma.TemperatureCreateInput[] = [];
  const pressuresToInsert: Prisma.PressureCreateInput[] = [];
  const instrumentTemperatureRelations: { instrument_id: string; temperature_id: string }[] = [];
  const instrumentPressureRelations: { instrument_id: string; pressure_id: string }[] = [];

  const now = new Date();

  for (const instrument of instruments) {
    const normalized = normalizeName(instrument.name);
    const instrumentDb = upsertedMap.get(normalized);
    if (!instrumentDb || instrument.error || !instrument.modelId) continue;

    const isPress = instrument.modelId === 67;
    const tempValue = instrument.modelId === 72 ? instrument.Sensor1 : instrument.Temperature;

    if (isPress) {
      pressuresToInsert.push({
        value: instrument.GasPressure,
        editValue: instrument.GasPressure,
        createdAt: now,
        updatedAt: now,
      });
      instrumentPressureRelations.push({ instrument_id: instrumentDb.id, pressure_id: "" });
    } else {
      temperaturesToInsert.push({
        value: tempValue,
        editValue: tempValue,
        createdAt: now,
        updatedAt: now,
      });
      instrumentTemperatureRelations.push({ instrument_id: instrumentDb.id, temperature_id: "" });
    }
  }

  return {
    temperaturesToInsert,
    pressuresToInsert,
    instrumentTemperatureRelations,
    instrumentPressureRelations,
  };
}

// 🔹 Formata instrumento para cache
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
