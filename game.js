'use strict';

/* ============================================================
   Deterministic daily puzzle
   The target is built by actually combining the day's numbers,
   so every puzzle is guaranteed solvable.
   ============================================================ */

function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const OP_SYMBOL = { '+': '+', '-': '−', '*': '×', '/': '÷' };

function applyOp(a, op, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
  }
}

// Valid ways to combine two figures under ledger rules:
// positive whole numbers only, no pointless ops (×1, ÷1, a÷a).
function candidateOps(pool, mustUseIdx) {
  const out = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = 0; j < pool.length; j++) {
      if (i === j) continue;
      if (mustUseIdx !== null && i !== mustUseIdx && j !== mustUseIdx) continue;
      const a = pool[i], b = pool[j];
      if (a < b) continue;
      if (a + b <= 99999) out.push({ i, j, op: '+', result: a + b });
      if (a - b > 0) out.push({ i, j, op: '-', result: a - b });
      if (a !== 1 && b !== 1 && a * b <= 99999) out.push({ i, j, op: '*', result: a * b });
      if (b > 1 && a % b === 0 && a !== b) out.push({ i, j, op: '/', result: a / b });
    }
  }
  return out;
}

// Chain 3–5 operations, each spending the previous result, so the
// recorded solution is connected working rather than stray lines.
function buildSolution(numbers, rng) {
  const pool = numbers.slice();
  const stepsWanted = 3 + Math.floor(rng() * 3);
  const steps = [];
  let lastIdx = null;
  for (let s = 0; s < stepsWanted; s++) {
    const cands = candidateOps(pool, lastIdx);
    if (cands.length === 0) break;
    const c = cands[Math.floor(rng() * cands.length)];
    steps.push({ a: pool[c.i], op: c.op, b: pool[c.j], result: c.result });
    const hi = Math.max(c.i, c.j), lo = Math.min(c.i, c.j);
    pool.splice(hi, 1);
    pool.splice(lo, 1);
    pool.push(c.result);
    lastIdx = pool.length - 1;
  }
  if (steps.length < 3) return null;
  return { target: steps[steps.length - 1].result, steps };
}

function generatePuzzle(dayIndex) {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const rng = mulberry32(((dayIndex + 1) * 2654435761) ^ (attempt * 40503 + 17));
    const bigs = shuffle([25, 50, 75, 100], rng).slice(0, rng() < 0.55 ? 1 : 2);
    const smalls = [];
    for (let n = 1; n <= 10; n++) smalls.push(n, n);
    shuffle(smalls, rng);
    const numbers = shuffle(bigs.concat(smalls.slice(0, 6 - bigs.length)), rng);
    const sol = buildSolution(numbers, rng);
    if (!sol) continue;
    if (sol.target < 101 || sol.target > 999) continue;
    if (numbers.includes(sol.target)) continue;
    return { numbers, target: sol.target, solution: sol.steps };
  }
  throw new Error('No puzzle could be generated for day ' + dayIndex);
}

// Puzzle No. 1 = 3 August 2026. Flips at local midnight.
const EPOCH = { y: 2026, m: 7, d: 3 };

function todayIndex() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const epoch = new Date(EPOCH.y, EPOCH.m, EPOCH.d);
  return Math.max(0, Math.round((start - epoch) / 864e5));
}

function msToMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generatePuzzle, buildSolution, candidateOps, mulberry32 };
}

/* ============================================================
   The ledger (browser only)
   ============================================================ */

