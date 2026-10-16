// How to work a question out in your head, shown after a miss. Each tip is a
// chain of equalities built from the question's own numbers, so its
// arithmetic is right by construction; tests/tips.test.ts checks every one.

const fmt = (x: number) => String(Math.round(x * 10000) / 10000)
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)
const signed = (d: number) => (d < 0 ? `− ${-d}` : `+ ${d}`)

// 4026 → [4000, 20, 6]: the place-value parts of a number, zeros left out.
export function places(n: number): number[] {
  const parts: number[] = []
  const digits = String(n)
  for (let i = 0; i < digits.length; i++) {
    const part = Number(digits[i]) * 10 ** (digits.length - 1 - i)
    if (part > 0) parts.push(part)
  }
  return parts
}

// A running chain: start, then each part applied in turn, as "a + p = b, b + q = c".
function running(start: number, parts: readonly number[], op: '+' | '−'): string {
  let acc = start
  return parts
    .map(p => {
      const next = op === '+' ? acc + p : acc - p
      const step = `${fmt(acc)} ${op} ${fmt(p)} = ${fmt(next)}`
      acc = next
      return step
    })
    .join(', ')
}

const roundUp10 = (n: number) => Math.ceil(n / 10) * 10

export function tipAdd(a: number, b: number): string | undefined {
  const big = Math.max(a, b), small = Math.min(a, b), total = a + b
  if (big < 10 && total > 10) {
    const need = 10 - big
    return `make 10: ${big} + ${small} = ${big} + ${need} + ${small - need} = 10 + ${small - need} = ${total}`
  }
  if (total <= 20) return undefined
  if (small % 10 >= 7) {
    const r = roundUp10(small)
    return `round and adjust: ${big} + ${small} = ${big} + ${r} − ${r - small} = ${big + r} − ${r - small} = ${total}`
  }
  if (small < 10) {
    const ones = big % 10
    if (ones + small < 10) return `ones first: ${ones} + ${small} = ${ones + small}, ${big - ones} + ${ones + small} = ${total}`
    const r = roundUp10(big)
    return `bridge through ${r}: ${big} + ${r - big} = ${r}, ${r} + ${small - (r - big)} = ${total}`
  }
  return `add by place: ${running(big, places(small), '+')}`
}

export function tipAdd3(a: number, b: number, c: number): string {
  return `two at a time: ${a} + ${b} = ${a + b}, ${a + b} + ${c} = ${a + b + c}`
}

export function tipSub(a: number, b: number): string | undefined {
  const diff = a - b
  if (a <= 20) return `count up from ${b}: ${b} + ${diff} = ${a} → ${diff}`
  const r = roundUp10(b)
  if (b % 10 >= 6 && r <= a) {
    return `round and adjust: ${a} − ${b} = ${a} − ${r} + ${r - b} = ${a - r} + ${r - b} = ${diff}`
  }
  if (b < 10) {
    const ones = a % 10, down = a - ones
    if (ones >= b) return `ones first: ${ones} − ${b} = ${ones - b}, ${down} + ${ones - b} = ${diff}`
    return `down to ${down}: ${a} − ${ones} = ${down}, ${down} − ${b - ones} = ${diff}`
  }
  return `take away by place: ${running(a, places(b), '−')}`
}

const NINES = new Set([99, 999])

