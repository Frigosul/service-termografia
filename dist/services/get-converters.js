"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConverters = getConverters;
const instance_1 = require("../instance");
async function getConverters() {
    const result = await (0, instance_1.httpInstance)('converters');
    return result.data;
}
