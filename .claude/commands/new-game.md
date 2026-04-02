You are setting up a new PuzzleFit game. The argument is the game name: $ARGUMENTS

Follow this workflow exactly. Do not skip steps or batch questions.

---

## Step 0 — Scaffold the folder

Create the folder `Games/$ARGUMENTS/` with these three empty files:
- `$ARGUMENTS.html` — linked to `../../tokens.css`, `../../components.css`, `../../game-utils.js`, `./$ARGUMENTS.css`, `./$ARGUMENTS.js`
- `$ARGUMENTS.css` — with a header comment "GAME — $ARGUMENTS styles. Requires: tokens.css + components.css loaded first."
- `$ARGUMENTS.js` — with a header comment and a `document.addEventListener('DOMContentLoaded', () => { ... })` shell

The HTML file must have:
- `screen-home` as `class="proto-screen is-visible is-active"` (no `inert`)
- All other proto-screens as `class="proto-screen"` with `inert` attribute
- A `.proto-badge` div with the game name

---

## Step 1–8 — Shared screens (one at a time)

Go through each screen below **one by one**. After the user answers, implement that screen before moving to the next.

### 1. Tutorial
Ask: "How many tutorial steps does this game need?" (default: 5)
Ask: "Write the step titles/descriptions yourself, or should I generate them from the game rules?"
- If Claude-generates: draft step content and show for approval before building.
- Last step button always reads "Play" instead of "Next".
- Build as a separate `tutorial.html` per game using shared `.tutorial` CSS classes.

### 2. Pause
Standard `.sheet` prefab — single primary action "Continue playing". No questions. Build it.

### 3. Congratulations / Game Over
Standard `.sheet` prefab.
- Win sheet: secondary "Share the win" + primary "Explore challenges". Add `data-no-dismiss` attribute.
- Lose sheet: single primary "Explore challenges". Add `data-no-dismiss` attribute.
No questions. Build both.

### 4. Instructions
Ask: "Write the instructions yourself, or should I generate from the game rules?"
- Self-written: collect 3–10 instruction strings from the user.
- Claude-generated: draft them and show for approval.
- Min 3, max 10 items.

### 5. Calendar
Standard prefab (day/week/month picker).
Ask: "Any custom markers, streaks, or special day states for the calendar?"

### 6. Settings
Ask: "Which settings to include?" — let user pick from:
  - Music (toggle)
  - Sound (toggle)
  - Theme (light / auto / dark segment)
  - Dominant hand (left / right toggle)
Ask: "Extra button or overflow menu inside Settings?"
If nothing selected: default to Sound + Theme for puzzle games.

### 7. Statistics
Ask: "Which stat display?" — let user pick from:
  - Gallery (grid of best scores)
  - Progress bars
  - Added goals
  - Unlocked levels
If nothing selected: default to Gallery with Claude-suggested metrics for the game type.

### 8. Rating Form
Standard prefab (star rating + tickbox + text input for suggestions).
Ask: "Any custom prompt text or extra fields?"

---

## Implementation rules (always apply)

- Feature change order: HTML structure → CSS tokens/classes → JS behaviour. Never write JS against IDs that don't exist yet.
- All colour and spacing values must use tokens from `tokens.css`. No hardcoded hex or px.
- `Icons.render()` valid colors: `default | muted | accent | on-primary | primary | error | warning | tertiary`. Never use `secondary`.
- Win and Lose sheets must have `data-no-dismiss` on their `.sheet-overlay` element.
- Every `proto-screen` except the initial home screen must have the `inert` attribute in HTML.
- After completing all 8 screens, confirm with the user before starting any game-specific gameplay code.
