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
/* ============================================================
   GAME UTILS — PuzzleFit shared utility library
   Load after icons.js, before any game-specific JS.
   All utilities live on the GameUtils namespace to avoid
   collisions with game-level code.
   ============================================================ */

const GameUtils = {

  // ── CONSTANTS ───────────────────────────────────────────────
  MONTH_NAMES: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  CHECK_SVG:   `<svg class="cal-day__check" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,10 8,15 16,6"/></svg>`,
  CORNER_SVG:  `<svg class="cal-corner" viewBox="0 0 16 16" fill="currentColor"><path d="M0 16L0 0L16 16H0Z"/></svg>`,

  // ── NAVIGATION ──────────────────────────────────────────────
  navigateTo(screenId) {
    const FADE_MS = 400; // matches --duration-slow
    document.querySelectorAll('.proto-screen').forEach(el => {
      if (el.dataset.screen === screenId) {
        el.removeAttribute('inert');
        el.classList.add('is-visible');
        // One frame delay so display:flex is painted before opacity transitions
        requestAnimationFrame(() => requestAnimationFrame(() =>
          el.classList.add('is-active')
        ));
      } else {
        el.setAttribute('inert', '');
        el.classList.remove('is-active');
        setTimeout(() => el.classList.remove('is-visible'), FADE_MS);
      }
    });
  },

  // ── POPUPS ──────────────────────────────────────────────────
  openPopup(id)  { document.getElementById(id)?.classList.add('is-open'); },
  closePopup(id) { document.getElementById(id)?.classList.remove('is-open'); },

  // ── SHEETS ──────────────────────────────────────────────────
  openSheet(id)  {
    document.querySelectorAll('.sheet-overlay.is-open').forEach(el => el.classList.remove('is-open'));
    document.getElementById(id)?.classList.add('is-open');
  },
  closeSheet(id) { document.getElementById(id)?.classList.remove('is-open'); },

  // ── TOAST ───────────────────────────────────────────────────
  _toastTimer: null,
  showToast(toastId, msg, duration = 2200) {
    const el = document.getElementById(toastId);
    if (!el) return;
    el.textContent = msg;
    el.classList.add('toast--visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('toast--visible'), duration);
  },

  // ── SHEET SWITCH ────────────────────────────────────────────
  // Close one sheet then run an action after a short delay (default 100ms
  // lets the close animation start before the next thing opens).
  switchSheet(fromId, action, delay = 100) {
    this.closeSheet(fromId);
    setTimeout(action, delay);
  },

  // ── TIMER ───────────────────────────────────────────────────
  // options.countdown = seconds to count down from (omit for count-up)
  // options.onExpire  = callback fired when countdown hits 0
  makeTimer(groupEl, iconEl, displayEl, options = {}) {
    const countdownFrom = options.countdown ?? null;
    const onExpire      = options.onExpire   ?? null;
    const onTick        = options.onTick     ?? null;
    let seconds = countdownFrom ?? 0, running = false, interval = null;
    const minEl = displayEl.querySelector('.game-timer__min');
    const secEl = displayEl.querySelector('.game-timer__sec');
    function pad(n) { return String(n).padStart(2, '0'); }
    function fmt(s) { return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
    function render(s) {
      if (minEl && secEl) { minEl.textContent = pad(Math.floor(s / 60)); secEl.textContent = pad(s % 60); }
      else                { displayEl.textContent = fmt(s); }
    }
    function tick() {
      if (countdownFrom !== null) {
        seconds--;
        render(Math.max(0, seconds));
        onTick?.(Math.max(0, seconds));
        if (seconds <= 0) { pause(); onExpire?.(); }
      } else {
        seconds++;
        render(seconds);
        onTick?.(seconds);
      }
    }
    function start()     { if (running) return; running = true;  interval = setInterval(tick, 1000); Icons.render(iconEl, 'pause', { size: 'md' }); groupEl.setAttribute('aria-label', 'Pause'); }
    function pause()     { if (!running) return; running = false; clearInterval(interval);            Icons.render(iconEl, 'play',  { size: 'md' }); groupEl.setAttribute('aria-label', 'Play'); }
    function reset()     { pause(); seconds = countdownFrom ?? 0; render(seconds); }
    function isRunning()  { return running; }
    function getElapsed() { return countdownFrom !== null ? countdownFrom - seconds : seconds; }
    return { start, pause, reset, isRunning, getElapsed };
  },

  // ── SHEET SCROLLBAR ─────────────────────────────────────────
  initSheetScrollbar(wrapId, thumbId) {
    const wrap  = document.getElementById(wrapId);
    const thumb = document.getElementById(thumbId);
    if (!wrap || !thumb) return;
    const bar = thumb.parentElement;

    function positionBar() {
      bar.style.top    = wrap.offsetTop + 'px';
      bar.style.height = wrap.offsetHeight + 'px';
    }
    function update() {
      positionBar();
      if (wrap.scrollHeight <= wrap.clientHeight) { thumb.style.opacity = '0'; return; }
      const ratio = wrap.scrollTop / (wrap.scrollHeight - wrap.clientHeight);
      const h     = Math.max(32, (wrap.clientHeight / wrap.scrollHeight) * wrap.clientHeight);
      thumb.style.height    = h + 'px';
      thumb.style.transform = `translateY(${ratio * (wrap.clientHeight - h)}px)`;
      thumb.classList.add('sheet__scrollbar-thumb--visible');
    }

    thumb.addEventListener('pointerdown', e => {
      e.preventDefault();
      const startY = e.clientY, startTop = wrap.scrollTop;
      const h = thumb.offsetHeight, max = wrap.scrollHeight - wrap.clientHeight;
      const onMove = ev => { wrap.scrollTop = startTop + ((ev.clientY - startY) / (wrap.clientHeight - h)) * max; };
      const onUp   = ()  => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup',   onUp);
    });

    wrap.addEventListener('scroll', update);
    const overlay = wrap.closest('.sheet-overlay');
    if (overlay) {
      new MutationObserver(() => { if (overlay.classList.contains('is-open')) setTimeout(update, 50); })
        .observe(overlay, { attributes: true, attributeFilter: ['class'] });
    }
  },

  // ── THEME ───────────────────────────────────────────────────
  // segmentId: the ID of the .stt-segment element for the theme selector
  // storageKey: the localStorage key, e.g. 'db-theme'
  setTheme(theme, segmentId, storageKey) {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll(`#${segmentId} .stt-segment__option`).forEach(btn =>
      btn.classList.toggle('stt-segment__option--active', btn.dataset.value === theme)
    );
    localStorage.setItem(storageKey, theme);
  },

  // ── STAT STREAK GRID ────────────────────────────────────────
  buildStreakGrid(gridId, completedDates) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const completed = completedDates instanceof Set ? completedDates : new Set();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);

    function toISO(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    grid.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const d      = new Date(monday);
      d.setDate(monday.getDate() + i);
      const cell   = document.createElement('div');
      const iso    = toISO(d);
      const isToday   = d.getTime() === today.getTime();
      const isFuture  = d > today;
      const isDone    = completed.has(iso);
      cell.className  = 'cal-day';
      if (isFuture) {
        cell.classList.add('cal-day--unavailable');
        cell.innerHTML = String(d.getDate());
      } else if (isDone) {
        cell.classList.add('cal-day--completed');
        cell.innerHTML = this.CHECK_SVG;
      } else if (isToday) {
        cell.classList.add('cal-day--in-progress');
        cell.innerHTML = String(d.getDate()) + this.CORNER_SVG;
      } else {
        // Past day not completed — show number, no special class
        cell.innerHTML = String(d.getDate());
      }
      grid.appendChild(cell);
    }

    // Compute actual streak: consecutive completed days ending at today (or yesterday if today not yet done)
    let streak = 0;
    const todayISO   = toISO(today);
    const cursor     = new Date(completed.has(todayISO) ? today : new Date(today.getTime() - 86400000));
    const walk       = new Date(cursor);
    while (completed.has(toISO(walk))) {
      streak++;
      walk.setDate(walk.getDate() - 1);
    }

    const title = grid.closest('.stat-streak')?.querySelector('.stat-streak__title');
    if (title) title.textContent = `${streak} Daily streak`;
  },

  // ── CALENDAR ────────────────────────────────────────────────
  // Call from inside DOMContentLoaded. Derives all element IDs from prefix.
  // e.g. prefix 'db' → 'db-cal-title', 'db-cal-grid', etc.
  // options.completedDates — Set of ISO "YYYY-MM-DD" strings for completed days
  // options.onDaySelect    — callback(isoString) fired when a day cell is clicked or nav lands on a day
  initCalendar(prefix, options = {}) {
    const self         = this;
    const TODAY        = new Date();
    const completedSet = options.completedDates instanceof Set ? options.completedDates : new Set();
    let inProgressDate = options.inProgressDate ?? null;

    let viewYear = TODAY.getFullYear(), viewMonth = TODAY.getMonth();
    let selYear  = viewYear, selMonth = viewMonth, selDay = TODAY.getDate();

    function toISO(y, m, d) {
      return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    function ordinal(n) {
      const s = ['th','st','nd','rd'], v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }
    function dayState(y, m, d) {
      const day = new Date(y, m, d);
      const tod = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
      if (day > tod) return 'unavailable';
      if (completedSet.has(toISO(y, m, d))) return 'completed';
      if (inProgressDate && toISO(y, m, d) === inProgressDate) return 'in-progress';
      return 'default';
    }
    function renderCal(dir) {
      const title  = document.getElementById(`${prefix}-cal-title`);
      const grid   = document.getElementById(`${prefix}-cal-grid`);
      if (grid) grid.classList.remove('cal-grid--flip-next', 'cal-grid--flip-prev');
      const todayL = document.getElementById(`${prefix}-cal-today-label`);
      const btn    = document.getElementById(`${prefix}-cal-btn`);
      if (!title || !grid) return;

      title.textContent = `${self.MONTH_NAMES[viewMonth]} ${viewYear}`;
      if (todayL) todayL.textContent = `${ordinal(TODAY.getDate())} ${self.MONTH_NAMES[TODAY.getMonth()]}`;
      const hasSel = (selYear === viewYear && selMonth === viewMonth);
      if (btn) {
        btn.textContent = hasSel ? `Play ${ordinal(selDay)} ${self.MONTH_NAMES[selMonth]}` : 'No games available';
        btn.disabled = !hasSel;
      }

      grid.innerHTML = '';
      const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
      const emptyCount  = firstDow === 0 ? 6 : firstDow - 1;
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      let   dayIndex    = 0;

      for (let i = 0; i < emptyCount; i++) {
        const el = document.createElement('div');
        el.className = 'cal-day cal-day--empty';
        el.style.setProperty('--day-index', dayIndex++);
        grid.appendChild(el);
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const el    = document.createElement('div');
        const state = dayState(viewYear, viewMonth, d);
        const isSel = (d === selDay && viewMonth === selMonth && viewYear === selYear);
        const cls   = ['cal-day'];
        if (state === 'completed')   cls.push('cal-day--completed');
        if (state === 'in-progress') cls.push('cal-day--in-progress');
        if (state === 'unavailable') cls.push('cal-day--unavailable');
        if (isSel)                   cls.push('cal-day--selected');
        const isToday = (viewYear === TODAY.getFullYear() && viewMonth === TODAY.getMonth() && d === TODAY.getDate());
        if (isToday)                 cls.push('cal-day--today');
        el.className = cls.join(' ');
        el.style.setProperty('--day-index', dayIndex++);
        if (state === 'completed')        el.innerHTML = self.CHECK_SVG;
        else if (state === 'in-progress') el.innerHTML = String(d) + self.CORNER_SVG;
        else                              el.innerHTML = String(d);
        el.setAttribute('aria-label', `${d} ${self.MONTH_NAMES[viewMonth]}`);
        if (state !== 'unavailable') {
          el.addEventListener('click', () => {
            selYear = viewYear; selMonth = viewMonth; selDay = d;
            renderCal();
            if (typeof options.onDaySelect === 'function') options.onDaySelect(toISO(selYear, selMonth, selDay));
          });
        }
        grid.appendChild(el);
      }
      const total = emptyCount + daysInMonth;
      for (let i = total; i < 42; i++) {
        const el = document.createElement('div');
        el.className = 'cal-day cal-day--empty';
        el.style.setProperty('--day-index', dayIndex++);
        grid.appendChild(el);
      }

      // Slide + wave animation on month navigation
      if (dir) {
        const cls = dir === 'next' ? 'cal-grid--flip-next' : 'cal-grid--flip-prev';
        grid.classList.remove('cal-grid--flip-next', 'cal-grid--flip-prev');
        void grid.offsetWidth; // force reflow to restart animation
        grid.classList.add(cls);
      }
    }
    function navCal(y, m, dir) {
      viewYear = y; viewMonth = m;
      const isCurrent = (y === TODAY.getFullYear() && m === TODAY.getMonth());
      if (isCurrent) {
        selYear = y; selMonth = m; selDay = TODAY.getDate();
      } else {
        const isPast = (y < TODAY.getFullYear()) || (y === TODAY.getFullYear() && m < TODAY.getMonth());
        if (isPast) { selYear = y; selMonth = m; selDay = 1; }
        else        { selYear = -1; selMonth = -1; selDay = -1; }
      }
      renderCal(dir);
      if (selYear !== -1 && typeof options.onDaySelect === 'function') options.onDaySelect(toISO(selYear, selMonth, selDay));
    }

    const prev = document.getElementById(`${prefix}-cal-prev`);
    const next = document.getElementById(`${prefix}-cal-next`);
    if (prev) prev.addEventListener('click', () => { let y = viewYear, m = viewMonth - 1; if (m < 0) { m = 11; y--; } navCal(y, m, 'prev'); });
    if (next) next.addEventListener('click', () => { let y = viewYear, m = viewMonth + 1; if (m > 11) { m = 0; y++; } navCal(y, m, 'next'); });
    Icons.render(document.getElementById(`${prefix}-cal-prev`), 'chevronLeft', { size: 'md', color: 'primary' });
    const calNextEl = document.getElementById(`${prefix}-cal-next`);
    Icons.render(calNextEl, 'chevronLeft', { size: 'md', color: 'primary' });
    if (calNextEl.firstElementChild) calNextEl.firstElementChild.style.transform = 'scaleX(-1)';
    Icons.render(document.getElementById(`${prefix}-cal-trophy`), 'trophyBronze', { size: 'md' });
    renderCal();
    if (typeof options.onDaySelect === 'function') options.onDaySelect(toISO(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate()));
    return {
      resetToToday() { navCal(TODAY.getFullYear(), TODAY.getMonth()); },
      setInProgressDate(iso) { inProgressDate = iso ?? null; renderCal(); },
      selectDate(iso) {
        const [y, mo, d] = iso.split('-').map(Number);
        const m = mo - 1;
        viewYear = y; viewMonth = m;
        selYear  = y; selMonth  = m; selDay = d;
        renderCal();
        if (typeof options.onDaySelect === 'function') options.onDaySelect(iso);
      },
      // Re-render calendar with an updated completed-dates set (call after markDateCompleted)
      refresh(newSet) {
        if (newSet instanceof Set) { completedSet.clear(); newSet.forEach(d => completedSet.add(d)); }
        renderCal();
      },
    };
  },

  // ── FEEDBACK FORM ───────────────────────────────────────────
  // Stars + tickbox. Derives IDs from prefix.
  initFeedbackForm(prefix) {
    let rating = 0;
    const stars = [1,2,3,4,5].map(n => document.getElementById(`${prefix}-star-${n}`));
    function renderStars(filled) {
      stars.forEach((btn, i) => {
        if (!btn) return;
        btn.innerHTML = Icons.get('star', 'sm', i < filled ? 'warning' : 'tertiary');
        btn.classList.toggle('form-star--filled', i < filled);
      });
    }
    function triggerStarRipple(filled) {
      // Stagger outward from the clicked star (index filled-1) so it animates first.
      // This gives immediate feedback on the tapped star instead of a 120ms lag.
      stars.forEach((btn, i) => {
        if (!btn || i >= filled) return;
        btn.classList.remove('form-star--ripple');
        void btn.offsetWidth;
        btn.style.setProperty('--star-index', (filled - 1) - i);
        btn.classList.add('form-star--ripple');
      });
    }
    stars.forEach((btn, i) => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        // Tap current top star → clear; tap any other star → set to that level
        rating = (i + 1 === rating) ? 0 : i + 1;
        renderStars(rating);
        if (rating > 0) triggerStarRipple(rating);
      });
    });
    renderStars(rating);

    let ticked = false;
    const tickbox     = document.getElementById(`${prefix}-tickbox`);
    const tickboxIcon = document.getElementById(`${prefix}-tickbox-icon`);
    if (tickbox) {
      tickbox.addEventListener('click', () => {
        ticked = !ticked;
        tickbox.setAttribute('aria-pressed', String(ticked));
        tickboxIcon.innerHTML = ticked ? Icons.get('check', 'xs', 'primary') : '';
      });
    }
  },

  // ── COUNT-UP ANIMATION ──────────────────────────────────────
  // Animates a number element from 0 to target over duration ms.
  // el: DOM element whose textContent will be updated.
  // format: optional function(value) → string for custom display.
  countUp(el, target, duration = 800, format) {
    if (!el) return;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const ease     = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      const value    = Math.round(target * ease);
      el.textContent = format ? format(value) : value;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  },

  // ── HOME DATE + WEEK ROWS ───────────────────────────────────
  // Sets the date label and fills the last-week day name rows.
  // ── BUTTON PRESS ANIMATION ──────────────────────────────────
  // Attach once per page. Triggers btn--pressing on every .btn pointerdown
  // so the full scale-down→normal animation plays regardless of tap speed.
  initBtnPress() {
    document.addEventListener('pointerdown', e => {
      const btn = e.target.closest('.btn');
      if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
      btn.classList.remove('btn--pressing');
      // Force reflow so re-tapping replays the animation
      void btn.offsetWidth;
      btn.classList.add('btn--pressing');
      btn.addEventListener('animationend', () => btn.classList.remove('btn--pressing'), { once: true });
    });
  },

  initHomeDate(prefix) {
    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const now = new Date();
    const dateEl = document.getElementById(`${prefix}-home-date`);
    if (dateEl) {
      dateEl.textContent =
        now.toLocaleDateString('en-GB', { weekday: 'long' }) + ', ' +
        now.getDate() + ' ' + now.toLocaleDateString('en-GB', { month: 'long' });
    }
    document.querySelectorAll('#screen-home .home-day-row__name').forEach((el, i) => {
      if (i === 0) { el.textContent = 'Yesterday'; return; }
      const past = new Date(now);
      past.setDate(now.getDate() - (i + 1));
      el.textContent = DAYS[past.getDay()];
    });
  },

};
/* ============================================================
   ICON SPRITE MAP — PUZZLEFIT
   Generated by StyleguideRecreation · 2026-03-24
   Source of truth: Figma icon library
   WARNING: DO NOT EDIT MANUALLY.

   Usage:
     <script src="../icons.js"></script>

     Icons.render(document.getElementById('my-icon'), 'feedback', { size: 'md', color: 'primary' });
     const svg = Icons.get('heartFull', 'md', 'error');

   Available icons: chevronLeft, feedback, share, info, pause, target, merges, heartFull, calendar, stats, settings, hint, timer, cross, chevronDown, check, play, star, refresh, hash, bomb, trophyBronze, trophySilver, trophyGold, question, book, stairs, list, level, gameBack, gameRefresh, gameRedo, gameCross, gamePen, gameLightBulb, gameFlag, gameSquare, gameEnter, themeLight, themeAutomatic, themeDark, arrowLeft, arrowRight
   ============================================================ */

