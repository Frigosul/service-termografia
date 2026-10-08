import axios, { type InternalAxiosRequestConfig } from "axios";
import https from "node:https";
const credentials = btoa(`${process.env.API_USER}:${process.env.API_PASSWORD}`);

export const REQUEST_TIMEOUT_MS = 10000;
export const MAX_RETRIES = 6;
export const RETRY_DELAY_MS = 10000;

type RetryableConfig = InternalAxiosRequestConfig & { retryCount?: number };

export const httpInstance = axios.create({
  headers: {
    Authorization: `Basic ${credentials}`,
  },
  // Sem timeout, uma requisição sem resposta trava para sempre quem a aguarda
  timeout: REQUEST_TIMEOUT_MS,
  httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false }),
  proxy: undefined,
});
httpInstance.defaults.baseURL = process.env.BASE_URL;

httpInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as RetryableConfig | undefined;

    if (!error.response && config) {
      // Cada retry passa de novo por este interceptor, então o contador vive na config
      const attempt = (config.retryCount ?? 0) + 1;
      if (attempt <= MAX_RETRIES) {
        console.log(`Tentativa ${attempt} de ${MAX_RETRIES}...`);
        config.retryCount = attempt;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return httpInstance.request(config);
      }
      console.error("Máximo de tentativas atingido. Falha na conexão.");
    }

    if (error.response && error.response.status === 400) {
      const errorData = {
        id: error.config.url.split("/")[1],
        error: "Instrument without communication at moment",
      };
      return Promise.resolve({ data: errorData });
    }

    return Promise.reject(error);
  }
);
