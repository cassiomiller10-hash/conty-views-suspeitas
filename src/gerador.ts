// Gerador do dataset sintético. Cada tipo de série é uma premissa explícita sobre como pessoas e
// robôs produzem views; os parâmetros de cada série ficam gravados junto com ela no dataset.

import { type Rng, createRng, hashSeed } from "./prng.ts";
import { HOUR_MS } from "./serie.ts";

export const SERIES_HOURS = 168;

export type Group = "legit_common" | "legit_hard" | "bought_typical" | "bought_disguised";
export type Expected = "no_evidence" | "inconclusive" | "no_evidence_or_inconclusive" | "suspicious" | "escapes";
export type SeriesType =
  | "small_creator"
  | "slow_growth"
  | "weekend_peak"
  | "organic_viral"
  | "big_account_mention"
  | "algorithm_exit"
  | "paid_promotion"
  | "multi_timezone"
  | "bought_plateau"
  | "drip_feed"
  | "spike_then_removal"
  | "viral_plus_package"
  | "round_batches"
  | "human_mimic"
  | "small_purchase";

export type TypeSpec = { type: SeriesType; group: Group; count: number; expected: Expected; label: string };

/** As quantidades e o resultado esperado de cada tipo são os do desenho (DECISOES.md, seção 2). */
export const TYPES: TypeSpec[] = [
  { type: "small_creator", group: "legit_common", count: 100, expected: "no_evidence", label: "Criador pequeno com ciclo diário" },
  { type: "slow_growth", group: "legit_common", count: 60, expected: "no_evidence", label: "Crescimento lento" },
  { type: "weekend_peak", group: "legit_common", count: 60, expected: "no_evidence", label: "Pico de fim de semana" },
  { type: "organic_viral", group: "legit_common", count: 120, expected: "no_evidence", label: "Viral orgânico" },
  { type: "big_account_mention", group: "legit_hard", count: 80, expected: "no_evidence", label: "Menção de conta grande" },
  { type: "algorithm_exit", group: "legit_hard", count: 60, expected: "inconclusive", label: "Saída do algoritmo" },
  { type: "paid_promotion", group: "legit_hard", count: 60, expected: "inconclusive", label: "Impulsionamento pago na plataforma" },
  { type: "multi_timezone", group: "legit_hard", count: 60, expected: "no_evidence_or_inconclusive", label: "Público em vários fusos" },
  { type: "bought_plateau", group: "bought_typical", count: 80, expected: "suspicious", label: "Platô comprado" },
  { type: "drip_feed", group: "bought_typical", count: 60, expected: "suspicious", label: "Gotejamento constante" },
  { type: "spike_then_removal", group: "bought_typical", count: 50, expected: "suspicious", label: "Pico seguido de remoção" },
  { type: "viral_plus_package", group: "bought_typical", count: 70, expected: "suspicious", label: "Viral orgânico com pacote somado" },
  { type: "round_batches", group: "bought_typical", count: 40, expected: "suspicious", label: "Entregas em lotes redondos" },
  { type: "human_mimic", group: "bought_disguised", count: 50, expected: "escapes", label: "Compra que imita gente" },
  { type: "small_purchase", group: "bought_disguised", count: 50, expected: "escapes", label: "Compra pequena (menos de 15% do volume)" },
];

export type Params = Record<string, number | string>;

// ---------------------------------------------------------------------------------------------
// Público orgânico

/** Atividade relativa por hora local (0h a 23h): madrugada fraca, pico à noite. */
const TEMPLATE_RAW = [0.55, 0.35, 0.22, 0.15, 0.12, 0.13, 0.22, 0.42, 0.65, 0.8, 0.88, 0.95, 1.05, 1.05, 1.0, 1.0, 1.05, 1.15, 1.3, 1.5, 1.65, 1.7, 1.5, 1.05];
const TEMPLATE_MEAN = TEMPLATE_RAW.reduce((a, b) => a + b, 0) / 24;
const TEMPLATE = TEMPLATE_RAW.map((value) => value / TEMPLATE_MEAN);

export type Audience = { offset: number; weight: number };

