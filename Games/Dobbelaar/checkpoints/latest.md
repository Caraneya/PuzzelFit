---
label: latest
game: Dobbelaar
saved: 2026-04-15
---

## Goal
Phase 2 Dobbelaar gameplay animations are complete. Chain merge visual system is fully implemented. Next focus is any remaining polish — SFX gaps, big group flash, or new features.

## Decisions
- Phase 1 general animations complete; Phase 2 gameplay animations complete
- `db-cell--land`: 220ms scale bounce on placement
- `db-hot-pulse`: 1.8s infinite amber glow on hot zone cells
- Parking idle pulse removed — too distracting
- Value multiplier: die 4=×1.1, 5=×1.2, 6=×1.3 in `bonusMult`
- Frozen spread: nearest empty cell globally (Manhattan), lose only when zero empty cells remain
- 6-sum merge: destroys entire closest ice cluster (BFS), not one cell
- Home entry animation fires via `navigateTo('home')` in DOMContentLoaded — not on HTML parse
- Chain animations:
  - `--chain-depth` CSS var set on `#db-board-grid` before each wave
  - Wave 2: amber ring (`db-cell--merging--chain-2`) + bigger score pop
  - Wave 3+: red/hot ring (`db-cell--merging--chain-3`) + largest score pop + board shake
  - "Chain ×N" reward word on chainDepth ≥ 2, only if no waveWord (Jackpot/High roller/Loaded) fired
  - Board shake: `@keyframes db-board-shake` 220ms, class `db-board--shake` removed on `animationend`
  - Score pop: `db-float-score--chain-1` (h3) for wave 2, `db-float-score--chain-2` (h2) for wave 3+

## Work completed
- `tokens.css` — `--scale-press: 0.85`
- `components.css` — full Phase 1 animation system; home entry scoped to `.proto-screen.is-active`
- `game-utils.js` — `initBtnPress()`, `triggerStarRipple()`, `countUp()`, `renderCal(dir)`, calendar flip
- `dobbelaar.html` — `.sheet-overlay--win/.--lose`; win SVG restructured; `is-active` removed from home screen
- `dobbelaar.css`:
  - Win assembly jump; parking idle removed
  - `@keyframes db-cell-land` + `.db-cell--land`
  - `@keyframes db-hot-pulse` on `.db-cell--hot-zone`
  - `.db-cell--merging--chain-2/3` glow rings
  - `@keyframes db-board-shake` + `.db-board--shake`
  - `.db-float-score--chain-1/2` larger font sizes
- `dobbelaar.js`:
  - `triggerWin()` — sets `dataset.difficulty` on `#sheet-win`
  - `doPlace()` — `db-cell--land` on placed cells
  - `triggerMergeCheck()` — `--chain-depth` var, depth classes on merging cells, board shake, chain reward word, `vMult` value bonus, `thawClosestCluster()`
  - `floatScore(r, c, text, depth)` — depth param drives chain size classes
  - `thawClosestCluster()` — BFS flood-fill cluster destroy
  - `spreadFrozenCell()` — global nearest-empty spread
  - Parking idle fully removed
  - `DOMContentLoaded` — `navigateTo('home')` as first call

## Open threads
- No SFX for streak milestone or hot zone hit
- Big group flash (4+ dice) not yet implemented — could add a distinct brightness spike on top of chain ring
- Stats `db-stat-totaltime` does not count-up (intentional)

## Constraints
- Sine/triangle waveforms only for SFX
- No hardcoded hex/px outside SVG illustration paths — tokens only (frozen cell bg `#51C4C4` intentional exception)
- `game-utils.js` backward-compatible
- `animation-fill-mode: both` on all entry animations
- `sound-utils.js` / `music-utils.js` pure audio — no game logic
- `triggerWin` double-fire guard must stay
- Hot zones use a separate Set (not a board sentinel)
- Chain reward word only shows if no waveWord (Jackpot/High roller/Loaded) fired that wave
- Button press animation on button element only — icon flips on icon child

## Next step
Decide what's next: SFX for hot zone hits / streak milestones, big group flash (4+ dice brightness spike), or a new feature. No immediate code debt.
