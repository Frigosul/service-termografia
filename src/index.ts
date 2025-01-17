import WebSocket from 'ws';
import { querySummaryInstruments } from './query-summary-instruments';
import { setSaveData } from './services/set-saved-data-in-db';

const ws = new WebSocket.Server({ port: 8080 });

ws.on('connection', (ws) => {
  console.log('connected client');
  querySummaryInstruments(ws);

  const interval = setInterval(() => {
    querySummaryInstruments(ws);
  }, 10000); // 10 seconds

  ws.on('close', () => {
    clearInterval(interval);
    console.log('desconected client');
  });
});

// executa a cada 10 segundos a função que vai salvando os instrumentos e a temperatura dentro do db termografia.
console.log("Service running: temperatures and new instruments saved to PostgreSQL database every 10 seconds.")
setInterval(setSaveData, 10000)