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



export async function setSaveData() {
  const { default: pLimit } = await import('p-limit');
  const limit = pLimit(Number(process.env.MAX_CONCURRENT_REQUESTS) || 5);
  const now = dayjs().toDate();

  try {
    const instruments = await getInstrumentsWithValues();
    if (!instruments?.length) return;

    const normalizedNamesFromApi = instruments.map(i => normalizeName(i.name));

    const existingInstruments = await prisma.instrument.findMany({
      include: instrumentInclude,
    });
    const normalizedNamesInDb = existingInstruments.map(i => i.normalizedName);

    const namesToDeactivate = normalizedNamesInDb.filter(name => !normalizedNamesFromApi.includes(name));

    // Deferido para dentro do `limit`, com controle de concorrência
    const deactivationTasks = namesToDeactivate.map(name =>
      limit(() =>
        prisma.instrument.update({
          where: { normalizedName: name },
          data: { isActive: false, updatedAt: now },
        })
      )
    );

    const instrumentTasks = instruments.map(instrument =>
      limit(() => {
        const normalizedName = normalizeName(instrument.name);

        const existing = existingInstruments.find(instrument => instrument.normalizedName === normalizedName);

        const isPress = instrument.modelId === 67;
        const tempValue = instrument.modelId === 72 ? instrument.Sensor1 : instrument.Temperature;
        const pressureValue = instrument.GasPressure;
        const sensorError = isPress
          ? instrument.IsErrorPressureSensor
          : instrument.modelId === 72
            ? instrument.IsErrorS1
            : instrument.IsSensorError;

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

        const fallbackData = {
          name: instrument.name,
          normalizedName,
          updatedAt: now,
          error: instrument.error ?? 'Instrument error',
          type: "temp",
          status: "",
          isSensorError: false,
          setPoint: 0,
          differential: 0,
          temperatures: {
            create: {
              temperature: {
                create: {
                  value: 0,
                  editValue: 0,
                  createdAt: now,
                  updatedAt: now,
                },
              },
            },
          },
        };

        const instrumentData = instrument.error || !instrument.modelId
          ? fallbackData
          : {
            idSitrad: instrument.id,
            name: instrument.name,
            normalizedName,
            model: instrument.modelId,
            status,
            type: isPress ? "press" : "temp",
            process,
            updatedAt: now,
            error: instrument.error || null,
            isSensorError: !!sensorError,
            setPoint: instrument.CurrentSetpoint ?? instrument.FncSetpoint ?? 0,
            differential: instrument.FncDifferential ?? 0,
            ...(isPress
              ? {
                pressures: {
                  create: {
                    pressure: {
                      create: {
                        value: !sensorError ? pressureValue : 0,
                        editValue: !sensorError ? pressureValue : 0,
                        createdAt: now,
                        updatedAt: now,
                      },
                    },
                  },
                },
              }
              : {
                temperatures: {
                  create: {
                    temperature: {
                      create: {
                        value: !sensorError ? tempValue : 0,
                        editValue: !sensorError ? tempValue : 0,
                        createdAt: now,
                        updatedAt: now,
                      },
                    },
                  },
                },
              }),
          };

        const savedPromise = existing
          ? prisma.instrument.update({
            where: { normalizedName },
            data: instrumentData,
            include: instrumentInclude,
          })
          : prisma.instrument.create({
            data: instrumentData,
            include: instrumentInclude,
          });

        return savedPromise.then(formatInstrument)
      })
    );

    await Promise.all(deactivationTasks);
    const formattedInstruments = await Promise.all(instrumentTasks);



    formattedInstruments.sort((a, b) => a.displayOrder - b.displayOrder);

    await redis.set(
      String(process.env.METADATA_CACHE_KEY),
      JSON.stringify(formattedInstruments),
      "EX",
      15
    );
  } catch (error) {
    console.error("Erro ao salvar dados e atualizar cache:", error);
  }
}

function formatInstrument(saved: Prisma.InstrumentGetPayload<{ include: typeof instrumentInclude }>) {
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
