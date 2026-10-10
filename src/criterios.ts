// Critério v1. Todo limite que decide uma classificação está aqui. Mudar qualquer um deles é publicar
// um critério novo (CRITERIA_VERSION), para uma decisão antiga poder ser refeita com os limites da época.

export const CRITERIA_VERSION = "v1";

export const RULE = "suspeito exige duas famílias de sinais; com uma, inconclusivo";

/** Conta-se família, não sinal: o mesmo fenômeno não vota duas vezes. */
export const FAMILIES = ["abrupt_end", "awake_at_night", "regularity", "removal"] as const;
export type Family = (typeof FAMILIES)[number];

export type Classification = "no_evidence" | "inconclusive" | "suspicious";

/** Só serve para escrever as horas no motivo: a madrugada é aprendida da própria série. */
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export const LIMITS = {
  // Série aceita
  timestampToleranceMinutes: 10,
  minHours: 48,
  maxHours: 720,
  maxMissingShare: 0.1,
  maxGapHours: 6,

  // Janela em análise: trecho em que a média de 24 horas passa de 3 vezes o nível habitual da série
  smoothingHours: 24,
  windowMultiple: 3,

  // Abaixo deste volume por hora, o acaso sozinho produz quedas bruscas e madrugadas "acordadas"
  minHourlyViews: 20,

  // Corte: queda em até 2 horas, descontada a queda normal do horário, sem volta no dia seguinte
  abruptDrop: 0.7,
  recoveredShare: 0.5,

  // Madrugada: blocos de horas aprendidos da série
  awakeShare: 0.8,
  markedNightMaxShare: 0.5,
  nightBlockHours: 5,
  strongBlockHours: 3,

  // Regularidade: variação perto do acaso de pessoas independentes, ou centenas exatas
  lowVariation: 0.35,
  minPairs: 12,
  roundShare: 0.4,
  roundMinViews: 200,
  roundMinHours: 10,
  roundStep: 100,

  // Total arredondado pela fonte ("1,2 mil"): com contagem exata, só 1% das leituras cai numa centena
  // exata; com 95% ou mais, a série não dá para julgar
  roundedSourceShare: 0.95,

  // Remoção: o total acumulado cai
  removalShare: 0.01,
  removalMinViews: 100,
} as const;

/** Uma família leva a inconclusivo; duas ou mais, a suspeito. */
export function applyRule(familiesFired: number, minimumToAccuse = 2): Classification {
  if (familiesFired === 0) return "no_evidence";
  return familiesFired >= minimumToAccuse ? "suspicious" : "inconclusive";
}
