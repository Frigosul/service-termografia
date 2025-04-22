import WebSocket from "ws";
import { querySummaryInstruments } from "./query-summary-instruments";
import { setSaveData } from "./services/set-saved-data-in-db";

const wss = new WebSocket.Server({ port: 8080, host: "0.0.0.0" });

wss.on("connection", (ws) => {
  console.log("connected client");

  querySummaryInstruments(ws);

  const intervalData = setInterval(() => {
    querySummaryInstruments(ws);
  }, 10000); // 10 seconds - seu envio de dados normal

  // PING MANUAL
  const intervalPing = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000); // a cada 30 segundos, envia um ping para manter vivo

  ws.on("pong", () => {
    // Cliente respondeu o ping
    console.log("Pong recebido do cliente");
  });

  ws.on("close", () => {
    clearInterval(intervalData);
    clearInterval(intervalPing);
    console.log("disconnected client");
  });

  ws.on("error", (error) => {
    console.error("WebSocket erro:", error);
  });
});

console.log(
  "Service running: temperatures and new instruments saved to PostgreSQL database every 10 seconds."
);
setInterval(setSaveData, 10000);