export type OrganicModel = {
  /** Views por hora em média, antes de eventos. */
  base: number;
  /** Fusos do público (deslocamento fixo em horas em relação ao UTC) e o peso de cada um. */
  audiences: Audience[];
  /** Profundidade do ciclo diário: 0 é plano, 1 é o ciclo completo. */
  depth: number;
  /** Cronotipo do público, em horas. */
  shift: number;
  /** Quanto o nível multiplica ao longo dos 7 dias. */
  growth: number;
  /** Multiplicador de sábado e domingo. */
  weekend: number;
  /** Forma da gama que multiplica cada hora: menor é mais irregular (pessoas chegam em ondas). */
  dispersion: number;
  /** Desvio das ondas lentas (passeio aleatório que volta à média). */
  drift: number;
};

function templateAt(hour: number): number {
  const position = ((hour % 24) + 24) % 24;
  const index = Math.floor(position);
  const fraction = position - index;
  return (TEMPLATE[index] as number) * (1 - fraction) + (TEMPLATE[(index + 1) % 24] as number) * fraction;
}

/** Atividade do público no instante (média 1 ao longo do dia). */
export function cycleAt(model: Pick<OrganicModel, "audiences" | "depth" | "shift">, instantMs: number): number {
  let value = 0;
  let weights = 0;
  for (const { offset, weight } of model.audiences) {
    const localHour = instantMs / HOUR_MS + offset;
    value += weight * (1 - model.depth + model.depth * templateAt(localHour - model.shift));
    weights += weight;
  }
  return value / weights;
}

/** Peso do fim de semana no fuso principal: 1 de sábado 6h a domingo 22h, com rampas de 6 horas. */
function weekendWeight(model: OrganicModel, instantMs: number): number {
  const local = new Date(instantMs + (model.audiences[0]?.offset ?? 0) * HOUR_MS);
  const sinceSaturday = ((local.getUTCDay() + 1) % 7) * 24 + local.getUTCHours() + local.getUTCMinutes() / 60;
  if (sinceSaturday < 6) return sinceSaturday / 6;
  if (sinceSaturday <= 46) return 1;
  if (sinceSaturday < 52) return 1 - (sinceSaturday - 46) / 6;
  return 0;
}

/** Views orgânicas de cada hora: Poisson sobre a intensidade, multiplicada por uma gama de média 1. */
export function organicCounts(rng: Rng, startMs: number, model: OrganicModel, event: (hour: number) => number = () => 1): number[] {
  const counts: number[] = [];
  let wave = 0;
  for (let hour = 0; hour < SERIES_HOURS; hour++) {
    const instant = startMs + (hour + 0.5) * HOUR_MS;
    wave = 0.9 * wave + model.drift * rng.normal();
    const level =
      model.base *
      model.growth ** (hour / SERIES_HOURS) *
      cycleAt(model, instant) *
      (1 + (model.weekend - 1) * weekendWeight(model, instant)) *
      Math.exp(wave) *
      event(hour + 0.5);
    counts.push(rng.poisson(level * rng.gammaMeanOne(model.dispersion)));
  }
  return counts;
}

