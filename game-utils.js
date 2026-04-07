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
  openSheet(id)  { document.getElementById(id)?.classList.add('is-open'); },
  closeSheet(id) { document.getElementById(id)?.classList.remove('is-open'); },

  // Call once per game after DOMContentLoaded.
  // Handles scrim-click dismiss for all .sheet-overlay elements,
  // skipping any marked with data-no-dismiss (e.g. win / lose sheets).
  // onDismiss(overlay) is called after closing — use it to resume timers etc.
  initSheetDismiss(onDismiss) {
    document.querySelectorAll('.sheet-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target !== overlay) return;
        if (overlay.hasAttribute('data-no-dismiss')) return;
        this.closeSheet(overlay.id);
        onDismiss?.(overlay);
      });
    });
  },

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
  makeTimer(groupEl, iconEl, displayEl) {
    let seconds = 0, running = false, interval = null;
    function tick() {
      seconds++;
      displayEl.textContent =
        String(Math.floor(seconds / 60)).padStart(2, '0') + ':' +
        String(seconds % 60).padStart(2, '0');
    }
    function start()     { if (running) return; running = true;  interval = setInterval(tick, 1000); Icons.render(iconEl, 'pause', { size: 'md' }); groupEl.setAttribute('aria-label', 'Pause'); }
    function pause()     { if (!running) return; running = false; clearInterval(interval);            Icons.render(iconEl, 'play',  { size: 'md' }); groupEl.setAttribute('aria-label', 'Play'); }
    function reset()     { pause(); seconds = 0; displayEl.textContent = '00:00'; }
    function isRunning() { return running; }
    return { start, pause, reset, isRunning };
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
  buildStreakGrid(gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);

    grid.innerHTML = '';
    let streak = 0;
    for (let i = 0; i < 7; i++) {
      const d    = new Date(monday);
      d.setDate(monday.getDate() + i);
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      if (d.getTime() === today.getTime()) {
        cell.classList.add('cal-day--in-progress');
        cell.innerHTML = String(d.getDate()) + this.CORNER_SVG;
        streak++;
      } else if (d < today) {
        cell.classList.add('cal-day--completed');
        cell.innerHTML = this.CHECK_SVG;
        streak++;
      } else {
        cell.classList.add('cal-day--unavailable');
        cell.innerHTML = String(d.getDate());
      }
      grid.appendChild(cell);
    }
    const title = grid.closest('.stat-streak')?.querySelector('.stat-streak__title');
    if (title) title.textContent = `${streak} Daily streak`;
  },

  // ── CALENDAR ────────────────────────────────────────────────
  // Call from inside DOMContentLoaded. Derives all element IDs from prefix.
  // e.g. prefix 'db' → 'db-cal-title', 'db-cal-grid', etc.
  initCalendar(prefix) {
    const self = this;
    const TODAY       = new Date();
    const COMPLETED   = new Set();
    const IN_PROGRESS = new Set([TODAY.getDate()]);
    for (let i = 1; i <= 3; i++) { const d = TODAY.getDate() - i; if (d > 0) COMPLETED.add(d); }

    let viewYear = TODAY.getFullYear(), viewMonth = TODAY.getMonth();
    let selYear  = viewYear, selMonth = viewMonth, selDay = TODAY.getDate();

    function ordinal(n) {
      const s = ['th','st','nd','rd'], v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }
    function dayState(y, m, d) {
      const day = new Date(y, m, d);
      const tod = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
      if (day > tod) return 'unavailable';
      if (y === TODAY.getFullYear() && m === TODAY.getMonth()) {
        if (COMPLETED.has(d))   return 'completed';
        if (IN_PROGRESS.has(d)) return 'in-progress';
      }
      return 'default';
    }
    function renderCal() {
      const title  = document.getElementById(`${prefix}-cal-title`);
      const grid   = document.getElementById(`${prefix}-cal-grid`);
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

      for (let i = 0; i < emptyCount; i++) {
        const el = document.createElement('div');
        el.className = 'cal-day cal-day--empty';
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
        el.className = cls.join(' ');
        if (state === 'completed')        el.innerHTML = self.CHECK_SVG;
        else if (state === 'in-progress') el.innerHTML = String(d) + self.CORNER_SVG;
        else                              el.innerHTML = String(d);
        el.setAttribute('aria-label', `${d} ${self.MONTH_NAMES[viewMonth]}`);
        if (state !== 'unavailable') {
          el.addEventListener('click', () => { selYear = viewYear; selMonth = viewMonth; selDay = d; renderCal(); });
        }
        grid.appendChild(el);
      }
      const total = emptyCount + daysInMonth;
      for (let i = total; i < 42; i++) {
        const el = document.createElement('div');
        el.className = 'cal-day cal-day--empty';
        grid.appendChild(el);
      }
    }
    function navCal(y, m) {
      viewYear = y; viewMonth = m;
      const isCurrent = (y === TODAY.getFullYear() && m === TODAY.getMonth());
      if (isCurrent) {
        selYear = y; selMonth = m; selDay = TODAY.getDate();
      } else {
        const isPast = (y < TODAY.getFullYear()) || (y === TODAY.getFullYear() && m < TODAY.getMonth());
        if (isPast) { selYear = y; selMonth = m; selDay = 1; }
        else        { selYear = -1; selMonth = -1; selDay = -1; }
      }
      renderCal();
    }

    const prev = document.getElementById(`${prefix}-cal-prev`);
    const next = document.getElementById(`${prefix}-cal-next`);
    if (prev) prev.addEventListener('click', () => { let y = viewYear, m = viewMonth - 1; if (m < 0) { m = 11; y--; } navCal(y, m); });
    if (next) next.addEventListener('click', () => { let y = viewYear, m = viewMonth + 1; if (m > 11) { m = 0; y++; } navCal(y, m); });
    Icons.render(document.getElementById(`${prefix}-cal-prev`),   'chevronLeft',  { size: 'md', color: 'primary' });
    Icons.render(document.getElementById(`${prefix}-cal-next`),   'chevronLeft',  { size: 'md', color: 'primary' });
    Icons.render(document.getElementById(`${prefix}-cal-trophy`), 'trophyBronze', { size: 'md' });
    renderCal();
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
    stars.forEach((btn, i) => {
      if (!btn) return;
      btn.addEventListener('click', () => { rating = i < rating ? i : i + 1; renderStars(rating); });
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

  // ── HOME DATE + WEEK ROWS ───────────────────────────────────
  // Sets the date label and fills the last-week day name rows.
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