const Icons = (() => {

  const SPRITES = {

    // ── NAVIGATION & UI ICONS ──────────────────────────────────

    // Figma: Icon=Chevron left
    chevronLeft: {
      viewBox: '0 0 10.4219 19.3613',
      fill: true,
      stroke: false,
      content: `<path d="M8.58008 19.0469L0.359375 10.4668C0.119792 10.1673 0 9.89779 0 9.6582C0 9.38867 0.104818 9.13411 0.314453 8.89453L8.53516 0.314453C9.01432 -0.104818 9.52344 -0.104818 10.0625 0.314453C10.4818 0.79362 10.4818 1.30273 10.0625 1.8418L2.56055 9.6582L10.1074 17.5195C10.5267 18.0586 10.5267 18.5677 10.1074 19.0469C9.56836 19.4661 9.05924 19.4661 8.58008 19.0469Z" fill="currentColor"/>`,
    },

    // Figma: Icon=Feedback
    feedback: {
      viewBox: '0 0 23 22.8781',
      fill: true,
      stroke: false,
      content: `<path d="M20.125 0C20.9635 0.0299479 21.6523 0.314453 22.1914 0.853516C22.7005 1.39258 22.9701 2.05143 23 2.83008V15.7227C22.9701 16.5312 22.6855 17.2051 22.1465 17.7441C21.6074 18.2832 20.9336 18.5527 20.125 18.5527H13.6562L8.04102 22.7754C7.86133 22.8952 7.68164 22.9102 7.50195 22.8203C7.32227 22.7305 7.21745 22.5658 7.1875 22.3262V18.5527H2.875C2.06641 18.5527 1.39258 18.2832 0.853516 17.7441C0.314453 17.2051 0.0299479 16.5312 0 15.7227V2.83008C0.0299479 2.05143 0.314453 1.39258 0.853516 0.853516C1.39258 0.314453 2.06641 0.0299479 2.875 0H20.125ZM20.8887 15.8125V2.875C20.8587 2.42578 20.6191 2.1862 20.1699 2.15625H2.91992C2.4707 2.1862 2.23112 2.42578 2.20117 2.875V15.8125C2.23112 16.2617 2.4707 16.5013 2.91992 16.5312H9.38867V19.2266L12.9824 16.5312H20.1699C20.6191 16.5013 20.8587 16.2617 20.8887 15.8125ZM14.4199 7.86133C13.5814 7.80143 13.1322 7.33724 13.0723 6.46875C13.0723 6.04948 13.207 5.70508 13.4766 5.43555C13.7461 5.16602 14.0755 5.03125 14.4648 5.03125C14.8542 5.03125 15.1836 5.18099 15.4531 5.48047C15.7227 5.75 15.8574 6.07943 15.8574 6.46875C15.8574 6.85807 15.7227 7.1875 15.4531 7.45703C15.1836 7.72656 14.8392 7.86133 14.4199 7.86133ZM8.66992 7.86133C7.83138 7.80143 7.38216 7.33724 7.32227 6.46875C7.32227 6.04948 7.45703 5.70508 7.72656 5.43555C7.99609 5.16602 8.32552 5.03125 8.71484 5.03125C9.10417 5.03125 9.43359 5.18099 9.70312 5.48047C9.97266 5.75 10.1074 6.07943 10.1074 6.46875C10.1074 6.85807 9.97266 7.1875 9.70312 7.45703C9.43359 7.72656 9.08919 7.86133 8.66992 7.86133ZM14.6895 10.7812C15.1686 10.332 15.6777 10.3021 16.2168 10.6914C16.666 11.1406 16.696 11.6348 16.3066 12.1738C15.0488 13.6113 13.4616 14.3451 11.5449 14.375C9.62826 14.3451 8.04102 13.6113 6.7832 12.1738C6.39388 11.6348 6.42383 11.1406 6.87305 10.6914C7.41211 10.3021 7.92122 10.332 8.40039 10.7812C9.23893 11.7096 10.2871 12.1888 11.5449 12.2188C12.8027 12.1888 13.8509 11.7096 14.6895 10.7812Z" fill="currentColor"/>`,
    },

    // Figma: Icon=Share
    share: {
      viewBox: '0 0 20.125 23',
      fill: true,
      stroke: false,
      content: `<path d="M17.25 7.1875C18.0586 7.21745 18.7324 7.50195 19.2715 8.04102C19.8105 8.58008 20.0951 9.25391 20.125 10.0625V20.125C20.0951 20.9336 19.8105 21.6074 19.2715 22.1465C18.7324 22.6855 18.0586 22.9701 17.25 23H2.875C2.06641 22.9701 1.39258 22.6855 0.853516 22.1465C0.314453 21.6074 0.0299479 20.9336 0 20.125V10.0625C0.0299479 9.25391 0.314453 8.58008 0.853516 8.04102C1.39258 7.50195 2.06641 7.21745 2.875 7.1875H3.23438C3.89323 7.2474 4.2526 7.60677 4.3125 8.26562C4.2526 8.92448 3.89323 9.28385 3.23438 9.34375H2.875C2.42578 9.3737 2.1862 9.61328 2.15625 10.0625V20.125C2.1862 20.5742 2.42578 20.8138 2.875 20.8438H17.25C17.6992 20.8138 17.9388 20.5742 17.9688 20.125V10.0625C17.9388 9.61328 17.6992 9.3737 17.25 9.34375H16.8906C16.2318 9.28385 15.8724 8.92448 15.8125 8.26562C15.8724 7.60677 16.2318 7.2474 16.8906 7.1875H17.25ZM5.75 6.82812C5.45052 6.82812 5.19596 6.72331 4.98633 6.51367C4.74674 6.30404 4.62695 6.04948 4.62695 5.75C4.6569 5.48047 4.76172 5.22591 4.94141 4.98633L9.25391 0.314453C9.49349 0.104818 9.76302 0 10.0625 0C10.362 0 10.6315 0.104818 10.8711 0.314453L15.1836 4.98633C15.3633 5.22591 15.4531 5.48047 15.4531 5.75C15.3932 6.40885 15.0339 6.76823 14.375 6.82812C14.0755 6.82812 13.806 6.70833 13.5664 6.46875L11.1406 3.81836V14.375C11.0807 15.0339 10.7214 15.3932 10.0625 15.4531C9.40365 15.3932 9.04427 15.0339 8.98438 14.375V3.81836L6.55859 6.46875C6.31901 6.70833 6.04948 6.82812 5.75 6.82812Z" fill="currentColor"/>`,
    },

    // Figma: IconSet20X — Info
    info: {
      viewBox: '0 0 20 20',
      fill: true,
      stroke: false,
      content: `<path d="M10 0C11.875 0.0260417 13.5547 0.481771 15.0391 1.36719C16.5495 2.2526 17.7474 3.45052 18.6328 4.96094C19.5182 6.44531 19.974 8.125 20 10C19.974 11.875 19.5182 13.5547 18.6328 15.0391C17.7474 16.5495 16.5495 17.7474 15.0391 18.6328C13.5547 19.5182 11.875 19.974 10 20C8.125 19.974 6.44531 19.5182 4.96094 18.6328C3.45052 17.7474 2.2526 16.5495 1.36719 15.0391C0.481771 13.5547 0.0260417 11.875 0 10C0.0260417 8.125 0.481771 6.44531 1.36719 4.96094C2.2526 3.45052 3.45052 2.2526 4.96094 1.36719C6.44531 0.481771 8.125 0.0260417 10 0ZM10 5C9.63542 5 9.33594 5.11719 9.10156 5.35156C8.86719 5.58594 8.75 5.88542 8.75 6.25C8.75 6.61458 8.86719 6.91406 9.10156 7.14844C9.33594 7.38281 9.63542 7.5 10 7.5C10.3646 7.5 10.6641 7.38281 10.8984 7.14844C11.1328 6.91406 11.25 6.61458 11.25 6.25C11.25 5.88542 11.1328 5.58594 10.8984 5.35156C10.6641 5.11719 10.3646 5 10 5ZM11.5625 15C12.1354 14.9479 12.4479 14.6354 12.5 14.0625C12.4479 13.4896 12.1354 13.1771 11.5625 13.125H10.9375V9.6875C10.8854 9.11458 10.5729 8.80208 10 8.75H8.75C8.17708 8.80208 7.86458 9.11458 7.8125 9.6875C7.86458 10.2604 8.17708 10.5729 8.75 10.625H9.0625V13.125H8.4375C7.86458 13.1771 7.55208 13.4896 7.5 14.0625C7.55208 14.6354 7.86458 14.9479 8.4375 15H11.5625Z" fill="currentColor"/>`,
    },

    // Figma: IconSet20X — Pause (redrawn for 20×20 viewBox to match icon visual weight)
    pause: {
      viewBox: '0 0 20 20',
      fill: true,
      stroke: false,
      content: `<path d="M5.79124 3.5C5.0223 3.5 4.39844 4.12386 4.39844 4.8928V15.1067C4.39844 15.8757 5.0223 16.4995 5.79124 16.4995H7.64832C8.41726 16.4995 9.04112 15.8757 9.04112 15.1067V4.8928C9.04112 4.12386 8.41726 3.5 7.64832 3.5H5.79124ZM12.291 3.5C11.5221 3.5 10.8982 4.12386 10.8982 4.8928V15.1067C10.8982 15.8757 11.5221 16.4995 12.291 16.4995H14.1481C14.917 16.4995 15.5409 15.8757 15.5409 15.1067V4.8928C15.5409 4.12386 14.917 3.5 14.1481 3.5H12.291Z" fill="currentColor"/>`,
    },

    // Figma: IconSet20X — Target
    target: {
      viewBox: '0 0 20 20',
      fill: true,
      stroke: false,
      content: `<path d="M10 0C10.2652 0 10.5196 0.105357 10.7071 0.292893C10.8946 0.48043 11 0.734784 11 1C11 1.26522 10.8946 1.51957 10.7071 1.70711C10.5196 1.89464 10.2652 2 10 2C8.41775 2 6.87103 2.46919 5.55544 3.34824C4.23984 4.22729 3.21447 5.47672 2.60896 6.93853C2.00346 8.40034 1.84504 10.0089 2.15372 11.5607C2.4624 13.1126 3.22433 14.538 4.34315 15.6569C5.46197 16.7757 6.88743 17.5376 8.43928 17.8463C9.99113 18.155 11.5997 17.9965 13.0615 17.391C14.5233 16.7855 15.7727 15.7602 16.6518 14.4446C17.5308 13.129 18 11.5823 18 10C18 9.73478 18.1054 9.48043 18.2929 9.29289C18.4804 9.10536 18.7348 9 19 9C19.2652 9 19.5196 9.10536 19.7071 9.29289C19.8946 9.48043 20 9.73478 20 10C20 15.523 15.523 20 10 20C4.477 20 0 15.523 0 10C0 4.477 4.477 0 10 0ZM10 4C10.2652 4 10.5196 4.10536 10.7071 4.29289C10.8946 4.48043 11 4.73478 11 5C11 5.26522 10.8946 5.51957 10.7071 5.70711C10.5196 5.89464 10.2652 6 10 6C9.20887 6 8.43552 6.2346 7.77772 6.67412C7.11992 7.11365 6.60723 7.73836 6.30448 8.46927C6.00173 9.20017 5.92252 10.0044 6.07686 10.7804C6.2312 11.5563 6.61216 12.269 7.17157 12.8284C7.73098 13.3878 8.44371 13.7688 9.21964 13.9231C9.99556 14.0775 10.7998 13.9983 11.5307 13.6955C12.2616 13.3928 12.8864 12.8801 13.3259 12.2223C13.7654 11.5645 14 10.7911 14 10C14 9.73478 14.1054 9.48043 14.2929 9.29289C14.4804 9.10536 14.7348 9 15 9C15.2652 9 15.5196 9.10536 15.7071 9.29289C15.8946 9.48043 16 9.73478 16 10C16 11.1867 15.6481 12.3467 14.9888 13.3334C14.3295 14.3201 13.3925 15.0892 12.2961 15.5433C11.1997 15.9974 9.99334 16.1162 8.82946 15.8847C7.66557 15.6532 6.59647 15.0818 5.75736 14.2426C4.91824 13.4035 4.3468 12.3344 4.11529 11.1705C3.88378 10.0067 4.0026 8.80026 4.45672 7.7039C4.91085 6.60754 5.67988 5.67047 6.66658 5.01118C7.65327 4.35189 8.81331 4 10 4ZM16.571 0.1L15.659 0.1L13.769 1.99C13.3943 2.36515 13.1838 2.87375 13.184 3.404V5.404L9.294 9.293C9.11184 9.4816 9.01105 9.7342 9.01333 9.9964C9.0156 10.2586 9.12077 10.5094 9.30618 10.6948C9.49159 10.8802 9.7424 10.9854 10.0046 10.9877C10.2668 10.99 10.5194 10.8892 10.708 10.707L14.598 6.818H16.598C17.1284 6.81789 17.637 6.6071 18.012 6.232L19.9 4.344V3.429C19.9 3.29639 19.8473 3.16921 19.7536 3.07545C19.6598 2.98168 19.5326 2.929 19.4 2.929H17.571C17.4386 2.929 17.3115 2.87646 17.2178 2.78291C17.1241 2.68935 17.0713 2.56243 17.071 2.43V0.6C17.071 0.467392 17.0183 0.340215 16.9246 0.246447C16.8308 0.152678 16.7036 0.1 16.571 0.1Z" fill="currentColor"/>`,
    },

    // Figma: IconSet20X — Merges
    merges: {
      viewBox: '0 0 20 20',
      fill: true,
      stroke: false,
      content: `<path fill-rule="evenodd" clip-rule="evenodd" d="M20 2.16216C20 0.968033 19.032 0 17.8378 0H7.02703C5.8329 0 4.86486 0.968033 4.86486 2.16216V4.32432H13.5135C14.7076 4.32432 15.6757 5.29236 15.6757 6.48649V15.1351H17.8378C19.032 15.1351 20 14.1671 20 12.973V2.16216ZM16.7568 4.86486C17.6524 4.86486 18.3784 4.13884 18.3784 3.24324C18.3784 2.34765 17.6524 1.62162 16.7568 1.62162C15.8612 1.62162 15.1351 2.34765 15.1351 3.24324C15.1351 4.13884 15.8612 4.86486 16.7568 4.86486Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M2.16216 4.86486C0.968033 4.86486 0 5.8329 0 7.02703V17.8378C0 19.032 0.968033 20 2.16216 20H12.973C14.1671 20 15.1351 19.032 15.1351 17.8378V7.02703C15.1351 5.8329 14.1671 4.86486 12.973 4.86486H2.16216ZM7.56757 14.0541C8.46316 14.0541 9.18919 13.328 9.18919 12.4324C9.18919 11.5368 8.46316 10.8108 7.56757 10.8108C6.67197 10.8108 5.94595 11.5368 5.94595 12.4324C5.94595 13.328 6.67197 14.0541 7.56757 14.0541ZM12.973 8.64865C12.973 9.54425 12.2469 10.2703 11.3514 10.2703C10.4558 10.2703 9.72973 9.54425 9.72973 8.64865C9.72973 7.75305 10.4558 7.02703 11.3514 7.02703C12.2469 7.02703 12.973 7.75305 12.973 8.64865ZM3.78378 10.2703C4.67938 10.2703 5.40541 9.54425 5.40541 8.64865C5.40541 7.75305 4.67938 7.02703 3.78378 7.02703C2.88819 7.02703 2.16216 7.75305 2.16216 8.64865C2.16216 9.54425 2.88819 10.2703 3.78378 10.2703ZM5.40541 16.2162C5.40541 17.1118 4.67938 17.8378 3.78378 17.8378C2.88819 17.8378 2.16216 17.1118 2.16216 16.2162C2.16216 15.3206 2.88819 14.5946 3.78378 14.5946C4.67938 14.5946 5.40541 15.3206 5.40541 16.2162ZM11.3514 17.8378C12.2469 17.8378 12.973 17.1118 12.973 16.2162C12.973 15.3206 12.2469 14.5946 11.3514 14.5946C10.4558 14.5946 9.72973 15.3206 9.72973 16.2162C9.72973 17.1118 10.4558 17.8378 11.3514 17.8378Z" fill="currentColor"/>`,
    },

    // Figma: Icon=Heart Full
    heartFull: {
      viewBox: '0 0 23 19.6608',
      fill: true,
      stroke: false,
      content: `<path d="M0 6.67839V6.40885C0.0299479 4.79167 0.539062 3.41406 1.52734 2.27604C2.51562 1.10807 3.78841 0.374349 5.3457 0.0748698C6.36393 -0.0748698 7.36719 0 8.35547 0.299479C9.34375 0.598958 10.2122 1.12305 10.9609 1.87174L11.5 2.41081L11.9941 1.87174C12.7728 1.12305 13.6413 0.598958 14.5996 0.299479C15.5879 0 16.6061 -0.0748698 17.6543 0.0748698C19.2116 0.374349 20.4844 1.10807 21.4727 2.27604C22.4609 3.41406 22.9701 4.79167 23 6.40885V6.67839C22.9701 8.625 22.2513 10.2572 20.8438 11.5749L12.7578 19.1667C12.3984 19.4961 11.9792 19.6608 11.5 19.6608C11.0208 19.6608 10.6016 19.4961 10.2422 19.1667L2.15625 11.5749C0.748698 10.2572 0.0299479 8.625 0 6.67839Z" fill="currentColor"/>`,
    },

    // ── 20x20 STANDARD ICONS (Figma IconSet20X) ────────────────

    calendar: {
      viewBox: '0 0 18.0952 20',
      fill: true,
      stroke: false,
      content: `<path d="M6.4626 1.25V2.5H11.6326V1.25C11.6326 0.885418 11.7538 0.585936 11.9962 0.351563C12.2385 0.117188 12.5482 0 12.9251 0C13.3021 0 13.6118 0.117188 13.8542 0.351563C14.0965 0.585936 14.2177 0.885418 14.2177 1.25V2.5H16.1564C16.695 2.52604 17.1528 2.70834 17.5297 3.04688C17.8798 3.41146 18.0683 3.85417 18.0952 4.375V6.25001H0V4.375C0.0269272 3.85417 0.215419 3.41146 0.565474 3.04688C0.942459 2.70834 1.40022 2.52604 1.93877 2.5H3.87755V1.25C3.87755 0.885418 3.99872 0.585936 4.24107 0.351563C4.48342 0.117188 4.79309 0 5.17007 0C5.54707 0 5.85671 0.117188 6.09906 0.351563C6.34142 0.585936 6.4626 0.885418 6.4626 1.25ZM0 7.5H18.0952V18.125C18.0683 18.6459 17.8798 19.0886 17.5297 19.4532C17.1528 19.7917 16.695 19.974 16.1564 20H1.93877C1.40022 19.974 0.942459 19.7917 0.565474 19.4532C0.215419 19.0886 0.0269272 18.6459 0 18.125V7.5ZM2.58503 11.875C2.61196 12.2657 2.82738 12.474 3.23129 12.5H4.52381C4.92772 12.474 5.14314 12.2657 5.17007 11.875V10.625C5.14314 10.2344 4.92772 10.0261 4.52381 9.99999H3.23129C2.82738 10.0261 2.61196 10.2344 2.58503 10.625V11.875ZM7.75511 11.875C7.78205 12.2657 7.99746 12.474 8.40133 12.5H9.6939C10.0978 12.474 10.3132 12.2657 10.3401 11.875V10.625C10.3132 10.2344 10.0978 10.0261 9.6939 9.99999H8.40133C7.99746 10.0261 7.78205 10.2344 7.75511 10.625V11.875ZM13.5714 9.99999C13.1675 10.0261 12.9521 10.2344 12.9251 10.625V11.875C12.9521 12.2657 13.1675 12.474 13.5714 12.5H14.8639C15.2679 12.474 15.4833 12.2657 15.5102 11.875V10.625C15.4833 10.2344 15.2679 10.0261 14.8639 9.99999H13.5714ZM2.58503 16.875C2.61196 17.2656 2.82738 17.474 3.23129 17.5H4.52381C4.92772 17.474 5.14314 17.2656 5.17007 16.875V15.625C5.14314 15.2344 4.92772 15.026 4.52381 15H3.23129C2.82738 15.026 2.61196 15.2344 2.58503 15.625V16.875ZM8.40133 15C7.99746 15.026 7.78205 15.2344 7.75511 15.625V16.875C7.78205 17.2656 7.99746 17.474 8.40133 17.5H9.6939C10.0978 17.474 10.3132 17.2656 10.3401 16.875V15.625C10.3132 15.2344 10.0978 15.026 9.6939 15H8.40133ZM12.9251 16.875C12.9521 17.2656 13.1675 17.474 13.5714 17.5H14.8639C15.2679 17.474 15.4833 17.2656 15.5102 16.875V15.625C15.4833 15.2344 15.2679 15.026 14.8639 15H13.5714C13.1675 15.026 12.9521 15.2344 12.9251 15.625V16.875Z" fill="currentColor"/>`,
    },

    stats: {
      viewBox: '0 0 20 20',
      fill: true,
      stroke: false,
      content: `<path d="M7.14286 2.14286C7.17262 1.54762 7.38095 1.04167 7.76786 0.625C8.18452 0.238095 8.69048 0.0297619 9.28571 0H10.7143C11.3095 0.0297619 11.8155 0.238095 12.2321 0.625C12.619 1.04167 12.8274 1.54762 12.8571 2.14286V17.8571C12.8274 18.4524 12.619 18.9583 12.2321 19.375C11.8155 19.7619 11.3095 19.9702 10.7143 20H9.28571C8.69048 19.9702 8.18452 19.7619 7.76786 19.375C7.38095 18.9583 7.17262 18.4524 7.14286 17.8571V2.14286ZM0 10.7143C0.0297619 10.119 0.238095 9.6131 0.625 9.19643C1.04167 8.80952 1.54762 8.60119 2.14286 8.57143H3.57143C4.16667 8.60119 4.67262 8.80952 5.08929 9.19643C5.47619 9.6131 5.68452 10.119 5.71429 10.7143V17.8571C5.68452 18.4524 5.47619 18.9583 5.08929 19.375C4.67262 19.7619 4.16667 19.9702 3.57143 20H2.14286C1.54762 19.9702 1.04167 19.7619 0.625 19.375C0.238095 18.9583 0.0297619 18.4524 0 17.8571V10.7143ZM17.8571 2.85714C18.4524 2.8869 18.9583 3.09524 19.375 3.48214C19.7619 3.89881 19.9702 4.40476 20 5V17.8571C19.9702 18.4524 19.7619 18.9583 19.375 19.375C18.9583 19.7619 18.4524 19.9702 17.8571 20H16.4286C15.8333 19.9702 15.3274 19.7619 14.9107 19.375C14.5238 18.9583 14.3155 18.4524 14.2857 17.8571V5C14.3155 4.40476 14.5238 3.89881 14.9107 3.48214C15.3274 3.09524 15.8333 2.8869 16.4286 2.85714H17.8571Z" fill="currentColor"/>`,
    },

    settings: {
      viewBox: '0 0 18.8393 20',
      fill: true,
      stroke: false,
      content: `<path d="M18.7946 6.52344C18.8988 6.88802 18.8207 7.20052 18.5603 7.46094L16.8415 9.02344C16.8936 9.33594 16.9196 9.66146 16.9196 10C16.9196 10.3385 16.8936 10.6641 16.8415 10.9766L18.5603 12.5391C18.8207 12.7995 18.8988 13.112 18.7946 13.4766C18.6124 13.9453 18.404 14.401 18.1696 14.8438L18.0134 15.1563C17.753 15.5729 17.4535 15.9766 17.115 16.3672C16.8545 16.6536 16.542 16.7448 16.1775 16.6406L13.99 15.9375C13.4431 16.3542 12.8702 16.6927 12.2712 16.9531L11.8025 19.1797C11.6983 19.5443 11.4639 19.7786 11.0993 19.8828C10.5525 19.9609 9.97954 20 9.38058 20C8.8337 20 8.29985 19.9609 7.77902 19.8828C7.38839 19.7786 7.141 19.5443 7.03683 19.1797L6.56808 16.9531C5.94308 16.6927 5.37016 16.3542 4.84933 15.9375L2.66183 16.6406C2.29725 16.7448 1.98475 16.6536 1.72433 16.3672C1.38579 15.9766 1.09933 15.5729 0.864955 15.1563L0.669643 14.8438C0.435268 14.401 0.226935 13.9453 0.0446429 13.4766C-0.0595238 13.112 0.0186012 12.7995 0.279018 12.5391L1.99777 10.9766C1.94568 10.6641 1.91964 10.3385 1.91964 10C1.91964 9.66146 1.94568 9.33594 1.99777 9.02344L0.279018 7.46094C0.0186012 7.20052 -0.0595238 6.88802 0.0446429 6.52344C0.226935 6.05469 0.435268 5.59896 0.669643 5.15625L0.864955 4.84375C1.09933 4.42708 1.38579 4.02344 1.72433 3.63281C1.98475 3.34635 2.29725 3.25521 2.66183 3.35938L4.84933 4.0625C5.37016 3.64583 5.94308 3.30729 6.56808 3.04688L7.03683 0.820313C7.141 0.455729 7.38839 0.234375 7.77902 0.15625C8.29985 0.0520833 8.84673 0 9.41964 0C9.99256 0 10.5525 0.0520833 11.0993 0.15625C11.4639 0.234375 11.6983 0.455729 11.8025 0.820313L12.2712 3.04688C12.8702 3.30729 13.4431 3.64583 13.99 4.0625L16.1775 3.35938C16.542 3.25521 16.8545 3.34635 17.115 3.63281C17.4535 4.02344 17.753 4.42708 18.0134 4.84375L18.1696 5.15625C18.404 5.59896 18.6124 6.05469 18.7946 6.52344ZM9.41964 13.125C10.3051 13.099 11.0472 12.7865 11.6462 12.1875C12.2191 11.6146 12.5186 10.8724 12.5446 9.96094C12.5186 9.10156 12.2191 8.3724 11.6462 7.77344C11.0472 7.17448 10.3051 6.86198 9.41964 6.83594C8.53423 6.86198 7.79204 7.17448 7.19308 7.77344C6.62016 8.3724 6.32068 9.10156 6.29464 9.96094C6.32068 10.8724 6.62016 11.6146 7.19308 12.1875C7.79204 12.7865 8.53423 13.099 9.41964 13.125Z" fill="currentColor"/>`,
    },

    hint: {
      viewBox: '0 0 14 20',
      fill: true,
      stroke: false,
      content: `<path d="M10.6786 14.5455C10.9448 13.7008 11.4771 12.9356 12.0786 12.2765C13.2708 10.9735 14 9.21212 14 7.27273C14 3.25758 10.8646 0 7 0C3.13542 0 0 3.25758 0 7.27273C0 9.21212 0.729167 10.9735 1.92135 12.2765C2.52292 12.9356 3.05885 13.7008 3.32135 14.5455H10.675H10.6786ZM10.5 16.3636H3.5V16.9697C3.5 18.6439 4.80521 20 6.41667 20H7.58333C9.19479 20 10.5 18.6439 10.5 16.9697V16.3636ZM6.70833 4.24242C5.25729 4.24242 4.08333 5.46212 4.08333 6.9697C4.08333 7.47349 3.69323 7.87879 3.20833 7.87879C2.72344 7.87879 2.33333 7.47349 2.33333 6.9697C2.33333 4.45833 4.29115 2.42424 6.70833 2.42424C7.19323 2.42424 7.58333 2.82955 7.58333 3.33333C7.58333 3.83712 7.19323 4.24242 6.70833 4.24242Z" fill="currentColor"/>`,
    },

    timer: {
      viewBox: '0 0 16 20',
      fill: true,
      stroke: false,
      content: `<path d="M15.999 11.875C15.999 16.3633 12.4185 20 7.99952 20C3.58055 20 0 16.3633 0 11.875C0 8.03081 2.62753 4.80921 6.15878 3.96768C6.50683 3.88473 6.76882 3.58383 6.76882 3.22603C6.76882 2.82505 6.44377 2.5 6.0428 2.5H5.69197C5.43813 2.5 5.23045 2.28906 5.23045 2.03125V0.46875C5.23045 0.210938 5.43813 0 5.69197 0H10.3071C10.5609 0 10.7686 0.210938 10.7686 0.46875V2.03125C10.7686 2.28906 10.5609 2.5 10.3071 2.5H9.95665C9.55545 2.5 9.23021 2.82523 9.23021 3.22643C9.23021 3.58411 9.49166 3.88497 9.83952 3.96818C10.6479 4.16158 11.409 4.47936 12.1013 4.90062C12.6737 5.24885 13.4263 5.22245 13.8963 4.74505L14.1222 4.51562C14.303 4.33203 14.5953 4.33203 14.776 4.51562L15.8644 5.62109C16.0452 5.80469 16.0452 6.10156 15.8644 6.28516L14.7337 7.43359C14.7202 7.44729 14.7181 7.4685 14.7284 7.48471C15.5329 8.74478 15.999 10.2541 15.999 11.875ZM9.23021 13.2812V7.36328C9.23021 7.10547 9.02253 6.89453 8.7687 6.89453H7.23033C6.9765 6.89453 6.76882 7.10547 6.76882 7.36328V13.2812C6.76882 13.5391 6.9765 13.75 7.23033 13.75H8.7687C9.02253 13.75 9.23021 13.5391 9.23021 13.2812Z" fill="currentColor"/>`,
    },

    cross: {
      viewBox: '0 0 20 20',
      fill: true,
      stroke: false,
      content: `<path d="M16.1807 3C16.6978 3 17.1133 3.4107 17.1133 3.93945C17.1132 4.19187 17.0034 4.42892 16.8311 4.61035L11.3389 10L16.8311 15.3896C17.0034 15.5711 17.1132 15.8003 17.1133 16.0605C17.1133 16.5893 16.6978 17 16.1807 17C15.9222 17 15.7026 16.905 15.5303 16.7314L10.1133 11.3867L4.69629 16.7314C4.52395 16.905 4.30438 17 4.0459 17C3.52876 17 3.11328 16.5893 3.11328 16.0605C3.11337 15.8003 3.2232 15.5711 3.39551 15.3896L8.8877 10L3.39551 4.61035C3.2232 4.42892 3.11338 4.19187 3.11328 3.93945C3.11328 3.4107 3.52876 3 4.0459 3C4.30438 3.00005 4.52395 3.09498 4.69629 3.26855L10.1133 8.60547L15.5303 3.26855C15.7026 3.09498 15.9222 3.00005 16.1807 3Z" fill="currentColor"/>`,
    },

    chevronDown: {
      viewBox: '0 0 20 11',
      fill: true,
      stroke: false,
      content: `<path d="M17.9628 0.325086C18.3982 -0.108506 19.1042 -0.108341 19.5394 0.325456L19.6739 0.459535C20.1088 0.893029 20.1087 1.59549 19.6737 2.02885L11.1418 10.5278C10.9925 10.6774 10.8149 10.7962 10.6193 10.8772C10.4237 10.9583 10.214 11 10.0021 11C9.79028 11 9.58052 10.9583 9.38492 10.8772C9.18932 10.7962 9.01175 10.6774 8.86242 10.5278L0.326553 2.02922C-0.108824 1.59575 -0.108855 0.892845 0.326485 0.459332L0.460128 0.32625C0.895374 -0.107169 1.60101 -0.107202 2.03629 0.326178L9.99971 8.25471L17.9628 0.325086Z" fill="currentColor"/>`,
    },

    check: {
      viewBox: '0 0 17.4998 12.4998',
      fill: true,
      stroke: false,
      content: `<path d="M15.3661 0.366117C15.8543 -0.122039 16.6455 -0.122039 17.1337 0.366117C17.6218 0.854272 17.6218 1.64554 17.1337 2.13369L7.13369 12.1337C6.64554 12.6219 5.85427 12.6219 5.36612 12.1337L0.366117 7.13369C-0.122039 6.64554 -0.122039 5.85427 0.366117 5.36612C0.854272 4.87796 1.64554 4.87796 2.13369 5.36612L6.24991 9.48233L15.3661 0.366117Z" fill="currentColor"/>`,
    },

    play: {
      viewBox: '0 0 20 20',
      fill: true,
      stroke: false,
      content: `<path d="M16.5988 9.39127C17.2383 9.78097 17.2383 10.7094 16.5988 11.0991L6.0204 17.3539C5.35402 17.76 4.5 17.2804 4.5 16.5L4.5 3.79844C4.5 3.01806 5.35402 2.53841 6.0204 2.94452L16.5988 9.39127Z" fill="currentColor"/>`,
    },

    star: {
      viewBox: '0 0 19.911 19.0219',
      fill: true,
      stroke: false,
      content: `<path d="M10.7333 0.474096C10.5849 0.184572 10.2845 0 9.95879 0C9.63308 0 9.3327 0.184572 9.18432 0.474096L6.52069 5.69277L0.733827 6.61201C0.411731 6.66268 0.143921 6.89068 0.0425879 7.20192C-0.0587456 7.51316 0.0244928 7.85335 0.252493 8.08497L4.39269 12.2288L3.48069 18.0156C3.43002 18.3377 3.56393 18.6635 3.82812 18.8553C4.09231 19.0471 4.43974 19.076 4.73288 18.9277L9.95879 16.2713L15.1811 18.9277C15.4706 19.076 15.8217 19.0471 16.0859 18.8553C16.35 18.6635 16.4839 18.3414 16.4333 18.0156L15.5177 12.2288L19.6579 8.08497C19.8895 7.85335 19.9691 7.51316 19.8678 7.20192C19.7664 6.89068 19.5022 6.66268 19.1765 6.61201L13.3933 5.69277L10.7333 0.474096Z" fill="currentColor"/>`,
    },

    refresh: {
      viewBox: '0 0 20 20',
      fill: true,
      stroke: false,
      content: `<path d="M18.6667 0C19.0556 0 19.375 0.125 19.625 0.375C19.875 0.625 20 0.944444 20 1.33333V7.33333C20 7.72222 19.875 8.04167 19.625 8.29167C19.375 8.54167 19.0556 8.66667 18.6667 8.66667H13.3333C12.9444 8.66667 12.625 8.54167 12.375 8.29167C12.125 8.04167 12 7.72222 12 7.33333C12 6.94444 12.125 6.625 12.375 6.375C12.625 6.125 12.9444 6 13.3333 6H15.1667C14.5833 5.16667 13.8472 4.51389 12.9583 4.04167C12.0417 3.56944 11.0556 3.33333 10 3.33333C8.58333 3.36111 7.33333 3.76389 6.25 4.54167C5.16667 5.34722 4.38889 6.41667 3.91667 7.75C3.80556 8.11111 3.59722 8.375 3.29167 8.54167C2.95833 8.68056 2.61111 8.69444 2.25 8.58333C1.88889 8.47222 1.63889 8.26389 1.5 7.95833C1.33333 7.625 1.30556 7.27778 1.41667 6.91667C2.05556 5.02778 3.13889 3.51389 4.66667 2.375C6.22222 1.26389 8 0.694444 10 0.666667C11.5 0.666667 12.8889 1 14.1667 1.66667C15.4444 2.33333 16.5 3.25 17.3333 4.41667V1.33333C17.3333 0.944444 17.4583 0.625 17.7083 0.375C17.9583 0.125 18.2778 0 18.6667 0ZM17.75 11.4167C18.1111 11.5 18.3611 11.7083 18.5 12.0417C18.6667 12.375 18.6944 12.7222 18.5833 13.0833C17.9167 14.9722 16.8194 16.4861 15.2917 17.625C13.7361 18.7361 11.9583 19.3056 9.95833 19.3333C8.48611 19.3333 7.11111 19 5.83333 18.3333C4.58333 17.6667 3.52778 16.75 2.66667 15.5833V18.6667C2.66667 19.0556 2.54167 19.375 2.29167 19.625C2.04167 19.875 1.72222 20 1.33333 20C0.944444 20 0.625 19.875 0.375 19.625C0.125 19.375 0 19.0556 0 18.6667V12.6667C0 12.2778 0.125 11.9583 0.375 11.7083C0.625 11.4583 0.944444 11.3333 1.33333 11.3333H6.66667C7.05556 11.3333 7.375 11.4583 7.625 11.7083C7.875 11.9583 8 12.2778 8 12.6667C8 13.0556 7.875 13.375 7.625 13.625C7.375 13.875 7.05556 14 6.66667 14H4.83333C5.41667 14.8333 6.15278 15.4861 7.04167 15.9583C7.95833 16.4306 8.94444 16.6667 10 16.6667C11.4167 16.6389 12.6667 16.2361 13.75 15.4583C14.8333 14.6528 15.6111 13.5833 16.0833 12.25C16.1944 11.8889 16.4028 11.6389 16.7083 11.5C17.0417 11.3333 17.3889 11.3056 17.75 11.4167Z" fill="currentColor"/>`,
    },

    hash: {
      viewBox: '0 0 20 20',
      fill: true,
      stroke: false,
      content: `<path fill-rule="evenodd" clip-rule="evenodd" d="M7.22811 0.0142101C7.43943 0.0398484 7.6435 0.10576 7.82866 0.208183C8.01381 0.310605 8.17644 0.447533 8.30724 0.611146C8.43805 0.774759 8.53447 0.961855 8.59101 1.16175C8.64755 1.36164 8.66309 1.57042 8.63676 1.77617L8.25622 4.73803H12.5546L12.9859 1.38462C13.0393 0.969104 13.26 0.591231 13.5995 0.33413C13.9389 0.0770296 14.3694 -0.0382386 14.7962 0.0136836C15.223 0.0656059 15.6111 0.280465 15.8752 0.610995C16.1393 0.941525 16.2577 1.36065 16.2043 1.77617L15.8238 4.73803H18.3784C18.8085 4.73803 19.2209 4.90437 19.525 5.20045C19.8291 5.49654 20 5.89811 20 6.31684C20 6.73557 19.8291 7.13715 19.525 7.43323C19.2209 7.72932 18.8085 7.89566 18.3784 7.89566H15.4184L14.8778 12.1058H17.8378C18.2679 12.1058 18.6804 12.2722 18.9845 12.5683C19.2886 12.8643 19.4595 13.2659 19.4595 13.6847C19.4595 14.1034 19.2886 14.505 18.9845 14.801C18.6804 15.0971 18.2679 15.2635 17.8378 15.2635H14.4724L14.0422 18.6169C13.9888 19.0324 13.7681 19.4103 13.4287 19.6674C13.0892 19.9245 12.6587 20.0397 12.2319 19.9878C11.8051 19.9359 11.417 19.721 11.1529 19.3905C10.8888 19.06 10.7705 18.6408 10.8238 18.2253L11.2032 15.2635H6.90595L6.47568 18.6169C6.42235 19.0324 6.20166 19.4103 5.86217 19.6674C5.52268 19.9245 5.09219 20.0397 4.6654 19.9878C4.23862 19.9359 3.8505 19.721 3.58643 19.3905C3.32236 19.06 3.20397 18.6408 3.2573 18.2253L3.63568 15.2635H1.62162C1.19154 15.2635 0.779075 15.0971 0.474962 14.801C0.170849 14.505 0 14.1034 0 13.6847C0 13.2659 0.170849 12.8643 0.474962 12.5683C0.779075 12.2722 1.19154 12.1058 1.62162 12.1058H4.04108L4.58162 7.89566H2.16216C1.73208 7.89566 1.31962 7.72932 1.0155 7.43323C0.711389 7.13715 0.540541 6.73557 0.540541 6.31684C0.540541 5.89811 0.711389 5.49654 1.0155 5.20045C1.31962 4.90437 1.73208 4.73803 2.16216 4.73803H4.98703L5.41838 1.38462C5.44458 1.17878 5.51219 0.979991 5.61733 0.7996C5.72247 0.619209 5.86309 0.460756 6.03115 0.333296C6.19922 0.205835 6.39143 0.111864 6.59681 0.056753C6.80219 0.00164177 7.0167 -0.0135299 7.22811 0.0121049V0.0142101ZM11.6108 12.1058L12.1514 7.89566H7.85189L7.31135 12.1058H11.6108Z" fill="currentColor"/>`,
    },

    bomb: {
      viewBox: '0 0 20 20',
      fill: true,
      stroke: false,
      content: `<path d="M17.9297 2.03125L19.7266 2.69531C19.9089 2.77344 20 2.91667 20 3.125C19.974 3.30729 19.8828 3.4375 19.7266 3.51562L17.9297 4.17969L17.3047 5.97656C17.2266 6.15885 17.0833 6.25 16.875 6.25C16.6927 6.25 16.5625 6.15885 16.4844 5.97656L15.8203 4.17969L14.0234 3.51562C13.8411 3.4375 13.75 3.30729 13.75 3.125C13.724 2.91667 13.8151 2.77344 14.0234 2.69531L15.8203 2.03125L16.4844 0.273438C16.5625 0.0911458 16.6927 0 16.875 0C17.0573 0 17.2005 0.0911458 17.3047 0.273438L17.9297 2.03125ZM15.8984 7.22656C16.1328 7.48698 16.25 7.78646 16.25 8.125C16.25 8.46354 16.1328 8.76302 15.8984 9.02344L15.7812 9.14062C16.0937 10 16.25 10.8984 16.25 11.8359C16.1979 14.1536 15.4036 16.0807 13.8672 17.6172C12.3307 19.1536 10.4167 19.9479 8.125 20C5.83333 19.9479 3.91927 19.1536 2.38281 17.6172C0.846354 16.0807 0.0520833 14.1536 0 11.8359C0.0520833 9.54427 0.846354 7.63021 2.38281 6.09375C3.91927 4.55729 5.83333 3.76302 8.125 3.71094C9.08854 3.73698 10.013 3.90625 10.8984 4.21875L10.9766 4.10156C11.237 3.86719 11.5365 3.75 11.875 3.75C12.2135 3.75 12.513 3.86719 12.7734 4.10156L15.8984 7.22656ZM8.08594 7.5C8.47656 7.47396 8.6849 7.26562 8.71094 6.875C8.6849 6.48437 8.47656 6.27604 8.08594 6.25H7.77344C6.28906 6.27604 5.03906 6.79687 4.02344 7.8125C3.03385 8.80208 2.51302 10.0521 2.46094 11.5625V11.875C2.51302 12.2656 2.72135 12.474 3.08594 12.5C3.47656 12.474 3.6849 12.2656 3.71094 11.875V11.5625C3.73698 10.4167 4.14062 9.45312 4.92187 8.67187C5.70312 7.91667 6.65365 7.52604 7.77344 7.5H8.08594Z" fill="currentColor"/>`,
    },

    trophyBronze: {
      viewBox: '0 0 20 18',
      fill: true,
      stroke: false,
      content: `<path d="M19.1667 2.25H15.5556V0.84375C15.5556 0.376172 15.184 0 14.7222 0H5.27778C4.81597 0 4.44444 0.376172 4.44444 0.84375V2.25H0.833333C0.371528 2.25 0 2.62617 0 3.09375V5.0625C0 6.31758 0.78125 7.60781 2.14931 8.60273C3.24306 9.40078 4.57292 9.90703 5.96875 10.0687C7.05903 11.9004 8.33333 12.6563 8.33333 12.6563V15.1875H6.66667C5.44097 15.1875 4.44444 15.9152 4.44444 17.1563V17.5781C4.44444 17.8102 4.63194 18 4.86111 18H15.1389C15.3681 18 15.5556 17.8102 15.5556 17.5781V17.1563C15.5556 15.9152 14.559 15.1875 13.3333 15.1875H11.6667V12.6563C11.6667 12.6563 12.941 11.9004 14.0313 10.0687C15.4306 9.90703 16.7604 9.40078 17.8507 8.60273C19.2153 7.60781 20 6.31758 20 5.0625V3.09375C20 2.62617 19.6285 2.25 19.1667 2.25ZM3.44792 6.77813C2.60069 6.15938 2.22222 5.47031 2.22222 5.0625V4.5H4.45139C4.48611 5.64609 4.65278 6.65156 4.89583 7.53047C4.37153 7.34766 3.88194 7.09453 3.44792 6.77813ZM17.7778 5.0625C17.7778 5.62852 17.1632 6.33164 16.5521 6.77813C16.1181 7.09453 15.625 7.34766 15.1007 7.53047C15.3438 6.65156 15.5104 5.64609 15.5451 4.5H17.7778V5.0625Z" fill="#9D7A10"/>`,
    },

    trophySilver: {
      viewBox: '0 0 20 18',
      fill: true,
      stroke: false,
      content: `<path d="M19.1667 2.25H15.5556V0.84375C15.5556 0.376172 15.184 0 14.7222 0H5.27778C4.81597 0 4.44444 0.376172 4.44444 0.84375V2.25H0.833333C0.371528 2.25 0 2.62617 0 3.09375V5.0625C0 6.31758 0.78125 7.60781 2.14931 8.60273C3.24306 9.40078 4.57292 9.90703 5.96875 10.0687C7.05903 11.9004 8.33333 12.6562 8.33333 12.6562V15.1875H6.66667C5.44097 15.1875 4.44444 15.9152 4.44444 17.1562V17.5781C4.44444 17.8102 4.63194 18 4.86111 18H15.1389C15.3681 18 15.5556 17.8102 15.5556 17.5781V17.1562C15.5556 15.9152 14.559 15.1875 13.3333 15.1875H11.6667V12.6562C11.6667 12.6562 12.941 11.9004 14.0313 10.0687C15.4306 9.90703 16.7604 9.40078 17.8507 8.60273C19.2153 7.60781 20 6.31758 20 5.0625V3.09375C20 2.62617 19.6285 2.25 19.1667 2.25ZM3.44792 6.77813C2.60069 6.15938 2.22222 5.47031 2.22222 5.0625V4.5H4.45139C4.48611 5.64609 4.65278 6.65156 4.89583 7.53047C4.37153 7.34766 3.88194 7.09453 3.44792 6.77813ZM17.7778 5.0625C17.7778 5.62852 17.1632 6.33164 16.5521 6.77813C16.1181 7.09453 15.625 7.34766 15.1007 7.53047C15.3438 6.65156 15.5104 5.64609 15.5451 4.5H17.7778V5.0625Z" fill="#CCCCCC"/>`,
    },

    trophyGold: {
      viewBox: '0 0 20 18',
      fill: true,
      stroke: false,
      content: `<path d="M19.1667 2.25H15.5556V0.84375C15.5556 0.376172 15.184 0 14.7222 0H5.27778C4.81597 0 4.44444 0.376172 4.44444 0.84375V2.25H0.833333C0.371528 2.25 0 2.62617 0 3.09375V5.0625C0 6.31758 0.78125 7.60781 2.14931 8.60273C3.24306 9.40078 4.57292 9.90703 5.96875 10.0687C7.05903 11.9004 8.33333 12.6562 8.33333 12.6562V15.1875H6.66667C5.44097 15.1875 4.44444 15.9152 4.44444 17.1562V17.5781C4.44444 17.8102 4.63194 18 4.86111 18H15.1389C15.3681 18 15.5556 17.8102 15.5556 17.5781V17.1562C15.5556 15.9152 14.559 15.1875 13.3333 15.1875H11.6667V12.6562C11.6667 12.6562 12.941 11.9004 14.0313 10.0687C15.4306 9.90703 16.7604 9.40078 17.8507 8.60273C19.2153 7.60781 20 6.31758 20 5.0625V3.09375C20 2.62617 19.6285 2.25 19.1667 2.25ZM3.44792 6.77813C2.60069 6.15938 2.22222 5.47031 2.22222 5.0625V4.5H4.45139C4.48611 5.64609 4.65278 6.65156 4.89583 7.53047C4.37153 7.34766 3.88194 7.09453 3.44792 6.77813ZM17.7778 5.0625C17.7778 5.62852 17.1632 6.33164 16.5521 6.77813C16.1181 7.09453 15.625 7.34766 15.1007 7.53047C15.3438 6.65156 15.5104 5.64609 15.5451 4.5H17.7778V5.0625Z" fill="#EEC858"/>`,
    },

    question: {
      viewBox: '0 0 20 20',
      fill: true,
      stroke: false,
      content: `<path d="M10 0C15.523 0 20 4.477 20 10C20 15.523 15.523 20 10 20C4.477 20 0 15.523 0 10C0 4.477 4.477 0 10 0ZM10 14C9.73478 14 9.48043 14.1054 9.29289 14.2929C9.10536 14.4804 9 14.7348 9 15C9 15.2652 9.10536 15.5196 9.29289 15.7071C9.48043 15.8946 9.73478 16 10 16C10.2652 16 10.5196 15.8946 10.7071 15.7071C10.8946 15.5196 11 15.2652 11 15C11 14.7348 10.8946 14.4804 10.7071 14.2929C10.5196 14.1054 10.2652 14 10 14ZM10 4.5C9.03859 4.5 8.11656 4.88192 7.43674 5.56174C6.75692 6.24156 6.375 7.16359 6.375 8.125C6.375 8.39022 6.48036 8.64457 6.66789 8.83211C6.85543 9.01964 7.10978 9.125 7.375 9.125C7.64022 9.125 7.89457 9.01964 8.08211 8.83211C8.26964 8.64457 8.375 8.39022 8.375 8.125C8.37533 7.83004 8.45594 7.54072 8.60818 7.28809C8.76043 7.03545 8.97856 6.82902 9.2392 6.69092C9.49984 6.55282 9.79316 6.48827 10.0877 6.50419C10.3822 6.52011 10.6669 6.61589 10.9111 6.78127C11.1553 6.94666 11.35 7.1754 11.4741 7.44297C11.5982 7.71054 11.6472 8.00686 11.6157 8.30014C11.5843 8.59342 11.4736 8.87261 11.2955 9.10777C11.1175 9.34292 10.8788 9.52518 10.605 9.635C9.929 9.905 9 10.597 9 11.75V12C9 12.2652 9.10536 12.5196 9.29289 12.7071C9.48043 12.8946 9.73478 13 10 13C10.2652 13 10.5196 12.8946 10.7071 12.7071C10.8946 12.5196 11 12.2652 11 12C11 11.756 11.05 11.634 11.261 11.53L11.348 11.49C12.1288 11.1759 12.776 10.6 13.1787 9.86092C13.5814 9.12188 13.7145 8.26578 13.5551 7.43938C13.3958 6.61299 12.9539 5.86776 12.3052 5.33147C11.6566 4.79518 10.8416 4.50122 10 4.5Z" fill="currentColor"/>`,
    },

    book: {
      viewBox: '0 0 18 20',
      fill: true,
      stroke: false,
      content: `<path d="M15.4286 20H3.85714C1.72768 20 0 18.3203 0 16.25V3.75C0 1.67969 1.72768 0 3.85714 0H16.0714C17.1362 0 18 0.839844 18 1.875V13.125C18 13.9414 17.4616 14.6367 16.7143 14.8945V17.5C17.4254 17.5 18 18.0586 18 18.75C18 19.4414 17.4254 20 16.7143 20H15.4286ZM3.85714 15C3.14598 15 2.57143 15.5586 2.57143 16.25C2.57143 16.9414 3.14598 17.5 3.85714 17.5H14.1429V15H3.85714ZM5.14286 5.9375C5.14286 6.45703 5.57277 6.875 6.10714 6.875H13.1786C13.7129 6.875 14.1429 6.45703 14.1429 5.9375C14.1429 5.41797 13.7129 5 13.1786 5H6.10714C5.57277 5 5.14286 5.41797 5.14286 5.9375ZM6.10714 8.75C5.57277 8.75 5.14286 9.16797 5.14286 9.6875C5.14286 10.207 5.57277 10.625 6.10714 10.625H13.1786C13.7129 10.625 14.1429 10.207 14.1429 9.6875C14.1429 9.16797 13.7129 8.75 13.1786 8.75H6.10714Z" fill="currentColor"/>`,
    },

    stairs: {
      viewBox: '0 0 20 16',
      fill: true,
      stroke: false,
      content: `<path d="M13.3333 1.14286C13.3333 0.510714 13.8299 0 14.4444 0H18.8889C19.5035 0 20 0.510714 20 1.14286C20 1.775 19.5035 2.28571 18.8889 2.28571H15.5556V5.71429C15.5556 6.34643 15.059 6.85714 14.4444 6.85714H11.1111V10.2857C11.1111 10.9179 10.6146 11.4286 10 11.4286H6.66667V14.8571C6.66667 15.4893 6.17014 16 5.55556 16H1.11111C0.496528 16 0 15.4893 0 14.8571C0 14.225 0.496528 13.7143 1.11111 13.7143H4.44444V10.2857C4.44444 9.65357 4.94097 9.14286 5.55556 9.14286H8.88889V5.71429C8.88889 5.08214 9.38542 4.57143 10 4.57143H13.3333V1.14286Z" fill="currentColor"/>`,
    },

    list: {
      viewBox: '0 0 20 17',
      fill: true,
      stroke: false,
      content: `<path d="M5.22801 0.174422C5.65375 0.479102 5.7553 1.08044 5.45845 1.51341L3.27117 4.72057C3.11102 4.95309 2.86105 5.10143 2.58373 5.12548C2.30642 5.14953 2.033 5.05332 1.83771 4.85287L0.275364 3.24929C-0.0878821 2.87245 -0.0878821 2.26309 0.275364 1.88624C0.63861 1.5094 1.23621 1.51341 1.60336 1.88624L2.37672 2.68002L3.92345 0.41095C4.22029 -0.0260262 4.80617 -0.130259 5.22801 0.174422ZM5.22801 6.58875C5.65375 6.89343 5.7553 7.49477 5.45845 7.92774L3.27117 11.1349C3.11102 11.3674 2.86105 11.5158 2.58373 11.5398C2.30642 11.5639 2.033 11.4676 1.83771 11.2672L0.275364 9.66361C-0.0917879 9.28677 -0.0917879 8.67741 0.275364 8.30458C0.642515 7.93175 1.23621 7.92774 1.59945 8.30458L2.37282 9.09835L3.91954 6.82928C4.21639 6.39231 4.80227 6.28808 5.2241 6.59276L5.22801 6.58875ZM8.7511 2.56777C8.7511 1.85818 9.30964 1.2849 10.001 1.2849H18.7501C19.4415 1.2849 20 1.85818 20 2.56777C20 3.27735 19.4415 3.85063 18.7501 3.85063H10.001C9.30964 3.85063 8.7511 3.27735 8.7511 2.56777ZM8.7511 8.98209C8.7511 8.27251 9.30964 7.69923 10.001 7.69923H18.7501C19.4415 7.69923 20 8.27251 20 8.98209C20 9.69168 19.4415 10.265 18.7501 10.265H10.001C9.30964 10.265 8.7511 9.69168 8.7511 8.98209ZM6.25134 15.3964C6.25134 14.6868 6.80988 14.1136 7.50122 14.1136H18.7501C19.4415 14.1136 20 14.6868 20 15.3964C20 16.106 19.4415 16.6793 18.7501 16.6793H7.50122C6.80988 16.6793 6.25134 16.106 6.25134 15.3964ZM2.50171 13.7928C3.36491 13.7928 4.06406 14.5104 4.06406 15.3964C4.06406 16.2824 3.36491 17 2.50171 17C1.63851 17 0.939361 16.2824 0.939361 15.3964C0.939361 14.5104 1.63851 13.7928 2.50171 13.7928Z" fill="currentColor"/>`,
    },

    level: {
      viewBox: '0 0 19 20',
      fill: true,
      stroke: false,
      content: `<path d="M1.97431 15.7628H4.761V12.8285C4.761 12.4701 5.03808 12.1783 5.37929 12.1783H8.16598V9.24404C8.16598 8.88393 8.44306 8.59133 8.78427 8.59133H11.571V5.65789C11.571 5.29777 11.848 5.00601 12.19 5.00601H14.9759V2.07257C14.9759 1.71246 15.253 1.4207 15.595 1.4207H18.3817C18.7221 1.4207 19 1.71246 19 2.07257V19.3481C19 19.7082 18.7229 20 18.3809 20H1.97431C1.89296 20.0002 1.81236 19.9835 1.73715 19.9508C1.66195 19.9181 1.59362 19.8701 1.53609 19.8096C1.47856 19.749 1.43297 19.677 1.40193 19.5978C1.37089 19.5187 1.35502 19.4338 1.35523 19.3481V16.4138C1.35523 16.0554 1.63231 15.7628 1.97431 15.7628ZM0.136054 13.2745C0.0489385 13.1827 0 13.0583 0 12.9286C0 12.7988 0.0489385 12.6744 0.136054 12.5826L11.9557 0.136949C12.0434 0.0479973 12.1607 -0.00117014 12.2825 2.11536e-05C12.4042 0.00121245 12.5207 0.0526673 12.6067 0.14332C12.6928 0.233972 12.7417 0.356581 12.7428 0.484777C12.744 0.612973 12.6973 0.736517 12.6128 0.828838L0.793141 13.2745C0.611057 13.4662 0.318138 13.4662 0.136054 13.2745Z" fill="currentColor"/>`,
    },

    // ── 28x28 GAMEPLAY ICONS (Figma Gameplay28X) ──────────────

    gameBack: {
      viewBox: '0 0 28 18.6667',
      fill: true,
      stroke: false,
      content: `<path d="M28 3.11111C28 1.39514 26.6049 0 24.8889 0H9.97986C9.15347 0 8.36111 0.325694 7.77778 0.909028L0.456944 8.23472C0.165278 8.52639 0 8.92014 0 9.33333C0 9.74653 0.165278 10.1403 0.456944 10.4319L7.77778 17.7576C8.36111 18.341 9.15347 18.6667 9.97986 18.6667H24.8889C26.6049 18.6667 28 17.2715 28 15.5556V3.11111ZM13.8104 6.03264C14.2674 5.57569 15.0063 5.57569 15.4583 6.03264L17.1062 7.68056L18.7542 6.03264C19.2111 5.57569 19.95 5.57569 20.4021 6.03264C20.8542 6.48958 20.859 7.22847 20.4021 7.68056L18.7542 9.32847L20.4021 10.9764C20.859 11.4333 20.859 12.1722 20.4021 12.6243C19.9451 13.0764 19.2062 13.0812 18.7542 12.6243L17.1062 10.9764L15.4583 12.6243C15.0014 13.0812 14.2625 13.0812 13.8104 12.6243C13.3583 12.1674 13.3535 11.4285 13.8104 10.9764L15.4583 9.32847L13.8104 7.68056C13.3535 7.22361 13.3535 6.48472 13.8104 6.03264Z" fill="currentColor"/>`,
    },

    gameRefresh: {
      viewBox: '0 0 23.3333 23.3333',
      fill: true,
      stroke: false,
      content: `<path d="M21.7778 0C22.2315 0 22.6042 0.145833 22.8958 0.4375C23.1875 0.729167 23.3333 1.10185 23.3333 1.55556V8.55556C23.3333 9.00926 23.1875 9.38194 22.8958 9.67361C22.6042 9.96528 22.2315 10.1111 21.7778 10.1111H15.5556C15.1019 10.1111 14.7292 9.96528 14.4375 9.67361C14.1458 9.38194 14 9.00926 14 8.55556C14 8.10185 14.1458 7.72917 14.4375 7.4375C14.7292 7.14583 15.1019 7 15.5556 7H17.6944C17.0139 6.02778 16.1551 5.2662 15.1181 4.71528C14.0486 4.16435 12.8981 3.88889 11.6667 3.88889C10.0139 3.9213 8.55556 4.3912 7.29167 5.29861C6.02778 6.23843 5.12037 7.48611 4.56944 9.04167C4.43982 9.46296 4.19676 9.77083 3.84028 9.96528C3.45139 10.1273 3.0463 10.1435 2.625 10.0139C2.2037 9.88426 1.91204 9.6412 1.75 9.28472C1.55556 8.89583 1.52315 8.49074 1.65278 8.06944C2.39815 5.86574 3.66204 4.09954 5.44445 2.77083C7.25926 1.47454 9.33333 0.810185 11.6667 0.777778C13.4167 0.777778 15.037 1.16667 16.5278 1.94444C18.0185 2.72222 19.25 3.79167 20.2222 5.15278V1.55556C20.2222 1.10185 20.3681 0.729167 20.6597 0.4375C20.9514 0.145833 21.3241 0 21.7778 0ZM20.7083 13.3194C21.1296 13.4167 21.4213 13.6597 21.5833 14.0486C21.7778 14.4375 21.8102 14.8426 21.6806 15.2639C20.9028 17.4676 19.6227 19.2338 17.8403 20.5625C16.0255 21.8588 13.9514 22.5231 11.6181 22.5556C9.90046 22.5556 8.2963 22.1667 6.80556 21.3889C5.34722 20.6111 4.11574 19.5417 3.11111 18.1806V21.7778C3.11111 22.2315 2.96528 22.6042 2.67361 22.8958C2.38194 23.1875 2.00926 23.3333 1.55556 23.3333C1.10185 23.3333 0.729167 23.1875 0.4375 22.8958C0.145833 22.6042 0 22.2315 0 21.7778V14.7778C0 14.3241 0.145833 13.9514 0.4375 13.6597C0.729167 13.3681 1.10185 13.2222 1.55556 13.2222H7.77778C8.23148 13.2222 8.60417 13.3681 8.89583 13.6597C9.1875 13.9514 9.33333 14.3241 9.33333 14.7778C9.33333 15.2315 9.1875 15.6042 8.89583 15.8958C8.60417 16.1875 8.23148 16.3333 7.77778 16.3333H5.63889C6.31945 17.3056 7.17824 18.0671 8.21528 18.6181C9.28472 19.169 10.4352 19.4444 11.6667 19.4444C13.3194 19.412 14.7778 18.9421 16.0417 18.0347C17.3056 17.0949 18.213 15.8472 18.7639 14.2917C18.8935 13.8704 19.1366 13.5787 19.4931 13.4167C19.8819 13.2222 20.287 13.1898 20.7083 13.3194Z" fill="currentColor"/>`,
    },

    gameRedo: {
      viewBox: '0 0 23.3981 22.1667',
      fill: true,
      stroke: false,
      content: `<path d="M11.6991 2.77083C9.10334 2.77083 6.7681 3.8402 5.15947 5.54167H7.31192C8.1208 5.54167 8.77431 6.16077 8.77431 6.92708C8.77431 7.69339 8.1208 8.3125 7.31192 8.3125H1.46238C0.653503 8.3125 0 7.69339 0 6.92708V1.38542C0 0.619108 0.653503 0 1.46238 0C2.27127 0 2.92477 0.619108 2.92477 1.38542V3.75361C5.06808 1.45469 8.20306 0 11.6991 0C18.161 0 23.3981 4.96152 23.3981 11.0833C23.3981 17.2051 18.161 22.1667 11.6991 22.1667C7.72322 22.1667 4.20892 20.2877 2.09761 17.4173C1.63604 16.7895 1.79599 15.928 2.45863 15.4864C3.12128 15.0448 4.0307 15.2006 4.49683 15.8284C6.08717 17.9844 8.71947 19.3915 11.6991 19.3915C16.5432 19.3915 20.4734 15.6682 20.4734 11.079C20.4734 6.48981 16.5432 2.77083 11.6991 2.77083Z" fill="currentColor"/>`,
    },

    gameCross: {
      viewBox: '0 0 22 22',
      fill: true,
      stroke: false,
      content: `<path d="M18.4794 0.604109C19.2848 -0.201333 20.5904 -0.20126 21.3959 0.604109C22.2014 1.40959 22.2014 2.71512 21.3959 3.5206L13.9161 10.9996L21.3959 18.4794C22.2014 19.2849 22.2014 20.5904 21.3959 21.3959C20.5904 22.2014 19.2849 22.2014 18.4794 21.3959L10.9996 13.9161L3.5206 21.3959C2.71512 22.2014 1.40959 22.2014 0.604109 21.3959C-0.20126 20.5904 -0.201333 19.2848 0.604109 18.4794L8.08307 10.9996L0.604109 3.5206C-0.20137 2.71512 -0.20137 1.40959 0.604109 0.604109C1.40959 -0.20137 2.71512 -0.20137 3.5206 0.604109L10.9996 8.08307L18.4794 0.604109Z" fill="currentColor"/>`,
    },

    gamePen: {
      viewBox: '0 0 24 24',
      fill: true,
      stroke: false,
      content: `<path d="M1.70518 16.582C1.89738 15.8977 2.25833 15.2744 2.76461 14.7682L11.2588 6.27566L12.8479 4.68682C13.6261 5.46484 15.2527 7.09117 17.7231 9.56112L19.3123 11.15L17.7231 12.7388L9.22898 21.2313C8.72739 21.7328 8.09924 22.0984 7.41483 22.2905L1.42392 23.959C1.03484 24.0668 0.61294 23.9591 0.326989 23.6685C0.0410375 23.3779 -0.0667801 22.9608 0.0410376 22.5717L1.70518 16.582ZM4.31156 16.4086C4.1053 16.6289 3.95529 16.896 3.8756 17.1866L2.74585 21.2594L6.81949 20.1299C7.1195 20.0456 7.39139 19.8909 7.6164 19.6753L4.30687 16.4086H4.31156ZM20.9061 9.56112C20.1279 8.78311 18.5013 7.15678 16.0309 4.68682L14.437 3.09799C15.6793 1.85598 16.3778 1.15765 16.5418 0.993607C17.1747 0.356199 18.0372 0 18.9373 0C19.8373 0 20.6998 0.356199 21.3327 0.993607L23.0062 2.6668C23.6437 3.30421 24 4.16659 24 5.06177C24 5.95695 23.6437 6.82402 23.0062 7.45674C22.8421 7.62078 22.1437 8.31911 20.9014 9.56112H20.9061Z" fill="currentColor"/>`,
    },

    gameLightBulb: {
      viewBox: '0 0 19 26',
      fill: true,
      stroke: false,
      content: `<path d="M14.4924 18.9091C14.8536 17.811 15.576 16.8163 16.3924 15.9595C18.0104 14.2655 19 11.9758 19 9.45455C19 4.23485 14.7448 0 9.5 0C4.25521 0 0 4.23485 0 9.45455C0 11.9758 0.989583 14.2655 2.60755 15.9595C3.42396 16.8163 4.1513 17.811 4.50755 18.9091H14.4875H14.4924ZM14.25 21.2727H4.75V22.0606C4.75 24.2371 6.52135 26 8.70833 26H10.2917C12.4786 26 14.25 24.2371 14.25 22.0606V21.2727ZM9.10417 5.51515C7.1349 5.51515 5.54167 7.10076 5.54167 9.06061C5.54167 9.71553 5.01224 10.2424 4.35417 10.2424C3.69609 10.2424 3.16667 9.71553 3.16667 9.06061C3.16667 5.79583 5.8237 3.15152 9.10417 3.15152C9.76224 3.15152 10.2917 3.67841 10.2917 4.33333C10.2917 4.98826 9.76224 5.51515 9.10417 5.51515Z" fill="currentColor"/>`,
    },

    gameFlag: {
      viewBox: '0 0 20 20',
      fill: true,
      stroke: false,
      content: `<path d="M2.5 19.375V1.25C2.5 0.885417 2.38281 0.585938 2.14844 0.351563C1.91406 0.117188 1.61458 0 1.25 0C0.885417 0 0.585938 0.117188 0.351563 0.351563C0.117188 0.585938 0 0.885417 0 1.25V19.375C0.0260417 19.7656 0.234375 19.974 0.625 20H1.875C2.26563 19.974 2.47396 19.7656 2.5 19.375ZM18.5937 0C18.9844 0 19.3099 0.104167 19.5703 0.3125C19.8568 0.520833 20 0.820313 20 1.21094V12.9687C19.974 13.4896 19.7005 13.8672 19.1797 14.1016C17.513 14.7266 16.0547 15.026 14.8047 15C13.4245 14.9479 12.1354 14.7396 10.9375 14.375C9.76563 14.0104 8.47656 13.8021 7.07031 13.75C6.10677 13.75 5 13.9323 3.75 14.2969V0.625C5.13021 0.208333 6.28906 0 7.22656 0C8.58073 0.078125 9.72656 0.299479 10.6641 0.664063C11.5495 1.0026 12.5391 1.19792 13.6328 1.25C14.7005 1.30208 16.1068 0.9375 17.8516 0.15625C18.112 0.0520833 18.3594 0 18.5937 0Z" fill="currentColor"/>`,
    },

    gameSquare: {
      viewBox: '0 0 24 24',
      fill: true,
      stroke: false,
      content: `<path d="M0 3.92719C0 1.75826 1.75826 0 3.92719 0H20.0728C22.2417 0 24 1.75826 24 3.92719V20.0728C24 22.2417 22.2417 24 20.0728 24H3.92719C1.75826 24 0 22.2417 0 20.0728V3.92719Z" fill="currentColor"/>`,
    },

    gameEnter: {
      viewBox: '0 0 24.585 18.3052',
      fill: true,
      stroke: false,
      content: `<path d="M6.15723 5.59668C6.68566 5.06824 7.54187 5.06824 8.07031 5.59668C8.59857 6.12513 8.59869 6.98139 8.07031 7.50977L5.18066 10.3994H21.1523C21.5536 10.3994 21.8789 10.0741 21.8789 9.67285V1.35352C21.8789 0.606191 22.4851 0 23.2324 0C23.9796 0.000147345 24.585 0.606282 24.585 1.35352V9.67285C24.5849 11.5688 23.0483 13.1055 21.1523 13.1055H5.18066L8.07031 15.9951C8.59875 16.5236 8.59875 17.3807 8.07031 17.9092C7.54198 18.4373 6.68563 18.4372 6.15723 17.9092L0 11.7529L6.15723 5.59668Z" fill="currentColor"/>`,
    },

    // ── 14x14 SMALL ICONS (Figma Small14X) ───────────────────

    themeLight: {
      viewBox: '0 0 14 14',
      fill: true,
      stroke: false,
      content: `<g>
<path d="M7 10.8525C7.3595 10.8526 7.65124 11.1444 7.65137 11.5039V13.3486C7.65137 13.7082 7.35958 13.9999 7 14C6.64037 14 6.34863 13.7083 6.34863 13.3486V11.5039C6.34876 11.1444 6.64045 10.8525 7 10.8525Z" fill="currentColor"/>
<path d="M3.35449 9.72461C3.60879 9.47031 4.02109 9.47031 4.27539 9.72461C4.52964 9.97891 4.52967 10.3912 4.27539 10.6455L2.9707 11.9502C2.7164 12.2042 2.30401 12.2044 2.0498 11.9502C1.79561 11.696 1.7958 11.2836 2.0498 11.0293L3.35449 9.72461Z" fill="currentColor"/>
<path d="M9.72461 9.72461C9.97891 9.47031 10.3912 9.47031 10.6455 9.72461L11.9502 11.0293C12.204 11.2836 12.2043 11.696 11.9502 11.9502C11.696 12.2043 11.2836 12.204 11.0293 11.9502L9.72461 10.6455C9.47032 10.3912 9.47034 9.97891 9.72461 9.72461Z" fill="currentColor"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M6.89063 4.34082C8.38886 4.34082 9.60414 5.55555 9.60449 7.05371L9.58984 7.33105C9.45106 8.69937 8.29555 9.76758 6.89063 9.76758L6.61328 9.75293C5.24548 9.61366 4.17773 8.45827 4.17773 7.05371C4.17809 5.5558 5.39272 4.34121 6.89063 4.34082ZM6.89063 5.74121C6.16592 5.7416 5.57848 6.32899 5.57813 7.05371C5.57813 7.77873 6.1657 8.36679 6.89063 8.36719C7.61588 8.36719 8.2041 7.77897 8.2041 7.05371C8.20375 6.32875 7.61567 5.74121 6.89063 5.74121Z" fill="currentColor"/>
<path d="M2.49609 6.34863C2.85561 6.34866 3.14732 6.64051 3.14746 7C3.14746 7.35961 2.8557 7.65134 2.49609 7.65137H0.651367C0.291737 7.65137 -1.57199e-08 7.35963 0 7C0.00014362 6.64049 0.291826 6.34863 0.651367 6.34863H2.49609Z" fill="currentColor"/>
<path d="M13.3486 6.34863C13.7082 6.34863 13.9999 6.6405 14 7C14 7.35963 13.7083 7.65137 13.3486 7.65137H11.5039C11.1443 7.65137 10.8525 7.35963 10.8525 7C10.8527 6.6405 11.1444 6.34863 11.5039 6.34863H13.3486Z" fill="currentColor"/>
<path d="M2.0498 2.0498C2.30398 1.79563 2.71638 1.79588 2.9707 2.0498L4.27539 3.35449C4.52969 3.60879 4.52969 4.02109 4.27539 4.27539C4.02109 4.52963 3.60877 4.52967 3.35449 4.27539L2.0498 2.9707C1.7959 2.7164 1.79569 2.30398 2.0498 2.0498Z" fill="currentColor"/>
<path d="M11.0283 2.0498C11.2825 1.79566 11.6949 1.79596 11.9492 2.0498C12.2035 2.3041 12.2035 2.71641 11.9492 2.9707L10.6455 4.27539C10.3912 4.52967 9.97891 4.52965 9.72461 4.27539C9.47031 4.02109 9.47031 3.60879 9.72461 3.35449L11.0283 2.0498Z" fill="currentColor"/>
<path d="M7 0C7.35957 6.80878e-05 7.65137 0.291779 7.65137 0.651367V2.49609C7.65137 2.85568 7.35957 3.14739 7 3.14746C6.64037 3.14746 6.34863 2.85572 6.34863 2.49609V0.651367C6.34863 0.291737 6.64037 0 7 0Z" fill="currentColor"/>
</g>`,
    },

    themeAutomatic: {
      viewBox: '0 0 11 12',
      fill: true,
      stroke: false,
      content: `<path fill-rule="evenodd" clip-rule="evenodd" d="M0 12L4.71176 0H6.28824L11 12H9.32609L8.04434 8.56549H2.95566L1.67391 12H0ZM5.57085 1.93763L7.56951 7.29314H3.43049L5.42915 1.93763H5.57085Z" fill="currentColor"/>`,
    },

    themeDark: {
      viewBox: '0 0 11 12',
      fill: true,
      stroke: false,
      content: `<path d="M10.7173 9.32143C10.8273 9.32143 10.9097 9.36608 10.9647 9.45537C11.0196 9.5625 11.0105 9.66964 10.9372 9.77679C10.3509 10.4732 9.64561 11.0179 8.82119 11.4107C7.99678 11.8036 7.10826 12 6.1556 12C5.00142 11.9821 3.96634 11.7054 3.05032 11.1696C2.11598 10.6518 1.38318 9.93751 0.851891 9.02679C0.302285 8.13393 0.0183202 7.12501 0 6C0.0183202 4.87499 0.302285 3.86608 0.851891 2.97321C1.4015 2.06249 2.13432 1.33929 3.05032 0.803572C3.98465 0.267857 5.02891 0 6.18308 0C6.34797 0 6.53117 0.00892864 6.73269 0.0267857C6.95254 0.0446429 7.14489 0.0714286 7.30978 0.107143C7.43803 0.142857 7.5113 0.214285 7.52961 0.321428C7.54795 0.446429 7.50214 0.544644 7.39221 0.616072C6.62277 1.04464 6.02736 1.625 5.60599 2.35715C5.18463 3.07143 4.96478 3.85715 4.94647 4.71429C4.9831 6.05358 5.45943 7.16072 6.37545 8.03571C7.27313 8.92857 8.39068 9.38393 9.72806 9.40179C10.0395 9.40179 10.3509 9.37501 10.6624 9.32143C10.6807 9.32143 10.699 9.32143 10.7173 9.32143ZM6.1556 10.7143C6.74185 10.7143 7.30979 10.6161 7.85938 10.4197C6.61361 10.0089 5.59683 9.29464 4.80907 8.2768C4.02129 7.25894 3.61825 6.07144 3.59993 4.71429C3.61825 3.55357 3.92969 2.5 4.53425 1.55357C3.58162 1.89286 2.81215 2.46429 2.2259 3.26786C1.63966 4.05357 1.33738 4.96428 1.31906 6C1.3557 7.3393 1.83202 8.44643 2.74804 9.32143C3.64573 10.2143 4.78159 10.6786 6.1556 10.7143Z" fill="currentColor"/>`,
    },

    arrowLeft: {
      viewBox: '0 0 11.3996 10.7',
      fill: true,
      stroke: false,
      content: `<path d="M5.19845 0.153605C5.37456 -0.0048029 5.62756 -0.0443322 5.84395 0.0520429C6.06036 0.14846 6.19942 0.362978 6.19942 0.599894V3.1995H10.8C11.1313 3.19958 11.3996 3.46877 11.3996 3.80009V6.6995C11.3996 7.03083 11.1313 7.30001 10.8 7.30009H6.19942V10.0999C6.19942 10.3426 6.05351 10.5617 5.8293 10.6546C5.60516 10.7473 5.34751 10.6953 5.17598 10.5237L0.175984 5.52372C0.0596261 5.40736 -0.00408336 5.24877 0.000203152 5.08427C0.00453033 4.91972 0.0760952 4.76372 0.198445 4.65361L5.19845 0.153605ZM1.47091 5.12333L5.0002 8.65263V6.09989H10.1994V4.3997H5.0002V1.94657L1.47091 5.12333Z" fill="currentColor"/>`,
    },

    arrowRight: {
      viewBox: '0 0 11.3996 10.7',
      fill: true,
      stroke: false,
      content: `<g transform="translate(11.3996,0) scale(-1,1)"><path d="M5.19845 0.153605C5.37456 -0.0048029 5.62756 -0.0443322 5.84395 0.0520429C6.06036 0.14846 6.19942 0.362978 6.19942 0.599894V3.1995H10.8C11.1313 3.19958 11.3996 3.46877 11.3996 3.80009V6.6995C11.3996 7.03083 11.1313 7.30001 10.8 7.30009H6.19942V10.0999C6.19942 10.3426 6.05351 10.5617 5.8293 10.6546C5.60516 10.7473 5.34751 10.6953 5.17598 10.5237L0.175984 5.52372C0.0596261 5.40736 -0.00408336 5.24877 0.000203152 5.08427C0.00453033 4.91972 0.0760952 4.76372 0.198445 4.65361L5.19845 0.153605ZM1.47091 5.12333L5.0002 8.65263V6.09989H10.1994V4.3997H5.0002V1.94657L1.47091 5.12333Z" fill="currentColor"/></g>`,
    },

  };

  const SIZE_CLASSES = {
    xs:   'icon icon--xs',
    sm:   'icon icon--sm',
    md:   'icon icon--md',
    lg:   'icon icon--lg',
    xl:   'icon icon--xl',
    game: 'icon icon--game',
    tiny: 'icon icon--tiny',
  };

  const COLOR_CLASSES = {
    'default':    'icon--default',
    'muted':      'icon--muted',
    'accent':     'icon--accent',
    'on-primary': 'icon--on-primary',
    'primary':    'icon--primary',
    'error':      'icon--error',
    'warning':    'icon--warning',
    'tertiary':   'icon--tertiary',
  };

  function get(name, size = 'md', color = 'default', state = 'default', ariaLabel = null) {
    const sprite = SPRITES[name];
    if (!sprite) {
      console.warn(`Icons.get: unknown icon "${name}". Available: ${Object.keys(SPRITES).join(', ')}`);
      return '';
    }
    const sizeClass  = SIZE_CLASSES[size]   ?? SIZE_CLASSES.md;
    const colorClass = COLOR_CLASSES[color] ?? COLOR_CLASSES.default;
    const stateClass = state !== 'default'  ? `icon--${state}` : '';
    const classAttr  = [sizeClass, colorClass, stateClass].filter(Boolean).join(' ');
    const fillAttr   = sprite.fill   ? 'fill="currentColor"' : 'fill="none"';
    const strokeAttr = sprite.stroke
      ? `stroke="currentColor" stroke-width="var(--icon-stroke-${size})" stroke-linecap="round" stroke-linejoin="round"`
      : '';
    const a11y = ariaLabel
      ? `role="img" aria-label="${ariaLabel}"`
      : 'aria-hidden="true"';
    return `<svg class="${classAttr}" viewBox="${sprite.viewBox}" ${fillAttr} ${strokeAttr} ${a11y} xmlns="http://www.w3.org/2000/svg">${sprite.content}</svg>`;
  }

  function render(el, name, opts = {}) {
    if (!el) { console.warn(`Icons.render: target element not found for icon "${name}"`); return; }
    el.innerHTML = get(name, opts.size ?? 'md', opts.color ?? 'default', opts.state ?? 'default', opts.ariaLabel ?? null);
  }

  function list() { return Object.keys(SPRITES); }

  return { get, render, list };
})();
// ── INTERNAL TESTING CHALLENGES ─────────────────────────────
// 7 simple challenges — score-based or merge-based only.
// No modifiers (no timer, no chains, no special dice).
const DEFAULT_CHALLENGE = {
  label:       "Internal Test",
  flavor:      "Reach the score target before the board fills.",
  target:      250,
  modifier:    null,
  modValue:    null,
  bonusTarget: null,
  difficulty:  "medium",
  winType:     "scoreTarget",
};

