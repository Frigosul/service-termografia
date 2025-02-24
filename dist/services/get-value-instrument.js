"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValueInstrument = getValueInstrument;
const instance_1 = require("../instance");
async function getValueInstrument(id) {
    const result = await (0, instance_1.httpInstance)(`instruments/${id}/values`);
    if (result.data.error) {
        return result.data;
    }
    return result.data;
}
