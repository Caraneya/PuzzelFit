---
label: latest
saved: 2026-04-15
---

## Goal
Build out a full visual interactivity layer for PuzzleFit games — Phase 1 general animations (shared components) done, Phase 2 Dobbelaar-specific gameplay animations next. Also polish audio and button feedback across the game.

## Decisions
- Phase 1 (general): button press, overlay zoom, badge stagger, calendar flip+wave, stats count-up, star ripple, home entry, win/lose sheet entry animations — all complete
- Phase 2 (Dobbelaar): die land animation + hot zone pulse are the two genuine gaps (merge flash, score pop, reward word, floating score already exist)
- Button press: JS-driven `initBtnPress()` on `pointerdown` — adds `btn--pressing` class, removed all `:active` overrides so nav-bar + toolbar buttons also animate
- Star rating toggle: tap top star → clear all; tap other star → set to that level
- Star ripple stagger reversed: clicked star (top) animates at delay 0, others cascade inward
- Sound delay fix: `play()` awaits `ctx.resume()` before scheduling; AudioContext pre-warmed at DOMContentLoaded
- Calendar next-arrow flip lives on the SVG child, not the button element
- Unavailable calendar cells use `cal-day-wave-unavailable` keyframe ending at opacity 0.4

## Work completed
- `sound-utils.js` — `play()` waits for context resume before firing; eliminates first-tap delay
- `game-utils.js` — `initBtnPress()` global button press animation; `triggerStarRipple` reversed stagger; star toggle logic fixed; `countUp()`, `renderCal(dir)` flip animation; calendar next-arrow flip on inner SVG child
- `components.css` — full Phase 1 animation system: `@keyframes btn-press` + `.btn--pressing`, modal zoom, badge stagger, calendar flip/wave + `cal-day-wave-unavailable`, star ripple, home entry, win/lose sheet entry; all `:active` overrides removed
- `tokens.css` — `--scale-press: 0.85`
- `dobbelaar.js` — AudioContext pre-warm; `btn-tap` sound on Play, all back buttons, home/loading/tutorial nav icons, tutorial next, hint close, calendar prev/next, calendar day select; `renderStats()` with count-up; `recordGameResult()`, `computeStreak()`, parking idle/catch animations; `GameUtils.initBtnPress()` called on init
- `dobbelaar.html` — `.sheet-overlay--win/.--lose` classes; 6 stat IDs; win SVG restructured; removed inline scaleX(-1) from cal-next; fixed mojibake in instructions
- `dobbelaar.css` — win assembly jump animation, parking idle pulse, parking catch bounce

## Open threads
- Phase 2 gameplay animations: die land (`db-cell--land`) on placement, hot zone pulse (infinite amber glow)
- Wire `data-difficulty` on `#sheet-win` in `dobbelaar.js` before `openSheet`
- Stats total time does not count-up (intentional)
- No SFX for streak milestone or hot zone hit

## Constraints
- Sine/triangle waveforms only for SFX
- No hardcoded hex/px outside SVG illustration paths — tokens only
- `game-utils.js` backward-compatible
- `animation-fill-mode: both` on all entry animations
- `sound-utils.js` / `music-utils.js` are pure audio — no game logic inside them
- `triggerWin` double-fire guard must stay
- Hot zones use a separate Set (not a board sentinel)
- Button press animation on button element only — icon flips must live on icon child

## Next step
Phase 2: add `db-cell--land` CSS animation + JS to tag placed cells in `doPlace()`, then add hot zone pulse (`@keyframes db-hot-pulse` infinite amber glow on `.db-cell--hot-zone`).
