"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpInstance = void 0;
const axios_1 = __importDefault(require("axios"));
const node_https_1 = __importDefault(require("node:https"));
const credentials = btoa(`${process.env.API_USER}:${process.env.API_PASSWORD}`);
exports.httpInstance = axios_1.default.create({
    headers: {
        Authorization: `Basic ${credentials}`,
    },
    httpsAgent: new node_https_1.default.Agent({ keepAlive: true, rejectUnauthorized: false }),
    proxy: undefined,
});
exports.httpInstance.defaults.baseURL = process.env.BASE_URL;
exports.httpInstance.interceptors.response.use((response) => response, async (error) => {
    if (!error.response) {
        const maxRetries = 6;
        const retryDelay = 10000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(`Tentativa ${attempt} de ${maxRetries}...`);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            try {
                return await exports.httpInstance.request(error.config);
            }
            catch (retryError) {
                if (attempt === maxRetries) {
                    console.error("Máximo de tentativas atingido. Falha na conexão.");
                    break;
                }
            }
        }
    }
    if (error.response && error.response.status === 400) {
        const errorData = {
            id: error.config.url.split("/")[1],
            error: "Instrument without communication at moment",
        };
        return Promise.resolve({ data: errorData });
    }
    return Promise.reject(error);
});
