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

wss.broadcast = function (data: any) {
  this.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "data",
          payload: data,
        })
      );
    }
  });
};

async function getInstruments() {
  try {
    const instruments = await redis.get(String(process.env.METADATA_CACHE_KEY));
    if (!instruments) {
      console.warn("Nenhum instrumento encontrado no Redis");
      return null;
    }
    return JSON.parse(instruments);
  } catch (error) {
    console.error("Erro ao buscar instrumentos do Redis:", error);
    return null;
  }
}

async function runSetValueInRedisLoop(intervalMs: number) {
   setInterval(async() => {
     try {
      await setValueInRedis();
      const instruments = await getInstruments();
      if (instruments) {
        wss.broadcast(instruments);
      }
    } catch (err) {
      console.error("Erro na atualização do Redis e broadcast:", (err as Error).message);
    }
   }, intervalMs);
}

async function runSetSaveDataLoop(intervalMs: number) {
 setInterval(async () => {
     try {
      await setSaveData();
    } catch (err) {
      console.error("Erro ao salvar dados no Postgres:", (err as Error).message);
    }
  }, intervalMs);
}

(async () => {
  try {
    console.log("Server WebSocket running on port 8080 🚀");

    runSetValueInRedisLoop(5000); // 55  seconds
    runSetSaveDataLoop(60000); // 1 minute

    setImmediate(async () => {
      try {
        await setSaveData();
        const instruments = await getInstruments();
        if (instruments) {
          wss.broadcast(instruments);
        } else {
          console.warn("Inicialização: instrumentos vazios ou nulos.");
        }
      } catch (err) {
        console.error("Erro na execução inicial:", (err as Error).message);
      }
    });

  } catch (err) {
    console.error("Erro crítico na inicialização:", (err as Error).message);
    process.exit(1);
  }
})();
