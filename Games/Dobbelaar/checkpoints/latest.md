---
label: latest
game: Dobbelaar
saved: 2026-04-17
---

## Goal
Work through the Dobbelaar bug list: rebuild the frozen-cell spread to be origin-aware and rewrite the hint engine to be modifier-aware, surfacing concrete actionable moves instead of generic tips.

## Decisions
- Frozen mechanic: each spawn is a distinct origin; new frozen cells inherit the origin ID of the cluster they were added to
- Frozen spread: pick a random live origin each wave, grow only that cluster by 1 (Manhattan-closest empty)
- Frozen thaw: keep geometric BFS (a) — if two origin-clusters touched, BFS treats them as one for thaw purposes
- Frozen state stored in `frozenOrigins` Map (cellKey → originId) — mirrors hot-zones pattern (separate Set, not board sentinel)
- Hints: modifier-aware placements OVERRIDE raw-score best-merge (players get real help, not generic tips)
- Hints cover all modifiers — frozen, disease, bomb, hot zone (flip not penalised or bonused; null-block already non-placable)
- Hints are ALWAYS modifier-specific — removed the rotating `HINT_TIPS` array entirely
- Hint = concrete actionable move (cells + tray + rotation), never a generic warning — reflects the "ad-reward optimal move" model
- Hint scoring deltas: disease-adjacent placement −100k, bomb merge at fuse≤1 with goal unmet −100k, 6-merge near frozen cluster +1000, hot-zone merge +raw (doubles weighting)
- Returned hint `.score` reflects actual pts earned in-game, not the inflated hint-weighted score
- Bug triage order: simple → hard. #1 (home play sound) and #4 (state refresh on theme change) parked pending repro steps from user

## Work completed
- `dobbelaar.js`
  - `frozenOrigins` Map state + reset in `startLoading`
  - `placeFrozenCells(count)` assigns originId 1..N at spawn
  - `spreadFrozenCell()` — groups frozen cells by origin, shuffles origins (Fisher-Yates), grows first origin with a reachable empty by Manhattan-closest
  - `thawClosestCluster()` — BFS unchanged; deletes `frozenOrigins` entries for removed cells
  - Removed `HINT_TIPS` + `hintTipIndex`
  - Added `modifierHintBonus(info, groups, raw)` — scoring delta helper
  - Added `bestSafePlacement(dice, source)` — non-merge fallback, penalises diseased adjacency
  - Added `mergeHintText(best, trayLabel, rotNote)` — modifier-flavoured merge message (thaw / hot zone / default)
  - `bestMergeForDice()` ranks by `pts + modifierHintBonus`; returns actual `pts` in `.score`; returns null when best is negative (all placements are traps → fall through to safe placement)
  - `computeHint()` rewrite: modifier-aware merge → safe placement with modifier flavour → board-full fallback
- `checkpoints/latest.md` — open threads updated with frozen/calendar/home-sound items

## Open threads
- Frozen overhaul + hints rewrite are UNCOMMITTED in working tree — playtest both, then commit or revert
- Home page main-menu Play button: user reports "random" sound; further investigation showed possible MISSING sounds — parked pending repro
- Calendar: completed played days don't consistently show — user suspects it's symptom of #4
- State refresh / progress loss on theme change (#4) — parked pending repro; `setTheme()` code itself doesn't touch board state
- Chain residue bug (deprioritised): 3×1d merge → 3 leaves adjacent 3-cluster not fully consumed
- Chain mechanic redesign (deprioritised): explanation + whether chainGoal needs rebalance
- Flip-die hint heuristic deliberately skipped — accurate modelling would require simulating flip before merge scan

## Constraints
- Hot zones + frozen origins use separate Maps/Sets (NOT board sentinels)
- Hint must always return actionable placement (cells + tray + rotation), or terminal "board full" message
- Hint `.score` field must reflect actual in-game pts earned, not inflated hint-weighted score
- Modifier hint deltas are signed for clarity: huge penalties (−100k) for traps, moderate bonuses (+1000, +raw) for strategic plays
- No generic rotating hint tips — all messages must be modifier-contextual
- Sine/triangle waveforms only for SFX
- No hardcoded hex/px outside SVG illustration paths — tokens only
- `sound-utils.js` / `music-utils.js` pure audio — no game logic
- Bomb tick inside merge wave resolution only
- `triggerWin` double-fire guard must stay (chainWon flag)
- `animation-fill-mode: both` on all entry animations
- Button press animation on button element only — icon flips on icon child
- Chain reward word only shows if no waveWord fired that wave

## Next step
Playtest the frozen overhaul + hints rewrite in-browser. Recommended challenges:
- 2026-03-26 "Narrow Path" or 2026-04-18 "Ice Grip" (3 frozen) — verify random-origin spread picks different origins each wave and thaw clears the correct cluster
- Any disease challenge — verify hint never points to a placement adjacent to a diseased die
- Any bomb challenge — at fuse=1 with goal unmet, verify hint suggests a non-merge placement
- Any hot-zone challenge — verify hint prefers merges involving hot cells

After playtest, either commit both changes or revert. Then address parked bugs (#1, #4) once repro steps exist.
