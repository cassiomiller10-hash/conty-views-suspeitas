// Avaliação: classifica o dataset pela mesma porta da API (corpo do POST /classify → validação →
// classificador) e monta as métricas e o bloco do README. Nada aqui é digitado à mão: o bloco é
// texto gerado a partir das métricas, e o teste compara o README com o que seria gerado agora.

import { type ClassifyResult, classify } from "./classificador.ts";
import { CRITERIA_VERSION, type Classification, type Family, RULE, applyRule } from "./criterios.ts";
import { DATASET_PATH, RANGE_SEEDS, REPORT_SEED, buildDataset, toRequestBody } from "./dataset.ts";
import { algorithmExit, twins } from "./exemplos.ts";
import { type Expected, type GeneratedSeries, type Group, SERIES_HOURS, TYPES } from "./gerador.ts";
import { parseClassifyRequest } from "./serie.ts";

/** Metas do desenho (DECISOES.md, seção 2, item 7). */
export const TARGETS = {
  falsePositiveMax: 0.005,
  falsePositiveCommonMax: 0,
  inconclusiveCommonMax: 0.02,
  detectionTypicalMin: 0.8,
} as const;

export const README_BEGIN = "<!-- evaluate:begin -->";
export const README_END = "<!-- evaluate:end -->";
export const METRICS_PATH = "results/metrics.json";

export type Outcome = {
  id: string;
  type: string;
  group: Group;
  expected: Expected;
  classification: Classification;
  families: Family[];
  insufficient: boolean;
};

export function classifyDatasetSeries(item: GeneratedSeries): ClassifyResult {
  const request = parseClassifyRequest(toRequestBody(item));
  return classify(request.series, request.audienceTimezone);
}

