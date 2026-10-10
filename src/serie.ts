import { DEFAULT_TIMEZONE, LIMITS } from "./criterios.ts";

export const HOUR_MS = 3_600_000;

/**
 * Série normalizada: leituras do total acumulado de hora em hora, a partir de startMs (UTC).
 * readings[i] é o total em startMs + i horas; null quando a leitura falta. A hora i vai de
 * readings[i] a readings[i + 1], então a série tem readings.length - 1 horas.
 */
export type HourlySeries = {
  startMs: number;
  readings: Array<number | null>;
};

export class InputError extends Error {
  constructor(
    message: string,
    readonly field: string,
  ) {
    super(message);
  }
}

const ISO_WITH_OFFSET = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|([+-])(\d{2}):(\d{2}))$/;
const ISO_WITHOUT_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/;

/** Converte o horário em instante UTC, encaixado na hora cheia (tolerância de 10 minutos). */
export function parseHourStamp(value: unknown, field: string): number {
  if (typeof value !== "string") {
    throw new InputError(`${field}: informe o horário como texto ISO 8601 com fuso, por exemplo 2026-03-10T14:00:00-03:00.`, field);
  }
  const match = ISO_WITH_OFFSET.exec(value);
  if (!match) {
    if (ISO_WITHOUT_OFFSET.test(value)) {
      throw new InputError(`${field}: o horário '${value}' não tem fuso. Inclua o fuso, como em ${value}-03:00 ou ${value}Z.`, field);
    }
    throw new InputError(`${field}: '${value}' não é um horário ISO 8601 com fuso (exemplo: 2026-03-10T14:00:00-03:00).`, field);
  }
  const [, y, mo, d, h, mi, s = "0", fraction = "0", zone, sign, offsetH = "0", offsetM = "0"] = match;
  const [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number) as [number, number, number, number, number, number];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (year < 1970 || month < 1 || month > 12 || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59) {
    throw new InputError(`${field}: '${value}' não é uma data válida.`, field);
  }
  const offsetMinutes = zone === "Z" ? 0 : (sign === "-" ? -1 : 1) * (Number(offsetH) * 60 + Number(offsetM));
  if (Number(offsetM) > 59 || Math.abs(offsetMinutes) > 14 * 60) {
    throw new InputError(`${field}: o fuso de '${value}' não existe.`, field);
  }
  const localMs = Date.UTC(year, month - 1, day, hour, minute, second) + Number(`0.${fraction}`) * 1000;
  const nearestHour = Math.round(localMs / HOUR_MS) * HOUR_MS;
  if (Math.abs(localMs - nearestHour) > LIMITS.timestampToleranceMinutes * 60_000) {
    throw new InputError(`${field}: '${value}' está a mais de ${LIMITS.timestampToleranceMinutes} minutos de uma hora cheia; as leituras são de hora em hora.`, field);
  }
  return nearestHour - offsetMinutes * 60_000;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export type ClassifyRequest = { series: HourlySeries; audienceTimezone: string };

/** Valida o corpo do POST /classify. Qualquer problema de formato vira InputError (422). */
export function parseClassifyRequest(body: unknown): ClassifyRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new InputError("Envie um objeto JSON com o campo series.", "body");
  }
  const { series, audience_timezone: timezone = DEFAULT_TIMEZONE } = body as Record<string, unknown>;
  if (typeof timezone !== "string" || !isValidTimezone(timezone)) {
    throw new InputError(`audience_timezone: '${String(timezone)}' não é um fuso IANA válido (exemplo: America/Sao_Paulo).`, "audience_timezone");
  }
  if (!Array.isArray(series) || series.length === 0) {
    throw new InputError("series: envie a lista de leituras de hora em hora, cada uma com at e cumulative_views.", "series");
  }
  if (series.length > LIMITS.maxHours + 1) {
    throw new InputError(`series: são ${series.length} leituras; o máximo é 30 dias de hora em hora (${LIMITS.maxHours + 1} leituras).`, "series");
  }

  const stamps: number[] = [];
  const totals: number[] = [];
  series.forEach((point: unknown, index) => {
    const field = `series[${index}]`;
    if (!point || typeof point !== "object" || Array.isArray(point)) {
      throw new InputError(`${field}: cada leitura é um objeto com at e cumulative_views.`, field);
    }
    const { at, cumulative_views: total } = point as Record<string, unknown>;
    const stamp = parseHourStamp(at, `${field}.at`);
    if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) {
      throw new InputError(`${field}.cumulative_views: informe o total acumulado de views, um inteiro maior ou igual a zero.`, `${field}.cumulative_views`);
    }
    const previous = stamps.at(-1);
    if (previous !== undefined && stamp === previous) {
      throw new InputError(`${field}.at: '${String(at)}' cai na mesma hora cheia da leitura anterior.`, `${field}.at`);
    }
    if (previous !== undefined && stamp < previous) {
      throw new InputError(`${field}.at: as leituras precisam estar em ordem crescente de horário.`, `${field}.at`);
    }
    if ((stamp - (stamps[0] ?? stamp)) % HOUR_MS !== 0) {
      throw new InputError(`${field}.at: '${String(at)}' não está na mesma grade de hora em hora das outras leituras.`, `${field}.at`);
    }
    stamps.push(stamp);
    totals.push(total);
  });

  const first = stamps[0] as number;
  const hours = ((stamps.at(-1) as number) - first) / HOUR_MS;
  if (hours > LIMITS.maxHours) {
    throw new InputError(`series: a série cobre ${hours} horas; o máximo é 30 dias (${LIMITS.maxHours} horas).`, "series");
  }
  const readings: Array<number | null> = Array.from({ length: hours + 1 }, () => null);
  stamps.forEach((stamp, index) => {
    readings[(stamp - first) / HOUR_MS] = totals[index] as number;
  });
  return { series: { startMs: first, readings }, audienceTimezone: timezone };
}

