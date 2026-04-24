# Dobbelaar — Internal Testing Build

## What it is
**Dobbelaar** (Dutch for "dice-thrower") is a single-player spatial puzzle game. Players drag dice from a spawner and a parking slot onto a 5×5 board, matching equal values into groups to merge them and score points. Each session is framed as a **challenge** with a target score, a difficulty badge, and optional modifiers (timers, merge-count caps, special dice). The `InternalTesting` folder is a QA/designer harness — it skips the home/calendar flow and loops through 7 hard-coded test challenges.

## Tech stack
Pure vanilla HTML/CSS/JS. No build tooling, no frameworks, no CDNs, no analytics or ads. **Fully self-contained:** the entire build lives in this folder and references no external files.
- Utilities (all inlined in `game.js`): `SoundUtils`, `Music`, `Icons`, `GameUtils`
- Fonts: Funnel Display + SF Pro Display, bundled in [Fonts/](Fonts/)
- Audio: fully synthesized — `SoundUtils` (Web Audio SFX) and `Music` (generative D-major pentatonic ambient pad)
- Icons: inline SVG via the inlined `Icons` module
- Tokens: design tokens are defined inline at the top of [game.css](game.css)

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
| 1196–1510 | Game state: `board[r][c]`, score, merges, timer, drag |
| 1518–1700 | Rendering: `renderBoard`, `renderSpawner`, `renderParking` |
| 1723–1800 | Placement: `getPlacementInfo`, `canPlace`, `doPlace` |
| 1908–2087 | Merge engine: `floodFill`, `findMergeGroups`, `triggerMergeCheck` (cascades + scoring) |
| 2159–2265 | Win/lose evaluation |
| 2282–2450 | Pointer drag + ghost rendering |
| 2607–2690 | Hint system (two-pass search) |
| 2748–2823 | Challenge init |
| 3247–3275 | `startITChallenge` — internal-testing entry, picks a random unplayed challenge |
| 3276–3550 | `DOMContentLoaded` wiring: icons, modals, buttons, tutorial |

## CSS structure ([game.css](game.css))
Token-heavy (200+ CSS custom properties for colors, spacing, durations, easing). Palette is dark green / marine / bright green / light blue on an eggshell background, with full `prefers-color-scheme: dark` + manual `[data-theme="dark"]` overrides. Sections: button system (401–560), sheets/overlays (619–1850), loading (2177–2210), gameplay UI (2216–2451), board + dice (2543–3171), tray + parking (2968–3043), right-hand-mode flip via `[data-hand="right"]` (3044–3170). Single breakpoint at 390px.

## State & persistence
`localStorage` keys (prefix `db-`): `db-theme`, `db-hand`, `db-sfx`, `db-music`, `db-completed` (ISO dates for streaks), `db-game-history` (result objects for stats), `db-tutorialSeen`, `db-session` (versioned full-fidelity in-progress save for resume-on-reopen).

No currency, shop, ads, IAP, or unlockables. Progression comes from challenge attempts + streaks + stats.

## Challenges
The 7 internal-test challenges use only the `maxMerges` modifier (or none). No timers and no special dice in this build. The underlying engine supports them, but they are not exercised by the internal-test challenge set.

## InternalTesting vs. production
Production build lives alongside in [PuzzleFit/Games/Dobbelaar/](../). The internal-testing variant:
- skips the home screen / calendar
- uses 7 hard-coded challenges instead of date-keyed daily ones
- resets played-set per session (no persistent progression)
- shows an `INTERNAL TESTING` proto-badge, hides back/exit navigation

---

## Checkpoint — Landscape Responsiveness

**Label**: `latest`
**Saved**: 2026-04-23

### Goal
Make the Internal Testing build responsive across landscape and wide viewports while keeping portrait unchanged. Target resolutions: 360×800 phone portrait, 800×360 phone landscape, 834×1194 tablet portrait, 1194×834 tablet landscape, 1920×1080 desktop.

