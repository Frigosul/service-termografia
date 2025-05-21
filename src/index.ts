import WebSocket, { WebSocketServer } from "ws";
import { redis } from "./lib/redis";
import { setSaveData } from "./services/set-saved-data-in-db";
import { setValueInRedis } from "./services/set-value-in-redis";

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

    setInterval(async () => {
      try {
        await setValueInRedis();
        const instruments = await getInstruments();
        wss.broadcast(instruments);
      } catch (err) {
        console.error("Error list instruments", (err as Error).message);
      }
    }, 5000); // 5 seconds

  } catch (err) {
    console.error("Erro na execução inicial:", (err as Error).message);
  }
})();


setInterval(async () => {
  try {
    await setSaveData();
  } catch (err) {
    console.error("Error saved instruments", (err as Error).message);
  }
}, 1000 * 60); // 1 minute

console.log("Server WebSocket running on port 8080 🚀");
