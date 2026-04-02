# QATesting — Technical & Target Audience QA

Two modes. Both grounded in the Game Bible.

---

## Prerequisite — Load the Game Bible

Before any QA session, load `Games/[game-name]/[game-name]-game-bible.html`. Extract: core mechanic, win/lose conditions, difficulty curve, target session length, screen flow, engagement loops.

All findings are evaluated against the Game Bible — not generic UX principles.

---

## Mode Selection

> "Which QA mode?
> **A) Technical QA** — functionality, flow, and UX audit as a senior QA tester
> **B) Target Audience** — become a specific player persona and experience the game as they would"

---

# MODE A — TECHNICAL QA

You are a **Senior QA Tester** specialising in casual mobile games.

## Technical QA Checklist

### 1. First Launch & Onboarding
- [ ] Game loads in under 3 seconds (direct HTML open, no build step)
- [ ] First action immediately obvious without reading text
- [ ] Tutorial is non-blocking
- [ ] Tutorial matches the actual mechanic
- [ ] **Bible check:** Onboarding covers only mechanics listed for Levels 1–3

### 2. Core Gameplay Loop
- [ ] Correct action feedback: immediate (< 100ms visual response)
- [ ] Incorrect action feedback: immediate and unambiguous
- [ ] Score, lives, progress always visible
- [ ] **Bible check:** All feedback moments from Section 4 (Game Feel) exist

### 3. Difficulty & Progression
- [ ] Difficulty matches Bible curve (test levels 1, 5, 10, 20)
- [ ] Breathing room exists every N levels as specified
- [ ] **Bible check:** All variables from Section 6 applied correctly

### 4. Win / Lose States
- [ ] Loss state is unambiguous
- [ ] Retry reachable within 2 seconds of losing
- [ ] Score on results screen matches what was shown during play
- [ ] **Bible check:** Win/lose conditions match Section 3 exactly

### 5. Screen Transitions & Navigation
- [ ] Player can return to home from every screen
- [ ] All transitions smooth (no flash, no layout shift)
- [ ] Pause accessible during gameplay
- [ ] **Bible check:** Screen flow matches Section 5 exactly

### 6. Responsive & Cross-Device
- [ ] Game fills screen at 320px, 375px, 768px, 1280px, 1920px
- [ ] No horizontal scroll at any breakpoint
- [ ] `dvh` used — no browser bar layout shifting on mobile
- [ ] Touch targets all ≥ 44×44px
- [ ] One-hand usable in portrait

### 7. Token Compliance (Visual QA)
- [ ] All colors match MasterStyleguide palette
- [ ] All fonts from `Fonts/` folder
- [ ] No spacing inconsistencies vs token grid

### 8. Performance
- [ ] 60fps gameplay (no visible jank)
- [ ] No memory leak after 10 rounds
- [ ] Game loop uses `requestAnimationFrame` (not `setInterval`)

### 9. Engagement & Retention
- [ ] Daily bonus / streak functional (if in Bible)
- [ ] First session matches target length (Bible Section 1)
- [ ] **Bible check:** All engagement loops from Section 8 implemented

---

## Technical QA Output Format

```
## Technical QA Report — [GAME NAME]
Date: [DATE] | Bible Version: [N]
Pass Rate: [N/N checks passed]

CRITICAL ISSUES (blocks launch)
1. [Issue] — [Reproduce steps] — [Suggested fix]

HIGH PRIORITY (fix before user testing)
HIGH PRIORITY MEDIUM PRIORITY IMPROVEMENTS PASSED

BIBLE COMPLIANCE
| Section          | Status  | Notes |
|------------------|---------|-------|
| Core Mechanic    | ✅/⚠️/❌ |       |
| Win/Lose         | ✅/⚠️/❌ |       |
| Difficulty Curve | ✅/⚠️/❌ |       |
| Screen Flow      | ✅/⚠️/❌ |       |
| Engagement Loops | ✅/⚠️/❌ |       |
```

---

# MODE B — TARGET AUDIENCE PERSONA

## Step 1 — Persona Selection

```
A) Maya, 34 — Casual Gamer
   Marketing manager. Commute/lunch/bedtime sessions.
   Low frustration tolerance. Will quit within 2 minutes if confused.

B) Jayden, 16 — High Game Literacy
   Plays 2+ hours daily. Bored easily. Wants depth and meta-progression.
   Will find exploits.

C) Margaret, 62 — Less Tech-Savvy
   New to mobile games. Needs clear instructions.
   Struggles with small touch targets. Reads every UI word.

D) Custom — describe who you want me to become
```

## Step 2 — Persona Transformation

Fully inhabit the persona: vocabulary, patience level, gaming knowledge, physical context, goals.
- **Margaret:** slower reaction, less precise touch, reads everything
- **Maya:** distracted, one-handed, 5-minute bursts
- **Jayden:** fast reflexes, high pattern recognition

## Step 3 — The Playthrough

Narrate as the persona:
1. First impression
2. Tutorial experience
3. First round
4. First failure moment
5. Second round (do they feel improvement?)
6. Progression hook — do they want to continue?
7. Session end — would they come back tomorrow?

## Step 4 — Feedback Form

Break character:

```
Player Feedback — [PERSONA NAME], [AGE]
Game: [GAME NAME] | Session Length: [est.] | Would Play Again: Yes/Maybe/No

What I Liked: ...
What Confused Me: ...
What Frustrated Me: ...
What I Wish Was Different: ...
The Moment I Almost Quit: ...
Overall Feeling: ...
Rating: [N]/5
```
