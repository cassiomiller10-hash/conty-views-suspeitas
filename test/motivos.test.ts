import { describe, expect, it } from "vitest";
import { classify } from "../src/classificador.ts";
import { DEV_SEED, buildDataset } from "../src/dataset.ts";
import { classifyDatasetSeries } from "../src/avaliacao.ts";
import {
  algorithmExit,
  bigAccountMention,
  exactDrip,
  firstHours,
  lisbonViral,
  multiTimezoneCut,
  organicViral,
  smallCreator,
  twins,
  withFall,
  withoutReadings,
} from "../src/exemplos.ts";

// Nomes do código que não podem aparecer no motivo.
const CODE_WORDS = [
  "abrupt_end",
  "awake_at_night",
  "regularity",
  "removal",
  "low_variation",
  "round_counts",
  "no_evidence",
  "inconclusive",
  "suspicious",
  "cumulative_views",
  "threshold",
  "fired",
  "value",
  "null",
  "undefined",
  "NaN",
  "Infinity",
];

// Toda quantidade vem com unidade: %, h, views, horas, vezes, dias; ou é um dia do mês ("dia 12").
// Um número pode vir encadeado a outro antes da unidade: "22 de 30 horas", "500 ou 1.200 views",
// "de 2.300 para 440 views por hora". A cadeia precisa terminar numa unidade.
const NUMBER = /\d[\d.,]*/g;
const UNIT_AFTER = /^(?:(?: de | ou | a | e | para )(?:cerca de )?\d[\d.,]*)*(?:%|h\b|h\d|\s+(?:views?|horas?|vezes|dias?|minutos)\b)/;
const DAY_BEFORE = /dia\s$/;

function unitlessNumbers(reason: string): string[] {
  const problems: string[] = [];
  for (const match of reason.matchAll(NUMBER)) {
    const index = match.index ?? 0;
    const before = reason.slice(Math.max(0, index - 4), index);
    const after = reason.slice(index + match[0].length);
    if (DAY_BEFORE.test(before) || UNIT_AFTER.test(after)) continue;
    problems.push(`"${reason.slice(Math.max(0, index - 20), index + match[0].length + 20)}"`);
  }
  return problems;
}

const EXAMPLES: Array<[string, () => ReturnType<typeof classify>]> = [
  ["criador pequeno", () => classify(smallCreator())],
  ["gotejamento exato", () => classify(exactDrip())],
  ["gêmeo orgânico", () => classify(twins().organic)],
  ["gêmeo comprado", () => classify(twins().bought)],
  ["viral com 100 vezes mais público", () => classify(organicViral(100))],
  ["menção de conta grande", () => classify(bigAccountMention())],
  ["saída do algoritmo", () => classify(algorithmExit())],
  ["vários fusos com corte", () => classify(multiTimezoneCut())],
  ["público em Lisboa", () => classify(lisbonViral())],
  ["horas faltando", () => classify(withoutReadings(smallCreator(), [30, 31, 75, 120]))],
  ["remoção", () => classify(withFall(smallCreator(), 90, 400))],
  ["série curta", () => classify(firstHours(smallCreator(), 30))],
];

describe("o motivo dá para ler sem conhecer o código", () => {
  it.each(EXAMPLES)("%s: sem nomes do código e sem número solto", (_, run) => {
    const reason = run().reason;
    for (const word of CODE_WORDS) expect(reason, `o motivo cita "${word}": ${reason}`).not.toContain(word);
    expect(reason).not.toContain("_");
    expect(unitlessNumbers(reason), reason).toEqual([]);
  });

  it("vale também para as 1.000 séries da semente de desenvolvimento", () => {
    const problems = buildDataset(DEV_SEED).series.flatMap((item) => {
      const reason = classifyDatasetSeries(item).reason;
      const words = CODE_WORDS.filter((word) => reason.includes(word));
      const numbers = unitlessNumbers(reason);
      return words.length || numbers.length || reason.includes("_") ? [`${item.id}: ${[...words, ...numbers].join(", ")}`] : [];
    });
    expect(problems).toEqual([]);
  });

  it("o detector de número solto pega o que deve pegar", () => {
    expect(unitlessNumbers("O volume caiu 81% em duas horas, às 16h do dia 12, de 2.300 para 440 views por hora.")).toEqual([]);
    expect(unitlessNumbers("Em 22 de 30 horas com mais de 200 views (como 500 ou 1.200 views).")).toEqual([]);
    expect(unitlessNumbers("O valor ficou em 0,81 acima do limite 0,70.")).toHaveLength(2);
    expect(unitlessNumbers("Três sinais concordam, contagem 4.")).toHaveLength(1);
    expect(unitlessNumbers("A queda passou do limite de 35 em duas horas.")).toHaveLength(1);
    expect(unitlessNumbers("Foi de cerca de 2.300 para 440 views por hora.")).toEqual([]);
  });
});
