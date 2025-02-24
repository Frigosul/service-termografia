"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSaveData = setSaveData;
const client_1 = require("@prisma/client");
const dayjs_1 = __importDefault(require("dayjs"));
const get_instruments_with_value_1 = require("./get-instruments-with-value");
const prisma = new client_1.PrismaClient();
async function setSaveData() {
    const instrumentListWithValue = await (0, get_instruments_with_value_1.getInstrumentsWithValues)();
    if (!instrumentListWithValue)
        return;
    await Promise.all(instrumentListWithValue.map(async (instrument) => {
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
                                createdAt: (0, dayjs_1.default)().toDate(),
                                updatedAt: (0, dayjs_1.default)().toDate(),
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
                        type: existInstrument.type,
                    },
                })
                : await prisma.instrument.create({ data: instrumentData });
        }
        else {
            const status = Array.from(new Set([
                instrument.IsOpenDoor && "port",
                instrument.IsDefrost && "deg",
                instrument.IsRefrigeration && "resf",
                instrument.IsOutputFan && "vent",
                instrument.IsOutputDefr1 && "deg",
                instrument.IsOutputRefr && "resf",
            ]))
                .filter(Boolean)
                .join(",");
            const commonData = instrument.modelId === 67
                ? {
                    idSitrad: instrument.id,
                    name: instrument.name,
                    model: instrument.modelId,
                    status,
                    type: "press",
                    updatedAt: (0, dayjs_1.default)().toDate(),
                    error: null,
                    isSensorError: instrument.IsErrorPressureSensor,
                    pressures: {
                        create: {
                            pressure: {
                                create: {
                                    value: instrument.GasPressure,
                                    editValue: instrument.GasPressure,
                                    createdAt: (0, dayjs_1.default)().toDate(),
                                    updatedAt: (0, dayjs_1.default)().toDate(),
                                },
                            },
                        },
                    },
                }
                : {
                    idSitrad: instrument.id,
                    name: instrument.name,
                    model: instrument.modelId,
                    status,
                    type: "temp",
                    updatedAt: (0, dayjs_1.default)().toDate(),
                    error: null,
                    isSensorError: instrument.modelId === 72
                        ? instrument.IsErrorS1
                        : instrument.IsSensorError,
                    temperatures: {
                        create: {
                            temperature: {
                                create: {
                                    value: instrument.modelId === 72
                                        ? instrument.Sensor1
                                        : instrument.Temperature,
                                    editValue: instrument.modelId === 72
                                        ? instrument.Sensor1
                                        : instrument.Temperature,
                                    createdAt: (0, dayjs_1.default)().toDate(),
                                    updatedAt: (0, dayjs_1.default)().toDate(),
                                },
                            },
                        },
                    },
                };
            existInstrument
                ? await prisma.instrument.update({
                    where: { id: existInstrument.id },
                    data: commonData,
                })
                : await prisma.instrument.create({ data: commonData });
        }
    }));
}
