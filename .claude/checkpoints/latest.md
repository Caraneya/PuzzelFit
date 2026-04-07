---
label: latest
saved: 2026-04-07
---

## Goal
Building out Dobbelaar's game infrastructure: tutorial animations (4 steps, all done), score counter linked to challenge target, and a new `/populate-challenges` skill for generating daily challenges across the calendar.

## Decisions
- Tutorial has exactly **4 steps** — no step 5 (passport says 5 but that's a stale value)
- `.tut-anim.tut-anim--active` drives visibility; `showTutorialStep(n)` toggles by index
- All scenes use `container-type: inline-size` with `aspect-ratio` and `cqw` units for uniform scaling
- **Loop reset pattern**: fade OUT at final position → invisible snap → fade IN at start → no extra idle
- **1s hold after action**: pause while result is VISIBLE, not after pair reappears in tray
- Pre-placed cells use **background animation** (not opacity) during merge to avoid transparency holes
- `SCORE_TARGET` is single source of truth — popup-goal reads it via `id="db-goal-target"` populated by JS
- `/populate-challenges` skill: derives modifiers only from passport's `depthLayer`/`winConditions`, goes week-by-week for approval, writes `[game-name]-challenges.js` + `Challenges.html`, presents wiring diff separately before applying
- `Challenges.html` is zero-dependency static HTML — one row per day, coloured difficulty badge, no JS

## Work completed
- `dobbelaar.css` — All 4 tutorial steps animated (steps 1–4 complete, no step 5)
- `dobbelaar.html:470` — `popup-goal` target replaced with `<strong id="db-goal-target">300</strong>`
- `dobbelaar.js:912` — `DOMContentLoaded` sets `db-goal-target` to `SCORE_TARGET`; `TUTORIAL_STEPS` has 4 entries
- `.claude/commands/populate-challenges.md` — New `/populate-challenges` skill: scope question → week-by-week approval → writes `[game-name]-challenges.js` + `Challenges.html` → presents wiring diff for approval

## Open threads
- Visual QA of all 4 tutorial steps not yet confirmed in browser
- `/populate-challenges` not yet run for Dobbelaar — challenges data file doesn't exist yet
- `dobbelaar-passport.json` still says `"tutorialCount": 5` — should be updated to 4

## Constraints
- Never use PowerShell `WriteAllText` with complex string interpolation — use Edit tool only
- All tutorial animation CSS scoped under `/* ── TUTORIAL ANIMATIONS */` at end of `dobbelaar.css`
- Inject only inside `.tutorial__play-area` — never touch container itself
- No hardcoded hex colors or px sizes — tokens and cqw only
- `aria-hidden="true"` on every `.tut-anim` wrapper
- `prefers-reduced-motion` block required on every step
- Pre-placed cells in merge steps: use background animation (not opacity) DURING the animation to avoid transparency holes; opacity fade-in is fine for the reset phase
- Loop reset pattern: fade-out at final position → invisible snap → fade-in at start → no extra idle
- `/populate-challenges` must never auto-apply wiring changes — always present diff and wait for approval

## Next step
Fix `dobbelaar-passport.json` `tutorialCount` from 5 → 4, then run `/populate-challenges` for Dobbelaar.
