---
label: latest
game: Dobbelaar
saved: 2026-04-09
---

## Goal
Full modifier mechanic implementation for Dobbelaar's 60-day daily challenge system. All 10 modifier types now have working game mechanics, not just data stubs.

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

## Work completed
- `dobbelaar.js` — Added sentinel constants + modifier state vars; updated `renderDie` (wild ★), `renderBoard` (all 5 sentinel types), `floodFill` (wild joins any group), `findMergeGroups` (skips `val <= 0 || val === WILD_DIE`), `triggerMergeCheck` (chainDepth tracking + chainGoal win), `doPlace` (chainDepth reset + flip/diseased effects), `spawnDice` (wild distribution + bomb tick), `rebuildTimer` (default 90 s for surviveTimer), `updateScoreBar` (chain display), `startLoading` (all modifier init), `checkWin` (delegates to triggerWin); new functions: `triggerWin`, `placeFrozenCells`, `placeFlipDice`, `placeBombDice`, `placeDiseasedDice`, `applyFlipEffects`, `applyDiseasedEffects`, `tickBombs`, `detonateBomb`, `describeGoal`
- `dobbelaar.css` — Added styles for `.db-cell--frozen` (❄ sky blue), `.db-cell--flip` (⇆ plum), `.db-cell--bomb` + `.db-bomb-fuse` + `.db-cell--bomb-urgent` pulse + `.db-cell--exploding` animation (coral red), `.db-cell--diseased` (☣ green), `.db-die--wild` (blue→plum→coral gradient)
- `dobbelaar.html` — Added `id="db-goal-desc"` to goal popup paragraph

## Open threads
- Visual QA not yet done in browser — all 6 new modifier types need hands-on testing
- `Challenges.html` static preview page still shows `chainGoal` target as "N merges" — verify it reads correctly
- Win screen "Play again" from a chainGoal challenge resets to today — may need confirmation it resets `chainWon`
- `bestChainDepth` persists across retries within a session (it's reset in `startLoading`, so it's fine — just note it for review)
- Wild die bridging two adjacent groups of different values: accepted behavior (wild joins whichever group's flood-fill reaches it first)
- git push still pending from last session (local commit e612669 not pushed)

## Constraints
- Never use PowerShell `WriteAllText` with complex string interpolation — use Edit tool only
- No hardcoded hex colors or px sizes — tokens and cqw only
- `game-utils.js` changes must remain backward compatible
- `placeNullBlocks` still uses `NULL_BLOCK` constant (was `-1` literal) — consistent
- `/populate-challenges` must never auto-apply wiring changes — always present diff and wait for approval

## Next step
Open `dobbelaar.html` in a browser and QA each modifier type: play a chainGoal day, a wildDice day, a flipDice day, a bombDice day, a diseasedDice day, and a frozenCell day. Confirm win/lose conditions fire correctly, score bar displays correctly for chainGoal, and bomb fuse ticks down visually.