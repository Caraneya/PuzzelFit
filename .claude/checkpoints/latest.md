---
label: latest
saved: 2026-04-02
---

## Goal
Implement tutorial step animations for Dobbelaar. Step 1 ("Place your dice") and Step 2 ("Rotate and match") are done. Steps 3–5 still need building.

## Decisions
- `.tut-anim.tut-anim--active` drives visibility; `showTutorialStep(n)` toggles by index
- All scenes use `container-type: inline-size` with `aspect-ratio` and `cqw` units for uniform scaling
- Step 1: pair (green die-1 + blue die-2) dragged to bottom-left + bottom-middle cells
- Step 2: same scene geometry; pair (blue die-2 LEFT + red die-4 RIGHT) tapped 3× rotating 90° CW each tap (total 270° CW), then dragged to last column (top-right + bottom-right cells)
- Pair wrapper `.ta2-pair` handles rotation + translation as a unit via `transform: translate(dx,dy) rotate(angle) scale(s)` — translate is in world space (applied last in CSS order)
- Rotation direction: clockwise (positive `rotate()` values)
- After 3×90° CW: blue ends on top, red on bottom (visually at target cells)
- Rotate icon in tray corner is a **static visual indicator only** — uses the `refresh` SVG from `icons.js` inline
- Tap ripple (`.ta2-tap`) is centered on the **pair**, not the rotate icon
- Step 2 drag speed: ~720ms (40%→60% of 3600ms cycle), ~1.67× slower than step 1
- Step 2 rotation speed: exactly 300ms per tap (8.33% of 3600ms cycle)
- `prefers-reduced-motion` block required on every step
- All colors via CSS tokens only — no hardcoded hex

## Work completed
- `dobbelaar.html` — `.tut-anim--step-1` complete (grid, tray, 2 dice, hand SVG, landing cells); `.tut-anim--step-2` complete (pre-placed green+blue in bottom row, landing cells in last column, pair wrapper with blue+red dice, refresh SVG rotate icon, tap ripple, hand SVG); steps 3–5 are empty placeholders
- `dobbelaar.js` — `showTutorialStep()` toggles `.tut-anim--active` by index on all `.tut-anim` elements
- `dobbelaar.css` — full `/* ── TUTORIAL ANIMATIONS */` section: step 1 block (ta1-*) + step 2 block (ta2-*) with pair wrapper, 3-pulse tap animation, CW rotation keyframes, slower drag, landing cell keyframes, compact + reduced-motion media queries

## Open threads
- Steps 3–5 of the tutorial have empty `.tut-anim` divs — HTML + CSS + keyframes still needed
- Visual QA of step 2 not confirmed in browser yet (tap circle position, die alignment at landing, rotation visual)
- After 3×90° CW from blue-left/red-right start: blue lands on TOP of column, red on BOTTOM — this may or may not match the intended game logic (landing cells are set up for red=top-right, blue=bottom-right which is the opposite)

## Constraints
- Never use PowerShell `WriteAllText` with complex string interpolation — use Edit tool only
- All tutorial animation CSS scoped under `/* ── TUTORIAL ANIMATIONS */` at end of `dobbelaar.css`
- Inject only inside `.tutorial__play-area` — never touch container itself
- No hardcoded hex colors or px sizes — tokens and cqw only
- `aria-hidden="true"` on every `.tut-anim` wrapper
- `prefers-reduced-motion` block required
- Do NOT swap die positions to compensate for rotation direction — keep blue-left, red-right in the pair

## Next step
Visual QA of step 2 in the browser — verify tap circle at pair center, 3-pulse timing, CW rotation direction, drag to last column, landing cell color reveal. Then resolve whether the landing cell colors (red=top-right, blue=bottom-right) match the actual post-rotation die positions, and proceed to step 3.
