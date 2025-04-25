import WebSocket from "ws";
import { prisma } from "./lib/prisma";
import { querySummaryInstruments } from "./query-summary-instruments";
import { setSaveData } from "./services/set-saved-data-in-db";

const wss = new WebSocket.Server({ port: 8080, host: "0.0.0.0" });
const lastSent = new Map<WebSocket, number>();

// cache of ip client
function shouldQuery(ws: WebSocket): boolean {
  const now = Date.now();
  const last = lastSent.get(ws) ?? 0;
  if (now - last < 10000) return false;
  lastSent.set(ws, now);
  return true;
}

wss.on("connection", (ws) => {
  console.log("Connected client");

  if (shouldQuery(ws)) {
    querySummaryInstruments(ws);
  }

  const intervalData = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN && shouldQuery(ws)) {
      querySummaryInstruments(ws);
    }
  }, 10000); // 10 segundos

  ws.on("close", () => {
    clearInterval(intervalData);
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

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
