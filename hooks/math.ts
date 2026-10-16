import type { DayRecord, Profile, Question, SkillRecord } from '../types'
import { ACHIEVEMENTS } from './achievements'
import type { Achievement } from './achievements'
import { SKILLS, skillById } from './skills'
import type { Rng, Skill } from './skills'

export type { Rng } from './skills'

// Ratings are Elo-style: a skill starts at 1000 and each difficulty step of a
// skill has a fixed rating. A question is picked so the chance of getting it
// right is about 70%.
const START_RATING = 1000
const STEP_RATING = (step: number) => 800 + 120 * step
const TARGET_GAP = 150 // rating − question rating where P(correct) ≈ 0.7

// Past the warm-up levels each level lifts every skill's rating floor, so a
// high level never gets easy questions however few answers a skill has had,
// and a skill unlocked late starts at the level's difficulty.
const FLOOR_FREE_LEVELS = 3
const FLOOR_PER_LEVEL = 100

export const EMPTY_PROFILE: Profile = {
  xp: 0,
  streak: 0,
  bestStreak: 0,
  solved: 0,
  attempted: 0,
  fastest: null,
  skills: {},
  dayStreak: 0,
  bestDayStreak: 0,
  lastDay: null,
  achievements: {},
  daily: {},
  trend: {},
}

// Fills in fields older saves lack, so an earlier profile keeps its progress.
export function normalizeProfile(raw: unknown): Profile {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<Profile>
  return {
    ...EMPTY_PROFILE,
    ...p,
    skills: { ...(p.skills ?? {}) },
    achievements: { ...(p.achievements ?? {}) },
    daily: { ...(p.daily ?? {}) },
    trend: { ...(p.trend ?? {}) },
  }
}

const DAYS_KEPT = 60
const TREND_KEPT = 30

export const xpForLevel = (level: number) => 50 * (level - 1) ** 2

export const levelFor = (xp: number) => Math.floor(Math.sqrt(xp / 50)) + 1

const TITLES: Array<[number, string]> = [
  [30, 'Human Calculator'],
  [20, 'Mental Math Master'],
  [15, 'Power Player'],
  [10, 'Chain Breaker'],
  [7, 'Percent Prodigy'],
  [5, 'Square Seeker'],
  [3, 'Times Table Tamer'],
  [1, 'Abacus Apprentice'],
]

export const titleFor = (level: number) => TITLES.find(([min]) => level >= min)![1]

export const unlockedSkills = (level: number) => SKILLS.filter(s => s.unlockLevel <= level)

export const skillRecord = (profile: Profile, id: string): SkillRecord =>
  profile.skills[id] ?? { rating: START_RATING, solved: 0, attempted: 0 }

export const levelFloor = (level: number) => START_RATING + FLOOR_PER_LEVEL * Math.max(0, level - FLOOR_FREE_LEVELS)

// The rating questions are picked by: the skill's own, or the level's floor.
export const effectiveRating = (profile: Profile, skill: Skill) =>
  Math.max(skillRecord(profile, skill.id).rating, levelFloor(levelFor(profile.xp)))

export const expected = (rating: number, questionRating: number) =>
  1 / (1 + 10 ** ((questionRating - rating) / 400))

// Weighted pick among unlocked skills: fresh unlocks and weak skills come up
// more, and the skill just asked comes up less.
export function chooseSkill(profile: Profile, rng: Rng, previous?: string): Skill {
  const level = levelFor(profile.xp)
  const weighted = unlockedSkills(level).map(skill => {
    const aboveFloor = effectiveRating(profile, skill) - levelFloor(level)
    let w = 1 + Math.max(0, (100 - aboveFloor) / 300)
    if (skill.unlockLevel >= level - 1 && skill.unlockLevel > 1) w += 2
    if (skill.id === previous) w *= 0.3
    return { skill, w }
  })
  let roll = rng() * weighted.reduce((sum, x) => sum + x.w, 0)
  for (const { skill, w } of weighted) {
    roll -= w
    if (roll < 0) return skill
  }
  return weighted[weighted.length - 1]!.skill
}

