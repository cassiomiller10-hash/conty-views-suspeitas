// O classificador: função pura de série para resultado. A API e a avaliação chamam esta mesma função,
// então a taxa medida no dataset é a da API, não a de uma cópia.

import { CRITERIA_VERSION, type Classification, DEFAULT_TIMEZONE, FAMILIES, type Family, LIMITS, RULE, applyRule } from "./criterios.ts";
import { type Window, findWindows, habitualLevel, learnProfile, smooth } from "./janela.ts";
import { type DataQuality, HOUR_MS, type HourlySeries, type Hours, dataQuality, deriveHours } from "./serie.ts";
import { INNOCENT, type Signal, type SignalContext, abruptEnd, awakeAtNight, lowVariation, removal, roundCounts } from "./sinais.ts";
import { Clock, approx, capitalize, int, isoInTimezone, pct, word } from "./texto.ts";

export type ClassifyResult = {
  classification: Classification;
  reason: string;
  rule: string;
  criteria_version: string;
  families_fired: Family[];
  analyzed_window: { start: string; end: string; hours: number; kind: "peak" | "whole_series" } | null;
  signals: Signal[];
  context: {
    habitual_views_per_hour: number;
    peak_views_per_hour: number;
    peak_multiple: number;
    window_views: number;
    step_rise: boolean;
    peak_windows: number;
  } | null;
  data_quality: DataQuality;
  /** O que falta quando a série não dá para julgar. */
  insufficient_data: string[];
  audience_timezone: string;
};

type Judged = { window: Window; signals: Signal[]; families: Family[] };

export function classify(series: HourlySeries, audienceTimezone: string = DEFAULT_TIMEZONE): ClassifyResult {
  const hours = deriveHours(series);
  const quality = dataQuality(series, hours);
  const clock = new Clock(series.startMs, audienceTimezone);
  const common = { rule: RULE, criteria_version: CRITERIA_VERSION, data_quality: quality, audience_timezone: audienceTimezone };

  const missing = insufficientData(series, quality, clock);
  if (missing.length > 0) {
    return {
      classification: "inconclusive",
      reason: `Dados insuficientes para avaliar: ${missing.join("; ")}. Envie leituras exatas, medidas de hora em hora, sem arredondamento nem preenchimento, cobrindo pelo menos ${LIMITS.minHours} horas.`,
      families_fired: [],
      analyzed_window: null,
      signals: [],
      context: null,
      insufficient_data: missing,
      ...common,
    };
  }

  const smoothed = smooth(hours);
  const habitual = habitualLevel(smoothed);
  const windows = findWindows(hours, smoothed, habitual);
  const startHourUtc = new Date(series.startMs).getUTCHours();
  const profile = learnProfile(hours, smoothed, startHourUtc, windows);
  const ctx: SignalContext = { series, hours, habitual, profile, clock, startHourUtc };

  // A remoção olha a série inteira; os outros sinais, cada janela. Com mais de um pico, vale o pior.
  const removed = removal(ctx);
  const judged: Judged[] = windows.map((window) => {
    const signals = [abruptEnd(ctx, window), awakeAtNight(ctx, window), lowVariation(ctx, window), roundCounts(ctx, window), removed];
    return { window, signals, families: FAMILIES.filter((family) => signals.some((signal) => signal.family === family && signal.fired)) };
  });
  const worst = judged.reduce((a, b) => (b.families.length > a.families.length ? b : a));
  const classification = applyRule(worst.families.length);
  const peaks = windows.filter((window) => window.kind === "peak").length;
  const context = describeContext(hours, habitual, worst.window, peaks, clock);

  return {
    classification,
    reason: buildReason(classification, worst, context.sentences),
    families_fired: worst.families,
    analyzed_window: {
      start: isoInTimezone(clock.instant(worst.window.start), audienceTimezone),
      end: isoInTimezone(clock.instant(worst.window.end + 1), audienceTimezone),
      hours: worst.window.end - worst.window.start + 1,
      kind: worst.window.kind === "peak" ? "peak" : "whole_series",
    },
    signals: worst.signals,
    context: context.values,
    insufficient_data: [],
    ...common,
  };
}

function insufficientData(series: HourlySeries, quality: DataQuality, clock: Clock): string[] {
  const problems: string[] = [];
  if (quality.hours < LIMITS.minHours) {
    problems.push(`a série cobre ${quality.hours === 1 ? "1 hora" : `${int(quality.hours)} horas`}, e são necessárias pelo menos ${LIMITS.minHours} horas para comparar um dia com o outro`);
  }
  if (quality.hours > 0 && quality.missing_readings / quality.hours > LIMITS.maxMissingShare) {
    problems.push(
      `faltam leituras em ${quality.missing_readings} de ${quality.hours} horas (${pct(quality.missing_readings / quality.hours)}), acima do limite de ${pct(LIMITS.maxMissingShare)} das horas`,
    );
  }
  if (quality.longest_gap_hours > LIMITS.maxGapHours) {
    let run = 0;
    let gapStart = 0;
    series.readings.forEach((reading, index) => {
      run = reading === null ? run + 1 : 0;
      if (run === quality.longest_gap_hours) gapStart = index - run + 1;
    });
    problems.push(`há um buraco de ${quality.longest_gap_hours} horas sem leitura a partir das ${clock.hourOfDay(gapStart)}, acima do limite de ${LIMITS.maxGapHours} horas`);
  }
  // Com o total arredondado, toda hora vira centena exata e as horas fracas andam de 100 em 100: os
  // sinais perderiam a precisão e poderiam acusar um criador honesto.
  if (quality.nonzero_readings >= 2 && quality.round_readings >= LIMITS.roundedSourceShare * quality.nonzero_readings) {
    problems.push(
      `o total parece arredondado pela fonte (em ${quality.round_readings} de ${quality.nonzero_readings} leituras, ele é uma centena exata, o que com contagem exata acontece em cerca de 1% das leituras)`,
    );
  }
  return problems;
}

