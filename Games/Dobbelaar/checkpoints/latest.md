---
label: latest
game: Dobbelaar
saved: 2026-04-14
---

## Goal
Make Dobbelaar feel more rewarding and interactive by adding new scoring mechanics (group-size multiplier, streak bonus), a new board modifier (hot zones), a new win type (clear the board), and celebratory reward words that appear centre-screen on notable moments.

## Decisions
- Group-size multiplier: ×1 for 3-die, ×1.5 for 4-die, ×2 for 5+-die groups
- Streak bonus tiers: streak 0–1 = ×1.0, streak 2 = ×1.2, streak 3 = ×1.5, streak 4+ = ×2.0; parking is neutral (doesn't reset streak)
- Reward words: warm/punny dice-world puns, centre-screen overlay, only when >=5 dice merged in the turn
  - Streak milestones: Rolling! / Hot dice! / Boxcars! / Can't stop!
  - Group size: Loaded! (4-die) / High roller! (5+-die)
  - Hot zone hit: Jackpot!
  - Board clear win: Clean sweep!
  - Big-game words suppress streak word in the same turn (no stacking)
- Hot zones: permanent (not consumed), ×2 per group, only as a challenge modifier (not always present)
- Clear the board: win when board.flat().every(v <= 0); normal dice spawning continues; initialBoard pre-places dice via [[r,c,value],...] in challenge data
- bonusTarget feature dropped — deemed too shallow to implement
- Streak chip removed from score bar — streak bonus mechanic still runs silently

## Work completed
- `dobbelaar.css` — added `.db-cell--hot-zone` styles, `.db-reward-word` + `@keyframes db-reward-word` animation; streak chip CSS removed entirely
- `dobbelaar.html` — added `#db-reward-word` inside `db-grid-outer`; streak chip element removed from score bar
- `dobbelaar.js`:
  - New state: `mergeStreak`, `turnHadPlacement`, `turnHadMerge`, `rewardWordShownThisTurn`, `hotZoneCells`, `turnMergedDiceCount`
  - New functions: `showRewardWord`, `streakMultiplier`, `placeHotZones` (Fisher-Yates shuffle); `updateStreakDisplay` removed
  - `renderBoard` — applies `db-cell--hot-zone` class for cells in `hotZoneCells`
  - `doPlace` — sets `turnHadPlacement = true`, resets turn flags including `turnMergedDiceCount = 0`
  - `triggerMergeCheck` — applies gMult (group size) + hotZoneMult (×2) + sMult (streak) to each group's earned score; accumulates `turnMergedDiceCount += group.length`; fires wave reward word only if `turnMergedDiceCount >= 5` (Jackpot! > High roller! > Loaded!)
  - `onTurnEnd` — increments or resets `mergeStreak`; fires streak milestone word only if `turnMergedDiceCount >= 5` and no big-game word already shown; resets `turnMergedDiceCount = 0`
  - `scoreTargetFrom` — returns 999999 for `clearBoard` winType
  - `checkWin` — added `clearBoard` branch: checks board empty, shows "Clean sweep!", triggers win
  - `updateScoreBar` — shows plain score for `clearBoard` (no /target suffix)
  - `startLoading` — resets all new state; calls `placeHotZones`; places `initialBoard` dice for clearBoard
  - `describeGoal` — added `clearBoard` win sentence + `hotZone` modifier explanation with inline chip
- `dobbelaar-challenges.js` — updated catalog comment; added 14 May 2026 entries with hotZone and clearBoard, including 3 clearBoard layouts (easy/medium/hard on May 2, 6, 9)

## Open threads
- No SFX yet for streak milestone or hot zone hit — consider adding `streak-up` and `hot-zone` sounds to `sounds.html`
- Music is OFF by default — may flip to ON after playtesting
- `sounds.html` playground remains as standalone tuning tool
- No sound/mechanic implementation for Nonogram yet

## Constraints
- Sine/triangle waveforms only for SFX
- `SoundUtils.register([...])` block near sentinel constants in each game's JS
- Music module stays separate from SFX; no game logic inside either utils file
- No hardcoded hex colors or px sizes — tokens only
- `game-utils.js` must remain backward compatible
- Hot zones use a separate Set (not a board sentinel) so dice can occupy them
- clearBoard challenges should not mix board-modifier sentinels (frozen, flip, bomb, diseased) with initialBoard since they share the same board array
- Reward words only fire when turnMergedDiceCount >= 5 (accumulated across all cascade waves in a turn)

## Next step
Play-test the new mechanics in-browser: verify reward words fire only on big merges (>=5 dice), hot zone cells glow and double score, and clearBoard challenges (May 2, 6, 9) are winnable. Tune params that feel off.
