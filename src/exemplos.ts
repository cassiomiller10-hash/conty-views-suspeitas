// Séries fixas dos testes e do README. Usam as mesmas peças do gerador do dataset, com parâmetros
// escolhidos à mão para cada caso, e sementes fixas: são sempre as mesmas séries.

import { type OrganicModel, SERIES_HOURS, accumulate, exitFactor, organicCounts, stepShape, viralShape } from "./gerador.ts";
import { createRng } from "./prng.ts";
import { HOUR_MS, type HourlySeries } from "./serie.ts";

/** Domingo, 8 de março de 2026, 0h em São Paulo. As séries cobrem os dias 8 a 14. */
export const EXAMPLE_START = Date.UTC(2026, 2, 8, 3);

/** Hora da série que corresponde ao dia e à hora em São Paulo (dia 8 a 14). */
export function hourAt(day: number, hour: number): number {
  return (day - 8) * 24 + hour;
}

const CREATOR: OrganicModel = {
  base: 20,
  audiences: [{ offset: -3, weight: 1 }],
  depth: 0.75,
  shift: 0,
  growth: 1,
  weekend: 1,
  dispersion: 20,
  drift: 0.05,
};

function series(hourly: number[], initial = 5_000): HourlySeries {
  return { startMs: EXAMPLE_START, readings: accumulate(initial, hourly) };
}

/** Criador pequeno com ciclo diário, sem nenhum evento. */
export function smallCreator(): HourlySeries {
  return series(organicCounts(createRng(11), EXAMPLE_START, { ...CREATOR, base: 40 }));
}

/** Gotejamento exato: 1.000 views em toda hora, dia e noite, sem público orgânico. */
export function exactDrip(): HourlySeries {
  return series(Array.from({ length: SERIES_HOURS }, () => 1_000), 0);
}

const VIRAL_START = hourAt(10, 14);
const VIRAL = { multiple: 30, rise: 3, halfLife: 30 };

/** Viral orgânico: sobe a partir das 14h do dia 10 e decai com cauda longa. `scale` multiplica o público. */
export function organicViral(scale = 1): HourlySeries {
  const model = { ...CREATOR, base: CREATOR.base * scale };
  return series(
    organicCounts(createRng(21), EXAMPLE_START, model, (hour) => 1 + VIRAL.multiple * viralShape(hour - VIRAL_START, VIRAL.rise, VIRAL.halfLife)),
    5_000 * scale,
  );
}

/**
 * Gêmeos: o mesmo criador, a mesma subida (começa às 14h do dia 10 e sobe em 3 horas), a mesma
 * altura e o mesmo total de views na semana. O orgânico é o viral acima; o comprado é o público
 * habitual mais um platô de entrega que sobe igual, fica na altura do pico do viral, não dorme e
 * para de uma vez quando o total empata.
 */
export function twins(): { organic: HourlySeries; bought: HourlySeries; height: number; startHour: number } {
  const organicHourly = organicCounts(createRng(21), EXAMPLE_START, CREATOR, (hour) => 1 + VIRAL.multiple * viralShape(hour - VIRAL_START, VIRAL.rise, VIRAL.halfLife));
  const height = Math.max(...organicHourly);
  const habitual = organicCounts(createRng(21), EXAMPLE_START, CREATOR);
  // O platô fica na altura do pico descontado o público habitual, para a altura visível ser a mesma.
  const plateau = height - habitual.reduce((a, b) => a + b, 0) / habitual.length;
  const jitter = createRng(22);
  let remaining = organicHourly.reduce((a, b) => a + b, 0) - habitual.reduce((a, b) => a + b, 0);
  const bot = habitual.map((_, hour) => {
    if (hour < VIRAL_START || remaining <= 0) return 0;
    const rise = viralShape(hour + 0.5 - VIRAL_START, VIRAL.rise, Number.POSITIVE_INFINITY);
    const views = Math.min(remaining, Math.round(plateau * rise * (1 + 0.002 * jitter.normal())));
    remaining -= views;
    return views;
  });
  return {
    organic: series(organicHourly),
    bought: series(habitual.map((views, hour) => views + (bot[hour] as number))),
    height,
    startHour: VIRAL_START,
  };
}