const IT_CHALLENGE_KEYS = ['it-1','it-2','it-3','it-4','it-5','it-6','it-7'];

const CHALLENGES = {
  "it-1": { label: "Warm Up",       flavor: "Ease in with a modest score target.",                    target: 180, modifier: null, modValue: null, bonusTarget: 240, difficulty: "easy",   winType: "scoreTarget"   },
  "it-2": { label: "Tight Merges",  flavor: "Hit the score within twelve merges.",                    target: 200, modifier: "maxMerges", modValue: 12, bonusTarget: 260, difficulty: "easy",   winType: "scoreInMerges" },
  "it-3": { label: "Steady Climb",  flavor: "Build your score calmly and reach the target.",          target: 260, modifier: null, modValue: null, bonusTarget: 330, difficulty: "medium", winType: "scoreTarget"   },
  "it-4": { label: "Efficient Ten", flavor: "Score your target within ten efficient merges.",         target: 240, modifier: "maxMerges", modValue: 10, bonusTarget: 310, difficulty: "medium", winType: "scoreInMerges" },
  "it-5": { label: "Push It",       flavor: "Push hard and hit the bigger score target.",             target: 320, modifier: null, modValue: null, bonusTarget: 400, difficulty: "hard",   winType: "scoreTarget"   },
  "it-6": { label: "Merge Master",  flavor: "Hit the score in just eight merges.",                    target: 260, modifier: "maxMerges", modValue: 8,  bonusTarget: 330, difficulty: "hard",   winType: "scoreInMerges" },
  "it-7": { label: "Final Run",     flavor: "Top run — reach the biggest score to close it out.",     target: 380, modifier: null, modValue: null, bonusTarget: 460, difficulty: "hard",   winType: "scoreTarget"   },
};

