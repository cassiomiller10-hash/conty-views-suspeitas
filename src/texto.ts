// Formatação do motivo: números em português com unidade, horas no fuso do público.

import { HOUR_MS } from "./serie.ts";

const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = partsCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    partsCache.set(timezone, formatter);
  }
  return formatter;
}

export type LocalTime = { year: number; month: number; day: number; hour: number; minute: number; offsetMinutes: number };

export function localTime(instantMs: number, timezone: string): LocalTime {
  const parts = Object.fromEntries(formatterFor(timezone).formatToParts(new Date(instantMs)).map((part) => [part.type, part.value]));
  const [year, month, day, hour, minute] = [parts.year, parts.month, parts.day, parts.hour, parts.minute].map(Number) as [number, number, number, number, number];
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  return { year, month, day, hour, minute, offsetMinutes: Math.round((asUtc - Math.floor(instantMs / 60_000) * 60_000) / 60_000) };
}

/** Instante no fuso do público, em ISO 8601 com o deslocamento: 2026-03-10T19:00:00-03:00. */
export function isoInTimezone(instantMs: number, timezone: string): string {
  const time = localTime(instantMs, timezone);
  const pad = (value: number) => String(value).padStart(2, "0");
  const sign = time.offsetMinutes < 0 ? "-" : "+";
  const offset = Math.abs(time.offsetMinutes);
  return `${time.year}-${pad(time.month)}-${pad(time.day)}T${pad(time.hour)}:${pad(time.minute)}:00${sign}${pad(Math.floor(offset / 60))}:${pad(offset % 60)}`;
}

/** Relógio da série: converte o índice da hora no instante e escreve no fuso do público. */
export class Clock {
  constructor(
    readonly startMs: number,
    readonly timezone: string,
  ) {}

  instant(hour: number): number {
    return this.startMs + hour * HOUR_MS;
  }

  /** "16h" (início da hora). */
  hour(hour: number): string {
    const time = localTime(this.instant(hour), this.timezone);
    return time.minute === 0 ? `${time.hour}h` : `${time.hour}h${String(time.minute).padStart(2, "0")}`;
  }

  /** "16h do dia 12". */
  hourOfDay(hour: number): string {
    return `${this.hour(hour)} do dia ${localTime(this.instant(hour), this.timezone).day}`;
  }

  /** "dia 12". */
  day(hour: number): string {
    return `dia ${localTime(this.instant(hour), this.timezone).day}`;
  }

  /** "entre 3h e 8h" para o bloco de horas que começa em `first` e tem `size` horas. */
  range(first: number, size: number): string {
    return `entre ${this.hour(first)} e ${this.hour(first + size)}`;
  }

  /** Do início da hora `from` ao início da hora `to`: "entre 2h e 6h do dia 13" ou "entre 14h do dia 10 e 9h do dia 11". */
  between(from: number, to: number): string {
    const sameDay = localTime(this.instant(from), this.timezone).day === localTime(this.instant(to), this.timezone).day;
    return sameDay ? `entre ${this.hour(from)} e ${this.hourOfDay(to)}` : `entre ${this.hourOfDay(from)} e ${this.hourOfDay(to)}`;
  }
}

/** "1 view", "1.234 views". */
export function views(value: number): string {
  return Math.round(value) === 1 ? "1 view" : `${int(value)} views`;
}

/** 1.234 */
export function int(value: number): string {
  return integer.format(Math.round(value));
}

/** Arredonda para dois algarismos significativos: 2.347 vira 2.300; abaixo de 100, inteiro. */
export function approx(value: number): string {
  if (Math.abs(value) < 100) return int(value);
  const magnitude = 10 ** (Math.floor(Math.log10(Math.abs(value))) - 1);
  return int(Math.round(value / magnitude) * magnitude);
}

/** 0,81 vira "81%". Abaixo de 1%, uma casa decimal. */
export function pct(share: number): string {
  const percent = share * 100;
  if (percent > 0 && percent < 1) return `${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return `${Math.round(percent)}%`;
}

const WORDS = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];

/** Contagens pequenas por extenso, para o motivo não ter número solto. */
export function word(value: number): string {
  return WORDS[value] ?? int(value);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Remove o ponto final, para a frase entrar numa enumeração. */
export function clause(sentence: string): string {
  return lowerFirst(sentence.replace(/\.$/, ""));
}
