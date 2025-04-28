import dayjs from "dayjs";
import { prisma } from "./lib/prisma";

// export async function querySummaryInstruments() {
//   const instruments = await prisma.instrument.findMany({
//     select: {
//       id: true,
//       idSitrad: true,
//       name: true,
//       model: true,
//       type: true,
//       status: true,
//       error: true,
//       minValue: true,
//       maxValue: true,
//       setPoint: true,
//       differential: true,
//       createdAt: true,
//       isSensorError: true,
//       temperatures: {
//         where: {
//           temperature: {
//             createdAt: {
//               gte: new Date(Date.now() - 60 * 60 * 3 * 1000 - 30000),
//             },
//           },
//         },
//         select: {
//           temperature: {
//             select: {
//               editValue: true,
//               createdAt: true,
//             },
//           },
//         },

//         orderBy: {
//           temperature: {
//             updatedAt: "desc",
//           },
//         },
//         take: 1,
//       },
//       pressures: {
//         select: {
//           pressure: {
//             select: {
//               editValue: true,
//               createdAt: true,
//             },
//           },
//         },
//         where: {
//           pressure: {
//             createdAt: {
//               gte: new Date(Date.now() - 60 * 60 * 3 * 1000 - 30000),
//             },
//           },
//         },
//         orderBy: {
//           pressure: {
//             updatedAt: "desc",
//           },
//         },
//         take: 1,
//       },
//     },
//     where: {
//       isActive: true,
//     },
//     orderBy: {
//       displayOrder: "asc",
//     },
//   });

//   const formattedInstruments = instruments.map((instrument) => {
//     return instrument.type === "press"
//       ? {
//           id: instrument.id,
//           idSitrad: instrument.idSitrad,
//           name: instrument.name,
//           model: instrument.model,
//           type: instrument.type,
//           status: instrument.status,
//           isSensorError: instrument.isSensorError,
//           pressure: instrument.pressures?.[0]?.pressure?.editValue ?? null,
//           instrumentCreatedAt: instrument.createdAt,
//           createdAt: instrument.temperatures?.[0]?.temperature?.createdAt,
//           error: instrument.error,
//           maxValue: instrument.maxValue,
//           minValue: instrument.minValue,
//           setPoint: instrument.setPoint,
//         }
//       : {
//           id: instrument.id,
//           idSitrad: instrument.idSitrad,
//           name: instrument.name,
//           model: instrument.model,
//           type: instrument.type,
//           status: instrument.status,
//           isSensorError: instrument.isSensorError,
//           temperature:
//             instrument.temperatures?.[0]?.temperature?.editValue ?? null,
//           instrumentCreatedAt: instrument.createdAt,
//           createdAt: instrument.temperatures?.[0]?.temperature.createdAt,
//           error: instrument.error,
//           maxValue: instrument.maxValue,
//           minValue: instrument.minValue,
//           setPoint: instrument.setPoint,
//           differential: instrument.differential,
//         };
//   });

//   return formattedInstruments;
// }
export async function querySummaryInstruments() {
  const instruments = await prisma.instrument.findMany({
    where: { isActive: true },
  });

  const instrumentIds = instruments.map((i) => i.id);

  const [temperatures, pressures] = await Promise.all([
    prisma.instrumentsTemperature.findMany({
      where: {
        instrument_id: { in: instrumentIds },
        temperature: {
          createdAt: {
            gte: dayjs().subtract(20, "second").toDate(),
          },
        },
      },
      orderBy: {
        temperature: {
          updatedAt: "desc",
        },
      },
      select: {
        instrument_id: true,
        instruments: {
          select: {
            idSitrad: true,
            name: true,
            model: true,
            type: true,
            status: true,
            isSensorError: true,
            error: true,
            minValue: true,
            maxValue: true,
            setPoint: true,
            differential: true,
            createdAt: true,
            isActive: true,
            displayOrder: true,
          },
        },
        temperature: {
          select: {
            editValue: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.instrumentsPressure.findMany({
      where: {
        instrument_id: { in: instrumentIds },
        pressure: {
          createdAt: {
            gte: dayjs().subtract(20, "second").toDate(),
          },
        },
      },
      orderBy: {
        pressure: {
          updatedAt: "desc",
        },
      },
      select: {
        instrument_id: true,
        instruments: {
          select: {
            idSitrad: true,
            name: true,
            model: true,
            type: true,
            status: true,
            isSensorError: true,
            error: true,
            minValue: true,
            maxValue: true,
            setPoint: true,
            differential: true,
            createdAt: true,
            isActive: true,
            displayOrder: true,
          },
        },
        pressure: {
          select: {
            editValue: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);
  const formattedInstruments = [
    ...temperatures
      .map((temperature) => {
        if (temperature.instruments.type === "temp") {
          return {
            id: temperature.instrument_id,
            idSitrad: temperature.instruments.idSitrad,
            name: temperature.instruments.name,
            model: temperature.instruments.model,
            type: temperature.instruments.type,
            status: temperature.instruments.status,
            isSensorError: temperature.instruments.isSensorError,
            temperature: temperature.temperature.editValue,
            createdAt: temperature.instruments.createdAt,
            error: temperature.instruments.error,
            maxValue: temperature.instruments.maxValue,
            minValue: temperature.instruments.minValue,
            setPoint: temperature.instruments.setPoint,
            differential: temperature.instruments.differential,
          };
        }
        return null; // se não for temperature, ignora
      })
      .filter(Boolean),
    ...pressures
      .map((pressure) => {
        if (pressure.instruments.type === "press") {
          return {
            id: pressure.instrument_id,
            idSitrad: pressure.instruments.idSitrad,
            name: pressure.instruments.name,
            model: pressure.instruments.model,
            type: pressure.instruments.type,
            status: pressure.instruments.status,
            isSensorError: pressure.instruments.isSensorError,
            pressure: pressure.pressure.editValue,
            createdAt: pressure.instruments.createdAt,
            error: pressure.instruments.error,
            maxValue: pressure.instruments.maxValue,
            minValue: pressure.instruments.minValue,
            setPoint: pressure.instruments.setPoint,
            differential: pressure.instruments.differential,
          };
        }
        return null;
      })
      .filter(Boolean),
  ];
  console.log(formattedInstruments);
  return formattedInstruments;
}
