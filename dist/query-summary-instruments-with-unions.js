"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.querySummaryInstrumentsWithUnion = querySummaryInstrumentsWithUnion;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function querySummaryInstrumentsWithUnion(ws) {
    const instruments = await prisma.instrument.findMany({
        select: {
            id: true,
            name: true,
            displayOrder: true,
            createdAt: true
        },
        where: {
            isActive: true
        },
        orderBy: {
            displayOrder: 'asc'
        }
    });
    const unions = await prisma.unionInstruments.findMany({
        select: {
            id: true,
            name: true,
            createdAt: true
        },
        orderBy: {
            createdAt: 'asc'
        },
        where: {
            isActive: true
        },
    });
    const instrumentsWithUnions = [...instruments, ...unions];
    //send data to connected client
    ws.send(JSON.stringify(instrumentsWithUnions));
}
