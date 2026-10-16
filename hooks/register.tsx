import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register } from 'claude-code'

import type { Feedback, Profile, Question } from '../types'
import { ACHIEVEMENTS } from './achievements'
import {
  EMPTY_PROFILE,
  chooseStep,
  effectiveRating,
  dayKey,
  grade,
  lastDays,
  levelProgress,
  nextQuestion,
  normalizeProfile,
  parseAnswer,
  pct,
  progressBar,
  skillRecord,
  sparkline,
  stars,
  statsText,
  statusLine,
  titleFor,
} from './math'
import { SKILLS, skillById } from './skills'

const PANE = 'mathlete'
const PLAY = 'mathlete-play'

type QuizElements = Pick<Elements['terminal'], 'Box' | 'Button' | 'Input' | 'Text'>

const question = atom({ plugin: 'mathlete', key: 'question' } as const, null)
const feedback = atom({ plugin: 'mathlete', key: 'feedback' } as const, null)
const draft = atom({ plugin: 'mathlete', key: 'draft' } as const, '')
const profile = atom({ plugin: 'mathlete', key: 'profile' } as const, EMPTY_PROFILE)
const isPaused = atom({ plugin: 'mathlete', key: 'isPaused' } as const, false)
const currentTurn = atom({ plugin: 'mathlete', key: 'currentTurn' } as const, null)
const armedTurn = atom({ plugin: 'mathlete', key: 'armedTurn' } as const, null)
const clock = atom({ plugin: 'mathlete', key: 'clock' } as const, 0)
const isPlaying = atom({ plugin: 'mathlete', key: 'isPlaying' } as const, false)
const run_ = atom({ plugin: 'mathlete', key: 'run' } as const, { solved: 0, attempted: 0 })

// Seconds a revealed question has before it times out: the setting, stretched
// for questions whose target time is long; 0 turns the limit off.
const limitFor = (q: Question, setting: number) => (setting <= 0 ? Infinity : Math.max(setting, Math.ceil(q.targetSeconds * 1.5)))

async function loadProfile($: EngineInterface): Promise<Profile> {
  return normalizeProfile(await $.store.get('profile'))
}

// The next question: hidden until the band is focused, or, while the person
// is solving one after another, revealed at once with its clock running.
async function freshQuestion($: EngineInterface, isSolving = false) {
  const previous = await read($, question)
  const p = await read($, profile)
  const startedAt = isSolving ? await $.clock.now() : null
  await update($, question, () => ({ ...nextQuestion(p, Math.random, previous), startedAt, auto: isSolving }))
  await update($, draft, () => '')
  if (startedAt !== null) await update($, clock, () => startedAt)
}

// The question shows, and its clock starts, when the person focuses the answer
// box, so reading Claude's output or working it out unseen never counts.
async function reveal($: EngineInterface) {
  const now = await $.clock.now()
  await update($, question, cur => (cur && cur.startedAt === null ? { ...cur, startedAt: now, auto: false } : cur))
  await update($, clock, () => now)
}

// /math play: practice on demand in a focused pane, the first question shown
// at once. Esc closes it.
async function play_($: EngineInterface) {
  await update($, isPlaying, () => true)
  await update($, run_, () => ({ solved: 0, attempted: 0 }))
  await update($, feedback, () => null)
  const q = await read($, question)
  if (!q || q.startedAt === null) await freshQuestion($, true)

  const opened = await $.ui.open({ id: PLAY, title: 'mathlete · practice', focus: true, closeOnEscape: true, rows: 5 })
  if (opened.isPlaced) return {}
  await update($, isPlaying, () => false)
  return { text: `🧮 Couldn't open the practice pane: ${opened.reason}` }
}

// Ends a practice run, however the pane closed. An untouched question that
// showed itself goes back to hidden without counting, as when walking away.
async function endPractice($: EngineInterface) {
  if (!(await read($, isPlaying))) return
  await update($, isPlaying, () => false)
  const q = await read($, question)
  if (q && q.startedAt !== null && (await read($, draft)) === '') await freshQuestion($)
}

async function stopPractice($: EngineInterface) {
  await endPractice($)
  await $.ui.close({ id: PLAY })
}

async function setPaused($: EngineInterface, paused: boolean) {
  await $.store.set('paused', paused)
  await update($, isPaused, () => paused)
  $.ui.status(statusLine(await read($, profile), paused))
}

