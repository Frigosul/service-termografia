import dayjs from "dayjs";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { normalizeName } from "../utils/normalizeName";
import { getInstrumentsWithValues } from "./get-instruments-with-value";


// const instrumentInclude = {
//   temperatures: {
//     select: {
//       temperature: {
//         select: {
//           value: true,
//           editValue: true,
//           createdAt: true,
//           updatedAt: true,
//         },
//       },
//     },
//     orderBy: { temperature: { createdAt: "desc" } },
//     take: 1,
//   },
//   pressures: {
//     select: {
//       pressure: {
//         select: {
//           value: true,
//           editValue: true,
//           createdAt: true,
//           updatedAt: true,
//         },
//       },
//     },
//     orderBy: { pressure: { createdAt: "desc" } },
//     take: 1,
//   },
// } satisfies Prisma.InstrumentInclude;

export async function setSaveData() {
  const { default: pLimit } = await import('p-limit');
  const limit = pLimit(Number(process.env.MAX_CONCURRENT_REQUESTS) || 5);
  const now = dayjs().toDate();

  try {
    const instruments = await getInstrumentsWithValues();
    if (!instruments?.length) return;

    const normalizedNamesFromApi = instruments.map(i => normalizeName(i.name));
    const existingInstruments = await prisma.instrument.findMany({
      select: { normalizedName: true },
    });
    const normalizedNamesInDb = existingInstruments.map(i => i.normalizedName);

    const namesToDeactivate = normalizedNamesInDb.filter(name => !normalizedNamesFromApi.includes(name));
    const deactivationTasks = namesToDeactivate.map(name =>
      limit(() =>
        prisma.instrument.update({
          where: { normalizedName: name },
          data: { isActive: false, updatedAt: now },
        })
      )
    );

    const instrumentTasks = instruments.map(instrument =>
      limit(async () => {
        const normalizedName = normalizeName(instrument.name);
        const existing = existingInstruments.find(i => i.normalizedName === normalizedName);

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
        };

        // Monta os dados do instrumento
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
          };

        // Transação: update/create instrumento + create temperatura/pressão
        let result;
        if (existing) {
          result = await prisma.$transaction(async (tx) => {
            const updatedInstrument = await tx.instrument.update({
              where: { normalizedName },
              data: instrumentData,
              select: {
                id: true,
                idSitrad: true,
                name: true,
                model: true,
                displayOrder: true,
                type: true,
                process: true,
                status: true,
                isSensorError: true,
                createdAt: true,
                error: true,
                maxValue: true,
                minValue: true,
                setPoint: true,
                differential: true,
              }
            });

            if (isPress) {
              await tx.pressure.create({
                data: {
                  value: pressureValue,
                  editValue: pressureValue,
                  createdAt: now,
                  updatedAt: now,
                  instruments: {
                    create: {
                      instrument_id: updatedInstrument.id,
                    }
                  }
                }
              });
            } else {
              await tx.temperature.create({
                data: {
                  value: tempValue ?? 0,
                  editValue: tempValue ?? 0,
                  createdAt: now,
                  updatedAt: now,
                  instruments: {
                    create: {
                      instrument_id: updatedInstrument.id,
                    }
                  }
                }
              });
            }

            return updatedInstrument;
          });
        } else {
          result = await prisma.$transaction(async (tx) => {
            const createdInstrument = await tx.instrument.create({
              data: instrumentData,
              select: {
                id: true,
                idSitrad: true,
                name: true,
                model: true,
                displayOrder: true,
                type: true,
                process: true,
                status: true,
                isSensorError: true,
                createdAt: true,
                error: true,
                maxValue: true,
                minValue: true,
                setPoint: true,
                differential: true,
              },
            });

            if (isPress) {
              await tx.pressure.create({
                data: {
                  value: pressureValue ?? 0,
                  editValue: pressureValue ?? 0,
                  createdAt: now,
                  updatedAt: now,
                  instruments: {
                    create: {
                      instrument_id: createdInstrument.id,
                    }
                  }
                }
              });
            } else {
              await tx.temperature.create({
                data: {
                  value: tempValue ?? 0,
                  editValue: tempValue ?? 0,
                  createdAt: now,
                  updatedAt: now,
                  instruments: {
                    create: {
                      instrument_id: createdInstrument.id,
                    }
                  }
                }
              });
            }

            return createdInstrument;
          });
        }

        return {
          id: result.id,
          idSitrad: result.idSitrad,
          name: result.name,
          model: result.model,
          displayOrder: result.displayOrder ?? 0,
          type: result.type,
          process: result.process,
          status: result.status,
          isSensorError: result.isSensorError,
          pressure: pressureValue,
          temperature: tempValue,
          createdAt: result.createdAt,
          error: result.error,
          maxValue: result.maxValue,
          minValue: result.minValue,
          setPoint: result.setPoint,
          differential: result.differential,
        };
      })
    );

    const allTasks = [...deactivationTasks, ...instrumentTasks];
    const formattedInstruments = await Promise.all(allTasks);

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