export type HourStatus = "measured" | "estimated" | "drop";

/**
 * Views de cada hora. Hora "estimated" fica dentro de um buraco de leituras: o volume do buraco é
 * dividido igualmente só para exibição, e a hora fica fora de todos os cálculos (preencher um buraco
 * cria horas idênticas, que é justamente a assinatura de robô). Hora "drop" é uma queda do total
 * acumulado: entra só na família de remoção.
 */
export type Hours = {
  views: number[];
  status: HourStatus[];
  usable: boolean[];
};

export function deriveHours(series: HourlySeries): Hours {
  const count = series.readings.length - 1;
  const views: number[] = Array.from({ length: count }, () => 0);
  const status: HourStatus[] = Array.from({ length: count }, () => "estimated" as HourStatus);
  let previous = 0;
  for (let index = 1; index <= count; index++) {
    const reading = series.readings[index];
    if (reading === null || reading === undefined) continue;
    const span = index - previous;
    const total = reading - (series.readings[previous] as number);
    if (span === 1) {
      views[previous] = total;
      status[previous] = total < 0 ? "drop" : "measured";
    } else {
      const share = Math.floor(total / span);
      for (let hour = previous; hour < index; hour++) views[hour] = share + (hour - previous < total - share * span ? 1 : 0);
    }
    previous = index;
  }
  return { views, status, usable: status.map((value) => value === "measured") };
}

export type DataQuality = {
  hours: number;
  missing_readings: number;
  longest_gap_hours: number;
  drop_hours: number;
  /** Leituras com total acima de zero, e quantas delas são centenas exatas (sinal de total arredondado pela fonte). */
  nonzero_readings: number;
  round_readings: number;
};

export function dataQuality(series: HourlySeries, hours: Hours): DataQuality {
  let missing = 0;
  let run = 0;
  let longest = 0;
  for (const reading of series.readings) {
    if (reading === null) {
      missing++;
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  const nonzero = series.readings.filter((reading): reading is number => reading !== null && reading > 0);
  return {
    hours: series.readings.length - 1,
    missing_readings: missing,
    longest_gap_hours: longest,
    drop_hours: hours.status.filter((value) => value === "drop").length,
    nonzero_readings: nonzero.length,
    round_readings: nonzero.filter((reading) => reading % LIMITS.roundStep === 0).length,
  };
}
