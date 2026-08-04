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

/* ============================================================
   Commendations
   Earnable badges, judged against a summary of a winning day:
   { wins, streak, lines, spentAll, opsUsed, revised }.
   ============================================================ */

const BADGES = [
  { id: 'opening-entry', seal: 'No1', name: 'Opening Entry',
    desc: 'Settle your first account.',
    test: (c) => c.wins >= 1 },
  { id: 'every-penny', seal: '6/6', name: 'Every Penny',
    desc: 'Spend all six figures settling one account.',
    test: (c) => c.spentAll },
  { id: 'compound-entry', seal: '×÷', name: 'Compound Entry',
    desc: 'Use all four operations in one settlement.',
    test: (c) => c.opsUsed >= 4 },
  { id: 'fair-copy', seal: 'FC', name: 'Fair Copy',
    desc: 'Settle without undoing or starting over.',
    test: (c) => !c.revised },
  { id: 'prompt-payment', seal: '≤3', name: 'Prompt Payment',
    desc: 'Settle in three lines or fewer.',
    test: (c) => c.lines <= 3 },
  { id: 'repeat-business', seal: '3d', name: 'Repeat Business',
    desc: 'Settle three days running.',
    test: (c) => c.streak >= 3 },
  { id: 'in-the-black', seal: '7d', name: 'In the Black',
    desc: 'Settle seven days running.',
    test: (c) => c.streak >= 7 },
  { id: 'iron-ledger', seal: '30', name: 'Iron Ledger',
    desc: 'Settle thirty days running.',
    test: (c) => c.streak >= 30 },
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generatePuzzle, buildSolution, candidateOps, mulberry32, BADGES };
}

/* ============================================================
   The ledger (browser only)
   ============================================================ */