function play($: EngineInterface, asset: string, hasSound: boolean) {
  if (hasSound) $.audio.play({ asset }).catch(() => undefined)
}

async function answer($: EngineInterface, text: string, hasSound: boolean) {
  const q = await read($, question)
  if (!q) return
  // Enter on a hidden question shows it: the way on after reading a tip.
  if (q.startedAt === null) {
    await reveal($)
    return
  }

  const given = parseAnswer(text)
  if (given === null) {
    await update($, feedback, (): Feedback => ({ isCorrect: false, text: 'Type a number' }))
    return
  }

  const now = await $.clock.now()
  const seconds = q.startedAt === null ? q.targetSeconds : (now - q.startedAt) / 1000
  const { isCorrect, gained } = await record($, q, given, seconds, now, hasSound)
  const text_ = isCorrect
    ? `✓ ${q.prompt} = ${q.answer}  +${gained} XP (${seconds.toFixed(1)}s)`
    : `✗ ${q.prompt} = ${q.answer}, not ${given}`
  await update($, feedback, (): Feedback => ({ isCorrect, text: text_, tip: isCorrect ? undefined : q.tip }))

  // After a miss the next question waits, so the tip can be read off the clock.
  await freshQuestion($, isCorrect)
}

// Out of time: a miss, unless the question revealed itself and the person
// never typed, which means they stepped away; then the run stops quietly.
async function timeOut($: EngineInterface, q: Question, now: number, hasSound: boolean) {
  if (q.auto && (await read($, draft)) === '') {
    await update($, feedback, (): Feedback => ({ isCorrect: false, text: `⏸ ${q.prompt} = ${q.answer} went unanswered; not counted`, tip: q.tip }))
    await freshQuestion($)
    if (await read($, isPlaying)) await stopPractice($)
    return
  }

  await record($, q, NaN, (now - (q.startedAt ?? now)) / 1000, now, hasSound)
  await update($, feedback, (): Feedback => ({ isCorrect: false, text: `⏱ Time's up: ${q.prompt} = ${q.answer}`, tip: q.tip }))
  await freshQuestion($)
}

// Once a second: move the countdown of a revealed question, and time it out
// once its limit has passed.
async function tick($: EngineInterface, timeLimit: number, hasSound: boolean) {
  const q = await read($, question)
  if (!q || q.startedAt === null) return

  const now = await $.clock.now()
  await update($, clock, () => now)
  if (now - q.startedAt >= limitFor(q, timeLimit) * 1000) await timeOut($, q, now, hasSound)
}

// Grades one answer against the stored profile (so another session's progress
// is kept), saves it, and celebrates level-ups and achievements.
async function record($: EngineInterface, q: Question, given: number, seconds: number, now: number, hasSound: boolean) {
  const result = grade(await loadProfile($), q, given, seconds, now)
  await $.store.set('profile', result.profile)
  await update($, profile, () => result.profile)
  if (await read($, isPlaying)) {
    await update($, run_, r => ({ solved: r.solved + (result.isCorrect ? 1 : 0), attempted: r.attempted + 1 }))
  }

  for (const a of result.earned) $.ui.toast(`🏆 ${a.name}: ${a.description}`)
  if (result.leveledUp) {
    const { level } = levelProgress(result.profile)
    const unlocks = result.unlocked.length > 0 ? ` Unlocked ${result.unlocked.map(s => s.name).join(', ')}.` : ''
    $.ui.toast(`🧮 Level ${level}: ${titleFor(level)}!${unlocks}`)
    play($, 'sounds/levelup.wav', hasSound)
  } else if (result.earned.length > 0) {
    play($, 'sounds/achievement.wav', hasSound)
  }
  $.ui.status(statusLine(result.profile))

  return result
}

