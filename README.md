# Reckon 🧾

A daily numbers game dressed as a bookkeeper's ledger. Six figures, four
operations, one amount due — settle the account exactly and earn the red
**SETTLED** stamp.

**Play it at <https://jonezzyboy.github.io/reckon/>.**
It's listed alongside everything else on the homepage,
<https://jonezzyboy.github.io/>.

## How to play

You're handed six figures and an **amount due**. Settle the account exactly.

1. Pick a figure, then an operation (`+ − × ÷`), then a second figure.
2. The result is pencilled in as a new figure you can spend — e.g.
   `75 × 4 = 300`.
3. Hit the amount due exactly to earn the red **SETTLED** stamp.

House rules:

- Each figure may be spent only once — results included.
- Subtraction must stay positive and division must come out even; the ledger
  holds only positive whole numbers.
- A fresh account opens at local midnight. Streaks and results are kept in
  `localStorage`.
- **Past accounts** (below the sheet) lists each previous day's result — the
  puzzle number, its date, and whether the account was settled and in how many
  lines.

## The daily puzzle

Every day's puzzle is derived deterministically from the date — everyone gets
the same account on the same day, with no server and no answer list:

1. The date is turned into a day index (puzzle No. 1 = 3 August 2026).
2. A seeded PRNG ([mulberry32](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c))
   picks 1–2 "big" numbers (25/50/75/100) and fills the rest from 1–10.
3. The target is built by actually chaining 3–5 operations over those numbers
   under the ledger rules, so **every puzzle is guaranteed solvable** — and the
   generating chain doubles as the revealed solution if you give up.
4. Targets land between 101 and 999 and never match a starting number.

## Running it

It's a static page — open `index.html` in a browser, or:

```sh
python3 -m http.server 8000
```

then visit <http://localhost:8000>.

## Tests

```sh
node test/generator.test.js
```

Replays the generator across several years of days and verifies each puzzle's
shape, target range, and that the recorded solution really reaches the target
under the game's rules.
