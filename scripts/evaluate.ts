// npm run evaluate: gera o dataset da semente do relatório, classifica as 1.000 séries pela mesma
// porta da API, grava data/dataset.jsonl e results/metrics.json e reescreve o bloco do README.
// npm run evaluate -- --dev: só mede a semente de desenvolvimento (a da calibração) e não grava nada.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { METRICS_PATH, evaluateReport, metricsJson, replaceReadmeBlock, runDataset } from "../src/avaliacao.ts";
import { DATASET_PATH, DEV_SEED, buildDataset } from "../src/dataset.ts";
import { TYPES } from "../src/gerador.ts";

const percent = (count: number, total: number) => `${((100 * count) / total).toFixed(2)}% (${count} de ${total})`;

if (process.argv.includes("--dev")) {
  const outcomes = runDataset(buildDataset(DEV_SEED).series);
  console.log(`Semente de desenvolvimento ${DEV_SEED} (calibração; não grava nada)\n`);
  for (const spec of TYPES) {
    const items = outcomes.filter((outcome) => outcome.type === spec.type);
    const count = (classification: string) => items.filter((item) => item.classification === classification).length;
    console.log(`${spec.label.padEnd(42)} sem indícios ${String(count("no_evidence")).padStart(3)}  inconclusivo ${String(count("inconclusive")).padStart(3)}  suspeito ${String(count("suspicious")).padStart(3)}`);
  }
  const legit = outcomes.filter((outcome) => outcome.group.startsWith("legit"));
  const typical = outcomes.filter((outcome) => outcome.group === "bought_typical");
  console.log(`\nFalso positivo: ${percent(legit.filter((item) => item.classification === "suspicious").length, legit.length)}`);
  console.log(`Detecção nas típicas: ${percent(typical.filter((item) => item.classification === "suspicious").length, typical.length)}`);
  process.exit(0);
}

const report = evaluateReport();
mkdirSync(dirname(DATASET_PATH), { recursive: true });
writeFileSync(DATASET_PATH, report.dataset.text);
mkdirSync(dirname(METRICS_PATH), { recursive: true });
writeFileSync(METRICS_PATH, metricsJson(report.metrics));
writeFileSync("README.md", replaceReadmeBlock(readFileSync("README.md", "utf8"), report.block));

const m = report.metrics;
console.log(`Dataset: ${DATASET_PATH} (semente ${m.seed}, sha256 ${m.dataset.sha256})`);
console.log(`Falso positivo: ${percent(m.false_positive.count, m.false_positive.total)}`);
console.log(`Inconclusivo nos legítimos comuns: ${percent(m.inconclusive_common.count, m.inconclusive_common.total)}`);
console.log(`Detecção nas compras típicas: ${percent(m.detection_typical.count, m.detection_typical.total)}`);
console.log(`Gravados: ${DATASET_PATH}, ${METRICS_PATH} e o bloco do README.md`);
