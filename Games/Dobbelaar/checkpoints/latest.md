---
label: latest
game: Dobbelaar
saved: 2026-04-14
---

## Goal
Add synthesized sound effects and background music to Dobbelaar — 24 SFX triggers + ambient generative music, all via Web Audio API, with settings toggles persisted to localStorage.

## Decisions
- Waveforms: sine and triangle only. No square or sawtooth anywhere.
- 24 SFX triggers designed and approved via sounds.html sliders.
- Win split by reason: `win-score`, `win-chain`, `win-survive` — `triggerWin(reason)` accepts string arg.
- Lose split by reason: `lose-board-full`, `lose-timer`, `lose-merges`, `'bomb'` (no extra sound for bomb; `bomb-detonate` already fired). `triggerLose(reason)` accepts string arg.
- `six-spawn` alert fires alongside `merge` when sum === 6 (die remains on board).
- `merge` sound scales with `chainDepth` — higher pitch and gain per cascade wave.
- Background music: ambient D-major-pentatonic chord pads (Dmaj → Bm → Asus2 → Em7), state-reactive.
- Music state calls: `setTension(true)` at timer ≤ 10s, `fadePause/fadeResume` on sheet open/close, `winFlourish()` at win.
- Two settings toggles: SFX on by default, Background Music off by default. Persisted as `db-sfx` and `db-music` in localStorage.
- GameUtils.openSheet/closeSheet/showToast monkey-patched in DOMContentLoaded for automatic sheet/toast sounds and music fades.
- AudioContext autoplay: SoundUtils adds pointerdown/keydown resume listeners on context creation; music tick loop waits for `state === 'running'` before scheduling notes (100 ms retry).

## Work completed
- `sound-utils.js` (project root) — SFX engine: shared AudioContext with autoplay-resume listeners, `synth`/`seq` primitives, `register(sounds)` / `play(id, extras)` / `setEnabled` / `getCtx` API.
- `music-utils.js` (project root) — Music engine: D-major pentatonic ambient pads + sparse melody, tick-based scheduler, `start` / `stop` / `setTension` / `fadePause` / `fadeResume` / `winFlourish`. Tick loop waits for context `running` state.
- `game-utils.js` — Added `onTick` option to `makeTimer` (backward compatible).
- `Dobbelaar.html` — Added script tags for `sound-utils.js` and `music-utils.js` before `dobbelaar.js`.
- `Dobbelaar.js` — All 24 SFX registered near sentinel constants; every trigger wired:
  - `doPlace` → `die-place`; `rotatePair` → `die-rotate`; park handlers → `die-park`
  - `triggerMergeCheck` → `merge` / `merge-clear` / `six-spawn`; reason args on `triggerLose`/`triggerWin`
  - `applyFlipEffects` → `flip-trigger`; `applyDiseasedEffects` → `disease-infect`
  - `tickBombs` → `bomb-tick` / `bomb-urgent`; `detonateBomb` → `bomb-detonate` + `triggerLose('bomb')`
  - `triggerWin(reason)` plays `win-{reason}` + `Music.winFlourish()`; `checkWin` passes `'survive'` for surviveTimer
  - `triggerLose(reason)` plays `lose-{reason}` (skipped for bomb) + `Music.stop()`
  - `rebuildTimer` → `onTick` for `timer-tick` / `timer-low` + `Music.setTension(true)` at ≤ 10 s
  - `showHint` → `hint-open`
  - `startLoading` → `Music.stop()` at top, `Music.start()` after `navigateTo('gameplay')`
  - DOMContentLoaded: preferences + toggles wired; monkey-patches for sheet/toast sounds + music fades; `btn-tap` on popup buttons; `Music.stop()` on exit-confirm

## Open threads
- Music is OFF by default — user must enable in Settings. Consider flipping default to ON after playtesting.
- `sounds.html` playground remains as standalone tuning tool; slider values are source of truth for params.
- No sound implementation for Nonogram yet.

## Constraints
- Sine/triangle waveforms only — no exceptions.
- Synth params must match sounds.html approved values.
- Mute preference read from localStorage before first sound fires.
- `SoundUtils.register([...])` block near sentinel constants in each game's JS file.
- Music module stays separate from SFX (never merged into sound-utils.js).
- No game logic inside sound-utils.js or music-utils.js.
- No hardcoded hex colors or px sizes — tokens only. game-utils.js must remain backward compatible.

## Next step
Play-test all 24 SFX triggers and music in-browser. Tune any params that feel off against sounds.html. After sign-off, consider making Background Music ON by default.
