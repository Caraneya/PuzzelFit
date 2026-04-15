---
label: latest
game: Dobbelaar
saved: 2026-04-15
---

## Goal
Improve visual interactivity across Dobbelaar and the shared component system — entry animations, gameplay events, and a scaled win celebration. Work is split into Phase 1 (general/components.css), Phase 2 (Dobbelaar gameplay animations, TBD).

## Decisions
- Phase 1 = general animations in `components.css` + `tokens.css` + `game-utils.js`; Phase 2 = Dobbelaar gameplay events (TBD)
- `--scale-press: 0.85` token; `.btn:active` snaps instantly, 60ms hold before bounce release
- Overlay popups: zoom in from `scale(0.85)` on open, reverse on close
- Sheet list badges: stagger zoom-in (pop) when sheet opens, delays 300–900ms
- Calendar month nav: slide left/right + wave day entry using `--day-index` CSS var; day animation only fires on nav (not on tap)
- Stats numbers: count-up via `GameUtils.countUp()` — fires 380ms after sheet opens (waits for slide-in)
- Feedback stars: ripple wave outward from tapped star using `--star-index` CSS var
- Home screen: icon float-in + loop pulse (3s), title fade, CTA slide-up, week section lift, rows stagger at nth-child 1/3/5/7/9/11 (interleaved with dividers)
- Win sheet: `.sheet-overlay--win` class; title zooms from `scale(0.6)`, `data-difficulty="hard"` triggers overshoot bounce; body fades staggered
- Lose sheet: `.sheet-overlay--lose` class; title + body slide-up staggered
- Win SVG: `db-win-flag-assembly` wraps box + pole + chart + arrow so they jump together; notebook animates independently

## Work completed
- `tokens.css` — `--scale-press: 0.85` added
- `components.css`:
  - `.btn:active` uses `--scale-press`, `transition-delay: 0ms` on press, `60ms` hold on release
  - `.modal` zoom-in from `scale(0.85)` on open
  - `@keyframes badge-pop` + stagger on `.sheet__list-badge` (7 levels)
  - Calendar: `cal-slide-from-right/left`, `cal-day-wave` with `--day-index`, `overflow: hidden` on `.cal-month`
  - Star ripple: `star-pulse` keyframe, `.form-star--ripple` with `--star-index` stagger
  - Home entry: `home-float-in`, `home-fade-in`, `home-slide-up`, `home-lift`, `home-row-in`, `home-icon-pulse` (looping)
  - Win/lose sheet animations: `sheet-title-zoom`, `sheet-title-zoom-bounce` (hard), `sheet-body-fade`, `sheet-slide-up-fade`
- `game-utils.js`:
  - `renderCal(dir)` — sets `--day-index` on each day; clears flip class at start; re-adds on nav
  - `navCal(y, m, dir)` + nav buttons pass `'prev'`/`'next'`
  - `triggerStarRipple(filled)` — stagger ripple on filled stars after click
  - `countUp(el, target, duration, format)` — general count-up utility
- `dobbelaar.html`:
  - `sheet-overlay--win` class on `#sheet-win`
  - `sheet-overlay--lose` class on `#sheet-lose`
  - Win SVG restructured: `db-win-flag-assembly` wraps box + pole + chart + arrow; notebook moved outside
- `dobbelaar.css`:
  - `db-win-flag-assembly` added with `transform-origin: center bottom`
  - Jump animation moved from `.db-win-box` to `.db-win-flag-assembly`; box keeps entrance only
- `dobbelaar.js`:
  - `renderStats()` rewritten — resets numeric stats to `0`, counts up after 380ms delay

## Open threads
- Phase 2: Dobbelaar gameplay animations (die land, merge flash, score pop, reward word entrance, hot zone pulse)
- Win celebration scaling by difficulty: CSS hooks in place (`data-difficulty="hard"`), but `dobbelaar.js` does not yet set this attribute on `#sheet-win` when triggering win
- Stats `db-stat-totaltime` does not count-up (formatted time — skipped intentionally)

## Constraints
- Sine/triangle waveforms only for SFX
- No hardcoded hex/px outside SVG illustration paths — tokens only
- `game-utils.js` changes must remain backward-compatible
- `sound-utils.js` / `music-utils.js` are pure audio — no game logic
- `triggerWin` double-fire guard (`if (chainWon) return`) must stay
- Hot zones use a separate Set (not a board sentinel)
- Reward words only fire when `turnMergedDiceCount >= 5`
- CSS animations: use `animation-fill-mode: both` for entry animations
- Calendar day wave only plays on month navigation (not on day tap)

## Next step
Wire `data-difficulty` onto `#sheet-win` in `dobbelaar.js` when `triggerWin()` fires — read `ch.difficulty` from the active challenge and set it as an attribute on the sheet before `openSheet('sheet-win')` is called. Then begin Phase 2 gameplay animations.
