# mathlete

Mental math for the time you spend waiting on Claude Code.

While Claude works, a question shows up in a band above your prompt. Answer it, earn XP, level up, and unlock harder skills. Levels 1 to 5 are a warm-up. After that every level makes every skill harder, and the questions also adapt to how well you do. Everything is saved on your machine. Nothing is sent anywhere.

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
2. The band shows only the skill and its difficulty. Press **ctrl+x tab** (or click the band) to reveal the question. The clock starts when it is revealed.
3. Type the answer and press Enter.
4. Press **Esc** to go back to your prompt. Once a question is revealed, the band stays up after Claude finishes.

The status line under the prompt shows your level, XP and streak.

## Commands

| Command | What it does |
| --- | --- |
| `/math` | Opens the stats pane: level, XP over the last 14 days, each skill's rating and trend, and achievements. Esc closes it. |
| `/math stats` | Prints the same stats as text. |
| `/math pause` | Stops showing questions, in every session, until you resume. |
| `/math resume` | Turns questions back on. |

## Skills

Each skill unlocks at a level and has several difficulty steps.

| Level | Skill | Easiest | Hardest |
| --- | --- | --- | --- |
| 1 | Addition | 7 + 5 | 418 + 907 + 365 |
| 2 | Subtraction | within 20 | 5-digit − 4-digit |
| 3 | Multiplication | ×2–5 tables | 3-digit × 2-digit |
| 4 | Division | ÷2–5 tables | 4-to-5-digit ÷ 2-digit |
| 5 | Squares | 7² | 131² to 199² |
| 6 | Percentages | 10% of 80 | 480 → 552 is +?% |
| 8 | Chains | 12 + 9 − 4 | 23 × 7 + 16 × 8 − 6 × 9 |
| 10 | Powers & Roots | 2^6 | √7396, ∛9261, 8^4 |
| 12 | Remainders | 47 mod 5 | 7342 mod 29 |
| 14 | Fractions | 3/4 of 36 | 3/8 + 5/12 = ?/24 |
| 16 | Speed Tricks | 47 × 11 | 638 × 999 |
| 18 | Big Products | 412 × 7 | 3-digit × 3-digit |

## How scoring works

- **Difficulty.** Each skill has its own rating that starts at 1000 and works like a chess (Elo) rating. Questions are chosen so you get about 70% right. A fast right answer counts as a full win. A slow right answer counts for a bit less. A wrong answer is a loss.
- **Level floor.** From level 6, each level raises the lowest rating every skill can have by 70. A skill that unlocks after level 5 starts rising from its own unlock level. So a high level never gets easy questions, even in a skill you have barely played.
- **Which skill comes next.** Skills you just unlocked and skills you are weak at come up more often. The skill you just did comes up less often.
- **XP.** A right answer earns `10 × skill tier × (1 + 0.25 × difficulty step)`. Beating the target time can double that, and a streak adds up to 50% more. A wrong answer earns nothing and resets your streak. You never lose XP.
- **Levels.** Reaching level L takes `50 × (L − 1)²` XP in total.
- **Timing.** The clock starts when you reveal the question, so reading Claude's output does not count against you, and you cannot work out the answer before the clock starts.

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

## License

MIT. See [LICENSE](LICENSE).