/** Altura do pico, volume e subida em degrau: contexto para o motivo, nunca sinal. */
function describeContext(hours: Hours, habitual: number, window: Window, peaks: number, clock: Clock) {
  let peak = 0;
  let total = 0;
  for (let hour = window.start; hour <= window.end; hour++) {
    total += Math.max(0, hours.views[hour] as number);
    if (hours.usable[hour]) peak = Math.max(peak, hours.views[hour] as number);
  }
  const sentences: string[] = [];
  let stepRise = false;
  if (window.kind === "peak") {
    sentences.push(
      `O pico chegou a ${approx(peak)} views por hora, ${int(peak / habitual)} vezes o nível habitual deste vídeo; altura de pico não é sinal, porque é o que acontece quando um vídeo estoura.`,
    );
    const step = findStepRise(hours, habitual, window);
    if (step) {
      stepRise = true;
      sentences.push(
        `A subida foi brusca, de cerca de ${approx(step.from)} para ${approx(step.to)} views por hora em até duas horas, às ${clock.hourOfDay(step.at)}; isso também acontece quando uma conta grande menciona o criador, e subida não é sinal.`,
      );
    }
  }
  if (peaks > 1) {
    sentences.push(`A série teve ${word(peaks)} picos; cada um foi julgado separadamente, e vale o que reuniu mais indícios.`);
  }
  return {
    sentences,
    values: {
      habitual_views_per_hour: Math.round(habitual),
      peak_views_per_hour: peak,
      peak_multiple: Math.round((peak / habitual) * 10) / 10,
      window_views: total,
      step_rise: stepRise,
      peak_windows: peaks,
    },
  };
}

/** Subida de 5 vezes ou mais em até duas horas, no começo do pico. */
function findStepRise(hours: Hours, habitual: number, window: Window): { from: number; to: number; at: number } | null {
  const mean = (from: number, to: number) => {
    const values: number[] = [];
    for (let hour = Math.max(0, from); hour <= Math.min(hours.views.length - 1, to); hour++) if (hours.usable[hour]) values.push(hours.views[hour] as number);
    return values.length >= 2 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  for (let hour = window.start - 2; hour <= window.start + 2; hour++) {
    const before = mean(hour - 3, hour - 1);
    if (before === null) continue;
    const after = Math.max(hours.usable[hour] ? (hours.views[hour] as number) : 0, hours.usable[hour + 1] ? (hours.views[hour + 1] as number) : 0);
    if (after >= 5 * Math.max(before, 1) && after > LIMITS.windowMultiple * habitual) return { from: before, to: after, at: hour };
  }
  return null;
}

function buildReason(classification: Classification, judged: Judged, context: string[]): string {
  const shown = judged.signals.filter((signal) => signal.signal !== "round_counts" || signal.fired);
  const fired = shown.filter((signal) => signal.fired);
  const quiet = shown.filter((signal) => signal.evaluable && !signal.fired).map((signal) => signal.explanation);
  const unknown = shown.filter((signal) => !signal.evaluable).map((signal) => signal.explanation);
  const parts: string[] = [];
  if (classification === "suspicious") {
    parts.push(...fired.map((signal) => signal.explanation));
    parts.push(
      `${capitalize(word(judged.families.length))} sinais independentes concordam: o padrão é compatível com entrega automatizada, o que não identifica quem a contratou. Esse alcance precisa de revisão antes de entrar na decisão de renovação.`,
    );
    parts.push(...context.filter((sentence) => sentence.startsWith("A série teve")));
  } else if (classification === "inconclusive") {
    parts.push(...fired.map((signal) => signal.explanation));
    parts.push(INNOCENT[judged.families[0] as Family]);
    if (quiet.length > 0) parts.push("Os outros sinais são de público humano.", ...quiet);
    parts.push(...unknown, "Um indício isolado não basta para acusar.", ...context);
  } else {
    parts.push("Nenhum sinal de entrega automatizada.", ...quiet, ...unknown, ...context);
    parts.push("Isso não certifica que as views são de pessoas, só que os padrões procurados não aparecem.");
  }
  return parts.join(" ");
}

/** Para exibição: views de cada hora, com o volume dos buracos dividido igualmente e marcado. */
export function hourlyView(series: HourlySeries, timezone: string) {
  const hours = deriveHours(series);
  return hours.views.map((views, hour) => ({
    start: isoInTimezone(series.startMs + hour * HOUR_MS, timezone),
    views,
    status: hours.status[hour],
  }));
}
