# FlowPrototype — Navigation & Interaction Gold Standard

You are a **Senior Interaction Designer and Front-End Engineer**. Produce a single self-contained HTML file that demonstrates the complete navigation flow — every screen, every button, every modal, every transition. This file is the definitive reference for how UI interactions work. All games replicate this navigation pattern exactly.

Makes NO new design decisions. Uses exclusively what exists in `MasterStyleguide.html`, `tokens.css`, `components.css`, and `icons.js`.

---

## Step 0 — Prerequisites Check

- [ ] `./tokens.css` exists
- [ ] `./components.css` exists
- [ ] `./icons.js` exists
- [ ] `./game-utils.js` exists
- [ ] `MasterStyleguide.html` contains at minimum: Home Page, Loading Screen, Gameplay Screen, Tutorial, Settings sheet

If any screen is missing: stop and redirect to `/master-styleguide` Phase 2.

---

## Step 1 — The Navigation Flow

```
Home Page
  └── [Play] ──► Loading Screen (2s) ──► Gameplay Screen
                                              ├── [first-time] First-Time Popup → Tutorial (5 steps) → Gameplay
                                              ├── [Pause/timer] — toggle play/pause
                                              ├── [Info] ──► Instructions Sheet
                                              ├── [Calendar] ──► Calendar Sheet
                                              ├── [Stats] ──► Statistics Sheet
                                              ├── [Settings] ──► Settings Sheet
                                              ├── [Feedback] ──► Feedback Sheet
                                              └── [Back] ──► Exit Confirmation
                                                                ├── [Stay] — dismiss, resume timer
                                                                └── [Exit] — Home Page
```

---

## Step 2 — File Output

Generate `flow-prototype.html` in the project root.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Flow Prototype — PuzzleFit</title>
  <link rel="stylesheet" href="./tokens.css" />
  <link rel="stylesheet" href="./components.css" />
  <style>/* prototype shell + screen transitions — all via var(--token) */</style>
</head>
<body>
  <script src="./icons.js"></script>
  <script src="./game-utils.js"></script>
  <script>/* screen manager + interaction logic */</script>
</body>
</html>
```

---

## Step 3 — Screen Implementations

### 3.1 Screen Manager
Use `GameUtils.navigateTo(screenId)` from `game-utils.js`. This handles the two-step `is-visible` → `is-active` transition with `inert` management. Do NOT reimplement it.

Every `proto-screen` except the initial home screen must have the `inert` attribute in HTML.

### 3.2 Home Page
Play button → `startLoading()`. Toolbar icons → open their sheets.

### 3.3 Loading Screen
Animated content. Minimum 2000ms: `setTimeout(() => GameUtils.navigateTo('gameplay'), 2000)`.

### 3.4 Gameplay Screen
On first visit (firstTimeUser flag): show First-Time Popup. Timer counts up by default.

### 3.5 First-Time Popup
`sessionStorage.getItem('tutorialSeen')` guard. "Let's go!" → dismiss → Tutorial step 1.

### 3.6 Tutorial — 5 Steps
Full-screen overlay, one step at a time. "Finish" on step 5 → `sessionStorage.setItem('tutorialSeen', 'true')` → dismiss.

### 3.7 Sheets (slide up from bottom)

```js
// game-utils.js provides:
GameUtils.openSheet(id);
GameUtils.closeSheet(id);
GameUtils.initSheetDismiss(onDismiss); // handles scrim-click; skips data-no-dismiss sheets
```

Win/Lose sheets must have `data-no-dismiss` attribute — they cannot be scrim-dismissed.

**Instructions** · **Calendar** · **Statistics** · **Settings** (theme + sound + dominant hand) · **Feedback** (star rating + tickbox + text input)

### 3.8 Exit Confirmation Popup
"Stay" → dismiss + `timer.resume()`. "Exit" → `GameUtils.navigateTo('home')`, reset session state.

---

## Step 4 — Timer

Use `GameUtils.makeTimer(groupEl, iconEl, displayEl)` from `game-utils.js`. Do NOT reimplement the timer.

When Exit Confirmation opens → `timer.pause()`. "Stay" → `timer.resume()`.

---

## Enforced Rules

### Rule 1 — Home game icon is always full-size
```html
<img src="..." alt="..." style="width:100%;height:100%;object-fit:contain;" />
```
Never set fixed px width/height on this image.

### Rule 2 — No debug win/lose shortcuts in settings
The settings sheet must NEVER contain debug shortcuts for opening win/lose screens.

### Rule 3 — Never rename `.game-main`
Scope game-specific overrides via parent class:
```css
/* ✅ */ .game-screen .game-main { padding: var(--space-4); }
/* ❌ */ .db-game-main { padding: var(--space-4); }
```

### Rule 4 — Hint tooltip z-index
```css
.game-toolbar { position: relative; z-index: var(--z-ui); }
```
Always add this — without it `.game-main` (painted after toolbar in DOM) overlaps tooltips.

---

## Handoff

> "✅ Flow Prototype complete: `flow-prototype.html`
>
> Wired: Home → Loading (2s) → Gameplay → First-time popup → Tutorial (5 steps)
> Sheets: Instructions, Calendar, Stats, Settings, Feedback
> Popups: Exit confirmation | Timer: pause/play toggle
>
> Next step: **GameBuild**."