// The step whose rating sits TARGET_GAP under the player's, with an
// occasional easier or harder one for variety.
export function chooseStep(skill: Skill, rating: number, rng: Rng): number {
  const ideal = Math.round((rating - TARGET_GAP - STEP_RATING(0)) / 120)
  const roll = rng()
  const jitter = roll < 0.2 ? -1 : roll > 0.85 ? 1 : 0
  return Math.max(0, Math.min(skill.steps.length - 1, ideal + jitter))
}

export function nextQuestion(profile: Profile, rng: Rng, previous?: Question | null): Question {
  for (let tries = 0; ; tries++) {
    const skill = chooseSkill(profile, rng, previous?.skill)
    const step = chooseStep(skill, effectiveRating(profile, skill), rng)
    const { targetSeconds, make } = skill.steps[step]!
    const { prompt, answer } = make(rng)
    if (prompt !== previous?.prompt || tries >= 5) {
      return { skill: skill.id, step, prompt, answer, targetSeconds, startedAt: null }
    }
  }
}

export function parseAnswer(text: string): number | null {
  const cleaned = text.replace(/[\s,_]/g, '').replace(/^−/, '-')
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  return Number(cleaned)
}

// 1 for right within the target time, sliding to 0.6 at three times it; 0 for wrong.
export function outcome(isCorrect: boolean, seconds: number, targetSeconds: number): number {
  if (!isCorrect) return 0
  if (seconds <= targetSeconds) return 1
  return Math.max(0.6, 1 - (0.4 * (seconds - targetSeconds)) / (2 * targetSeconds))
}

// XP for a right answer: skill tier and step, up to 2× for beating the target
// time, up to 2× for a streak.
export function xpFor(question: Question, seconds: number, streak: number): number {
  const skill = skillById(question.skill)
  const base = 10 * skill.tier * (1 + 0.25 * question.step)
  const speed = 1 + Math.min(1, Math.max(0, (question.targetSeconds - seconds) / question.targetSeconds))
  const streakMult = Math.min(1 + 0.05 * streak, 1.5)
  return Math.round(base * speed * streakMult)
}

export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dayBefore = (ms: number) => {
  const d = new Date(ms)
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime())
}

export type Graded = {
  profile: Profile
  isCorrect: boolean
  gained: number
  leveledUp: boolean
  unlocked: Skill[]
  earned: Achievement[]
}

export function grade(before: Profile, q: Question, given: number, seconds: number, now: number): Graded {
  const isCorrect = given === q.answer
  const gained = isCorrect ? xpFor(q, seconds, before.streak) : 0
  const streak = isCorrect ? before.streak + 1 : 0

  const record = skillRecord(before, q.skill)
  const from = effectiveRating(before, skillById(q.skill))
  const k = record.attempted < 15 ? 48 : 32
  const rating = from + k * (outcome(isCorrect, seconds, q.targetSeconds) - expected(from, STEP_RATING(q.step)))

  const today = dayKey(now)
  const dayStreak = !isCorrect || before.lastDay === today ? before.dayStreak : before.lastDay === dayBefore(now) ? before.dayStreak + 1 : 1

  const day: DayRecord = before.daily[today] ?? { xp: 0, solved: 0, attempted: 0 }
  const daily = Object.fromEntries(
    Object.entries({
      ...before.daily,
      [today]: { xp: day.xp + gained, solved: day.solved + (isCorrect ? 1 : 0), attempted: day.attempted + 1 },
    })
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-DAYS_KEPT),
  )

  const profile: Profile = {
    ...before,
    xp: before.xp + gained,
    streak,
    bestStreak: Math.max(before.bestStreak, streak),
    solved: before.solved + (isCorrect ? 1 : 0),
    attempted: before.attempted + 1,
    fastest: isCorrect && (before.fastest === null || seconds < before.fastest) ? seconds : before.fastest,
    skills: {
      ...before.skills,
      [q.skill]: {
        rating: Math.round(rating),
        solved: record.solved + (isCorrect ? 1 : 0),
        attempted: record.attempted + 1,
      },
    },
    dayStreak,
    bestDayStreak: Math.max(before.bestDayStreak, dayStreak),
    lastDay: isCorrect ? today : before.lastDay,
    daily,
    trend: { ...before.trend, [q.skill]: [...(before.trend[q.skill] ?? []), Math.round(rating)].slice(-TREND_KEPT) },
  }

  const fromLevel = levelFor(before.xp)
  const to = levelFor(profile.xp)
  const unlocked = SKILLS.filter(s => s.unlockLevel > fromLevel && s.unlockLevel <= to)

  const answer = { question: q, isCorrect, seconds, now, level: to }
  const earned = ACHIEVEMENTS.filter(a => !before.achievements[a.id] && a.check(profile, answer))
  for (const a of earned) profile.achievements = { ...profile.achievements, [a.id]: today }

  return { profile, isCorrect, gained, leveledUp: to > fromLevel, unlocked, earned }
}

