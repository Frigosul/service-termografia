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
    const instrumentsWithValue = await getInstrumentsWithValues();
    if (!instrumentsWithValue) return;
const normalizedNames = instrumentsWithValue.map(i => normalizeName(i.name));

await prisma.instrument.deleteMany({
  where: {
    normalizedName: {
      notIn: normalizedNames,
    },
  },
});


    const upsertOperations = instrumentsWithValue.map((instrument) => {
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
      )
        .filter(Boolean)
        .join(",");

      const data = {
        idSitrad: instrument.id,
        name: instrument.name,
        normalizedName: normalized,
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

      return prisma.instrument.upsert({
        where: { normalizedName: normalized },
        update: data,
        create: data,
        include: instrumentInclude,
      });
    });

    const upsertedInstruments = await prisma.$transaction(upsertOperations);

    // Preparação dos dados para inserção
    const pressuresToInsert: Prisma.PressureCreateInput[] = [];
    const temperaturesToInsert: Prisma.TemperatureCreateInput[] = [];
    const instrumentPressureRelations: { instrument_id: string; pressure_id: string }[] = [];
    const instrumentTemperatureRelations: { instrument_id: string; temperature_id: string }[] = [];

    for (const instrument of instrumentsWithValue) {
      const isPress = instrument.modelId === 67;
      const temperatureValue =
        instrument.modelId === 72 ? instrument.Sensor1 : instrument.Temperature;
      const instrumentDb = upsertedInstruments.find((i) => i.normalizedName === instrument.normalizedName);
      if (!instrumentDb || instrument.error || !instrument.modelId) continue;

      const now = new Date();

      if (isPress) {
        pressuresToInsert.push({
          value: instrument.GasPressure,
          editValue: instrument.GasPressure,
          createdAt: now,
          updatedAt: now,
        });
        instrumentPressureRelations.push({
          instrument_id: instrumentDb.id,
          pressure_id: "", 
        });
      } else {
        temperaturesToInsert.push({
          value: temperatureValue,
          editValue: temperatureValue,
          createdAt: now,
          updatedAt: now,
        });
        instrumentTemperatureRelations.push({
          instrument_id: instrumentDb.id,
          temperature_id: "", 
        });
      }
    }

    const [createdPressures, createdTemperatures] = await prisma.$transaction([
      prisma.pressure.createManyAndReturn({
        data: pressuresToInsert,
        skipDuplicates: true,
      }),
      prisma.temperature.createManyAndReturn({
        data: temperaturesToInsert,
        skipDuplicates: true,
      }),
    ]);

    createdPressures.forEach((pressure, index) => {
      instrumentPressureRelations[index].pressure_id = pressure.id;
    });
    createdTemperatures.forEach((temperature, index) => {
      instrumentTemperatureRelations[index].temperature_id = temperature.id;
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

    const updatedInstruments = upsertedInstruments
      .map(formatInstrument)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    await redis.set(
      String(process.env.METADATA_CACHE_KEY),
      JSON.stringify(updatedInstruments),
      "EX",
      15
    );
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