export function drawOrganic(rng: Rng, overrides: Partial<OrganicModel> = {}): OrganicModel {
  return {
    base: rng.logUniform(3, 150),
    audiences: [{ offset: -3, weight: 1 }],
    depth: rng.uniform(0.6, 0.9),
    shift: rng.uniform(-1, 1),
    growth: rng.uniform(0.9, 1.1),
    weekend: rng.uniform(0.95, 1.15),
    dispersion: rng.uniform(8, 40),
    drift: rng.uniform(0.03, 0.08),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------------------------
// Eventos orgânicos (multiplicam a intensidade, então seguem o ciclo do dia)

/** Sobe em `rise` horas (curva suave) e decai pela metade a cada `halfLife` horas: cauda longa. */
export function viralShape(tau: number, rise: number, halfLife: number): number {
  if (tau < 0) return 0;
  if (tau < rise) {
    const x = tau / rise;
    return x * x * (3 - 2 * x);
  }
  return 2 ** (-(tau - rise) / halfLife);
}

/** Degrau: o público novo chega de uma vez e decai devagar. */
export function stepShape(tau: number, halfLife: number): number {
  return tau < 0 ? 0 : 2 ** (-tau / halfLife);
}

/** A plataforma para de recomendar: o volume do evento despenca para `keep` em `transition` horas. */
export function exitFactor(tau: number, exitAt: number, keep: number, transition: number): number {
  if (tau < exitAt) return 1;
  if (tau < exitAt + transition) return 1 - ((1 - keep) * (tau - exitAt)) / transition;
  return keep;
}

/** Começa e termina em degrau de uma hora. */
export function boxShape(tau: number, duration: number): number {
  if (tau < 0 || tau >= duration) return 0;
  return Math.min(1, tau + 0.5, duration - tau + 0.5);
}

// ---------------------------------------------------------------------------------------------
// Entregas compradas (somam views, não seguem o ciclo do dia)

/** Platô: `level` views por hora com variação mínima, subindo em `rise` horas e parando de uma vez. */
export function plateauCounts(rng: Rng, start: number, duration: number, level: number, jitter: number, rise = 0, lastFraction = 1): number[] {
  const counts = Array.from({ length: SERIES_HOURS }, () => 0);
  for (let hour = Math.max(0, start); hour < Math.min(SERIES_HOURS, start + duration); hour++) {
    let fraction = rise > 0 && hour - start < rise ? (hour - start + 1) / (rise + 1) : 1;
    if (hour === start + duration - 1) fraction *= lastFraction;
    counts[hour] = Math.max(0, Math.round(level * fraction * (1 + jitter * rng.normal())));
  }
  return counts;
}

function addInto(target: number[], extra: number[]): number[] {
  return target.map((value, hour) => value + (extra[hour] ?? 0));
}

// ---------------------------------------------------------------------------------------------
// Tipos de série

type Draft = { startMs: number; initial: number; hourly: number[]; params: Params };

function draftStart(rng: Rng): number {
  return Date.UTC(2026, 2, 2 + rng.int(0, 20), rng.int(0, 23));
}

function organicParams(model: OrganicModel): Params {
  return {
    base: model.base,
    audience_offsets: model.audiences.map((audience) => `${audience.offset}:${audience.weight.toFixed(2)}`).join(","),
    cycle_depth: model.depth,
    chronotype_shift: model.shift,
    growth: model.growth,
    weekend: model.weekend,
    dispersion: model.dispersion,
    drift: model.drift,
  };
}

function viralEvent(rng: Rng, model: OrganicModel, startRange: [number, number]) {
  const start = rng.int(startRange[0], startRange[1]);
  const multiple = rng.logUniform(8, 60);
  const rise = rng.uniform(2, 8);
  const halfLife = rng.uniform(12, 60);
  return { start, multiple, rise, halfLife, shape: (hour: number) => viralShape(hour - start, rise, halfLife), model };
}

const GENERATORS: Record<SeriesType, (rng: Rng) => Draft> = {
  small_creator(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng);
    return { startMs, initial: Math.round(model.base * rng.uniform(0, 400)), hourly: organicCounts(rng, startMs, model), params: organicParams(model) };
  },

  slow_growth(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng, { growth: rng.uniform(1.5, 4) });
    return { startMs, initial: Math.round(model.base * rng.uniform(0, 100)), hourly: organicCounts(rng, startMs, model), params: organicParams(model) };
  },

  weekend_peak(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng, { weekend: rng.uniform(1.5, 2.5) });
    return { startMs, initial: Math.round(model.base * rng.uniform(0, 400)), hourly: organicCounts(rng, startMs, model), params: organicParams(model) };
  },

  organic_viral(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng, { base: rng.logUniform(5, 300) });
    const viral = viralEvent(rng, model, [20, 100]);
    const hourly = organicCounts(rng, startMs, model, (hour) => 1 + viral.multiple * viral.shape(hour));
    return {
      startMs,
      initial: Math.round(model.base * rng.uniform(0, 200)),
      hourly,
      params: { ...organicParams(model), viral_start: viral.start, viral_multiple: viral.multiple, viral_rise: viral.rise, viral_half_life: viral.halfLife },
    };
  },

  big_account_mention(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng, { base: rng.logUniform(5, 300) });
    const start = rng.int(20, 110);
    const multiple = rng.logUniform(4, 40);
    const halfLife = rng.uniform(24, 96);
    const hourly = organicCounts(rng, startMs, model, (hour) => 1 + multiple * stepShape(hour - start, halfLife));
    return {
      startMs,
      initial: Math.round(model.base * rng.uniform(0, 300)),
      hourly,
      params: { ...organicParams(model), mention_start: start, mention_multiple: multiple, mention_half_life: halfLife },
    };
  },

  algorithm_exit(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng, { base: rng.logUniform(5, 300) });
    const viral = viralEvent(rng, model, [20, 80]);
    // A plataforma para de recomendar enquanto o vídeo ainda está alto, ao menos 28 horas antes do fim.
    const exitAt = Math.min(rng.uniform(viral.rise + 4, viral.rise + 30), 140 - viral.start);
    const keep = rng.uniform(0.05, 0.25);
    const transition = rng.uniform(1, 2);
    const hourly = organicCounts(rng, startMs, model, (hour) => 1 + viral.multiple * viral.shape(hour) * exitFactor(hour - viral.start, exitAt, keep, transition));
    return {
      startMs,
      initial: Math.round(model.base * rng.uniform(0, 200)),
      hourly,
      params: {
        ...organicParams(model),
        viral_start: viral.start,
        viral_multiple: viral.multiple,
        viral_rise: viral.rise,
        viral_half_life: viral.halfLife,
        exit_after_hours: exitAt,
        exit_keeps: keep,
        exit_transition_hours: transition,
      },
    };
  },

  paid_promotion(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng, { base: rng.logUniform(5, 300) });
    const duration = rng.int(24, 72);
    const start = rng.int(20, 140 - duration);
    const boost = rng.uniform(3, 12);
    const hourly = organicCounts(rng, startMs, model, (hour) => 1 + boost * boxShape(hour - start, duration));
    return {
      startMs,
      initial: Math.round(model.base * rng.uniform(0, 300)),
      hourly,
      params: { ...organicParams(model), promotion_start: start, promotion_hours: duration, promotion_boost: boost },
    };
  },

  multi_timezone(rng) {
    const startMs = draftStart(rng);
    const offsets = [-5, -3, 0, 1, 5.5, 8, 9];
    const count = rng.int(2, 3);
    const chosen: number[] = [];
    while (chosen.length < count) {
      const offset = rng.pick(offsets);
      if (!chosen.includes(offset)) chosen.push(offset);
    }
    if (Math.max(...chosen) - Math.min(...chosen) < 6) chosen[chosen.length - 1] = Math.min(...chosen) + 9;
    const model = drawOrganic(rng, { base: rng.logUniform(5, 300), audiences: chosen.map((offset) => ({ offset, weight: rng.uniform(0.3, 1) })) });
    const viral = viralEvent(rng, model, [20, 80]);
    const cut = rng.chance(1 / 3);
    const exitAt = Math.min(rng.uniform(viral.rise + 4, viral.rise + 30), 140 - viral.start);
    const keep = rng.uniform(0.05, 0.25);
    const hourly = organicCounts(rng, startMs, model, (hour) => 1 + viral.multiple * viral.shape(hour) * (cut ? exitFactor(hour - viral.start, exitAt, keep, 1.5) : 1));
    return {
      startMs,
      initial: Math.round(model.base * rng.uniform(0, 200)),
      hourly,
      params: {
        ...organicParams(model),
        viral_start: viral.start,
        viral_multiple: viral.multiple,
        viral_rise: viral.rise,
        viral_half_life: viral.halfLife,
        exit_after_hours: cut ? exitAt : "sem corte",
        exit_keeps: cut ? keep : "sem corte",
      },
    };
  },

  bought_plateau(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng);
    const duration = rng.int(18, 48);
    const start = rng.int(20, 140 - duration);
    const level = model.base * rng.logUniform(8, 60);
    const jitter = rng.uniform(0.001, 0.004);
    const rise = rng.int(0, 1);
    const lastFraction = rng.uniform(0.2, 1);
    const hourly = addInto(organicCounts(rng, startMs, model), plateauCounts(rng, start, duration, level, jitter, rise, lastFraction));
    return {
      startMs,
      initial: Math.round(model.base * rng.uniform(0, 400)),
      hourly,
      params: { ...organicParams(model), bot_start: start, bot_hours: duration, bot_level: level, bot_jitter: jitter, bot_rise_hours: rise },
    };
  },

  drip_feed(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng, { base: rng.logUniform(2, 15) });
    const level = rng.uniform(100, 600);
    const jitter = rng.uniform(0.002, 0.01);
    const hourly = addInto(organicCounts(rng, startMs, model), plateauCounts(rng, 0, SERIES_HOURS, level, jitter));
    return {
      startMs,
      initial: Math.round(level * rng.uniform(0, 100)),
      hourly,
      params: { ...organicParams(model), bot_level: level, bot_jitter: jitter },
    };
  },

  spike_then_removal(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng);
    const duration = rng.int(6, 24);
    const start = rng.int(20, 80);
    const level = model.base * rng.logUniform(8, 60);
    const jitter = rng.uniform(0.001, 0.004);
    const bot = plateauCounts(rng, start, duration, level, jitter, 0, rng.uniform(0.2, 1));
    const removalHours = rng.int(1, 6);
    const removalStart = Math.min(start + duration + rng.int(12, 48), SERIES_HOURS - removalHours);
    const removedShare = rng.uniform(0.3, 0.9);
    const removed = Math.round(removedShare * bot.reduce((a, b) => a + b, 0));
    for (let hour = removalStart; hour < removalStart + removalHours; hour++) bot[hour] = (bot[hour] as number) - Math.round(removed / removalHours);
    return {
      startMs,
      initial: Math.round(model.base * rng.uniform(0, 400)),
      hourly: addInto(organicCounts(rng, startMs, model), bot),
      params: {
        ...organicParams(model),
        bot_start: start,
        bot_hours: duration,
        bot_level: level,
        bot_jitter: jitter,
        removal_start: removalStart,
        removal_hours: removalHours,
        removed_share_of_bot: removedShare,
      },
    };
  },

  viral_plus_package(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng, { base: rng.logUniform(5, 200) });
    const viral = viralEvent(rng, model, [20, 70]);
    const offset = rng.int(0, 24);
    const duration = rng.int(12, 36);
    const start = Math.min(viral.start + offset, 140 - duration);
    // O pacote é de 3 a 10 vezes o volume orgânico médio do momento em que começa.
    const organicLevel = model.base * (1 + viral.multiple * viral.shape(start));
    const level = organicLevel * rng.uniform(3, 10);
    const jitter = rng.uniform(0.002, 0.006);
    const organic = organicCounts(rng, startMs, model, (hour) => 1 + viral.multiple * viral.shape(hour));
    return {
      startMs,
      initial: Math.round(model.base * rng.uniform(0, 200)),
      hourly: addInto(organic, plateauCounts(rng, start, duration, level, jitter, 0, rng.uniform(0.2, 1))),
      params: {
        ...organicParams(model),
        viral_start: viral.start,
        viral_multiple: viral.multiple,
        viral_rise: viral.rise,
        viral_half_life: viral.halfLife,
        package_start: start,
        package_hours: duration,
        package_level: level,
        package_jitter: jitter,
      },
    };
  },

  round_batches(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng, { base: rng.uniform(0.1, 0.6) });
    const duration = rng.int(48, 80);
    const start = rng.int(20, 140 - duration);
    const probability = rng.uniform(0.35, 0.8);
    const bot = Array.from({ length: SERIES_HOURS }, (_, hour) => (hour >= start && hour < start + duration && rng.chance(probability) ? 100 * rng.int(2, 20) : 0));
    return {
      startMs,
      initial: rng.int(0, 500),
      hourly: addInto(organicCounts(rng, startMs, model), bot),
      params: { ...organicParams(model), batches_start: start, batches_hours: duration, batch_probability_per_hour: probability },
    };
  },

  human_mimic(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng, { base: rng.logUniform(5, 100) });
    const start = rng.int(20, 72);
    const duration = rng.int(36, 72);
    const rampUp = rng.int(4, 10);
    // Desligamento em rampa: depois de `duration` horas, a entrega cai pela metade a cada `halfLife` horas.
    const halfLife = rng.uniform(4, 10);
    const level = model.base * rng.logUniform(4, 30);
    const botModel = drawOrganic(rng, { base: level, dispersion: rng.uniform(6, 20), drift: rng.uniform(0.03, 0.08) });
    const ramp = (hour: number) => {
      const tau = hour - start;
      if (tau < 0) return 0;
      return Math.min(1, (tau + 0.5) / rampUp) * (tau < duration ? 1 : 2 ** (-(tau - duration) / halfLife));
    };
    const bot = organicCounts(rng, startMs, botModel, ramp);
    return {
      startMs,
      initial: Math.round(model.base * rng.uniform(0, 300)),
      hourly: addInto(organicCounts(rng, startMs, model), bot),
      params: { ...organicParams(model), bot_start: start, bot_hours: duration, bot_level: level, bot_ramp_up_hours: rampUp, bot_ramp_down_half_life: halfLife },
    };
  },

  small_purchase(rng) {
    const startMs = draftStart(rng);
    const model = drawOrganic(rng, { base: rng.logUniform(10, 300) });
    const organic = organicCounts(rng, startMs, model);
    const share = rng.uniform(0.03, 0.15);
    const total = share * organic.reduce((a, b) => a + b, 0);
    const asDrip = rng.chance(0.4);
    const duration = asDrip ? SERIES_HOURS : rng.int(12, 48);
    const start = asDrip ? 0 : rng.int(20, 140 - duration);
    const bot = plateauCounts(rng, start, duration, total / duration, rng.uniform(0.002, 0.01));
    return {
      startMs,
      initial: Math.round(model.base * rng.uniform(0, 300)),
      hourly: addInto(organic, bot),
      params: { ...organicParams(model), purchase_form: asDrip ? "gotejamento" : "platô", purchase_share_of_organic: share, bot_start: start, bot_hours: duration },
    };
  },
};

