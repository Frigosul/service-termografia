import dayjs from "dayjs";
import { prisma } from "./lib/prisma";

export async function querySummaryInstrumentsV1() {
  const instruments = await prisma.instrument.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      displayOrder: "asc",
    },
    select: {
      id: true,
      idSitrad: true,
      name: true,
      model: true,
      type: true,
      status: true,
      error: true,
      minValue: true,
      maxValue: true,
      setPoint: true,
      differential: true,
      createdAt: true,
      isSensorError: true,
    },
  });
  const instrumentsIds = instruments.map((instrument) => instrument.id);

  const [temperatures, pressures] = await Promise.all([
    prisma.instrumentsTemperature.findMany({
      where: {
        instrument_id: { in: instrumentsIds },
        temperature: {
          createdAt: {
            gte: dayjs().subtract(10, "second").toDate(),
          },
        },
      },
      select: {
        instrument_id: true,
        temperature: {
          select: {
            editValue: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        temperature: {
          createdAt: "desc",
        },
      },
    }),
    prisma.instrumentsPressure.findMany({
      where: {
        instrument_id: { in: instrumentsIds },
        pressure: {
          createdAt: {
            gte: dayjs().subtract(10, "second").toDate(),
          },
        },
      },
      select: {
        instrument_id: true,
        pressure: {
          select: {
            editValue: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        pressure: {
          createdAt: "desc",
        },
      },
    }),
  ]);

  const temperatureMap = new Map(
    temperatures.map((t) => [t.instrument_id, t.temperature])
  );
  const pressureMap = new Map(
    pressures.map((p) => [p.instrument_id, p.pressure])
  );

  const formattedInstruments = instruments.map((instrument) => {
    const temperatureData = temperatureMap.get(instrument.id);
    const pressureData = pressureMap.get(instrument.id);

    return instrument.type === "press"
      ? {
          id: instrument.id,
          idSitrad: instrument.idSitrad,
          name: instrument.name,
          model: instrument.model,
          type: instrument.type,
          status: instrument.status,
          isSensorError: instrument.isSensorError,
          pressure: pressureData?.editValue ?? null,
          instrumentCreatedAt: instrument.createdAt,
          createdAt: pressureData?.createdAt ?? null,
          error: instrument.error,
          maxValue: instrument.maxValue,
          minValue: instrument.minValue,
          setPoint: instrument.setPoint,
        }
      : {
          id: instrument.id,
          idSitrad: instrument.idSitrad,
          name: instrument.name,
          model: instrument.model,
          type: instrument.type,
          status: instrument.status,
          isSensorError: instrument.isSensorError,
          temperature: temperatureData?.editValue ?? null,
          instrumentCreatedAt: instrument.createdAt,
          createdAt: temperatureData?.createdAt ?? null,
          error: instrument.error,
          maxValue: instrument.maxValue,
          minValue: instrument.minValue,
          setPoint: instrument.setPoint,
          differential: instrument.differential,
        };
  });
  return formattedInstruments;
}