// The question as the band and the practice pane both draw it: level and XP,
// the answer box with skip and countdown, and how the last answer went.
async function quiz($: EngineInterface, els: QuizElements, q: Question, columns: number, timeLimit: number, hasSound: boolean) {
  const { Box, Button, Input, Text } = els
  const p = await read($, profile)
  const fb = await read($, feedback)
  const value = await read($, draft)
  const { level, into, span } = levelProgress(p)
  const barWidth = Math.max(5, Math.min(20, columns - 50))
  const skill = skillById(q.skill)
  const isRevealed = q.startedAt !== null
  const label = !isRevealed
    ? `${stars(q.step, skill.steps.length)} ▸ `
    : q.prompt.includes('?')
      ? `${q.prompt}  `
      : `${q.prompt} = `
  const limit = limitFor(q, timeLimit)
  const left = q.startedAt === null || limit === Infinity ? null : Math.max(0, Math.ceil(limit - ((await read($, clock)) - q.startedAt) / 1000))

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>🧮 Lv {level} </Text>
        <Text dimColor>
          {progressBar(p, barWidth)} {into}/{span} XP
          {p.streak > 0 ? `  🔥 ${p.streak}` : ''}  · {skill.name}
        </Text>
      </Box>
      <Box>
        <Input
          key="answer"
          label={label}
          placeholder={isRevealed ? 'answer' : fb && !fb.isCorrect ? 'Enter for the next one' : 'ctrl+x tab to reveal'}
          submitLabel="check"
          value={value}
          autoFocus
          onInput={async text => {
            await update($, draft, () => text)
            await reveal($)
          }}
          onSubmit={text => answer($, text, hasSound)}
        />
        <Text> </Text>
        <Button key="skip" label="skip" onPress={() => freshQuestion($, isRevealed)} />
        {left !== null && <Text color={left <= 5 ? 'red' : undefined} dimColor={left > 5}>  ⏱ {left}s</Text>}
      </Box>
      {fb && <Text color={fb.isCorrect ? 'green' : 'red'}>{fb.text}</Text>}
      {fb?.tip && <Text dimColor>💡 {fb.tip}</Text>}
    </Box>
  )
}

