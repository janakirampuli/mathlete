import { expect, test } from 'claude-code/testing'

import type { Question } from '../types'
import {
  EMPTY_PROFILE,
  chooseStep,
  effectiveRating,
  grade,
  levelFor,
  nextQuestion,
  normalizeProfile,
  parseAnswer,
  lastDays,
  sparkline,
  statsText,
  xpFor,
  xpForLevel,
} from '../hooks/math'
import { SKILLS, skillById } from '../hooks/skills'

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const DAY = 24 * 60 * 60 * 1000
const NOON = new Date(2026, 9, 16, 12).getTime()

const q = (over: Partial<Question> = {}): Question => ({
  skill: 'add', step: 0, prompt: '2 + 2', answer: 4, targetSeconds: 4, startedAt: 0, ...over,
})

test('levels follow 50·(L−1)²', async () => {
  expect(levelFor(0)).toBe(1)
  expect(levelFor(49)).toBe(1)
  expect(levelFor(50)).toBe(2)
  expect(levelFor(200)).toBe(3)
  expect(xpForLevel(4)).toBe(450)
})

test('every step of every skill gives a whole, non-negative answer', async () => {
  const rng = seeded(42)
  for (const skill of SKILLS) {
    skill.steps.forEach(({ make }, step) => {
      for (let i = 0; i < 300; i++) {
        const { prompt, answer } = make(rng)
        if (!Number.isInteger(answer) || answer < 0) throw new Error(`${skill.id} step ${step}: ${prompt} = ${answer}`)
      }
    })
  }
})

test('level 1 only asks addition; higher levels mix in unlocked skills', async () => {
  const rng = seeded(7)
  for (let i = 0; i < 50; i++) expect(nextQuestion(EMPTY_PROFILE, rng).skill).toBe('add')
  const seen = new Set<string>()
  const lv6 = { ...EMPTY_PROFILE, xp: xpForLevel(6) }
  for (let i = 0; i < 300; i++) seen.add(nextQuestion(lv6, rng).skill)
  expect([...seen].sort()).toEqual(['add', 'div', 'mul', 'pct', 'sq', 'sub'])
})

test('difficulty follows the rating', async () => {
  const rng = seeded(3)
  const mul = skillById('mul')
  const avg = (rating: number) => {
    let sum = 0
    for (let i = 0; i < 200; i++) sum += chooseStep(mul, rating, rng)
    return sum / 200
  }
  expect(avg(1000) < 0.5).toBe(true)
  expect(avg(1500) > 2.5).toBe(true)
  expect(avg(3000)).toBe(mul.steps.length - 1)
})

test('a player who keeps answering fast climbs in rating and difficulty', async () => {
  const rng = seeded(11)
  let p = EMPTY_PROFILE
  let last: Question | null = null
  for (let i = 0; i < 40; i++) {
    last = nextQuestion({ ...p, xp: 0 }, rng, last)
    p = grade(p, last, last.answer, 1, NOON).profile
  }
  expect(p.skills.add!.rating > 1250).toBe(true)
  expect(chooseStep(skillById('add'), p.skills.add!.rating, () => 0.5) >= 2).toBe(true)
  expect(p.streak).toBe(40)
})

test('wrong answers lower the rating and reset the streak', async () => {
  const before = { ...EMPTY_PROFILE, streak: 5 }
  const { profile, gained, isCorrect } = grade(before, q(), 5, 2, NOON)
  expect(isCorrect).toBe(false)
  expect(gained).toBe(0)
  expect(profile.streak).toBe(0)
  expect(profile.bestStreak).toBe(0)
  expect(profile.skills.add!.rating < 1000).toBe(true)
})

test('fast answers, harder steps and streaks earn more XP', async () => {
  expect(xpFor(q(), 10, 0)).toBe(10)
  expect(xpFor(q(), 0, 0)).toBe(20)
  expect(xpFor(q(), 0, 20)).toBe(30)
  expect(xpFor(q({ skill: 'mul', step: 2 }), 10, 0)).toBe(30)
})

test('crossing a level reports what it unlocked', async () => {
  const { leveledUp, unlocked } = grade({ ...EMPTY_PROFILE, xp: 195 }, q(), 4, 1, NOON)
  expect(leveledUp).toBe(true)
  expect(unlocked.map(s => s.id)).toEqual(['mul'])
})

test('the day streak counts consecutive days with a right answer', async () => {
  let p = grade(EMPTY_PROFILE, q(), 4, 1, NOON).profile
  expect(p.dayStreak).toBe(1)
  p = grade(p, q(), 4, 1, NOON + 1000).profile
  expect(p.dayStreak).toBe(1)
  p = grade(p, q(), 4, 1, NOON + DAY).profile
  expect(p.dayStreak).toBe(2)
  p = grade(p, q(), 4, 1, NOON + 3 * DAY).profile
  expect(p.dayStreak).toBe(1)
  expect(p.bestDayStreak).toBe(2)
})

