import { describe, expect, it } from "vitest";
import { classify } from "../src/classificador.ts";
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
import { deriveHours } from "../src/serie.ts";

const signal = (result: ReturnType<typeof classify>, name: string) => result.signals.find((item) => item.signal === name);
const total = (series: ReturnType<typeof smallCreator>) => deriveHours(series).views.reduce((a, b) => a + b, 0);

describe("casos óbvios", () => {
  it("criador pequeno com ciclo diário sai sem indícios", () => {
    const result = classify(smallCreator());
    expect(result.classification).toBe("no_evidence");
    expect(result.families_fired).toEqual([]);
  });

  it("gotejamento exato, dia e noite, sai suspeito pela madrugada e pela regularidade", () => {
    const result = classify(exactDrip());
    expect(result.classification).toBe("suspicious");
    expect(result.families_fired).toEqual(["awake_at_night", "regularity"]);
    // 1.000 views exatas por hora são "regular demais" e "centena exata", mas a família conta uma vez.
    expect(signal(result, "low_variation")?.fired).toBe(true);
    expect(signal(result, "round_counts")?.fired).toBe(true);
  });
});

describe("gêmeos: um pico orgânico e um comprado não caem no mesmo balde", () => {
  const pair = twins();
  const organic = classify(pair.organic);
  const bought = classify(pair.bought);

  it("os dois têm a mesma subida, a mesma altura e o mesmo total de views", () => {
    const organicHours = deriveHours(pair.organic).views;
    const boughtHours = deriveHours(pair.bought).views;
    expect(total(pair.bought)).toBe(total(pair.organic));
    expect(Math.abs(Math.max(...boughtHours) - Math.max(...organicHours)) / Math.max(...organicHours)).toBeLessThan(0.05);
    const firstHigh = (views: number[]) => views.findIndex((value) => value > 300);
    expect(firstHigh(boughtHours)).toBe(firstHigh(organicHours));
    expect(firstHigh(organicHours)).toBe(pair.startHour + 1);
  });

  it("o orgânico sai sem indícios e o comprado, suspeito", () => {
    expect(organic.classification).toBe("no_evidence");
    expect(bought.classification).toBe("suspicious");
  });

  it("a diferença está no fim, na madrugada e na variação, nunca no tamanho", () => {
    const fired = (result: typeof organic) => new Set(result.signals.filter((item) => item.fired).map((item) => item.family));
    const differ = [...new Set([...fired(organic), ...fired(bought)])].filter((family) => fired(organic).has(family) !== fired(bought).has(family));
    expect(differ.sort()).toEqual(["abrupt_end", "awake_at_night", "regularity"]);
    // A altura entra só como contexto, e é a mesma nos dois.
    expect(organic.signals.map((item) => item.family)).toEqual(bought.signals.map((item) => item.family));
    expect(organic.signals.some((item) => /peak|height|total|volume/.test(item.signal))).toBe(false);
    expect(Math.abs((organic.context?.peak_views_per_hour ?? 0) - (bought.context?.peak_views_per_hour ?? 0))).toBeLessThan(60);
  });
});

describe("picos legítimos continuam sem indícios", () => {
  it("o mesmo viral com 100 vezes mais público", () => {
    const result = classify(organicViral(100));
    expect(total(organicViral(100))).toBeGreaterThan(90 * total(organicViral(1)));
    expect(result.classification).toBe("no_evidence");
  });

  it("menção de conta grande, com subida em degrau: a subida aparece no motivo, mas não conta", () => {
    const result = classify(bigAccountMention());
    expect(result.classification).toBe("no_evidence");
    expect(result.context?.step_rise).toBe(true);
    expect(result.reason).toContain("subida não é sinal");
  });
});

describe("o caso em que o classificador prefere não acusar", () => {
  it("saída do algoritmo: inconclusivo, com só o corte disparado", () => {
    const result = classify(algorithmExit());
    expect(result.classification).toBe("inconclusive");
    expect(result.families_fired).toEqual(["abrupt_end"]);
    expect(result.reason).toContain("Um indício isolado não basta para acusar.");
  });

  it("público em vários fusos com corte não vira suspeito, porque a madrugada fica não avaliável", () => {
    const result = classify(multiTimezoneCut());
    expect(result.classification).not.toBe("suspicious");
    expect(result.families_fired).toEqual(["abrupt_end"]);
    expect(signal(result, "awake_at_night")).toMatchObject({ evaluable: false, fired: false, value: null });
    expect(result.reason).toContain("Não dá para avaliar a madrugada");
  });

  it("viral com público em Lisboa, sem informar o fuso, continua sem indícios: a madrugada vem da série", () => {
    expect(classify(lisbonViral()).classification).toBe("no_evidence");
    // O fuso só muda as horas escritas no motivo.
    const lisbon = classify(lisbonViral(), "Europe/Lisbon");
    expect(lisbon.classification).toBe("no_evidence");
    expect(lisbon.signals.map((item) => item.value)).toEqual(classify(lisbonViral()).signals.map((item) => item.value));
  });
});