// Session-scoped set of challenge keys the user has already played (any outcome).
const IT_PLAYED = new Set();

function itPickRandomUnplayed() {
  const unplayed = IT_CHALLENGE_KEYS.filter(k => !IT_PLAYED.has(k));
  if (unplayed.length === 0) return null;
  return unplayed[Math.floor(Math.random() * unplayed.length)];
}
function itUnplayedCount() {
  return IT_CHALLENGE_KEYS.filter(k => !IT_PLAYED.has(k)).length;
}

function getTodayChallenge() {
  // Internal test: entry challenge picked at DOMContentLoaded
  return DEFAULT_CHALLENGE;
}
/* ============================================================
   DOBBELAAR — Game logic
   Requires: icons.js + game-utils.js loaded first.
   ============================================================ */

// ── TUTORIAL STEPS ──────────────────────────────────────────
const TUTORIAL_STEPS = [
  { title: 'Place your dice',           desc: 'You get 1 or 2 dice each turn. Drag them on an empty cell to place them on the grid.',                             icon: '🎲' },
  { title: 'Rotate and match',          desc: 'Rotate your dice by tapping on them once. Place the matching dice next to each other.',                             icon: '🔄' },
  { title: 'Merge and score',            desc: 'You score points merging three or more similar dice. They merge into their sum, or disappear if the total is over 6.',  icon: '✨' },
  { title: 'Parking spot',              desc: 'Rotate your piece or stash it in the parking spot to play something else first.',                                    icon: '🅿️' },
];

// ── DIE RENDERING ───────────────────────────────────────────
const PIP_POSITIONS = {
  1: [[50,50]],
  2: [[30,30],[70,70]],
  3: [[30,30],[50,50],[70,70]],
  4: [[30,30],[70,30],[30,70],[70,70]],
  5: [[30,30],[70,30],[50,50],[30,70],[70,70]],
  6: [[30,25],[70,25],[30,50],[70,50],[30,75],[70,75]],
};

function renderDie(value) {
  if (value === WILD_DIE) {
    return `<div class="db-die db-die--wild"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="var(--color-error)"/></svg></div>`;
  }
  const pips = (PIP_POSITIONS[value] || []).map(([x,y]) =>
    `<circle cx="${x}%" cy="${y}%" r="9%"/>`
  ).join('');
  return `<div class="db-die db-die--${value}"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${pips}</svg></div>`;
}

// ── GAME CONSTANTS ───────────────────────────────────────────
const GRID_ROWS    = 5;
const GRID_COLS    = 5;
const todayChallenge      = getTodayChallenge();
const TODAY_ISO           = new Date().toISOString().slice(0, 10);
let   activeChallenge     = todayChallenge;
let   activeChallengeDate = TODAY_ISO;
let   playingDate         = TODAY_ISO; // date of the currently active game (set when game starts)

// ── SENTINEL VALUES ──────────────────────────────────────────
const NULL_BLOCK   = -1;  // permanent grey blocker (placed randomly)
const FROZEN_CELL  = -2;  // permanent icy blocker (placed at fixed positions)
const FLIP_DIE     = -3;  // flip die: inverts neighbour values when triggered
const BOMB_DIE     = -4;  // bomb die: countdown fuse, detonates on 0
const DISEASED_DIE = -5;  // diseased die: infects adjacent placed dice → value 6
const WILD_DIE     =  7;  // wild die (spawner only): joins any merge group

