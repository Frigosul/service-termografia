import axios from "axios";
import https from "node:https";
const credentials = btoa(`${process.env.API_USER}:${process.env.API_PASSWORD}`);

export const httpInstance = axios.create({
  headers: {
    Authorization: `Basic ${credentials}`,
  },
  httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false }),
  proxy: undefined,
});
httpInstance.defaults.baseURL = process.env.BASE_URL;

httpInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) {
      const maxRetries = 6;
      const retryDelay = 10000;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Tentativa ${attempt} de ${maxRetries}...`);

        await new Promise((resolve) => setTimeout(resolve, retryDelay));

        try {
          return await httpInstance.request(error.config);
        } catch (retryError) {
          if (attempt === maxRetries) {
            console.error("Máximo de tentativas atingido. Falha na conexão.");
            break;
          }
        }
      }
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
