import { describe, expect, it } from "vitest";
import { DEV_SEED, buildDataset, parseDataset, serializeDataset } from "../src/dataset.ts";
import { TYPES, generateSeries } from "../src/gerador.ts";
import { createRng, hashSeed } from "../src/prng.ts";

describe("gerador pseudoaleatório próprio", () => {
  it("a mesma semente dá a mesma sequência; outra semente, outra sequência", () => {
    const draw = (seed: number) => Array.from({ length: 5 }, createRng(seed).next);
    expect(draw(42)).toEqual(draw(42));
    expect(draw(42)).not.toEqual(draw(43));
    expect(draw(42).every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("a semente de cada série depende só da semente do dataset, do tipo e do índice", () => {
    expect(hashSeed(7, "drip_feed", 3)).toBe(hashSeed(7, "drip_feed", 3));
    expect(hashSeed(7, "drip_feed", 3)).not.toBe(hashSeed(7, "drip_feed", 4));
  });
});

describe("dataset sintético", () => {
  const { series, text } = buildDataset(DEV_SEED);

  it("tem as quantidades do desenho: 1.000 séries de 7 dias, 600 legítimas e 400 compradas", () => {
    expect(series).toHaveLength(1000);
    expect(series.filter((item) => item.truth === "organic")).toHaveLength(600);
    for (const spec of TYPES) expect(series.filter((item) => item.type === spec.type)).toHaveLength(spec.count);
    expect(series.every((item) => item.readings.length === 169)).toBe(true);
  });

  it("cada série guarda tipo, verdade, resultado esperado e os parâmetros que a geraram", () => {
    const item = series.find((candidate) => candidate.type === "bought_plateau");
    expect(item).toMatchObject({ group: "bought_typical", truth: "bought", expected: "suspicious" });
    expect(item?.params).toMatchObject({ bot_start: expect.any(Number), bot_level: expect.any(Number), base: expect.any(Number) });
  });

  it("gerar uma série sozinha dá a mesma série do dataset: um tipo não depende dos outros", () => {
    const spec = TYPES.find((candidate) => candidate.type === "multi_timezone");
    if (!spec) throw new Error("tipo ausente");
    expect(generateSeries(DEV_SEED, spec, 17)).toEqual(series.find((item) => item.id === "multi_timezone-018"));
  });

  it("artefatos de coleta: cerca de 10% das séries perdem de 1 a 4 leituras, nunca a primeira nem a última", () => {
    const withGaps = series.filter((item) => item.readings.includes(null));
    expect(withGaps.length).toBeGreaterThan(60);
    expect(withGaps.length).toBeLessThan(140);
    for (const item of withGaps) {
      expect(item.readings.filter((reading) => reading === null).length).toBeLessThanOrEqual(4);
      expect(item.readings[0]).not.toBeNull();
      expect(item.readings.at(-1)).not.toBeNull();
    }
  });

  it("as recontagens dos legítimos ficam sempre abaixo do limite de remoção", () => {
    const recounted = series.filter((item) => item.params.recounts !== undefined);
    expect(recounted.length).toBeGreaterThan(10);
    expect(recounted.every((item) => item.truth === "organic")).toBe(true);
    for (const item of recounted) {
      let highest = 0;
      for (const reading of item.readings) {
        if (reading === null) continue;
        expect(highest - reading).toBeLessThan(100);
        highest = Math.max(highest, reading);
      }
    }
  });

  it("o arquivo volta idêntico depois de lido e escrito de novo", () => {
    expect(serializeDataset(parseDataset(text))).toBe(text);
  });
});