// ── SOUND DEFINITIONS ────────────────────────────────────────
// Registered immediately — SoundUtils.setEnabled() applied in DOMContentLoaded
// from localStorage so no sounds fire before the preference is read.
SoundUtils.register([
  // GAMEPLAY
  { id: 'die-place',   params: { freq: 260, duration: 0.14, gain: 0.18, type: 'sine', sweep: 320 }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, sweep: p.sweep, attack: 0.007 });
      synth({ freq: p.freq * 2, duration: p.duration * 0.55, gain: p.gain * 0.22, type: 'sine', attack: 0.007 });
    } },
  { id: 'die-rotate',  params: { freq: 560, duration: 0.11, gain: 0.2, type: 'sine' }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, sweep: p.freq * 1.3, attack: 0.003 });
      synth({ freq: p.freq * 1.5, duration: p.duration * 0.55, gain: p.gain * 0.35, type: 'sine', attack: 0.003 });
    } },
  { id: 'die-park',    params: { freq: 480, duration: 0.09, gain: 0.10, type: 'sine', sweep: 420 }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, sweep: p.sweep, attack: 0.005 });
    } },
  { id: 'merge',       params: { freq: 520, duration: 0.20, gain: 0.20, type: 'sine' }, extras: { depth: 1 },
    fn(p, e, synth) {
      const d = e.depth || 1;
      const f = p.freq + (d - 1) * 100;
      const g = Math.min(p.gain + (d - 1) * 0.02, 0.34);
      synth({ freq: f,        duration: p.duration,        gain: g,        type: p.type, attack: 0.010, sweep: f * 1.06 });
      synth({ freq: f * 1.50, duration: p.duration * 0.55, gain: g * 0.28, type: p.type, attack: 0.010 });
    } },
  { id: 'merge-clear', params: { freq: 660, duration: 0.30, gain: 0.17, type: 'sine' }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq,        duration: p.duration,        gain: p.gain,        type: p.type, attack: 0.010, sweep: p.freq * 1.03 });
      synth({ freq: p.freq * 1.25, duration: p.duration * 0.80, gain: p.gain * 0.65, type: p.type, attack: 0.010 });
      synth({ freq: p.freq * 1.50, duration: p.duration * 0.60, gain: p.gain * 0.48, type: p.type, attack: 0.010 });
      synth({ freq: p.freq * 2.00, duration: p.duration * 0.35, gain: p.gain * 0.25, type: 'triangle', attack: 0.005, delay: 0.05 });
    } },
  { id: 'six-spawn',   params: { freq: 220, duration: 0.20, gain: 0.16, type: 'sine', sweep: 200 }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq,        duration: p.duration,        gain: p.gain * 0.55, type: p.type,     sweep: p.sweep, attack: 0.008 });
      synth({ freq: p.freq * 2.25, duration: p.duration * 0.55, gain: p.gain * 0.42, type: 'triangle', attack: 0.012, delay: 0.06 });
    } },
  // MODIFIERS
  { id: 'bomb-tick',     params: { freq: 660, duration: 0.04, gain: 0.11, type: 'sine' }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, sweep: p.freq * 0.85, attack: 0.002 });
    } },
  { id: 'bomb-urgent',   params: { freq: 880, duration: 0.05, gain: 0.18, type: 'sine' }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq,       duration: p.duration,       gain: p.gain,        type: p.type, sweep: p.freq * 0.88, attack: 0.002 });
      synth({ freq: p.freq * 1.5, duration: p.duration * 0.8, gain: p.gain * 0.65, type: p.type, sweep: p.freq * 1.2,  attack: 0.002, delay: 0.09 });
    } },
  { id: 'bomb-detonate', params: { freq: 90, duration: 0.55, gain: 0.24, type: 'triangle', sweep: 28 }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration,        gain: p.gain,        type: p.type,     sweep: p.sweep, attack: 0.003 });
      synth({ freq: 240,    duration: p.duration * 0.50, gain: p.gain * 0.45, type: 'sine',     sweep: 90,      attack: 0.003 });
      synth({ freq: 580,    duration: 0.16,              gain: 0.10,          type: 'triangle', sweep: 180,     attack: 0.002, delay: 0.02 });
    } },
  { id: 'flip-trigger',  params: { freq: 400, duration: 0.13, gain: 0.15, type: 'sine' }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq,       duration: p.duration, gain: p.gain,        type: p.type, sweep: p.freq * 1.9, attack: 0.005 });
      synth({ freq: p.freq * 1.9, duration: p.duration, gain: p.gain * 0.75, type: p.type, sweep: p.freq * 0.8, attack: 0.005, delay: p.duration * 0.85 });
    } },
  { id: 'disease-infect', params: { freq: 420, duration: 0.30, gain: 0.16, type: 'sine', sweep: 200 }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq,        duration: p.duration,        gain: p.gain,        type: p.type,     sweep: p.sweep,        attack: 0.012 });
      synth({ freq: p.freq * 1.06, duration: p.duration * 0.65, gain: p.gain * 0.40, type: 'triangle', sweep: p.sweep * 1.06, attack: 0.012 });
    } },
  // WIN
  { id: 'win-score',   params: { freq: 520, duration: 0.13, gain: 0.20, type: 'sine' }, extras: {},
    fn(p, e, synth, seq) {
      const b = p.freq;
      seq([
        { freq: b,        duration: p.duration,       gain: p.gain,        type: p.type, attack: 0.010, delay: 0.00 },
        { freq: b * 1.25, duration: p.duration,       gain: p.gain,        type: p.type, attack: 0.010, delay: 0.11 },
        { freq: b * 1.50, duration: p.duration,       gain: p.gain,        type: p.type, attack: 0.010, delay: 0.22 },
        { freq: b * 2.00, duration: p.duration * 1.8, gain: p.gain * 0.82, type: p.type, attack: 0.010, delay: 0.33 },
      ]);
    } },
  { id: 'win-chain',   params: { freq: 520, duration: 0.11, gain: 0.20, type: 'sine' }, extras: {},
    fn(p, e, synth, seq) {
      const b = p.freq;
      seq([
        { freq: b,        duration: p.duration,       gain: p.gain,        type: p.type, attack: 0.010, delay: 0.00 },
        { freq: b * 1.25, duration: p.duration,       gain: p.gain,        type: p.type, attack: 0.010, delay: 0.09 },
        { freq: b * 1.50, duration: p.duration,       gain: p.gain,        type: p.type, attack: 0.010, delay: 0.18 },
        { freq: b * 2.00, duration: p.duration,       gain: p.gain,        type: p.type, attack: 0.010, delay: 0.27 },
        { freq: b * 2.50, duration: p.duration * 2.2, gain: p.gain * 0.78, type: p.type, attack: 0.010, delay: 0.36 },
      ]);
      synth({ freq: b * 4, duration: 0.10, gain: 0.08, type: 'triangle', attack: 0.005, delay: 0.38 });
      synth({ freq: b * 3, duration: 0.10, gain: 0.07, type: 'triangle', attack: 0.005, delay: 0.44 });
    } },
  { id: 'win-survive', params: { freq: 440, duration: 0.13, gain: 0.20, type: 'sine' }, extras: {},
    fn(p, e, synth, seq) {
      const b = p.freq;
      seq([
        { freq: b,        duration: p.duration,       gain: p.gain,        type: p.type, attack: 0.010, delay: 0.00 },
        { freq: b * 1.50, duration: p.duration,       gain: p.gain,        type: p.type, attack: 0.010, delay: 0.11 },
        { freq: b * 2.00, duration: p.duration * 2.0, gain: p.gain * 0.84, type: p.type, attack: 0.010, delay: 0.22 },
      ]);
      synth({ freq: b * 3, duration: 0.09, gain: 0.07, type: 'triangle', attack: 0.005, delay: 0.26 });
    } },
  // LOSE
  { id: 'lose-board-full', params: { freq: 300, duration: 0.48, gain: 0.20, type: 'triangle', sweep: 130 }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq,        duration: p.duration,        gain: p.gain,        type: p.type, sweep: p.sweep,        attack: 0.015 });
      synth({ freq: p.freq * 0.74, duration: p.duration * 0.78, gain: p.gain * 0.48, type: p.type, sweep: p.sweep * 0.74, attack: 0.015, delay: 0.08 });
    } },
  { id: 'lose-timer',  params: { freq: 500, duration: 0.40, gain: 0.20, type: 'sine', sweep: 220 }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, sweep: p.sweep, attack: 0.006 });
    } },
  { id: 'lose-merges', params: { freq: 360, duration: 0.44, gain: 0.17, type: 'triangle', sweep: 190 }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, sweep: p.sweep, attack: 0.022 });
    } },
  // TIMER
  { id: 'timer-tick', params: { freq: 520, duration: 0.04, gain: 0.07, type: 'sine' }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, attack: 0.002 });
    } },
  { id: 'timer-low',  params: { freq: 940, duration: 0.05, gain: 0.14, type: 'sine' }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, attack: 0.002 });
    } },
  // UI
  { id: 'btn-tap',    params: { freq: 440, duration: 0.055, gain: 0.08, type: 'sine' }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, sweep: p.freq * 1.08, attack: 0.003 });
    } },
  { id: 'sheet-open', params: { freq: 300, duration: 0.14, gain: 0.10, type: 'sine', sweep: 420 }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, sweep: p.sweep, attack: 0.008 });
    } },
  { id: 'sheet-close', params: { freq: 420, duration: 0.11, gain: 0.09, type: 'sine', sweep: 300 }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, sweep: p.sweep, attack: 0.006 });
    } },
  { id: 'toast',      params: { freq: 560, duration: 0.12, gain: 0.11, type: 'triangle' }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, sweep: p.freq * 1.08, attack: 0.008 });
    } },
  { id: 'hint-open',  params: { freq: 500, duration: 0.18, gain: 0.11, type: 'sine', sweep: 640 }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, sweep: p.sweep, attack: 0.012 });
    } },
  // Calendar day tap — completed day gets a quick positive chime (instead of btn-tap)
  { id: 'cal-day-played', params: { freq: 700, duration: 0.05, gain: 0.12, type: 'sine' }, extras: {},
    fn(p, e, synth, seq) {
      const b = p.freq;
      seq([
        { freq: b,        duration: p.duration,       gain: p.gain,        type: p.type, attack: 0.003, delay: 0.00 },
        { freq: b * 1.50, duration: p.duration * 1.1, gain: p.gain * 0.85, type: p.type, attack: 0.003, delay: 0.04 },
      ]);
    } },
]);

// ── SENTINEL ICONS (inline SVG strings) ──────────────────────
const SVG_FROZEN = `<svg class="db-sentinel-icon" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.96461 21V19.0837L7.28703 20.5012L5.92399 18.9L8.96461 16.3275V12.3375L5.50459 14.3325L4.79685 18.2437L2.72608 17.8762L3.11927 15.6975L1.44168 16.6687L0.393185 14.8575L2.07077 13.8862L0 13.125L0.707733 11.1562L4.45609 12.495L7.91612 10.5L4.45609 8.505L0.707733 9.87L0 7.875L2.07077 7.14L0.393185 6.16875L1.44168 4.3575L3.11927 5.32875L2.72608 3.15L4.79685 2.7825L5.50459 6.69375L8.96461 8.68875V4.69875L5.92399 2.12625L7.28703 0.525L8.96461 1.9425V0H11.0616V1.9425L12.7392 0.525L14.1022 2.12625L11.0616 4.69875V8.68875L14.4954 6.69375L15.2031 2.7825L17.2739 3.15L16.8807 5.32875L18.5583 4.3575L19.6068 6.16875L17.9292 7.14L20 7.875L19.2923 9.87L15.5439 8.505L12.1101 10.5L15.5439 12.495L19.2923 11.1562L20 13.125L17.9292 13.8862L19.6068 14.8575L18.5583 16.6687L16.8807 15.6975L17.2739 17.8762L15.2031 18.2437L14.4954 14.3325L11.0616 12.3375V16.3275L14.1022 18.9L12.7392 20.5012L11.0616 19.0837V21H8.96461Z" fill="white"/></svg>`;
const SVG_FLIP = `<svg class="db-sentinel-icon" viewBox="0 0 18 22" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4V2H14V4H12ZM12 20V18H14V20H12ZM16 4V2H18V4H16ZM16 20V18H18V20H16ZM16 16V14H18V16H16ZM16 12V10H18V12H16ZM16 8V6H18V8H16ZM6 20H0V2H6V4H2V18H6V20ZM8 22V0H10V22H8Z" fill="white"/></svg>`;
const SVG_BOMB = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17.9297 2.03125L19.7266 2.69531C19.9089 2.77344 20 2.91667 20 3.125C19.974 3.30729 19.8828 3.4375 19.7266 3.51562L17.9297 4.17969L17.3047 5.97656C17.2266 6.15885 17.0833 6.25 16.875 6.25C16.6927 6.25 16.5625 6.15885 16.4844 5.97656L15.8203 4.17969L14.0234 3.51562C13.8411 3.4375 13.75 3.30729 13.75 3.125C13.724 2.91667 13.8151 2.77344 14.0234 2.69531L15.8203 2.03125L16.4844 0.273438C16.5625 0.0911458 16.6927 0 16.875 0C17.0573 0 17.2005 0.0911458 17.3047 0.273438L17.9297 2.03125ZM15.8984 7.22656C16.1328 7.48698 16.25 7.78646 16.25 8.125C16.25 8.46354 16.1328 8.76302 15.8984 9.02344L15.7812 9.14062C16.0937 10 16.25 10.8984 16.25 11.8359C16.1979 14.1536 15.4036 16.0807 13.8672 17.6172C12.3307 19.1536 10.4167 19.9479 8.125 20C5.83333 19.9479 3.91927 19.1536 2.38281 17.6172C0.846354 16.0807 0.0520833 14.1536 0 11.8359C0.0520833 9.54427 0.846354 7.63021 2.38281 6.09375C3.91927 4.55729 5.83333 3.76302 8.125 3.71094C9.08854 3.73698 10.013 3.90625 10.8984 4.21875L10.9766 4.10156C11.237 3.86719 11.5365 3.75 11.875 3.75C12.2135 3.75 12.513 3.86719 12.7734 4.10156L15.8984 7.22656ZM8.08594 7.5C8.47656 7.47396 8.6849 7.26562 8.71094 6.875C8.6849 6.48437 8.47656 6.27604 8.08594 6.25H7.77344C6.28906 6.27604 5.03906 6.79687 4.02344 7.8125C3.03385 8.80208 2.51302 10.0521 2.46094 11.5625V11.875C2.51302 12.2656 2.72135 12.474 3.08594 12.5C3.47656 12.474 3.6849 12.2656 3.71094 11.875V11.5625C3.73698 10.4167 4.14062 9.45312 4.92187 8.67187C5.70312 7.91667 6.65365 7.52604 7.77344 7.5H8.08594Z" fill="currentColor"/></svg>`;
const SVG_DISEASED = `<svg class="db-sentinel-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 13.75H11.5L10 10.75L8.5 13.75ZM6.5 11C7.05 11 7.521 10.8043 7.913 10.413C8.305 10.0217 8.50067 9.55067 8.5 9C8.49934 8.44933 8.30367 7.97867 7.913 7.588C7.52234 7.19733 7.05134 7.00133 6.5 7C5.94867 6.99867 5.478 7.19467 5.088 7.588C4.698 7.98133 4.502 8.452 4.5 9C4.498 9.548 4.694 10.019 5.088 10.413C5.482 10.807 5.95267 11.0027 6.5 11ZM13.5 11C14.05 11 14.521 10.8043 14.913 10.413C15.305 10.0217 15.5007 9.55067 15.5 9C15.4993 8.44933 15.3037 7.97867 14.913 7.588C14.5223 7.19733 14.0513 7.00133 13.5 7C12.9487 6.99867 12.478 7.19467 12.088 7.588C11.698 7.98133 11.502 8.452 11.5 9C11.498 9.548 11.694 10.019 12.088 10.413C12.482 10.807 12.9527 11.0027 13.5 11ZM4 20V15.75C3.35 15.4667 2.779 15.0877 2.287 14.613C1.795 14.1383 1.37834 13.6007 1.037 13C0.69567 12.3993 0.437337 11.7577 0.262004 11.075C0.0866705 10.3923 -0.000662879 9.70067 3.78788e-06 9C3.78788e-06 6.36667 0.933337 4.20833 2.8 2.525C4.66667 0.841667 7.06667 0 10 0C12.9333 0 15.3333 0.841667 17.2 2.525C19.0667 4.20833 20 6.36667 20 9C20 9.7 19.9127 10.3917 19.738 11.075C19.5633 11.7583 19.305 12.4 18.963 13C18.621 13.6 18.2043 14.1377 17.713 14.613C17.2217 15.0883 16.6507 15.4673 16 15.75V20H13V18H11V20H9V18H7V20H4Z" fill="var(--color-surface)"/></svg>`;

// chainGoal / clearBoard don't use a score target — use huge value so score-win never fires
function scoreTargetFrom(ch) {
  return (ch.winType === 'chainGoal' || ch.winType === 'clearBoard') ? 999999 : ch.target;
}
let SCORE_TARGET = scoreTargetFrom(todayChallenge);

// ── CHALLENGE STORAGE ────────────────────────────────────────
function getCompletedDates() {
  try { return new Set(JSON.parse(localStorage.getItem('db-completed') || '[]')); }
  catch { return new Set(); }
}
function markDateCompleted(iso) {
  const s = getCompletedDates();
  s.add(iso);
  localStorage.setItem('db-completed', JSON.stringify([...s]));
}

// ── GAME HISTORY ─────────────────────────────────────────────
function getGameHistory() {
  try { return JSON.parse(localStorage.getItem('db-game-history') || '[]'); }
  catch { return []; }
}
function saveGameHistory(h) {
  localStorage.setItem('db-game-history', JSON.stringify(h));
}
// Upsert one record per date. Win beats loss; of two wins, keep best score.
function recordGameResult(won) {
  const seconds = timerObj?.getElapsed() ?? 0;
  const h = getGameHistory();
  const idx = h.findIndex(r => r.date === activeChallengeDate);
  if (idx === -1) {
    h.push({ date: activeChallengeDate, won, score, seconds });
  } else {
    const existing = h[idx];
    // Replace if: new win over a loss, or better score on same win/lose status
    if ((!existing.won && won) || (existing.won === won && score > existing.score)) {
      h[idx] = { date: activeChallengeDate, won, score, seconds };
    }
  }
  saveGameHistory(h);
}
function computeStreak(completedDates) {
  const toISO = d => d.toISOString().slice(0, 10);
  const today = new Date();
  const todayISO = toISO(today);
  const walk = new Date(completedDates.has(todayISO) ? today : new Date(today.getTime() - 86400000));
  let streak = 0;
  while (completedDates.has(toISO(walk))) { streak++; walk.setDate(walk.getDate() - 1); }
  return streak;
}
function fmtTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function renderStats() {
  const h      = getGameHistory();
  const played = h.length;
  const wins   = h.filter(r => r.won);
  const streak = computeStreak(getCompletedDates());
  const set    = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  if (!played) {
    ['db-stat-played','db-stat-streak','db-stat-winrate','db-stat-best','db-stat-avg','db-stat-totaltime']
      .forEach(id => set(id, '—'));
    return;
  }

  set('db-stat-totaltime', fmtTime(h.reduce((s, r) => s + r.seconds, 0)));
  ['db-stat-played','db-stat-streak','db-stat-winrate','db-stat-best','db-stat-avg'].forEach(id => set(id, '0'));

  const winRate = Math.round(wins.length / played * 100);
  const best    = wins.length ? Math.max(...wins.map(r => r.score)) : 0;
  const avg     = Math.round(h.reduce((s, r) => s + r.score, 0) / played);
  const g       = id => document.getElementById(id);

  setTimeout(() => {
    GameUtils.countUp(g('db-stat-played'),  played,   600);
    GameUtils.countUp(g('db-stat-streak'),  streak,   600);
    GameUtils.countUp(g('db-stat-winrate'), winRate,  700, v => v + '%');
    GameUtils.countUp(g('db-stat-best'),    best,     800);
    GameUtils.countUp(g('db-stat-avg'),     avg,      800);
  }, 380);
}

// ── TIMING ───────────────────────────────────────────────────
const TIMING = {
  MERGE_1:          30,   // delay before first merge check after placement
  MERGE_2:          80,   // delay between cascaded merge checks
  MERGE_ANIM:      360,   // merge animation duration (matches db-cell--merging CSS)
  FLOAT_REMOVE:    750,   // floating score label cleanup
  SHEET_OPEN:      600,   // sheet slide-in delay (matches --duration-xslow)
  SHEET_SWITCH:    100,   // brief gap between sheet close and next open
  NAV_DELAY:       400,   // navigation after sheet close (matches --duration-slow)
  POPUP_SHOW:      500,   // popup appear delay after screen transition
  POPUP_QUICK:     200,   // fast popup (e.g. after tutorial close)
  TOAST_DELAY:     300,   // toast fires after sheet close animation starts
  LOADING_DELAY:  2000,   // minimum loading screen duration
  HINT_AUTO_CLOSE: 5000,  // hint banner auto-dismiss
};

// ── GAME STATE ───────────────────────────────────────────────
let board   = [];
let score   = 0;
let merges  = 0;
let timerObj      = null;
let tutorialStep  = 0;
let firstTimeUser = !sessionStorage.getItem('db-tutorialSeen');

let lastPlacedCells = []; // cells most recently placed by player or merge result (for result positioning)
let spawnerDice   = [];  // [{value}]  1–2 items
let spawnerRotDeg = 0;   // cumulative degrees (multiples of 90)
let parkedDice    = [];  // [{value}]  0–2 items
let parkedRotDeg  = 0;   // cumulative degrees
let isMerging        = false;
let gameActive       = false; // true while gameplay screen is live (not won/lost/reset)
let hintTimeout      = null;

// ── MODIFIER STATE ───────────────────────────────────────────
// wildDice modifier: wild dice appear randomly, always alone, min 1 / max 3 per game
const WILD_MIN        = 1;
const WILD_MAX        = 3;
const WILD_OPEN_WAIT  = 4; // block wild dice for the first N spawns (calm opening)
let wildSpawned = 0;  // wild dice spawned this game
let wildSpawnNum = 0; // total spawns this game (used for chance gate + guarantee)
let bombFuses      = new Map();  // cellKey → remaining turns until detonation
let chainDepth     = 0;          // cascade waves resolved in current placement
let bestChainDepth = 0;          // best cascade achieved this game (for display)
let chainWon       = false;      // prevents double-win on chainGoal

// ── STREAK & TURN STATE ──────────────────────────────────────
let mergeStreak          = 0;     // consecutive turns that ended with a merge
let turnHadPlacement     = false; // a die was placed on the board this turn
let turnHadMerge         = false; // at least one merge fired this turn
let rewardWordShownThisTurn = false; // big-game word already shown; skip streak word
let turnMergedDiceCount  = 0;    // total dice cleared this turn (across all waves)

// ── HOT-ZONE STATE ───────────────────────────────────────────
let hotZoneCells = new Set(); // cellKey (r * GRID_COLS + c) of hot-zone cells

// ── FROZEN-ORIGIN STATE ──────────────────────────────────────
// Each frozen cell carries the originId of the spawn it grew from.
// Spread picks a random origin each wave; thaw clears entries for removed cells.
let frozenOrigins = new Map(); // cellKey (r * GRID_COLS + c) → originId (1..N)

// ── DRAG STATE ───────────────────────────────────────────────
// pending = pointerdown received, but hasn't moved past threshold yet
const drag = { active: false, pending: false, source: null, startX: 0, startY: 0, ghostEl: null, hiddenInner: null, dropTarget: null };

// ── REWARD WORD ──────────────────────────────────────────────
function showRewardWord(text) {
  const el = document.getElementById('db-reward-word');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('db-reward-word--show');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('db-reward-word--show');
}

// ── STREAK HELPERS ────────────────────────────────────────────
// Returns the score multiplier for merges made during a turn
// where mergeStreak consecutive-merge turns have already been completed.
function streakMultiplier(streak) {
  if (streak <= 1) return 1;
  if (streak === 2) return 1.2;
  if (streak === 3) return 1.5;
  return 2;
}


// ── HOT-ZONE PLACEMENT ────────────────────────────────────────
function placeHotZones(n) {
  const candidates = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (board[r][c] === 0) candidates.push([r, c]);
  // Fisher-Yates shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  candidates.slice(0, n).forEach(([r, c]) => hotZoneCells.add(r * GRID_COLS + c));
}

// ── BOARD HELPERS ────────────────────────────────────────────
function initBoard() {
  board = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));
}

function randomDie() {
  return { value: Math.ceil(Math.random() * 5) }; // 1–5
}

// ── SPAWN ────────────────────────────────────────────────────
function spawnDice() {
  if (activeChallenge.modifier === 'wildDice') {
    wildSpawnNum++;
    const capped     = wildSpawned >= WILD_MAX;
    const guaranteed = wildSpawned < WILD_MIN && wildSpawnNum >= WILD_OPEN_WAIT + 6;
    const chanceHit  = !capped && wildSpawnNum > WILD_OPEN_WAIT && Math.random() < activeChallenge.modValue * 0.1;
    if (guaranteed || chanceHit) {
      wildSpawned++;
      spawnerDice = [{ value: WILD_DIE }];
      spawnerRotDeg = 0;
      renderSpawner();
      return;
    }
  }
  const count = Math.random() < 0.35 ? 1 : 2;
  spawnerDice = Array.from({ length: count }, () => randomDie());
  spawnerRotDeg = 0;
  renderSpawner();
}

// ── SCORE BAR ────────────────────────────────────────────────
function popEl(el, newText) {
  if (!el || el.textContent === newText) return;
  el.textContent = newText;
  el.classList.remove('db-score-pop');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('db-score-pop');
}
function updateScoreBar() {
  let scoreDisplay;
  if (activeChallenge.winType === 'chainGoal') {
    scoreDisplay = `${bestChainDepth}/${activeChallenge.target}`;
  } else if (activeChallenge.winType === 'clearBoard') {
    scoreDisplay = String(score);
  } else {
    scoreDisplay = `${score}/${SCORE_TARGET}`;
  }
  popEl(document.getElementById('db-score-value'), scoreDisplay);
  const mergeLabel = activeChallenge.modifier === 'maxMerges'
    ? `${merges}/${activeChallenge.modValue}`
    : String(merges);
  popEl(document.getElementById('db-merges-value'), mergeLabel);
}

// ── RENDER BOARD ─────────────────────────────────────────────
function renderBoard() {
  const grid = document.getElementById('db-board-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'db-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      const val = board[r][c];
      if      (val === NULL_BLOCK)   { cell.classList.add('db-cell--null'); }
      else if (val === FROZEN_CELL)  { cell.classList.add('db-cell--frozen');  cell.innerHTML = SVG_FROZEN; }
      else if (val === FLIP_DIE)     { cell.classList.add('db-cell--flip');    cell.innerHTML = SVG_FLIP; }
      else if (val === BOMB_DIE) {
        const fuse = bombFuses.get(r * GRID_COLS + c) ?? '?';
        cell.classList.add('db-cell--bomb');
        if (fuse === 1) cell.classList.add('db-cell--bomb-urgent');
        cell.innerHTML = `<div class="db-bomb-icon">${SVG_BOMB}</div><span class="db-bomb-fuse">${fuse}</span>`;
      }
      else if (val === DISEASED_DIE) { cell.classList.add('db-cell--diseased'); cell.innerHTML = SVG_DISEASED; }
      else if (val > 0) { cell.innerHTML = renderDie(val); }
      if (hotZoneCells.has(r * GRID_COLS + c)) cell.classList.add('db-cell--hot-zone');
      grid.appendChild(cell);
    }
  }
}

