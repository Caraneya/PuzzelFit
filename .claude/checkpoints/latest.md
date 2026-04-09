---
label: latest
saved: 2026-04-09
---

## Goal
Building out the PuzzleFit project infrastructure and Dobbelaar game. Current session focused on skill/command cleanup and shared CSS architecture.

## Decisions
- `game-page` and `game-passport` skills deleted — consolidated into a single `/new-game` skill using game-passport rules
- `/new-game` now: parses passport → requests Figma screen → extracts variables → generates derived content → creates game-bible.html + CSS stub + styleguide stub → updates GamePage.html
- Game bible pages default to `data-theme="light"` on the `<html>` element
- Nonogram game removed from the project (was never started)
- `utility-pages.css` created in project root — holds all generic `.bible-*` layout/component styles
- Dobbelaar-specific chip variants (`.bible-chip--*`) stay inline in dobbelaar-bible.html since they reference game-specific tokens (`--color-die-5`, etc.)
- `/new-game` skill enforces linking `tokens.css` + `components.css` + `utility-pages.css` for all future game bibles

## Work completed
- `.claude/commands/new-game.md` — replaced with consolidated game-passport rules; links updated to include `utility-pages.css`
- `.claude/commands/game-passport.md` — deleted
- `.claude/commands/game-page.md` — deleted
- `Games/Dobbelaar/dobbelaar-bible.html` — `data-theme="light"` added; inline `<style>` reduced to chip variants only; now links `utility-pages.css`
- `GamePage.html` — Nonogram card removed
- `utility-pages.css` — created with all generic `.bible-*` styles (layout, header, proto-btn, section, card, tag-list, step-list, scorebar, stat-grid, mechanic-list, back-link)

## Open threads
- Visual QA of all 4 Dobbelaar tutorial steps not yet confirmed in browser
- `chainGoal` win condition not implemented — falls back to 300 pts score target
- `wildDice`, `diseasedDice`, `bombDice`, `frozenCell`, `flipDice` are data-only stubs
- `Challenges.html` and calendar panel not visually QA'd yet
- git push still pending (was failing due to credential dialog cancellation)

## Constraints
- Never use PowerShell `WriteAllText` with complex string interpolation — use Edit tool only
- No hardcoded hex colors or px sizes — tokens only
- `utility-pages.css` is for utility/documentation pages only — never import it from actual game screens
- `/new-game` skill: bible HTML must link tokens.css + components.css + utility-pages.css, `data-theme="light"` on html element
- Game-specific chip/modifier visuals stay in the game's bible file, not in utility-pages.css
- `/populate-challenges` must never auto-apply wiring changes — always present diff and wait for approval

## Next step
Push pending commits (`git push`), then continue Dobbelaar modifier implementation — tackle `chainGoal` win condition or `wildDice` mechanic next.