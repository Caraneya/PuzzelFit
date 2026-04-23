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
  { id: 'die-rotate',  params: { freq: 680, duration: 0.06, gain: 0.09, type: 'sine' }, extras: {},
    fn(p, e, synth) {
      synth({ freq: p.freq, duration: p.duration, gain: p.gain, type: p.type, sweep: p.freq * 1.12, attack: 0.003 });
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
// Penalises diseased-adjacency; prefers current rotation for tied candidates.
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
  return { cells: chosen.cells, source, needsRotation: noRot.length === 0, safe: best >= 0 };
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

  // ── Priority 2: safe non-merge placement (avoids traps) ──
  const spawnerSafe = spawnerDice.length ? bestSafePlacement(spawnerDice, 'spawner') : null;
  const parkingSafe = parkedDice.length  ? bestSafePlacement(parkedDice,  'parking') : null;
  const bestSafe    = spawnerSafe ?? parkingSafe;
  if (bestSafe) {
    const trayLabel = bestSafe.source === 'parking' ? 'your parked dice' : 'your dice';
    const rotNote   = bestSafe.needsRotation ? ' Tap to rotate them first.' : '';
    const mod       = activeChallenge.modifier;
    let text        = `No merge available — place ${trayLabel} here to set up your next move.${rotNote}`;
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

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  GameUtils.navigateTo('home');
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
    ['db-game-icon-calendar',    'calendar',       'md',   'primary'],
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

  // Shared utilities
  calCtrl = GameUtils.initCalendar('db', { completedDates: getCompletedDates(), onDaySelect: onCalDaySelect });
  // Calendar nav arrows — add sound after initCalendar wires its own listeners
  document.getElementById('db-cal-prev')?.addEventListener('click', () => SoundUtils.play('btn-tap'));
  document.getElementById('db-cal-next')?.addEventListener('click', () => SoundUtils.play('btn-tap'));
  GameUtils.initFeedbackForm('db');
  GameUtils.initHomeDate('db');
  const homeDateEl = document.getElementById('db-home-date');
  if (homeDateEl) homeDateEl.textContent += ' · ' + todayChallenge.label;
  buildHomeWeek();
  GameUtils.buildStreakGrid('db-stat-streak-grid', getCompletedDates());

  // Sheet scrollbars
  GameUtils.initSheetScrollbar('db-instr-wrap',    'db-instr-thumb');
  GameUtils.initSheetScrollbar('db-cal-wrap',      'db-cal-thumb');
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

  // Home Play button — always today's challenge
  document.getElementById('db-btn-play').addEventListener('click', () => {
    SoundUtils.play('btn-tap');
    activeChallenge     = todayChallenge;
    activeChallengeDate = TODAY_ISO;
    startLoading();
  });

  // Nav bar back buttons — each screen has its own behaviour
  [
    ['#screen-home',      () => { SoundUtils.play('btn-tap'); window.location.href = '../../GamePage.html'; }],
    ['#screen-loading',   () => { SoundUtils.play('btn-tap'); GameUtils.navigateTo('home'); }],
    ['#overlay-tutorial', () => { SoundUtils.play('btn-tap'); GameUtils.navigateTo('home'); }],
    ['#screen-gameplay',  () => { if (timerObj.isRunning()) timerObj.pause(); GameUtils.openPopup('popup-exit'); }],
  ].forEach(([scope, handler]) =>
    document.querySelector(`${scope} .home-nav-bar__start`)?.addEventListener('click', handler)
  );

  // Home nav bar icon buttons (share, heart, feedback)
  ['db-home-icon-share', 'db-home-icon-heart', 'db-home-icon-feedback',
   'db-loading-icon-share', 'db-loading-icon-heart', 'db-loading-icon-feedback',
   'db-tut-icon-share', 'db-tut-icon-heart', 'db-tut-icon-feedback',
  ].forEach(id => document.getElementById(id)?.addEventListener('click', () => SoundUtils.play('btn-tap')));

  // Exit popup
  document.getElementById('db-btn-exit-confirm').addEventListener('click', () => { SoundUtils.play('btn-tap'); Music.stop(); GameUtils.closePopup('popup-exit'); GameUtils.navigateTo('home'); });
  document.getElementById('db-btn-exit-stay').addEventListener('click',    () => { SoundUtils.play('btn-tap'); GameUtils.closePopup('popup-exit'); timerObj.start(); });

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
      if (btn.dataset.sheet === 'sheet-calendar') {
        if (gameActive) calCtrl.selectDate(playingDate);
        else calCtrl.resetToToday();
      }
      if (btn.dataset.sheet === 'sheet-stats') renderStats();
      GameUtils.openSheet(btn.dataset.sheet);
    })
  );

  // Scrim click → close sheet + resume timer (win/lose blocked via data-no-dismiss in HTML)
  GameUtils.initSheetDismiss(() => timerObj?.start());

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

  // Win / lose actions
  document.getElementById('db-win-btn-share').addEventListener('click', () => { SoundUtils.play('btn-tap'); GameUtils.showToast('db-toast', 'Sharing…'); });
  document.getElementById('db-win-btn-home').addEventListener('click',  () => { SoundUtils.play('btn-tap'); clearInterval(winCountdownInterval); GameUtils.switchSheet('sheet-win',  () => GameUtils.navigateTo('home'), TIMING.NAV_DELAY); });
  document.getElementById('db-lose-btn-retry').addEventListener('click', () => { SoundUtils.play('btn-tap'); GameUtils.switchSheet('sheet-lose', startLoading, TIMING.NAV_DELAY); });
  document.getElementById('db-lose-btn-home').addEventListener('click',  () => { SoundUtils.play('btn-tap'); GameUtils.switchSheet('sheet-lose', () => GameUtils.navigateTo('home'), TIMING.NAV_DELAY); });

  // Calendar Play button — plays the selected day's challenge
  document.getElementById('db-cal-btn').addEventListener('click', () => {
    SoundUtils.play('btn-tap');
    const isInProgress = gameActive && activeChallengeDate === playingDate;
    if (isInProgress) {
      GameUtils.closeSheet('sheet-calendar');
      timerObj?.start();
    } else {
      activeChallenge = CHALLENGES[activeChallengeDate] ?? DEFAULT_CHALLENGE;
      GameUtils.closeSheet('sheet-calendar');
      setTimeout(startLoading, 200);
    }
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
});
