import { describe, expect, it } from "vitest";
import { classify } from "../src/classificador.ts";
import { algorithmExit, requestBody, smallCreator, withoutReadings } from "../src/exemplos.ts";
import { get, post } from "./helpers.ts";

const points = (count: number, start = Date.UTC(2026, 2, 8, 3)) =>
  Array.from({ length: count }, (_, index) => ({ at: new Date(start + index * 3_600_000).toISOString(), cumulative_views: 1_000 + index * 50 }));

describe("POST /classify", () => {
  it("devolve classificação, motivo, sinais, regra e versão do critério", async () => {
    const res = await post("/classify", requestBody(algorithmExit()));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      classification: "inconclusive",
      rule: "suspeito exige duas famílias de sinais; com uma, inconclusivo",
      criteria_version: "v1",
      families_fired: ["abrupt_end"],
      audience_timezone: "America/Sao_Paulo",
    });
    expect(res.body.reason).toContain("Um indício isolado não basta para acusar.");
    expect(res.body.analyzed_window).toMatchObject({ start: "2026-03-10T19:00:00-03:00", kind: "peak" });
    expect(res.body.data_quality).toMatchObject({ hours: 168, missing_readings: 0, nonzero_readings: 169 });
    expect(res.body.signals.map((item: { signal: string }) => item.signal)).toEqual(["abrupt_end", "awake_at_night", "low_variation", "round_counts", "removal"]);
    for (const item of res.body.signals) {
      expect(Object.keys(item)).toEqual(expect.arrayContaining(["family", "evaluable", "fired", "value", "threshold", "fires_when", "explanation"]));
    }
  });

  it("a API chama a mesma função que a avaliação: mesma resposta", async () => {
    const res = await post("/classify", requestBody(algorithmExit()));
    expect(res.body).toEqual(JSON.parse(JSON.stringify(classify(algorithmExit()))));
  });

  it("o fuso do público só muda as horas escritas, nunca a classificação nem os valores", async () => {
    const saoPaulo = await post("/classify", requestBody(algorithmExit()));
    const lisbon = await post("/classify", requestBody(algorithmExit(), { audience_timezone: "Europe/Lisbon" }));
    expect(lisbon.body.classification).toBe(saoPaulo.body.classification);
    expect(lisbon.body.signals.map((item: { value: number }) => item.value)).toEqual(saoPaulo.body.signals.map((item: { value: number }) => item.value));
    expect(lisbon.body.analyzed_window.start).toBe("2026-03-10T22:00:00+00:00");
    expect(lisbon.body.reason).not.toBe(saoPaulo.body.reason);
  });

  it("aceita horário até 10 minutos fora da hora cheia e encaixa na hora", async () => {
    const body = { series: points(60).map((point, index) => (index === 10 ? { ...point, at: point.at.replace(":00:00.000Z", ":07:00Z") } : point)) };
    const res = await post("/classify", body);
    expect(res.status).toBe(200);
    expect(res.body.data_quality.missing_readings).toBe(0);
  });

  it("?hourly=true devolve as views de cada hora, com as horas de buraco marcadas como estimadas", async () => {
    const res = await post("/classify?hourly=true", requestBody(withoutReadings(smallCreator(), [30])));
    expect(res.body.hourly).toHaveLength(168);
    expect(res.body.hourly[29]).toMatchObject({ start: "2026-03-09T05:00:00-03:00", status: "estimated" });
    expect(res.body.hourly[31].status).toBe("measured");
  });
});

describe("POST /classify recusa série mal formada com 422, dizendo o campo", () => {
  const cases: Array<[string, unknown, string, RegExp]> = [
    ["horário sem fuso", { series: [{ at: "2026-03-08T00:00:00", cumulative_views: 10 }, ...points(50).slice(1)] }, "series[0].at", /não tem fuso/],
    ["horário repetido", { series: [...points(3), points(3)[2]] }, "series[3].at", /mesma hora cheia/],
    ["fora de ordem", { series: [points(3)[1], points(3)[0]] }, "series[1].at", /ordem crescente/],
    ["valor negativo", { series: [{ ...points(1)[0], cumulative_views: -5 }] }, "series[0].cumulative_views", /maior ou igual a zero/],
    ["valor fracionado", { series: [{ ...points(1)[0], cumulative_views: 10.5 }] }, "series[0].cumulative_views", /inteiro/],
    ["fora da hora cheia", { series: [{ at: "2026-03-08T14:30:00-03:00", cumulative_views: 10 }] }, "series[0].at", /mais de 10 minutos/],
    ["data que não existe", { series: [{ at: "2026-02-30T14:00:00-03:00", cumulative_views: 10 }] }, "series[0].at", /não é uma data válida/],
    ["fuso do público inválido", { series: points(60), audience_timezone: "Marte/Olimpo" }, "audience_timezone", /fuso IANA/],
    ["mais de 30 dias", { series: [points(1)[0], { at: new Date(Date.UTC(2026, 3, 9, 3)).toISOString(), cumulative_views: 2_000 }] }, "series", /máximo é 30 dias/],
    ["série vazia", { series: [] }, "series", /lista de leituras/],
    ["sem o campo series", { pontos: [] }, "series", /lista de leituras/],
  ];

  it.each(cases)("%s", async (_, body, field, message) => {
    const res = await post("/classify", body);
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "invalid_series", field });
    expect(res.body.message).toMatch(message);
  });

  it("corpo que não é JSON volta 400", async () => {
    const res = await post("/classify", "{series:", true);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_json");
  });
});

describe("GET /criteria", () => {
  it("publica a regra e os limites em vigor", async () => {
    const res = await get("/criteria");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      criteria_version: "v1",
      families: ["abrupt_end", "awake_at_night", "regularity", "removal"],
      limits: { abruptDrop: 0.7, awakeShare: 0.8, lowVariation: 0.35, roundShare: 0.4, removalShare: 0.01, removalMinViews: 100, minHours: 48 },
    });
  });
});
