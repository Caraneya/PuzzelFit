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
  { title: 'More pairs = higher score', desc: 'Increase your score by matching all the dice on the grid.',                                                          icon: '🏆' },
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
  const pips = (PIP_POSITIONS[value] || []).map(([x,y]) =>
    `<circle cx="${x}%" cy="${y}%" r="9%"/>`
  ).join('');
  return `<div class="db-die db-die--${value}"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${pips}</svg></div>`;
}

// ── GAME CONSTANTS ───────────────────────────────────────────
const GRID_ROWS    = 5;
const GRID_COLS    = 5;
const SCORE_TARGET = 300; // Today's challenge goal

// ── GAME STATE ───────────────────────────────────────────────
let board   = [];
let score   = 0;
let merges  = 0;
let timerObj      = null;
let tutorialStep  = 0;
let firstTimeUser = !sessionStorage.getItem('db-tutorialSeen');

let spawnerDice   = [];  // [{value}]  1–2 items
let spawnerRotDeg = 0;   // cumulative degrees (multiples of 90)
let parkedDice    = [];  // [{value}]  0–2 items
let parkedRotDeg  = 0;   // cumulative degrees
let isMerging     = false;
let hintTimeout   = null;

// ── DRAG STATE ───────────────────────────────────────────────
// pending = pointerdown received, but hasn't moved past threshold yet
const drag = { active: false, pending: false, source: null, startX: 0, startY: 0, ghostEl: null, hiddenInner: null, dropTarget: null };

// ── BOARD HELPERS ────────────────────────────────────────────
function initBoard() {
  board = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));
}

function randomDie() {
  return { value: Math.ceil(Math.random() * 5) }; // 1–5
}

