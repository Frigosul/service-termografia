import dayjs from "dayjs";
import { v4 as uuidV4 } from 'uuid';
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { normalizeName } from "../utils/normalizeName";
import { getInstrumentsWithValues } from "./get-instruments-with-value";
export async function setSaveData() {
  const now = dayjs().toDate();

  try {
    const instruments = await getInstrumentsWithValues();
    if (!instruments?.length) return;

    const normalizedNamesFromApi = instruments.map(i => normalizeName(i.name));
    const existingInstruments = await prisma.instrument.findMany({
      select: { id: true, normalizedName: true },
    });
    const normalizedNamesInDb = existingInstruments.map(i => i.normalizedName);

    // Desativa instrumentos que não estão mais na API
    const namesToDeactivate = normalizedNamesInDb.filter(name => !normalizedNamesFromApi.includes(name));
    if (namesToDeactivate.length) {
      await prisma.instrument.updateMany({
        where: { normalizedName: { in: namesToDeactivate } },
        data: { isActive: false, updatedAt: now },
      });
    }

    // Map para buscar id do instrumento pelo normalizedName
    const instrumentIdMap = new Map(existingInstruments.map(i => [i.normalizedName, i.id]));

    // Arrays para batch create
    const temperatureBatch: any[] = [];
    const pressureBatch: any[] = [];
    const temperatureRelations: any[] = [];
    const pressureRelations: any[] = [];
    const formattedInstruments: any[] = [];

    for (const instrument of instruments) {
      const normalizedName = normalizeName(instrument.name);
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
        isActive: true,
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
          isActive: true,
        };

      // Upsert instrumento (atualiza se existe, cria se não existe)
      const upsertedInstrument = await prisma.instrument.upsert({
        where: { normalizedName },
        update: instrumentData,
        create: instrumentData,
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

      // Cria novo registro de temperatura ou pressão
      if (isPress) {
        const pressureId = uuidV4()
        pressureBatch.push({
          id: pressureId,
          value: pressureValue ?? 0,
          editValue: pressureValue ?? 0,
          createdAt: now,
          updatedAt: now,
        });
        pressureRelations.push({
          instrument_id: upsertedInstrument.id,
          pressure_id: pressureId,
        });
      } else {
        const tempId = uuidV4()
        temperatureBatch.push({
          id: tempId,
          value: tempValue ?? 0,
          editValue: tempValue ?? 0,
          createdAt: now,
          updatedAt: now,
        });
        temperatureRelations.push({
          instrument_id: upsertedInstrument.id,
          temperature_id: tempId,
        });
      }

      formattedInstruments.push({
        id: upsertedInstrument.id,
        idSitrad: upsertedInstrument.idSitrad,
        name: upsertedInstrument.name,
        model: upsertedInstrument.model,
        displayOrder: upsertedInstrument.displayOrder ?? 0,
        type: upsertedInstrument.type,
        process: upsertedInstrument.process,
        status: upsertedInstrument.status,
        isSensorError: upsertedInstrument.isSensorError,
        pressure: pressureValue,
        temperature: tempValue,
        createdAt: upsertedInstrument.createdAt,
        error: upsertedInstrument.error,
        maxValue: upsertedInstrument.maxValue,
        minValue: upsertedInstrument.minValue,
        setPoint: upsertedInstrument.setPoint,
        differential: upsertedInstrument.differential,
      });
    }

    // Cria todos os registros de temperatura e pressão em lote
    if (temperatureBatch.length) {
      await prisma.temperature.createMany({ data: temperatureBatch });
      await prisma.instrumentsTemperature.createMany({
        data: temperatureRelations,
      });
    }
    if (pressureBatch.length) {
      await prisma.pressure.createMany({ data: pressureBatch });
      await prisma.instrumentsPressure.createMany({
        data: pressureRelations,
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