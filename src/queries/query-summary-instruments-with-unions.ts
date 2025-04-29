import WebSocket from "ws";
import { prisma } from "../lib/prisma";

export async function querySummaryInstrumentsWithUnion(ws: WebSocket) {
  const instruments = await prisma.instrument.findMany({
    select: {
      id: true,
      name: true,
      displayOrder: true,
      createdAt: true,
    },
    where: {
      isActive: true,
    },
    orderBy: {
      displayOrder: "asc",
    },
  });

  const unions = await prisma.unionInstruments.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    where: {
      isActive: true,
    },
  });

  const instrumentsWithUnions = [...instruments, ...unions];

  //send data to connected client
  ws.send(JSON.stringify(instrumentsWithUnions));
}
