---
label: latest
saved: 2026-04-14
---

## Goal
Add a complete synthesized audio layer to PuzzleFit — sound effects and background music for Dobbelaar, using Web Audio API only (no external files), integrated with a settings toggle and persisted user preference.

## Decisions
- **Waveforms:** sine and triangle only — no square or sawtooth. Modern/sleek, not retro.
- **24 SFX triggers** across gameplay, modifiers, win, lose, timer, and UI.
- **Win split by cause:** `win-score`, `win-chain`, `win-survive` — `triggerWin()` needs a reason string.
- **Lose split by cause:** `lose-board-full`, `lose-timer`, `lose-merges` — `triggerLose()` needs a reason string. `bomb-detonate` stays separate.
- **`six-spawn`** added: alert sound fires when a merge results in a 6-die (sum === 6).
- **Background music:** ambient D-major-pentatonic chord pads, state-reactive: timer-low → BPM ×1.35 + micro-detune, win → ascending arpeggio flourish then fade, pause/resume → 0.4s/0.5s crossfade.
- **Two modules:** `sound-utils.js` (SFX engine, `SoundUtils.play(id)`) and `music-utils.js` (music engine, `Music.start/stop/setTension/fadePause/fadeResume/winFlourish`).
- **SFX and music** use separate master gain nodes — volume controls are independent.
- Settings sheet gets two toggles: Sound Effects and Background Music, both persisted to localStorage.

## Work completed
- `sounds.html` — standalone interactive audio playground: 24 SFX cards each with ▶ play button and freq/dur/gain sliders (live preview on drag), cascade depth slider on `merge`, music section with start/stop, volume/BPM sliders, melody layer toggle, and 5 state-test buttons. All sine/triangle. No external deps.
- `GamePage.html` — added Section 3 "Sound Design" with description of the three files, a collapsed `<details>` trigger map table for Dobbelaar (all 24 SFX + 5 music calls), updated Dobbelaar pipeline row to show `Sound` as next step, added sidebar nav link.

## Open threads
- **Phase 4 (implementation) not yet started** — awaiting user to say "implement".
- `triggerWin()` and `triggerLose()` need reason argument added during wiring.
- `makeTimer`'s `tick()` needs SFX + music hooks for timer-tick, timer-low, and Music.setTension.
- Settings sheet in Dobbelaar.html needs two new toggle rows wired in JS.

## Constraints
- No square or sawtooth waveforms anywhere.
- All synth params must match the approved values from sounds.html (sliders are source of truth).
- Mute state must be read from localStorage on game init — no sounds fire before preference is applied.
- SFX engine is pure audio — no game logic inside sound-utils.js.
- Each game registers its own sounds via `SoundUtils.register({})` near the top of its JS file.
- Music is a separate module (music-utils.js), not bundled into sound-utils.js.
- No hardcoded hex colors or px sizes elsewhere in the project — tokens only.
- `game-utils.js` changes must remain backward compatible.

## Next step
User says "implement" → Phase 4: create `sound-utils.js` and `music-utils.js` at project root, add both script tags to `Dobbelaar.html`, wire all 24 SoundUtils.play() calls + music state calls into `Dobbelaar.js`, add sound/music toggles to the settings sheet.