describe("queda que volta no dia seguinte não é corte", () => {
  it("uma pane de 3 horas que derruba o volume em 90% e passa no mesmo dia não dispara o corte", () => {
    const base = smallCreator();
    const hourly = deriveHours(base).views;
    const dip = hourly.map((views, hour) => (hour >= 63 && hour <= 65 ? Math.round(views * 0.1) : views));
    const readings = [base.readings[0] as number];
    for (const views of dip) readings.push((readings.at(-1) as number) + views);
    const result = classify({ ...base, readings });
    expect(signal(result, "abrupt_end")).toMatchObject({ fired: false });
    expect(signal(result, "abrupt_end")?.explanation).toMatch(/Houve uma queda de \d+% às 15h do dia 10, mas no dia seguinte o volume voltou\./);
    expect(result.classification).toBe("no_evidence");
  });
});

describe("artefatos de coleta", () => {
  const missing = [30, 31, 75, 120];

  it("série orgânica com 4 horas faltando não dispara regularidade", () => {
    const result = classify(withoutReadings(smallCreator(), missing));
    expect(result.data_quality.missing_readings).toBe(4);
    expect(signal(result, "low_variation")?.fired).toBe(false);
    expect(result.classification).toBe("no_evidence");
  });

  it("o buraco não é preenchido para os sinais: o volume é dividido só para exibição", () => {
    const series = withoutReadings(smallCreator(), [30, 31]);
    const hours = deriveHours(series);
    expect(hours.status.slice(29, 32)).toEqual(["estimated", "estimated", "estimated"]);
    expect(hours.usable.slice(29, 32)).toEqual([false, false, false]);
    // O volume do buraco não se perde.
    expect(total(series)).toBe(total(smallCreator()));
  });

  it("recontagem de −3 views não dispara remoção", () => {
    const result = classify(withFall(smallCreator(), 90, 3));
    expect(result.data_quality.drop_hours).toBe(1);
    expect(signal(result, "removal")).toMatchObject({ fired: false });
    expect(signal(result, "removal")?.explanation).toBe("O total acumulado só teve recontagens pequenas, de até 3 views, tratadas como ruído.");
    expect(result.classification).toBe("no_evidence");
  });

  it("queda de 5% do total dispara remoção", () => {
    const base = smallCreator();
    const result = classify(withFall(base, 90, Math.round(0.05 * (base.readings[89] as number))));
    expect(signal(result, "removal")).toMatchObject({ fired: true, value: 0.05 });
    expect(result.families_fired).toEqual(["removal"]);
    expect(result.classification).toBe("inconclusive");
  });
});

describe("dados insuficientes", () => {
  it("série de 30 horas sai inconclusiva, dizendo o que falta", () => {
    const result = classify(firstHours(smallCreator(), 30));
    expect(result.classification).toBe("inconclusive");
    expect(result.signals).toEqual([]);
    expect(result.insufficient_data).toEqual(["a série cobre 30 horas, e são necessárias pelo menos 48 horas para comparar um dia com o outro"]);
    expect(result.reason).toMatch(/^Dados insuficientes para avaliar: a série cobre 30 horas/);
  });

  it("mais de 10% das horas sem leitura", () => {
    const indexes = Array.from({ length: 18 }, (_, index) => 5 + index * 9);
    const result = classify(withoutReadings(smallCreator(), indexes));
    expect(result.classification).toBe("inconclusive");
    expect(result.insufficient_data[0]).toContain("faltam leituras em 18 de 168 horas");
  });

  it("buraco maior que 6 horas", () => {
    const result = classify(withoutReadings(smallCreator(), [40, 41, 42, 43, 44, 45, 46]));
    expect(result.classification).toBe("inconclusive");
    expect(result.insufficient_data[0]).toContain("há um buraco de 7 horas sem leitura");
  });

  it("total arredondado pela fonte: dados insuficientes, dizendo o que falta", () => {
    const base = smallCreator();
    const result = classify({ ...base, readings: base.readings.map((reading) => (reading === null ? reading : Math.round(reading / 100) * 100)) });
    expect(result.classification).toBe("inconclusive");
    expect(result.data_quality).toMatchObject({ nonzero_readings: 169, round_readings: 169 });
    expect(result.insufficient_data).toEqual([
      "o total parece arredondado pela fonte (em 169 de 169 leituras, ele é uma centena exata, o que com contagem exata acontece em cerca de 1% das leituras)",
    ]);
    expect(result.reason).toContain("Envie leituras exatas, medidas de hora em hora, sem arredondamento nem preenchimento");
  });

  it("vídeo que passa a semana com o total em zero não é confundido com total arredondado", () => {
    // Zero é centena exata, mas não diz nada sobre arredondamento: só leituras acima de zero contam.
    const readings = Array.from({ length: 169 }, (_, index) => (index < 160 ? 0 : (index - 159) * 7));
    const result = classify({ startMs: Date.UTC(2026, 2, 8, 3), readings });
    expect(result.data_quality).toMatchObject({ nonzero_readings: 9, round_readings: 0 });
    expect(result.insufficient_data).toEqual([]);
  });

  it("buraco de 6 horas ainda é aceito", () => {
    expect(classify(withoutReadings(smallCreator(), [40, 41, 42, 43, 44, 45])).insufficient_data).toEqual([]);
  });
});
