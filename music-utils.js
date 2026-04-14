/* ============================================================
   Music — Ambient generative background music engine
   D major pentatonic chord pads. State-reactive:
     setTension(true)  → BPM ×1.35 + micro-detune on pads
     fadePause()       → fade to silence over 0.4 s
     fadeResume()      → fade back to volume over 0.5 s
     winFlourish()     → ascending arpeggio, then stop
   Shares the AudioContext with SoundUtils (loaded first).
   ============================================================ */

const Music = (() => {
  // D major pentatonic — exact Hz
  const P = {
    D3: 146.83, E3: 164.81, Fs3: 185.00, A3: 220.00, B3: 246.94,
    D4: 293.66, E4: 329.63, Fs4: 369.99, A4: 440.00, B4: 493.88,
    D5: 587.33, E5: 659.26, Fs5: 739.99, A5: 880.00,
  };

  // Four chord shapes — all notes in pentatonic, no clashes
  const CHORDS = [
    { name: 'Dmaj',  notes: [P.D3, P.A3, P.D4, P.Fs4] },
    { name: 'Bm',    notes: [P.B3, P.Fs4, P.B4, P.D5]  },
    { name: 'Asus2', notes: [P.A3, P.E4, P.A4, P.B4]   },
    { name: 'Em7',   notes: [P.E3, P.B3, P.E4, P.A4]   },
  ];

  // Sparse melody note sequence drawn from pentatonic high register
  const MELODY = [P.D5, P.Fs5, P.A5, P.E5, P.B4, P.A5, P.Fs5, P.D5, P.E5, P.A5, P.B4, P.Fs5];

  // Gain weight per pad voice (root is loudest)
  const PAD_GAINS = [0.52, 0.38, 0.28, 0.18];

  let running  = false;
  let tension  = false;
  let melodyOn = true;
  let _enabled = false;
  let bpmBase    = 72;
  let bpmCurrent = 72;
  let volume     = 0.18;
  let chordIdx = 0, beatCount = 0, melodyIdx = 0;
  let timerId = null, masterGain = null;

  function getCtx() {
    // Share AudioContext with SoundUtils when available, otherwise own one
    return (typeof SoundUtils !== 'undefined') ? SoundUtils.getCtx() : new AudioContext();
  }

  function getMaster() {
    const c = getCtx();
    if (!masterGain || masterGain.context.state === 'closed') {
      masterGain = c.createGain();
      masterGain.gain.setValueAtTime(volume, c.currentTime);
      masterGain.connect(c.destination);
    }
    return masterGain;
  }

  function pad(freq, duration, g, attack = 0.7, delay = 0) {
    const c   = getCtx();
    const osc = c.createOscillator();
    const vol = c.createGain();
    osc.connect(vol);
    vol.connect(getMaster());
    osc.type = 'sine';
    const t = c.currentTime + delay;
    const f = tension ? freq * 1.008 : freq;  // micro-detune under tension
    osc.frequency.setValueAtTime(f, t);
    vol.gain.setValueAtTime(0.001, t);
    vol.gain.linearRampToValueAtTime(g, t + attack);
    vol.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.1);
  }

  function playChord() {
    const chord  = CHORDS[chordIdx % CHORDS.length];
    const beatSec = 60 / bpmCurrent;
    const dur    = beatSec * 8;                        // hold 8 beats
    const atk    = Math.min(0.8, dur * 0.18);
    chord.notes.forEach((f, i) => pad(f, dur, PAD_GAINS[i] ?? 0.14, atk));
    chordIdx++;
  }

  function playMelodyNote() {
    if (!melodyOn || Math.random() > 0.50) return;
    const note = MELODY[melodyIdx % MELODY.length];
    melodyIdx++;
    const c   = getCtx();
    const osc = c.createOscillator();
    const vol = c.createGain();
    osc.connect(vol);
    vol.connect(getMaster());
    osc.type = 'triangle';
    const t = c.currentTime;
    const f = tension ? note * 1.008 : note;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.linearRampToValueAtTime(f * 1.015, t + 0.18);
    vol.gain.setValueAtTime(0.001, t);
    vol.gain.linearRampToValueAtTime(0.20, t + 0.012);
    vol.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  function tick() {
    if (!running) return;
    // If the AudioContext is still suspended (browser autoplay policy),
    // spin-wait every 100 ms rather than scheduling notes at t≈0.
    const c = getCtx();
    if (c.state !== 'running') {
      timerId = setTimeout(tick, 100);
      return;
    }
    if (beatCount % 8 === 0) playChord();
    if (beatCount % 2 === 0) playMelodyNote();
    beatCount++;
    timerId = setTimeout(tick, (60 / bpmCurrent) * 1000);
  }

  return {
    start() {
      if (!_enabled || running) return;
      running    = true;
      tension    = false;          // always reset tension at start
      beatCount  = 0;
      chordIdx   = 0;
      melodyIdx  = 0;
      bpmCurrent = bpmBase;
      tick();
    },

    stop() {
      running = false;
      clearTimeout(timerId);
      if (masterGain) {
        const c = getCtx();
        masterGain.gain.setValueAtTime(masterGain.gain.value, c.currentTime);
        masterGain.gain.linearRampToValueAtTime(0.001, c.currentTime + 1.4);
        setTimeout(() => { masterGain = null; }, 1500);
      }
    },

    isRunning() { return running; },

    setEnabled(on) {
      _enabled = !!on;
      if (!_enabled && running) this.stop();
    },
    isEnabled() { return _enabled; },

    // State reactions ─────────────────────────────────────────
    setTension(on) {
      tension    = on;
      bpmCurrent = on ? bpmBase * 1.35 : bpmBase;
    },

    fadePause() {
      if (!masterGain) return;
      const c = getCtx();
      masterGain.gain.setValueAtTime(masterGain.gain.value, c.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.001, c.currentTime + 0.4);
    },

    fadeResume() {
      if (!masterGain) return;
      const c = getCtx();
      masterGain.gain.setValueAtTime(masterGain.gain.value, c.currentTime);
      masterGain.gain.linearRampToValueAtTime(volume, c.currentTime + 0.5);
    },

    winFlourish() {
      // Ascending arpeggio then stop
      [P.D5, P.Fs5, P.A5, P.D5 * 2].forEach((f, i) => {
        setTimeout(() => pad(f, 0.7, 0.22, 0.04), i * 110);
      });
      setTimeout(() => this.stop(), 700);
    },
  };
})();
