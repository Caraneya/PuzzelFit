---
label: latest
saved: 2026-04-15
---

## Goal
Build out a full visual interactivity layer for PuzzleFit games — Phase 1 general animations (shared components), Phase 2 Dobbelaar-specific gameplay animations. Dobbelaar is the active game.

## Decisions
- Phase 1 (general): button press token, overlay zoom, badge stagger, calendar flip+wave, stats count-up, star ripple, home entry, win/lose sheet entry animations
- Phase 2 (Dobbelaar): gameplay events — die land, merge flash, score pop, reward word entrance, hot zone pulse
- `--scale-press: 0.85` — visible press feedback on all buttons
- Win celebration scales by difficulty via `data-difficulty` attribute on `.sheet-overlay--win`
- Calendar day wave fires only on month nav, not on day tap
- Home icon loops with `home-icon-pulse` after entry animation
- Calendar next-arrow flip lives on the SVG inside the button, not the button element itself
- Unavailable calendar cells use a dedicated `cal-day-wave-unavailable` keyframe ending at `opacity: 0.4`

## Work completed
- `tokens.css` — `--scale-press: 0.85`
- `components.css` — full Phase 1 animation system (button press, modal zoom, badge stagger, calendar flip/wave, star ripple, home entry, win/lose sheet animations)
- `components.css` — `cal-day-wave-unavailable` keyframe + override for unavailable cells during nav flip, so they hold `opacity: 0.4` instead of 1
- `game-utils.js` — `renderCal(dir)` flip animation, `triggerStarRipple()`, `countUp()` utility
- `game-utils.js` — calendar next-arrow: flip applied to inner SVG via `firstElementChild.style.transform`, not the button
- `dobbelaar.html` — `.sheet-overlay--win/.--lose` classes, win SVG restructured with `db-win-flag-assembly`; removed `style="transform:scaleX(-1)"` from `#db-cal-next`; fixed mojibake in instruction text (90°, ≤, →); verbose rewrite of merge rule description
- `dobbelaar.css` — assembly jump animation, box entrance only
- `dobbelaar.js` — `renderStats()` with count-up on open

## Open threads
- Phase 2: Dobbelaar gameplay animations (TBD)
- Wire `data-difficulty` on `#sheet-win` in `dobbelaar.js` before `openSheet`
- Stats total time does not count-up (intentional)

## Constraints
- Tokens only — no hardcoded hex/px outside SVG paths
- `game-utils.js` backward-compatible
- `animation-fill-mode: both` on all entry animations
- Calendar day wave: nav only, not tap
- Button press animation operates on button element only — icon flips must live on the icon child, not the button

## Next step
Wire `data-difficulty` on `#sheet-win` in `dobbelaar.js`, then begin Phase 2 Dobbelaar gameplay animations.
