import WebSocket, { WebSocketServer } from "ws";
import { prisma } from "./lib/prisma";
import { querySummaryInstrumentsV1 } from "./query-summary-instruments-v1";
import { setSaveData } from "./services/set-saved-data-in-db";

interface WebSocketServerWithBroadcast extends WebSocketServer {
  broadcast: (data: any) => void;
}

// Cria o servidor WebSocket
const wss = new WebSocket.Server({
  port: 8080,
  host: "0.0.0.0",
}) as WebSocketServerWithBroadcast;

// Função para enviar dados para todos os clientes conectados
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

wss.on("connection", (ws) => {
  console.log("Connected client");

  ws.on("close", () => {
    console.log("Disconnected client");
  });

  ws.on("error", (err) => {
    console.error("Erro no WebSocket:", err.message);
  });
});

// A cada 10 segundos, faz a consulta e envia para todos conectados
setInterval(async () => {
  try {
    const result = await querySummaryInstrumentsV1();
    wss.broadcast(result);
  } catch (err) {
    console.error("Erro ao consultar instrumentos:", (err as Error).message);
  }
}, 10000);

// A cada 10 segundos, salva os dados no banco
setInterval(setSaveData, 10000);

// Finaliza a conexão com o banco ao encerrar o processo
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

console.log(
  "Service running: temperatures and new instruments saved to PostgreSQL database every 10 seconds."
);
