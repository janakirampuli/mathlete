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
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

const add = (a: number, b: number): Made => ({ prompt: `${a} + ${b}`, answer: a + b })
const sub = (a: number, b: number): Made => ({ prompt: `${a} − ${b}`, answer: a - b })
const mul = (a: number, b: number): Made => ({ prompt: `${a} × ${b}`, answer: a * b })
const div = (b: number, q: number): Made => ({ prompt: `${b * q} ÷ ${b}`, answer: q })
const pow = (b: number, n: number): Made => ({ prompt: n === 2 ? `${b}²` : n === 3 ? `${b}³` : `${b}^${n}`, answer: b ** n })
const mod = (a: number, b: number): Made => ({ prompt: `${a} mod ${b}`, answer: a % b })
// a/b of n, with n a multiple of b so the answer is whole.
const fracOf = (a: number, b: number, k: number): Made => ({ prompt: `${a}/${b} of ${b * k}`, answer: a * k })
const pctOf = (p: number, n: number): Made => ({ prompt: `${p}% of ${n}`, answer: (p * n) / 100 })

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
      { targetSeconds: 13, make: r => add(int(r, 1001, 9999), int(r, 101, 999)) },
      { targetSeconds: 16, make: r => add(int(r, 1001, 9999), int(r, 1001, 9999)) },
      {
        targetSeconds: 18,
        make: r => {
          const a = int(r, 101, 999), b = int(r, 101, 999), c = int(r, 101, 999)
          return { prompt: `${a} + ${b} + ${c}`, answer: a + b + c }
        },
      },
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
      { targetSeconds: 13, make: r => sub(int(r, 1001, 9999), int(r, 101, 999)) },
      { targetSeconds: 16, make: r => { const a = int(r, 3000, 9999); return sub(a, int(r, 1001, a - 500)) } },
      { targetSeconds: 20, make: r => sub(int(r, 10001, 99999), int(r, 1001, 9999)) },
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
      { targetSeconds: 14, make: r => mul(int(r, 11, 25), int(r, 11, 25)) },
      { targetSeconds: 18, make: r => mul(int(r, 26, 99), int(r, 11, 19)) },
      { targetSeconds: 22, make: r => mul(int(r, 31, 99), int(r, 31, 99)) },
      { targetSeconds: 30, make: r => mul(int(r, 101, 399), int(r, 11, 29)) },
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
      { targetSeconds: 12, make: r => div(int(r, 11, 19), int(r, 11, 49)) },
      { targetSeconds: 15, make: r => div(int(r, 3, 9), int(r, 112, 999)) },
      { targetSeconds: 18, make: r => div(int(r, 21, 49), int(r, 12, 99)) },
      { targetSeconds: 25, make: r => div(int(r, 11, 99), int(r, 101, 399)) },
    ],
  },
  {
    id: 'sq',
    name: 'Squares',
    unlockLevel: 5,
    tier: 3,
    steps: [
      { targetSeconds: 3, make: r => pow(int(r, 2, 12), 2) },
      { targetSeconds: 6, make: r => pow(int(r, 13, 20), 2) },
      { targetSeconds: 8, make: r => pow(10 * int(r, 2, 9) + 5, 2) },
      { targetSeconds: 12, make: r => pow(int(r, 21, 50), 2) },
      { targetSeconds: 15, make: r => pow(int(r, 51, 99), 2) },
      { targetSeconds: 15, make: r => pow(10 * int(r, 10, 19) + 5, 2) },
      { targetSeconds: 18, make: r => pow(int(r, 101, 130), 2) },
      { targetSeconds: 25, make: r => pow(int(r, 131, 199), 2) },
    ],
  },
  {
    id: 'pct',
    name: 'Percentages',
    unlockLevel: 6,
    tier: 3,
    steps: [
      { targetSeconds: 4, make: r => pctOf(pick(r, [10, 50]), 10 * int(r, 2, 40)) },
      { targetSeconds: 6, make: r => pctOf(pick(r, [20, 25, 75]), 20 * int(r, 2, 25)) },
      { targetSeconds: 8, make: r => pctOf(pick(r, [5, 15, 30, 40, 60]), 20 * int(r, 2, 30)) },
      { targetSeconds: 12, make: r => pctOf(pick(r, [35, 45, 55, 65, 85]), 100 * int(r, 1, 9) + 20 * int(r, 0, 4)) },
      { targetSeconds: 14, make: r => pctOf(pick(r, [12, 24, 36, 48, 64]), 25 * int(r, 4, 40)) },
      { targetSeconds: 15, make: r => pctOf(int(r, 11, 99), 100 * int(r, 2, 19)) },
      {
        targetSeconds: 15,
        make: r => {
          const p = 5 * int(r, 1, 19), b = 20 * int(r, 3, 45)
          return { prompt: `${(p * b) / 100} is ?% of ${b}`, answer: p }
        },
      },
      {
        targetSeconds: 18,
        make: r => {
          const p = 5 * int(r, 1, 19), a = 20 * int(r, 3, 45)
          return { prompt: `${a} → ${a + (p * a) / 100} is +?%`, answer: p }
        },
      },
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
      { targetSeconds: 14, make: r => { const a = int(r, 11, 49), b = int(r, 11, 49), c = int(r, 3, 9); return { prompt: `(${a} + ${b}) × ${c}`, answer: (a + b) * c } } },
      { targetSeconds: 14, make: r => { const a = int(r, 3, 12), b = int(r, 3, 12), c = int(r, 3, 12); return { prompt: `${a} × ${b} × ${c}`, answer: a * b * c } } },
      { targetSeconds: 15, make: r => { const a = int(r, 31, 99), b = int(r, 11, a - 1); return { prompt: `${a}² − ${b}²`, answer: a * a - b * b } } },
      {
        targetSeconds: 22,
        make: r => {
          const a = int(r, 11, 30), b = int(r, 4, 9), c = int(r, 11, 30), d = int(r, 4, 9), e = int(r, 2, 9), f = int(r, 2, 9)
          return { prompt: `${a} × ${b} + ${c} × ${d} − ${e} × ${f}`, answer: a * b + c * d - e * f }
        },
      },
    ],
  },
  {
    id: 'pow',
    name: 'Powers & Roots',
    unlockLevel: 10,
    tier: 4,
    steps: [
      { targetSeconds: 4, make: r => pow(2, int(r, 3, 10)) },
      { targetSeconds: 6, make: r => pow(int(r, 2, 6), 3) },
      { targetSeconds: 8, make: r => { const b = pick(r, [3, 5]); return pow(b, int(r, 2, b === 3 ? 6 : 4)) } },
      { targetSeconds: 10, make: r => pow(2, int(r, 11, 16)) },
      { targetSeconds: 12, make: r => pow(int(r, 7, 12), 3) },
      { targetSeconds: 12, make: r => { const n = int(r, 11, 99); return { prompt: `√${n * n}`, answer: n } } },
      { targetSeconds: 14, make: r => { const n = int(r, 5, 25); return { prompt: `∛${n ** 3}`, answer: n } } },
      { targetSeconds: 18, make: r => pow(int(r, 6, 9), int(r, 3, 4)) },
    ],
  },
  {
    id: 'mod',
    name: 'Remainders',
    unlockLevel: 12,
    tier: 5,
    steps: [
      { targetSeconds: 5, make: r => mod(int(r, 20, 99), int(r, 3, 9)) },
      { targetSeconds: 8, make: r => mod(int(r, 101, 999), int(r, 3, 9)) },
      { targetSeconds: 12, make: r => mod(int(r, 101, 999), int(r, 11, 19)) },
      { targetSeconds: 15, make: r => mod(int(r, 1001, 9999), int(r, 7, 13)) },
      { targetSeconds: 20, make: r => mod(int(r, 1001, 9999), int(r, 17, 37)) },
    ],
  },
  {
    id: 'frac',
    name: 'Fractions',
    unlockLevel: 14,
    tier: 5,
    steps: [
      { targetSeconds: 5, make: r => { const [a, b] = pick(r, [[1, 2], [1, 4], [3, 4]] as const); return fracOf(a, b, int(r, 4, 40)) } },
      { targetSeconds: 8, make: r => { const [a, b] = pick(r, [[2, 3], [3, 5], [5, 8], [4, 5], [7, 8]] as const); return fracOf(a, b, int(r, 6, 40)) } },
      {
        targetSeconds: 10,
        make: r => {
          const b = int(r, 7, 12)
          let a = int(r, 2, b - 1)
          while (gcd(a, b) !== 1) a = int(r, 2, b - 1)
          return fracOf(a, b, int(r, 11, 60))
        },
      },
      {
        targetSeconds: 15,
        make: r => {
          const [b, d] = pick(r, [[4, 6], [6, 8], [8, 12], [6, 9], [10, 15], [9, 12]] as const)
          const l = (b * d) / gcd(b, d)
          const a = int(r, 1, b - 1), c = int(r, 1, d - 1)
          return { prompt: `${a}/${b} + ${c}/${d} = ?/${l}`, answer: (a * l) / b + (c * l) / d }
        },
      },
      {
        targetSeconds: 18,
        make: r => {
          const [a, b] = pick(r, [[1, 2], [2, 3], [3, 4], [3, 5]] as const)
          const [c, d] = pick(r, [[1, 3], [2, 5], [3, 8], [5, 6]] as const)
          const k = int(r, 2, 12)
          return { prompt: `${a}/${b} of ${c}/${d} of ${b * d * k}`, answer: a * c * k }
        },
      },
    ],
  },
  {
    id: 'trick',
    name: 'Speed Tricks',
    unlockLevel: 16,
    tier: 5,
    steps: [
      { targetSeconds: 5, make: r => mul(int(r, 12, 99), 11) },
      { targetSeconds: 8, make: r => mul(int(r, 12, 99), 25) },
      { targetSeconds: 9, make: r => mul(int(r, 101, 999), 11) },
      { targetSeconds: 10, make: r => mul(int(r, 12, 99), 99) },
      { targetSeconds: 12, make: r => mul(int(r, 12, 99), 125) },
      { targetSeconds: 14, make: r => mul(int(r, 101, 999), 999) },
    ],
  },
  {
    id: 'big',
    name: 'Big Products',
    unlockLevel: 18,
    tier: 6,
    steps: [
      { targetSeconds: 10, make: r => mul(int(r, 101, 999), int(r, 3, 9)) },
      { targetSeconds: 14, make: r => mul(int(r, 1001, 9999), int(r, 3, 9)) },
      { targetSeconds: 25, make: r => mul(int(r, 101, 999), int(r, 11, 49)) },
      { targetSeconds: 35, make: r => mul(int(r, 101, 999), int(r, 51, 99)) },
      { targetSeconds: 45, make: r => mul(int(r, 101, 999), int(r, 101, 999)) },
    ],
  },
]

export const skillById = (id: string): Skill => SKILLS.find(s => s.id === id) ?? SKILLS[0]!
