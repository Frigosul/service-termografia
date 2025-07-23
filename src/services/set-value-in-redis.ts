import { redis } from "../lib/redis";
import { getInstrumentsWithValues } from "./get-instruments-with-value";

export async function setValueInRedis() {
  const instrumentsWithValue = await getInstrumentsWithValues();
  if (!instrumentsWithValue) return;

  try {
    const existingCacheRaw = await redis.get(
      String(process.env.METADATA_CACHE_KEY)
    );
    const existingCache = existingCacheRaw ? JSON.parse(existingCacheRaw) : [];

    const instrumentsData = instrumentsWithValue.map((instrument) => {
      const isPress = instrument.modelId === 67;
      const temperatureValue =
        instrument.modelId === 72 ? instrument.Sensor1 : instrument.Temperature;
      const sensorError = isPress
        ? instrument.IsErrorPressureSensor
        : instrument.modelId === 72
          ? instrument.IsErrorS1
          : instrument.IsSensorError;


      if (instrument.error || !instrument.modelId) {
        return {
          idSitrad: instrument.id,
          name: instrument.name,
          slug: instrument.slug,
          model: instrument.modelId,
          status: "",
          error: instrument.error,
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
          isSensorError: !!sensorError,
          setPoint: instrument.CurrentSetpoint ?? instrument.FncSetpoint,
          differential: instrument.FncDifferential,
          ...(isPress
            ? {
              pressures: [
                {
                  pressure: {
                    editValue: !sensorError ? instrument.GasPressure : 0,
                  },
                },
              ],
            }
            : {
              temperatures: [
                {
                  temperature: {
                    editValue: !sensorError ? temperatureValue : 0,
                  },
                },
              ],
            }),
        };
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

      return {
        idSitrad: instrument.id,
        name: instrument.name,
        slug: instrument.slug,
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
        isSensorError: !!sensorError,
        setPoint: instrument.CurrentSetpoint ?? instrument.FncSetpoint,
        differential: instrument.FncDifferential,
        ...(isPress
          ? {
            pressures: [
              {
                pressure: {
                  editValue: !sensorError ? instrument.GasPressure : 0,
                },
              },
            ],
          }
          : {
            temperatures: [
              {
                temperature: {
                  editValue: !sensorError ? temperatureValue : 0,
                },
              },
            ],
          }),
      };
    });

    const mergedInstruments = mergeInstrumentData(
      existingCache,
      instrumentsData
    );
    const mergedInstrumentsWithoutDuplicates = removeDuplicatesByName(
      mergedInstruments
    );
    const mergedInstrumentsWithApiSitrad = removeWithoutInstrumentsNameInApiSitrad(
      mergedInstrumentsWithoutDuplicates,
      instrumentsWithValue
    );

    const formattedToSave = mergedInstrumentsWithApiSitrad
      .map(formatInstrument)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    await redis.set(
      String(process.env.METADATA_CACHE_KEY),
      JSON.stringify(formattedToSave),
      "EX",
      15
    );
  } catch (error) {
    console.error("Erro ao salvar dados e atualizar cache:", error);
  }
}

function mergeInstrumentData(existing: any[], updates: any[]) {
  const existingMap = new Map(existing.map((i) => [i.name, i]));
  const merged: any[] = [];

  for (const update of updates) {
    const existingEntry = existingMap.get(update.name) || {};
    merged.push({
      ...existingEntry,
      ...update,
    });
  }

  return merged;
}

function removeDuplicatesByName(instruments: any[]) {
  const map = new Map<string, any>();
  for (const inst of instruments) {
    map.set(inst.name, inst);
  }
  return Array.from(map.values());
}
function removeWithoutInstrumentsNameInApiSitrad(instruments: any[], instrumentsWithValue: any[]) {
  const instrumentsNameInApi = instrumentsWithValue.map((instrument) => instrument.name);
  return instruments.filter((instrument) => instrumentsNameInApi.includes(instrument.name));
}

function formatInstrument(saved: any) {
  const temperatureData = saved.temperatures?.[0]?.temperature ?? null;
  const pressureData = saved.pressures?.[0]?.pressure ?? null;

  return saved.type === "press"
    ? {
      id: saved.id,
      idSitrad: saved.idSitrad,
      name: saved.name,
      slug: saved.slug,
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
      slug: saved.slug,
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
