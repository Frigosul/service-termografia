"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const query_summary_instruments_1 = require("./query-summary-instruments");
const set_saved_data_in_db_1 = require("./services/set-saved-data-in-db");
const ws = new ws_1.default.Server({ port: 8080 });
ws.on('connection', (ws) => {
    console.log('connected client');
    (0, query_summary_instruments_1.querySummaryInstruments)(ws);
    const interval = setInterval(() => {
        (0, query_summary_instruments_1.querySummaryInstruments)(ws);
    }, 10000); // 10 seconds
    ws.on('close', () => {
        clearInterval(interval);
        console.log('desconected client');
    });
});
// executa a cada 10 segundos a função que vai salvando os instrumentos e a temperatura dentro do db termografia.
console.log("Service running: temperatures and new instruments saved to PostgreSQL database every 10 seconds.");
setInterval(set_saved_data_in_db_1.setSaveData, 10000);
