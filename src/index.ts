import WebSocket, { WebSocketServer } from "ws";
import { prisma } from "./lib/prisma";
import { redis } from "./lib/redis";
import { setSaveData } from "./services/set-save-data";
import { setValueInRedis } from "./services/set-value-in-redis";

interface WebSocketServerWithBroadcast extends WebSocketServer {
  broadcast: (data: any) => void;
}
let saveDataInterval: NodeJS.Timeout;
let valueInRedisInterval: NodeJS.Timeout;

const wss = new WebSocket.Server({
  port: 8080,
  host: "0.0.0.0",
}) as WebSocketServerWithBroadcast;

function broadcast(data: any) {
  console.log("Inicio broadcast " + new Date().toISOString());
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "data", payload: data }));
    }
  });
  console.log("Fim broadcast " + new Date().toISOString());
}
wss.broadcast = broadcast;

async function getInstruments() {
  try {
    console.log("Inicio getInstruments " + new Date().toISOString());
    const instruments = await redis.get(String(process.env.METADATA_CACHE_KEY));
    if (!instruments) {
      console.warn("Nenhum instrumento encontrado no Redis");
      return null;
    }
    console.log("Fim getInstruments " + new Date().toISOString());
    return JSON.parse(instruments);

  } catch (error) {
    console.error("Erro ao buscar instrumentos do Redis:", error);
    return null;
  }
}

// Evita concorrência entre execuções
let isSaving = false;
function runSetSaveDataLoop(intervalMs: number) {
  console.log("Inicio runSetSaveDataLoop " + new Date().toISOString());
  saveDataInterval = setInterval(async () => {
    if (isSaving) return;
    isSaving = true;
    try {
      await setSaveData();
    } catch (err) {
      console.error("Erro ao salvar dados no Postgres:", (err as Error).message);
    } finally {
      isSaving = false;
      console.log("Fim runSetSaveDataLoop " + new Date().toISOString());
    }
  }, intervalMs);
}

let isUpdatingRedis = false;
function runSetValueInRedisLoop(intervalMs: number) {
  console.log("Inicio runSetValueInRedisLoop " + new Date().toISOString());
  valueInRedisInterval = setInterval(async () => {
    if (isUpdatingRedis) return;
    isUpdatingRedis = true;
    try {
      await setValueInRedis();
      const instruments = await getInstruments();
      if (instruments) {
        wss.broadcast(instruments);
      }
    } catch (err) {
      console.error("Erro na atualização do Redis e broadcast:", (err as Error).message);
    } finally {
      isUpdatingRedis = false;
      console.log("Fim runSetValueInRedisLoop " + new Date().toISOString());
    }
  }, intervalMs);
}

(async () => {
  try {
    console.log("Server WebSocket running on port 8080 🚀");

    runSetValueInRedisLoop(5000);
    runSetSaveDataLoop(60000);

    // Inicialização
    await setSaveData();
    const instruments = await getInstruments();
    if (instruments) {
      wss.broadcast(instruments);
    } else {
      console.warn("Inicialização: instrumentos vazios ou nulos.");
    }

    // Graceful shutdown
    const shutdown = async () => {
      console.log("Desligando servidor...");
      clearInterval(saveDataInterval);
      clearInterval(valueInRedisInterval);
      await prisma.$disconnect();
      await redis.quit?.();
      wss.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

  } catch (err) {
    console.error("Erro crítico na inicialização:", (err as Error).message);
    await prisma.$disconnect();
    await redis.quit?.();
    wss.close();
    process.exit(1);
  }
})();