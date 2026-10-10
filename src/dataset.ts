// Dataset em JSONL: uma série por linha, com tipo, verdade, parâmetros e as leituras do total
// acumulado (null onde a leitura falta). Regenerar com a mesma semente dá o mesmo arquivo, byte a byte.

import { createHash } from "node:crypto";
import { type GeneratedSeries, generateDataset } from "./gerador.ts";
import { HOUR_MS } from "./serie.ts";

/** Semente em que os limites foram calibrados. */
export const DEV_SEED = 7;
/** Semente do número do README: os limites não foram ajustados olhando para ela. */
export const REPORT_SEED = 2026;
/** Sementes da faixa de variação no README. */
export const RANGE_SEEDS = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110];

export const DATASET_PATH = "data/dataset.jsonl";

export function serializeDataset(series: GeneratedSeries[]): string {
  return series.map((item) => JSON.stringify(item)).join("\n") + "\n";
}

export function parseDataset(text: string): GeneratedSeries[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as GeneratedSeries);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function buildDataset(seed: number) {
  const series = generateDataset(seed);
  const text = serializeDataset(series);
  return { series, text, hash: sha256(text) };
}

/** O corpo do POST /classify para uma série do dataset: a avaliação passa pelo mesmo contrato da API. */
export function toRequestBody(item: GeneratedSeries) {
  const startMs = Date.parse(item.start);
  return {
    series: item.readings.flatMap((reading, index) =>
      reading === null ? [] : [{ at: new Date(startMs + index * HOUR_MS).toISOString(), cumulative_views: reading }],
    ),
  };
}
