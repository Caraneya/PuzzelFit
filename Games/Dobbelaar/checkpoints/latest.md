---
label: latest
game: Dobbelaar
saved: 2026-04-16
---

## Goal
Polish and balance Dobbelaar based on playtesting feedback — fix bugs, improve UX, and make mechanics fair and understandable.

## Decisions
- Bomb ticks on every merge wave (not per turn, not per placement)
- Bomb fuse values bumped: chainGoal → 10, scoreTarget → 8, surviveTimer → 10
- Diseased lose condition: all empty cells adjacent to a diseased die → triggerLose('diseased')
- Reset level in settings overflow + pause sheet
- Calendar button text by state: "Resume playing" / "Play again" (secondary) / "Play today" / "Play Xth of Month"
- `playingDate` tracks active game date; calendar opens on it when gameActive
- `cal-day--today`: skyblue + bold globally; dark mode: text black, tick white, colors same as light
- `inProgressDate` in calCtrl — corner only on actively played date; cleared on win/lose
- Diseased infection: die destroyed (board → 0) — exploit fix; flavor texts updated to match
- Bomb: `!isMerging` guard removed — always triggers lose
- Diseased dice: min Manhattan distance 3 at placement; fallback if board too full
- Diseased skull: `fill: white` in CSS
- Merge result: lands on `lastPlacedCells` if in group; cascades propagate it forward; fallback bottom-left
- Info sheet: second sheet__list for special dice — 28×28 badge cells, SVGs injected by JS; wrapped in `db-instr-dice-section` with `padding: var(--space-2)`
- Challenge balance audit completed — 6 challenges retuned (see Work completed)
- Chain bugs + mechanic redesign deprioritised — tackle last

## Work completed
- `tokens.css` — `--color-border` dark mode → `#636366`
- `dobbelaar.html` — pause/settings reset buttons; special dice list in info sheet with `db-instr-dice-section` wrapper
- `dobbelaar.css` — tint to `::after`; skull `fill: white`; `db-inline-cell--badge` 28×28; `db-instr-dice-section` + `db-instr-section-label` styles
- `dobbelaar.js` — `gameActive`, `playingDate`, `lastPlacedCells`; calendar wired; `checkDiseasedLose`; bomb fix; disease destroy; min-distance placement; merge result positioning; SVG icon injection for info sheet
- `game-utils.js` — `cal-day--today` class; `selectDate` + `setInProgressDate` on calCtrl; `inProgressDate` replaces hardcoded today→in-progress
- `components.css` — `cal-day--today` skyblue + bold; dark mode overrides for tick + today text + completed cell
- `dobbelaar-challenges.js` — 6 challenges retuned:
  - 03-19 "Ticking Bomb": surviveTimer → scoreTarget, 315 → 280
  - 03-20 "Spreading Fast": 420 → 300, flavor updated
  - 03-21 "Frozen Fury": frozenCell 4 → 2
  - 03-27 "Contagion": 315 → 220, flavor updated
  - 04-03 "Fever Pitch": 440 → 320, flavor updated
  - 04-17 "Viral Spread": 315 → 220, flavor updated

## Open threads
- Hints don't account for mechanics — full rewrite, separate session
- Game loses all progress on theme change — investigate separately
- Chain residue bug: after 3×1d merge → 3, adjacent 3-cluster doesn't fully consume (deprioritised)
- Chain mechanic: improve explanation + decide if chainGoal needs redesign (deprioritised)

## Constraints
- Bomb tick inside merge wave resolution only
- `triggerWin` double-fire guard must stay (chainWon flag)
- No hardcoded hex/px outside SVG illustration paths — tokens only
- `animation-fill-mode: both` on all entry animations
- `sound-utils.js` / `music-utils.js` pure audio — no game logic
- Button press animation on button element only — icon flips on icon child
- Hot zones use a separate Set (not a board sentinel)
- Chain reward word only shows if no waveWord fired that wave

## Next step
Hints rewrite — hints currently don't account for modifiers (disease, bomb, frozen, etc.). Read hint logic before touching anything.