### Decisions
- **Breakpoints**: `@media (min-width: 600px)` for sheets/popups; `@media (min-aspect-ratio: 1/1)` for gameplay + tutorial row-layout; `@media (max-height: 500px)` for short-viewport loading tweaks.
- **Sheets** stay bottom-anchored across all sizes; only the width narrows (max-width 440px) on wide screens. Uniform padding `var(--space-5)` sides, `var(--space-8)` bottom. `.sheet-footer` padding and `--sheet-footer-height` calc kept in sync.
- **Popups** (`.modal`) capped at max-width 420px.
- **Gameplay landscape**: `.game-main` stays flex-column (score-bar remains footer). Inside, `.game-board` becomes flex-row with square board + vertical tray column.
- **Right-hand = default** (JS already defaults `'db-hand'` to `'right'`). CSS maps `.db--right-hand` → `flex-direction: row` (trays on RIGHT); left-hand → `row-reverse` (trays on LEFT).
- **Tray sizing**: die = `clamp(36px, calc((100cqh - 214px) / 4), 96px)` tied to game-board height; slot has `aspect-ratio: 1`; tray-wrap width = `var(--tray-square)` so dice fill the slot exactly.
- **Tray hint** uses **two DOM copies** (portrait in `.db-tray-wrap`, landscape in `.game-score-bar`) with class-based display toggling (`--portrait` / `--landscape`). No absolute positioning.
- **Tutorial landscape**: 2-column CSS grid — `.tutorial__play-area` spans full height on left; step indicator top-right; `.tutorial__info` below it with `justify-content: space-between` and `.tutorial__instruction { flex: 1; justify-content: center }`.
- **Hint tooltip** capped at `width: min(80cqw, 300px)` so it doesn't balloon on wide screens.
- **Loading screen**: SVG `max-width: 320px` + `max-height: min(50vw, 50vh)`. `@media (max-height: 500px)` tightens `.loading-body` padding/gap.

### Work completed
- [game.css](game.css) — all landscape rules (~150 lines added across sheet, gameplay, tutorial, loading, hint sections).
- [game.html](game.html) — added `.db-tray-hint.db-tray-hint--landscape` inside `.game-score-bar`; existing tray-wrap hint now has `.db-tray-hint--portrait` modifier.

### Open threads
- **800×360 phone landscape** remains cramped — trays barely fit at floor die size (36px). Accepted tradeoff for now.
- **Desktop 1920×1080**: slot-fill ~71% with tray-wrap cap at 300; dice could be bigger if the extra slot padding looks off — option to tighten `--tray-wrap` cap or raise die cap from 96 → 120.
- **Game-board padding** was removed (was `var(--space-8) 0`); verify no other rule depended on it.

### Constraints
- Portrait must stay untouched; all landscape changes scoped via media queries.
- Use **two-DOM-copies + display toggle** for orientation-dependent visibility (NOT absolute positioning).
- Right-hand is the app default — the base (non-right-hand) CSS represents left-hand, not the other way around.
- Gameplay was "save for last" early in the session but is now in scope.

### Next step
Visual verification in browser at all target resolutions. Iterate on numeric tuning (die cap, tray-wrap cap, padding values) as needed.

---

## Feedback Action Plan — 2026-04-24

Action plan distilled from the internal-testing feedback round. Nothing is implemented yet; this is scoping only.

### Legend
- **Priority**: P0 critical · P1 high · P2 medium · P3 low/deferred
- **Type**: Design · Dev · Both
- **Effort**: S (a few hours) · M (about a day) · L (multi-day)

### Open questions
- **PGSDK integration** — should the Internal Testing build support it? The current game files (especially `game.html`) are not set up for standard Puzzelfit publication either, so this needs a product decision before we can scope the work.

