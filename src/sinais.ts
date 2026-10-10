// Os quatro sinais. Cada um responde uma pergunta sobre o comportamento do volume, devolve valor,
// limite, se disparou e uma frase em português. O motivo é montado a partir dessas frases.

import { type Family, LIMITS } from "./criterios.ts";
import { type Profile, type Window, hourOfDay, inWindow } from "./janela.ts";
import type { HourlySeries, Hours } from "./serie.ts";
import { type Clock, approx, capitalize, int, localTime, pct, views } from "./texto.ts";

export type SignalName = "abrupt_end" | "awake_at_night" | "low_variation" | "round_counts" | "removal";

export type Signal = {
  signal: SignalName;
  family: Family;
  /** Sem dados para avaliar: o sinal não conta, e a frase diz por quê. */
  evaluable: boolean;
  fired: boolean;
  value: number | null;
  threshold: number;
  fires_when: "above" | "below";
  minimum_views?: number;
  explanation: string;
};

export type SignalContext = {
  series: HourlySeries;
  hours: Hours;
  habitual: number;
  profile: Profile | null;
  clock: Clock;
  startHourUtc: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Média das horas medidas entre `from` e `to` (inclusive); null se houver menos de `minimum`. */
function usableMean(ctx: SignalContext, from: number, to: number, minimum: number): number | null {
  let sum = 0;
  let used = 0;
  for (let hour = Math.max(0, from); hour <= Math.min(ctx.hours.views.length - 1, to); hour++) {
    if (!ctx.hours.usable[hour]) continue;
    sum += ctx.hours.views[hour] as number;
    used++;
  }
  return used >= minimum ? sum / used : null;
}

/**
 * Média das horas medidas entre `from` e `to` e a média que o perfil diário espera para essas mesmas
 * horas (sem perfil, 1). Dividir uma pela outra desconta o ciclo do dia.
 */
function levelWithExpectation(ctx: SignalContext, from: number, to: number, minimum: number): { mean: number; expected: number } | null {
  let sum = 0;
  let expected = 0;
  let used = 0;
  for (let hour = Math.max(0, from); hour <= Math.min(ctx.hours.views.length - 1, to); hour++) {
    if (!ctx.hours.usable[hour]) continue;
    sum += ctx.hours.views[hour] as number;
    expected += ctx.profile ? (ctx.profile.byHour[hourOfDay(ctx.startHourUtc, hour)] as number) : 1;
    used++;
  }
  return used >= minimum ? { mean: sum / used, expected: expected / used } : null;
}

// ---------------------------------------------------------------------------------------------
// Corte: como o pico termina?

type Drop = { boundary: number; drop: number; before: number; after: number; expected: number };

/**
 * Para cada hora de virada b: o nível das 3 horas antes (b-3 a b-1) contra o das 2 horas logo depois
 * (b+1 e b+2), ou seja, a queda completa em até 2 horas. A queda é descontada do que o perfil diário
 * espera para essas horas, e "não voltou no dia seguinte" compara o dia seguinte (b+18 a b+35) com o
 * nível de antes; é essa segunda checagem que separa um corte de uma oscilação do acaso.
 */
export function abruptEnd(ctx: SignalContext, window: Window): Signal {
  const base = { signal: "abrupt_end", family: "abrupt_end", threshold: LIMITS.abruptDrop, fires_when: "above" } as const;
  const last = ctx.hours.views.length - 1;
  // A queda conta a partir do nível de pico (ou, sem pico, do nível habitual), e nunca abaixo de 20 views por hora.
  const gate = Math.max(LIMITS.minHourlyViews, (window.kind === "peak" ? LIMITS.windowMultiple : 1) * ctx.habitual);
  let verified: Drop | null = null;
  let recovered: Drop | null = null;
  let unverified: Drop | null = null;
  let candidates = 0;
  for (let boundary = window.start + 1; boundary <= Math.min(window.end + 1, last); boundary++) {
    const before = levelWithExpectation(ctx, boundary - 3, boundary - 1, 2);
    if (before === null || before.mean < gate) continue;
    const after = levelWithExpectation(ctx, boundary + 1, boundary + 2, 2);
    if (after === null) continue;
    candidates++;
    // Só a queda normal do horário é descontada; quando o horário costuma subir, não subir não vira queda.
    const expected = Math.min(1, before.expected > 0 ? after.expected / before.expected : 1);
    const drop: Drop = { boundary, drop: 1 - after.mean / before.mean / expected, before: before.mean, after: after.mean, expected };
    // "Não voltou no dia seguinte": o nível do dia seguinte (18 horas ao redor de b+27), descontado
    // o ciclo do dia, comparado com o nível de antes da queda.
    const next = levelWithExpectation(ctx, boundary + 18, boundary + 35, 6);
    if (next === null) {
      if (!unverified || drop.drop > unverified.drop) unverified = drop;
    } else if (next.mean / next.expected / (before.mean / before.expected) >= LIMITS.recoveredShare) {
      if (!recovered || drop.drop > recovered.drop) recovered = drop;
    } else if (!verified || drop.drop > verified.drop) {
      verified = drop;
    }
  }

  if (verified && verified.drop >= LIMITS.abruptDrop) {
    const { boundary, before, after, expected } = verified;
    const when = ctx.clock.hourOfDay(boundary);
    const normalDrop = 1 - expected;
    const sentence =
      normalDrop >= 0.05
        ? `A queda das ${when} foi abrupta: em duas horas, o volume foi de cerca de ${approx(before)} para ${approx(after)} views por hora. Descontada a queda normal desse horário (${pct(normalDrop)}), são ${pct(verified.drop)} a menos, e o volume não voltou no dia seguinte.`
        : `A queda das ${when} foi abrupta: em duas horas, o volume caiu ${pct(verified.drop)} (de cerca de ${approx(before)} para ${approx(after)} views por hora), num horário em que o volume não costuma cair, e não voltou no dia seguinte.`;
    return { ...base, evaluable: true, fired: true, value: round2(verified.drop), explanation: sentence };
  }

  if (unverified && unverified.drop >= LIMITS.abruptDrop) {
    const when = `A queda de ${pct(unverified.drop)} às ${ctx.clock.hourOfDay(unverified.boundary)}`;
    return {
      ...base,
      evaluable: false,
      fired: false,
      value: null,
      explanation:
        unverified.boundary + 35 > last
          ? `${when} aconteceu a menos de um dia e meio do fim da série; sem o dia seguinte, não dá para saber se o volume voltou.`
          : `${when} não pôde ser conferida: faltam leituras medidas no dia seguinte para saber se o volume voltou.`,
    };
  }

  if (candidates === 0) {
    const reason =
      window.kind === "peak" && window.end >= last - 3
        ? "O pico ainda não tinha terminado quando a série acaba, então não dá para avaliar como ele termina."
        : `Não há trecho com volume suficiente para avaliar quedas (a partir de ${int(gate)} views por hora).`;
    return { ...base, evaluable: false, fired: false, value: null, explanation: reason };
  }

  const largest = Math.max(0, verified?.drop ?? 0);
  let sentence =
    window.kind === "peak"
      ? `O pico não terminou de uma vez: a maior queda em duas horas, descontada a queda normal do horário, foi de ${pct(largest)}.`
      : `O volume não teve queda brusca: a maior queda em duas horas, descontada a queda normal do horário, foi de ${pct(largest)}.`;
  if (recovered && recovered.drop >= LIMITS.abruptDrop) {
    sentence += ` Houve uma queda de ${pct(recovered.drop)} às ${ctx.clock.hourOfDay(recovered.boundary)}, mas no dia seguinte o volume voltou.`;
  }
  return { ...base, evaluable: true, fired: false, value: round2(largest), explanation: sentence };
}

// ---------------------------------------------------------------------------------------------
// Madrugada: o público dorme?

/** Maior média de 3 horas seguidas entre `from` e `to` (cada bloco com ao menos 2 horas medidas). */
function strongestBlock(ctx: SignalContext, from: number, to: number): number | null {
  let best: number | null = null;
  for (let first = Math.max(0, from); first + 2 <= Math.min(ctx.hours.views.length - 1, to); first++) {
    const mean = usableMean(ctx, first, first + 2, 2);
    if (mean !== null && (best === null || mean > best)) best = mean;
  }
  return best;
}

export function awakeAtNight(ctx: SignalContext, window: Window): Signal {
  const base = { signal: "awake_at_night", family: "awake_at_night", threshold: LIMITS.awakeShare, fires_when: "above" } as const;
  const notEvaluable = (explanation: string): Signal => ({ ...base, evaluable: false, fired: false, value: null, explanation });
  const profile = ctx.profile;
  if (!profile) return notEvaluable("Não dá para aprender em que horas este público costuma dormir: faltam leituras ou o volume é baixo demais (menos de 2 views por hora).");
  if (window.kind === "peak" && profile.nightShare > LIMITS.markedNightMaxShare) {
    return notEvaluable(
      `Não dá para avaliar a madrugada: fora do pico, as horas mais fracas deste público têm ${pct(profile.nightShare)} do volume das mais fortes, sem madrugada marcada, como acontece com público espalhado por vários fusos.`,
    );
  }

  const last = ctx.hours.views.length - 1;
  const nightSize = profile.night.length;
  const firstNight = ((profile.night[0] as number) - ctx.startHourUtc + 24) % 24;
  type Night = { start: number; share: number };
  const nights: Night[] = [];
  let lowVolume = false;
  for (let start = firstNight - 24; start <= last; start += 24) {
    const blockHours = Array.from({ length: nightSize }, (_, offset) => start + offset).filter((hour) => hour >= 0 && hour <= last);
    if (blockHours.filter((hour) => inWindow(window, hour)).length < 3) continue;
    const night = usableMean(ctx, start, start + nightSize - 1, 3);
    if (night === null) continue;
    // O horário mais forte ao redor desta madrugada: as 3 horas seguidas de maior volume nas 12 horas
    // antes e nas 12 depois. Precisa dos dois lados, senão um pico que começa ou é cortado perto da
    // madrugada faria a madrugada parecer forte só por falta de comparação.
    const before = strongestBlock(ctx, start - 12, start - 1);
    const after = strongestBlock(ctx, start + nightSize, start + nightSize + 11);
    if (before === null || after === null) continue;
    const reference = Math.max(before, after);
    if (reference < LIMITS.minHourlyViews) {
      lowVolume = true;
      continue;
    }
    nights.push({ start, share: night / reference });
  }

  if (nights.length === 0) {
    return notEvaluable(
      lowVolume
        ? `Volume baixo demais para avaliar a madrugada (menos de ${LIMITS.minHourlyViews} views por hora no horário mais forte).`
        : "O trecho analisado não passou por uma madrugada inteira, com o horário mais forte antes e depois, para comparar.",
    );
  }

  const worst = nights.reduce((a, b) => (b.share > a.share ? b : a));
  const range = ctx.clock.range(worst.start, nightSize);
  const day = ctx.clock.day(worst.start + nightSize - 1);
  // "Madrugada" só quando as horas de sono aprendidas caem de madrugada no fuso informado; com público
  // em outro fuso, elas podem cair à tarde, e a frase diz isso sem forçar a palavra.
  const startHour = localTime(ctx.clock.instant(worst.start), ctx.clock.timezone).hour;
  const isDawn = startHour >= 21 || startHour <= 5;
  if (worst.share >= LIMITS.awakeShare) {
    const opening = isDawn ? "O volume não diminuiu de madrugada" : "O volume não diminuiu nas horas em que este público costuma dormir";
    const sentence =
      window.kind === "peak"
        ? `${opening}: ${range} do ${day}, quando este público costuma dormir, ficou em ${pct(worst.share)} do horário mais forte${profile.source === "outside_peaks" ? ` (fora do pico, essas horas caíam para ${pct(profile.nightShare)})` : ""}.`
        : `${opening}: ${range} do ${day}, as horas mais fracas do dia, ficou em ${pct(worst.share)} do horário mais forte.`;
    return { ...base, evaluable: true, fired: true, value: round2(worst.share), explanation: sentence };
  }
  const where = isDawn ? (nights.length === 1 ? `Na madrugada do ${day}` : "Nas madrugadas") : nights.length === 1 ? `No ${day}` : "Nas horas mais fracas do dia";
  const sentence =
    nights.length === 1
      ? `${where}, ${range}, quando este público costuma dormir, o volume caiu para ${pct(worst.share)} do horário mais forte.`
      : `${where}, ${range}, quando este público costuma dormir, o volume ficou em no máximo ${pct(worst.share)} do horário mais forte.`;
  return { ...base, evaluable: true, fired: false, value: round2(worst.share), explanation: sentence };
}

// ---------------------------------------------------------------------------------------------
// Regularidade: varia como gente?

/**
 * Com volume λ por hora vindo de pessoas independentes, a contagem varia uns √λ para cima ou para
 * baixo só por acaso; tendência, ciclo do dia e ondas só aumentam a variação. Compara a variação de
 * hora em hora com esse acaso: z = (b − a) / √(a + b) para horas seguidas, e o desvio típico robusto
 * (mediana de |z| / 0,6745) fica perto de 1 para pessoas e perto de 0 para entrega mecânica.
 */
export function lowVariation(ctx: SignalContext, window: Window): Signal {
  const base = { signal: "low_variation", family: "regularity", threshold: LIMITS.lowVariation, fires_when: "below" } as const;
  const deviations: number[] = [];
  let volume = 0;
  for (let hour = window.start; hour < window.end; hour++) {
    if (!ctx.hours.usable[hour] || !ctx.hours.usable[hour + 1]) continue;
    const a = ctx.hours.views[hour] as number;
    const b = ctx.hours.views[hour + 1] as number;
    if (a + b === 0) continue;
    deviations.push(Math.abs(b - a) / Math.sqrt(a + b));
    volume += (a + b) / 2;
  }
  if (deviations.length < LIMITS.minPairs) {
    return { ...base, evaluable: false, fired: false, value: null, explanation: "Há poucas horas medidas seguidas para avaliar a variação das contagens." };
  }
  deviations.sort((a, b) => a - b);
  const middle = Math.floor(deviations.length / 2);
  const median = deviations.length % 2 ? (deviations[middle] as number) : ((deviations[middle - 1] as number) + (deviations[middle] as number)) / 2;
  const ratio = median / 0.6745;
  const mean = volume / deviations.length;
  const chance = Math.sqrt(mean);
  const observed = ratio * chance;
  const observedText = observed < 1 ? "menos de 1 view" : `umas ${views(observed)}`;
  const chanceText = `umas ${views(chance)}`;
  if (ratio < LIMITS.lowVariation) {
    const where = window.kind === "peak" ? `${capitalize(ctx.clock.between(window.start, window.end + 1))}, o vídeo recebeu` : "Ao longo da série, o vídeo recebeu";
    return {
      ...base,
      evaluable: true,
      fired: true,
      value: round2(ratio),
      explanation: `${where} cerca de ${approx(mean)} views por hora, variando ${observedText} para cima ou para baixo; com esse volume, pessoas independentes fariam a contagem variar ${chanceText}.`,
    };
  }
  const explanation =
    ratio >= 1
      ? `As contagens variaram como variam pessoas independentes: ${observedText} para cima ou para baixo, quando o acaso sozinho daria ${chanceText}.`
      : `As contagens variaram ${observedText} para cima ou para baixo, um pouco menos do que as ${views(chance)} que o acaso sozinho daria, mas não a ponto de indicar entrega automatizada.`;
  return { ...base, evaluable: true, fired: false, value: round2(ratio), explanation };
}

/** Centenas exatas: entre pessoas, uma hora com mais de 200 views cai numa centena exata em 1% das vezes. */
export function roundCounts(ctx: SignalContext, window: Window): Signal {
  const base = { signal: "round_counts", family: "regularity", threshold: LIMITS.roundShare, fires_when: "above" } as const;
  const large: number[] = [];
  for (let hour = window.start; hour <= window.end; hour++) {
    if (ctx.hours.usable[hour] && (ctx.hours.views[hour] as number) > LIMITS.roundMinViews) large.push(ctx.hours.views[hour] as number);
  }
  if (large.length < LIMITS.roundMinHours) {
    return {
      ...base,
      evaluable: false,
      fired: false,
      value: null,
      explanation: `Há poucas horas com mais de ${LIMITS.roundMinViews} views para avaliar centenas exatas.`,
    };
  }
  const round = large.filter((value) => value % LIMITS.roundStep === 0);
  const share = round.length / large.length;
  if (share >= LIMITS.roundShare) {
    const frequency = new Map<number, number>();
    for (const value of round) frequency.set(value, (frequency.get(value) ?? 0) + 1);
    const examples = [...frequency.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 2)
      .map(([value]) => value)
      .sort((a, b) => a - b)
      .map(int);
    return {
      ...base,
      evaluable: true,
      fired: true,
      value: round2(share),
      explanation: `Em ${round.length} de ${large.length} horas com mais de ${LIMITS.roundMinViews} views, a contagem foi uma centena exata (como ${examples.join(" ou ")} views); entre pessoas, isso acontece em cerca de 1% das horas.`,
    };
  }
  return { ...base, evaluable: true, fired: false, value: round2(share), explanation: "As contagens não se concentram em centenas exatas." };
}

// ---------------------------------------------------------------------------------------------
// Remoção: a plataforma tirou views?

/**
 * Olha a série inteira, e não só a janela: a plataforma costuma retirar as views dias depois do pico.
 * Mede a maior queda do total acumulado em relação ao maior total já lido antes dela.
 */
export function removal(ctx: SignalContext): Signal {
  const base = {
    signal: "removal",
    family: "removal",
    threshold: LIMITS.removalShare,
    fires_when: "above",
    minimum_views: LIMITS.removalMinViews,
  } as const;
  let highest = -1;
  let highestAt = 0;
  let worst = { drop: 0, share: 0, from: 0, to: 0 };
  ctx.series.readings.forEach((reading, index) => {
    if (reading === null) return;
    if (reading > highest) {
      highest = reading;
      highestAt = index;
      return;
    }
    const drop = highest - reading;
    if (drop > worst.drop) worst = { drop, share: highest > 0 ? drop / highest : 0, from: highestAt, to: index };
  });
  const fired = worst.share > LIMITS.removalShare && worst.drop >= LIMITS.removalMinViews;
  let explanation: string;
  if (fired) {
    explanation = `O total acumulado caiu ${pct(worst.share)} (cerca de ${approx(worst.drop)} views) ${ctx.clock.between(worst.from, worst.to)}: a plataforma retirou views que já tinham sido contadas.`;
  } else if (worst.drop === 0) {
    explanation = "O total acumulado nunca caiu.";
  } else if (worst.share > LIMITS.removalShare) {
    explanation = `O total acumulado caiu ${views(worst.drop)} (${pct(worst.share)}), abaixo do mínimo de ${LIMITS.removalMinViews} views para contar como remoção.`;
  } else {
    explanation = `O total acumulado só teve recontagens pequenas, de até ${views(worst.drop)}, tratadas como ruído.`;
  }
  return { ...base, evaluable: true, fired, value: round2(worst.share), explanation };
}

/** A frase que lembra a explicação inocente de cada família, para o inconclusivo. */
export const INNOCENT: Record<Family, string> = {
  abrupt_end: "Isso acontece quando um pacote de views acaba, mas também quando a plataforma para de recomendar o vídeo ou quando um impulsionamento pago termina.",
  awake_at_night: "Isso acontece com entrega automatizada, mas também com público espalhado por vários fusos.",
  regularity: "Isso acontece com entrega automatizada, mas também quando a série foi preenchida por quem coletou ou quando a fonte arredonda a contagem.",
  removal: "Isso acontece quando a plataforma retira views que considera inválidas, mas também num ajuste de contagem da própria plataforma.",
};

