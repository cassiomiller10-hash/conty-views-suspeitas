// Limites documentados no README ("onde pode errar"). Estes testes garantem que o que o README diz
// sobre o comportamento atual é verdade; se o critério mudar, eles mudam junto com o README.

import { describe, expect, it } from "vitest";
import { classify } from "../src/classificador.ts";
import { EXAMPLE_START, algorithmExit, hourAt, smallCreator, twins, withFall } from "../src/exemplos.ts";
import { TYPES, accumulate, generateSeries, organicCounts, plateauCounts } from "../src/gerador.ts";
import { classifyDatasetSeries } from "../src/avaliacao.ts";
import { createRng } from "../src/prng.ts";
import type { HourlySeries } from "../src/serie.ts";

const rounded = (series: HourlySeries, step: number): HourlySeries => ({
  ...series,
  readings: series.readings.map((reading) => (reading === null ? reading : Math.round(reading / step) * step)),
});

describe("onde o critério erra contra o criador", () => {
  it("contagem arredondada pela fonte (total em centenas, como em '1,2 mil'): o viral orgânico sai suspeito", () => {
    const viral = twins().organic;
    expect(classify(viral).classification).toBe("no_evidence");
    const result = classify(rounded(viral, 100));
    // Toda hora vira centena exata, e nas horas fracas a contagem anda de 100 em 100: o corte também dispara.
    expect(result.classification).toBe("suspicious");
    expect(result.families_fired).toEqual(["abrupt_end", "regularity"]);
  });

  it("duas ações da plataforma juntas: saída do algoritmo e limpeza de 2% das views", () => {
    const exit = algorithmExit();
    const at = hourAt(13, 10);
    const result = classify(withFall(exit, at, Math.round(0.02 * (exit.readings[at - 1] as number))));
    expect(result.classification).toBe("suspicious");
    expect(result.families_fired).toEqual(["abrupt_end", "removal"]);
  });

  it("o único falso positivo das 10 sementes da faixa: viral que sobe de madrugada e é cortado de manhã", () => {
    const spec = TYPES.find((candidate) => candidate.type === "algorithm_exit");
    if (!spec) throw new Error("tipo ausente");
    const item = generateSeries(104, spec, 32);
    expect(item.id).toBe("algorithm_exit-033");
    const result = classifyDatasetSeries(item);
    expect(result.classification).toBe("suspicious");
    expect(result.families_fired).toEqual(["abrupt_end", "awake_at_night"]);
    expect(result.reason).toContain("A queda das 9h");
  });
});

describe("onde o critério deixa compra passar", () => {
  const dripShare = (share: number) => {
    const organic = organicCounts(createRng(5), EXAMPLE_START, {
      base: 40,
      audiences: [{ offset: -3, weight: 1 }],
      depth: 0.75,
      shift: 0,
      growth: 1,
      weekend: 1,
      dispersion: 20,
      drift: 0.05,
    });
    const mean = organic.reduce((a, b) => a + b, 0) / organic.length;
    const bot = plateauCounts(createRng(6), 0, 168, (mean * share) / (1 - share), 0.005);
    return classify({ startMs: EXAMPLE_START, readings: accumulate(5_000, organic.map((views, hour) => views + (bot[hour] as number))) });
  };

  it("gotejamento que é 70% das views passa sem indícios; 90% fica inconclusivo; 98% é acusado", () => {
    expect(dripShare(0.7).classification).toBe("no_evidence");
    expect(dripShare(0.9)).toMatchObject({ classification: "inconclusive", families_fired: ["awake_at_night"] });
    expect(dripShare(0.98).classification).toBe("suspicious");
  });
});

describe("onde o critério aguenta", () => {
  it("madrugada preenchida em linha reta pelo coletor, toda noite, não acusa um criador comum", () => {
    const base = smallCreator();
    const readings = [...base.readings];
    for (let day = 0; day < 7; day++) {
      const from = day * 24 + 1;
      const to = day * 24 + 8;
      for (let index = from + 1; index < to; index++) {
        readings[index] = Math.round((readings[from] as number) + (((readings[to] as number) - (readings[from] as number)) * (index - from)) / (to - from));
      }
    }
    expect(classify({ ...base, readings }).classification).toBe("no_evidence");
  });
});
