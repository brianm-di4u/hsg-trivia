// P-N03: finds numeric questions whose wrong answers form a x10 ladder around the right one ($3,000 with $300, $30,000, $300,000).
// A player who simply avoids the smallest and the largest option scores 50 percent on these instead of 25, so they are a report, not a failure.
// A question is listed when two or more of its wrong answers are the right answer times or divided by a power of ten (read from the first number in each text).
// Used by tools/apply-audit.mjs (printed after its summary) and by tests/council-w4-b.test.mjs.
const firstNumber = (s) => { const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? +m[0] : null; };
const isPowerOfTen = (r) => { if (!(r > 0)) return false; const l = Math.log10(r); return Math.abs(l - Math.round(l)) < 1e-9 && Math.round(l) !== 0; };
export function ladderOffenders(questions) {
  const out = [];
  for (const q of questions) {
    const a = firstNumber(q.answer); if (!a) continue;
    const w = (q.wrong || []).map(firstNumber); if (w.some((x) => x === null)) continue;
    const rungs = w.filter((x) => x && (isPowerOfTen(x / a) || isPowerOfTen(a / x))).length;
    if (rungs >= 2) out.push({ id: q.id, answer: q.answer, wrong: q.wrong, rungs });
  }
  return out;
}
