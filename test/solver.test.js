'use strict';

const { generatePuzzle, solveOptimal } = require('../game.js');

const DAYS = 365;
let failures = 0;

function fail(day, msg, extra) {
  failures++;
  console.error(`day ${day}: ${msg}`, extra ? JSON.stringify(extra) : '');
}

function verifySteps(numbers, steps, target) {
  const pool = numbers.slice();
  for (const s of steps) {
    const ai = pool.indexOf(s.a);
    if (ai === -1) return `operand ${s.a} not available`;
    pool.splice(ai, 1);
    const bi = pool.indexOf(s.b);
    if (bi === -1) return `operand ${s.b} not available`;
    pool.splice(bi, 1);
    let r;
    switch (s.op) {
      case '+': r = s.a + s.b; break;
      case '-': r = s.a - s.b; break;
      case '*': r = s.a * s.b; break;
      case '/': r = s.b !== 0 && s.a % s.b === 0 ? s.a / s.b : NaN; break;
      default: return `unknown op ${s.op}`;
    }
    if (!Number.isInteger(r) || r <= 0) return `illegal step ${s.a} ${s.op} ${s.b}`;
    if (r !== s.result) return `step result mismatch: ${s.a} ${s.op} ${s.b} != ${s.result}`;
    pool.push(r);
  }
  const last = steps[steps.length - 1];
  if (last.result !== target) return 'steps do not reach target';
  return null;
}

// Known cases pin down minimality and unsolvability.
const known = [
  { numbers: [100, 4, 1, 1, 2, 3], target: 400, lines: 1 },
  { numbers: [10, 2, 3, 1, 1, 5], target: 60, lines: 2 },
  // 101 is prime and unreachable in two lines from these figures;
  // three needs the 2÷2=1 trick: 25×4=100, 2÷2=1, 100+1=101.
  { numbers: [25, 4, 2, 2, 3, 7], target: 101, lines: 3 },
  // Everything combinable here tops out at 72, so 997 is unreachable.
  { numbers: [1, 1, 2, 2, 3, 3], target: 997, lines: null },
];

for (const k of known) {
  const steps = solveOptimal(k.numbers, k.target);
  if (k.lines === null) {
    if (steps) fail('known', `expected no solution for ${k.numbers} -> ${k.target}`, steps);
    continue;
  }
  if (!steps) { fail('known', `no solution found for ${k.numbers} -> ${k.target}`); continue; }
  if (steps.length !== k.lines) fail('known', `expected ${k.lines} lines for ${k.numbers} -> ${k.target}`, steps);
  const err = verifySteps(k.numbers, steps, k.target);
  if (err) fail('known', err, steps);
}

const started = Date.now();
const lineCounts = [0, 0, 0, 0, 0];

for (let day = 0; day < DAYS; day++) {
  const p = generatePuzzle(day);
  const best = solveOptimal(p.numbers, p.target, p.solution.length);
  if (!best) { fail(day, 'solver found nothing despite a known solution', p); continue; }
  if (best.length > p.solution.length) fail(day, 'solver worse than generator chain', { best, p });
  const err = verifySteps(p.numbers, best, p.target);
  if (err) fail(day, err, best);
  if (best.length === 1) fail(day, 'puzzle is settleable in a single line', p);
  // Iterative deepening guarantees minimality; spot-check the claim.
  if (solveOptimal(p.numbers, p.target, best.length - 1)) {
    fail(day, 'shorter solution exists than the one returned', best);
  }
  lineCounts[best.length - 1]++;
}

console.log(`${DAYS} days solved in ${Date.now() - started}ms, ${failures} failures`);
console.log(`optimal line counts 1..5: ${lineCounts.join(' / ')}`);

process.exit(failures ? 1 : 0);