if (typeof document !== 'undefined') (function () {
  const $ = (sel) => document.querySelector(sel);

  const DAY_KEY = 'reckon-day-v1';
  const STATS_KEY = 'reckon-stats-v1';
  const HISTORY_KEY = 'reckon-history-v1';
  const BADGES_KEY = 'reckon-badges-v1';

  const today = todayIndex();
  // ?no=N reopens past account N for practice; anything else means today.
  const requested = Number(new URLSearchParams(location.search).get('no')) - 1;
  const archive = Number.isInteger(requested) && requested >= 0 && requested < today;
  const day = archive ? requested : today;
  const puzzle = generatePuzzle(day);

  const state = {
    tiles: puzzle.numbers.map((v, i) => ({ id: i, value: v, used: false, made: false })),
    moves: [],
    sel: { aId: null, op: null },
    solved: false,
    gaveUp: false,
    revised: false,
  };

  const tile = (id) => state.tiles.find((t) => t.id === id);
  const finished = () => state.solved || state.gaveUp;

  /* ---------- persistence ---------- */

  function loadJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
  }

  // Archive days get their own slot so practice never clobbers today's board.
  const SLOT_KEY = archive ? `${DAY_KEY}:${day}` : DAY_KEY;

  function saveDay() {
    localStorage.setItem(SLOT_KEY, JSON.stringify({
      day,
      moves: state.moves.map((m) => [m.aId, m.op, m.bId]),
      solved: state.solved,
      gaveUp: state.gaveUp,
      revised: state.revised,
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

  // Archive plays never touch stats or streaks. A late settle is still
  // worth recording, and may close an account originally left open.
  function recordArchiveResult(won) {
    if (!won) return;
    const history = loadHistory();
    const existing = history.find((h) => h.day === day);
    if (existing && existing.solved) return;
    if (existing) {
      existing.solved = true;
      existing.lines = state.moves.length;
      existing.late = true;
    } else {
      history.push({ day, solved: true, lines: state.moves.length, late: true });
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function recordResult(won) {
    if (archive) return recordArchiveResult(won);
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

  function loadBadges() {
    return loadJSON(BADGES_KEY) || {};
  }

  // Awarded only on a win; idempotent, so replaying a saved win is safe.
  function awardBadges() {
    const stats = loadStats();
    const ctx = {
      wins: stats.wins,
      streak: stats.streak,
      lines: state.moves.length,
      spentAll: state.tiles.filter((t) => !t.made).every((t) => t.used),
      opsUsed: new Set(state.moves.map((m) => m.op)).size,
      revised: state.revised,
    };
    const earned = loadBadges();
    let changed = false;
    for (const b of BADGES) {
      if (!(b.id in earned) && b.test(ctx)) {
        earned[b.id] = day;
        changed = true;
      }
    }
    if (changed) localStorage.setItem(BADGES_KEY, JSON.stringify(earned));
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
    state.revised = true;
    saveDay();
    renderAll();
  }

  function startOver() {
    if (state.moves.length === 0 || finished()) return;
    state.tiles = state.tiles.filter((t) => !t.made);
    state.tiles.forEach((t) => { t.used = false; });
    state.moves = [];
    state.sel = { aId: null, op: null };
    state.revised = true;
    saveDay();
    renderAll();
  }

  function win(animate) {
    state.solved = true;
    state.sel = { aId: null, op: null };
    recordResult(true);
    if (!archive) awardBadges();
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
      ? `Account settled${archive ? ' late' : ''} in ${n} line${n === 1 ? '' : 's'}.`
      : archive
        ? 'This past account stays open.'
        : 'The books stay open today. Tomorrow brings a fresh account.';
    const earned = loadBadges();
    const fresh = archive ? [] : BADGES.filter((b) => earned[b.id] === day);
    const nb = $('#newBadges');
    nb.hidden = fresh.length === 0;
    nb.textContent = fresh.length
      ? `New commendation${fresh.length === 1 ? '' : 's'}: ${fresh.map((b) => b.name).join(' · ')}`
      : '';
    $('#share').hidden = !state.solved;
  }

  function renderBadges() {
    const earned = loadBadges();
    $('#badgeCount').textContent = `${Object.keys(earned).length} of ${BADGES.length}`;
    const ul = $('#badgeList');
    ul.innerHTML = '';
    for (const b of BADGES) {
      const got = b.id in earned;
      const li = document.createElement('li');
      li.className = 'badge' + (got ? ' earned' : '')
        + (!archive && earned[b.id] === day ? ' fresh' : '');
      const seal = document.createElement('span');
      seal.className = 'seal';
      seal.textContent = b.seal;
      const name = document.createElement('span');
      name.className = 'badge-name';
      name.textContent = b.name;
      const desc = document.createElement('span');
      desc.className = 'badge-desc';
      desc.textContent = got ? `${b.desc} Earned No. ${earned[b.id] + 1}.` : b.desc;
      const text = document.createElement('span');
      text.className = 'badge-text';
      text.append(name, desc);
      li.append(seal, text);
      ul.appendChild(li);
    }
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
    $('#history').hidden = today === 0;
    if (today === 0) return;
    const byDay = new Map(loadHistory().map((h) => [h.day, h]));
    const ol = $('#historyLines');
    ol.innerHTML = '';
    for (let d = today - 1; d >= 0; d--) {
      const h = byDay.get(d);
      const amt = !h ? 'not attempted'
        : h.solved
          ? `settled${h.late ? ' late' : ''} in ${h.lines} line${h.lines === 1 ? '' : 's'}`
          : 'left open';
      const cls = (!h ? 'blank' : h.solved ? 'settled' : 'open')
        + (archive && d === day ? ' current' : '');
      const li = ledgerLine('', amt, cls);
      const a = document.createElement('a');
      a.href = `?no=${d + 1}`;
      a.textContent = `No. ${d + 1} · ${dateForDay(d)}`;
      li.querySelector('.expr').appendChild(a);
      ol.appendChild(li);
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
    renderBadges();
  }

  /* ---------- share & clock ---------- */

  $('#share').addEventListener('click', () => {
    const n = state.moves.length;
    let text = `🧾 Reckon No. ${day + 1} — settled${archive ? ' late' : ''} in ${n} line${n === 1 ? '' : 's'}`;
    const earned = loadBadges();
    const fresh = archive ? [] : BADGES.filter((b) => earned[b.id] === day).map((b) => b.name);
    if (fresh.length) text += `\n🏅 ${fresh.join(' · ')}`;
    navigator.clipboard.writeText(text).then(() => {
      $('#share').textContent = 'Copied';
      setTimeout(() => { $('#share').textContent = 'Copy result'; }, 2000);
    });
  });

  /* ---------- stationery ---------- */

  const THEME_KEY = 'reckon-theme-v1';
  const THEMES = [
    { id: '', name: 'Counting house', desk: '#31443a', paper: '#f9f5e8' },
    { id: 'sage', name: 'Sage ledger', desk: '#e9efdd', paper: '#f6f8ec' },
    { id: 'manila', name: 'Manila', desk: '#dfd3b4', paper: '#f8f4e6' },
    { id: 'bankers-blue', name: "Banker's blue", desk: '#1d2c40', paper: '#f7f3e6' },
    { id: 'oxblood', name: 'Oxblood', desk: '#3f2226', paper: '#f8f2e4' },
    { id: 'nightwatch', name: 'Nightwatch', desk: '#10171a', paper: '#1e2622' },
  ];

  let themeId = localStorage.getItem(THEME_KEY) || '';
  if (!THEMES.some((t) => t.id === themeId)) themeId = '';

  const themeBtn = $('#theme');
  const themeMenu = $('#themeMenu');

  function themeChip(t) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.style.background = t.desk;
    const leaf = document.createElement('span');
    leaf.className = 'chip-leaf';
    leaf.style.background = t.paper;
    chip.appendChild(leaf);
    return chip;
  }

  function applyTheme() {
    if (themeId) document.documentElement.dataset.theme = themeId;
    else delete document.documentElement.dataset.theme;
    const t = THEMES.find((x) => x.id === themeId);
    const label = document.createElement('span');
    label.className = 'theme-label';
    label.textContent = 'Stationery';
    themeBtn.innerHTML = '';
    themeBtn.append(themeChip(t), label);
  }

  function closeThemeMenu() {
    themeMenu.hidden = true;
    themeBtn.setAttribute('aria-expanded', 'false');
  }

  function renderThemeMenu() {
    themeMenu.innerHTML = '';
    for (const t of THEMES) {
      const b = document.createElement('button');
      b.setAttribute('role', 'option');
      b.setAttribute('aria-selected', String(t.id === themeId));
      if (t.id === themeId) b.classList.add('selected');
      const name = document.createElement('span');
      name.textContent = t.name;
      b.append(themeChip(t), name);
      b.addEventListener('click', () => {
        themeId = t.id;
        localStorage.setItem(THEME_KEY, themeId);
        applyTheme();
        closeThemeMenu();
      });
      themeMenu.appendChild(b);
    }
  }

  themeBtn.addEventListener('click', () => {
    if (themeMenu.hidden) {
      renderThemeMenu();
      themeMenu.hidden = false;
      themeBtn.setAttribute('aria-expanded', 'true');
    } else {
      closeThemeMenu();
    }
  });

  document.addEventListener('click', (e) => {
    if (!themeMenu.hidden && !themeMenu.contains(e.target) && !themeBtn.contains(e.target)) {
      closeThemeMenu();
    }
  });

  applyTheme();

  function tick() {
    const ms = msToMidnight();
    const h = String(Math.floor(ms / 3.6e6)).padStart(2, '0');
    const m = String(Math.floor((ms % 3.6e6) / 6e4)).padStart(2, '0');
    const s = String(Math.floor((ms % 6e4) / 1e3)).padStart(2, '0');
    $('#next').textContent = `Next account opens in ${h}:${m}:${s}`;
  }

  /* ---------- boot ---------- */

  $('#issue').textContent = `No. ${day + 1}`;
  const shownDate = archive ? new Date(EPOCH.y, EPOCH.m, EPOCH.d + day) : new Date();
  $('#date').textContent = shownDate.toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  $('#archiveNote').hidden = !archive;
  if (archive) $('.history details').open = true;
  $('#target').textContent = puzzle.target;

  document.querySelectorAll('.op').forEach((btn) =>
    btn.addEventListener('click', () => onOp(btn.dataset.op)));
  $('#undo').addEventListener('click', undo);
  $('#clear').addEventListener('click', startOver);
  $('#giveup').addEventListener('click', giveUp);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') { e.preventDefault(); undo(); }
    else if (e.key === 'Escape') { closeThemeMenu(); state.sel = { aId: null, op: null }; renderAll(); }
    else if (e.key === '+' ) onOp('+');
    else if (e.key === '-') onOp('-');
    else if (e.key === '*' || e.key.toLowerCase() === 'x') onOp('*');
    else if (e.key === '/') { e.preventDefault(); onOp('/'); }
  });

  const saved = loadJSON(SLOT_KEY);
  if (saved && saved.day === day) {
    if (saved.revised) state.revised = true;
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
  if (archive) {
    $('#next').textContent = 'Past account · practice only';
  } else {
    tick();
    setInterval(tick, 1000);
  }
})();
