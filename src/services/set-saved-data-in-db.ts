import dayjs from "dayjs";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { normalizeName } from "../utils/normalizeName";
import { getInstrumentsWithValues } from "./get-instruments-with-value";

export async function setSaveData() {
  const now = dayjs().toDate();
  const batchSize = Number(process.env.MAX_CONCURRENT_REQUESTS) || 2;

  try {
    const instruments = await getInstrumentsWithValues();
    if (!instruments?.length) return;

    const normalizedNamesFromApi = instruments.map(i => normalizeName(i.name));
    const existingInstruments = await prisma.instrument.findMany({
      select: { normalizedName: true },
    });
    const normalizedNamesInDb = existingInstruments.map(i => i.normalizedName);

    // const namesToDeactivate = normalizedNamesInDb.filter(name => !normalizedNamesFromApi.includes(name));

    // // Desativa sequencialmente
    // for (const name of namesToDeactivate) {
    //   console.time(`desativação do instrumento: ${name}`);
    //   await prisma.instrument.update({
    //     where: { normalizedName: name },
    //     data: { isActive: false, updatedAt: now },
    //   });
    //   console.timeEnd(`desativação do instrumento: ${name}`);
    // }

    // Processa instrumentos sequencialmente
    const formattedInstruments: any[] = [];
    for (const instrument of instruments) {
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

      let result;
      if (existing) {
        console.time(`atualização do instrumento: ${normalizedName}`);
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
                value: pressureValue ?? 0,
                editValue: pressureValue ?? 0,
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
        console.timeEnd(`atualização do instrumento: ${normalizedName}`);

      } else {
        console.time(`criação do instrumento: ${normalizedName}`);
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
        console.timeEnd(`criação do instrumento: ${normalizedName}`);

      }

      formattedInstruments.push({
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
      });
    }

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