export const register: Register = (on, options) => {
  const delayMs = Math.max(0, Number(options.delaySeconds ?? 0)) * 1000
  const hasSound = options.sound !== false
  const timeLimit = Number(options.timeLimitSeconds ?? 20)

  on('session.start', async ($, e, next) => {
    const loaded = await loadProfile($)
    const paused = (await $.store.get('paused')) === true
    await update($, profile, () => loaded)
    await update($, isPaused, () => paused)
    $.ui.status(statusLine(loaded, paused))

    // An unrevealed question kept in session state was picked for the profile
    // as it was, or by an older version of the mod: pick again.
    const q = await read($, question)
    if (q && (typeof (q as { skill?: unknown }).skill !== 'string' || q.startedAt === null)) await freshQuestion($)

    // Once a second while a question is revealed: move the countdown, and time
    // the question out when its limit has passed.
    $.clock.every(1000, () => void tick($, timeLimit, hasSound))

    await $.command.register({ name: 'math', description: 'mathlete stats pane; /math play, /math stats, /math pause, /math resume, /math reset' })

    return next(e)
  })

  on('command.run', { command: 'math' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'pause') {
      await setPaused($, true)
      return { text: '🧮 Paused. /math resume brings the questions back.' }
    }
    if (arg === 'resume') {
      await setPaused($, false)
      return { text: '🧮 Back on. Questions show while Claude works.' }
    }
    if (arg === 'play') return play_($)
    if (arg === 'reset') {
      return { text: '🧮 This wipes all mathlete progress: XP, level, ratings, streaks, achievements and history. Type /math reset yes to do it.' }
    }
    if (arg === 'reset yes') {
      await $.store.delete('profile')
      await $.store.delete('paused')
      await update($, profile, () => EMPTY_PROFILE)
      await update($, isPaused, () => false)
      await update($, feedback, () => null)
      await update($, question, () => null)
      await update($, draft, () => '')
      $.ui.status(statusLine(EMPTY_PROFILE))
      return { text: '🧮 Progress wiped. Back to level 1.' }
    }

    const loaded = await loadProfile($)
    await update($, profile, () => loaded)
    if (arg !== 'stats') {
      const opened = await $.ui.open({ id: PANE, title: 'mathlete', focus: true, closeOnEscape: true })
      if (opened.isPlaced) return {}
    }
    return { text: statsText(loaded, await read($, isPaused)) }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId) return next(e)

    const { turnId } = e
    await update($, currentTurn, () => turnId)
    if (delayMs === 0) await update($, armedTurn, () => turnId)
    else $.clock.after(delayMs, () => void update($, armedTurn, () => turnId))

    if (!(await read($, isPaused)) && !(await read($, question))) await freshQuestion($)

    return next(e)
  })

  // The person's Esc or close mark on the practice pane.
  on('ui.close', { id: PLAY }, async ($, e, next) => {
    await endPractice($)

    return next(e)
  })

  on('ui.focus', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.plugin === 'mathlete' && e.element === 'answer') await reveal($)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.surface === 'mobile' || (await read($, isPaused)) || (await read($, isPlaying))) return next(e)

    const q = await read($, question)
    if (!q) return next(e)
    // Show once Claude has worked for the delay, and stay up once revealed.
    const isArmed = (await read($, armedTurn)) === (await read($, currentTurn))
    if (q.startedAt === null && !(e.props.isWorking && isArmed)) return next(e)

    return quiz($, $.ui.resolve(e), q, e.props.bodyColumns, timeLimit, hasSound)
  })

  on('ui.render', { component: 'Pane', requestId: PLAY }, async ($, e) => {
    if (e.surface === 'mobile') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>Practice needs a keyboard.</Text>
    }
    const els = $.ui.resolve(e)
    const { Box, Button, Text } = els
    const q = await read($, question)
    const run = await read($, run_)
    if (!q) return <Text dimColor>No question yet.</Text>

    return (
      <Box flexDirection="column">
        {await quiz($, els, q, e.props.bodyColumns, timeLimit, hasSound)}
        <Box>
          <Button key="stop" label="stop" role="dismiss" onPress={() => stopPractice($)} />
          <Text dimColor>
            {'  '}This run {run.solved}/{run.attempted} · Esc stops
          </Text>
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const p = await read($, profile)
    const paused = await read($, isPaused)
    const now = await $.clock.now()
    const { level, into, span } = levelProgress(p)
    const { Box, Button, Text } = $.ui.resolve(e)
    const width = e.props.bodyColumns

    const days = lastDays(now, 14)
    const dayXp = days.map(d => p.daily[d]?.xp ?? 0)
    const today = p.daily[dayKey(now)]
    const weekXp = dayXp.slice(-7).reduce((a, b) => a + b, 0)

    const row = (text: string, dim = false) => (
      <Text mono dimColor={dim} wrap="truncate-end">
        {text}
      </Text>
    )

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>
            🧮 Level {level} · {titleFor(level)}
          </Text>
          {paused && <Text color="yellow">  paused</Text>}
        </Box>
        {row(`${progressBar(p, Math.max(10, Math.min(30, width - 30)))}  ${into}/${span} XP`)}
        {row(
          `Solved ${p.solved}/${p.attempted} (${pct(p.solved, p.attempted)}) · 🔥 ${p.streak} (best ${p.bestStreak}) · 📅 ${p.dayStreak} days (best ${p.bestDayStreak})` +
            (p.fastest === null ? '' : ` · ⚡ ${p.fastest.toFixed(1)}s`),
          true,
        )}
        <Text> </Text>
        <Text bold>Last 14 days</Text>
        {row(`${sparkline(dayXp)}  ${weekXp} XP this week · today ${today?.solved ?? 0}/${today?.attempted ?? 0}`)}
        <Text> </Text>
        <Text bold>Skills</Text>
        {SKILLS.map(skill => {
          const name = skill.name.padEnd(15)
          if (skill.unlockLevel > level) return row(`${name} 🔒 level ${skill.unlockLevel}`, true)
          const r = skillRecord(p, skill.id)
          const rating = effectiveRating(p, skill)
          const step = chooseStep(skill, rating, () => 0.5)
          const trend = sparkline(p.trend[skill.id] ?? []).padEnd(12)
          return row(
            `${name} ${stars(step, skill.steps.length).padEnd(9)} ${String(rating).padStart(5)} ${trend} ${pct(r.solved, r.attempted).padStart(4)}`,
          )
        })}
        <Text> </Text>
        <Text bold>
          Achievements {Object.keys(p.achievements).length}/{ACHIEVEMENTS.length}
        </Text>
        {ACHIEVEMENTS.map(a =>
          p.achievements[a.id]
            ? row(`🏆 ${a.name.padEnd(17)} ${a.description}`)
            : row(`·  ${a.name.padEnd(17)} ${a.description}`, true),
        )}
        <Text> </Text>
        <Box>
          <Button key="close" label="close" role="dismiss" onPress={() => $.ui.close({ id: PANE })} />
          <Text dimColor>  Esc closes · /math pause turns questions off</Text>
        </Box>
      </Box>
    )
  })
}
