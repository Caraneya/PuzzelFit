---
label: latest
saved: 2026-04-07
---

## Goal
Building out Dobbelaar's daily challenge system: 60 days of challenges (Feb 7 – Apr 7 2026), a full modifier catalogue (10 modifier types), localStorage-based completion tracking, and a live calendar hooked to challenge data.

## Decisions
- Challenge data lives in `dobbelaar-challenges.js`, loaded before `dobbelaar.js` via `<script>` tag
- 10 modifier types: null, timer, maxMerges, nullBlock, chainGoal, wildDice, diseasedDice, bombDice, frozenCell, flipDice
- `chainGoal` winType uses `target` = chain length (not score); `scoreTargetFrom()` helper falls back to 300 until the mechanic is implemented
- `SCORE_TARGET` is now `let` (not `const`), set fresh in `startLoading()` from `activeChallenge`
- `activeChallenge` + `activeChallengeDate` track which day is being played (home Play = today, calendar Play = selected day)
- `localStorage('db-completed')` stores ISO date strings of won games — drives calendar completion state
- `initCalendar` in `game-utils.js` extended with `options.completedDates` + `options.onDaySelect` — backward compatible (no options = empty completedSet, no callback)
- `DEFAULT_CHALLENGE.target` hardcoded to `300` (was accidentally referencing `SCORE_TARGET` — circular dependency bug, now fixed)
- `dobbelaar-passport.json` `tutorialCount` corrected from 5 → 4

## Work completed
- `dobbelaar-challenges.js` — 60 daily challenges Feb 7–Apr 7 2026, `DEFAULT_CHALLENGE`, `getTodayChallenge()`, full modifier catalogue in comments
- `Challenges.html` — static preview page, 60 rows with week dividers + coloured difficulty badges
- `dobbelaar.html` — challenges script tag added before game JS; `db-cal-sel-prefix`, `db-cal-badge-text` IDs added; new `cal-challenge` row (`db-cal-ch`, `db-cal-ch-label`, `db-cal-ch-target`) added below `cal-info`
- `dobbelaar.js` — `scoreTargetFrom()`, `getCompletedDates()`, `markDateCompleted()`, `onCalDaySelect()` added; `startLoading()` applies `activeChallenge`; home Play button sets today's challenge; calendar Play button loads selected day and restarts; `checkWin()` calls `markDateCompleted`; home date label shows challenge name
- `game-utils.js` — `initCalendar(prefix, options)` extended: ISO-date-based `dayState`, `toISO()` helper, `onDaySelect` callback fired on day click + nav + initial render; fake last-3-days COMPLETED set removed
- `components.css` — `.cal-challenge`, `.cal-challenge__label`, `.cal-challenge__target` styles added
- `dobbelaar-passport.json` — `tutorialCount` corrected to 4

## Open threads
- Visual QA of all 4 tutorial steps not yet confirmed in browser
- chainGoal win condition not implemented — currently falls back to 300 pts score target via `scoreTargetFrom()`; all new modifiers (wildDice, diseasedDice, bombDice, frozenCell, flipDice) are data-only stubs
- `Challenges.html` and calendar panel not visually QA'd yet
- Win screen "Play again" path resets `activeChallenge` to today — intentional but not explicitly tested

## Constraints
- Never use PowerShell `WriteAllText` with complex string interpolation — use Edit tool only
- All tutorial animation CSS scoped under `/* ── TUTORIAL ANIMATIONS */` at end of `dobbelaar.css`
- No hardcoded hex colors or px sizes — tokens and cqw only
- `aria-hidden="true"` on every `.tut-anim` wrapper
- `prefers-reduced-motion` block required on every tutorial step
- `game-utils.js` changes must remain backward compatible (optional options param)
- `/populate-challenges` must never auto-apply wiring changes — always present diff and wait for approval

## Next step
Run `/qa` to play-test the home Play button, calendar day selection, and win → completion marking flow. Then `/consistency-check` on the new `.cal-challenge` row and home date label.
