/* ============================================================
   SoundUtils — Synthesized SFX engine
   No external audio files. Sine / triangle waveforms only.

   Usage:
     SoundUtils.register([{ id, params, extras, fn(p, e, synth, seq) }])
     SoundUtils.play('id')
     SoundUtils.play('id', { depth: 3 })   // pass extra params
     SoundUtils.setEnabled(bool)
     SoundUtils.isEnabled()
     SoundUtils.getCtx()   // shared with music-utils.js
   ============================================================ */

const SoundUtils = (() => {
  let _ctx     = null;
  let _enabled = true;

  function getCtx() {
    if (!_ctx) {
      _ctx = new AudioContext();
      // Resume on the next user gesture in case the context started suspended
      // (browser autoplay policy). This listener covers the case where music
      // starts before any SFX has fired.
      const resume = () => { if (_ctx.state === 'suspended') _ctx.resume(); };
      document.addEventListener('pointerdown', resume);
      document.addEventListener('keydown',     resume);
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  function synth({ freq, duration, type = 'sine', gain = 0.2, attack = 0.005, sweep = null, delay = 0 }) {
    const c = getCtx();
    const osc = c.createOscillator();
    const vol = c.createGain();
    osc.connect(vol);
    vol.connect(c.destination);
    osc.type = type;
    const t = c.currentTime + delay;
    osc.frequency.setValueAtTime(freq, t);
    if (sweep != null) osc.frequency.linearRampToValueAtTime(sweep, t + duration);
    vol.gain.setValueAtTime(0.001, t);
    vol.gain.linearRampToValueAtTime(gain, t + Math.max(attack, 0.005));
    vol.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function seq(steps) { steps.forEach(s => synth(s)); }

  const _registry = {};

  return {
    // Exposed so music-utils.js can share the same AudioContext
    getCtx,

    // Games call this once with their sound definitions.
    // Each entry: { id, params, extras, fn(p, e, synth, seq) }
    register(sounds) {
      sounds.forEach(s => { _registry[s.id] = s; });
    },

    // Fire a sound by id. Pass extras to override default extras.
    // If the AudioContext is still suspended (browser autoplay policy),
    // waits for resume() to resolve before scheduling — eliminates first-tap delay.
    play(id, extras = {}) {
      if (!_enabled) return;
      const s = _registry[id];
      if (!s) return;
      const ctx  = getCtx();
      const fire = () => s.fn(s.params, { ...s.extras, ...extras }, synth, seq);
      if (ctx.state === 'running') { fire(); } else { ctx.resume().then(fire); }
    },

    setEnabled(on) { _enabled = !!on; },
    isEnabled()    { return _enabled; },
  };
})();
