---
label: latest
game: Nonogram
saved: 2026-04-09
---

## Goal
Bootstrap the Nonogram game — a grid-logic puzzle where players fill cells based on row/column number clues. This session processed the game passport and generated the full game bible + folder structure.

## Decisions
- Primary action: tap to fill → tap again to mark X → tap again to clear (3-state cycle)
- Lives: row of circles — remaining = filled orange, lost = grey (confirmed from screenshot)
- Hint system: overlap method — finds cells guaranteed filled by both leftmost and rightmost valid positions; 3 hint charges per game, auto-fills after 1200ms highlight
- Grid sizes: 5×5 onboarding → 10×10 default → 15×15 mastery
- Timer: Easy 300s / Medium 240s / Hard 180s; +5s bonus per completed row/col
- Score: 10pts per correct cell, 50pts per row/col complete, 200pts perfect-solve bonus, 2pts per remaining second
- Difficulty curve: 5 tiers (Onboarding 5×5 → Hook 7×7 → Engagement 10×10 → Challenge 12×12 → Mastery 15×15)

## Work completed
- `nonogram-game-bible.html` — full bible: primary action, match rule, win/lose tags, cell states (3-state with visual chips), hint system detail, 5-step tutorial (verbatim from passport), score bar (lives + difficulty), settings, stats, skill expression, depth layer, animation mood, SCREAMING_SNAKE_CASE game variables, difficulty curve table, engagement loops (core/session/meta), daily challenge concept
- `nonogram.css` — stub, awaiting `/game-styleguide`
- `nonogram-styleguide.html` — stub, awaiting `/game-styleguide`

## Open threads
- `nonogram.html` does not exist — bible "Open Flow Prototype" button links to it (dead link until `/game-build`)
- `nonogram-passport.json` not saved — Dobbelaar has one for parity
- Lives visual (orange/grey circles) must be respected in styleguide and game build

## Constraints
- No hardcoded hex values — tokens only
- `data-theme="light"` on `<html>` — FORCED BRIGHT, never omit
- `utility-pages.css` is for documentation pages only — never import from game screens
- Bible links: `../../tokens.css`, `../../components.css`, `../../utility-pages.css`
- `.back-btn` / `bible-back` always links to `../../GamePage.html`

## Next step
Run `/game-styleguide` to populate `nonogram.css` and `nonogram-styleguide.html` with the Nonogram visual layer.
