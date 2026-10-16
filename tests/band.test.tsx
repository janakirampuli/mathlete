import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const BAND = {
  plugin: 'mathlete',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

const PANE = {
  plugin: 'mathlete',
  component: 'Pane',
  requestId: 'mathlete',
  props: { title: 'mathlete', isFocused: true, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const MATH = { command: 'math', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } } as const

// What the engine would answer beneath the plugin.
function engine(on: On, profile?: object) {
  mock.store(on, profile ? { profile } : {})
  const status: string[] = []
  const toasts: string[] = []
  const sounds: string[] = []
  const panes: string[] = []
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.status', ($, e) => (status.push(e.text ?? ''), { value: undefined }))
  on('ui.toast', ($, e) => (toasts.push(e.text), { value: undefined }))
  on('audio.play', ($, e) => (sounds.push('asset' in e.clip ? String(e.clip.asset) : '?'), { value: undefined }))
  on('ui.open', ($, e) => (panes.push(e.id), { value: { isPlaced: true as const } }))
  on('ui.focus', () => ({}))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  return { status, toasts, sounds, panes, clock: mock.clock(on, { now: new Date(2026, 9, 16, 12).getTime() }) }
}

const solve = (label: string) => {
  const [a, op, b] = label.replace(' = ', '').split(' ')
  const x = Number(a), y = Number(b)
  return op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y
}

// What ctrl+x tab does: the answer box takes the ring and the question shows.
async function focusBand($: Engine, ui: { find: (q: { key: string }) => Promise<{ props: Record<string, unknown> } | undefined> }) {
  await $.ui.focus({ component: 'AbovePrompt', requestId: 'band', plugin: 'mathlete', element: 'answer', origin: { kind: 'person' } })
  return solve(String((await ui.find({ key: 'answer' }))?.props.label))
}

async function start($: Engine, turnId = 't1') {
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId })
}

test('a question shows while Claude works and a right answer earns saved XP', async ($, on) => {
  const { clock, status, toasts, sounds } = engine(on, { xp: 40, streak: 2, bestStreak: 2, solved: 2, attempted: 2 })
  await start($)
  expect(status.at(-1)).toContain('Lv 1')

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const answer = await focusBand($, ui)
  await clock.advance(1000)
  await ui.input({ key: 'answer', text: String(answer) })

  expect((await ui.find({ text: /✓/ }))?.text).toMatch(/\+\d+ XP \(1\.0s\)/)
  expect(status.at(-1)).toContain('Lv 2')
  expect(toasts.some(t => t.includes('Level 2'))).toBe(true)
  expect(toasts.some(t => t.includes('Unlocked Subtraction'))).toBe(true)
  expect(sounds).toEqual(['sounds/levelup.wav'])
  const stats = await $.command.run({ ...MATH, args: 'stats' })
  expect(stats.text).toContain('Solved 3 of 3')
  expect(stats.text).toMatch(/Addition\s+10\d\d/)
})

test('the question stays hidden, and its clock still, until the band is focused', async ($, on) => {
  const { clock } = engine(on)
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const hidden = await ui.find({ key: 'answer' })
  expect(String(hidden?.props.label)).toMatch(/^★+☆+ ▸ $/)
  expect(hidden?.props.placeholder).toBe('ctrl+x tab to reveal')

  await clock.advance(30000)
  const answer = await focusBand($, ui)
  expect(Number.isFinite(answer)).toBe(true)
  await clock.advance(2000)
  await ui.input({ key: 'answer', text: String(answer) })
  expect((await ui.find({ type: 'Text', text: /✓/ }))?.text).toContain('(2.0s)')
})

test('typing works the same on desktop', async ($, on) => {
  engine(on)
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const answer = await focusBand($, ui)
  await ui.input({ key: 'answer', text: String(answer) })
  expect(await ui.find({ text: /✓/ })).toBeDefined()
})

