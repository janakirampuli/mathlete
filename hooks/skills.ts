export type Rng = () => number

export type Made = { prompt: string; answer: number }

export type Skill = {
  id: string
  name: string
  unlockLevel: number
  tier: number
  // One generator per difficulty step, easiest first.
  steps: Array<{ targetSeconds: number; make: (rng: Rng) => Made }>
}

export const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!

const add = (a: number, b: number): Made => ({ prompt: `${a} + ${b}`, answer: a + b })
const sub = (a: number, b: number): Made => ({ prompt: `${a} − ${b}`, answer: a - b })
const mul = (a: number, b: number): Made => ({ prompt: `${a} × ${b}`, answer: a * b })
const div = (b: number, q: number): Made => ({ prompt: `${b * q} ÷ ${b}`, answer: q })

export const SKILLS: Skill[] = [
  {
    id: 'add',
    name: 'Addition',
    unlockLevel: 1,
    tier: 1,
    steps: [
      { targetSeconds: 3, make: r => add(int(r, 2, 9), int(r, 2, 9)) },
      { targetSeconds: 4, make: r => add(int(r, 6, 20), int(r, 6, 20)) },
      { targetSeconds: 5, make: r => add(int(r, 21, 99), int(r, 3, 9)) },
      { targetSeconds: 6, make: r => add(int(r, 21, 99), int(r, 21, 99)) },
      { targetSeconds: 8, make: r => add(int(r, 101, 999), int(r, 21, 99)) },
      { targetSeconds: 10, make: r => add(int(r, 101, 999), int(r, 101, 999)) },
    ],
  },
  {
    id: 'sub',
    name: 'Subtraction',
    unlockLevel: 2,
    tier: 1,
    steps: [
      { targetSeconds: 3, make: r => { const a = int(r, 6, 20); return sub(a, int(r, 2, a - 2)) } },
      { targetSeconds: 5, make: r => sub(int(r, 21, 99), int(r, 3, 9)) },
      { targetSeconds: 6, make: r => { const a = int(r, 40, 99); return sub(a, int(r, 11, a - 10)) } },
      { targetSeconds: 8, make: r => sub(int(r, 101, 999), int(r, 11, 99)) },
      { targetSeconds: 10, make: r => { const a = int(r, 300, 999); return sub(a, int(r, 101, a - 50)) } },
    ],
  },
  {
    id: 'mul',
    name: 'Multiplication',
    unlockLevel: 3,
    tier: 2,
    steps: [
      { targetSeconds: 3, make: r => mul(int(r, 2, 5), int(r, 2, 9)) },
      { targetSeconds: 4, make: r => mul(int(r, 3, 9), int(r, 3, 9)) },
      { targetSeconds: 5, make: r => mul(int(r, 6, 12), int(r, 6, 12)) },
      { targetSeconds: 7, make: r => mul(int(r, 13, 19), int(r, 3, 9)) },
      { targetSeconds: 9, make: r => mul(int(r, 21, 99), int(r, 3, 9)) },
      { targetSeconds: 15, make: r => mul(int(r, 11, 25), int(r, 11, 25)) },
    ],
  },
  {
    id: 'div',
    name: 'Division',
    unlockLevel: 4,
    tier: 2,
    steps: [
      { targetSeconds: 4, make: r => div(int(r, 2, 5), int(r, 2, 9)) },
      { targetSeconds: 5, make: r => div(int(r, 3, 9), int(r, 3, 9)) },
      { targetSeconds: 6, make: r => div(int(r, 6, 12), int(r, 6, 12)) },
      { targetSeconds: 9, make: r => div(int(r, 3, 9), int(r, 12, 99)) },
    ],
  },
  {
    id: 'sq',
    name: 'Squares',
    unlockLevel: 5,
    tier: 3,
    steps: [
      { targetSeconds: 3, make: r => { const n = int(r, 2, 12); return { prompt: `${n}²`, answer: n * n } } },
      { targetSeconds: 6, make: r => { const n = int(r, 13, 20); return { prompt: `${n}²`, answer: n * n } } },
      { targetSeconds: 8, make: r => { const n = 10 * int(r, 2, 9) + 5; return { prompt: `${n}²`, answer: n * n } } },
      { targetSeconds: 12, make: r => { const n = int(r, 21, 50); return { prompt: `${n}²`, answer: n * n } } },
    ],
  },
  {
    id: 'pct',
    name: 'Percentages',
    unlockLevel: 6,
    tier: 3,
    steps: [
      { targetSeconds: 4, make: r => { const p = pick(r, [10, 50]); const n = 10 * int(r, 2, 40); return { prompt: `${p}% of ${n}`, answer: (p * n) / 100 } } },
      { targetSeconds: 6, make: r => { const p = pick(r, [20, 25, 75]); const n = 20 * int(r, 2, 25); return { prompt: `${p}% of ${n}`, answer: (p * n) / 100 } } },
      { targetSeconds: 8, make: r => { const p = pick(r, [5, 15, 30, 40, 60]); const n = 20 * int(r, 2, 30); return { prompt: `${p}% of ${n}`, answer: (p * n) / 100 } } },
      { targetSeconds: 12, make: r => { const p = pick(r, [35, 45, 55, 65, 85]); const n = 100 * int(r, 1, 9) + 20 * int(r, 0, 4); return { prompt: `${p}% of ${n}`, answer: (p * n) / 100 } } },
    ],
  },
  {
    id: 'chain',
    name: 'Chains',
    unlockLevel: 8,
    tier: 4,
    steps: [
      { targetSeconds: 6, make: r => { const a = int(r, 5, 30), b = int(r, 2, 20), c = int(r, 1, a + b - 1); return { prompt: `${a} + ${b} − ${c}`, answer: a + b - c } } },
      { targetSeconds: 8, make: r => { const a = int(r, 3, 12), b = int(r, 3, 12), c = int(r, 2, 30); return { prompt: `${a} × ${b} + ${c}`, answer: a * b + c } } },
      { targetSeconds: 10, make: r => { const a = int(r, 6, 12), b = int(r, 6, 12), c = int(r, 2, 9), d = int(r, 2, 5); return { prompt: `${a} × ${b} − ${c} × ${d}`, answer: a * b - c * d } } },
      { targetSeconds: 14, make: r => { const a = int(r, 11, 30), b = int(r, 3, 9), c = int(r, 2, 9), d = int(r, 2, 9); return { prompt: `${a} × ${b} + ${c} × ${d}`, answer: a * b + c * d } } },
    ],
  },
  {
    id: 'pow',
    name: 'Powers',
    unlockLevel: 10,
    tier: 4,
    steps: [
      { targetSeconds: 4, make: r => { const n = int(r, 3, 10); return { prompt: `2^${n}`, answer: 2 ** n } } },
      { targetSeconds: 6, make: r => { const n = int(r, 2, 6); return { prompt: `${n}³`, answer: n ** 3 } } },
      { targetSeconds: 8, make: r => { const b = pick(r, [3, 5]), n = int(r, 2, b === 3 ? 6 : 4); return { prompt: `${b}^${n}`, answer: b ** n } } },
      { targetSeconds: 10, make: r => { const n = int(r, 11, 16); return { prompt: `2^${n}`, answer: 2 ** n } } },
    ],
  },
]

export const skillById = (id: string): Skill => SKILLS.find(s => s.id === id) ?? SKILLS[0]!