// ---------------------------------------------------------------------------------------------
// Montagem: total acumulado, artefatos de coleta e registro

export type GeneratedSeries = {
  id: string;
  type: SeriesType;
  group: Group;
  truth: "organic" | "bought";
  expected: Expected;
  params: Params;
  start: string;
  readings: Array<number | null>;
};

/** Leituras do total acumulado a partir das views de cada hora. */
export function accumulate(initial: number, hourly: number[]): number[] {
  const readings = [initial];
  for (const views of hourly) readings.push((readings.at(-1) as number) + views);
  return readings;
}

/**
 * Artefatos de coleta: cerca de 10% das séries perdem de 1 a 4 leituras, e 5% das legítimas têm
 * recontagens pequenas para baixo (sempre abaixo do limite de remoção).
 */
function addArtifacts(rng: Rng, readings: Array<number | null>, legit: boolean, params: Params): void {
  if (legit && rng.chance(0.05)) {
    const events = rng.int(1, 3);
    let applied = 0;
    for (let event = 0; event < events; event++) {
      const hour = rng.int(2, readings.length - 2);
      const cap = Math.min(30, Math.floor(0.003 * (readings[hour] as number)));
      if (cap < 1) continue;
      const amount = rng.int(1, cap);
      for (let later = hour; later < readings.length; later++) readings[later] = (readings[later] as number) - amount;
      applied++;
    }
    if (applied > 0) params.recounts = applied;
  }
  if (rng.chance(0.1)) {
    const missing = rng.int(1, 4);
    const removed = new Set<number>();
    while (removed.size < missing) removed.add(rng.int(1, readings.length - 2));
    for (const index of removed) readings[index] = null;
    params.missing_readings = missing;
  }
}

function roundParams(params: Params): Params {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, typeof value === "number" && !Number.isInteger(value) ? Math.round(value * 1000) / 1000 : value]));
}

export function generateSeries(seed: number, spec: TypeSpec, index: number): GeneratedSeries {
  const rng = createRng(hashSeed(seed, spec.type, index));
  const draft = GENERATORS[spec.type](rng);
  const readings: Array<number | null> = accumulate(draft.initial, draft.hourly);
  const legit = spec.group.startsWith("legit");
  addArtifacts(rng, readings, legit, draft.params);
  return {
    id: `${spec.type}-${String(index + 1).padStart(3, "0")}`,
    type: spec.type,
    group: spec.group,
    truth: legit ? "organic" : "bought",
    expected: spec.expected,
    params: roundParams(draft.params),
    start: new Date(draft.startMs).toISOString(),
    readings,
  };
}

export function generateDataset(seed: number): GeneratedSeries[] {
  return TYPES.flatMap((spec) => Array.from({ length: spec.count }, (_, index) => generateSeries(seed, spec, index)));
}
