---
label: latest
game: Dobbelaar
saved: 2026-04-15
---

## Goal
Make Dobbelaar more fun and encourage use of the parking spot through visual interactivity — plus surface real player stats from localStorage history.

## Decisions
- Parking idle reminder: amber pulse (`db-parking--idle`) fires after 10s of unused parked dice; resets on any parking interaction
- Parking catch animation (`db-parking--catch`): scale bounce on `.db-tray-inner` when a die is first dropped into an empty parking slot
- Match shimmer (tried, removed): animating board cells with matching die values was attempted twice but removed — not the right mechanic
- Parking loaded border (`db-parking--loaded`) removed — too noisy
- Parking drop-zone highlight (`db-tray-slot--droptarget`) removed — not wanted
- Game history stored in `db-game-history` (localStorage): one record per `activeChallengeDate`, win beats loss, better score wins on same outcome
- Avg. score computed across all games (including losses), not wins only
- `getElapsed()` added to `makeTimer` return object (backward-compatible) — used to capture seconds played at win/lose

## Work completed
- `dobbelaar.js`:
  - `parkingIdleTimer` module-level variable added
  - `resetParkingIdle()` / `scheduleParkingIdle()` helpers — manage idle reminder lifecycle; idle delay is 10s
  - `triggerParkingCatch()` — forces reflow then adds/removes `db-parking--catch` class (400ms)
  - `renderParking()` — removes `db-parking--idle` / `db-parking--catch` on empty, calls `scheduleParkingIdle()` on filled
  - `handleParkDrop()` — calls `triggerParkingCatch()` when slot was empty before drop
  - `handleParkToSpawnerDrop()` — calls `resetParkingIdle()` before any swap
  - `placeFromParking()` — calls `resetParkingIdle()` before clearing parked dice
  - `startLoading` reset block — calls `resetParkingIdle()` on game restart
  - `getGameHistory()` / `saveGameHistory(h)` — read/write `db-game-history` from localStorage
  - `recordGameResult(won)` — upserts history record for `activeChallengeDate`; called in `triggerWin` (after `timerObj.pause()`) and `triggerLose`
  - `computeStreak(completedDates)` — returns current streak count from completed dates Set
  - `fmtTime(totalSeconds)` — formats seconds as `Xh Ym` or `Xm`
  - `renderStats()` — computes all 6 stats from history + completedDates, updates DOM; called on both stats sheet open paths
- `dobbelaar.css`:
  - `@keyframes db-parking-idle` + `.db-parking--idle` — amber border pulse
  - `@keyframes db-parking-catch` + `.db-parking--catch .db-tray-inner` — scale bounce on catch
- `dobbelaar.html`:
  - 6 stat number spans now have IDs: `db-stat-played`, `db-stat-streak`, `db-stat-winrate`, `db-stat-best`, `db-stat-avg`, `db-stat-totaltime` (default `—`)
- `game-utils.js`:
  - `getElapsed()` added to `makeTimer` return object — returns elapsed seconds (countdown: `initial - current`; count-up: `current`)

## Open threads
- No SFX for streak milestone or hot zone hit (from previous session)
- Further "fun" improvements may be worth exploring (e.g. combo fanfare, board pressure meter)

## Constraints
- Sine/triangle waveforms only for SFX
- No hardcoded hex/px outside SVG illustration paths — tokens only
- `game-utils.js` changes must remain backward-compatible
- `sound-utils.js` / `music-utils.js` are pure audio — no game logic inside them
- `triggerWin` double-fire guard (`if (chainWon) return`) must stay
- Hot zones use a separate Set (not a board sentinel)
- Reward words only fire when `turnMergedDiceCount >= 5`

## Next step
Test the stats flow end-to-end: play a game to win/lose, open Statistics sheet, verify all 6 numbers populate correctly. Then consider adding SFX for streak milestone or hot zone hit.