// ── SPAWN ────────────────────────────────────────────────────
function spawnDice() {
  const count = Math.random() < 0.35 ? 1 : 2;
  spawnerDice   = Array.from({ length: count }, randomDie);
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
  popEl(document.getElementById('db-score-value'),  `${score}/${SCORE_TARGET}`);
  popEl(document.getElementById('db-merges-value'), String(merges));
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
      if (val > 0) cell.innerHTML = renderDie(val);
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

  if (!parkedDice.length) return;

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
  clearHintHighlights();
  clearTimeout(hintTimeout);
  document.getElementById('db-game-hint-wrap')?.classList.remove('game-hint-wrap--open');
  renderBoard();
  setTimeout(() => triggerMergeCheck(), 30);
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
function handleParkDrop() {
  // User dragged FROM spawner and dropped ON parking
  if (!spawnerDice.length) return;
  if (!parkedDice.length) {
    // One-way: ghost already shows movement — update instantly
    parkedDice   = spawnerDice.slice();
    parkedRotDeg = spawnerRotDeg;
    spawnerDice  = [];
    renderParking();
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
  if (board[r][c] !== val) return [];
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
      if (!val) continue;
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

  groups.forEach(({ group }) =>
    group.forEach(([r, c]) => cellEl(r, c)?.classList.add('db-cell--merging'))
  );

  setTimeout(() => {
    const newDice = [];
    let earned = 0;

    groups.forEach(({ group, value }) => {
      const sum = value * group.length;
      earned += sum;
      merges++;
      group.forEach(([r, c]) => { board[r][c] = 0; });

      if (sum <= 6) {
        const [r0, c0] = group[0];
        board[r0][c0] = sum;
        newDice.push([r0, c0]);
      }

      const [fr, fc] = group[Math.floor(group.length / 2)];
      floatScore(fr, fc, `+${sum}`);
    });

    score += earned;
    updateScoreBar();
    renderBoard();

    newDice.forEach(([r, c]) =>
      requestAnimationFrame(() => cellEl(r, c)?.classList.add('db-cell--pop'))
    );

    isMerging = false;
    setTimeout(() => triggerMergeCheck(), 80);
  }, 360);
}

function onTurnEnd() {
  if (checkWin()) return;
  if (checkLose()) return;
  if (!spawnerDice.length) {
    spawnDice();
    // After spawning, verify the player has at least one valid placement
    if (!hasAnyValidMove(spawnerDice)) {
      triggerLose();
    }
  }
}

// ── FLOATING SCORE ───────────────────────────────────────────
function floatScore(r, c, text) {
  const el = cellEl(r, c);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const div  = document.createElement('div');
  div.className = 'db-float-score';
  div.textContent = text;
  div.style.cssText = `left:${rect.left + rect.width / 2}px;top:${rect.top}px`;
  document.body.appendChild(div);
  requestAnimationFrame(() => requestAnimationFrame(() => div.classList.add('db-float-score--up')));
  setTimeout(() => div.remove(), 750);
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

function checkWin() {
  if (score >= SCORE_TARGET) {
    timerObj?.pause();
    const countdownEl = document.getElementById('db-win-countdown');
    if (countdownEl) {
      countdownEl.textContent = timeUntilNextChallenge();
      clearInterval(winCountdownInterval);
      winCountdownInterval = setInterval(() => {
        countdownEl.textContent = timeUntilNextChallenge();
      }, 1000);
    }
    setTimeout(() => GameUtils.openSheet('sheet-win'), 600);
    return true;
  }
  return false;
}

function triggerLose() {
  timerObj?.pause();
  const el = document.getElementById('db-lose-score');
  if (el) el.textContent = score;
  setTimeout(() => GameUtils.openSheet('sheet-lose'), 600);
}

function checkLose() {
  const full = board.every(row => row.every(v => v > 0));
  if (full) { triggerLose(); return true; }
  return false;
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

const HINT_TIPS = [
  'Keep same-value dice close together to set up bigger merges.',
  'Use the parking spot to hold a die while you set up a merge elsewhere.',
  'A merge of three 2-dice creates a 6-die. A 6-die merge scores big and clears the board!',
  'Rotating a pair before placing can open up merges in tight spots.',
  'Merges that sum to ≤ 6 leave a new die behind — chain them for bonus points!',
];
let hintTipIndex = 0;

// Scan one set of dice for the highest-scoring immediate merge available.
// Collects ALL tied-best placements, prefers those that need no rotation,
// and returns all their unique cells so every valid spot is highlighted.
function bestMergeForDice(dice, source) {
  const currentRot = canonicalRot(source === 'spawner' ? spawnerRotDeg : parkedRotDeg);
  const rots = dice.length === 1 ? [0] : [0, 90, 180, 270];

  // Gather every valid merge placement with its score
  const all = [];
  for (const rot of rots) {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const info = getPlacementInfo(r, c, dice, rot);
        if (!canPlace(info.cells)) continue;
        const groups = simulateMergeCheck(info.cells, info.dicesToPlace);
        if (!groups.length) continue;
        const pts = groups.reduce((s, g) => s + g.value * g.group.length, 0);
        all.push({ cells: info.cells, rot, pts, groups });
      }
    }
  }
  if (!all.length) return null;

  const bestScore = Math.max(...all.map(a => a.pts));
  const tied      = all.filter(a => a.pts === bestScore);

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

  return { cells, score: bestScore, groups: useTied[0].groups, source, needsRotation };
}

function computeHint() {
  const hasDice = spawnerDice.length || parkedDice.length;
  if (!hasDice) return { text: 'No dice to place yet.', cells: [], source: null };

  // ── Priority 1: best immediate merge across BOTH trays ──
  const spawnerBest = spawnerDice.length ? bestMergeForDice(spawnerDice, 'spawner') : null;
  const parkingBest = parkedDice.length  ? bestMergeForDice(parkedDice,  'parking') : null;
  const bestMerge   = !spawnerBest ? parkingBest
                    : !parkingBest ? spawnerBest
                    : spawnerBest.score >= parkingBest.score ? spawnerBest : parkingBest;

  if (bestMerge) {
    const topGroup  = bestMerge.groups[0];
    const mergeSize = topGroup.group.length;
    const trayLabel = bestMerge.source === 'parking' ? 'your parked dice' : 'your dice';
    const rotNote   = bestMerge.needsRotation ? ' Tap to rotate them first.' : '';
    return {
      text:         `Use ${trayLabel} to merge ${mergeSize} ${topGroup.value}-dice and score +${bestMerge.score} points!${rotNote}`,
      cells:        bestMerge.cells,
      source:       bestMerge.source,
      needsRotation: bestMerge.needsRotation,
    };
  }

  // ── Priority 2: existing pair that either tray can complete ──
  const visited2 = new Set();
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const val = board[r][c];
      if (!val) continue;
      const key = r * GRID_COLS + c;
      if (visited2.has(key)) continue;
      const group = floodFill(r, c, val, new Set());
      group.forEach(([gr, gc]) => visited2.add(gr * GRID_COLS + gc));
      if (group.length !== 2) continue;
      const matchSource = spawnerDice.some(d => d.value === val) ? 'spawner'
                        : parkedDice.some(d => d.value === val)  ? 'parking'
                        : null;
      if (matchSource) {
        const trayLabel = matchSource === 'parking' ? 'your parked dice' : 'your dice';
        return {
          text:  `Two ${val}-dice are adjacent — use ${trayLabel} to complete the merge!`,
          cells: [],
          source: matchSource,
        };
      }
    }
  }

  // ── Priority 3: board pressure warning ──
  const filled = board.flat().filter(v => v > 0).length;
  if (filled >= 18) {
    const source = spawnerDice.length ? 'spawner' : 'parking';
    return {
      text:  'The board is getting full. Use the parking spot to buy time and plan a better placement.',
      cells: [],
      source,
    };
  }

  // ── Priority 4: rotating strategic tip ──
  const tip = HINT_TIPS[hintTipIndex % HINT_TIPS.length];
  hintTipIndex++;
  const source = spawnerDice.length ? 'spawner' : 'parking';
  return { text: tip, cells: [], source };
}

