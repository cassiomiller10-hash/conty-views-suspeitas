import { LIMITS } from "./criterios.ts";
import type { Hours } from "./serie.ts";

/** Trecho julgado: horas start..end (inclusive). "series" quando não há pico e a janela é a série inteira. */
export type Window = { start: number; end: number; kind: "peak" | "series" };

/** Média móvel centrada de 24 horas, só com horas medidas. Sem horas suficientes, null. */
export function smooth(hours: Hours): Array<number | null> {
  const half = LIMITS.smoothingHours / 2;
  const count = hours.views.length;
  return hours.views.map((_, index) => {
    let sum = 0;
    let used = 0;
    for (let other = Math.max(0, index - half); other < Math.min(count, index + half); other++) {
      if (!hours.usable[other]) continue;
      sum += hours.views[other] as number;
      used++;
    }
    return used >= half / 2 ? sum / used : null;
  });
}

/**
 * Nível habitual da própria série: o primeiro quartil da média de 24 horas (no mínimo 1 view por hora).
 * Quartil, e não mediana, porque um pico ou uma compra que ocupa mais da metade da série puxaria a
 * mediana para cima e esconderia o próprio pico.
 */
export function habitualLevel(smoothed: Array<number | null>): number {
  const values = smoothed.filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (values.length === 0) return 1;
  return Math.max(1, values[Math.floor((values.length - 1) / 4)] as number);
}

/**
 * Janelas de pico: cada trecho contínuo em que a média de 24 horas passa de 3 vezes o nível habitual,
 * aparado da primeira à última hora que, sozinha, também passa desse nível (a média de 24 horas
 * espalha o pico para as horas vizinhas). Sem pico, a janela é a série inteira.
 */
export function findWindows(hours: Hours, smoothed: Array<number | null>, habitual: number): Window[] {
  const limit = LIMITS.windowMultiple * habitual;
  const windows: Window[] = [];
  let index = 0;
  while (index < smoothed.length) {
    if ((smoothed[index] ?? 0) <= limit) {
      index++;
      continue;
    }
    let end = index;
    while (end + 1 < smoothed.length && (smoothed[end + 1] ?? 0) > limit) end++;
    const high: number[] = [];
    for (let hour = index; hour <= end; hour++) if (hours.usable[hour] && (hours.views[hour] as number) > limit) high.push(hour);
    if (high.length > 0) windows.push({ start: high[0] as number, end: high.at(-1) as number, kind: "peak" });
    index = end + 1;
  }
  return windows.length > 0 ? windows : [{ start: 0, end: hours.views.length - 1, kind: "series" }];
}

export function inWindow(window: Window, hour: number): boolean {
  return hour >= window.start && hour <= window.end;
}

/**
 * Perfil diário aprendido da própria série: para cada hora do dia (UTC), o volume relativo à média de
 * 24 horas ao redor. Aprende fora dos picos quando há pelo menos dois dias medidos fora deles; senão,
 * na série inteira.
 */
export type Profile = {
  /** Volume relativo de cada hora do dia, de 0 a 23 em UTC. */
  byHour: number[];
  /** Horas do dia (UTC) em que este público costuma dormir: as 5 seguidas mais fracas. */
  night: number[];
  /** As 3 horas seguidas mais fortes, fora da madrugada. */
  strong: number[];
  /** Volume da madrugada dividido pelo do horário mais forte, no próprio perfil. */
  nightShare: number;
  source: "outside_peaks" | "whole_series";
};

export function hourOfDay(startHourUtc: number, hour: number): number {
  return (((startHourUtc + hour) % 24) + 24) % 24;
}

export function learnProfile(hours: Hours, smoothed: Array<number | null>, startHourUtc: number, windows: Window[]): Profile | null {
  const peaks = windows.filter((window) => window.kind === "peak");
  const candidates = (skipPeaks: boolean) =>
    hours.views
      .map((views, hour) => ({ views, hour, level: smoothed[hour] }))
      .filter(({ hour, level }) => hours.usable[hour] && level !== null && level !== undefined && level > 0)
      .filter(({ hour }) => !skipPeaks || !peaks.some((window) => inWindow(window, hour)));
  const outside = candidates(true);
  const useOutside = peaks.length > 0 && outside.length >= 48;
  const samples = useOutside ? outside : candidates(false);
  // Com menos de 2 views por hora em média, o ciclo do dia some no acaso.
  if (samples.reduce((sum, sample) => sum + sample.views, 0) < 2 * samples.length) return null;

  const sums = Array.from({ length: 24 }, () => 0);
  const counts = Array.from({ length: 24 }, () => 0);
  for (const { views, hour, level } of samples) {
    const slot = hourOfDay(startHourUtc, hour);
    sums[slot] = (sums[slot] as number) + views / (level as number);
    counts[slot] = (counts[slot] as number) + 1;
  }
  if (counts.filter((count) => count === 0).length > 4) return null;
  const known = sums.map((sum, slot) => ((counts[slot] as number) > 0 ? sum / (counts[slot] as number) : null));
  // Hora do dia sem amostra (buracos): média das vizinhas conhecidas.
  // Nenhuma hora vale menos de 5% da média do dia, para a divisão pela queda esperada não explodir.
  const byHour = known.map((value, slot) => {
    if (value !== null) return Math.max(0.05, value);
    for (let distance = 1; distance < 12; distance++) {
      const around = [known[(slot + distance) % 24], known[(slot - distance + 24) % 24]].filter((other): other is number => other !== null && other !== undefined);
      if (around.length > 0) return Math.max(0.05, around.reduce((a, b) => a + b, 0) / around.length);
    }
    return 1;
  });

  const block = (first: number, size: number) => Array.from({ length: size }, (_, offset) => (first + offset) % 24);
  const mean = (slots: number[]) => slots.reduce((sum, slot) => sum + (byHour[slot] as number), 0) / slots.length;
  let night = block(0, LIMITS.nightBlockHours);
  for (let first = 1; first < 24; first++) {
    const candidate = block(first, LIMITS.nightBlockHours);
    if (mean(candidate) < mean(night)) night = candidate;
  }
  let strong: number[] | null = null;
  for (let first = 0; first < 24; first++) {
    const candidate = block(first, LIMITS.strongBlockHours);
    if (candidate.some((slot) => night.includes(slot))) continue;
    if (strong === null || mean(candidate) > mean(strong)) strong = candidate;
  }
  const strongBlock = strong as number[];
  return {
    byHour,
    night,
    strong: strongBlock,
    nightShare: mean(strongBlock) > 0 ? mean(night) / mean(strongBlock) : 1,
    source: useOutside ? "outside_peaks" : "whole_series",
  };
}