test('a v0 profile keeps its progress', async () => {
  const p = normalizeProfile({ xp: 120, streak: 3, bestStreak: 4, solved: 9, attempted: 10 })
  expect(p.xp).toBe(120)
  expect(p.skills).toEqual({})
  expect(p.lastDay).toBe(null)
  expect(normalizeProfile(undefined)).toEqual(EMPTY_PROFILE)
})

test('answers parse loosely', async () => {
  expect(parseAnswer(' 1,024 ')).toBe(1024)
  expect(parseAnswer('−5')).toBe(-5)
  expect(parseAnswer('abc')).toBe(null)
  expect(parseAnswer('')).toBe(null)
})

test('stats list locked skills with their unlock level', async () => {
  const text = statsText({ ...EMPTY_PROFILE, xp: xpForLevel(3) }, false)
  expect(text).toContain('Times Table Tamer')
  expect(text).toMatch(/Division\s+🔒 Lv 4/)
  expect(text).toMatch(/Multiplication\s+1000/)
})

test('achievements are earned once, when their condition is first met', async () => {
  let r = grade(EMPTY_PROFILE, q(), 4, 1.5, NOON)
  expect(r.earned.map(a => a.id).sort()).toEqual(['first', 'quick'])
  r = grade(r.profile, q(), 4, 1.5, NOON)
  expect(r.earned).toEqual([])
  expect(Object.keys(r.profile.achievements).sort()).toEqual(['first', 'quick'])

  const nine = { ...r.profile, streak: 9 }
  expect(grade(nine, q(), 4, 3, NOON).earned.map(a => a.id)).toEqual(['streak10'])
  expect(grade(nine, q(), 5, 3, NOON).earned).toEqual([])
})

test('the hardest step earns Top Shelf, and Blitz when fast', async () => {
  const top = skillById('mul').steps.length - 1
  const hard = q({ skill: 'mul', step: top, targetSeconds: 30, prompt: '217 × 23', answer: 4991 })
  const p = { ...EMPTY_PROFILE, achievements: { first: 'x', quick: 'x' } }
  expect(grade(p, hard, 4991, 25, NOON).earned.map(a => a.id)).toEqual(['topshelf'])
  expect(grade(p, hard, 4991, 14, NOON).earned.map(a => a.id)).toEqual(['blitz', 'topshelf'])
})

test('levels 1 to 5 stay easy, and each level after lifts the difficulty floor', async () => {
  const rng = seeded(5)
  const steps = (xp: number, skill: string) => {
    const p = { ...EMPTY_PROFILE, xp }
    let sum = 0, n = 0
    for (let i = 0; i < 400; i++) {
      const question = nextQuestion(p, rng)
      if (question.skill === skill) (sum += question.step), n++
    }
    return sum / n
  }
  expect(steps(xpForLevel(5), 'add') < 1).toBe(true)
  expect(steps(xpForLevel(13), 'add') >= 4).toBe(true)
  expect(steps(xpForLevel(20), 'add') >= 7).toBe(true)
  expect(steps(xpForLevel(13), 'mod') < 1).toBe(true)

  const lv13 = { ...EMPTY_PROFILE, xp: xpForLevel(13) }
  expect(effectiveRating(lv13, skillById('add'))).toBe(1560)
  expect(effectiveRating(lv13, skillById('pow'))).toBe(1210)
  expect(effectiveRating({ ...lv13, skills: { add: { rating: 1700, solved: 50, attempted: 55 } } }, skillById('add'))).toBe(1700)
})

test('a right answer at a level floor lifts the skill rating to the floor', async () => {
  const lv13 = { ...EMPTY_PROFILE, xp: xpForLevel(13) }
  const hard = q({ step: 5, targetSeconds: 10, prompt: '512 + 487', answer: 999 })
  expect(grade(lv13, hard, 999, 5, NOON).profile.skills.add!.rating > 1560).toBe(true)
})

test('each answer adds to its day and the rating trend, both capped', async () => {
  let p = EMPTY_PROFILE
  for (let i = 0; i < 40; i++) p = grade(p, q(), i % 4 === 0 ? 5 : 4, 3, NOON).profile
  expect(p.daily['2026-10-16']).toEqual({ xp: p.xp, solved: 30, attempted: 40 })
  expect(p.trend.add!.length).toBe(30)

  for (let d = 1; d <= 70; d++) p = grade(p, q(), 4, 3, NOON + d * DAY).profile
  expect(Object.keys(p.daily).length).toBe(60)
  expect(Object.keys(p.daily).sort().at(-1)).toBe(lastDays(NOON + 70 * DAY, 1)[0])
})

test('sparklines scale between the lowest and highest value', async () => {
  expect(sparkline([0, 50, 100])).toBe('▁▅█')
  expect(sparkline([0, 0, 0])).toBe('   ')
  expect(sparkline([7, 7])).toBe('▄▄')
  expect(sparkline([])).toBe('')
  expect(lastDays(NOON, 3)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16'])
})
