import type { Profile, Question } from '../types'
import { SKILLS, skillById } from './skills'

export type AnswerContext = {
  question: Question
  isCorrect: boolean
  seconds: number
  now: number
  level: number
}

export type Achievement = {
  id: string
  name: string
  description: string
  // Checked after each answer against the profile that answer produced.
  check: (profile: Profile, answer: AnswerContext) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: 'First Blood', description: 'Get your first answer right', check: p => p.solved >= 1 },
  { id: 'streak10', name: 'On a Roll', description: '10 right in a row', check: p => p.streak >= 10 },
  { id: 'streak25', name: 'Unstoppable', description: '25 right in a row', check: p => p.streak >= 25 },
  { id: 'streak50', name: 'Machine', description: '50 right in a row', check: p => p.streak >= 50 },
  { id: 'quick', name: 'Quick Draw', description: 'A right answer in under 2 seconds', check: (p, a) => a.isCorrect && a.seconds < 2 },
  {
    id: 'blitz',
    name: 'Blitz',
    description: 'Beat half the target time on a skill’s hardest step',
    check: (p, a) =>
      a.isCorrect && a.question.step === skillById(a.question.skill).steps.length - 1 && a.seconds <= a.question.targetSeconds / 2,
  },
  {
    id: 'topshelf',
    name: 'Top Shelf',
    description: 'Get a skill’s hardest step right',
    check: (p, a) => a.isCorrect && a.question.step === skillById(a.question.skill).steps.length - 1,
  },
  { id: 'solved100', name: 'Centurion', description: 'Solve 100 questions', check: p => p.solved >= 100 },
  { id: 'solved1000', name: 'Thousand Club', description: 'Solve 1,000 questions', check: p => p.solved >= 1000 },
  { id: 'days3', name: 'Habit Forming', description: 'Play 3 days in a row', check: p => p.dayStreak >= 3 },
  { id: 'days7', name: 'Week Warrior', description: 'Play 7 days in a row', check: p => p.dayStreak >= 7 },
  { id: 'days30', name: 'Monthly Mathlete', description: 'Play 30 days in a row', check: p => p.dayStreak >= 30 },
  { id: 'lv5', name: 'Climber', description: 'Reach level 5', check: (p, a) => a.level >= 5 },
  { id: 'lv10', name: 'Summit', description: 'Reach level 10', check: (p, a) => a.level >= 10 },
  { id: 'lv20', name: 'Stratosphere', description: 'Reach level 20', check: (p, a) => a.level >= 20 },
  {
    id: 'rounded',
    name: 'Well Rounded',
    description: 'Solve 10 of every skill',
    check: p => SKILLS.every(s => (p.skills[s.id]?.solved ?? 0) >= 10),
  },
  {
    id: 'night',
    name: 'Night Owl',
    description: 'Get one right between midnight and 4am',
    check: (p, a) => a.isCorrect && new Date(a.now).getHours() < 4,
  },
]
