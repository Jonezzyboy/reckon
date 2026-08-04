'use strict';

const { generatePuzzle } = require('../game.js');

const DAYS = 365 * 3;
let failures = 0;

function fail(day, msg, puzzle) {
  failures++;
  console.error(`day ${day}: ${msg}`, JSON.stringify(puzzle));
}

function verifySolution(puzzle) {
  const pool = puzzle.numbers.slice();
  for (const s of puzzle.solution) {
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
  const last = puzzle.solution[puzzle.solution.length - 1];
  if (last.result !== puzzle.target) return 'solution does not reach target';
  return null;
}

const targets = new Set();

for (let day = 0; day < DAYS; day++) {
  let p;
  try {
    p = generatePuzzle(day);
  } catch (e) {
    fail(day, e.message);
    continue;
  }
  if (p.numbers.length !== 6) fail(day, 'expected 6 numbers', p);
  if (p.numbers.some((n) => ![25, 50, 75, 100].includes(n) && (n < 1 || n > 10))) {
    fail(day, 'number out of range', p);
  }
  if (p.target < 101 || p.target > 999) fail(day, 'target out of range', p);
  if (p.numbers.includes(p.target)) fail(day, 'target equals a starting number', p);
  if (p.solution.length < 3 || p.solution.length > 5) fail(day, 'solution length out of range', p);
  const err = verifySolution(p);
  if (err) fail(day, err, p);
  if (generatePuzzle(day).target !== p.target) fail(day, 'non-deterministic', p);
  targets.add(p.target);
}

console.log(`${DAYS} days checked, ${failures} failures, ${targets.size} distinct targets`);
const sample = [0, 1, 2, 100, 365].map((d) => {
  const p = generatePuzzle(d);
  return `  No.${d + 1}: [${p.numbers}] -> ${p.target} (${p.solution.length} lines)`;
});
console.log(sample.join('\n'));

process.exit(failures ? 1 : 0);
