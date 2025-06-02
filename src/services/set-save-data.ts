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
    const existingNamesSet = new Set(normalizedNamesInDb);

    // Desativa instrumentos que não estão mais na API
    const namesToDeactivate = normalizedNamesInDb.filter(name => !normalizedNamesFromApi.includes(name));
    if (namesToDeactivate.length) {

      await prisma.instrument.updateMany({
        where: { normalizedName: { in: namesToDeactivate } },
        data: { isActive: false, updatedAt: now },
      });

    }

    // Arrays para batch create / update
    const instrumentsToCreate: any[] = [];
    const instrumentsToUpdate: any[] = [];
    const temperatureBatch: any[] = [];
    const pressureBatch: any[] = [];
    const temperatureRelations: any[] = [];
    const pressureRelations: any[] = [];
    const formattedInstruments: any[] = [];

    for (const instrument of instruments) {
      const normalizedName = normalizeName(instrument.name);
      const isPress = instrument.modelId === 67;
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


      if (existingNamesSet.has(normalizedName)) {
        instrumentsToUpdate.push({ normalizedName, data: instrumentData });
      } else {
        instrumentsToCreate.push(instrumentData);
      }
    }

    if (instrumentsToCreate.length) {
      await prisma.instrument.createMany({ data: instrumentsToCreate });

    }
    // 3. Atualiza todos os existentes em paralelo (Promise.all para limitar conexões simultâneas)
    const updateBatchSize = 10;
    for (let i = 0; i < instrumentsToUpdate.length; i += updateBatchSize) {
      const batch = instrumentsToUpdate.slice(i, i + updateBatchSize);
      await Promise.all(
        batch.map(item =>
          prisma.instrument.update({
            where: { normalizedName: item.normalizedName },
            data: item.data,
          })
        )
      );
    }

    // 4. Busca todos os instrumentos atualizados/criados para pegar os IDs
    const allInstruments = await prisma.instrument.findMany({
      where: { normalizedName: { in: instruments.map(i => normalizeName(i.name)) } }
    });

    const instrumentIdMap = new Map(allInstruments.map(i => [i.normalizedName, i]));

    for (const instrument of instruments) {
      const normalizedName = normalizeName(instrument.name);
      const isPress = instrument.modelId === 67;
      const tempValue = instrument.modelId === 72 ? instrument.Sensor1 : instrument.Temperature;
      const pressureValue = instrument.GasPressure;
      const instrumentObj = instrumentIdMap.get(normalizedName);

      if (!instrumentObj) continue;

      if (isPress) {
        const pressureId = uuidV4();
        pressureBatch.push({
          id: pressureId,
          value: pressureValue ?? 0,
          editValue: pressureValue ?? 0,
          createdAt: now,
          updatedAt: now,
        });
        pressureRelations.push({
          instrument_id: instrumentObj.id,
          pressure_id: pressureId,
        });
      } else {
        const tempId = uuidV4();
        temperatureBatch.push({
          id: tempId,
          value: tempValue ?? 0,
          editValue: tempValue ?? 0,
          createdAt: now,
          updatedAt: now,
        });
        temperatureRelations.push({
          instrument_id: instrumentObj.id,
          temperature_id: tempId,
        });
      }

      formattedInstruments.push({
        id: instrumentObj.id,
        idSitrad: instrumentObj.idSitrad,
        name: instrumentObj.name,
        model: instrumentObj.model,
        displayOrder: instrumentObj.displayOrder ?? 0,
        type: instrumentObj.type,
        process: instrumentObj.process,
        status: instrumentObj.status,
        isSensorError: instrumentObj.isSensorError,
        pressure: pressureValue,
        temperature: tempValue,
        createdAt: instrumentObj.createdAt,
        error: instrumentObj.error,
        maxValue: instrumentObj.maxValue,
        minValue: instrumentObj.minValue,
        setPoint: instrumentObj.setPoint,
        differential: instrumentObj.differential,
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