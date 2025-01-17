import { PrismaClient } from "@prisma/client";
import WebSocket from 'ws';

const prisma = new PrismaClient();

export async function querySummaryInstruments(ws: WebSocket) {
  const instruments = await prisma.instrument.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      error: true,
      minValue: true,
      maxValue: true,
      createdAt: true,
      isSensorError: true,
      temperatures: {
        select: {
          temperature: {
            select: {
              editValue: true,
              createdAt: true,
            }
          },
        },
        orderBy: {
          temperature: {
            updatedAt: 'desc'
          },

        },
        take: 1
      },
      pressures: {
        select: {
          pressure: {
            select: {
              editValue: true,
              createdAt: true,
            }
          },
        },
        orderBy: {
          pressure: {
            updatedAt: 'desc'
          },

        },
        take: 1
      }
    },
    where: {
      isActive: true
    },
    orderBy: {
      displayOrder: 'asc'
    }
  })


  const formattedInstruments = instruments.map(instrument => {
    return instrument.type === 'press' ? {
      id: instrument.id,
      name: instrument.name,
      type: instrument.type,
      status: instrument.status,
      isSensorError: instrument.isSensorError,
      pressure: instrument.pressures?.[0].pressure?.editValue ?? null,
      instrumentCreatedAt: instrument.createdAt,
      createdAt: instrument.temperatures?.[0].temperature.createdAt,
      error: instrument.error,
      maxValue: instrument.maxValue,
      minValue: instrument.minValue,
    } :
      {
        id: instrument.id,
        name: instrument.name,
        type: instrument.type,
        status: instrument.status,
        isSensorError: instrument.isSensorError,
        temperature: instrument.temperatures?.[0]?.temperature?.editValue ?? null,
        instrumentCreatedAt: instrument.createdAt,
        createdAt: instrument.temperatures?.[0].temperature.createdAt,
        error: instrument.error,
        maxValue: instrument.maxValue,
        minValue: instrument.minValue,
      }
  });

  //send data to connected client
  ws.send(JSON.stringify(formattedInstruments));
}
