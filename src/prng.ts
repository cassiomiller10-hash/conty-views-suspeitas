// Gerador pseudoaleatório próprio (mulberry32), para o dataset não depender do Math.random nem da
// versão do Node. Cada série recebe a própria semente, derivada da semente do dataset e do nome da
// série: mudar um tipo de série não altera as séries dos outros tipos.

export type Rng = {
  /** Uniforme em [0, 1). */
  next(): number;
  uniform(min: number, max: number): number;
  /** Inteiro uniforme em [min, max], inclusive. */
  int(min: number, max: number): number;
  /** Uniforme na escala logarítmica: tão provável cair entre 10 e 100 quanto entre 100 e 1.000. */
  logUniform(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  normal(): number;
  /** Gama com média 1 e forma `shape`: quanto menor a forma, mais irregular. */
  gammaMeanOne(shape: number): number;
  poisson(lambda: number): number;
};

/** FNV-1a de 32 bits sobre as partes: a mesma entrada dá sempre a mesma semente. */
export function hashSeed(...parts: Array<string | number>): number {
  let hash = 0x811c9dc5;
  for (const char of parts.join(":")) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let spare: number | null = null;
  const normal = () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    let u = next();
    while (u === 0) u = next();
    const v = next();
    const radius = Math.sqrt(-2 * Math.log(u));
    spare = radius * Math.sin(2 * Math.PI * v);
    return radius * Math.cos(2 * Math.PI * v);
  };

  // Marsaglia e Tsang (2000), para forma >= 1.
  const gamma = (shape: number): number => {
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x = normal();
      let v = 1 + c * x;
      while (v <= 0) {
        x = normal();
        v = 1 + c * x;
      }
      v = v * v * v;
      const u = next();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };

  const poisson = (lambda: number): number => {
    if (lambda <= 0) return 0;
    if (lambda < 30) {
      // Knuth: multiplica uniformes até passar de e^-lambda.
      const limit = Math.exp(-lambda);
      let count = 0;
      let product = next();
      while (product > limit) {
        count++;
        product *= next();
      }
      return count;
    }
    // Acima de 30, a normal com a mesma média e variância basta para o que o classificador mede.
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal()));
  };

  return {
    next,
    uniform: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    logUniform: (min, max) => Math.exp(Math.log(min) + (Math.log(max) - Math.log(min)) * next()),
    chance: (probability) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)] as (typeof items)[number],
    normal,
    gammaMeanOne: (shape) => gamma(shape) / shape,
    poisson,
  };
}