function showHint() {
  clearHintHighlights();
  const hint   = computeHint();
  const bodyEl = document.querySelector('#db-game-hint-wrap .game-hint-tooltip__body');
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

// ── NAVIGATION ───────────────────────────────────────────────
function startLoading() {
  GameUtils.navigateTo('loading');
  score = 0; merges = 0; isMerging = false;
  updateScoreBar();
  initBoard();
  spawnerDice = []; parkedDice = [];
  spawnerRotDeg = 0; parkedRotDeg = 0;
  setTimeout(() => {
    GameUtils.navigateTo('gameplay');
    timerObj?.reset();
    renderBoard();
    renderParking();
    spawnDice();
    if (firstTimeUser) setTimeout(() => GameUtils.openPopup('popup-welcome'), 500);
    else               setTimeout(() => GameUtils.openPopup('popup-goal'),    500);
  }, 2000);
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
function openTutorial() {
  tutorialStep = 0;
  showTutorialStep(0);
  document.getElementById('overlay-tutorial').classList.add('is-open');
}
function closeTutorial() {
  document.getElementById('overlay-tutorial').classList.remove('is-open');
  const wasFirstTime = firstTimeUser;
  sessionStorage.setItem('db-tutorialSeen', 'true');
  firstTimeUser = false;
  if (wasFirstTime) setTimeout(() => GameUtils.openPopup('popup-goal'), 200);
}

// ── THEME ─────────────────────────────────────────────────────
function setTheme(theme) {
  GameUtils.setTheme(theme, 'db-stt-theme', 'db-theme');
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  initBoard();
  renderBoard();
  renderParking();
  updateScoreBar();

  // Nav bar icons
  [
    ['db-home-icon-back',        'chevronLeft', 'md', 'primary'],
    ['db-home-icon-feedback',    'feedback',    'md', 'primary'],
    ['db-home-icon-share',       'share',       'md', 'primary'],
    ['db-home-icon-heart',       'heartFull',   'md', 'error'],
    ['db-loading-icon-back',     'chevronLeft', 'md', 'primary'],
    ['db-loading-icon-feedback', 'feedback',    'md', 'primary'],
    ['db-loading-icon-share',    'share',       'md', 'primary'],
    ['db-loading-icon-heart',    'heartFull',   'md', 'error'],
    ['db-game-icon-back',        'chevronLeft', 'md', 'primary'],
    ['db-game-icon-feedback',    'feedback',    'md', 'primary'],
    ['db-game-icon-share',       'share',       'md', 'primary'],
    ['db-game-icon-heart',       'heartFull',   'md', 'error'],
    ['db-tut-icon-back',         'chevronLeft', 'md', 'primary'],
    ['db-tut-icon-feedback',     'feedback',    'md', 'primary'],
    ['db-tut-icon-share',        'share',       'md', 'primary'],
    ['db-tut-icon-heart',        'heartFull',   'md', 'error'],
  ].forEach(([id, name, size, color]) => {
    const el = document.getElementById(id);
    if (el) Icons.render(el, name, { size, color });
  });

  // Toolbar icons
  Icons.render(document.getElementById('db-game-icon-info'),       'info',     { size: 'md', color: 'primary' });
  Icons.render(document.getElementById('db-game-icon-hint'),       'hint',     { size: 'md', color: 'primary' });
  Icons.render(document.getElementById('db-game-icon-hint-close'), 'cross',    { size: 'md' });
  Icons.render(document.getElementById('db-game-icon-pause'),      'pause',    { size: 'md' });
  Icons.render(document.getElementById('db-game-icon-calendar'),   'calendar', { size: 'md', color: 'primary' });
  Icons.render(document.getElementById('db-game-icon-stats'),      'stats',    { size: 'md', color: 'primary' });
  Icons.render(document.getElementById('db-game-icon-settings'),   'settings', { size: 'md', color: 'primary' });

  // Score bar icons
  Icons.render(document.getElementById('db-score-icon'),  'target', { size: 'md', color: 'primary' });
  Icons.render(document.getElementById('db-merges-icon'), 'merges', { size: 'md', color: 'primary' });

  // Settings icons
  Icons.render(document.getElementById('db-stt-theme-dark'),  'themeDark',      { size: 'tiny', color: 'primary' });
  Icons.render(document.getElementById('db-stt-theme-auto'),  'themeAutomatic', { size: 'tiny', color: 'primary' });
  Icons.render(document.getElementById('db-stt-theme-light'), 'themeLight',     { size: 'tiny', color: 'primary' });
  Icons.render(document.getElementById('db-stt-hand-left'),   'arrowLeft',      { size: 'tiny', color: 'primary' });
  Icons.render(document.getElementById('db-stt-hand-right'),  'arrowLeft',      { size: 'tiny', color: 'primary' });
  Icons.render(document.getElementById('db-stt-icon-howto'),  'question',       { size: 'md',   color: 'primary' });
  Icons.render(document.getElementById('db-stt-icon-stats'),  'stairs',         { size: 'md',   color: 'primary' });
  Icons.render(document.getElementById('db-stt-icon-bible'),  'book',           { size: 'md',   color: 'primary' });

  // Shared utilities
  GameUtils.initCalendar('db');
  GameUtils.initFeedbackForm('db');
  GameUtils.initHomeDate('db');
  GameUtils.buildStreakGrid('db-stat-streak-grid');

  // Sheet scrollbars
  GameUtils.initSheetScrollbar('db-instr-wrap',    'db-instr-thumb');
  GameUtils.initSheetScrollbar('db-cal-wrap',      'db-cal-thumb');
  GameUtils.initSheetScrollbar('db-stats-wrap',    'db-stats-thumb');
  GameUtils.initSheetScrollbar('db-settings-wrap', 'db-settings-thumb');
  GameUtils.initSheetScrollbar('db-feedback-wrap', 'db-feedback-thumb');

  // Theme
  setTheme(localStorage.getItem('db-theme') || 'auto');

  // Timer
  timerObj = GameUtils.makeTimer(
    document.getElementById('db-timer-group'),
    document.getElementById('db-game-icon-pause'),
    document.getElementById('db-timer-display')
  );
  document.getElementById('db-timer-group').addEventListener('click', () => {
    if (timerObj.isRunning()) { timerObj.pause(); GameUtils.openSheet('sheet-pause'); }
  });

  // Play button
  document.getElementById('db-btn-play').addEventListener('click', startLoading);

  // Home back → Games page
  document.getElementById('db-home-icon-back').addEventListener('click', () => { window.location.href = '../../GamePage.html'; });

  // Gameplay back → exit confirm
  document.getElementById('db-game-icon-back').addEventListener('click', () => {
    if (timerObj.isRunning()) timerObj.pause();
    GameUtils.openPopup('popup-exit');
  });

  // Exit popup
  document.getElementById('db-btn-exit-confirm').addEventListener('click', () => { GameUtils.closePopup('popup-exit'); GameUtils.navigateTo('home'); });
  document.getElementById('db-btn-exit-stay').addEventListener('click',    () => { GameUtils.closePopup('popup-exit'); timerObj.start(); });

  // Welcome popup
  document.getElementById('db-btn-letsgo').addEventListener('click', () => { GameUtils.closePopup('popup-welcome'); openTutorial(); });
  document.getElementById('db-btn-skip-tutorial').addEventListener('click', () => {
    GameUtils.closePopup('popup-welcome');
    sessionStorage.setItem('db-tutorialSeen', 'true');
    firstTimeUser = false;
    GameUtils.openPopup('popup-goal');
  });

  // Goal popup
  document.getElementById('db-btn-ready').addEventListener('click', () => { GameUtils.closePopup('popup-goal'); timerObj?.start(); });

  // Tutorial next / finish
  document.getElementById('db-tut-next').addEventListener('click', () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) showTutorialStep(++tutorialStep);
    else closeTutorial();
  });

  // data-sheet buttons → pause timer + open sheet
  document.querySelectorAll('[data-sheet]').forEach(btn =>
    btn.addEventListener('click', () => {
      if (timerObj?.isRunning()) timerObj.pause();
      GameUtils.openSheet(btn.dataset.sheet);
    })
  );

  // Scrim click → close sheet + resume timer (win/lose blocked via data-no-dismiss in HTML)
  GameUtils.initSheetDismiss(() => timerObj?.start());

  // Pause continue
  document.getElementById('db-btn-continue').addEventListener('click', () => { GameUtils.closeSheet('sheet-pause'); timerObj.start(); });

  // Instructions close
  document.getElementById('db-btn-close-info').addEventListener('click', () => { GameUtils.closeSheet('sheet-info'); timerObj?.start(); });

  // Stats close
  document.getElementById('db-btn-close-stats').addEventListener('click', () => { GameUtils.closeSheet('sheet-stats'); timerObj?.start(); });

  // Settings — segment toggle
  document.querySelectorAll('.stt-segment').forEach(group =>
    group.addEventListener('click', e => {
      const btn = e.target.closest('.stt-segment__option');
      if (!btn) return;
      group.querySelectorAll('.stt-segment__option').forEach(b => b.classList.remove('stt-segment__option--active'));
      btn.classList.add('stt-segment__option--active');
      if (group.id === 'db-stt-theme') setTheme(btn.dataset.value);
    })
  );

  // Settings shortcuts
  document.getElementById('db-stt-btn-howto').addEventListener('click', () => { GameUtils.closeSheet('sheet-settings'); setTimeout(() => openTutorial(), 100); });
  document.getElementById('db-stt-btn-stats').addEventListener('click', () => { GameUtils.closeSheet('sheet-settings'); setTimeout(() => GameUtils.openSheet('sheet-stats'), 100); });
  document.getElementById('db-stt-btn-bible').addEventListener('click', () => { GameUtils.closeSheet('sheet-settings'); window.location.href = './dobbelaar-bible.html'; });
  document.getElementById('db-btn-save-settings').addEventListener('click', () => { GameUtils.closeSheet('sheet-settings'); timerObj?.start(); GameUtils.showToast('db-toast', 'Settings saved!'); });
  document.getElementById('db-btn-reset-settings').addEventListener('click', () => GameUtils.showToast('db-toast', 'Settings reset to defaults.'));

  // Win / lose actions
  document.getElementById('db-win-btn-share').addEventListener('click', () => GameUtils.showToast('db-toast', 'Sharing…'));
  document.getElementById('db-win-btn-home').addEventListener('click',  () => { clearInterval(winCountdownInterval); GameUtils.closeSheet('sheet-win');  setTimeout(() => GameUtils.navigateTo('home'), 400); });
  document.getElementById('db-lose-btn-retry').addEventListener('click', () => { GameUtils.closeSheet('sheet-lose'); setTimeout(() => startLoading(), 400); });
  document.getElementById('db-lose-btn-home').addEventListener('click',  () => { GameUtils.closeSheet('sheet-lose'); setTimeout(() => GameUtils.navigateTo('home'), 400); });

  // Calendar button
  document.getElementById('db-cal-btn').addEventListener('click', () => { GameUtils.closeSheet('sheet-calendar'); timerObj?.start(); });

  // Feedback
  document.getElementById('db-btn-send-feedback').addEventListener('click', () => {
    GameUtils.closeSheet('sheet-feedback');
    timerObj?.start();
    setTimeout(() => GameUtils.showToast('db-toast', 'Thanks for your feedback!'), 300);
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
      }, 5000);
    }
  });
  document.getElementById('db-game-icon-hint-close').addEventListener('click', e => {
    e.stopPropagation();
    clearTimeout(hintTimeout);
    clearHintHighlights();
    document.getElementById('db-game-hint-wrap')?.classList.remove('game-hint-wrap--open');
  });
});
