---
label: latest
saved: 2026-04-02
---

## Goal
Implement tutorial step animations for Dobbelaar. Steps 1, 2, and 3 are built. Steps 4–5 still need building.

## Decisions
- `.tut-anim.tut-anim--active` drives visibility; `showTutorialStep(n)` toggles by index
- All scenes use `container-type: inline-size` with `aspect-ratio` and `cqw` units for uniform scaling
- **Loop reset pattern**: near end of cycle, movable elements fade OUT at their final position → invisible snap to start → fade IN at start → loop. No extra idle after respawn.
- **1s hold after action**: pause happens while the result is VISIBLE (cells lit / merged die showing), not after the pair reappears in the tray
- Step 1: pair (green die-1 + blue die-2) dragged to bottom-left + bottom-middle cells
- Step 2: pair (blue die-2 LEFT + red die-4 RIGHT) tapped 3× rotating 90° CW, dragged to last column
- Step 3: pair (red-4 LEFT + blue-2 RIGHT) dragged to top-left 2 empty cells; three blue-2 dice merge into die-6 at (1,1)
- Pre-placed cells use **background animation** (not opacity) during merge so they appear as empty cells after merge rather than transparent holes
- Blue pre-placed cells fade IN with opacity animation on reset (not a background-color snap)
- `prefers-reduced-motion` block required on every step
- All colors via CSS tokens only — no hardcoded hex

## Work completed
- `dobbelaar.css` — Full tutorial animation rework:
  - **Step 1** (`* 6` = 3600ms): action done 63%, 1s hold 63–90%, fade-out 90–93%, snap 94%, fade-in 94–100%
  - **Step 2** (`* 7` = 4200ms): content rescaled ×0.857 from 3600ms; action done 60%, 1s hold 60–84%, fade-out 84–88%, snap 89%, fade-in 89–100%
  - **Step 3** (`* 7` = 4200ms): content rescaled ×(5200/4200) from 5200ms; merge appears 64%, 1s hold 64–88%, fade-out 88–92%, snap 93%, fade-in 93–100%
  - `ta3-preblue`: opacity-based fade-in on reset (snaps to blue at 92% opacity:0, fades to opacity:1 at 100%)
- `dobbelaar.html` — Steps 1–3 fully populated; steps 4–5 remain empty placeholders
- `dobbelaar.js` — Step 3 description: "You score points merging three or more similar dice. They merge into their sum, or disappear if the total is over 6."

## Open threads
- Steps 4–5 of the tutorial have empty `.tut-anim` divs — HTML + CSS + keyframes still needed
- Visual QA of steps 1, 2, 3 not yet confirmed in browser after today's timing restructure
- Step 3 `ta3-merged` absolutely positioned at `calc(36.90cqw + 2px)` — verify overlay still lands correctly with new 4200ms total (layout unchanged, should be fine)

## Constraints
- Never use PowerShell `WriteAllText` with complex string interpolation — use Edit tool only
- All tutorial animation CSS scoped under `/* ── TUTORIAL ANIMATIONS */` at end of `dobbelaar.css`
- Inject only inside `.tutorial__play-area` — never touch container itself
- No hardcoded hex colors or px sizes — tokens and cqw only
- `aria-hidden="true"` on every `.tut-anim` wrapper
- `prefers-reduced-motion` block required on every step
- Pre-placed cells in merge steps: use background animation (not opacity) DURING the animation to avoid transparency holes; opacity fade-in is fine for the reset phase
- Loop reset pattern: fade-out at final position → invisible snap → fade-in at start → no extra idle

## Next step
Visual QA of steps 1–3 in the browser after the timing restructure, then build step 4 (parking spot mechanic).