export function tipMul(a: number, b: number): string | undefined {
  const x = Math.max(a, b), y = Math.min(a, b), product = a * b

  // Multiplier tricks.
  const trick = (m: number, n: number): string | undefined => {
    if (m === 11 && n >= 10 && n < 100) {
      const d1 = Math.floor(n / 10), d2 = n % 10
      return `×11: put ${d1} + ${d2} = ${d1 + d2} between ${d1} and ${d2}${d1 + d2 >= 10 ? ', carrying the 1' : ''} → ${product}`
    }
    if (m === 11 && n >= 100) return `×11 = ×10 + itself: ${n} × 11 = ${n} × 10 + ${n} = ${n * 10} + ${n} = ${product}`
    if (m === 25 && n > 12) return `×25 = ×100 ÷ 4: ${n} × 25 = ${n} × 100 ÷ 4 = ${n * 100} ÷ 4 = ${product}`
    if (m === 125) return `×125 = ×1000 ÷ 8: ${n} × 125 = ${n} × 1000 ÷ 8 = ${n * 1000} ÷ 8 = ${product}`
    if (NINES.has(m)) return `×${m} = ×${m + 1} − itself: ${n} × ${m} = ${n} × ${m + 1} − ${n} = ${n * (m + 1)} − ${n} = ${product}`
    return undefined
  }
  const special = trick(x, y) ?? trick(y, x)
  if (special) return special

  // Times tables.
  if (x <= 12 && y <= 12) {
    if (y === 9 || x === 9) {
      const n = y === 9 ? x : y
      return `×9 = ×10 − itself: ${n} × 9 = ${n} × 10 − ${n} = ${n * 10} − ${n} = ${product}`
    }
    if (y === 5 || x === 5) {
      const n = y === 5 ? x : y
      return `×5 = half of ×10: ${n} × 5 = ${n} × 10 ÷ 2 = ${n * 10} ÷ 2 = ${product}`
    }
    if (y === 4 || y === 8) {
      const doubles = [x]
      while (doubles.length <= Math.log2(y)) doubles.push(doubles[doubles.length - 1]! * 2)
      return `double ${Math.log2(y)} times: ${doubles.slice(0, -1).map((d, i) => `${d} × 2 = ${doubles[i + 1]}`).join(', ')}`
    }
    if (y <= 2) return undefined
    return `step from one you know: ${x} × ${y} = ${x} × ${y - 1} + ${x} = ${x * (y - 1)} + ${x} = ${product}`
  }

  // A factor close to a round number: work with the round one, then adjust.
  // Near a hundred (97, 205) counts from up to 5 away, near a ten from 1 or 2;
  // rounding the smaller factor keeps the other one whole and easy.
  const near = [x, y]
    .filter(f => f >= 10)
    .map(f => {
      const r100 = Math.round(f / 100) * 100
      const r = r100 > 0 && Math.abs(f - r100) <= 5 ? r100 : Math.round(f / 10) * 10
      return { f, r, d: f - r, g: f === x ? y : x }
    })
    .filter(({ r, d, g }) => d !== 0 && (r % 100 === 0 ? Math.abs(d) <= 5 : Math.abs(d) <= 2) && (g < 100 || r % 100 === 0))
    .sort((p, q) => (p.r % 100 === 0 ? 0 : 1) - (q.r % 100 === 0 ? 0 : 1) || Math.abs(p.d) - Math.abs(q.d) || p.f - q.f)[0]
  if (near && near.g > 1) {
    const { f, r, d, g } = near
    return `round and adjust: ${f} × ${g} = ${r} × ${g} ${signed(d).replace(/\d+$/, `${Math.abs(d)} × ${g}`)} = ${r * g} ${signed(d * g)} = ${product}`
  }

  // Split one factor by place value and add the pieces.
  const [split, keep] = y >= 10 ? [y, x] : [x, y]
  const parts = places(split)
  if (parts.length < 2) return undefined
  return `split ${split}: ${keep} × ${split} = ${parts.map(p => `${keep} × ${p}`).join(' + ')} = ${parts.map(p => keep * p).join(' + ')} = ${product}`
}

