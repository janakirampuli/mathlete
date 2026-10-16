# mathlete

Mental math for the time you spend waiting on Claude Code.

While Claude works, a question shows up in a band above your prompt. Answer it, earn XP, level up, and unlock harder skills. Questions adapt to how well you do, so they stay hard enough to be fun. Everything is saved on your machine. Nothing is sent anywhere.

```
🧮 Lv 7 ████████████░░░░ 412/650 XP  🔥 4  · Percentages
25% of 360 = [ 90       ] check   [ skip ]
✓ 14 × 6 = 84  +38 XP (2.1s)
```

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install mathlete --marketplace janakirampuli/mathlete
```

Answer `y` to add the marketplace, then pick a scope (user scope is the first choice). The plugin is active right away.

From a shell:

```
claude plugin install mathlete --marketplace janakirampuli/mathlete
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `janakirampuli/mathlete`, then Add plugin.

## How to play

1. Send Claude any prompt. While it works, a question appears above the prompt.
2. Press **ctrl+x tab** (or click the band) to move into it. Type the answer and press Enter.
3. Press **Esc** to go back to your prompt. If you have started typing an answer, the band stays up after Claude finishes.

The status line under the prompt shows your level, XP and streak.

## Commands

| Command | What it does |
| --- | --- |
| `/math` | Opens the stats pane: level, XP over the last 14 days, each skill's rating and trend, and achievements. Esc closes it. |
| `/math stats` | Prints the same stats as text. |
| `/math pause` | Stops showing questions, in every session, until you resume. |
| `/math resume` | Turns questions back on. |

## Skills

Each level unlocks a skill. Each skill has several difficulty steps.

| Level | Skill | Easiest | Hardest |
| --- | --- | --- | --- |
| 1 | Addition | 7 + 5 | 3-digit + 3-digit |
| 2 | Subtraction | within 20 | 3-digit − 3-digit |
| 3 | Multiplication | ×2–5 tables | 2-digit × 2-digit |
| 4 | Division | ÷2–5 tables | 3-digit ÷ 1-digit |
| 5 | Squares | 7² | 21² to 50² |
| 6 | Percentages | 10% of 80 | 65% of 340 |
| 8 | Chains | 12 + 9 − 4 | 23 × 7 + 6 × 8 |
| 10 | Powers | 2^6 | 2^16 |

## How scoring works

- **Difficulty.** Each skill has its own rating that starts at 1000 and works like a chess (Elo) rating. Questions are chosen so you get about 80% right. A fast right answer counts as a full win. A slow right answer counts for a bit less. A wrong answer is a loss.
- **Which skill comes next.** Skills you just unlocked and skills you are weak at come up more often. The skill you just did comes up less often.
- **XP.** A right answer earns `10 × skill tier × (1 + 0.25 × difficulty step)`. Beating the target time can double that, and a streak can double it again. A wrong answer earns nothing and resets your streak. You never lose XP.
- **Levels.** Reaching level L takes `50 × (L − 1)²` XP in total.
- **Timing.** The clock starts at your first keystroke, not when the question appears, so reading Claude's output does not count against you.

There are 17 achievements, from your first right answer to a 30-day streak.

## Settings

Change these in `/config`:

- **Question delay (seconds).** Show a question only after Claude has worked this long. The default is 0, which shows it right away.
- **Sounds.** A chime on level-ups and achievements. On by default. Sounds play on macOS only.

## Where your progress lives

Progress is a JSON file in the plugin's own store under your Claude Code configuration folder. If you have several Claude Code sessions open, they share one profile. Each answer re-reads the saved profile before writing, so one session does not overwrite another's XP.

## Development

The plugin is a Claude Code hooks module written in TypeScript:

- `hooks/register.tsx` draws the band and the stats pane, and handles `/math` and the turn hooks.
- `hooks/skills.ts` has the question generators.
- `hooks/math.ts` has ratings, XP, levels and streaks.
- `hooks/achievements.ts` has the achievement list.
- `types/index.d.ts` declares the session state.

To try a local copy, run `claude --plugin-dir /path/to/mathlete`. To run the tests and check the plugin:

```
claude plugin test .
claude plugin validate .
```
