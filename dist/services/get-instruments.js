"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstruments = getInstruments;
const instance_1 = require("../instance");
async function getInstruments() {
    const result = await (0, instance_1.httpInstance)('instruments');
    return result.data;
}
