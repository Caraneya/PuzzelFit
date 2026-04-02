---
label: latest
saved: 2026-04-02
---

## Goal
Implement tutorial step animations for Dobbelaar. Steps 1 and 2 are complete. Step 3 was just built. Steps 4–5 still need building.

## Decisions
- `.tut-anim.tut-anim--active` drives visibility; `showTutorialStep(n)` toggles by index
- All scenes use `container-type: inline-size` with `aspect-ratio` and `cqw` units for uniform scaling
- Step 1: pair (green die-1 + blue die-2) dragged to bottom-left + bottom-middle cells
- Step 2: pair (blue die-2 LEFT + red die-4 RIGHT) tapped 3× rotating 90° CW, dragged to last column
- Step 3: pair (red-4 LEFT + blue-2 RIGHT) dragged to top-left 2 empty cells; three blue-2 dice (0,1)+(1,1)+(1,2) merge into die-6 at (1,1); `.ta3-merged` overlays cell (1,1) absolutely
- Step 3 cycle: `calc(var(--duration-xslow) * 7 + 1000ms)` = 5200ms — content at same speed as 4200ms, extra 1000ms added as idle pause at cycle end (81–100% ≈ 988ms) before looping
- Step 3 merged die hold: 52–67% of 5200ms ≈ 780ms (design target was ~800ms)
- Pre-placed cells use **background animation** (not opacity) so they appear as empty cells after merge rather than transparent holes
- `ta3-merged` absolutely positioned at `calc(36.90cqw + 2px)` to account for grid border
- Rotate icon in tray is static visual only (no rotate icon in step 3 — no rotation needed)
- `prefers-reduced-motion` block required on every step
- All colors via CSS tokens only — no hardcoded hex

## Work completed
- `dobbelaar.html` — step 3 `.tut-anim--step-3` fully populated: grid (red-4 at (0,2), green-1 at (1,0), blue-2 at (1,1) and (1,2) pre-placed; land-r at (0,0), land-b at (0,1)); `.ta3-merged` overlay with 6 pips + ! badge; tray; pair (red+blue); hand SVG. Steps 4–5 remain empty placeholders.
- `dobbelaar.js` — step 3 description updated to: "You score points merging three or more similar dice. They merge into their sum, or disappear if the total is over 6."
- `dobbelaar.css` — full `ta3-*` block: scene/grid/cell/pip/tray/pair/merged/badge/hand rules + all keyframes (ta3-pair-anim, ta3-hand-anim, ta3-land-r, ta3-land-b, ta3-pip-r, ta3-pip-b, ta3-preblue, ta3-prepip, ta3-merged-anim) + compact + reduced-motion

## Open threads
- Steps 4–5 of the tutorial have empty `.tut-anim` divs — HTML + CSS + keyframes still needed
- Visual QA of step 3 not yet confirmed in browser (merged die position, flash timing, 1s loop pause feel)
- Visual QA of step 2 also still pending from last checkpoint

## Constraints
- Never use PowerShell `WriteAllText` with complex string interpolation — use Edit tool only
- All tutorial animation CSS scoped under `/* ── TUTORIAL ANIMATIONS */` at end of `dobbelaar.css`
- Inject only inside `.tutorial__play-area` — never touch container itself
- No hardcoded hex colors or px sizes — tokens and cqw only
- `aria-hidden="true"` on every `.tut-anim` wrapper
- `prefers-reduced-motion` block required on every step
- Pre-placed cells in merge steps: use background animation (not opacity) to avoid transparency holes
- Step 3 uses 5200ms cycle (`* 7 + 1000ms`); all keyframe % are 4200ms values × 0.8077

## Next step
Visual QA of step 3 in the browser — verify merged die overlays cell (1,1) correctly, flash timing at 49%, ~780ms hold, and the ~1s pause before loop restart. Then build step 4 (parking spot).
