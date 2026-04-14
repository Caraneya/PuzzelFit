---
label: latest
game: Dobbelaar
saved: 2026-04-14
---

## Goal
Full modifier mechanic implementation for Dobbelaar's 60-day daily challenge system. All 10 modifier types have working game mechanics and consistent visual design. This session focused on UI/UX fixes, description polish, home week wiring, and wild die mechanic rework.

## Decisions
- Sentinel values: `NULL_BLOCK=-1`, `FROZEN_CELL=-2`, `FLIP_DIE=-3`, `BOMB_DIE=-4`, `DISEASED_DIE=-5`, `WILD_DIE=7`
- `chainGoal` win: track `chainDepth` (waves per placement) and `bestChainDepth` (display); win fires from inside `triggerMergeCheck` via `triggerWin()`
- `SCORE_TARGET` for chainGoal is 999999 (unreachable) so score-based win never fires
- Score bar shows `bestChainDepth/target` for chainGoal challenges instead of score/target
- `triggerWin()` extracted from `checkWin()` — owns `chainWon` guard to prevent double-fire
- Wild die: probability-based spawn (modValue × 10% per spawn), always singular, `WILD_MIN=1` / `WILD_MAX=3` per game; guaranteed by spawn #7 if min not met
- Null block stripe: `rgba(0,0,0,0.25)` dark stripes (was white — invisible in dark mode)
- Inline chips: `.db-inline-cell` (1.2em square, position relative) + modifier class; all modifier descriptions show a chip next to the type name
- Home week: dynamically built by `buildHomeWeek()` from JS; correct day names + ISO dates; completed days show muted "Done" pill but remain playable
- Calendar always resets to today when opened via `calCtrl.resetToToday()` returned by `initCalendar`
- "Board is full" false trigger fix: when `hasAnyValidMove` fails for a 2-die spawn but a single die fits, reduce to 1 die instead of triggering lose
- M-dashes removed from all challenge descriptions and flavor texts
- `game-utils.js` `initCalendar` now returns `{ resetToToday() }` — backward compatible
- cal-challenge component removed; challenge info merged into cal-info row
- Badge state colours, trophy by difficulty, fixed-width badge — all from prior session

## Work completed
- `dobbelaar.css` — Null block stripe color fixed (dark stripes); `.db-inline-cell` base class added; `.db-inline-cell--wild` modifier (yellow bg, star SVG 65%)
- `dobbelaar.js` — `describeGoal()`: all 6 modifier cases have inline chips + m-dashes removed; `onTurnEnd()`: 2-die fallback to 1-die instead of false lose; `buildHomeWeek()`: generates last-6-days rows with correct dates and completion state; `spawnDice()`: wild die logic reworked (probability + min/max guards + spawn counter); `startLoading()`: resets `wildSpawned` and `wildSpawnNum`; init wires `calCtrl.resetToToday()` on calendar sheet open
- `dobbelaar.html` — Static home week rows replaced with `<div id="db-home-week-list">` populated by JS
- `dobbelaar-challenges.js` — Removed m-dashes from 3 flavor texts (Mar 10, Mar 17, Apr 1)
- `components.css` — Added `.btn--pill--done` variant (transparent bg, secondary color, 60% opacity)
- `game-utils.js` — `initCalendar` returns `{ resetToToday() }` which calls internal `navCal(today)`

## Open threads
- Visual QA not yet done — inline chips, wild die singular spawn behavior, home week list, calendar today-reset, and all 6 modifier types need browser testing
- Win screen "Play again" from a chainGoal challenge — verify `chainWon` resets correctly
- `Challenges.html` static preview page may show chainGoal target incorrectly — verify
- Wild die bridging two adjacent groups: accepted behavior (whichever flood-fill reaches it first)
- Git push still pending (local commits not pushed)

## Constraints
- Never use PowerShell `WriteAllText` with complex string interpolation — use Edit tool only
- No hardcoded hex colors or px sizes — tokens and cqw only; SVG fills must use `var(--color-*)` not hex
- `game-utils.js` changes must remain backward compatible
- `/populate-challenges` must never auto-apply wiring changes — always present diff and wait for approval
- SVG icon strings live as JS constants near sentinel declarations, not inlined per-call (wild die star SVG is the exception — inlined in `describeGoal` since no named constant exists)
- Wild die constants: `WILD_MIN=1`, `WILD_MAX=3` — adjust only with explicit user sign-off
- Dark mode component overrides go in the existing dark-mode block at the bottom of `components.css`

## Next step
Open `dobbelaar.html` in a browser and QA: inline chips render at correct size in the goal popup, wild die spawns alone at appropriate frequency (1–3 per game), home week shows correct day names with Done/Play states, and calendar snaps to today on open.
