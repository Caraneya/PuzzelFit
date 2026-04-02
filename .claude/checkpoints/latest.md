---
label: latest
saved: 2026-04-02
---

## Goal
Implement tutorial step animations for Dobbelaar's tutorial overlay. Step 1 ("Place your dice") shows a 2×3 grid, a tray with two dice, and a hand cursor animating a drag from tray to grid, then a "placed on board" snap effect.

## Decisions
- `.tut-anim.tut-anim--active` drives visibility; `showTutorialStep(n)` toggles `.tut-anim--active` via `querySelectorAll('.tut-anim')` index
- `.ta1-scene` is `container-type: inline-size` with `aspect-ratio: 168/204`; all internal values in `cqw` so the scene scales to fill the play area width
- Tray die size = 13cqw so two dice stacked (rotated pair) fit tray height: `2×13 + 2×7.14pad = 40.28 ≤ 40.48cqw`
- Pair moves as a unit (same `--ta1-dx / --ta1-dy` on `.ta1-scene`); placement trigger = pair midpoint reaching cell-pair midpoint `(34.52, 50.00)cqw`
- `--ta1-dx: -15.49cqw`, `--ta1-dy: -51.19cqw` (default); `--ta1-dy: -44.05cqw` on `max-width: 390px` (space-2 vsep)
- Die spacing in tray = `space-1` (4px = 2.38cqw); pair centered horizontally in tray
- Hand top-left = tray pair center in start state; translates to cell-pair midpoint top-left in end state; `width: 20cqw`
- "Placed on board": dice bounce (scale 1→1.12→1) then fade out at 63%; landing cells animate to die color with pips; hand stays visible until 88%
- Separate keyframes: `ta1-die-anim` (bounce+fade), `ta1-hand-anim` (travel synced at 52%, hold, fade); both use shared translate vars
- Compact layout at `max-width: 390px`: aspect-ratio 168/192, tray top 73.81cqw, die tops 87.55cqw, hand top 94.05cqw
- SVG hand: outer path `fill="currentColor"`, inner path `fill="var(--color-surface)"`, wrapper `color: var(--color-primary)`, `width: 20cqw; aspect-ratio: 1`
- All colors via CSS tokens only — no hardcoded hex
- `prefers-reduced-motion` block required

## Work completed
- `dobbelaar.html` — `.tutorial__play-area` replaced placeholder span with 5 `.tut-anim` step divs; step 1 has full scene HTML (grid with `.ta1-land--1/2` landing cells with pips, tray, two dice with pips, hand SVG); steps 2–5 are empty placeholders
- `dobbelaar.js` — `showTutorialStep()` no longer sets `db-tut-illustration` text; now toggles `.tut-anim--active` by index on all `.tut-anim` elements
- `dobbelaar.css` — full tutorial animations section added at bottom: scene container, grid, cells, landing cells, tray, dice (13cqw), pips, hand, all keyframes, compact media query

## Open threads
- Steps 2–5 of the tutorial have empty `.tut-anim` divs — HTML + CSS + keyframes still needed
- Visual QA of step 1 animation not confirmed in browser yet (coordinate values are calculated, not eyeballed)

## Constraints
- Never use PowerShell `WriteAllText` with complex string interpolation — use Edit tool only
- All tutorial animation CSS scoped under `/* ── TUTORIAL ANIMATIONS */` at end of `dobbelaar.css`
- Inject only inside `.tutorial__play-area` — never touch container itself
- No hardcoded hex colors or px sizes — tokens and cqw only
- `aria-hidden="true"` on every `.tut-anim` wrapper
- `prefers-reduced-motion` block required

## Next step
Visual QA of the step 1 animation in the browser — verify dice/hand positioning, bounce timing, landing cell color reveal, and compact layout on narrow screens. Then proceed to step 2 ("Rotate and match").
