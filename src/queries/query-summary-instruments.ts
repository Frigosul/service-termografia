import dayjs from "dayjs";
import { prisma } from "../lib/prisma";

export async function querySummaryInstruments() {
  const instruments = await prisma.instrument.findMany({
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
      temperatures: {
        where: {
          temperature: {
            createdAt: {
              gte: dayjs().subtract(10, "second").toDate(),
            },
          },
        },
        select: {
          temperature: {
            select: {
              editValue: true,
              createdAt: true,
            },
          },
        },

        orderBy: {
          temperature: {
            updatedAt: "desc",
          },
        },
        take: 1,
      },
      pressures: {
        select: {
          pressure: {
            select: {
              editValue: true,
              createdAt: true,
            },
          },
        },
        where: {
          pressure: {
            createdAt: {
              gte: dayjs().subtract(10, "second").toDate(),
            },
          },
        },
        orderBy: {
          pressure: {
            updatedAt: "desc",
          },
        },
        take: 1,
      },
    },
    where: {
      isActive: true,
    },
    orderBy: {
      displayOrder: "asc",
    },
  });

  const formattedInstruments = instruments.map((instrument) => {
    return instrument.type === "press"
      ? {
          id: instrument.id,
          idSitrad: instrument.idSitrad,
          name: instrument.name,
          model: instrument.model,
          type: instrument.type,
          status: instrument.status,
          isSensorError: instrument.isSensorError,
          pressure: instrument.pressures?.[0]?.pressure?.editValue ?? null,
          instrumentCreatedAt: instrument.createdAt,
          createdAt: instrument.temperatures?.[0]?.temperature?.createdAt,
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
          temperature:
            instrument.temperatures?.[0]?.temperature?.editValue ?? null,
          instrumentCreatedAt: instrument.createdAt,
          createdAt: instrument.temperatures?.[0]?.temperature.createdAt,
          error: instrument.error,
          maxValue: instrument.maxValue,
          minValue: instrument.minValue,
          setPoint: instrument.setPoint,
          differential: instrument.differential,
        };
  });

  return formattedInstruments;
}
