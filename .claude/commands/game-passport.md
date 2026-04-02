# GamePassport — Game Bible Generator

Use this skill when the user shares a completed Game Passport (block starting with GAME PASSPORT), or says "start a new game" / "process this passport" / "here is my game passport".

---

## Step 1 — Parse the Passport

Extract: name, icon, core fantasy, primary action, match rule, feedback response, skill expression, depth layer, win tags, lose tags, animation mood and file, tutorial count and notes, hint system enabled/detail, settings list, stats list.

Acknowledge in one sentence, then move to Step 2.

---

## Step 2 — Request Figma Game Screen

Say: "Got it! Share your Figma game screen design (the gameplay board). I will extract grid dimensions, piece values, timer setup, and score targets from it automatically."

Wait for the Figma URL or screenshot.

---

## Step 3 — Extract Game Variables from Figma

Document in SCREAMING_SNAKE_CASE with inline comments. Fill these groups:

```
BOARD: BOARD_COLS, BOARD_ROWS, PARK_SLOTS
CORE MECHANIC: face/piece min-max, spawn probabilities, weight biases
SCORING: SCORE_PER_ACTION, SCORE_MULTIPLIER_BASE, SCORE_MULTIPLIER_MAX, SCORE_MULTIPLIER_DECAY
TIMED CHALLENGE: TIMER_DURATION_SEC, bonus seconds per successful action
DAILY CHALLENGE: DAILY_SCORE_TARGET_BASE, _INCREMENT, _MAX, _STREAK_BONUS_MULTIPLIER
ANIMATION TIMING: ANIM_PLACE_MS, ANIM_VANISH_MS, ANIM_CHAIN_DELAY_MS, ANIM_SCORE_POP_MS
TUTORIAL: TUTORIAL_SESSION_COUNT=2, TUTORIAL_HINT_DELAY_MS=1500
```

---

## Step 4 — Generate Derived Content

**One-Line Pitch:** [Action verb] [core object] [win condition twist].

**Win/Lose Conditions:** Expand each selected tag with exact trigger, edge case, and retry CTA label.

**Engagement loops:**
- Core Loop (30 sec): receive → decide → action → match check → feedback → repeat
- Session Loop (2-4 min): start → build score → tension peaks → end → results → CTA
- Meta Loop: daily streak → daily challenge modifier → leaderboard → share → cosmetics

**Daily Challenge Concept:** one themed daily modifier per day that fits the mechanic.

**Difficulty Curve — 5 tiers:**
- Onboarding (1-3): easiest settings, bias toward easy pieces, core mechanic only
- Hook (4-10): +10% difficulty, 2nd mechanic introduced
- Engagement (11-25): +15%, neutral distribution, daily modifiers begin
- Challenge (26-50): +20%, bias toward harder pieces, variant board mode
- Mastery (51+): skill-adaptive, weekly reset challenge

---

## Step 5 — Create the Game Folder

Create: `Games/[game-name]/`

### 5a. `Games/[game-name]/[game-name]-game-bible.html`

7 sections (match structure from existing game bibles in the project):
1. Game Overview — kv-grid
2. Core Mechanic — prose paragraphs
3. Win / Lose Conditions — data-table
4. Game Feel and Juice — feel-grid, 8+ moment cards
5. Game Variables — pre/code block, SCREAMING_SNAKE_CASE, grouped
6. Difficulty Curve — color-coded data-table, 5 rows
7. Engagement Loops — loop-blocks (Core/Session/Meta) + retention hooks note

STRICTLY ENFORCED:
- Link `../../tokens.css` only — zero hardcoded hex values
- `data-theme="light"` on html element
- `.back-btn` links to `../../GamePage.html`

### 5b. `Games/[game-name]/[game-name].css`

```css
/* === [Game Name] — Game Stylesheet ===========================
   Per-game CSS overrides and gameplay-specific custom properties.
   Requires: ../../tokens.css, ../../components.css
   Run the /game-styleguide skill to populate this file.
   =========================================================== */
```

### 5c. `Games/[game-name]/[game-name]-styleguide.html` (stub)

Link `../../tokens.css`, `../../components.css`, `./[game-name].css`.
`.back-btn` links to `../../GamePage.html`.
Show placeholder: "Run the /game-styleguide skill to generate this page."

---

## Step 6 — Update GamePage.html

Insert a new game card in `.games-grid`, BEFORE any placeholder card.
Use: emoji icon, game name, one-line pitch, `status-badge--active` labeled "In progress".
Link `href` to `./Games/[game-name]/[game-name]-game-bible.html`.

---

## Handoff

```
Game Passport processed.
Folder created: Games/[game-name]/
  [game-name]-game-bible.html  — full game bible
  [game-name].css              — stub, ready for /game-styleguide
  [game-name]-styleguide.html  — stub, ready for /game-styleguide
GamePage.html updated — [game-name] card added.

Next step: /game-styleguide
```
