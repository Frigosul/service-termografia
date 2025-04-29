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

export async function setSaveData() {
  try {
    const instrumentsWithValue = await getInstrumentsWithValues();
    if (!instrumentsWithValue) return;
    const now = dayjs().toDate();

    const updatedInstruments = await Promise.all(
      instrumentsWithValue.map(
        async (instrument): Promise<ReturnType<typeof formatInstrument>> => {
          const existingInstrument = await prisma.instrument.findFirst({
            where: { name: instrument.name },
          });

          const isPress = instrument.modelId === 67;
          const temperatureValue =
            instrument.modelId === 72
              ? instrument.Sensor1
              : instrument.Temperature;

          if (instrument.error || !instrument.modelId) {
            const fallbackData = {
              name: instrument.name,
              status: "",
              error: instrument.error,
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

            const saved = existingInstrument
              ? await prisma.instrument.update({
                  where: { id: existingInstrument.id },
                  data: { ...fallbackData, type: existingInstrument.type },
                  include: instrumentInclude,
                })
              : await prisma.instrument.create({
                  data: fallbackData,
                  include: instrumentInclude,
                });

            return formatInstrument(saved);
          }

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
            updatedAt: now,
            error: null,
            isSensorError: isPress
              ? instrument.IsErrorPressureSensor
              : instrument.modelId === 72
                ? instrument.IsErrorS1
                : instrument.IsSensorError,
            setPoint: instrument.CurrentSetpoint ?? instrument.FncSetpoint,
            differential: instrument.FncDifferential,
            ...(isPress
              ? {
                  pressures: {
                    create: {
                      pressure: {
                        create: {
                          value: instrument.GasPressure,
                          editValue: instrument.GasPressure,
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
                          value: temperatureValue,
                          editValue: temperatureValue,
                          createdAt: now,
                          updatedAt: now,
                        },
                      },
                    },
                  },
                }),
          };

          const saved = existingInstrument
            ? await prisma.instrument.update({
                where: { id: existingInstrument.id },
                data,
                include: instrumentInclude,
              })
            : await prisma.instrument.create({
                data,
                include: instrumentInclude,
              });

          return formatInstrument(saved);
        }
      )
    );

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
        type: "press",
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
        type: "temp",
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