if (typeof document !== 'undefined') (function () {
  const $ = (sel) => document.querySelector(sel);

  const DAY_KEY = 'reckon-day-v1';
  const STATS_KEY = 'reckon-stats-v1';
  const HISTORY_KEY = 'reckon-history-v1';

  const day = todayIndex();
  const puzzle = generatePuzzle(day);

  const state = {
    tiles: puzzle.numbers.map((v, i) => ({ id: i, value: v, used: false, made: false })),
    moves: [],
    sel: { aId: null, op: null },
    solved: false,
    gaveUp: false,
  };

  const tile = (id) => state.tiles.find((t) => t.id === id);
  const finished = () => state.solved || state.gaveUp;

  /* ---------- persistence ---------- */

  function loadJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
  }

  function saveDay() {
    localStorage.setItem(DAY_KEY, JSON.stringify({
      day,
      moves: state.moves.map((m) => [m.aId, m.op, m.bId]),
      solved: state.solved,
      gaveUp: state.gaveUp,
    }));
  }

  function loadStats() {
    return Object.assign(
      { played: 0, wins: 0, streak: 0, maxStreak: 0, lastWinDay: null, lastPlayedDay: null },
      loadJSON(STATS_KEY) || {}
    );
  }

  function saveStats(stats) {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function loadHistory() {
    const h = loadJSON(HISTORY_KEY);
    return Array.isArray(h) ? h : [];
  }

  function recordResult(won) {
    const stats = loadStats();
    if (stats.lastPlayedDay === day) return;
    stats.played++;
    stats.lastPlayedDay = day;
    if (won) {
      stats.wins++;
      stats.streak = stats.lastWinDay === day - 1 ? stats.streak + 1 : 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
      stats.lastWinDay = day;
    } else {
      stats.streak = 0;
    }
    saveStats(stats);
    const history = loadHistory();
    history.push({ day, solved: won, lines: won ? state.moves.length : null });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  /* ---------- moves ---------- */

  function attempt(aId, op, bId) {
    const a = tile(aId).value, b = tile(bId).value;
    if (op === '-' && a - b <= 0) return note('This ledger keeps positive figures only.');
    if (op === '/' && (b === 0 || a % b !== 0)) return note('Only whole numbers on this ledger.');
    const result = applyOp(a, op, b);
    const id = 6 + state.moves.length;
    tile(aId).used = true;
    tile(bId).used = true;
    state.tiles.push({ id, value: result, used: false, made: true });
    state.moves.push({ aId, op, bId, result, id });
    state.sel = { aId: null, op: null };
    if (result === puzzle.target) win(true);
    saveDay();
  }

  function undo() {
    if (state.moves.length === 0 || finished()) return;
    const m = state.moves.pop();
    state.tiles = state.tiles.filter((t) => t.id !== m.id);
    tile(m.aId).used = false;
    tile(m.bId).used = false;
    state.sel = { aId: null, op: null };
    saveDay();
    renderAll();
  }

  function startOver() {
    if (state.moves.length === 0 || finished()) return;
    state.tiles = state.tiles.filter((t) => !t.made);
    state.tiles.forEach((t) => { t.used = false; });
    state.moves = [];
    state.sel = { aId: null, op: null };
    saveDay();
    renderAll();
  }

  function win(animate) {
    state.solved = true;
    state.sel = { aId: null, op: null };
    recordResult(true);
    const stamp = $('#stamp');
    stamp.hidden = false;
    if (!animate) stamp.style.animation = 'none';
  }

  let confirmTimer = null;

  function giveUp() {
    const btn = $('#giveup');
    if (!btn.classList.contains('confirm')) {
      btn.classList.add('confirm');
      btn.textContent = 'Tap again to reveal';
      confirmTimer = setTimeout(() => {
        btn.classList.remove('confirm');
        btn.textContent = 'Give up';
      }, 3500);
      return;
    }
    clearTimeout(confirmTimer);
    state.gaveUp = true;
    state.sel = { aId: null, op: null };
    recordResult(false);
    saveDay();
    renderAll();
  }

  /* ---------- events ---------- */

  function onTile(id) {
    if (finished() || tile(id).used) return;
    const s = state.sel;
    if (s.aId === id) {
      s.aId = null;
      s.op = null;
    } else if (s.aId === null || s.op === null) {
      s.aId = id;
      s.op = null;
    } else {
      attempt(s.aId, s.op, id);
    }
    renderAll();
  }

  function onOp(op) {
    if (finished()) return;
    if (state.sel.aId === null) return note('Pick a figure first.');
    state.sel.op = state.sel.op === op ? null : op;
    renderAll();
  }

  let noteTimer = null;

  function note(msg) {
    const el = $('#note');
    el.textContent = msg;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { el.textContent = ''; }, 2800);
  }

  /* ---------- rendering ---------- */

  function renderTiles() {
    const box = $('#tiles');
    box.innerHTML = '';
    for (const t of state.tiles) {
      const btn = document.createElement('button');
      btn.className = 'tile'
        + (t.made ? ' made' : '')
        + (t.used ? ' used' : '')
        + (state.sel.aId === t.id ? ' selected' : '');
      btn.textContent = t.value;
      btn.disabled = t.used || finished();
      btn.addEventListener('click', () => onTile(t.id));
      box.appendChild(btn);
    }
  }

  function renderOps() {
    document.querySelectorAll('.op').forEach((btn) => {
      btn.classList.toggle('selected', state.sel.op === btn.dataset.op);
      btn.disabled = finished();
    });
  }

  function ledgerLine(expr, amt, cls) {
    const li = document.createElement('li');
    if (cls) li.className = cls;
    const exprSpan = document.createElement('span');
    exprSpan.className = 'expr';
    exprSpan.textContent = expr;
    li.appendChild(exprSpan);
    if (amt !== null) {
      const leader = document.createElement('span');
      leader.className = 'leader';
      const amtSpan = document.createElement('span');
      amtSpan.className = 'amt';
      amtSpan.textContent = amt;
      li.append(leader, amtSpan);
    }
    return li;
  }

  function renderLedger() {
    const ol = $('#lines');
    ol.innerHTML = '';

    for (const m of state.moves) {
      const expr = `${tile(m.aId).value} ${OP_SYMBOL[m.op]} ${tile(m.bId).value}`;
      ol.appendChild(ledgerLine(expr, m.result, m.result === puzzle.target ? 'hit' : ''));
    }

    if (!finished() && state.sel.aId !== null) {
      const parts = [tile(state.sel.aId).value];
      if (state.sel.op) parts.push(OP_SYMBOL[state.sel.op]);
      const li = ledgerLine(parts.join(' ') + ' ', null, 'pending');
      const caret = document.createElement('span');
      caret.className = 'caret';
      li.querySelector('.expr').appendChild(caret);
      ol.appendChild(li);
    }

    if (ol.children.length === 0) {
      ol.appendChild(ledgerLine('Your working goes here.', null, 'empty'));
    }

    if (state.gaveUp) {
      ol.appendChild(ledgerLine("Auditor's working:", null, 'audit-label'));
      for (const s of puzzle.solution) {
        ol.appendChild(ledgerLine(`${s.a} ${OP_SYMBOL[s.op]} ${s.b}`, s.result, 'audit'));
      }
    }
  }

  function renderControls() {
    $('#undo').disabled = state.moves.length === 0 || finished();
    $('#clear').disabled = state.moves.length === 0 || finished();
    $('#giveup').hidden = finished();
  }

  function renderResult() {
    const box = $('#result');
    box.hidden = !finished();
    if (!finished()) return;
    const n = state.moves.length;
    $('#resultText').textContent = state.solved
      ? `Account settled in ${n} line${n === 1 ? '' : 's'}.`
      : 'The books stay open today. Tomorrow brings a fresh account.';
    $('#share').hidden = !state.solved;
  }

  function renderStats() {
    const s = loadStats();
    $('#stats').textContent = `Streak ${s.streak} · Settled ${s.wins}/${s.played}`;
  }

  function dateForDay(d) {
    return new Date(EPOCH.y, EPOCH.m, EPOCH.d + d).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  function renderHistory() {
    const history = loadHistory();
    $('#history').hidden = history.length === 0;
    const ol = $('#historyLines');
    ol.innerHTML = '';
    for (const h of history.slice().sort((x, y) => y.day - x.day)) {
      const amt = h.solved
        ? `settled in ${h.lines} line${h.lines === 1 ? '' : 's'}`
        : 'left open';
      ol.appendChild(ledgerLine(`No. ${h.day + 1} · ${dateForDay(h.day)}`, amt,
        h.solved ? 'settled' : 'open'));
    }
  }

  function renderAll() {
    renderTiles();
    renderOps();
    renderLedger();
    renderControls();
    renderResult();
    renderStats();
    renderHistory();
  }

  /* ---------- share & clock ---------- */

  $('#share').addEventListener('click', () => {
    const n = state.moves.length;
    const text = `Reckon No. ${day + 1} 🧾\nSettled in ${n} line${n === 1 ? '' : 's'}.`;
    navigator.clipboard.writeText(text).then(() => {
      $('#share').textContent = 'Copied';
      setTimeout(() => { $('#share').textContent = 'Copy result'; }, 2000);
    });
  });

  function tick() {
    const ms = msToMidnight();
    const h = String(Math.floor(ms / 3.6e6)).padStart(2, '0');
    const m = String(Math.floor((ms % 3.6e6) / 6e4)).padStart(2, '0');
    const s = String(Math.floor((ms % 6e4) / 1e3)).padStart(2, '0');
    $('#next').textContent = `Next account opens in ${h}:${m}:${s}`;
  }

  /* ---------- boot ---------- */

  $('#issue').textContent = `No. ${day + 1}`;
  $('#date').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  $('#target').textContent = puzzle.target;

  document.querySelectorAll('.op').forEach((btn) =>
    btn.addEventListener('click', () => onOp(btn.dataset.op)));
  $('#undo').addEventListener('click', undo);
  $('#clear').addEventListener('click', startOver);
  $('#giveup').addEventListener('click', giveUp);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') { e.preventDefault(); undo(); }
    else if (e.key === 'Escape') { state.sel = { aId: null, op: null }; renderAll(); }
    else if (e.key === '+' ) onOp('+');
    else if (e.key === '-') onOp('-');
    else if (e.key === '*' || e.key.toLowerCase() === 'x') onOp('*');
    else if (e.key === '/') { e.preventDefault(); onOp('/'); }
  });

  const saved = loadJSON(DAY_KEY);
  if (saved && saved.day === day) {
    for (const [aId, op, bId] of saved.moves) {
      const a = tile(aId), b = tile(bId);
      if (!a || !b || a.used || b.used) break;
      const result = applyOp(a.value, op, b.value);
      const id = 6 + state.moves.length;
      a.used = true;
      b.used = true;
      state.tiles.push({ id, value: result, used: false, made: true });
      state.moves.push({ aId, op, bId, result, id });
      if (result === puzzle.target) win(false);
    }
    if (saved.gaveUp) state.gaveUp = true;
  }

  renderAll();
  tick();
  setInterval(tick, 1000);
})();