// Divide in chunks: the biggest round multiple first, then what is left.
export function tipDiv(divisor: number, quotient: number): string | undefined {
  const n = divisor * quotient
  if (divisor <= 12 && quotient <= 12) return `times table backwards: ${divisor} × ${quotient} = ${n} → ${quotient}`
  const parts = places(quotient)
  let left = n
  const steps: string[] = []
  for (const p of parts) {
    steps.push(`${divisor} × ${p} = ${divisor * p}`)
    if (left - divisor * p > 0) steps.push(`${left} − ${divisor * p} = ${left - divisor * p}`)
    left -= divisor * p
  }
  return `chunk it: ${steps.join(', ')}; ${parts.join(' + ')} = ${quotient}`
}

export function tipSquare(n: number): string | undefined {
  const sq = n * n
  if (n <= 12) return `times table: ${n} × ${n} = ${sq}`
  if (n % 10 === 5) {
    const t = Math.floor(n / 10)
    return `ends in 5: ${t} × ${t + 1} = ${t * (t + 1)}, then write 25 → ${sq}`
  }
  const base = Math.round(n / 10) * 10
  const d = n - base
  return `${n}² = (${base} ${signed(d)})² = ${base}² ${signed(2 * base * d).replace(/\d+$/, `2 × ${base} × ${Math.abs(d)}`)} + ${Math.abs(d)}² = ${base * base} ${signed(2 * base * d)} + ${d * d} = ${sq}`
}

export function tipPercentOf(p: number, n: number): string {
  const answer = (p * n) / 100
  const ten = n / 10, one = n / 100
  if (p === 50) return `half: ${n} ÷ 2 = ${fmt(answer)}`
  if (p === 25 || p === 75) return `a quarter is ${n} ÷ 4 = ${fmt(n / 4)}${p === 75 ? `, ${fmt(n / 4)} × 3 = ${fmt(answer)}` : ''}`
  const tens = Math.floor(p / 10), rest = p % 10
  const pieces: string[] = [`10% = ${fmt(ten)}`]
  const values: number[] = []
  if (tens > 1) pieces.push(`${tens}0% = ${tens} × ${fmt(ten)} = ${fmt(tens * ten)}`)
  if (tens > 0) values.push(tens * ten)
  if (rest === 5) {
    pieces.push(`5% = ${fmt(ten)} ÷ 2 = ${fmt(ten / 2)}`)
    values.push(ten / 2)
  } else if (rest > 0) {
    pieces.push(`1% = ${fmt(one)}${rest > 1 ? `, ${rest}% = ${rest} × ${fmt(one)} = ${fmt(rest * one)}` : ''}`)
    values.push(rest * one)
  }
  if (values.length > 1) pieces.push(`${values.map(fmt).join(' + ')} = ${fmt(answer)}`)
  return `build from 10% and 1%: ${pieces.join(', ')}`
}

export function tipPercentIs(part: number, whole: number, p: number): string {
  return `1% of ${whole} = ${fmt(whole / 100)}, ${part} ÷ ${fmt(whole / 100)} = ${p}`
}

export function tipPercentChange(from: number, to: number, p: number): string {
  return `${to} − ${from} = ${to - from}, 1% of ${from} = ${fmt(from / 100)}, ${to - from} ÷ ${fmt(from / 100)} = ${p}`
}

// Products first, then add or take away left to right.
export function tipProducts(terms: ReadonlyArray<readonly [number, number, '+' | '−']>): string {
  const products = terms.map(([a, b]) => `${a} × ${b} = ${a * b}`)
  const values = terms.map(([a, b, sign]) => (sign === '−' ? -a * b : a * b))
  const chain = terms.map(([a, b, sign], i) => `${i === 0 ? '' : `${sign} `}${a * b}`).join(' ')
  return `products first: ${products.join(', ')}, ${chain} = ${sum(values)}`
}

export function tipThreeProduct(a: number, b: number, c: number): string {
  // Multiply the pair that lands on a round number first.
  const pairs: Array<[number, number, number]> = [[a, b, c], [a, c, b], [b, c, a]]
  const [p, q, r] = pairs.find(([p, q]) => (p * q) % 10 === 0) ?? pairs[0]!
  return `pick a nice pair: ${p} × ${q} = ${p * q}, ${p * q} × ${r} = ${p * q * r}`
}

