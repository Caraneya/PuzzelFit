# Dobbelaar — Internal Testing Build

## What it is
**Dobbelaar** (Dutch for "dice-thrower") is a single-player spatial puzzle game. Players drag dice from a spawner and a parking slot onto a 5×5 board, matching equal values into groups to merge them and score points. Each session is framed as a **challenge** with a target score, a difficulty badge, and optional modifiers (timers, merge-count caps, special dice). The `InternalTesting` folder is a QA/designer harness — it skips the home/calendar flow and loops through 7 hard-coded test challenges.

## Tech stack
Pure vanilla HTML/CSS/JS. No build tooling, no frameworks, no CDNs, no analytics or ads.
- Shared utilities: [PuzzleFit/game-utils.js](../../../game-utils.js), [PuzzleFit/icons.js](../../../icons.js), [PuzzleFit/tokens.css](../../../tokens.css)
- Fonts: Funnel Display + SF Pro Display (local, under `/Fonts/`)
- Audio: fully synthesized — `SoundUtils` (Web Audio SFX) and `Music` (generative D-major pentatonic ambient pad)
- Icons: inline SVG via the shared icon system

## Files
| File | Lines | Role |
|---|---|---|
| [game.html](game.html) | 887 | Screens, modals, popups, static SVG assets |
| [game.js](game.js) | 3552 | Game logic, rendering, audio, event wiring |
| [game.css](game.css) | 4486 | Design tokens, layout, animations, themes |

## HTML structure ([game.html](game.html))
Two top-level screens:
- `#screen-loading` — splash with animated dice SVG
- `#screen-gameplay` — toolbar (hint / timer / stats / settings), 5×5 board, bottom tray (spawner + parking slot)

Modal sheets (slide-up overlays): pause, info, stats, settings, feedback, win, lose.
Popups: welcome (first-time), goal preview, reset confirm, exit confirm.

## JS structure ([game.js](game.js))
| Lines | System |
|---|---|
| 14–87 | `SoundUtils` — synthesized SFX |
| 89–264 | `Music` — ambient generative engine with tension/pause fades |
| 1118–1142 | Internal-testing challenge defs (`it-1`…`it-7`) |
| 1196–1510 | Game state: `board[r][c]`, score, merges, timers, drag, bomb fuses, wild counts |
| 1518–1700 | Rendering: `renderBoard`, `renderSpawner`, `renderParking` |
| 1723–1800 | Placement: `getPlacementInfo`, `canPlace`, `doPlace` |
| 1908–2087 | Merge engine: `floodFill`, `findMergeGroups`, `triggerMergeCheck` (cascades + scoring) |
| 2159–2265 | Win/lose evaluation |
| 2282–2450 | Pointer drag + ghost rendering + hotzone highlighting |
| 2607–2690 | Hint system (two-pass search, modifier-aware) |
| 2748–2823 | Challenge init + block placement |
| 2910–3040 | Sentinel dice behaviors (frozen, null, flip, bomb, diseased) |
| 3247–3275 | `startITChallenge` — internal-testing entry, picks a random unplayed challenge |
| 3276–3550 | `DOMContentLoaded` wiring: icons, modals, buttons, tutorial |

## CSS structure ([game.css](game.css))
Token-heavy (200+ CSS custom properties for colors, spacing, durations, easing). Palette is dark green / marine / bright green / light blue on an eggshell background, with full `prefers-color-scheme: dark` + manual `[data-theme="dark"]` overrides. Sections: button system (401–560), sheets/overlays (619–1850), loading (2177–2210), gameplay UI (2216–2451), board + dice (2543–3171), tray + parking (2968–3043), right-hand-mode flip via `[data-hand="right"]` (3044–3170). Single breakpoint at 390px.

## State & persistence
`localStorage` keys (prefix `db-`): `db-theme`, `db-hand`, `db-sfx`, `db-music`, `db-completed` (ISO dates for streaks), `db-game-history` (result objects for stats).
`sessionStorage`: `db-tutorialSeen`.

No currency, shop, ads, IAP, or unlockables. Progression comes from daily challenges + streaks + stats.

## Special dice & modifiers
**Sentinels** (negative-valued cells): frozen (-2, thaws on adjacent merge), null (-1, permanent block), flip (-3, inverts neighbor values 1↔6 / 2↔5 / 3↔4), bomb (-4, fuse countdown + splash clear), diseased (-5, infects neighbors to value 6). **Wild** (7) joins any merge group.

**Modifiers** per challenge: `maxMerges`, `timer`, `flipDice`, `bombDice`, `diseasedDice`, `wildDice`.

## InternalTesting vs. production
Production build lives alongside in [PuzzleFit/Games/Dobbelaar/](../). The internal-testing variant:
- skips the home screen / calendar
- uses 7 hard-coded challenges instead of date-keyed daily ones
- resets played-set per session (no persistent progression)
- shows an `INTERNAL TESTING` proto-badge, hides back/exit navigation
