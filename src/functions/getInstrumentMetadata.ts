import { redis } from "../lib/redis";
import { querySummaryInstrumentsV1 } from "../queries/query-summary-instruments-v1";
import { FormattedInstrument } from "../type/formatted-instrument";

export async function getInstrumentMetadata(): Promise<FormattedInstrument[]> {
  const cached = await redis.get(String(process.env.METADATA_CACHE_KEY));

  if (cached) {
    console.log("✅ [CACHE HIT] Instrument metadata loaded from Redis");
    return JSON.parse(cached);
  }
  console.log("🚨 [CACHE MISS] Fetching instrument metadata from Database");
  const metadata: FormattedInstrument[] = await querySummaryInstrumentsV1();

  // Salva no Redis por 5 minutos (300 segundos)
  await redis.set(
    String(process.env.METADATA_CACHE_KEY),
    JSON.stringify(metadata),
    "EX",
    300
  );

  return metadata;
}