### P0 — Critical
| # | Item | Status | Type | Effort | Notes |
|---|---|---|---|---|---|
| 1 | Save data: resume session on reopen | **Done** (2026-04-24) | Dev | L | Full-fidelity autosave under `db-session` (v1). Saves after every quiet moment (end of each turn's merge cascade), plus on `visibilitychange` and `beforeunload`. Cleared on win, lose, and Reset Level. On reopen, skips the welcome flow, restores the board + spawner + parking + timer + turn/streak state + IT_PLAYED, and opens the goal popup with the CTA relabeled "Continue". Unknown challenge keys are discarded silently. Timer extended with `getSeconds` / `setSeconds` to support save/restore. |
| 2 | Save data: persist settings across sessions | **Done** (2026-04-24) | Dev | S | Audit showed theme/hand/sfx/music already persist correctly; gap was `db-tutorialSeen` using `sessionStorage`. Moved to `localStorage`. Added dirty-state tracking on the settings sheet: CTA is "Continue playing" when clean, "Save and continue" when dirty; "Settings saved!" toast fires only on dirty close. Reset Settings re-seeds the snapshot so the CTA returns to "Continue playing" after reset. Tutorial re-entry path remains available via the existing "Tutorial" button in Settings. |
| 3 | "Ready to play" button sometimes fails to trigger playmode | **Done** (2026-04-24) | Dev | M | Root cause: `.btn--pressing` scales buttons to 0.85 for 150ms on `pointerdown`. Edge taps could land outside the shrunk button at `pointerup`, so `click` never fired. Fixed globally by adding a `::after` hit-shield pseudo-element that animates with the **inverse** scale (`1 / var(--scale-press)`) in lockstep with the button. Parent × child transforms compose to identity, so the shield always renders at the button's original bounding box — taps always land. Pure CSS, no variant or JS changes, and the visible press animation is unchanged. Applies to every `.btn` in the game. |

### P1 — High
| # | Item | Type | Effort | Notes |
|---|---|---|---|---|
| 4 | Tutorial step 3/4 description text overflows the bottom | Design + Dev | S | **Done (2026-04-24)** — `.tutorial__desc-wrap` fixed height raised from 40px (1 line) to `calc(var(--font-size-body) * var(--line-height-normal) * 5)` (~100px, 5 lines). Keeps the wrap a fixed size so steps don't jump, but provides enough headroom for longer translations (Dutch, German, etc.). Derived from tokens, not hard-coded. Portrait only; landscape already used `height: auto`. |
| 5 | Desktop overlays are too small vs. tablet/mobile | Design + Dev | M | Revisit sheet/popup max-width and padding for wide viewports so overlays feel proportionate. |
| 6 | Ghost click behavior on non-interactive objects | Dev | S | Score display and bottom-row dice respond to clicks despite having no function. Remove pointer/click affordance from decorative elements. |
| 7 | Anchor buttons to the bottom on all overlays | Design + Dev | S | Standardize on the `.sheet-footer` pattern for consistency across desktop and tablet overlays. |

### P2 — Medium
| # | Item | Type | Effort | Notes |
|---|---|---|---|---|
| 8 | "Ready to play" button placement | Design | S | Move closer to the bottom of the popup. |
| 9 | Hint tooltip too small on tablet | Design + Dev | S | Review the sizing clamp for the tablet range (especially Tab A9 class). |
| 10 | False "Settings saved" toast | Dev | S | **Done (2026-04-24)** — Resolved as a byproduct of #2. Toast now fires only when a setting actually changed. |
| 11 | Samsung Tab A9 specific support | Design + Dev | M | 8.7" TFT LCD at 800×1340. Verify breakpoint coverage and hint/overlay sizing for this device class. |

### P3 — Low / Deferred
| # | Item | Type | Effort | Notes |
|---|---|---|---|---|
| 12 | Desktop landscape polish | Design + Dev | M | Inventory the edits still missing from the landscape responsiveness checkpoint and finish them. |
