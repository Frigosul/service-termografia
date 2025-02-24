"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstrumentsWithValues = getInstrumentsWithValues;
const get_instruments_1 = require("./get-instruments");
const get_value_instrument_1 = require("./get-value-instrument");
async function getInstrumentsWithValues() {
    try {
        const instrumentList = await (0, get_instruments_1.getInstruments)();
        const instrumentsWithValue = await Promise.all(instrumentList.results.map(async (instrument) => {
            const values = await (0, get_value_instrument_1.getValueInstrument)(instrument.id);
            if (values.error) {
                return {
                    id: instrument.id,
                    name: instrument.name || "instrument missing name",
                    error: values.error
                };
            }
            const mappedValues = values.results.reduce((acc, result) => {
                acc[result.code] = result.values[0].value;
                return acc;
            }, {});
            return {
                ...instrument,
                ...mappedValues
            };
        }));
        return instrumentsWithValue;
    }
    catch (error) {
        console.log(error);
    }
}
