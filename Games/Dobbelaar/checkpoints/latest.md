---
label: latest
game: Dobbelaar
saved: 2026-04-09
---

## Goal
Full modifier mechanic implementation for Dobbelaar's 60-day daily challenge system. All 10 modifier types have working game mechanics and consistent visual design across the game board and the game bible.

## Decisions
- Sentinel values: `NULL_BLOCK=-1`, `FROZEN_CELL=-2`, `FLIP_DIE=-3`, `BOMB_DIE=-4`, `DISEASED_DIE=-5`, `WILD_DIE=7`
- `chainGoal` win: track `chainDepth` (waves per placement) and `bestChainDepth` (display); win fires from inside `triggerMergeCheck` via `triggerWin()`
- `SCORE_TARGET` for chainGoal is 999999 (unreachable) so score-based win never fires
- Score bar shows `bestChainDepth/target` for chainGoal challenges instead of score/target
- `triggerWin()` extracted from `checkWin()` — owns `chainWon` guard to prevent double-fire
- Wild die (value 7): joins any flood-fill group but never starts one; `group_value × group.length` scoring is naturally correct
- Flip effects run before diseased effects in `doPlace` (flip inverts pre-existing cells; diseased infects just-placed cells)
- Bomb guard: only calls `detonateBomb` when `!isMerging` to avoid mid-animation lose trigger
- `surviveTimer` + non-timer modifier → default 90 s countdown clock applied in `rebuildTimer`
- Frozen cells use fixed corner/edge positions; flip/diseased use random positions
- Goal popup paragraph now has `id="db-goal-desc"` and is set dynamically by `describeGoal(ch)` in `startLoading`
- Sentinel visual design: each modifier has a distinct solid-color background + SVG icon (no emoji), matching the Figma reference chips
- Null Block: grey hatched (CSS repeating-linear-gradient, no JS icon); Frozen: teal + snowflake SVG; Flip: plum + bracket SVG; Bomb: peach + bomb icon SVG + fuse number; Diseased: dark tooltip bg + skull SVG; Wild: yellow bg + coral star SVG path
- SVG icon fills use CSS custom properties (`var(--color-surface)`, `var(--color-error)`, etc.) — not hardcoded hex values
- Bomb cell: icon SVG in top portion via `.db-bomb-icon`, fuse number in bottom via `.db-bomb-fuse` badge

## Work completed
- `dobbelaar.js` — Added sentinel constants + SVG icon string constants (`SVG_FROZEN`, `SVG_FLIP`, `SVG_BOMB`, `SVG_DISEASED`); updated `renderDie` (wild = yellow bg + coral star path SVG), `renderBoard` (injects SVG icons for frozen/flip/bomb/diseased cells), `floodFill` (wild joins any group), `findMergeGroups` (skips `val <= 0 || val === WILD_DIE`), `triggerMergeCheck` (chainDepth tracking + chainGoal win), `doPlace` (chainDepth reset + flip/diseased effects), `spawnDice` (wild distribution + bomb tick), `rebuildTimer` (default 90 s for surviveTimer), `updateScoreBar` (chain display), `startLoading` (all modifier init), `checkWin` (delegates to triggerWin), `describeGoal` (win condition + per-modifier mechanic explanation sentence); new functions: `triggerWin`, `placeFrozenCells`, `placeFlipDice`, `placeBombDice`, `placeDiseasedDice`, `applyFlipEffects`, `applyDiseasedEffects`, `tickBombs`, `detonateBomb`, `describeGoal`
- `dobbelaar.css` — Sentinel cells now use solid token-based backgrounds (no color-mix tints); null block uses CSS diagonal stripe pattern; frozen/flip/diseased icons sized via `.db-sentinel-icon`; bomb uses `.db-bomb-icon` + `.db-bomb-fuse` layout; wild die uses `--color-yellow` bg; removed emoji `::after` pseudo-elements for all sentinels
- `dobbelaar.html` — Added `id="db-goal-desc"` to goal popup paragraph
- `dobbelaar-bible.html` — Added "Board Modifiers" section with styled chips and mechanic descriptions for all 6 modifier types; chip styles mirror in-game sentinel visuals using token colors and matching SVG icons; skull SVG uses corrected single-path version with `fill="var(--color-surface)"`

## Open threads
- Visual QA not yet done in browser — all 6 new modifier types need hands-on testing with new icon designs
- `Challenges.html` static preview page still shows `chainGoal` target as "N merges" — verify it reads correctly
- Win screen "Play again" from a chainGoal challenge resets to today — may need confirmation it resets `chainWon`
- Wild die bridging two adjacent groups of different values: accepted behavior (wild joins whichever group's flood-fill reaches it first)
- git push still pending (local commits not pushed)

## Constraints
- Never use PowerShell `WriteAllText` with complex string interpolation — use Edit tool only
- No hardcoded hex colors or px sizes — tokens and cqw only; SVG fills must use `var(--color-*)` not hex
- `game-utils.js` changes must remain backward compatible
- `placeNullBlocks` still uses `NULL_BLOCK` constant (was `-1` literal) — consistent
- `/populate-challenges` must never auto-apply wiring changes — always present diff and wait for approval
- SVG icon strings live as JS constants near the sentinel value declarations, not inlined per-call

## Next step
Open `dobbelaar.html` in a browser and QA each modifier type visually: confirm new icon designs render correctly at game cell size, bomb shows icon + fuse number, wild die shows yellow + coral star, and all backgrounds match the Figma reference chips.
