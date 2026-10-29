// Applies audit batch results to data/questions.json and prints a validation summary.
//   node games/trivia/tools/apply-audit.mjs <dir-with-batch-N.result.json> [--write]
// Each result record: { id, action: keep|edit|drop, set?: {...fields}, method, note }.
// Then applies the second pass on top: second-pass.json (records with `suggested`) and
// verify-N.result.json (records with `set`), verdicts ok|fix|drop.
// Starts from research/trivia-bank.json (the pristine bank), so the run is repeatable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2];
const write = process.argv.includes('--write');
const bank = JSON.parse(fs.readFileSync(path.resolve(here, '../../../research/trivia-bank.json'), 'utf8'));
const FIELDS = new Set(['question', 'answer', 'wrong', 'explanation', 'source', 'sourceUrl', 'confidence', 'difficulty', 'era', 'category']);
const ERAS = new Set(['ancient', 'frontier', 'gilded-spa', 'roaring', 'midcentury', 'revival', 'modern', 'any']);

const records = [];
for (const f of fs.readdirSync(dir).filter((f) => /^batch-\d+\.result\.json$/.test(f)).sort()) {
  for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) records.push({ ...r, batch: f });
}
const byId = new Map(records.map((r) => [r.id, r]));
// Second pass: fold fix/drop verdicts into the first-pass record for the same id.
const second = [];
const sp = path.join(dir, 'second-pass.json');
if (fs.existsSync(sp)) for (const r of JSON.parse(fs.readFileSync(sp, 'utf8'))) second.push({ ...r, set: r.suggested, file: 'second-pass.json' });
for (const f of fs.readdirSync(dir).filter((f) => /^verify-\d+\.result\.json$/.test(f)).sort()) for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) second.push({ ...r, file: f });
const verdicts = second.reduce((m, r) => ((m[r.verdict] = (m[r.verdict] || 0) + 1), m), {});
for (const r of second) {
  const base = byId.get(r.id);
  if (!base) continue;
  if (r.verdict === 'drop') byId.set(r.id, { ...base, action: 'drop', second: r });
  else if (r.verdict === 'fix' && r.set) byId.set(r.id, { ...base, action: base.action === 'drop' ? 'drop' : 'edit', set: { ...(base.set || {}), ...r.set }, second: r });
}
const problems = [];
const missing = bank.questions.filter((q) => !byId.has(q.id)).map((q) => q.id);
if (missing.length) problems.push(`no audit record: ${missing.join(', ')}`);

const out = [];
for (const q of bank.questions) {
  const r = byId.get(q.id);
  if (!r) { out.push(q); continue; }
  if (r.action === 'drop') continue;
  const nq = { ...q };
  if (r.action === 'edit') {
    for (const [k, v] of Object.entries(r.set || {})) {
      if (!FIELDS.has(k)) { problems.push(`${q.id}: unknown field ${k}`); continue; }
      nq[k] = v;
    }
  }
  nq.source = nq.source.replace(/\s*\(via search\)/i, '');
  if (!Array.isArray(nq.wrong) || nq.wrong.length !== 3) problems.push(`${q.id}: wrong[] length ${nq.wrong && nq.wrong.length}`);
  if (nq.wrong.some((w) => w.trim().toLowerCase() === nq.answer.trim().toLowerCase())) problems.push(`${q.id}: answer repeated in wrong[]`);
  if (new Set(nq.wrong.map((w) => w.toLowerCase())).size !== nq.wrong.length) problems.push(`${q.id}: duplicate distractor`);
  if (!['confirmed', 'summary', 'claim'].includes(nq.confidence)) problems.push(`${q.id}: confidence ${nq.confidence}`);
  if (!['easy', 'medium', 'hard'].includes(nq.difficulty)) problems.push(`${q.id}: difficulty ${nq.difficulty}`);
  if (!ERAS.has(nq.era)) problems.push(`${q.id}: era ${nq.era}`);
  if (nq.explanation.length > 220) problems.push(`${q.id}: explanation ${nq.explanation.length} chars`);
  if (!/^https?:\/\//.test(nq.sourceUrl)) problems.push(`${q.id}: sourceUrl ${nq.sourceUrl}`);
  out.push(nq);
}
const count = (k) => out.reduce((m, q) => ((m[q[k]] = (m[q[k]] || 0) + 1), m), {});
const finalActions = [...byId.values()].reduce((m, r) => ((m[r.action] = (m[r.action] || 0) + 1), m), {});
const actions = records.reduce((m, r) => ((m[r.action] = (m[r.action] || 0) + 1), m), {});
console.log('records', records.length, actions, 'second pass', second.length, verdicts);
console.log('final actions', finalActions, 'kept questions', out.length);
console.log('confidence', count('confidence'));
console.log('category', count('category'));
console.log('difficulty', count('difficulty'));
console.log('era', count('era'));
console.log(problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'no problems');
if (write) {
  const dest = path.resolve(here, '../data/questions.json');
  fs.writeFileSync(dest, JSON.stringify({ ...bank, version: 2, audited: '2026-10-28', questions: out }, null, 1));
  console.log('wrote', path.relative(process.cwd(), dest));
}
