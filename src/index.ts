import WebSocket, { WebSocketServer } from "ws";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";
import { setSaveData } from "./services/set-saved-data-in-db";

interface WebSocketServerWithBroadcast extends WebSocketServer {
  broadcast: (data: any) => void;
}

const wss = new WebSocket.Server({
  port: 8080,
  host: "0.0.0.0",
}) as WebSocketServerWithBroadcast;
function broadcast(data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "data",
          payload: data,
        })
      );
    }
  });
}
wss.broadcast = broadcast;

async function getInstruments() {
  const instruments = await redis.get(String(process.env.METADATA_CACHE_KEY));
  return JSON.parse(String(instruments));
}

// 🚀 Executa imediatamente ao subir o servidor
(async () => {
  try {
    await setSaveData();
    const instruments = await getInstruments();
    wss.broadcast(instruments);
  } catch (err) {
    console.error("Erro na execução inicial:", (err as Error).message);
  }
})();

setInterval(async () => {
  try {
    setSaveData();
    const instruments = await getInstruments();
    wss.broadcast(instruments);
  } catch (err) {
    console.error("Error list instruments", (err as Error).message);
  }
}, 10000);

// Finaliza a conexão com o banco ao encerrar o processo
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

console.log(
  "Service running: temperatures and new instruments saved to PostgreSQL database every 10 seconds."
);
