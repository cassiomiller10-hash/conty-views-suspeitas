import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { METRICS_PATH, TARGETS, clopperPearson, evaluateReport, metricsJson, readmeBlock } from "../src/avaliacao.ts";
import { DATASET_PATH, sha256 } from "../src/dataset.ts";

// Roda a mesma avaliação do `npm run evaluate`, em memória, sem gravar nada.
let report: ReturnType<typeof evaluateReport>;
beforeAll(() => {
  report = evaluateReport();
}, 120_000);

const falsePositiveLine = (block: string | null) => block?.split("\n").find((line) => line.includes("**Falso positivo**")) ?? "(sem o bloco)";

describe("o número do README sai do comando", () => {
  it("regenerar o dataset dá o mesmo arquivo (mesmo hash) que está no repositório", () => {
    const committed = readFileSync(DATASET_PATH, "utf8");
    expect(report.dataset.hash, `data/dataset.jsonl não bate com o gerador. Rode: npm run evaluate`).toBe(sha256(committed));
  });

  it("o bloco do README é idêntico ao que a avaliação gera agora", () => {
    const current = readmeBlock(readFileSync("README.md", "utf8"));
    const message = [
      "O bloco do README diverge do medido.",
      `README:  ${falsePositiveLine(current)}`,
      `Medido:  ${falsePositiveLine(report.block)}`,
      "Rode: npm run evaluate",
    ].join("\n");
    expect(current, message).toBe(report.block);
  });

  it("results/metrics.json é o que a avaliação gera agora", () => {
    expect(readFileSync(METRICS_PATH, "utf8"), "Rode: npm run evaluate").toBe(metricsJson(report.metrics));
  });
});

describe("as metas do desenho valem para o medido", () => {
  it("falso positivo de no máximo 0,5% nos legítimos, com os difíceis incluídos", () => {
    expect(report.metrics.false_positive.rate).toBeLessThanOrEqual(TARGETS.falsePositiveMax);
  });

  it("nenhum falso positivo nos legítimos comuns", () => {
    expect(report.metrics.false_positive_common.count).toBe(TARGETS.falsePositiveCommonMax);
  });

  it("inconclusivo de no máximo 2% nos legítimos comuns", () => {
    expect(report.metrics.inconclusive_common.rate).toBeLessThanOrEqual(TARGETS.inconclusiveCommonMax);
  });

  it("detecção de pelo menos 80% nas compras típicas", () => {
    expect(report.metrics.detection_typical.rate).toBeGreaterThanOrEqual(TARGETS.detectionTypicalMin);
  });
});

describe("intervalo de confiança", () => {
  it("Clopper-Pearson bate com valores conhecidos", () => {
    // 0 de 600: o limite superior de 95% (bilateral) é 1 − 0,025^(1/600).
    expect(clopperPearson(0, 600)[1]).toBeCloseTo(1 - 0.025 ** (1 / 600), 10);
    // 3 de 600: referência calculada à parte, com a soma binomial exata em frações (Python).
    const [low, high] = clopperPearson(3, 600);
    expect(low).toBeCloseTo(0.001032, 5);
    expect(high).toBeCloseTo(0.014542, 5);
  });
});
