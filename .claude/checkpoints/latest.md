---
label: latest
saved: 2026-04-23
---

## Goal
Polish PuzzleFit UI — unify the cross icon across the project and rebuild the hint tooltip so it's fully responsive (toolbar-anchored, content-sized, 12px gutters, landscape-aware).

## Decisions
- Cross icon upgraded from `0 0 14 14` with hardcoded `#CCCCCC` → `0 0 20 20` with `currentColor`; applied in both `icons.js` and `InternalTesting/game.js`
- Hint tooltip moved OUT of `.game-hint-pointer` to be a sibling of `.game-toolbar__left/__right` inside `.game-toolbar` — pointer becomes an empty triangle, tooltip anchors to toolbar (which is `position: relative`)
- Tooltip visibility tied to toolbar via `:has(.game-hint-wrap--open)` instead of inheriting from pointer opacity
- Tooltip sizes to content: `left: var(--space-3)`, NO `right`, `max-width: calc(100% - var(--space-6))` — keeps 12px gutters on both sides without forcing full stretch
- InternalTesting has its own copy of hint CSS in `game.css` (not shared), kept in sync
- InternalTesting landscape override at `@media (min-aspect-ratio: 1/1)` — separate `top` value
- Merge cascade bug in Dobbelaar is a design consequence (simultaneous group resolution + spawn at last-placed cell), not a simple bug — user chose to move on without fixing

## Work completed
- `icons.js:123-128` — cross icon: viewBox 20x20, `currentColor`
- `InternalTesting/game.js:839-844` — same cross icon update
- `components.css:2246-2266` — `.game-hint-tooltip` rewritten: absolute from toolbar, `top: calc(100% - var(--space-1))`, `left: var(--space-3)`, `max-width: calc(100% - var(--space-6))`, opacity transition, `:has()` visibility rule
- `InternalTesting/game.css:2616-2642` — same tooltip rewrite + landscape `@media (min-aspect-ratio: 1/1)` override for top
- `dobbelaar.html`, `InternalTesting/game.html`, `flow-prototype.html`, `MasterStyleguide.html` — tooltip moved out of `.game-hint-pointer` (now empty) and appended as sibling inside `.game-toolbar`
- `dobbelaar.js:1487`, `InternalTesting/game.js:2672` — querySelector updated from `#db-game-hint-wrap .game-hint-tooltip__body` → `#screen-gameplay .game-hint-tooltip__body`
- `workspace_permissions.md` in memory — PuzzleFit/ (root + subfolders) read+write, deletion NOT granted

## Open threads
- Merge cascade bug: 3 fix options discussed (A: adjacency-aware spawn, B: super-group, C: sequential resolution) — user declined all, moved on
- GitHub merge of internal testing branch → main — user asked, then interrupted the git status check

## Constraints
- PuzzleFit/ root + all subfolders are editable; deletion requires explicit permission
- Shared files (tokens.css, components.css, icons.js, game-utils.js, MasterStyleguide.html) ARE touchable because root access was granted — but still ask before substantial overwrites
- CSS must be token-based (no hardcoded hex/px outside SVG paths)
- Responsive > absolute: prefer layout that adapts to container/orientation, not fixed pixel values
- `:has()` is acceptable (modern browser support confirmed)
- Changes to hint structure must be applied to all 4 HTML files AND the 2 JS files AND both CSS files (components.css + InternalTesting/game.css)

## Next step
Resume the GitHub merge of the internal testing branch into main. First step blocked — confirm git repo state and remotes with the user before running any git commands (previous attempt was interrupted).