test('a wrong answer shows the right one and resets the streak', async ($, on) => {
  engine(on, { xp: 0, streak: 3, bestStreak: 3, solved: 3, attempted: 3 })
  await start($)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const answer = await focusBand($, ui)
  await ui.input({ key: 'answer', text: String(answer + 1) })

  expect((await ui.find({ text: /✗/ }))?.text).toContain(`= ${answer}`)
  expect((await $.command.run({ ...MATH, args: 'stats' })).text).toContain('streak 0 · best 3')
})

test('the first right answer earns an achievement with a toast and a chime', async ($, on) => {
  const { toasts, sounds } = engine(on)
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const answer = await focusBand($, ui)
  await ui.input({ key: 'answer', text: String(answer) })
  expect(toasts).toContain('🏆 First Blood: Get your first answer right')
  expect(sounds).toEqual(['sounds/achievement.wav'])
})

test('sound off plays nothing', { options: { sound: false } }, async ($, on) => {
  const { sounds, toasts } = engine(on)
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const answer = await focusBand($, ui)
  await ui.input({ key: 'answer', text: String(answer) })
  expect(toasts.length > 0).toBe(true)
  expect(sounds).toEqual([])
})

test('the band stays empty while Claude is idle and nothing is typed', async ($, on) => {
  engine(on)
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal', props: { ...BAND.props, isWorking: false } })
  expect(await ui.find({ key: 'answer' })).toBeUndefined()
})

test('with a delay the question waits until Claude has worked that long', { options: { delaySeconds: 5 } }, async ($, on) => {
  const { clock } = engine(on)
  await start($)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'answer' })).toBeUndefined()
  await clock.advance(4000)
  expect(await ui.find({ key: 'answer' })).toBeUndefined()
  await clock.advance(1000)
  expect(await ui.find({ key: 'answer' })).toBeDefined()

  // A new turn waits again, even though the last one's timer fired.
  await $.turn.start({ text: 'again', turnId: 't2' })
  expect(await ui.find({ key: 'answer' })).toBeUndefined()
})

test('/math pause hides the band and /math resume brings it back', async ($, on) => {
  const { status } = engine(on)
  await start($)
  await $.command.run({ ...MATH, args: 'pause' })
  expect(status.at(-1)).toContain('paused')

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'answer' })).toBeUndefined()

  await $.command.run({ ...MATH, args: 'resume' })
  await $.turn.start({ text: 'again', turnId: 't2' })
  expect(await ui.find({ key: 'answer' })).toBeDefined()
})

test('/math opens the stats pane with skills, history and achievements', async ($, on) => {
  const { panes } = engine(on, {
    xp: 260, streak: 4, bestStreak: 9, solved: 30, attempted: 34, dayStreak: 2, bestDayStreak: 5,
    skills: { add: { rating: 1180, solved: 20, attempted: 22 } },
    trend: { add: [1000, 1040, 1100, 1180] },
    daily: { '2026-10-15': { xp: 120, solved: 12, attempted: 13 }, '2026-10-16': { xp: 60, solved: 6, attempted: 7 } },
    achievements: { first: '2026-10-15' },
  })
  await start($)
  const result = await $.command.run(MATH)
  expect(result.text).toBeUndefined()
  expect(panes).toEqual(['mathlete'])

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Level 3 · Times Table Tamer/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^Addition/ }))?.text).toMatch(/★★★☆{6}\s+1180 [▁▃▅█]{4}/)
    expect(await ui.find({ type: 'Text', text: /Multiplication/ })).toBeDefined()
    expect((await ui.find({ type: 'Text', text: /^Division/ }))?.text).toContain('🔒 level 4')
    expect((await ui.find({ type: 'Text', text: /XP this week/ }))?.text).toContain('180 XP this week · today 6/7')
    expect((await ui.find({ type: 'Text', text: /First Blood/ }))?.text).toMatch(/^🏆/)
    expect(await ui.find({ key: 'close' })).toBeDefined()
    await ui.unmount()
  }
})
