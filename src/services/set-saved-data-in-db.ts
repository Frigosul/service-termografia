import { PrismaClient } from "@prisma/client";
import dayjs from "dayjs";
import { getInstrumentsWithValues } from "./get-instruments-with-value";

const prisma = new PrismaClient();

export async function setSaveData() {
  const instrumentListWithValue = await getInstrumentsWithValues();
  if (!instrumentListWithValue) return;

  await Promise.all(
    instrumentListWithValue.map(async (instrument) => {
      const existInstrument = await prisma.instrument.findFirst({
        where: { name: instrument.name },
      });

      if (instrument.error || !instrument.modelId) {
        const instrumentData = {
          name: instrument.name,
          status: "",
          error: instrument.error,
          temperatures: {
            create: {
              temperature: {
                create: {
                  value: 0,
                  editValue: 0,
                  createdAt: dayjs().toDate(),
                  updatedAt: dayjs().toDate(),
                },
              },
            },
          },
        };
        existInstrument
          ? await prisma.instrument.update({
            where: { id: existInstrument.id },
            data: {
              ...instrumentData,
              type: existInstrument.type
            },
          })
          : await prisma.instrument.create({ data: instrumentData });
      } else {
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

        const commonData = instrument.modelId === 67 ? {
          idSitrad: instrument.id,
          name: instrument.name,
          status,
          type: 'press',
          updatedAt: dayjs().toDate(),
          error: null,
          isSensorError: instrument.IsErrorPressureSensor,
          pressures: {
            create: {
              pressure: {
                create: {
                  value: instrument.GasPressure,
                  editValue: instrument.GasPressure,
                  createdAt: dayjs().toDate(),
                  updatedAt: dayjs().toDate(),
                },
              },
            },

          }
        } : {
          idSitrad: instrument.id,
          name: instrument.name,
          status,
          type: 'temp',
          updatedAt: dayjs().toDate(),
          error: null,
          isSensorError: instrument.modelId === 72 ? instrument.IsErrorS1 : instrument.IsSensorError,
          temperatures: {
            create: {
              temperature: {
                create: {
                  value:
                    instrument.modelId === 72
                      ? instrument.Sensor1
                      : instrument.Temperature,
                  editValue:
                    instrument.modelId === 72
                      ? instrument.Sensor1
                      : instrument.Temperature,
                  createdAt: dayjs().toDate(),
                  updatedAt: dayjs().toDate(),
                },
              },
            },
          }
        };

        existInstrument
          ? await prisma.instrument.update({
            where: { id: existInstrument.id },
            data: commonData,
          })
          : await prisma.instrument.create({ data: commonData });
      }
    })
  );
}
