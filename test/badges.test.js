'use strict';

const { BADGES } = require('../game.js');

let failures = 0;

function fail(msg) {
  failures++;
  console.error(msg);
}

const badge = (id) => BADGES.find((b) => b.id === id);

function expect(id, ctx, want) {
  const got = badge(id).test(ctx);
  if (got !== want) fail(`${id}: expected ${want} for ${JSON.stringify(ctx)}`);
}

// A plain first win: five lines, one op, some figures unspent, no revisions.
const base = { wins: 1, streak: 1, lines: 5, spentAll: false, opsUsed: 1, revised: false };

if (BADGES.length === 0) fail('no badges defined');
for (const b of BADGES) {
  if (!b.id || !b.seal || !b.name || !b.desc) fail(`badge missing fields: ${JSON.stringify(b)}`);
  if (typeof b.test !== 'function') fail(`${b.id}: test is not a function`);
}
if (new Set(BADGES.map((b) => b.id)).size !== BADGES.length) fail('duplicate badge ids');

expect('opening-entry', base, true);
expect('opening-entry', { ...base, wins: 0 }, false);

expect('every-penny', base, false);
expect('every-penny', { ...base, spentAll: true }, true);

expect('compound-entry', base, false);
expect('compound-entry', { ...base, opsUsed: 4 }, true);

expect('fair-copy', base, true);
expect('fair-copy', { ...base, revised: true }, false);

expect('prompt-payment', base, false);
expect('prompt-payment', { ...base, lines: 3 }, true);
expect('prompt-payment', { ...base, lines: 1 }, true);

expect('repeat-business', base, false);
expect('repeat-business', { ...base, streak: 3 }, true);

expect('in-the-black', { ...base, streak: 6 }, false);
expect('in-the-black', { ...base, streak: 7 }, true);

expect('iron-ledger', { ...base, streak: 29 }, false);
expect('iron-ledger', { ...base, streak: 30 }, true);

expect('quarter-book', { ...base, streak: 89 }, false);
expect('quarter-book', { ...base, streak: 90 }, true);

expect('annual-audit', { ...base, streak: 364 }, false);
expect('annual-audit', { ...base, streak: 365 }, true);

expect('century-ledger', { ...base, wins: 99 }, false);
expect('century-ledger', { ...base, wins: 100 }, true);

console.log(`${BADGES.length} badges checked, ${failures} failures`);
process.exit(failures ? 1 : 0);
