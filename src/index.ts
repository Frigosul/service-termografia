import WebSocket from "ws";
import { querySummaryInstruments } from "./query-summary-instruments";
import { setSaveData } from "./services/set-saved-data-in-db";

const wss = new WebSocket.Server({ port: 8080, host: "0.0.0.0" });
wss.on("connection", (ws) => {
  console.log("Connected client");
  ws.send(
    JSON.stringify({
      type: "ping",
      payload: "Hello! WebSocket is alive!",
    })
  );
  console.log("Mensagem teste enviada imediatamente");
  querySummaryInstruments(ws);

  const intervalData = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      querySummaryInstruments(ws);
    }
  }, 10000); // 10 segundos

  const intervalPing = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
      console.log("Ping enviado para cliente");
    }
  }, 15000); // 15 segundos (ping separado para manter vivo)

  ws.on("pong", () => {
    console.log("Pong recebido do cliente");
  });

  ws.on("close", () => {
    clearInterval(intervalData);
    clearInterval(intervalPing);
    console.log("Disconnected client");
  });

  ws.on("error", (err) => {
    console.error("Erro no WebSocket:", err.message);
  });
});
console.log(
  "Service running: temperatures and new instruments saved to PostgreSQL database every 10 seconds."
);

setInterval(setSaveData, 10000);