/** Menção de conta grande: o público novo chega de uma vez às 14h do dia 10 e decai devagar. */
export function bigAccountMention(): HourlySeries {
  return series(organicCounts(createRng(31), EXAMPLE_START, CREATOR, (hour) => 1 + 25 * stepShape(hour - hourAt(10, 14), 48)));
}

/**
 * Saída do algoritmo: viral que começa às 19h do dia 10 e, perto das 14h do dia 12, a plataforma para
 * de recomendar; o volume despenca para 12% em uma hora e não volta. O caso em que o classificador
 * prefere não acusar.
 */
export function algorithmExit(): HourlySeries {
  const start = hourAt(10, 19);
  const exitAt = hourAt(12, 14) - start;
  return series(
    organicCounts(createRng(41), EXAMPLE_START, { ...CREATOR, base: 60 }, (hour) => 1 + 40 * viralShape(hour - start, 4, 36) * exitFactor(hour - start, exitAt, 0.12, 1)),
  );
}

/** Público em vários fusos (Brasil, Portugal, Índia e Japão), com viral cortado pela plataforma. */
export function multiTimezoneCut(): HourlySeries {
  const model: OrganicModel = {
    ...CREATOR,
    base: 60,
    audiences: [
      { offset: -3, weight: 0.3 },
      { offset: 0, weight: 0.25 },
      { offset: 5.5, weight: 0.2 },
      { offset: 9, weight: 0.25 },
    ],
  };
  const start = hourAt(10, 9);
  return series(organicCounts(createRng(51), EXAMPLE_START, model, (hour) => 1 + 30 * viralShape(hour - start, 4, 30) * exitFactor(hour - start, 30, 0.1, 1)));
}

/** Viral de um criador cujo público está em Lisboa; a API não é informada do fuso. */
export function lisbonViral(): HourlySeries {
  const model: OrganicModel = { ...CREATOR, base: 50, audiences: [{ offset: 0, weight: 1 }] };
  const start = hourAt(10, 16);
  return series(organicCounts(createRng(61), EXAMPLE_START, model, (hour) => 1 + 25 * viralShape(hour - start, 3, 30)));
}

/** Tira leituras da série (o volume do buraco não se perde: está na leitura seguinte). */
export function withoutReadings(base: HourlySeries, indexes: number[]): HourlySeries {
  return { ...base, readings: base.readings.map((reading, index) => (indexes.includes(index) ? null : reading)) };
}

/**
 * O total acumulado cai: a leitura `index` fica `amount` views abaixo da anterior (como numa
 * recontagem ou numa remoção da plataforma), e as horas seguintes continuam com as mesmas views.
 */
export function withFall(base: HourlySeries, index: number, amount: number): HourlySeries {
  const previous = base.readings[index - 1] as number;
  const shift = (base.readings[index] as number) - (previous - amount);
  return { ...base, readings: base.readings.map((reading, at) => (reading !== null && at >= index ? reading - shift : reading)) };
}

/** As primeiras `hours` horas da série. */
export function firstHours(base: HourlySeries, hours: number): HourlySeries {
  return { ...base, readings: base.readings.slice(0, hours + 1) };
}

/** Corpo do POST /classify a partir de uma série de exemplo, com horários no fuso de São Paulo. */
export function requestBody(base: HourlySeries, extra: Record<string, unknown> = {}) {
  return {
    series: base.readings.flatMap((reading, index) => {
      if (reading === null) return [];
      const local = new Date(base.startMs + index * HOUR_MS - 3 * HOUR_MS).toISOString().slice(0, 19);
      return [{ at: `${local}-03:00`, cumulative_views: reading }];
    }),
    ...extra,
  };
}