export function levelProgress(profile: Profile) {
  const level = levelFor(profile.xp)
  return { level, into: profile.xp - xpForLevel(level), span: xpForLevel(level + 1) - xpForLevel(level) }
}

export function progressBar(profile: Profile, width: number): string {
  const { into, span } = levelProgress(profile)
  const filled = Math.round((into / span) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export function statusLine(profile: Profile, isPaused = false): string {
  const { level, into, span } = levelProgress(profile)
  const streak = profile.streak > 0 ? ` · 🔥${profile.streak}` : ''
  return `🧮 Lv ${level} · ${into}/${span} XP${streak}${isPaused ? ' · paused' : ''}`
}

const BARS = '▁▂▃▄▅▆▇█'

// One character per value, scaled between the smallest and largest; flat data
// draws at the bottom, or empty when it is all zero.
export function sparkline(values: readonly number[]): string {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  return values
    .map(v => (hi === lo ? (v === 0 ? ' ' : BARS[3]) : BARS[Math.round(((v - lo) / (hi - lo)) * (BARS.length - 1))]))
    .join('')
}

// The last `n` day keys up to the day of `now`, oldest first.
export function lastDays(now: number, n: number): string[] {
  const d = new Date(now)
  return Array.from({ length: n }, (_, i) => dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - (n - 1 - i)).getTime()))
}

export const stars = (step: number, steps: number) => '★'.repeat(step + 1) + '☆'.repeat(steps - step - 1)

export const pct = (solved: number, attempted: number) => (attempted === 0 ? '–' : `${Math.round((100 * solved) / attempted)}%`)

export function statsText(profile: Profile, isPaused: boolean): string {
  const { level, into, span } = levelProgress(profile)
  const lines = [
    `🧮 Level ${level} · ${titleFor(level)}${isPaused ? '  (paused: /math resume)' : ''}`,
    `${progressBar(profile, 24)}  ${into}/${span} XP  (total ${profile.xp})`,
    `Solved ${profile.solved} of ${profile.attempted} (${pct(profile.solved, profile.attempted)}) · streak ${profile.streak} · best ${profile.bestStreak}` +
      ` · days ${profile.dayStreak} (best ${profile.bestDayStreak})` +
      (profile.fastest === null ? '' : ` · fastest ${profile.fastest.toFixed(1)}s`),
    `Achievements ${Object.keys(profile.achievements).length}/${ACHIEVEMENTS.length}`,
    '',
    'Skill            Rating  Accuracy',
  ]
  for (const skill of SKILLS) {
    const name = skill.name.padEnd(16)
    if (skill.unlockLevel > level) {
      lines.push(`${name} 🔒 Lv ${skill.unlockLevel}`)
      continue
    }
    const r = skillRecord(profile, skill.id)
    lines.push(`${name} ${String(effectiveRating(profile, skill)).padStart(6)}  ${pct(r.solved, r.attempted).padStart(8)}  (${r.solved}/${r.attempted})`)
  }
  lines.push('', 'While Claude works, ctrl+x tab (or click) focuses the band above the prompt; Esc returns.', '/math opens the stats pane; /math pause and /math resume turn the questions off and on.')
  return lines.join('\n')
}