// ── RENDER SPAWNER ───────────────────────────────────────────
function renderSpawner() {
  const slot = document.getElementById('db-spawner');
  if (!slot) return;
  slot.innerHTML = '';
  if (!spawnerDice.length) return;

  const inner = buildTrayInner(spawnerDice, spawnerRotDeg, 'spawner');
  slot.appendChild(inner);
  bindDraggables(slot);
}

// ── RENDER PARKING ───────────────────────────────────────────
const PARKING_SVG = `<svg viewBox="0 0 29 34" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 33.2308V0H13.8462C18.4154 0 22.0154 1.24616 24.5077 3.73846C27 6.23077 28.2462 9.41539 28.2462 13.2923C28.2462 17.1692 27 20.3538 24.5077 22.8462C22.0154 25.3385 18.4154 26.5846 13.8462 26.5846H7.75385V33.2308H0ZM7.75385 19.9385H13.2923C15.6462 19.9385 17.4462 19.2462 18.6923 17.8615C19.9385 16.4769 20.5615 15.0923 20.5615 13.2923C20.5615 11.4923 19.9385 10.1077 18.6923 8.72308C17.4462 7.33846 15.6462 6.64615 13.2923 6.64615H7.75385V19.9385Z" fill="currentColor"/>
</svg>`;


function renderParking() {
  const slot = document.getElementById('db-parking');
  if (!slot) return;
  slot.innerHTML = `<div class="db-tray-empty">${PARKING_SVG}</div>`;

  if (!parkedDice.length) {
    slot.classList.remove('db-parking--catch');
    return;
  }

  const inner = buildTrayInner(parkedDice, parkedRotDeg, 'parking');
  slot.appendChild(inner);
  bindDraggables(slot);
}

// ── BUILD TRAY INNER ─────────────────────────────────────────
function buildTrayInner(dice, rotDeg, source) {
  const inner = document.createElement('div');
  inner.className = 'db-tray-inner';

  dice.forEach((die, i) => {
    const el = document.createElement('div');
    el.className = 'db-tray-die db-die-draggable';
    el.dataset.source = source;
    el.dataset.index  = i;
    el.style.transform = `rotate(${-rotDeg}deg)`;
    el.innerHTML = renderDie(die.value);
    inner.appendChild(el);
  });

  // Set container rotation immediately (no animation on initial build)
  inner.style.transition = 'none';
  inner.style.transform  = `rotate(${rotDeg}deg)`;
  // Re-enable transition on next frame so only subsequent changes animate
  requestAnimationFrame(() => { inner.style.transition = ''; });

  return inner;
}

// ── APPLY ROTATION (no DOM rebuild — triggers CSS transition) ─
function applyTrayRotation(source) {
  const slotId = source === 'spawner' ? 'db-spawner' : 'db-parking';
  const rotDeg = source === 'spawner' ? spawnerRotDeg : parkedRotDeg;
  const inner  = document.querySelector(`#${slotId} .db-tray-inner`);
  if (!inner) return;
  inner.style.transform = `rotate(${rotDeg}deg)`;
  inner.querySelectorAll('.db-tray-die').forEach(die => {
    die.style.transform = `rotate(${-rotDeg}deg)`;
  });
}

// ── ROTATE PAIR ──────────────────────────────────────────────
function rotatePair(source) {
  if (source === 'spawner') {
    if (spawnerDice.length < 2) return;
    spawnerRotDeg += 90;
    applyTrayRotation('spawner');
  } else {
    if (parkedDice.length < 2) return;
    parkedRotDeg += 90;
    applyTrayRotation('parking');
  }
  SoundUtils.play('die-rotate');
}

// ── PLACEMENT ────────────────────────────────────────────────
function canonicalRot(deg) {
  return ((deg % 360) + 360) % 360;
}

function getPlacementInfo(row, col, dice, rotDeg) {
  if (dice.length === 1) return { cells: [[row, col]], dicesToPlace: [dice[0]] };

  const rot        = canonicalRot(rotDeg);
  const isVertical = rot === 90 || rot === 270;
  const isReversed = rot === 180 || rot === 270;

  const rawCells = isVertical
    ? [[row, col], [row + 1, col]]
    : [[row, col], [row, col + 1]];

  return {
    cells:       rawCells,
    dicesToPlace: isReversed ? [dice[1], dice[0]] : [dice[0], dice[1]],
  };
}

function canPlace(cells) {
  return cells.every(([r, c]) =>
    r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS && board[r][c] === 0
  );
}

function doPlace(cells, dicesToPlace) {
  cells.forEach(([r, c], i) => { board[r][c] = dicesToPlace[i].value; });
  lastPlacedCells = cells.slice();
  chainDepth = 0; // reset cascade counter for this new placement
  turnHadPlacement = true;
  turnHadMerge     = false;
  rewardWordShownThisTurn = false;
  turnMergedDiceCount = 0;
  clearHintHighlights();
  clearTimeout(hintTimeout);
  document.getElementById('db-game-hint-wrap')?.classList.remove('game-hint-wrap--open');
  // Modifier effects — flip first (affects pre-existing neighbours), diseased second (affects just-placed dice)
  if (activeChallenge.modifier === 'flipDice')     applyFlipEffects(cells);
  if (activeChallenge.modifier === 'diseasedDice') applyDiseasedEffects(cells);
  renderBoard();
  cells.forEach(([r, c]) => {
    const el = document.querySelector(`#db-board-grid [data-row="${r}"][data-col="${c}"]`);
    if (el) {
      el.classList.add('db-cell--land');
      el.addEventListener('animationend', () => el.classList.remove('db-cell--land'), { once: true });
    }
  });
  SoundUtils.play('die-place');
  setTimeout(() => triggerMergeCheck(), TIMING.MERGE_1);
}

function placeFromSpawner(row, col) {
  if (isMerging || !spawnerDice.length) return false;
  const info = getPlacementInfo(row, col, spawnerDice, spawnerRotDeg);
  if (!canPlace(info.cells)) return false;
  const { cells, dicesToPlace } = info;
  spawnerDice = [];
  renderSpawner();
  doPlace(cells, dicesToPlace);
  return true;
}

function placeFromParking(row, col) {
  if (isMerging || !parkedDice.length) return false;
  const info = getPlacementInfo(row, col, parkedDice, parkedRotDeg);
  if (!canPlace(info.cells)) return false;
  const { cells, dicesToPlace } = info;
  parkedDice = [];
  renderParking();
  doPlace(cells, dicesToPlace);
  return true;
}

// ── SWAP ANIMATION ───────────────────────────────────────────
// The dragged die is already visible as the ghost following the cursor,
// so we ONLY animate the displaced die (the one being kicked out of the
// drop target back to the drag source). For one-way moves there is no
// displaced die, so we update instantly.
function flyDisplacedDie(fromSlotId, toSlotId, onComplete) {
  const fromEl = document.getElementById(fromSlotId);
  const toEl   = document.getElementById(toSlotId);
  const inner  = fromEl?.querySelector('.db-tray-inner');

  if (!inner) { onComplete(); return; }

  const fromRect = fromEl.getBoundingClientRect();
  const toRect   = toEl.getBoundingClientRect();
  const fromCx = fromRect.left + fromRect.width  / 2;
  const fromCy = fromRect.top  + fromRect.height / 2;
  const toCx   = toRect.left  + toRect.width  / 2;
  const toCy   = toRect.top   + toRect.height / 2;

  const m   = (inner.style.transform || '').match(/rotate\((-?[\d.]+)deg\)/);
  const rot = m ? parseFloat(m[1]) : 0;

  const clone = inner.cloneNode(true);
  clone.removeAttribute('style');
  clone.style.cssText = [
    'position:fixed', 'left:0', 'top:0', 'margin:0',
    'z-index:999', 'pointer-events:none', 'will-change:transform',
    `transform:translateX(${fromCx}px) translateY(${fromCy}px) translateX(-50%) translateY(-50%) rotate(${rot}deg)`,
  ].join(';');
  document.body.appendChild(clone);
  inner.style.opacity = '0';

  const DURATION = 240;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    clone.style.transition = `transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`;
    clone.style.transform  = `translateX(${toCx}px) translateY(${toCy}px) translateX(-50%) translateY(-50%) rotate(${rot}deg)`;
  }));

  setTimeout(() => { clone.remove(); onComplete(); }, DURATION + 20);
}

// ── PARKING SWAP ─────────────────────────────────────────────
function triggerParkingCatch() {
  const slot = document.getElementById('db-parking');
  if (!slot) return;
  slot.classList.remove('db-parking--catch');
  // Force reflow so re-adding the class restarts the animation
  void slot.offsetWidth;
  slot.classList.add('db-parking--catch');
  setTimeout(() => slot.classList.remove('db-parking--catch'), 400);
}

function handleParkDrop() {
  // User dragged FROM spawner and dropped ON parking
  if (!spawnerDice.length) return;
  SoundUtils.play('die-park');
  const wasEmpty = !parkedDice.length;
  if (wasEmpty) {
    // One-way: ghost already shows movement — update instantly
    parkedDice   = spawnerDice.slice();
    parkedRotDeg = spawnerRotDeg;
    spawnerDice  = [];
    renderParking();
    triggerParkingCatch();
    spawnDice();
  } else {
    // Full swap: null out hiddenInner NOW so onPointerUp's restore doesn't
    // un-hide the source tray while the displaced die is still mid-flight.
    drag.hiddenInner = null;
    flyDisplacedDie('db-parking', 'db-spawner', () => {
      const tmpDice = parkedDice;
      const tmpRot  = parkedRotDeg;
      parkedDice    = spawnerDice;
      parkedRotDeg  = spawnerRotDeg;
      spawnerDice   = tmpDice;
      spawnerRotDeg = tmpRot;
      renderParking();
      renderSpawner();
    });
  }
}

function handleParkToSpawnerDrop() {
  // User dragged FROM parking and dropped ON spawner
  if (!parkedDice.length) return;
  SoundUtils.play('die-park');
  if (!spawnerDice.length) {
    // One-way: update instantly
    spawnerDice   = parkedDice.slice();
    spawnerRotDeg = parkedRotDeg;
    parkedDice    = [];
    renderSpawner();
    renderParking();
  } else {
    // Full swap: same fix — prevent onPointerUp from restoring the source tray
    drag.hiddenInner = null;
    flyDisplacedDie('db-spawner', 'db-parking', () => {
      const tmpDice = spawnerDice;
      const tmpRot  = spawnerRotDeg;
      spawnerDice   = parkedDice;
      spawnerRotDeg = parkedRotDeg;
      parkedDice    = tmpDice;
      parkedRotDeg  = tmpRot;
      renderSpawner();
      renderParking();
    });
  }
}

// ── MERGE ENGINE ─────────────────────────────────────────────
function cellEl(r, c) {
  return document.querySelector(`#db-board-grid [data-row="${r}"][data-col="${c}"]`);
}

function floodFill(r, c, val, visited) {
  const key = r * GRID_COLS + c;
  if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return [];
  if (visited.has(key)) return [];
  const cellVal = board[r][c];
  // Wild die (7) joins any group; otherwise must match the seed value
  if (cellVal !== val && cellVal !== WILD_DIE) return [];
  visited.add(key);
  return [
    [r, c],
    ...floodFill(r - 1, c, val, visited),
    ...floodFill(r + 1, c, val, visited),
    ...floodFill(r, c - 1, val, visited),
    ...floodFill(r, c + 1, val, visited),
  ];
}

function findMergeGroups() {
  const visited = new Set();
  const groups  = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const val = board[r][c];
      // Skip empty cells, all sentinels (≤0), and wild dice (absorbed into groups, never starters)
      if (val <= 0 || val === WILD_DIE) continue;
      const key = r * GRID_COLS + c;
      if (visited.has(key)) continue;
      const group = floodFill(r, c, val, new Set());
      group.forEach(([gr, gc]) => visited.add(gr * GRID_COLS + gc));
      if (group.length >= 3) groups.push({ group, value: val });
    }
  }
  return groups;
}

function triggerMergeCheck() {
  const groups = findMergeGroups();
  if (!groups.length) { onTurnEnd(); return; }

  isMerging = true;

  const grid = document.getElementById('db-board-grid');
  grid?.style.setProperty('--chain-depth', chainDepth);
  const depthClass = chainDepth >= 2 ? 'db-cell--merging--chain-3' : chainDepth === 1 ? 'db-cell--merging--chain-2' : null;
  groups.forEach(({ group }) =>
    group.forEach(([r, c]) => {
      const el = cellEl(r, c);
      el?.classList.add('db-cell--merging');
      if (depthClass) el?.classList.add(depthClass);
    })
  );

  setTimeout(() => {
    const newDice = [];
    let earned = 0;
    const sMult = streakMultiplier(mergeStreak); // multiplier earned this turn from streak

    // Track the best reward word to show for this wave (priority: jackpot > high roller > loaded)
    let waveWord = null;
    const WORD_PRIORITY = { 'Jackpot!': 3, 'High roller!': 2, 'Loaded!': 1 };

    groups.forEach(({ group, value }) => {
      const sum      = value * group.length;
      const gMult    = group.length >= 5 ? 2 : group.length === 4 ? 1.5 : 1;
      const vMult    = value >= 6 ? 1.3 : value === 5 ? 1.2 : value === 4 ? 1.1 : 1;
      const hasHot   = group.some(([r, c]) => hotZoneCells.has(r * GRID_COLS + c));
      const bonusMult = gMult * vMult * (hasHot ? 2 : 1);
      const groupEarned = Math.round(sum * bonusMult * sMult);

      earned += groupEarned;
      merges++;
      // Warn player when merge budget is running low
      if (activeChallenge.modifier === 'maxMerges') {
        const remaining = activeChallenge.modValue - merges;
        if (remaining === 5 || remaining === 3) {
          SoundUtils.play('toast');
          GameUtils.showToast('db-toast', `Only ${remaining} merge${remaining === 1 ? '' : 's'} left!`, 3000);
        }
      }
      turnMergedDiceCount += group.length;
      group.forEach(([r, c]) => { board[r][c] = 0; });

      if (sum <= 6) {
        // Prefer last placed cell if it's in this group; fallback to bottom-left-most
        const lastMatch = group.find(([r, c]) => lastPlacedCells.some(([lr, lc]) => lr === r && lc === c));
        const [r0, c0] = lastMatch ?? group.reduce((best, [r, c]) =>
          r > best[0] || (r === best[0] && c < best[1]) ? [r, c] : best
        );
        board[r0][c0] = sum;
        newDice.push([r0, c0]);
      }

      const [fr, fc] = group[Math.floor(group.length / 2)];
      floatScore(fr, fc, `+${groupEarned}`, chainDepth);

      // Determine reward word for this group
      let groupWord = null;
      if (hasHot)              groupWord = 'Jackpot!';
      else if (group.length >= 5) groupWord = 'High roller!';
      else if (group.length === 4) groupWord = 'Loaded!';
      if (groupWord && (!waveWord || WORD_PRIORITY[groupWord] > WORD_PRIORITY[waveWord])) {
        waveWord = groupWord;
      }
    });

    score += earned;
    turnHadMerge = true;
    tickBombs(); // bomb ticks on each merge — score vs. fuse tension

    // chainGoal: count this resolved wave
    chainDepth++;
    if (chainDepth > bestChainDepth) {
      bestChainDepth = chainDepth;
    }

    updateScoreBar();

    // Board shake on deep chain
    if (chainDepth >= 3) {
      const gridEl = document.getElementById('db-board-grid');
      if (gridEl) {
        gridEl.classList.add('db-board--shake');
        gridEl.addEventListener('animationend', () => gridEl.classList.remove('db-board--shake'), { once: true });
      }
    }

    // Frozen cell spread / thaw — fires once per merge wave
    // A "6-merge" means sum === 6 (e.g. three 2s, two 3s) — produces a 6-die
    const sixSumGroup = groups.find(({ group, value }) => value * group.length === 6);
    if (sixSumGroup) {
      const [pr, pc] = sixSumGroup.group[Math.floor(sixSumGroup.group.length / 2)];
      thawClosestCluster(pr, pc);
    } else if (spreadFrozenCell()) {
      return; // board frozen out — triggerLose already called
    }

    renderBoard();

    // Show reward word if a notable group was resolved and enough dice merged
    if (waveWord && !rewardWordShownThisTurn && turnMergedDiceCount >= 5) {
      showRewardWord(waveWord);
      rewardWordShownThisTurn = true;
    } else if (chainDepth >= 2 && !waveWord) {
      showRewardWord(`Chain ×${chainDepth}`);
    }

    // Merge SFX — fired once per wave based on what resolved
    const hasMergeClear = groups.some(({ group, value }) => value * group.length > 6);
    const hasSixSpawn   = groups.some(({ group, value }) => value * group.length === 6);
    if (hasMergeClear) {
      SoundUtils.play('merge-clear');
    } else {
      SoundUtils.play('merge', { depth: chainDepth });
      if (hasSixSpawn) SoundUtils.play('six-spawn');
    }

    // maxMerges: lose if merge budget exhausted before score target
    if (activeChallenge.modifier === 'maxMerges' && merges >= activeChallenge.modValue && score < SCORE_TARGET) {
      triggerLose('merges');
      return;
    }

    // chainGoal: win when cascade depth reaches target
    if (activeChallenge.winType === 'chainGoal' && chainDepth >= activeChallenge.target) {
      isMerging = false;
      triggerWin('chain');
      return;
    }

    if (newDice.length) lastPlacedCells = newDice.slice(); // cascade: next wave prefers this wave's result
    newDice.forEach(([r, c]) =>
      requestAnimationFrame(() => cellEl(r, c)?.classList.add('db-cell--pop'))
    );

    isMerging = false;
    setTimeout(() => triggerMergeCheck(), TIMING.MERGE_2);
  }, TIMING.MERGE_ANIM);
}

function onTurnEnd() {
  // Update streak based on whether this turn had a board placement and a merge
  if (turnHadPlacement) {
    if (turnHadMerge) {
      mergeStreak++;
      // Show milestone word only if no big-game word was already shown this turn
      if (!rewardWordShownThisTurn && turnMergedDiceCount >= 5) {
        if      (mergeStreak === 2) showRewardWord('Rolling!');
        else if (mergeStreak === 3) showRewardWord('Hot dice!');
        else if (mergeStreak === 4) showRewardWord('Boxcars!');
        else if (mergeStreak >= 5)  showRewardWord("Can't stop!");
      }
    } else {
      mergeStreak = 0;
    }
    turnHadPlacement = false;
    turnHadMerge     = false;
    rewardWordShownThisTurn = false;
    turnMergedDiceCount = 0;
  }

  if (checkWin()) return;
  if (checkLose()) return;
  if (checkDiseasedLose()) return;
  if (!spawnerDice.length) {
    spawnDice();
    // After spawning, verify the player has at least one valid placement.
    // If a 2-die spawn can't fit but a single die can (isolated cells remain),
    // reduce to 1 die rather than triggering a false "board full" lose.
    if (!hasAnyValidMove(spawnerDice)) {
      if (spawnerDice.length === 2 && hasAnyValidMove([spawnerDice[0]])) {
        spawnerDice = [spawnerDice[0]];
        renderSpawner();
      } else {
        triggerLose('board-full');
      }
    }
  }
}

// ── FLOATING SCORE ───────────────────────────────────────────
function floatScore(r, c, text, depth = 0) {
  const el = cellEl(r, c);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const div  = document.createElement('div');
  div.className = 'db-float-score';
  if (depth >= 2) div.classList.add('db-float-score--chain-2');
  else if (depth === 1) div.classList.add('db-float-score--chain-1');
  div.textContent = text;
  div.style.cssText = `left:${rect.left + rect.width / 2}px;top:${rect.top}px`;
  document.body.appendChild(div);
  requestAnimationFrame(() => requestAnimationFrame(() => div.classList.add('db-float-score--up')));
  setTimeout(() => div.remove(), TIMING.FLOAT_REMOVE);
}

// ── WIN / LOSE ────────────────────────────────────────────────
function timeUntilNextChallenge() {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(10, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const diff = next - now;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

let winCountdownInterval = null;
let calCtrl              = null; // set in DOMContentLoaded, used by triggerWin

function triggerWin(reason = 'score') {
  if (chainWon) return; // guard against double-fire
  chainWon = true;
  gameActive = false;
  calCtrl?.setInProgressDate(null);
  timerObj?.pause();
  recordGameResult(true);
  markDateCompleted(activeChallengeDate);
  IT_PLAYED.add(activeChallengeDate);
  itUpdateAnotherButtons();
  // Refresh calendar, streak grid, and home week list so the completed day turns green immediately
  const freshCompleted = getCompletedDates();
  calCtrl?.refresh(freshCompleted);
  GameUtils.buildStreakGrid('db-stat-streak-grid', freshCompleted);
  buildHomeWeek();
  // Win button label: today's challenge → "Play again", past challenge → "Back to Home"
  const winHomeBtnEl = document.getElementById('db-win-btn-home');
  if (winHomeBtnEl) winHomeBtnEl.textContent = activeChallengeDate === TODAY_ISO ? 'Play again' : 'Back to Home';
  SoundUtils.play('win-' + reason);
  Music.winFlourish();
  const countdownEl = document.getElementById('db-win-countdown');
  if (countdownEl) {
    countdownEl.textContent = timeUntilNextChallenge();
    clearInterval(winCountdownInterval);
    winCountdownInterval = setInterval(() => {
      countdownEl.textContent = timeUntilNextChallenge();
    }, 1000);
  }
  document.getElementById('sheet-win').dataset.difficulty = activeChallenge.difficulty || '';
  setTimeout(() => GameUtils.openSheet('sheet-win'), TIMING.SHEET_OPEN);
}

function checkWin() {
  if (chainWon) return true;
  if (activeChallenge.winType === 'clearBoard') {
    if (board.flat().every(v => v <= 0)) {
      showRewardWord('Clean sweep!');
      triggerWin('score');
      return true;
    }
    return false;
  }
  if (score >= SCORE_TARGET) {
    const reason = activeChallenge.winType === 'surviveTimer' ? 'survive' : 'score';
    triggerWin(reason);
    return true;
  }
  return false;
}

const LOSE_COPY = {
  'board-full': { title: "Board's full!",      reason: 'No more dice can be placed.' },
  'timer':      { title: "Time's up!",          reason: 'You ran out of time.' },
  'merges':     { title: 'Merge limit reached!',reason: 'You used all your merges before reaching the target.' },
  'bomb':       { title: 'Boom!',               reason: 'A bomb detonated on your board.' },
  'frozen':     { title: 'Frozen out!',         reason: 'The ice spread too far — no room left to grow.' },
  'diseased':   { title: 'Infected!',           reason: 'The disease spread — no safe cells left to place.' },
};

function triggerLose(reason = 'board-full') {
  gameActive = false;
  calCtrl?.setInProgressDate(null);
  timerObj?.pause();
  recordGameResult(false);
  IT_PLAYED.add(activeChallengeDate);
  itUpdateAnotherButtons();
  // bomb-detonate already played its own sound; all other lose reasons get a sound
  if (reason !== 'bomb') SoundUtils.play('lose-' + reason);
  Music.stop();
  const copy = LOSE_COPY[reason] || LOSE_COPY['board-full'];
  const sheetEl  = document.getElementById('sheet-lose');
  const titleEl  = document.getElementById('db-lose-title');
  const reasonEl = document.getElementById('db-lose-reason');
  const scoreEl  = document.getElementById('db-lose-score');
  // Set data-reason before openSheet so CSS picks up the right illustration
  if (sheetEl)  sheetEl.dataset.reason = reason;
  if (titleEl)  titleEl.textContent  = copy.title;
  if (reasonEl) reasonEl.textContent = copy.reason;
  if (scoreEl)  scoreEl.textContent  = score;
  setTimeout(() => GameUtils.openSheet('sheet-lose'), TIMING.SHEET_OPEN);
}

function checkLose() {
  const full = board.every(row => row.every(v => v !== 0));
  if (full) { triggerLose('board-full'); return true; }
  return false;
}

// Diseased lose: every empty cell is adjacent to at least one diseased die → nowhere safe to place
function checkDiseasedLose() {
  if (activeChallenge.modifier !== 'diseasedDice') return false;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (board[r][c] !== 0) continue;
      const safe = DIRS.every(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        return nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS || board[nr][nc] !== DISEASED_DIE;
      });
      if (safe) return false; // found at least one uncontaminated empty cell
    }
  }
  triggerLose('diseased');
  return true;
}

// Returns true if dice can be placed somewhere in any horizontal or vertical orientation
function hasAnyValidMove(dice) {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (canPlace(getPlacementInfo(r, c, dice, 0).cells))  return true;
      if (canPlace(getPlacementInfo(r, c, dice, 90).cells)) return true;
    }
  }
  return false;
}

// ── DRAG & DROP ──────────────────────────────────────────────
function bindDraggables(container) {
  container.querySelectorAll('.db-die-draggable').forEach(el =>
    el.addEventListener('pointerdown', onPointerDown, { passive: false })
  );
}

const DRAG_THRESHOLD = 8; // px before ghost appears and drag is committed

function onPointerDown(e) {
  e.preventDefault();
  const source = e.currentTarget.dataset.source;
  const dice   = source === 'spawner' ? spawnerDice : parkedDice;
  if (!dice.length || isMerging) return;

  // Mark as pending — ghost deferred until threshold exceeded
  drag.pending = true;
  drag.active  = false;
  drag.source  = source;
  drag.startX  = e.clientX;
  drag.startY  = e.clientY;

  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup',   onPointerUp,   { once: true });
}

function onPointerMove(e) {
  e.preventDefault();
  if (!drag.pending) return;

  if (!drag.active) {
    // Activate drag only once pointer crosses the threshold
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
    drag.active = true;
    const dice   = drag.source === 'spawner' ? spawnerDice : parkedDice;
    const rotDeg = drag.source === 'spawner' ? spawnerRotDeg : parkedRotDeg;
    const sampleCell = document.querySelector('#db-board-grid .db-cell');
    const cellSize   = sampleCell ? sampleCell.getBoundingClientRect().width : 44;
    const ghost  = document.createElement('div');
    ghost.className = 'db-drag-ghost';
    ghost.innerHTML = ghostHTML(dice, rotDeg, cellSize);
    document.body.appendChild(ghost);
    drag.ghostEl = ghost;
    // Hide the original tray inner so only the ghost is visible
    const slotId = drag.source === 'spawner' ? 'db-spawner' : 'db-parking';
    drag.hiddenInner = document.querySelector(`#${slotId} .db-tray-inner`);
    if (drag.hiddenInner) drag.hiddenInner.style.opacity = '0';
  }

  positionGhost(e.clientX, e.clientY);
  updateDropHighlight(e.clientX, e.clientY);
}

