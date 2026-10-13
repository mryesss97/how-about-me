/**
 * Deterministic PRNG helpers for the perf seed (T-097). No dependency, no `Math.random`:
 * the same seed always yields the same rows (mulberry32).
 */
export type Rng = {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** true with probability `p`. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Weighted pick; weights need not sum to 1. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  /** `n` distinct items (n ≤ items.length), in pick order. */
  sample<T>(items: readonly T[], n: number): T[];
  /** RFC 4122 v4-shaped UUID drawn from the stream. */
  uuid(): string;
};

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => {
      const v = items[Math.floor(next() * items.length)];
      if (v === undefined) throw new Error("pick from empty list");
      return v;
    },
    weighted: (entries) => {
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of entries) {
        r -= w;
        if (r < 0) return v;
      }
      const last = entries[entries.length - 1];
      if (!last) throw new Error("weighted pick from empty list");
      return last[0];
    },
    sample: (items, n) => {
      const pool = [...items];
      const out: (typeof pool)[number][] = [];
      for (let i = 0; i < n && pool.length > 0; i++) out.push(...pool.splice(Math.floor(next() * pool.length), 1));
      return out;
    },
    uuid: () => {
      const w = [next(), next(), next(), next()].map((f) => Math.floor(f * 4294967296));
      const s = w.map(hex).join("");
      const variant = ((parseInt(s[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
      return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-${variant}${s.slice(17, 20)}-${s.slice(20, 32)}`;
    },
  };
  return rng;
}
