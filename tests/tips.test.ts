import { expect, test } from 'claude-code/testing'

import { SKILLS } from '../hooks/skills'

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

// A small evaluator for the arithmetic in tips: + − × ÷ / ² ³ ^ and brackets.
function evaluate(text: string): number {
  const src = text.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/²/g, '^2').replace(/³/g, '^3')
  const tokens = src.match(/\d+(?:\.\d+)?|[-+*/^()]/g) ?? []
  let i = 0
  const peek = () => tokens[i]
  const take = () => tokens[i++]!
  const base = (): number => {
    const t = take()
    if (t === '(') {
      const v = expr()
      take()
      return v
    }
    if (t === '-') return -base()
    return Number(t)
  }
  const factor = (): number => {
    const b = base()
    if (peek() === '^') {
      take()
      return b ** factor()
    }
    return b
  }
  const term = (): number => {
    let v = factor()
    while (peek() === '*' || peek() === '/') v = take() === '*' ? v * factor() : v / factor()
    return v
  }
  const expr = (): number => {
    let v = term()
    while (peek() === '+' || peek() === '-') v = take() === '+' ? v + term() : v - term()
    return v
  }
  const v = expr()
  if (i !== tokens.length) throw new Error(`could not read ${text}`)
  return v
}

const isArithmetic = (s: string) => /^[\d(]/.test(s) && /^[\d\s.+\-−×÷/()²³^]+$/.test(s)

// Every "a = b" in a tip whose sides are both plain arithmetic must hold.
function checkTip(tip: string): string | null {
  for (const segment of tip.split(/[,;:→]/)) {
    const sides = segment.split('=').map(s => s.trim())
    for (let k = 0; k + 1 < sides.length; k++) {
      const [l, r] = [sides[k]!, sides[k + 1]!]
      if (isArithmetic(l) && isArithmetic(r) && Math.abs(evaluate(l) - evaluate(r)) > 1e-9) return `${l} ≠ ${r}`
    }
  }
  return null
}

test('the evaluator reads tips the way they are written', async () => {
  expect(evaluate('90 × 17 − 1 × 17')).toBe(1513)
  expect(evaluate('(70 − 3)²')).toBe(4489)
  expect(evaluate('70² − 2 × 70 × 3 + 3²')).toBe(4489)
  expect(evaluate('1024 × 2^3')).toBe(8192)
  expect(evaluate('3/8')).toBe(0.375)
  expect(checkTip('round and adjust: 89 × 17 = 90 × 17 − 1 × 17 = 1530 − 17 = 1513')).toBe(null)
  expect(checkTip('89 × 17 = 1512')).toBe('89 × 17 ≠ 1512')
})

test('every tip of every skill and step is right and ends at the answer', async () => {
  const rng = seeded(99)
  const problems: string[] = []
  for (const skill of SKILLS) {
    skill.steps.forEach(({ make }, step) => {
      for (let i = 0; i < 400; i++) {
        const { prompt, answer, tip } = make(rng)
        if (!tip) continue
        const wrong = checkTip(tip)
        const numbers = tip.match(/\d+(?:\.\d+)?/g) ?? []
        if (wrong) problems.push(`${skill.id}[${step}] ${prompt}: ${wrong} in "${tip}"`)
        else if (Number(numbers[numbers.length - 1]) !== answer) problems.push(`${skill.id}[${step}] ${prompt} = ${answer}: tip ends elsewhere: "${tip}"`)
      }
    })
  }
  // One example per skill and step, so every kind of problem shows at once.
  const firsts = [...new Map(problems.map(p => [p.split(' ')[0], p])).values()]
  if (problems.length > 0) throw new Error(`${problems.length} bad tips:\n${firsts.join('\n')}`)
})

test('past the easiest steps nearly every question has a tip', async () => {
  const rng = seeded(7)
  const thin: string[] = []
  for (const skill of SKILLS) {
    skill.steps.forEach(({ make }, step) => {
      if (step === 0) return
      let withTip = 0
      for (let i = 0; i < 200; i++) if (make(rng).tip) withTip++
      if (withTip < 160) thin.push(`${skill.id}[${step}] ${withTip}/200`)
    })
  }
  expect(thin).toEqual([])
})
