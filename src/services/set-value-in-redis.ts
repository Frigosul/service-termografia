import { redis } from "../lib/redis";
import type { IInstrument } from "../type/instruments";
import { getInstrumentsWithValues } from "./get-instruments-with-value";



// Interface para a estrutura de dados intermediária, após o processamento inicial
interface Instrument {
  idSitrad: number;
  name: string;
  slug: string;
  model: number | null;
  error?: any;
  type: 'press' | 'temp';
  isSensorError: boolean;
  process: string;
  status: string;
  setPoint?: number;
  differential?: number;
  pressures?: { pressure: { editValue: number } }[];
  temperatures?: { temperature: { editValue: number } }[];
  // Campos que podem vir do cache existente
  id?: string;
  orderDisplay?: number;
  createdAt?: string;
  maxValue?: number;
  minValue?: number;
}

// Interface para o formato final que será salvo no Redis
interface FormattedInstrument {
  id?: string;
  idSitrad: number;
  name: string;
  slug: string;
  model: number | null;
  orderDisplay?: number;
  type: 'press' | 'temp';
  process: string;
  status: string;
  isSensorError: boolean;
  pressure?: number | null;
  temperature?: number | null;
  instrumentCreatedAt?: string;
  createdAt?: string | null;
  error?: any;
  maxValue?: number;
  minValue?: number;
  setPoint?: number;
  differential?: number;
}

// Mapeamento de status de processo para uma leitura mais clara
const PROCESS_STATUS_MAP: Record<number, string> = {
  1: "Online",
  7: "Refrigeração",
  8: "Degelo",
};

const getProcessStatus = (instrument: IInstrument): string => {
  if (instrument.ProcessStatusText) {
    return instrument.ProcessStatusText;
  }
  if (instrument.ProcessStatus !== undefined) {
    return PROCESS_STATUS_MAP[instrument.ProcessStatus as number] ?? instrument.ProcessStatus.toString();
  }
  return "";
};

const getInstrumentStatus = (instrument: IInstrument): string => {
  if (instrument.error || !instrument.modelId) {
    return "";
  }
  const statusFlags = new Set<string>(
    [
      instrument.IsOpenDoor && "port",
      instrument.IsDefrost && "deg",
      instrument.IsRefrigeration && "resf",
      instrument.IsOutputFan && "vent",
      instrument.IsOutputDefr1 && "deg",
      instrument.IsOutputRefr && "resf",
    ].filter((flag): flag is string => Boolean(flag))
  );
  return Array.from(statusFlags).join(",");
};

/**
 * Cria um objeto Instrument a partir dos dados brutos da API.
 */
const createInstrument = (apiInst: IInstrument): Instrument => {
  const isPress = apiInst.modelId === 67;
  const type = isPress ? 'press' : 'temp';

  const sensorError = isPress
    ? apiInst.IsErrorPressureSensor
    : apiInst.modelId === 72
      ? apiInst.IsErrorS1
      : apiInst.IsSensorError;

  const instrument: Instrument = {
    idSitrad: apiInst.id,
    name: apiInst.name,
    slug: apiInst.slug,
    model: apiInst.modelId,
    error: apiInst.error,
    type,
    isSensorError: !!sensorError,
    process: getProcessStatus(apiInst),
    status: getInstrumentStatus(apiInst),
    setPoint: apiInst.CurrentSetpoint ?? apiInst.FncSetpoint,
    differential: apiInst.FncDifferential,
  };

  if (type === 'press') {
    instrument.pressures = [{
      pressure: { editValue: !sensorError ? (apiInst.GasPressure ?? 0) : 0 }
    }];
  } else {
    const temperatureValue = apiInst.modelId === 72 ? apiInst.Sensor1 : apiInst.Temperature;
    instrument.temperatures = [{
      temperature: { editValue: !sensorError ? (temperatureValue ?? 0) : 0 }
    }];
  }

  return instrument;
};


const formatInstrument = (saved: Instrument): FormattedInstrument => {
  const baseData = {
    id: saved.id,
    idSitrad: saved.idSitrad,
    name: saved.name,
    slug: saved.slug,
    model: saved.model,
    orderDisplay: saved.orderDisplay,
    type: saved.type,
    process: saved.process,
    status: saved.status,
    isSensorError: saved.isSensorError,
    instrumentCreatedAt: saved.createdAt,
    error: saved.error,
    maxValue: saved.maxValue,
    minValue: saved.minValue,
    setPoint: saved.setPoint,
  };

  if (saved.type === 'press') {
    const pressureData = saved.pressures?.[0]?.pressure;
    return {
      ...baseData,
      pressure: pressureData?.editValue ?? null,
      createdAt: (pressureData as any)?.createdAt ?? null, // Ajuste se o tipo for conhecido
    };
  }

  const temperatureData = saved.temperatures?.[0]?.temperature;
  return {
    ...baseData,
    temperature: temperatureData?.editValue ?? null,
    createdAt: (temperatureData as any)?.createdAt ?? null, // Ajuste se o tipo for conhecido
    differential: saved.differential,
  };
};

// Funções auxiliares genéricas
const mergeInstrumentData = (existing: Instrument[], updates: Instrument[]): Instrument[] => {
  const existingMap = new Map<string, Instrument>(existing.map((i) => [i.name, i]));
  return updates.map(update => ({ ...existingMap.get(update.name), ...update }));
};

const removeDuplicatesByName = (instruments: Instrument[]): Instrument[] => {
  const map = new Map<string, Instrument>();
  for (const inst of instruments) {
    map.set(inst.name, inst);
  }
  return Array.from(map.values());
};

const filterInstrumentsNotInApi = (instruments: Instrument[], IInstruments: IInstrument[]): Instrument[] => {
  const IInstrumentNames = new Set(IInstruments.map(inst => inst.name));
  return instruments.filter(inst => IInstrumentNames.has(inst.name));
};

/**
 * Função principal para buscar, processar e salvar os dados dos instrumentos no Redis.
 */
export async function setValueInRedis(): Promise<void> {
  try {
    const instrumentsFromApi: IInstrument[] = (await getInstrumentsWithValues()) ?? [];
    if (!instrumentsFromApi?.length) return;

    const existingCacheRaw = await redis.get(String(process.env.METADATA_CACHE_KEY));
    const existingCache: Instrument[] = existingCacheRaw ? JSON.parse(existingCacheRaw) : [];

    const newInstrumentsData = instrumentsFromApi.map(createInstrument);

    const mergedData = mergeInstrumentData(existingCache, newInstrumentsData);
    const uniqueData = removeDuplicatesByName(mergedData);
    const filteredData = filterInstrumentsNotInApi(uniqueData, instrumentsFromApi);

    const formattedToSave = filteredData
      .map(formatInstrument)
      .sort((a, b) => (a.orderDisplay ?? 0) - (b.orderDisplay ?? 0));

    await redis.set(
      String(process.env.METADATA_CACHE_KEY),
      JSON.stringify(formattedToSave),
      "EX",
      15 // 15 segundos de expiração
    );
  } catch (error) {
    console.error("Erro ao salvar dados e atualizar cache:", error);
  }
}