export function tipDifferenceOfSquares(a: number, b: number): string {
  return `a² − b² = (a − b)(a + b): ${a}² − ${b}² = ${a - b} × ${a + b} = ${(a - b) * (a + b)}`
}

export function tipPowerOfTwo(n: number): string {
  if (n <= 10) {
    const seq = Array.from({ length: n }, (_, i) => 2 ** (i + 1))
    return `keep doubling: ${seq.join(' → ')}`
  }
  return `2^10 = 1024, so 2^${n} = 1024 × 2^${n - 10} = 1024 × ${2 ** (n - 10)} = ${2 ** n}`
}

export function tipPower(b: number, n: number): string {
  const seq = Array.from({ length: n }, (_, i) => b ** (i + 1))
  return `multiply up by ${b}: ${seq.map((v, i) => (i === 0 ? `${v}` : `${seq[i - 1]} × ${b} = ${v}`)).join(', ')}`
}

const SQUARE_ENDINGS: Record<number, string> = { 0: '0', 1: '1 or 9', 4: '2 or 8', 5: '5', 6: '4 or 6', 9: '3 or 7' }

export function tipSquareRoot(root: number): string {
  const n = root * root
  const lo = Math.floor(root / 10) * 10
  if (root % 10 === 0) return `${root / 10}² = ${(root / 10) ** 2}, so ${root}² = ${n} → ${root}`
  const mid = (lo + 5) ** 2
  const ending = `it ends in ${n % 10}, so the root ends in ${SQUARE_ENDINGS[n % 10]}`
  const pick = root % 10 === 5 ? ` → ${root}` : `; ${lo + 5}² = ${mid} and ${n} is ${n > mid ? 'above' : 'below'} it → ${root}`
  return `between ${lo}² = ${lo * lo} and ${lo + 10}² = ${(lo + 10) ** 2}; ${ending}${pick}`
}

const CUBE_ENDINGS: Record<number, number> = { 0: 0, 1: 1, 2: 8, 3: 7, 4: 4, 5: 5, 6: 6, 7: 3, 8: 2, 9: 9 }

export function tipCubeRoot(root: number): string {
  const n = root ** 3
  if (root < 10) return `known cube: ${root}³ = ${n} → ${root}`
  const thousands = Math.floor(n / 1000), tens = Math.floor(root / 10)
  return `last digit ${n % 10} → root ends in ${CUBE_ENDINGS[n % 10]}; ${thousands} thousand is past ${tens}³ = ${tens ** 3} → ${root}`
}

export function tipMod(a: number, b: number): string {
  const k = Math.floor(a / b)
  if (k <= 12) return `nearest multiple: ${b} × ${k} = ${b * k}, ${a} − ${b * k} = ${a - b * k}`
  let left = a
  const steps: string[] = []
  for (const p of places(k)) {
    steps.push(`${b} × ${p} = ${b * p}, ${left} − ${b * p} = ${left - b * p}`)
    left -= b * p
  }
  return `take away multiples of ${b}: ${steps.join(', ')}`
}

export function tipFractionOf(a: number, b: number, n: number): string {
  return `divide then multiply: ${n} ÷ ${b} = ${n / b}, ${n / b} × ${a} = ${(n / b) * a}`
}

export function tipFractionSum(a: number, b: number, c: number, d: number, l: number): string {
  const x = (a * l) / b, y = (c * l) / d
  return `same bottom: ${a}/${b} = ${x}/${l}, ${c}/${d} = ${y}/${l}, ${x} + ${y} = ${x + y}`
}

export function tipFractionOfFraction(a: number, b: number, c: number, d: number, n: number): string {
  const first = (n / d) * c
  return `one fraction at a time: ${n} ÷ ${d} × ${c} = ${first}, ${first} ÷ ${b} × ${a} = ${(first / b) * a}`
}