function onPointerUp(e) {
  window.removeEventListener('pointermove', onPointerMove);
  clearHighlights();

  if (!drag.pending) return;

  if (!drag.active) {
    // Never crossed threshold → treat as tap → rotate
    rotatePair(drag.source);
  } else {
    if (drag.dropTarget) {
      const { r, c } = drag.dropTarget;
      if (drag.source === 'spawner') placeFromSpawner(r, c);
      else                           placeFromParking(r, c);
    } else {
      const parkingEl = document.getElementById('db-parking');
      const spawnerEl = document.getElementById('db-spawner');
      if (drag.source === 'spawner' && parkingEl && rectContains(parkingEl, e.clientX, e.clientY)) {
        handleParkDrop();
      } else if (drag.source === 'parking' && spawnerEl && rectContains(spawnerEl, e.clientX, e.clientY)) {
        handleParkToSpawnerDrop();
      }
    }
  }

  // Restore the hidden inner (re-renders replace it anyway on success;
  // this handles the case where the drop was cancelled / invalid)
  if (drag.hiddenInner) { drag.hiddenInner.style.opacity = ''; drag.hiddenInner = null; }

  drag.ghostEl?.remove();
  drag.ghostEl    = null;
  drag.dropTarget = null;
  drag.active   = false;
  drag.pending  = false;
}

function positionGhost(x, y) {
  if (!drag.ghostEl) return;
  drag.ghostEl.style.left = `${x}px`;
  drag.ghostEl.style.top  = `${y}px`;
}

function ghostHTML(dice, rotDeg, cellSize) {
  const s   = cellSize || 44;
  const gap = 4; // --space-1
  const dieSz  = `width:${s}px;height:${s}px;flex-shrink:0;`;
  const diceHTML = dice.map(d =>
    `<div class="db-tray-die" style="${dieSz}transform:rotate(${-rotDeg}deg)">${renderDie(d.value)}</div>`
  ).join('');
  const innerSz = dice.length === 1 ? s : 2 * s + gap;
  return `<div class="db-tray-inner" style="width:${innerSz}px;height:${innerSz}px;transform:rotate(${rotDeg}deg)">${diceHTML}</div>`;
}

// Returns the grid cell whose center is closest to (x, y),
// within a generous snap radius (1.2× cell width). Much more
// forgiving than elementsFromPoint which requires pixel-perfect aim.
function nearestCell(x, y) {
  const cells = document.querySelectorAll('#db-board-grid .db-cell');
  let nearest = null, minDist = Infinity;
  for (const el of cells) {
    const r  = el.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    const d  = Math.hypot(x - cx, y - cy);
    if (d < minDist) { minDist = d; nearest = el; }
  }
  if (!nearest) return null;
  const cellW = nearest.getBoundingClientRect().width;
  return minDist <= cellW * 1.2 ? nearest : null;
}

function rectContains(el, x, y) {
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function updateDropHighlight(x, y) {
  clearHighlights();
  drag.dropTarget = null;

  const dice   = drag.source === 'spawner' ? spawnerDice : parkedDice;
  const rotDeg = drag.source === 'spawner' ? spawnerRotDeg : parkedRotDeg;

  // For a pair the ghost is centered between the two dice.
  // nearestCell must search from the anchor die's center (top-left),
  // not the ghost center, or it lands one cell off.
  let anchorX = x, anchorY = y;
  if (dice.length === 2) {
    const sampleCell = document.querySelector('#db-board-grid .db-cell');
    const D   = sampleCell ? sampleCell.getBoundingClientRect().width : 44;
    const off = D / 2 + 2; // half die + half gap (--space-1 = 4px)
    const rot = canonicalRot(rotDeg);
    if (rot === 90 || rot === 270) anchorY = y - off;
    else                           anchorX = x - off;
  }

  const target = nearestCell(anchorX, anchorY);
  if (!target) return;

  const r      = parseInt(target.dataset.row);
  const c      = parseInt(target.dataset.col);
  const info   = getPlacementInfo(r, c, dice, rotDeg);
  const valid  = canPlace(info.cells);

  info.cells.forEach(([cr, cc]) =>
    cellEl(cr, cc)?.classList.add(valid ? 'db-cell--ok' : 'db-cell--no')
  );

  if (valid) {
    drag.dropTarget = { r, c };
    // Compute the visual center of the target cells for ghost snapping
    const rects = info.cells.map(([cr, cc]) => cellEl(cr, cc)?.getBoundingClientRect()).filter(Boolean);
    if (rects.length) {
      drag.snapPos = {
        x: rects.reduce((s, rc) => s + rc.left + rc.width  / 2, 0) / rects.length,
        y: rects.reduce((s, rc) => s + rc.top  + rc.height / 2, 0) / rects.length,
      };
    }
  }
}


function clearHighlights() {
  document.querySelectorAll('.db-cell--ok, .db-cell--no').forEach(el =>
    el.classList.remove('db-cell--ok', 'db-cell--no')
  );
}

// ── HINT ENGINE ──────────────────────────────────────────────

// Temporarily place dice, run merge check, then restore — no side-effects
function simulateMergeCheck(cells, dicesToPlace) {
  const backup = cells.map(([r, c]) => board[r][c]);
  cells.forEach(([r, c], i) => { board[r][c] = dicesToPlace[i].value; });
  const groups = findMergeGroups();
  cells.forEach(([r, c], i) => { board[r][c] = backup[i]; });
  return groups;
}

// Modifier-aware scoring bonus for a candidate placement.
// Positive = prefer. Negative = avoid. Raw = base merge pts for scaling.
function modifierHintBonus(info, groups, raw) {
  const mod = activeChallenge.modifier;
  let bonus = 0;

  if (mod === 'diseasedDice') {
    const destroyed = info.cells.some(([r, c]) => DIRS.some(([dr, dc]) => {
      const nr = r + dr, nc = c + dc;
      return nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && board[nr][nc] === DISEASED_DIE;
    }));
    if (destroyed) bonus -= 100000;
  }

  if (mod === 'bombDice' && groups.length && [...bombFuses.values()].some(f => f <= 1) && score < SCORE_TARGET) {
    bonus -= 100000;
  }

  if (mod === 'frozenCell' && frozenOrigins.size > 0 && groups.some(g => g.value * g.group.length === 6)) {
    bonus += 1000;
  }

  if (mod === 'hotZone' && hotZoneCells.size) {
    const hitsHot = groups.some(g => g.group.some(([r, c]) => hotZoneCells.has(r * GRID_COLS + c)));
    if (hitsHot) bonus += raw;
  }

  return bonus;
}

// Scan one set of dice for the highest-scoring immediate merge available.
// Collects ALL tied-best placements, prefers those that need no rotation,
// and returns all their unique cells so every valid spot is highlighted.
function bestMergeForDice(dice, source) {
  const currentRot = canonicalRot(source === 'spawner' ? spawnerRotDeg : parkedRotDeg);
  const rots = dice.length === 1 ? [0] : [0, 90, 180, 270];

  // Gather every valid merge placement with its score (plus modifier-aware bonus)
  const all = [];
  for (const rot of rots) {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const info = getPlacementInfo(r, c, dice, rot);
        if (!canPlace(info.cells)) continue;
        const groups = simulateMergeCheck(info.cells, info.dicesToPlace);
        if (!groups.length) continue;
        const pts       = groups.reduce((s, g) => s + g.value * g.group.length, 0);
        const hintScore = pts + modifierHintBonus(info, groups, pts);
        all.push({ cells: info.cells, rot, pts, hintScore, groups });
      }
    }
  }
  if (!all.length) return null;

  const bestScore = Math.max(...all.map(a => a.hintScore));
  if (bestScore < 0) return null; // all placements are traps — fall through to safe placement
  const tied      = all.filter(a => a.hintScore === bestScore);

  // Prefer placements that already match the current rotation
  const noRotTied = tied.filter(a => a.rot === currentRot);
  const useTied   = noRotTied.length ? noRotTied : tied;
  const needsRotation = noRotTied.length === 0;

  // Collect unique cells across all chosen placements
  const seen = new Set();
  const cells = [];
  for (const { cells: c } of useTied) {
    for (const [r, cc] of c) {
      const k = r * GRID_COLS + cc;
      if (!seen.has(k)) { seen.add(k); cells.push([r, cc]); }
    }
  }

  return { cells, score: useTied[0].pts, groups: useTied[0].groups, source, needsRotation };
}

// Fallback: best non-merge placement when no merge is available.
// Scores each candidate by how many adjacencies-to-matching-values it creates (building toward future merges).
// Also penalises diseased-adjacency and prefers current rotation for tied candidates.
function bestSafePlacement(dice, source) {
  const currentRot = canonicalRot(source === 'spawner' ? spawnerRotDeg : parkedRotDeg);
  const rots = dice.length === 1 ? [0] : [0, 90, 180, 270];
  const all = [];
  for (const rot of rots) {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const info = getPlacementInfo(r, c, dice, rot);
        if (!canPlace(info.cells)) continue;
        let s = 0;

        // Reward adjacency to matching values — each neighbour of same value builds toward a merge.
        // Weight by value so a pair adjacent to 5s scores higher than adjacent to 1s.
        info.cells.forEach(([pr, pc], i) => {
          const val = info.dicesToPlace[i].value;
          if (val <= 0) return;
          DIRS.forEach(([dr, dc]) => {
            const nr = pr + dr, nc = pc + dc;
            if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) return;
            // Skip self-adjacencies within the placed pair
            if (info.cells.some(([cr, cc]) => cr === nr && cc === nc)) return;
            if (board[nr][nc] === val) s += 10 + val; // base 10 per match, +value for higher-value synergy
          });
        });

        if (activeChallenge.modifier === 'diseasedDice') {
          const unsafe = info.cells.some(([pr, pc]) => DIRS.some(([dr, dc]) => {
            const nr = pr + dr, nc = pc + dc;
            return nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && board[nr][nc] === DISEASED_DIE;
          }));
          if (unsafe) s -= 100;
        }
        all.push({ cells: info.cells, rot, s });
      }
    }
  }
  if (!all.length) return null;
  const best   = Math.max(...all.map(a => a.s));
  const tied   = all.filter(a => a.s === best);
  const noRot  = tied.filter(a => a.rot === currentRot);
  const chosen = (noRot.length ? noRot : tied)[0];
  return { cells: chosen.cells, source, needsRotation: noRot.length === 0, safe: best >= 0, setupScore: best };
}

// Build the merge-hint message, flavoured by active modifier.
function mergeHintText(best, trayLabel, rotNote) {
  const mod       = activeChallenge.modifier;
  const topGroup  = best.groups[0];
  const mergeSize = topGroup.group.length;
  const sum       = topGroup.value * mergeSize;
  const hitsHot   = mod === 'hotZone' && hotZoneCells.size &&
                    best.groups.some(g => g.group.some(([r, c]) => hotZoneCells.has(r * GRID_COLS + c)));
  if (mod === 'frozenCell' && frozenOrigins.size && sum === 6) {
    return `Merge six here to thaw the ice — uses ${trayLabel}.${rotNote}`;
  }
  if (hitsHot) {
    return `Merge in the hot zone for a 2× bonus — uses ${trayLabel}.${rotNote}`;
  }
  return `Use ${trayLabel} to merge ${mergeSize} ${topGroup.value}-dice and score +${best.score} points!${rotNote}`;
}

function computeHint() {
  const hasDice = spawnerDice.length || parkedDice.length;
  if (!hasDice) return { text: 'No dice to place yet.', cells: [], source: null };

  // ── Priority 1: best modifier-aware merge across BOTH trays ──
  const spawnerBest = spawnerDice.length ? bestMergeForDice(spawnerDice, 'spawner') : null;
  const parkingBest = parkedDice.length  ? bestMergeForDice(parkedDice,  'parking') : null;
  const bestMerge   = !spawnerBest ? parkingBest
                    : !parkingBest ? spawnerBest
                    : spawnerBest.score >= parkingBest.score ? spawnerBest : parkingBest;

  if (bestMerge) {
    const trayLabel = bestMerge.source === 'parking' ? 'your parked dice' : 'your dice';
    const rotNote   = bestMerge.needsRotation ? ' Tap to rotate them first.' : '';
    return {
      text:          mergeHintText(bestMerge, trayLabel, rotNote),
      cells:         bestMerge.cells,
      source:        bestMerge.source,
      needsRotation: bestMerge.needsRotation,
    };
  }

  // ── Priority 2: safe non-merge placement (avoids traps; prefers adjacency setup) ──
  const spawnerSafe = spawnerDice.length ? bestSafePlacement(spawnerDice, 'spawner') : null;
  const parkingSafe = parkedDice.length  ? bestSafePlacement(parkedDice,  'parking') : null;
  const bestSafe    = !spawnerSafe ? parkingSafe
                    : !parkingSafe ? spawnerSafe
                    : (spawnerSafe.setupScore >= parkingSafe.setupScore ? spawnerSafe : parkingSafe);
  if (bestSafe) {
    const trayLabel = bestSafe.source === 'parking' ? 'your parked dice' : 'your dice';
    const rotNote   = bestSafe.needsRotation ? ' Tap to rotate them first.' : '';
    const mod       = activeChallenge.modifier;
    const setsUp    = bestSafe.setupScore > 0;
    let text;
    if (setsUp) {
      text = `No merge yet — place ${trayLabel} here, next to matching dice, to build toward a merge.${rotNote}`;
    } else {
      text = `No merge or setup available — place ${trayLabel} here to keep the board open.${rotNote}`;
    }
    if (mod === 'diseasedDice' && !bestSafe.safe) {
      text = `Every spot risks infection. Park a die or place here — it's the least bad.${rotNote}`;
    } else if (mod === 'diseasedDice') {
      text = `Place ${trayLabel} here — stays clear of diseased dice.${rotNote}`;
    } else if (mod === 'bombDice' && [...bombFuses.values()].some(f => f <= 1) && score < SCORE_TARGET) {
      text = `Bomb detonates on next merge — stall by placing ${trayLabel} here without triggering one.${rotNote}`;
    } else if (mod === 'frozenCell' && frozenOrigins.size) {
      text = `No 6-merge available to thaw — place ${trayLabel} here to build toward one.${rotNote}`;
    }
    return {
      text,
      cells:         bestSafe.cells,
      source:        bestSafe.source,
      needsRotation: bestSafe.needsRotation,
    };
  }

  // ── Fallback: no legal placement ──
  const source = spawnerDice.length ? 'spawner' : 'parking';
  return { text: 'Board is full — no legal placement.', cells: [], source };
}

function showHint() {
  SoundUtils.play('hint-open');
  clearHintHighlights();
  const hint   = computeHint();
  const bodyEl = document.querySelector('#screen-gameplay .game-hint-tooltip__body');
  if (bodyEl) bodyEl.textContent = hint.text;
  hint.cells.forEach(([r, c]) => cellEl(r, c)?.classList.add('db-cell--hint'));
  if (hint.source) {
    const slotId = hint.source === 'spawner' ? 'db-spawner' : 'db-parking';
    const slot   = document.getElementById(slotId);
    if (slot) {
      slot.classList.add('db-tray-slot--hint');
      if (hint.needsRotation) {
        const badge = document.createElement('div');
        badge.className = 'db-hint-rotate-badge';
        Icons.render(badge, 'refresh', { size: 'sm', color: 'primary' });
        slot.appendChild(badge);
      }
    }
  }
}

function clearHintHighlights() {
  document.querySelectorAll('.db-cell--hint').forEach(el => el.classList.remove('db-cell--hint'));
  document.querySelectorAll('.db-tray-slot--hint').forEach(el => el.classList.remove('db-tray-slot--hint'));
  document.querySelectorAll('.db-hint-rotate-badge').forEach(el => el.remove());
}

// ── CALENDAR CHALLENGE PANEL ─────────────────────────────────
const CAL_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAL_DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function onCalDaySelect(iso) {
  activeChallengeDate = iso;
  const ch        = CHALLENGES[iso] ?? DEFAULT_CHALLENGE;
  const d         = new Date(iso + 'T12:00:00');
  const isToday   = iso === TODAY_ISO;
  const isFuture  = iso > TODAY_ISO;
  const completed = getCompletedDates().has(iso);
  SoundUtils.play(completed ? 'cal-day-played' : 'btn-tap');

  const prefixEl     = document.getElementById('db-cal-sel-prefix');
  const todayLabelEl = document.getElementById('db-cal-today-label');
  const badgeTextEl  = document.getElementById('db-cal-badge-text');
  const badgeEl      = document.getElementById('db-cal-badge');
  const trophyEl     = document.getElementById('db-cal-trophy');

  function ordinal(n) { const s=['th','st','nd','rd'],v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
  const MONTHS = GameUtils.MONTH_NAMES;

  const hasName = ch !== DEFAULT_CHALLENGE && ch.label;
  if (hasName) {
    if (prefixEl) prefixEl.textContent = ch.label;
    const dayName  = isToday ? 'Today' : CAL_DAYS[d.getDay()];
    const fullDate = `${ordinal(d.getDate())} of ${MONTHS[d.getMonth()]}`;
    if (todayLabelEl) todayLabelEl.textContent = `${dayName}, ${fullDate}`;
  } else {
    if (prefixEl) prefixEl.textContent = isToday ? 'Today,' : `${CAL_DAYS[d.getDay()]},`;
  }

  const isInProgress = gameActive && iso === playingDate;
  const state = isFuture ? 'unavailable' : isInProgress ? 'in-progress' : completed ? 'played' : 'available';
  if (badgeEl) badgeEl.dataset.state = state;

  const iconMap   = { easy: 'trophyBronze', medium: 'trophySilver', hard: 'trophyGold' };
  const pts = ch.winType === 'chainGoal' ? `${ch.target} chains` : `${ch.target} pts`;
  if (badgeTextEl) badgeTextEl.textContent = pts;
  if (trophyEl)    Icons.render(trophyEl, iconMap[ch.difficulty] ?? 'trophyBronze', { size: 'md' });

  const calBtn = document.getElementById('db-cal-btn');
  if (calBtn) {
    calBtn.classList.toggle('btn--secondary', state === 'played');
    if (state === 'in-progress') calBtn.textContent = 'Resume playing';
    else if (state === 'played') calBtn.textContent = 'Play again';
    else if (isToday)            calBtn.textContent = 'Play today';
    else                         calBtn.textContent = `Play ${ordinal(d.getDate())} of ${MONTHS[d.getMonth()]}`;
  }
}

// ── NAVIGATION ───────────────────────────────────────────────
function rebuildTimer(ch) {
  timerObj?.pause();
  let opts = {};
  let timerToast30Shown = false;
  let timerToast10Shown = false;
  const timerOnTick = (s) => {
    if (s <= 10 && s > 0) {
      SoundUtils.play('timer-low');
      Music.setTension(true);
      if (!timerToast10Shown) {
        SoundUtils.play('toast');
        GameUtils.showToast('db-toast', 'Last 10 seconds!', 8500);
        timerToast10Shown = true;
      }
    } else if (s > 10) {
      if (s === 30 && !timerToast30Shown) {
        SoundUtils.play('toast');
        GameUtils.showToast('db-toast', '30 seconds remaining!', 3000);
        timerToast30Shown = true;
      }
    }
  };
  if (ch.modifier === 'timer') {
    opts = { countdown: ch.modValue, onExpire: () => { if (score < SCORE_TARGET) triggerLose('timer'); }, onTick: timerOnTick };
  } else if (ch.winType === 'surviveTimer') {
    // Non-timer modifier with surviveTimer win type → apply default 90 s clock
    opts = { countdown: 90, onExpire: () => { if (score < SCORE_TARGET) triggerLose('timer'); }, onTick: timerOnTick };
  }
  timerObj = GameUtils.makeTimer(
    document.getElementById('db-timer-group'),
    document.getElementById('db-game-icon-pause'),
    document.getElementById('db-timer-display'),
    opts
  );
}

function placeNullBlocks(count) {
  const empty = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (board[r][c] === 0) empty.push([r, c]);
  for (let i = empty.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [empty[i], empty[j]] = [empty[j], empty[i]];
  }
  empty.slice(0, count).forEach(([r, c]) => { board[r][c] = NULL_BLOCK; });
}

// Frozen cells: fixed corner/edge positions for a puzzle feel.
// Each placed cell gets its own originId so spread can pick a random origin per wave.
function placeFrozenCells(count) {
  const preferred = [
    [0,0],[0,4],[4,0],[4,4],  // corners
    [0,2],[2,0],[4,2],[2,4],  // edge centres
    [1,1],[3,3],[1,3],[3,1],  // inner corners
  ];
  let placed = 0;
  for (const [r, c] of preferred) {
    if (placed >= count) break;
    if (board[r][c] === 0) {
      board[r][c] = FROZEN_CELL;
      frozenOrigins.set(r * GRID_COLS + c, placed + 1);
      placed++;
    }
  }
}

// Frozen cell spread / thaw ──────────────────────────────────
function getFrozenCells() {
  const cells = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (board[r][c] === FROZEN_CELL) cells.push([r, c]);
  return cells;
}

// Pick a random live origin each wave and grow its cluster by one empty cell
// (Manhattan-closest to any cell of that origin). Origins with no reachable empty
// are skipped. Returns true if a lose was triggered.
function spreadFrozenCell() {
  if (!frozenOrigins.size) return false;
  const empty = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (board[r][c] === 0) empty.push([r, c]);
  if (!empty.length) { triggerLose('frozen'); return true; }

  // Group frozen cells by origin
  const byOrigin = new Map();
  for (const [key, origin] of frozenOrigins) {
    const r = Math.floor(key / GRID_COLS), c = key % GRID_COLS;
    if (!byOrigin.has(origin)) byOrigin.set(origin, []);
    byOrigin.get(origin).push([r, c]);
  }

  // Shuffle origin list so we pick randomly, then try each until one has a reachable empty
  const origins = [...byOrigin.keys()];
  for (let i = origins.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [origins[i], origins[j]] = [origins[j], origins[i]];
  }

  for (const origin of origins) {
    const cells = byOrigin.get(origin);
    let bestEmpty = null, bestDist = Infinity;
    for (const [fr, fc] of cells) {
      for (const [er, ec] of empty) {
        const d = Math.abs(er - fr) + Math.abs(ec - fc);
        if (d < bestDist) { bestDist = d; bestEmpty = [er, ec]; }
      }
    }
    if (bestEmpty) {
      const [er, ec] = bestEmpty;
      board[er][ec] = FROZEN_CELL;
      frozenOrigins.set(er * GRID_COLS + ec, origin);
      return false;
    }
  }
  return false;
}

// Remove the entire frozen cluster closest (Manhattan) to the merge centre.
function thawClosestCluster(pr, pc) {
  const frozen = getFrozenCells();
  if (!frozen.length) return;
  // Build connected clusters via BFS
  const visited = new Set();
  const clusters = [];
  for (const [r, c] of frozen) {
    const key = r * GRID_COLS + c;
    if (visited.has(key)) continue;
    const cluster = [];
    const queue = [[r, c]];
    visited.add(key);
    while (queue.length) {
      const [cr, cc] = queue.shift();
      cluster.push([cr, cc]);
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = cr + dr, nc = cc + dc;
        const nkey = nr * GRID_COLS + nc;
        if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS
            && board[nr][nc] === FROZEN_CELL && !visited.has(nkey)) {
          visited.add(nkey);
          queue.push([nr, nc]);
        }
      }
    }
    clusters.push(cluster);
  }
  // Pick the cluster whose nearest cell is closest to (pr, pc)
  let bestCluster = null, bestDist = Infinity;
  for (const cluster of clusters) {
    const d = Math.min(...cluster.map(([r, c]) => Math.abs(r - pr) + Math.abs(c - pc)));
    if (d < bestDist) { bestDist = d; bestCluster = cluster; }
  }
  if (bestCluster) bestCluster.forEach(([r, c]) => {
    board[r][c] = 0;
    frozenOrigins.delete(r * GRID_COLS + c);
  });
}

// Flip dice: random positions (removed when triggered)
function placeFlipDice(count) {
  const empty = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (board[r][c] === 0) empty.push([r, c]);
  for (let i = empty.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [empty[i], empty[j]] = [empty[j], empty[i]];
  }
  empty.slice(0, count).forEach(([r, c]) => { board[r][c] = FLIP_DIE; });
}

// Bomb die: 1 bomb placed near centre, modValue = initial fuse
function placeBombDice(fuse) {
  const preferred = [
    [2,2],[1,2],[2,1],[2,3],[3,2],
    [1,1],[1,3],[3,1],[3,3],
    [0,2],[2,0],[4,2],[2,4],
  ];
  for (const [r, c] of preferred) {
    if (board[r][c] === 0) {
      board[r][c] = BOMB_DIE;
      bombFuses.set(r * GRID_COLS + c, fuse);
      return;
    }
  }
}

// Diseased dice: random positions with minimum Manhattan distance between them
const DISEASED_MIN_DIST = 3;
function placeDiseasedDice(count) {
  const empty = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (board[r][c] === 0) empty.push([r, c]);
  for (let i = empty.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [empty[i], empty[j]] = [empty[j], empty[i]];
  }
  const placed = [];
  const farEnough = ([r, c]) => placed.every(([pr, pc]) => Math.abs(r - pr) + Math.abs(c - pc) >= DISEASED_MIN_DIST);
  // First pass: respect min distance
  for (const cell of empty) {
    if (placed.length >= count) break;
    if (farEnough(cell)) placed.push(cell);
  }
  // Fallback: fill remaining without constraint
  if (placed.length < count) {
    for (const cell of empty) {
      if (placed.length >= count) break;
      if (!placed.includes(cell)) placed.push(cell);
    }
  }
  placed.forEach(([r, c]) => { board[r][c] = DISEASED_DIE; });
}

// ── MODIFIER EFFECTS ─────────────────────────────────────────
const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
const FLIP_MAP = { 1:6, 2:5, 3:4, 4:3, 5:2, 6:1 };

// Flip die activation: when a die is placed adjacent to a flip die,
// the flip die inverts all of its own neighbours, then removes itself.
function applyFlipEffects(placedCells) {
  const flipKeys = new Set();
  for (const [r, c] of placedCells) {
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && board[nr][nc] === FLIP_DIE)
        flipKeys.add(nr * GRID_COLS + nc);
    }
  }
  if (!flipKeys.size) return;
  SoundUtils.play('flip-trigger');
  for (const key of flipKeys) {
    const fr = Math.floor(key / GRID_COLS), fc = key % GRID_COLS;
    board[fr][fc] = 0; // consume flip die
    for (const [dr, dc] of DIRS) {
      const nr = fr + dr, nc = fc + dc;
      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
        const v = board[nr][nc];
        if (v >= 1 && v <= 6) board[nr][nc] = FLIP_MAP[v];
        // Wild dice and other sentinels are not inverted
      }
    }
  }
}