export function runDataset(series: GeneratedSeries[]): Outcome[] {
  return series.map((item) => {
    const result = classifyDatasetSeries(item);
    return {
      id: item.id,
      type: item.type,
      group: item.group,
      expected: item.expected,
      classification: result.classification,
      families: result.families_fired,
      insufficient: result.insufficient_data.length > 0,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Contagens

export type Rate = { count: number; total: number; rate: number };

function rate(count: number, total: number): Rate {
  return { count, total, rate: total === 0 ? 0 : count / total };
}

/** Classificação de uma série sob outra regra: mesmos sinais, outro número de famílias para acusar. */
function reclassify(outcome: Outcome, minimumToAccuse: number): Classification {
  return outcome.insufficient ? "inconclusive" : applyRule(outcome.families.length, minimumToAccuse);
}

function headline(outcomes: Outcome[], minimumToAccuse = 2) {
  const of = (groups: Group[]) => outcomes.filter((outcome) => groups.includes(outcome.group));
  const count = (items: Outcome[], classification: Classification) => items.filter((item) => reclassify(item, minimumToAccuse) === classification).length;
  const legit = of(["legit_common", "legit_hard"]);
  const common = of(["legit_common"]);
  const hard = of(["legit_hard"]);
  const typical = of(["bought_typical"]);
  const disguised = of(["bought_disguised"]);
  return {
    false_positive: rate(count(legit, "suspicious"), legit.length),
    false_positive_common: rate(count(common, "suspicious"), common.length),
    false_positive_hard: rate(count(hard, "suspicious"), hard.length),
    inconclusive_common: rate(count(common, "inconclusive"), common.length),
    inconclusive_hard: rate(count(hard, "inconclusive"), hard.length),
    detection_typical: rate(count(typical, "suspicious"), typical.length),
    detection_disguised: rate(count(disguised, "suspicious"), disguised.length),
  };
}

// ---------------------------------------------------------------------------------------------
// Intervalo de confiança exato (Clopper-Pearson) para uma proporção

function binomialCdf(k: number, n: number, p: number): number {
  if (k < 0) return 0;
  if (k >= n || p <= 0) return 1;
  if (p >= 1) return 0;
  let logTerm = n * Math.log(1 - p);
  let sum = Math.exp(logTerm);
  for (let i = 1; i <= k; i++) {
    logTerm += Math.log((n - i + 1) / i) + Math.log(p / (1 - p));
    sum += Math.exp(logTerm);
  }
  return Math.min(1, sum);
}

/** Bissecção: o p em [0, 1] em que a função crescente `f` vale `target`. */
function solveIncreasing(f: (p: number) => number, target: number): number {
  let low = 0;
  let high = 1;
  for (let step = 0; step < 100; step++) {
    const middle = (low + high) / 2;
    if (f(middle) < target) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export function clopperPearson(count: number, total: number, confidence = 0.95): [number, number] {
  const tail = (1 - confidence) / 2;
  const lower = count === 0 ? 0 : solveIncreasing((p) => 1 - binomialCdf(count - 1, total, p), tail);
  const upper = count === total ? 1 : solveIncreasing((p) => 1 - binomialCdf(count, total, p), 1 - tail);
  return [lower, upper];
}

// ---------------------------------------------------------------------------------------------
// Relatório

export function buildMetrics(seed: number, datasetHash: string, outcomes: Outcome[], rangeOutcomes: Map<number, Outcome[]>) {
  const main = headline(outcomes);
  const byType = TYPES.map((spec) => {
    const items = outcomes.filter((outcome) => outcome.type === spec.type);
    const count = (classification: Classification) => items.filter((item) => item.classification === classification).length;
    return {
      type: spec.type,
      label: spec.label,
      group: spec.group,
      expected: spec.expected,
      series: items.length,
      no_evidence: count("no_evidence"),
      inconclusive: count("inconclusive"),
      suspicious: count("suspicious"),
    };
  });
  const alternatives = [1, 2, 3].map((minimum) => ({ families_to_accuse: minimum, ...headline(outcomes, minimum) }));
  const perSeed = [...rangeOutcomes.entries()].map(([rangeSeed, items]) => ({ seed: rangeSeed, ...headline(items) }));
  const span = (pick: (row: (typeof perSeed)[number]) => Rate) => ({
    min: Math.min(...perSeed.map((row) => pick(row).rate)),
    max: Math.max(...perSeed.map((row) => pick(row).rate)),
    total: rate(
      perSeed.reduce((sum, row) => sum + pick(row).count, 0),
      perSeed.reduce((sum, row) => sum + pick(row).total, 0),
    ),
  });
  const twin = twins();
  const exit = algorithmExit();
  return {
    criteria_version: CRITERIA_VERSION,
    rule: RULE,
    seed,
    dataset: { path: DATASET_PATH, series: outcomes.length, hours_per_series: SERIES_HOURS, sha256: datasetHash },
    targets: TARGETS,
    ...main,
    false_positive_ci95: clopperPearson(main.false_positive.count, main.false_positive.total),
    by_type: byType,
    alternatives,
    seeds_range: {
      seeds: perSeed.map((row) => row.seed),
      false_positive: span((row) => row.false_positive),
      inconclusive_common: span((row) => row.inconclusive_common),
      detection_typical: span((row) => row.detection_typical),
      detection_disguised: span((row) => row.detection_disguised),
    },
    examples: {
      organic_twin: classify(twin.organic),
      bought_twin: classify(twin.bought),
      algorithm_exit: classify(exit),
    },
    outcomes: outcomes.map(({ id, classification, families }) => ({ id, classification, families })),
  };
}

export type Metrics = ReturnType<typeof buildMetrics>;

/** Gera o dataset da semente do relatório, mede, e mede também as 10 sementes da faixa. */
export function evaluateReport() {
  const dataset = buildDataset(REPORT_SEED);
  const outcomes = runDataset(dataset.series);
  const range = new Map(RANGE_SEEDS.map((seed) => [seed, runDataset(buildDataset(seed).series)] as const));
  const metrics = buildMetrics(REPORT_SEED, dataset.hash, outcomes, range);
  return { dataset, metrics, block: renderBlock(metrics) };
}

// ---------------------------------------------------------------------------------------------
// Bloco do README

const decimal = (digits: number) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const percent = (value: number, digits = 1) => `${decimal(digits).format(value * 100)}%`;
const integer = (value: number) => decimal(0).format(value);
const ofTotal = (value: Rate, digits = 1) => `${percent(value.rate, digits)} (${integer(value.count)} de ${integer(value.total)})`;

const GROUP_LABEL: Record<Group, string> = {
  legit_common: "Legítimo comum",
  legit_hard: "Legítimo difícil",
  bought_typical: "Compra típica",
  bought_disguised: "Compra disfarçada",
};

const EXPECTED_LABEL: Record<Expected, string> = {
  no_evidence: "sem indícios",
  inconclusive: "inconclusivo",
  no_evidence_or_inconclusive: "sem indícios ou inconclusivo",
  suspicious: "suspeito",
  escapes: "escapa (documentado)",
};

const CLASS_LABEL: Record<Classification, string> = { no_evidence: "sem indícios", inconclusive: "inconclusivo", suspicious: "suspeito" };

export function renderBlock(metrics: Metrics): string {
  const [low, high] = metrics.false_positive_ci95;
  const range = metrics.seeds_range;
  const lines = [
    README_BEGIN,
    "<!-- Gerado por `npm run evaluate`. Não edite à mão: test/avaliacao.test.ts falha se este bloco divergir do medido. -->",
    "",
    `Medido no dataset da semente **${metrics.seed}** (\`${metrics.dataset.path}\`, ${integer(metrics.dataset.series)} séries de ${metrics.dataset.hours_per_series} horas, sha256 \`${metrics.dataset.sha256.slice(0, 16)}…\`), critério **${metrics.criteria_version}**.`,
    "",
    "| | Medido | Meta |",
    "|---|---|---|",
    `| **Falso positivo** (legítimo classificado como suspeito) | **${ofTotal(metrics.false_positive, 2)}**; intervalo de 95%: ${percent(low, 2)} a ${percent(high, 2)} | até ${percent(TARGETS.falsePositiveMax)} |`,
    `| Falso positivo nos legítimos comuns | ${integer(metrics.false_positive_common.count)} de ${integer(metrics.false_positive_common.total)} | zero |`,
    `| Falso positivo nos legítimos difíceis | ${integer(metrics.false_positive_hard.count)} de ${integer(metrics.false_positive_hard.total)} | entra no total acima |`,
    `| Inconclusivo nos legítimos comuns | ${ofTotal(metrics.inconclusive_common)} | até ${percent(TARGETS.inconclusiveCommonMax, 0)} |`,
    `| Inconclusivo nos legítimos difíceis | ${ofTotal(metrics.inconclusive_hard)} | esperado: é o custo da cautela |`,
    `| Detecção nas compras típicas | ${ofTotal(metrics.detection_typical)} | pelo menos ${percent(TARGETS.detectionTypicalMin, 0)} |`,
    `| Detecção nas compras disfarçadas | ${ofTotal(metrics.detection_disguised)} | nenhuma: o critério não as pega |`,
    "",
    "**Por tipo de série**",
    "",
    "| Grupo | Tipo | Séries | Sem indícios | Inconclusivo | Suspeito | Esperado |",
    "|---|---|---:|---:|---:|---:|---|",
    ...metrics.by_type.map(
      (row) =>
        `| ${GROUP_LABEL[row.group]} | ${row.label} | ${row.series} | ${row.no_evidence} | ${row.inconclusive} | ${row.suspicious} | ${EXPECTED_LABEL[row.expected]} |`,
    ),
    "",
    "**Regras alternativas** (os mesmos sinais; muda só quantas famílias precisam concordar para acusar)",
    "",
    "| Regra | Falso positivo | Inconclusivo nos comuns | Detecção nas típicas | Detecção nas disfarçadas |",
    "|---|---|---|---|---|",
    ...metrics.alternatives.map(
      (row) =>
        `| ${row.families_to_accuse === 1 ? "Uma família basta" : row.families_to_accuse === 2 ? "**Duas famílias (v1, a adotada)**" : "Três famílias"} | ${ofTotal(row.false_positive, 2)} | ${ofTotal(row.inconclusive_common)} | ${ofTotal(row.detection_typical)} | ${ofTotal(row.detection_disguised)} |`,
    ),
    "",
    `**Variação entre sementes** (${range.seeds.length} sementes, de ${range.seeds[0]} a ${range.seeds.at(-1)}, também fora da calibração)`,
    "",
    "| | Menor | Maior | Somando as sementes |",
    "|---|---|---|---|",
    `| Falso positivo | ${percent(range.false_positive.min, 2)} | ${percent(range.false_positive.max, 2)} | ${ofTotal(range.false_positive.total, 2)} |`,
    `| Inconclusivo nos legítimos comuns | ${percent(range.inconclusive_common.min)} | ${percent(range.inconclusive_common.max)} | ${ofTotal(range.inconclusive_common.total)} |`,
    `| Detecção nas compras típicas | ${percent(range.detection_typical.min)} | ${percent(range.detection_typical.max)} | ${ofTotal(range.detection_typical.total)} |`,
    `| Detecção nas compras disfarçadas | ${percent(range.detection_disguised.min)} | ${percent(range.detection_disguised.max)} | ${ofTotal(range.detection_disguised.total)} |`,
    "",
    "**Motivos dos exemplos** (`src/exemplos.ts`, os mesmos dos testes)",
    "",
    `- **Viral orgânico (gêmeo):** ${CLASS_LABEL[metrics.examples.organic_twin.classification]}. "${metrics.examples.organic_twin.reason}"`,
    `- **Platô comprado (gêmeo, mesma subida, mesma altura e mesmo total):** ${CLASS_LABEL[metrics.examples.bought_twin.classification]}. "${metrics.examples.bought_twin.reason}"`,
    `- **Saída do algoritmo (o caso em que o classificador prefere não acusar):** ${CLASS_LABEL[metrics.examples.algorithm_exit.classification]}. "${metrics.examples.algorithm_exit.reason}"`,
    "",
    "<details><summary>Resposta completa da API para a saída do algoritmo</summary>",
    "",
    "```json",
    JSON.stringify(metrics.examples.algorithm_exit, null, 2),
    "```",
    "",
    "</details>",
    README_END,
  ];
  return lines.join("\n");
}

export function readmeBlock(readme: string): string | null {
  const begin = readme.indexOf(README_BEGIN);
  const end = readme.indexOf(README_END);
  if (begin < 0 || end < begin) return null;
  return readme.slice(begin, end + README_END.length);
}

export function replaceReadmeBlock(readme: string, block: string): string {
  const current = readmeBlock(readme);
  if (current === null) throw new Error(`O README precisa dos marcadores ${README_BEGIN} e ${README_END}.`);
  return readme.replace(current, () => block);
}

/** O JSON gravado em results/metrics.json. */
export function metricsJson(metrics: Metrics): string {
  return `${JSON.stringify(metrics, null, 2)}\n`;
}
