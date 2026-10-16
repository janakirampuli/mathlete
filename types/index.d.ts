export type Question = {
  skill: string
  step: number
  prompt: string
  answer: number
  targetSeconds: number
  // When the question was revealed and its clock started; null while hidden.
  startedAt: number | null
  // Revealed by itself after the last answer, not by the person focusing the band.
  auto?: boolean
}

export type Feedback = { isCorrect: boolean; text: string }

export type SkillRecord = { rating: number; solved: number; attempted: number }

export type DayRecord = { xp: number; solved: number; attempted: number }

export type Profile = {
  xp: number
  streak: number
  bestStreak: number
  solved: number
  attempted: number
  fastest: number | null
  skills: Record<string, SkillRecord>
  // Days in a row with at least one correct answer; `lastDay` is YYYY-MM-DD.
  dayStreak: number
  bestDayStreak: number
  lastDay: string | null
  // Achievement id → the day it was earned.
  achievements: Record<string, string>
  // YYYY-MM-DD → that day's totals, the last 60 days kept.
  daily: Record<string, DayRecord>
  // Skill id → its rating after each of the last 30 answers.
  trend: Record<string, number[]>
}

declare module 'claude-code' {
  interface PluginState {
    'mathlete': {
      question: Question | null
      feedback: Feedback | null
      draft: string
      profile: Profile
      isPaused: boolean
      // The main loop's running turn, and the turn whose band delay has passed.
      currentTurn: string | null
      armedTurn: string | null
      // The time the countdown draws from, ticked once a second while a question is revealed.
      clock: number
      // Whether the /math play pane is open, and how this run of it went.
      isPlaying: boolean
      run: { solved: number; attempted: number }
    }
  }
}