// Diseased die infection: any newly placed die adjacent to a diseased cell
// is immediately overridden to value 6 (infected).
function applyDiseasedEffects(placedCells) {
  for (const [r, c] of placedCells) {
    const v = board[r][c];
    if (v <= 0) continue; // already a sentinel, skip
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && board[nr][nc] === DISEASED_DIE) {
        board[r][c] = 0; // destroyed by disease
        SoundUtils.play('disease-infect');
        break;
      }
    }
  }
}

// ── BOMB TICK / DETONATE ─────────────────────────────────────
function tickBombs() {
  if (!bombFuses.size) return;
  for (const [key, fuse] of bombFuses) {
    const newFuse = fuse - 1;
    if (newFuse <= 0) {
      bombFuses.delete(key);
      const r = Math.floor(key / GRID_COLS), c = key % GRID_COLS;
      board[r][c] = 0;
      detonateBomb(r, c);
      return; // handle one detonation at a time
    }
    bombFuses.set(key, newFuse);
    if (newFuse === 1) SoundUtils.play('bomb-urgent');
    else               SoundUtils.play('bomb-tick');
  }
  renderBoard(); // refresh fuse counters
}

function detonateBomb(r, c) {
  renderBoard();
  SoundUtils.play('bomb-detonate');
  const cell = cellEl(r, c);
  if (cell) cell.classList.add('db-cell--exploding');
  setTimeout(() => triggerLose('bomb'), 700);
}

// ── GOAL DESCRIPTION ─────────────────────────────────────────
function describeGoal(ch) {
  // Win condition sentence
  let goal;
  switch (ch.winType) {
    case 'chainGoal':
      goal = `Trigger a chain of <strong>${ch.target}</strong> consecutive merges in a single turn.`;
      break;
    case 'scoreInMerges':
      goal = `Reach <strong>${ch.target}</strong> points within <strong>${ch.modValue}</strong> merges. Make every placement count!`;
      break;
    case 'surviveTimer':
      goal = `Reach <strong>${ch.target}</strong> points before the timer runs out.`;
      break;
    case 'clearBoard':
      goal = `Clear every die from the board to win. You still receive new dice each turn — merge them all away!`;
      break;
    default:
      goal = `Reach <strong>${ch.target}</strong> points before the board fills up.`;
  }

  // Modifier mechanic explanation (not needed for winType-driven modifiers like maxMerges/timer)
  let mechanic = '';
  switch (ch.modifier) {
    case 'nullBlock': {
      const n = ch.modValue;
      mechanic = ` <strong>${n}</strong> <span class="db-inline-cell db-cell--null" aria-hidden="true"></span> null block${n > 1 ? 's' : ''} permanently occupy cells on the board. You cannot place dice on them.`;
      break;
    }
    case 'frozenCell': {
      const n = ch.modValue;
      mechanic = ` <strong>${n}</strong> <span class="db-inline-cell db-cell--frozen" aria-hidden="true">${SVG_FROZEN}</span> frozen cell${n > 1 ? 's' : ''} spread every merge — creeping toward the nearest empty cell. Merge <strong>6 dice at once</strong> to destroy the closest ice cluster. If the board fills up, you lose.`;
      break;
    }
    case 'flipDice':
      mechanic = ` <span class="db-inline-cell db-cell--flip" aria-hidden="true">${SVG_FLIP}</span> Flip dice sit on the board. Place a die next to one and it inverts all its neighbours' values (7 minus the die value), then vanishes.`;
      break;
    case 'bombDice':
      mechanic = ` A <span class="db-inline-cell db-cell--bomb" aria-hidden="true">${SVG_BOMB}</span> bomb is on the board with a fuse of <strong>${ch.modValue}</strong>. Every new wave ticks it down. When it hits zero, it detonates and you lose.`;
      break;
    case 'diseasedDice':
      mechanic = ` <span class="db-inline-cell db-cell--diseased" aria-hidden="true">${SVG_DISEASED}</span> Diseased dice destroy any die you place next to them. Avoid placing adjacent — or lose that die.`;
      break;
    case 'wildDice': {
      const chipWild = `<span class="db-inline-cell db-inline-cell--wild" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="var(--color-error)"/></svg></span>`;
      mechanic = ` ${chipWild} Wild dice join any merge group regardless of value but cannot start a merge on their own.`;
      break;
    }
    case 'hotZone': {
      const n = ch.modValue;
      const chipHot = `<span class="db-inline-cell db-inline-cell--hot-zone" aria-hidden="true"></span>`;
      mechanic = ` <strong>${n}</strong> ${chipHot} hot zone${n > 1 ? 's' : ''} are marked on the board. Any merge group that includes a hot zone cell scores double for that group.`;
      break;
    }
  }

  return goal + mechanic;
}

function startLoading() {
  gameActive = false;
  Music.stop(); // stop any music from a previous round
  SCORE_TARGET      = scoreTargetFrom(activeChallenge);
  chainDepth        = 0;
  bestChainDepth    = 0;
  chainWon          = false;
  wildSpawned  = 0;
  wildSpawnNum = 0;
  bombFuses    = new Map();
  mergeStreak  = 0;
  turnHadPlacement = false;
  turnHadMerge     = false;
  rewardWordShownThisTurn = false;
  turnMergedDiceCount = 0;
  hotZoneCells = new Set();
  frozenOrigins = new Map();

  rebuildTimer(activeChallenge);

  const goalEl = document.getElementById('db-goal-target');
  if (goalEl) {
    goalEl.textContent = activeChallenge.winType === 'chainGoal'
      ? `${activeChallenge.target} chain`
      : SCORE_TARGET;
  }
  const goalDescEl = document.getElementById('db-goal-desc');
  if (goalDescEl) goalDescEl.innerHTML = describeGoal(activeChallenge);

  GameUtils.navigateTo('loading');
  score = 0; merges = 0; isMerging = false;
  // Reset lose sheet so next game starts with the board-full illustration
  const loseSheetEl = document.getElementById('sheet-lose');
  if (loseSheetEl) loseSheetEl.dataset.reason = 'board-full';
  updateScoreBar();
  initBoard();

  // Place board-level modifier tiles
  const m = activeChallenge.modifier, mv = activeChallenge.modValue;
  if (m === 'nullBlock'    && mv > 0) placeNullBlocks(mv);
  if (m === 'frozenCell'   && mv > 0) placeFrozenCells(mv);
  if (m === 'flipDice'     && mv > 0) placeFlipDice(mv);
  if (m === 'bombDice'     && mv > 0) placeBombDice(mv);
  if (m === 'diseasedDice' && mv > 0) placeDiseasedDice(mv);
  if (m === 'hotZone'      && mv > 0) placeHotZones(mv);

  // clearBoard: pre-place initial dice from challenge definition
  if (activeChallenge.winType === 'clearBoard' && Array.isArray(activeChallenge.initialBoard)) {
    activeChallenge.initialBoard.forEach(([r, c, v]) => {
      if (board[r][c] === 0) board[r][c] = v;
    });
  }

  spawnerDice = []; parkedDice = []; lastPlacedCells = [];
  spawnerRotDeg = 0; parkedRotDeg = 0;
  setTimeout(() => {
    gameActive   = true;
    playingDate  = activeChallengeDate;
    calCtrl?.setInProgressDate(playingDate);
    GameUtils.navigateTo('gameplay');
    timerObj?.reset();
    renderBoard();
    renderParking();
    spawnDice();
    Music.start(); // begin ambient music now that gameplay is visible
    if (firstTimeUser) setTimeout(() => GameUtils.openPopup('popup-welcome'), TIMING.POPUP_SHOW);
    else               setTimeout(() => GameUtils.openPopup('popup-goal'),    TIMING.POPUP_SHOW);
  }, TIMING.LOADING_DELAY);
}

// ── TUTORIAL ─────────────────────────────────────────────────
function showTutorialStep(n) {
  const s = TUTORIAL_STEPS[n];
  document.getElementById('db-tut-step').textContent  = `Step ${n + 1}/${TUTORIAL_STEPS.length}`;
  document.getElementById('db-tut-title').textContent = s.title;
  document.getElementById('db-tut-desc').textContent  = s.desc;
  document.getElementById('db-tut-next').textContent  = n === TUTORIAL_STEPS.length - 1 ? 'Play' : 'Next';
  document.querySelectorAll('.tut-anim').forEach((el, i) =>
    el.classList.toggle('tut-anim--active', i === n)
  );
}
let _tutorialFromWelcome = false;
function openTutorial(fromWelcome = false) {
  _tutorialFromWelcome = fromWelcome;
  tutorialStep = 0;
  showTutorialStep(0);
  document.getElementById('overlay-tutorial').classList.add('is-open');
}
function closeTutorial() {
  document.getElementById('overlay-tutorial').classList.remove('is-open');
  sessionStorage.setItem('db-tutorialSeen', 'true');
  firstTimeUser = false;
  if (_tutorialFromWelcome) {
    _tutorialFromWelcome = false;
    setTimeout(() => GameUtils.openPopup('popup-goal'), TIMING.POPUP_QUICK);
  } else {
    timerObj?.start(); // tutorial opened from settings mid-game — resume
  }
}

// ── THEME ─────────────────────────────────────────────────────
function setTheme(theme) {
  GameUtils.setTheme(theme, 'db-stt-theme', 'db-theme');
}

// ── DOMINANT HAND ─────────────────────────────────────────────
function setHand(hand) {
  document.body.classList.toggle('db--right-hand', hand === 'right');
  localStorage.setItem('db-hand', hand);
  const group = document.getElementById('db-stt-hand');
  if (!group) return;
  group.querySelectorAll('.stt-segment__option').forEach(b => {
    b.classList.toggle('stt-segment__option--active', b.dataset.value === hand);
  });
}

// ── HOME WEEK LIST ────────────────────────────────────────────
function buildHomeWeek() {
  const list = document.getElementById('db-home-week-list');
  if (!list) return;
  const completed = getCompletedDates();
  const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const rows = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(TODAY_ISO + 'T12:00:00');
    d.setDate(d.getDate() - i);
    const iso  = d.toISOString().slice(0, 10);
    const name = i === 1 ? 'Yesterday' : DAY_NAMES[d.getDay()];
    const done = completed.has(iso);
    rows.push(`<div class="home-day-row">
      <span class="home-day-row__name">${name}</span>
      <button class="btn btn--pill${done ? ' btn--pill--done' : ''}" data-date="${iso}">${done ? 'Done' : 'Play'}</button>
    </div>`);
    if (i < 6) rows.push('<div class="divider"></div>');
  }
  list.innerHTML = rows.join('');
  list.querySelectorAll('.btn--pill[data-date]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeChallenge     = CHALLENGES[btn.dataset.date] ?? DEFAULT_CHALLENGE;
      activeChallengeDate = btn.dataset.date;
      startLoading();
    });
  });
}

// ── INTERNAL TEST FLOW ───────────────────────────────────────
// Picks a random unplayed challenge, wires activeChallenge + date, starts loading screen.
function startITChallenge(key) {
  if (!key || !CHALLENGES[key]) key = itPickRandomUnplayed() || IT_CHALLENGE_KEYS[0];
  activeChallenge     = CHALLENGES[key];
  activeChallengeDate = key;
  startLoading();
}
// Refreshes the "Play another challenge" button on a win/lose sheet — disables when no challenges remain.
function itUpdateAnotherButtons() {
  const n = itUnplayedCount();
  ['db-win-btn-another', 'db-lose-btn-another'].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (n === 0) { btn.disabled = true; btn.classList.add('is-disabled'); }
    else         { btn.disabled = false; btn.classList.remove('is-disabled'); }
  });
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  GameUtils.initBtnPress();
  // Pre-warm AudioContext so it's ready before the first tap (avoids first-sound delay).
  SoundUtils.getCtx();
  initBoard();
  renderBoard();
  renderParking();
  updateScoreBar();
  const goalTargetEl = document.getElementById('db-goal-target');
  if (goalTargetEl) goalTargetEl.textContent = todayChallenge.winType === 'chainGoal'
    ? `${todayChallenge.target} chain`
    : SCORE_TARGET;

  // All static icons — [id, iconName, size, color|null]
  [
    // Nav bar — 4 screens × 4 icons
    ['db-home-icon-back',        'chevronLeft',    'md',   'primary'],
    ['db-home-icon-feedback',    'feedback',       'md',   'primary'],
    ['db-home-icon-share',       'share',          'md',   'primary'],
    ['db-home-icon-heart',       'heartFull',      'md',   'error'  ],
    ['db-loading-icon-back',     'chevronLeft',    'md',   'primary'],
    ['db-loading-icon-feedback', 'feedback',       'md',   'primary'],
    ['db-loading-icon-share',    'share',          'md',   'primary'],
    ['db-loading-icon-heart',    'heartFull',      'md',   'error'  ],
    ['db-game-icon-back',        'chevronLeft',    'md',   'primary'],
    ['db-game-icon-feedback',    'feedback',       'md',   'primary'],
    ['db-game-icon-share',       'share',          'md',   'primary'],
    ['db-game-icon-heart',       'heartFull',      'md',   'error'  ],
    ['db-tut-icon-back',         'chevronLeft',    'md',   'primary'],
    ['db-tut-icon-feedback',     'feedback',       'md',   'primary'],
    ['db-tut-icon-share',        'share',          'md',   'primary'],
    ['db-tut-icon-heart',        'heartFull',      'md',   'error'  ],
    // Toolbar
    ['db-game-icon-info',        'info',           'md',   'primary'],
    ['db-game-icon-hint',        'hint',           'md',   'primary'],
    ['db-game-icon-hint-close',  'cross',          'md',   null     ],
    ['db-game-icon-pause',       'pause',          'md',   null     ],
    ['db-game-icon-refresh',     'refresh',        'md',   'primary'],
    ['db-game-icon-stats',       'stats',          'md',   'primary'],
    ['db-game-icon-settings',    'settings',       'md',   'primary'],
    // Score bar
    ['db-score-icon',            'target',         'md',   'primary'],
    ['db-merges-icon',           'merges',         'md',   'primary'],
    // Settings
    ['db-stt-theme-dark',        'themeDark',      'tiny', 'primary'],
    ['db-stt-theme-auto',        'themeAutomatic', 'tiny', 'primary'],
    ['db-stt-theme-light',       'themeLight',     'tiny', 'primary'],
    ['db-stt-hand-left',         'arrowLeft',      'tiny', 'primary'],
    ['db-stt-hand-right',        'arrowLeft',      'tiny', 'primary'],
    ['db-stt-icon-howto',        'question',       'md',   'primary'],
    ['db-stt-icon-stats',        'stairs',         'md',   'primary'],
    ['db-stt-icon-bible',        'book',           'md',   'primary'],
    ['db-stt-icon-reset-level',  'refresh',        'md',   'primary'],
  ].forEach(([id, name, size, color]) => {
    const el = document.getElementById(id);
    if (el) Icons.render(el, name, color ? { size, color } : { size });
  });

  // Shared utilities (calendar + home disabled for internal testing)
  GameUtils.initFeedbackForm('db');
  GameUtils.buildStreakGrid('db-stat-streak-grid', getCompletedDates());

  // Sheet scrollbars
  GameUtils.initSheetScrollbar('db-instr-wrap',    'db-instr-thumb');
  GameUtils.initSheetScrollbar('db-stats-wrap',    'db-stats-thumb');
  GameUtils.initSheetScrollbar('db-settings-wrap', 'db-settings-thumb');
  GameUtils.initSheetScrollbar('db-feedback-wrap', 'db-feedback-thumb');

  // Theme
  setTheme(localStorage.getItem('db-theme') || 'auto');

  // Dominant hand (default: right)
  setHand(localStorage.getItem('db-hand') || 'right');

  // ── SOUND & MUSIC PREFERENCES ────────────────────────────────
  // Apply persisted preferences before any sound can fire.
  // SFX: on by default (key absent = enabled). Music: off by default.
  SoundUtils.setEnabled(localStorage.getItem('db-sfx') !== 'false');
  Music.setEnabled(localStorage.getItem('db-music') === 'true');
  document.getElementById('db-toggle-sfx').checked   = SoundUtils.isEnabled();
  document.getElementById('db-toggle-music').checked = Music.isEnabled();

  document.getElementById('db-toggle-sfx').addEventListener('change', ev => {
    SoundUtils.setEnabled(ev.target.checked);
    localStorage.setItem('db-sfx', ev.target.checked);
  });
  document.getElementById('db-toggle-music').addEventListener('change', ev => {
    Music.setEnabled(ev.target.checked);
    localStorage.setItem('db-music', ev.target.checked);
    // If enabling while gameplay is active and music isn't running, start it now
    if (ev.target.checked && document.getElementById('screen-gameplay')?.classList.contains('is-active') && !Music.isRunning()) {
      Music.start();
    }
  });

  // ── SHEET / TOAST SOUNDS (monkey-patch GameUtils) ────────────
  // Intercept openSheet/closeSheet/showToast so every call automatically
  // plays the right SFX and fades music in/out — no per-callsite changes needed.
  let _musicResumeTimer = null;
  const _origOpen  = GameUtils.openSheet.bind(GameUtils);
  const _origClose = GameUtils.closeSheet.bind(GameUtils);
  const _origToast = GameUtils.showToast.bind(GameUtils);

  GameUtils.openSheet = function(id) {
    // Win/lose sheets have their own dedicated sounds; skip sheet-open for them
    if (id !== 'sheet-win' && id !== 'sheet-lose') SoundUtils.play('sheet-open');
    clearTimeout(_musicResumeTimer); // cancel any pending fade-in
    Music.fadePause();
    _origOpen(id);
  };
  GameUtils.closeSheet = function(id) {
    SoundUtils.play('sheet-close');
    _origClose(id);
    // Delay resume so switching sheets doesn't cause a brief volume bump
    _musicResumeTimer = setTimeout(() => {
      if (!document.querySelector('.sheet-overlay.is-open')) Music.fadeResume();
    }, 220);
  };
  GameUtils.showToast = function(...args) {
    SoundUtils.play('toast');
    _origToast(...args);
  };

  // Timer — built per-game in rebuildTimer() called from startLoading()
  document.getElementById('db-timer-group').addEventListener('click', () => {
    if (timerObj?.isRunning()) { timerObj.pause(); GameUtils.openSheet('sheet-pause'); }
  });

  // Exit popup (unreachable in internal test — back buttons removed — but kept defensive)
  document.getElementById('db-btn-exit-confirm')?.addEventListener('click', () => { SoundUtils.play('btn-tap'); Music.stop(); GameUtils.closePopup('popup-exit'); window.location.reload(); });
  document.getElementById('db-btn-exit-stay')?.addEventListener('click',    () => { SoundUtils.play('btn-tap'); GameUtils.closePopup('popup-exit'); timerObj?.start(); });

  // Welcome popup
  document.getElementById('db-btn-letsgo').addEventListener('click', () => { SoundUtils.play('btn-tap'); GameUtils.closePopup('popup-welcome'); openTutorial(true); });
  document.getElementById('db-btn-skip-tutorial').addEventListener('click', () => {
    SoundUtils.play('btn-tap');
    GameUtils.closePopup('popup-welcome');
    sessionStorage.setItem('db-tutorialSeen', 'true');
    firstTimeUser = false;
    GameUtils.openPopup('popup-goal');
  });

  // Goal popup
  document.getElementById('db-btn-ready').addEventListener('click', () => { SoundUtils.play('btn-tap'); GameUtils.closePopup('popup-goal'); timerObj?.start(); });

  // Tutorial next / finish
  document.getElementById('db-tut-next').addEventListener('click', () => {
    SoundUtils.play('btn-tap');
    if (tutorialStep < TUTORIAL_STEPS.length - 1) showTutorialStep(++tutorialStep);
    else closeTutorial();
  });

  // data-sheet buttons → pause timer + open sheet
  document.querySelectorAll('[data-sheet]').forEach(btn =>
    btn.addEventListener('click', () => {
      if (timerObj?.isRunning()) timerObj.pause();
      if (btn.dataset.sheet === 'sheet-stats') renderStats();
      GameUtils.openSheet(btn.dataset.sheet);
    })
  );

  // Reset-level refresh button → open confirm modal (pause timer first)
  document.getElementById('db-game-icon-refresh')?.addEventListener('click', () => {
    if (timerObj?.isRunning()) timerObj.pause();
    GameUtils.openPopup('popup-reset');
  });
  document.getElementById('db-btn-reset-cancel')?.addEventListener('click', () => {
    SoundUtils.play('btn-tap');
    GameUtils.closePopup('popup-reset');
    timerObj?.start();
  });
  document.getElementById('db-btn-reset-confirm')?.addEventListener('click', () => {
    SoundUtils.play('btn-tap');
    GameUtils.closePopup('popup-reset');
    setTimeout(() => startITChallenge(activeChallengeDate), TIMING.NAV_DELAY);
  });

  // Pause continue
  document.getElementById('db-btn-pause-reset').addEventListener('click', () => { SoundUtils.play('btn-tap'); GameUtils.switchSheet('sheet-pause', startLoading, TIMING.NAV_DELAY); });
  document.getElementById('db-btn-continue').addEventListener('click', () => { GameUtils.closeSheet('sheet-pause'); timerObj.start(); });

  // Instructions close
  document.getElementById('db-btn-close-info').addEventListener('click', () => { GameUtils.closeSheet('sheet-info'); timerObj?.start(); });

  // Inject special dice icons into info sheet
  const wildSVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="var(--color-error)"/></svg>`;
  const infoIcons = {
    'db-info-icon-wild':     wildSVG,
    'db-info-icon-frozen':   SVG_FROZEN,
    'db-info-icon-flip':     SVG_FLIP,
    'db-info-icon-bomb':     `<div class="db-bomb-icon">${SVG_BOMB}</div>`,
    'db-info-icon-diseased': SVG_DISEASED,
  };
  Object.entries(infoIcons).forEach(([id, html]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });

  // Stats close
  document.getElementById('db-btn-close-stats').addEventListener('click', () => { GameUtils.closeSheet('sheet-stats'); timerObj?.start(); });

  // Settings — segment toggle
  document.querySelectorAll('.stt-segment').forEach(group =>
    group.addEventListener('click', e => {
      const btn = e.target.closest('.stt-segment__option');
      if (!btn) return;
      SoundUtils.play('btn-tap');
      group.querySelectorAll('.stt-segment__option').forEach(b => b.classList.remove('stt-segment__option--active'));
      btn.classList.add('stt-segment__option--active');
      if (group.id === 'db-stt-theme') setTheme(btn.dataset.value);
      if (group.id === 'db-stt-hand')  setHand(btn.dataset.value);
    })
  );

  // Settings shortcuts
  document.getElementById('db-stt-btn-howto').addEventListener('click', () => { SoundUtils.play('btn-tap'); GameUtils.switchSheet('sheet-settings', openTutorial); });
  document.getElementById('db-stt-btn-stats').addEventListener('click', () => { SoundUtils.play('btn-tap'); GameUtils.switchSheet('sheet-settings', () => { renderStats(); GameUtils.openSheet('sheet-stats'); }); });
  document.getElementById('db-stt-btn-bible').addEventListener('click', () => { SoundUtils.play('btn-tap'); GameUtils.closeSheet('sheet-settings'); window.location.href = './dobbelaar-bible.html'; });
  document.getElementById('db-stt-btn-reset-level').addEventListener('click', () => { SoundUtils.play('btn-tap'); GameUtils.switchSheet('sheet-settings', startLoading, TIMING.NAV_DELAY); });
  document.getElementById('db-btn-save-settings').addEventListener('click', () => { SoundUtils.play('btn-tap'); GameUtils.closeSheet('sheet-settings'); timerObj?.start(); GameUtils.showToast('db-toast', 'Settings saved!'); });
  document.getElementById('db-btn-reset-settings').addEventListener('click', () => {
    SoundUtils.play('btn-tap');
    setHand('right');
    setTheme('auto');
    SoundUtils.setEnabled(true);
    document.getElementById('db-toggle-sfx').checked = true;
    localStorage.setItem('db-sfx', 'true');
    Music.setEnabled(false);
    document.getElementById('db-toggle-music').checked = false;
    localStorage.setItem('db-music', 'false');
    GameUtils.showToast('db-toast', 'Settings reset to defaults.');
  });

  // Win / lose actions (internal test flow)
  document.getElementById('db-win-btn-share')?.addEventListener('click', () => { SoundUtils.play('btn-tap'); GameUtils.showToast('db-toast', 'Sharing…'); });
  document.getElementById('db-win-btn-another')?.addEventListener('click', () => {
    SoundUtils.play('btn-tap');
    if (itUnplayedCount() === 0) return; // defensive — button should be disabled
    clearInterval(winCountdownInterval);
    GameUtils.switchSheet('sheet-win', () => startITChallenge(itPickRandomUnplayed()), TIMING.NAV_DELAY);
  });
  document.getElementById('db-lose-btn-retry')?.addEventListener('click', () => { SoundUtils.play('btn-tap'); GameUtils.switchSheet('sheet-lose', () => startITChallenge(activeChallengeDate), TIMING.NAV_DELAY); });
  document.getElementById('db-lose-btn-another')?.addEventListener('click', () => {
    SoundUtils.play('btn-tap');
    if (itUnplayedCount() === 0) return;
    GameUtils.switchSheet('sheet-lose', () => startITChallenge(itPickRandomUnplayed()), TIMING.NAV_DELAY);
  });

  // Feedback
  document.getElementById('db-btn-send-feedback').addEventListener('click', () => {
    SoundUtils.play('btn-tap');
    GameUtils.closeSheet('sheet-feedback');
    timerObj?.start();
    setTimeout(() => GameUtils.showToast('db-toast', 'Thanks for your feedback!'), TIMING.TOAST_DELAY);
  });

  // Hint toggle — compute contextual hint, auto-close after 5 s
  document.getElementById('db-game-icon-hint').addEventListener('click', () => {
    const wrap = document.getElementById('db-game-hint-wrap');
    if (!wrap) return;
    const isOpen = wrap.classList.toggle('game-hint-wrap--open');
    clearTimeout(hintTimeout);
    clearHintHighlights();
    if (isOpen) {
      showHint();
      hintTimeout = setTimeout(() => {
        wrap.classList.remove('game-hint-wrap--open');
        clearHintHighlights();
      }, TIMING.HINT_AUTO_CLOSE);
    }
  });
  document.getElementById('db-game-icon-hint-close').addEventListener('click', e => {
    e.stopPropagation();
    SoundUtils.play('btn-tap');
    clearTimeout(hintTimeout);
    clearHintHighlights();
    document.getElementById('db-game-hint-wrap')?.classList.remove('game-hint-wrap--open');
  });

  // ── INTERNAL TEST ENTRY ────────────────────────────────────
  // Skip home screen entirely — go straight into a random challenge.
  itUpdateAnotherButtons();
  startITChallenge(itPickRandomUnplayed());
});
